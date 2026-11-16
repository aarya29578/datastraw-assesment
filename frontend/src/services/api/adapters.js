/**
 * Data Transformation Layer
 * Bridges backend snake_case schema with frontend camelCase application state.
 */

// Helper to compute initials from full name
export function getInitials(name = '') {
  if (!name) return 'EM';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const WEEKDAY_NAMES_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// -------------------------------------------------------------
// 1. Employee Adapter
// -------------------------------------------------------------
export const employeeAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    const weeklyOffs = dbRow.weekly_offs || [];
    const activeWo = weeklyOffs.find((w) => w.is_active) || weeklyOffs[0];
    const weekdayNum = activeWo !== undefined && activeWo !== null && activeWo.weekday !== undefined
      ? activeWo.weekday
      : 0;
    const weekdayName = dbRow.weekly_off || activeWo?.weekday_name || WEEKDAY_NAMES_MAP[weekdayNum] || 'Sunday';

    return {
      id: dbRow.id,
      employeeId: dbRow.employee_code,
      fullName: dbRow.full_name,
      email: dbRow.email || '',
      phone: dbRow.phone || '',
      podId: dbRow.pod_id || '',
      designation: dbRow.designation || '',
      joiningDate: dbRow.joining_date || '',
      status: dbRow.employment_status || 'ACTIVE',
      weeklyOff: weekdayName,
      weeklyOffDay: weekdayNum,
      avatar: getInitials(dbRow.full_name),
      pod: dbRow.pod
        ? {
            id: dbRow.pod.id,
            name: dbRow.pod.name,
            description: dbRow.pod.description,
          }
        : null,
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    return {
      employee_code: uiObj.employeeId || uiObj.employee_code,
      full_name: uiObj.fullName || uiObj.full_name,
      email: uiObj.email || null,
      phone: uiObj.phone || null,
      pod_id: uiObj.podId || uiObj.pod_id || null,
      designation: uiObj.designation || null,
      joining_date: uiObj.joiningDate || uiObj.joining_date || null,
      employment_status: uiObj.status || uiObj.employment_status || 'ACTIVE',
      weekly_off: uiObj.weeklyOff || uiObj.weekly_off || 'Sunday',
    };
  },
};

// -------------------------------------------------------------
// 2. Pod Adapter
// -------------------------------------------------------------
export const podAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    const brands = (dbRow.brands || []).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status || 'ACTIVE',
      employeeCount: b.employee_count ?? (b.employees?.length || 0),
      processes: b.processes || [],
      processNames: b.process_names || (b.processes || []).map((p) => p.name || p),
    }));

    return {
      id: dbRow.id,
      name: dbRow.name,
      description: dbRow.description || '',
      leadId: dbRow.lead_employee_id || '',
      leadName: dbRow.lead_employee?.full_name || 'Unassigned',
      leadEmployee: dbRow.lead_employee || null,
      employeeCount: dbRow.employee_count ?? (dbRow.employees?.length || 0),
      employees: dbRow.employees || [],
      status: 'ACTIVE',
      brandsCount: dbRow.brands_count ?? brands.length,
      brands,
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    return {
      name: uiObj.name,
      description: uiObj.description || null,
      lead_employee_id: uiObj.leadId || uiObj.lead_employee_id || null,
    };
  },
};

// -------------------------------------------------------------
// 3. Brand Adapter
// -------------------------------------------------------------
export const brandAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    const pods = (dbRow.pods || []).map((p) => ({
      id: p.id,
      name: p.name,
      employeeCount: p.employee_count ?? (p.employees?.length || 0),
    }));

    const primaryPodId = dbRow.pod_id || dbRow.primary_pod?.id || pods[0]?.id || '';
    const primaryPodName =
      dbRow.primary_pod?.name || pods[0]?.name || (pods.length > 1 ? 'Multiple Pods' : 'Unassigned');

    return {
      id: dbRow.id,
      brandId: dbRow.id.slice(0, 8).toUpperCase(),
      name: dbRow.name,
      description: dbRow.description || '',
      podId: primaryPodId,
      podName: primaryPodName,
      pods,
      podNames: dbRow.pod_names || pods.map((p) => p.name),
      primaryPod: dbRow.primary_pod || (pods[0] ? { id: pods[0].id, name: pods[0].name } : null),
      isMultiPod: Boolean(dbRow.is_multi_pod ?? (pods.length > 1)),
      status: dbRow.status || 'ACTIVE',
      operatingRequirements: 'Operating Requirements Active',
      assignedProcesses:
        dbRow.assigned_processes ||
        dbRow.process_ids ||
        dbRow.assignedProcesses ||
        (dbRow.working_rules || []).map((r) => r.process_id) ||
        [],
      processes: dbRow.processes || [],
      workingRules: dbRow.working_rules || [],
      employeeCount: dbRow.employee_count ?? 0,
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    return {
      name: uiObj.name,
      description: uiObj.description || null,
      status: uiObj.status || 'ACTIVE',
      pod_id: uiObj.podId && uiObj.podId !== '' && uiObj.podId !== 'pod_all' ? uiObj.podId : null,
      assigned_processes: uiObj.assignedProcesses || uiObj.processIds || uiObj.process_ids || [],
    };
  },
};

// -------------------------------------------------------------
// 4. Process Adapter
// -------------------------------------------------------------
export const processAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      code: dbRow.code,
      name: dbRow.name,
      description: dbRow.description || '',
      status: dbRow.status || 'ACTIVE',
      brandId: dbRow.brand_id || '',
      workingRules: dbRow.working_rules || [],
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    return {
      code: uiObj.code ? uiObj.code.trim().toUpperCase() : '',
      name: uiObj.name,
      description: uiObj.description || null,
      status: uiObj.status || 'ACTIVE',
      brand_id: uiObj.brandId || null,
    };
  },
};

// -------------------------------------------------------------
// 5. Assignment Adapter
// -------------------------------------------------------------
export const assignmentAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      employeeId: dbRow.employee_id,
      employeeName: dbRow.employee?.full_name || 'Unknown Employee',
      employeeCode: dbRow.employee?.employee_code || '',
      designation: dbRow.employee?.designation || '',
      podId: dbRow.employee?.pod_id || '',
      brandId: dbRow.brand_id,
      brandName: dbRow.brand?.name || 'Unknown Brand',
      processId: dbRow.process_id,
      processIds: Array.isArray(dbRow.process_ids)
        ? dbRow.process_ids
        : (dbRow.process_id ? [dbRow.process_id] : []),
      processName: dbRow.process?.name || 'Unknown Process',
      processCode: dbRow.process?.code || '',
      isPrimary: Boolean(dbRow.is_primary),
      createdAt: dbRow.created_at,
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    const procId =
      uiObj.processId ||
      uiObj.process_id ||
      (Array.isArray(uiObj.processIds) && uiObj.processIds[0]) ||
      (Array.isArray(uiObj.process_ids) && uiObj.process_ids[0]) ||
      null;

    const procIds = Array.isArray(uiObj.processIds)
      ? uiObj.processIds
      : Array.isArray(uiObj.process_ids)
      ? uiObj.process_ids
      : procId
      ? [procId]
      : [];

    return {
      employee_id: uiObj.employeeId || uiObj.employee_id,
      brand_id: uiObj.brandId || uiObj.brand_id,
      process_id: procId,
      process_ids: procIds,
      is_primary: Boolean(uiObj.isPrimary ?? uiObj.is_primary),
    };
  },
};

// -------------------------------------------------------------
// 6. Working Rule Adapter
// -------------------------------------------------------------
export const workingRuleAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      brandId: dbRow.brand_id,
      brandName: dbRow.brand?.name || '',
      processId: dbRow.process_id,
      processName: dbRow.process?.name || '',
      processCode: dbRow.process?.code || '',
      operatingDays: dbRow.operating_day_names || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      operatingDayNumbers: dbRow.operating_days || [1, 2, 3, 4, 5],
      minStaff: dbRow.required_staff_count || 1,
      requiredStaffCount: dbRow.required_staff_count || 1,
      operatesOnHolidays: Boolean(dbRow.operates_on_public_holidays),
      effectiveFrom: dbRow.effective_from || '',
      effectiveTo: dbRow.effective_to || '',
      isActive: Boolean(dbRow.is_active),
    };
  },

  toBackend(uiObj) {
    if (!uiObj) return {};
    return {
      brand_id: uiObj.brandId || uiObj.brand_id,
      process_id: uiObj.processId || uiObj.process_id,
      operating_days: uiObj.operatingDays || uiObj.operating_days,
      required_staff_count: uiObj.minStaff || uiObj.required_staff_count || 1,
      operates_on_public_holidays: Boolean(uiObj.operatesOnHolidays ?? uiObj.operates_on_public_holidays),
      effective_from: uiObj.effectiveFrom || uiObj.effective_from,
      effective_to: uiObj.effectiveTo || uiObj.effective_to || null,
      is_active: uiObj.isActive !== undefined ? Boolean(uiObj.isActive) : true,
    };
  },
};

// -------------------------------------------------------------
// 7. Availability Adapter (Weekly Offs, Leaves, Comp-Offs, Holidays)
// -------------------------------------------------------------
export const availabilityAdapter = {
  weeklyOffToFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      employeeId: dbRow.employee_id,
      employeeName: dbRow.employee?.full_name || '',
      employeeCode: dbRow.employee?.employee_code || '',
      weekday: dbRow.weekday,
      weekdayName: dbRow.weekday_name || 'Sunday',
      effectiveFrom: dbRow.effective_from,
      effectiveTo: dbRow.effective_to,
      isActive: Boolean(dbRow.is_active),
    };
  },

  leaveToFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      employeeId: dbRow.employee_id,
      employeeName: dbRow.employee?.full_name || '',
      employeeCode: dbRow.employee?.employee_code || '',
      leaveType: dbRow.leave_type,
      startDate: dbRow.start_date,
      endDate: dbRow.end_date,
      reason: dbRow.reason || '',
      status: dbRow.status,
      approvedBy: dbRow.approved_by,
      approverName: dbRow.approver?.full_name || '',
      approvedAt: dbRow.approved_at,
    };
  },

  compOffToFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      employeeId: dbRow.employee_id,
      employeeName: dbRow.employee?.full_name || '',
      employeeCode: dbRow.employee?.employee_code || '',
      earnedDate: dbRow.earned_on,
      offDate: dbRow.off_date,
      expiresOn: dbRow.expires_on,
      reason: dbRow.reason || '',
      status: dbRow.status,
      approvedBy: dbRow.approved_by,
      approverName: dbRow.approver?.full_name || '',
    };
  },

  holidayToFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      date: dbRow.holiday_date,
      name: dbRow.holiday_name,
      description: dbRow.description || '',
      isActive: Boolean(dbRow.is_active),
    };
  },
};

// -------------------------------------------------------------
// 8. Conflict Adapter
// -------------------------------------------------------------
export const conflictAdapter = {
  toFrontend(dbRow) {
    if (!dbRow) return null;
    return {
      id: dbRow.id,
      rosterId: dbRow.roster_id,
      roster: dbRow.roster
        ? {
            id: dbRow.roster.id,
            month: dbRow.roster.month,
            year: dbRow.roster.year,
            version: dbRow.roster.version,
            status: dbRow.roster.status,
          }
        : null,
      rosterStatus: dbRow.roster?.status || null,
      rosterVersion: dbRow.roster?.version || null,
      rosterMonth: dbRow.roster?.month || null,
      rosterYear: dbRow.roster?.year || null,
      brandId: dbRow.brand_id,
      brandName: dbRow.brand?.name || 'All Brands',
      processId: dbRow.process_id,
      processName: dbRow.process?.name || 'All Processes',
      conflictType: dbRow.conflict_type,
      severity: dbRow.severity,
      date: dbRow.conflict_date,
      requiredStaffCount: dbRow.required_staff_count ?? 0,
      requiredCount: dbRow.required_staff_count ?? 0,
      availableStaffCount: dbRow.available_staff_count ?? 0,
      availableCount: dbRow.available_staff_count ?? 0,
      description: dbRow.description || '',
      reason: dbRow.description || '',
      suggestedResolution: dbRow.suggested_resolution || '',
      resolutionNote: dbRow.suggested_resolution || '',
      status: dbRow.status,
      resolvedAt: dbRow.resolved_at,
    };
  },
};
