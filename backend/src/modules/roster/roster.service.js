import { rosterRepository } from './roster.repository.js';
import { conflictService } from '../conflicts/conflict.service.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROSTER_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED'];

class RosterService {
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  normalizeShiftStatus(status) {
    if (!status) return 'WORKING';
    const clean = status.trim().toUpperCase().replace(/[\s-]/g, '_');
    if (clean === 'WORKING' || clean === 'W') return 'WORKING';
    if (clean === 'OFF' || clean === 'WEEKLY_OFF' || clean === 'WO' || clean === 'REST') return 'WEEKLY_OFF';
    if (clean === 'LEAVE' || clean === 'L') return 'LEAVE';
    if (clean === 'HOLIDAY' || clean === 'H') return 'HOLIDAY';
    if (clean === 'COMP_OFF' || clean === 'CO') return 'COMP_OFF';
    if (clean === 'NOT_REQUIRED' || clean === 'NR') return 'NOT_REQUIRED';
    return 'WORKING';
  }

  /**
   * Helper to compute days in a given month/year (supports leap years)
   */
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Automated monthly roster generation algorithm
   * @param {Object} options { month, year, created_by }
   */
  async generateRoster({ month, year, created_by }) {
    const numMonth = parseInt(month, 10);
    const numYear = parseInt(year, 10);

    if (isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      throw new AppError('Month must be an integer between 1 and 12', 400);
    }
    if (isNaN(numYear) || numYear < 2020 || numYear > 2040) {
      throw new AppError('Year must be a valid 4-digit year (2020-2040)', 400);
    }

    if (created_by && !this.validateUUID(created_by)) {
      throw new AppError('Invalid creator employee ID format', 400);
    }

    const daysInMonth = this.getDaysInMonth(numYear, numMonth);
    const startDate = `${numYear}-${String(numMonth).padStart(2, '0')}-01`;
    const endDate = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Check or create roster header safely
    const { data: roster, isNewVersion, previousRoster, error: headerErr } =
      await rosterRepository.findOrCreateRosterHeader({
        month: numMonth,
        year: numYear,
        created_by: created_by || null,
      });

    if (headerErr) {
      throw new AppError(`Failed to resolve roster header: ${headerErr.message}`, 500);
    }
    if (!roster) {
      throw new AppError('Unable to obtain or create a valid roster header', 500);
    }

    // 2. Gather context
    // When generating a new version from a published roster, inspect manual overrides from previous version.
    // For existing draft/review, inspect manual overrides in current roster.id.
    const lookupRosterId = isNewVersion && previousRoster ? previousRoster.id : roster.id;

    const [
      { data: assignments, error: asgnErr },
      { data: rules, error: ruleErr },
      { data: weeklyOffs, error: wOffErr },
      { data: leaves, error: leaveErr },
      { data: compOffs, error: compErr },
      { data: holidays, error: holErr },
      { data: existingEntries, error: entriesErr },
    ] = await Promise.all([
      rosterRepository.getActiveAssignments(),
      rosterRepository.getActiveWorkingRules(),
      rosterRepository.getActiveWeeklyOffs(),
      rosterRepository.getApprovedLeavesForMonth(startDate, endDate),
      rosterRepository.getApprovedCompOffsForMonth(startDate, endDate),
      rosterRepository.getHolidaysForMonth(startDate, endDate),
      rosterRepository.getRosterEntries(lookupRosterId),
    ]);

    if (asgnErr) throw new AppError(`Failed to load employee assignments: ${asgnErr.message}`, 500);
    if (ruleErr) throw new AppError(`Failed to load working rules: ${ruleErr.message}`, 500);
    if (wOffErr) throw new AppError(`Failed to load weekly offs: ${wOffErr.message}`, 500);
    if (leaveErr) throw new AppError(`Failed to load leaves: ${leaveErr.message}`, 500);
    if (compErr) throw new AppError(`Failed to load comp offs: ${compErr.message}`, 500);
    if (holErr) throw new AppError(`Failed to load public holidays: ${holErr.message}`, 500);
    if (entriesErr) throw new AppError(`Failed to load roster entries: ${entriesErr.message}`, 500);

    if (!assignments || assignments.length === 0) {
      throw new AppError(
        'No active employee assignments found to schedule. Assign employees to brands/processes first.',
        400,
        {
          code: 'NO_ACTIVE_ASSIGNMENTS',
          suggestion: 'Navigate to the Assignments page and assign active team members to brands and processes before generating a roster.',
        }
      );
    }

    // Map existing manually edited entries: key = `${assignment_id}_${work_date}`
    const manualEntriesMap = new Map();
    (existingEntries || []).forEach((e) => {
      if (e.is_manually_edited) {
        manualEntriesMap.set(`${e.assignment_id}_${e.work_date}`, e);
      }
    });

    // Map public holidays
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

    // Map working rules by `${brand_id}_${process_id}`
    const ruleMap = new Map();
    (rules || []).forEach((r) => {
      ruleMap.set(`${r.brand_id}_${r.process_id}`, r);
    });

    // 3. Generate shift entries
    const entriesToInsert = [];

    for (const assignment of assignments) {
      const { id: assignmentId, employee_id, brand_id, process_id } = assignment;
      const rule = ruleMap.get(`${brand_id}_${process_id}`);
      const opDays = new Set(rule?.operating_days || [1, 2, 3, 4, 5]); // default Mon-Fri if no rule
      const operatesOnHoliday = rule ? Boolean(rule.operates_on_public_holidays) : false;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${numYear}-${String(numMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const weekday = new Date(numYear, numMonth - 1, day).getDay(); // 0 (Sun) to 6 (Sat)
        const cacheKey = `${assignmentId}_${dateStr}`;

        // Preserve manual edits!
        if (manualEntriesMap.has(cacheKey)) {
          const manualEntry = manualEntriesMap.get(cacheKey);
          if (isNewVersion) {
            // When creating a new version from a published roster, copy manual overrides forward into the new draft
            entriesToInsert.push({
              roster_id: roster.id,
              assignment_id: assignmentId,
              work_date: dateStr,
              status: manualEntry.status,
              notes: manualEntry.notes || '',
              is_manually_edited: true,
            });
          }
          continue;
        }

        // Determine baseline status based on rules priority:
        // Priority order:
        // 1. HOLIDAY: Applicable public holiday
        // 2. LEAVE: Approved employee leave
        // 3. COMP_OFF: Approved comp-off
        // 4. WEEKLY_OFF: Employee's configured weekly off (preserved even if process is closed)
        // 5. NOT_REQUIRED: Process is closed and the employee does not have a weekly off on that date
        // 6. WORKING: Process is operational and the employee is scheduled to work
        let status = 'WORKING';
        let note = '';

        const empLeaves = empLeaveMap.get(employee_id) || [];
        const isLeave = empLeaves.some((l) => dateStr >= l.start_date && dateStr <= l.end_date);
        const isCompOff = Boolean(empCompOffMap.get(employee_id)?.has(dateStr));
        const isWeeklyOff = Boolean(empWeeklyOffMap.get(employee_id)?.has(weekday));
        const isHoliday = Boolean(holidayMap.has(dateStr) && !operatesOnHoliday);
        const isOperatingDay = opDays.has(weekday);

        // Priority 1: HOLIDAY (Applicable public holiday)
        if (isHoliday) {
          status = 'HOLIDAY';
          note = holidayMap.get(dateStr)?.holiday_name || 'Public Holiday';
        }
        // Priority 2: LEAVE (Approved employee leave)
        else if (isLeave) {
          status = 'LEAVE';
          note = 'Approved Leave';
        }
        // Priority 3: COMP_OFF (Approved comp-off)
        else if (isCompOff) {
          status = 'COMP_OFF';
          note = 'Approved Compensatory Off';
        }
        // Priority 4: WEEKLY_OFF (Employee's configured weekly off - preserved on non-operating days too)
        else if (isWeeklyOff) {
          status = 'WEEKLY_OFF';
          note = 'Scheduled Weekly Off';
        }
        // Priority 5: NOT_REQUIRED (Process closed and employee does not have weekly off on this date)
        else if (!isOperatingDay) {
          status = 'NOT_REQUIRED';
          note = 'Process Closed';
        }
        // Priority 6: WORKING (Process is operational and employee is scheduled to work)
        else {
          status = 'WORKING';
        }

        entriesToInsert.push({
          roster_id: roster.id,
          assignment_id: assignmentId,
          work_date: dateStr,
          status,
          notes: note,
          is_manually_edited: false,
        });
      }
    }

    // 4. Clean out non-manual entries and insert freshly generated baseline
    const { error: delErr } = await rosterRepository.deleteNonManualEntries(roster.id);
    if (delErr) throw new AppError(`Failed to clear old non-manual entries: ${delErr.message}`, 500);

    if (entriesToInsert.length > 0) {
      const { error: insertErr } = await rosterRepository.insertEntriesBulk(entriesToInsert);
      if (insertErr) throw new AppError(`Failed to save roster entries: ${insertErr.message}`, 500);
    }

    // 5. Trigger automated conflict validation for this roster
    let conflictStats = { total_conflicts: 0, critical: 0, warning: 0, info: 0 };
    try {
      const conflicts = await conflictService.validateRoster(roster.id);
      conflictStats = {
        total_conflicts: conflicts.length,
        critical: conflicts.filter((c) => c.severity === 'CRITICAL').length,
        warning: conflicts.filter((c) => c.severity === 'WARNING').length,
        info: conflicts.filter((c) => c.severity === 'INFO').length,
      };
    } catch (confErr) {
      console.warn('[Conflict Engine Warning] Auto-validation error on generation:', confErr.message);
    }

    return {
      roster,
      days_in_month: daysInMonth,
      total_entries_generated: entriesToInsert.length,
      total_manual_entries_preserved: manualEntriesMap.size,
      conflict_summary: conflictStats,
    };
  }

  /**
   * Retrieve all rosters with pagination
   */
  async getAllRosters(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const { year, month, status } = query;

    const { data: rosters, count, error } = await rosterRepository.findAllRosters({
      page,
      limit,
      year: year ? parseInt(year, 10) : null,
      month: month ? parseInt(month, 10) : null,
      status: status ? status.trim().toUpperCase() : null,
    });

    if (error) throw new AppError(`Failed to retrieve rosters: ${error.message}`, 500);

    return {
      rosters,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  /**
   * Retrieve a roster by ID
   */
  async getRosterById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid roster ID format', 400);
    const { data: roster, error } = await rosterRepository.findRosterById(id);
    if (error) throw new AppError(`Failed to retrieve roster: ${error.message}`, 500);
    if (!roster) throw new AppError('Roster not found', 404);
    return roster;
  }

  /**
   * Retrieve roster entries with structured 2D grid matrix for frontend
   */
  async getRosterEntries(rosterId, query = {}) {
    if (!this.validateUUID(rosterId)) throw new AppError('Invalid roster ID format', 400);

    const roster = await this.getRosterById(rosterId);
    const { data: entries, error } = await rosterRepository.getRosterEntries(rosterId, query);
    if (error) throw new AppError(`Failed to retrieve roster entries: ${error.message}`, 500);

    // Transform entries into 2D grid matrix: grid[employeeId][dateKey] = cell
    const grid = {};
    (entries || []).forEach((e) => {
      const empId = e.assignment?.employee_id;
      if (!empId) return;

      if (!grid[empId]) {
        grid[empId] = {};
      }

      grid[empId][e.work_date] = {
        entry_id: e.id,
        assignment_id: e.assignment_id,
        status: e.status,
        notes: e.notes || '',
        is_manually_edited: Boolean(e.is_manually_edited),
        brand_id: e.assignment?.brand_id,
        process_id: e.assignment?.process_id,
        brand_name: e.assignment?.brand?.name,
        process_code: e.assignment?.process?.code,
        process_name: e.assignment?.process?.name,
      };
    });

    return {
      roster,
      entries_count: (entries || []).length,
      grid,
      entries,
    };
  }

  /**
   * Manually update a single roster cell/entry
   */
  async updateRosterEntry(rosterId, entryId, updateData) {
    if (!this.validateUUID(rosterId)) throw new AppError('Invalid roster ID format', 400);
    if (!this.validateUUID(entryId)) throw new AppError('Invalid entry ID format', 400);

    const { data: roster, error: rosterErr } = await rosterRepository.findRosterById(rosterId);
    if (rosterErr) throw new AppError(`Database error: ${rosterErr.message}`, 500);
    if (!roster) throw new AppError('Roster not found', 404);
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

    const existingEntry = await rosterRepository.findEntryById(entryId);
    if (!existingEntry.data) throw new AppError('Roster entry not found', 404);

    const payload = {
      is_manually_edited: true,
    };
    if (updateData.status) payload.status = this.normalizeShiftStatus(updateData.status);
    if (updateData.notes !== undefined) payload.notes = updateData.notes;

    const { data: updated, error } = await rosterRepository.updateEntry(entryId, payload);
    if (error) throw new AppError(`Failed to update roster entry: ${error.message}`, 500);

    // Trigger conflict revalidation
    try {
      await conflictService.validateRoster(rosterId);
    } catch (err) {
      console.warn('[Conflict Engine Warning] Revalidation after entry edit:', err.message);
    }

    return updated;
  }

  /**
   * Bulk update multiple entries
   */
  async bulkUpdateEntries(rosterId, updates) {
    if (!this.validateUUID(rosterId)) throw new AppError('Invalid roster ID format', 400);
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates must be a non-empty array of entry objects', 400);
    }

    const { data: roster, error: rosterErr } = await rosterRepository.findRosterById(rosterId);
    if (rosterErr) throw new AppError(`Database error: ${rosterErr.message}`, 500);
    if (!roster) throw new AppError('Roster not found', 404);
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

    const updatedRecords = [];
    for (const item of updates) {
      if (!item.entry_id || !this.validateUUID(item.entry_id)) continue;
      const { data } = await rosterRepository.updateEntry(item.entry_id, {
        status: item.status ? this.normalizeShiftStatus(item.status) : undefined,
        notes: item.notes !== undefined ? item.notes : undefined,
        is_manually_edited: true,
      });
      if (data) updatedRecords.push(data);
    }

    // Trigger conflict revalidation
    try {
      await conflictService.validateRoster(rosterId);
    } catch (err) {
      console.warn('[Conflict Engine Warning] Revalidation after bulk update:', err.message);
    }

    return {
      updated_count: updatedRecords.length,
      records: updatedRecords,
    };
  }

  /**
   * Update roster status (DRAFT -> REVIEW -> PUBLISHED)
   */
  async updateRosterStatus(rosterId, newStatus) {
    if (!this.validateUUID(rosterId)) throw new AppError('Invalid roster ID format', 400);
    const upper = newStatus ? newStatus.trim().toUpperCase() : '';
    if (!VALID_ROSTER_STATUSES.includes(upper)) {
      throw new AppError(`Invalid status. Allowed values: ${VALID_ROSTER_STATUSES.join(', ')}`, 400);
    }

    const updatePayload = { status: upper };
    if (upper === 'PUBLISHED') {
      updatePayload.published_at = new Date().toISOString();
    }

    const { data: updated, error } = await rosterRepository.updateRoster(rosterId, updatePayload);
    if (error) throw new AppError(`Failed to update roster status: ${error.message}`, 500);
    return updated;
  }

  /**
   * Retrieve active roster cycle
   */
  async getActiveCycle() {
    const { data, error } = await rosterRepository.findActiveCycle();
    if (error) throw new AppError(`Failed to retrieve active roster cycle: ${error.message}`, 500);
    return data;
  }
}

export const rosterService = new RosterService();
export default rosterService;
