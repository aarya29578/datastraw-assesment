import { conflictRepository } from './conflict.repository.js';
import { rosterRepository } from '../roster/roster.repository.js';
import { employeeRepository } from '../employees/employee.repository.js';
import { supabase } from '../../config/supabase.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ConflictService {
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  /**
   * Run full conflict detection for a given roster
   * @param {string} rosterId
   * @returns {Promise<Array>} List of detected conflicts
   */
  async validateRoster(rosterId) {
    if (!this.validateUUID(rosterId)) throw new AppError('Invalid roster ID format', 400);

    const { data: roster, error: rErr } = await rosterRepository.findRosterById(rosterId);
    if (rErr || !roster) throw new AppError('Roster not found', 404);

    const { month, year } = roster;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Gather all required context from DB
    const [
      { data: entries },
      { data: rules },
      { data: weeklyOffs },
      { data: leaves },
      { data: compOffs },
      { data: holidays },
    ] = await Promise.all([
      rosterRepository.getRosterEntries(rosterId),
      rosterRepository.getActiveWorkingRules(),
      rosterRepository.getActiveWeeklyOffs(),
      rosterRepository.getApprovedLeavesForMonth(startDate, endDate),
      rosterRepository.getApprovedCompOffsForMonth(startDate, endDate),
      rosterRepository.getHolidaysForMonth(startDate, endDate),
    ]);

    const detectedConflicts = [];

    // Map holidays by YYYY-MM-DD
    const holidayMap = new Map();
    (holidays || []).forEach((h) => holidayMap.set(h.holiday_date, h));

    // Map weekly offs by employee_id -> Set of weekdays (0..6)
    const empWeeklyOffMap = new Map();
    (weeklyOffs || []).forEach((w) => {
      if (!empWeeklyOffMap.has(w.employee_id)) empWeeklyOffMap.set(w.employee_id, new Set());
      empWeeklyOffMap.get(w.employee_id).add(w.weekday);
    });

    // Map approved leaves by employee_id -> Array of { start_date, end_date }
    const empLeaveMap = new Map();
    (leaves || []).forEach((l) => {
      if (!empLeaveMap.has(l.employee_id)) empLeaveMap.set(l.employee_id, []);
      empLeaveMap.get(l.employee_id).push(l);
    });

    // Map approved comp-offs by employee_id -> Set of off_date
    const empCompOffMap = new Map();
    (compOffs || []).forEach((c) => {
      if (!empCompOffMap.has(c.employee_id)) empCompOffMap.set(c.employee_id, new Set());
      empCompOffMap.get(c.employee_id).add(c.off_date);
    });

    // Group roster entries by (Brand + Process + Date) and by Employee
    const brandProcDateWorkingCounts = new Map(); // key: `${brandId}_${procId}_${date}` -> count
    const empDailyShifts = new Map(); // key: employeeId -> Array of { date, status }

    (entries || []).forEach((entry) => {
      const { work_date, status, assignment } = entry;
      if (!assignment) return;
      const { employee_id, brand_id, process_id } = assignment;

      // Track daily shifts per employee for individual checks
      if (!empDailyShifts.has(employee_id)) empDailyShifts.set(employee_id, []);
      empDailyShifts.get(employee_id).push({
        date: work_date,
        status,
        brand_id,
        process_id,
        employee_name: assignment.employee?.full_name,
      });

      // Track active working headcounts per process
      if (status === 'WORKING') {
        const bpKey = `${brand_id}_${process_id}_${work_date}`;
        brandProcDateWorkingCounts.set(bpKey, (brandProcDateWorkingCounts.get(bpKey) || 0) + 1);
      }
    });

    // -------------------------------------------------------------
    // RULE CHECK 1: Process Coverage & Understaffing (CRITICAL)
    // -------------------------------------------------------------
    for (const rule of rules || []) {
      const { brand_id, process_id, operating_days, operates_on_public_holidays, required_staff_count } = rule;
      const opDaysSet = new Set(operating_days || []);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const weekday = new Date(year, month - 1, day).getDay(); // 0..6
        const isHoliday = holidayMap.has(dateStr);

        const isOperatingDay = opDaysSet.has(weekday);
        const operatesOnHoliday = isHoliday ? Boolean(operates_on_public_holidays) : true;

        if (isOperatingDay && operatesOnHoliday) {
          const bpKey = `${brand_id}_${process_id}_${dateStr}`;
          const currentStaff = brandProcDateWorkingCounts.get(bpKey) || 0;

          if (currentStaff < required_staff_count) {
            detectedConflicts.push({
              roster_id: rosterId,
              brand_id,
              process_id,
              conflict_type: 'UNDERSTAFFED_PROCESS',
              severity: 'CRITICAL',
              conflict_date: dateStr,
              required_staff_count,
              available_staff_count: currentStaff,
              description: `Process is understaffed on ${dateStr}. Required: ${required_staff_count}, Scheduled: ${currentStaff}.`,
              suggested_resolution: `Assign ${required_staff_count - currentStaff} more qualified employee(s) to this shift.`,
              status: 'OPEN',
            });
          }
        }
      }
    }

    // -------------------------------------------------------------
    // RULE CHECK 2: Employee Schedule Violations (CRITICAL / WARNING)
    // -------------------------------------------------------------
    for (const [empId, shifts] of empDailyShifts.entries()) {
      // Sort shifts chronologically
      shifts.sort((a, b) => a.date.localeCompare(b.date));

      // Check for overlapping responsibilities (multiple working shifts on the same date)
      const dailyWorkingShiftsMap = new Map();
      shifts.forEach((s) => {
        if (s.status === 'WORKING') {
          if (!dailyWorkingShiftsMap.has(s.date)) dailyWorkingShiftsMap.set(s.date, []);
          dailyWorkingShiftsMap.get(s.date).push(s);
        }
      });

      for (const [shiftDate, workingShiftsOnDate] of dailyWorkingShiftsMap.entries()) {
        if (workingShiftsOnDate.length > 1) {
          detectedConflicts.push({
            roster_id: rosterId,
            brand_id: workingShiftsOnDate[0].brand_id,
            process_id: workingShiftsOnDate[0].process_id,
            conflict_type: 'OVERLAPPING_RESPONSIBILITIES',
            severity: 'WARNING',
            conflict_date: shiftDate,
            description: `${workingShiftsOnDate[0].employee_name || 'Employee'} is assigned to ${workingShiftsOnDate.length} overlapping working shifts on ${shiftDate}.`,
            suggested_resolution: 'Adjust shift timings, designate a primary duty, or reassign secondary process to a colleague.',
            status: 'OPEN',
          });
        }
      }

      let consecutiveWorkingDays = 0;

      for (const shift of shifts) {
        const { date, status, brand_id, process_id, employee_name } = shift;
        const weekday = new Date(date).getDay();

        if (status === 'WORKING') {
          consecutiveWorkingDays++;

          // A. Employee scheduled on Approved Leave (CRITICAL)
          const empLeaves = empLeaveMap.get(empId) || [];
          const onLeave = empLeaves.some((l) => date >= l.start_date && date <= l.end_date);
          if (onLeave) {
            detectedConflicts.push({
              roster_id: rosterId,
              brand_id,
              process_id,
              conflict_type: 'ON_LEAVE_SCHEDULED',
              severity: 'CRITICAL',
              conflict_date: date,
              description: `${employee_name || 'Employee'} is scheduled to work on approved leave date (${date}).`,
              suggested_resolution: 'Reassign shift to another available agent or cancel leave request.',
              status: 'OPEN',
            });
          }

          // B. Employee scheduled on Approved Comp-Off (WARNING)
          const empCompOffs = empCompOffMap.get(empId) || new Set();
          if (empCompOffs.has(date)) {
            detectedConflicts.push({
              roster_id: rosterId,
              brand_id,
              process_id,
              conflict_type: 'WORK_ON_COMP_OFF',
              severity: 'WARNING',
              conflict_date: date,
              description: `${employee_name || 'Employee'} is scheduled to work on approved compensatory off date (${date}).`,
              suggested_resolution: 'Reschedule the comp-off or remove working shift.',
              status: 'OPEN',
            });
          }

          // C. Employee scheduled on Weekly Off (WARNING)
          const weeklyOffDays = empWeeklyOffMap.get(empId) || new Set();
          if (weeklyOffDays.has(weekday)) {
            detectedConflicts.push({
              roster_id: rosterId,
              brand_id,
              process_id,
              conflict_type: 'WORK_ON_OFF_DAY',
              severity: 'WARNING',
              conflict_date: date,
              description: `${employee_name || 'Employee'} is scheduled to work on their weekly off day (${date}).`,
              suggested_resolution: 'Provide overtime approval or reassign shift.',
              status: 'OPEN',
            });
          }

          // D. Consecutive Working Days Warning (INFO)
          if (consecutiveWorkingDays > 6) {
            detectedConflicts.push({
              roster_id: rosterId,
              brand_id,
              process_id,
              conflict_type: 'CONSECUTIVE_DAYS_WARNING',
              severity: 'INFO',
              conflict_date: date,
              description: `${employee_name || 'Employee'} is scheduled for ${consecutiveWorkingDays} consecutive working days ending on ${date}.`,
              suggested_resolution: 'Consider scheduling a rest day to comply with labor fatigue guidelines.',
              status: 'OPEN',
            });
          }
        } else {
          // Rest day breaks consecutive streak
          consecutiveWorkingDays = 0;
        }
      }
    }

    // 2. Safe Revalidation: delete existing OPEN conflicts and insert newly evaluated ones
    await conflictRepository.deleteOpenConflictsForRoster(rosterId);
    let inserted = [];
    if (detectedConflicts.length > 0) {
      const res = await conflictRepository.createConflictsBulk(detectedConflicts);
      inserted = res.data || [];
    }

    return inserted.length > 0 ? inserted : detectedConflicts;
  }

  /**
   * Retrieve conflicts with filtering and pagination
   */
  async getAllConflicts(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const { roster_id, severity, status, conflict_type, brand_id, process_id } = query;

    if (roster_id && !this.validateUUID(roster_id)) throw new AppError('Invalid roster ID format', 400);

    const { data: conflicts, count, error } = await conflictRepository.findConflicts({
      page,
      limit,
      roster_id,
      severity: severity ? severity.trim().toUpperCase() : null,
      status: status ? status.trim().toUpperCase() : null,
      conflict_type,
      brand_id,
      process_id,
    });

    if (error) throw new AppError(`Failed to retrieve conflicts: ${error.message}`, 500);

    return {
      conflicts,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  /**
   * Retrieve conflict by ID
   */
  async getConflictById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid conflict ID', 400);
    const { data, error } = await conflictRepository.findConflictById(id);
    if (error) throw new AppError(`Failed to retrieve conflict: ${error.message}`, 500);
    if (!data) throw new AppError('Conflict not found', 404);
    return data;
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(id, resolutionNote) {
    if (!this.validateUUID(id)) throw new AppError('Invalid conflict ID', 400);
    const conflict = await this.getConflictById(id);

    if (conflict.status === 'RESOLVED') {
      throw new AppError('This conflict has already been resolved.', 409, {
        code: 'CONFLICT_ALREADY_RESOLVED',
        suggestion: 'No further action is required as this conflict was previously marked as resolved.',
      });
    }

    const updatePayload = {
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
    };
    if (resolutionNote) updatePayload.suggested_resolution = resolutionNote;

    const { data, error } = await conflictRepository.updateConflict(id, updatePayload);
    if (error) throw new AppError(`Failed to resolve conflict: ${error.message}`, 500);
    return data;
  }

  /**
   * Resolve a conflict by assigning an eligible replacement employee
   * Atomically:
   * 1. Validates conflict, employee eligibility, and roster lock status
   * 2. Modifies draft roster entry for the replacement employee
   * 3. Marks conflict as RESOLVED
   * 4. Revalidates entire roster conflict state
   */
  async resolveWithReplacement(id, { replacementEmployeeId, resolutionNote }) {
    if (!this.validateUUID(id)) throw new AppError('Invalid conflict ID format', 400);
    if (!replacementEmployeeId || !this.validateUUID(replacementEmployeeId)) {
      throw new AppError('Valid replacement employee ID is required', 400);
    }

    const conflict = await this.getConflictById(id);

    if (conflict.status === 'RESOLVED') {
      throw new AppError('This conflict has already been resolved.', 409, {
        code: 'CONFLICT_ALREADY_RESOLVED',
        suggestion: 'No further action is required as this conflict was previously marked as resolved.',
      });
    }

    // 1. Check replacement employee eligibility
    const { data: replacementEmp, error: empErr } = await employeeRepository.findById(replacementEmployeeId);
    if (empErr) throw new AppError(`Failed to verify employee: ${empErr.message}`, 500);
    if (!replacementEmp) throw new AppError('Replacement employee does not exist', 404);
    if (replacementEmp.employment_status !== 'ACTIVE') {
      throw new AppError('Cannot assign an inactive employee as replacement', 400);
    }

    // Check if replacement employee has approved leave on conflict date
    const dateKey = conflict.conflict_date;
    const { data: leaves } = await rosterRepository.getApprovedLeavesForMonth(dateKey, dateKey);
    const hasApprovedLeave = (leaves || []).some(
      (l) => l.employee_id === replacementEmployeeId && dateKey >= l.start_date && dateKey <= l.end_date
    );
    if (hasApprovedLeave) {
      throw new AppError('Selected replacement employee has an approved leave on this date', 400);
    }

    // 2. Check roster status - never modify a published roster
    const rosterId = conflict.roster_id;
    const { data: roster, error: rErr } = await rosterRepository.findRosterById(rosterId);
    if (rErr || !roster) throw new AppError('Associated roster not found', 404);

    if (roster.status === 'PUBLISHED') {
      throw new AppError(
        'Cannot modify entries on a published roster. Generate a new revision first.',
        400,
        {
          code: 'PUBLISHED_ROSTER_LOCKED',
          suggestion: 'Click "Generate Roster" to automatically create a new draft revision for this month before modifying shift assignments.',
        }
      );
    }

    const noteText = resolutionNote || `Replacement coverage for ${conflict.brand?.name || 'brand'} (${conflict.process?.name || 'process'})`;

    // 3. Find or create roster entry for replacement employee on that date
    const { data: empEntries } = await rosterRepository.getRosterEntries(rosterId, {
      employee_id: replacementEmployeeId,
    });
    const existingEntry = (empEntries || []).find((e) => e.work_date === dateKey);

    if (existingEntry) {
      await rosterRepository.updateEntry(existingEntry.id, {
        status: 'WORKING',
        notes: noteText,
        is_manually_edited: true,
      });
    } else {
      const { data: assignments } = await rosterRepository.getActiveAssignments();
      let asgn = (assignments || []).find(
        (a) => a.employee_id === replacementEmployeeId && a.brand_id === conflict.brand_id && a.process_id === conflict.process_id
      );
      if (!asgn) {
        asgn = (assignments || []).find((a) => a.employee_id === replacementEmployeeId);
      }
      if (!asgn) {
        // Automatically create operational assignment for replacement specialist
        const { data: newAsgn } = await supabase
          .from('employee_assignments')
          .insert([{
            employee_id: replacementEmployeeId,
            brand_id: conflict.brand_id,
            process_id: conflict.process_id,
            is_primary: false,
          }])
          .select()
          .single();
        asgn = newAsgn;
      }
      if (asgn) {
        await supabase.from('roster_entries').insert([{
          roster_id: rosterId,
          assignment_id: asgn.id,
          work_date: dateKey,
          status: 'WORKING',
          notes: noteText,
          is_manually_edited: true,
        }]);
      }
    }

    // 4. Mark conflict as RESOLVED
    const updatePayload = {
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      suggested_resolution: noteText,
    };
    const { data: updatedConflict, error: uErr } = await conflictRepository.updateConflict(id, updatePayload);
    if (uErr) throw new AppError(`Failed to update conflict: ${uErr.message}`, 500);

    // 5. Revalidate conflicts for this roster
    try {
      await this.validateRoster(rosterId);
    } catch (vErr) {
      console.warn('[Conflict Engine Warning] Revalidation after replacement:', vErr.message);
    }

    return updatedConflict;
  }

  /**
   * Ignore a conflict
   */
  async ignoreConflict(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid conflict ID', 400);
    const conflict = await this.getConflictById(id);

    if (conflict.status === 'IGNORED') {
      throw new AppError('This conflict has already been ignored.', 409, {
        code: 'CONFLICT_ALREADY_IGNORED',
        suggestion: 'No further action is required as this conflict was already marked as ignored.',
      });
    }

    const { data, error } = await conflictRepository.updateConflict(id, {
      status: 'IGNORED',
      updated_at: new Date().toISOString(),
    });
    if (error) throw new AppError(`Failed to ignore conflict: ${error.message}`, 500);
    return data;
  }
}

export const conflictService = new ConflictService();
export default conflictService;
