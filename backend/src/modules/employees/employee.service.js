import { employeeRepository } from './employee.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

const WEEKDAY_MAP = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class EmployeeService {
  /**
   * Validate UUID string
   * @param {string} id
   * @returns {boolean}
   */
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
  }

  /**
   * Validate Email format
   * @param {string} email
   * @returns {boolean}
   */
  validateEmail(email) {
    return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
  }

  /**
   * Validate Phone format
   * @param {string} phone
   * @returns {boolean}
   */
  validatePhone(phone) {
    return typeof phone === 'string' && PHONE_REGEX.test(phone.trim());
  }

  /**
   * Normalize weekday name or number to 0..6
   * @param {string|number} val
   * @returns {number}
   */
  normalizeWeekday(val) {
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 6) {
      return val;
    }
    if (typeof val === 'string') {
      const clean = val.trim().toLowerCase();
      if (WEEKDAY_MAP[clean] !== undefined) return WEEKDAY_MAP[clean];
      const parsed = parseInt(clean, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) return parsed;
    }
    return 0; // Default to Sunday
  }

  /**
   * Format employee response with joined weekly off day name and metadata
   * @param {Object} emp
   * @returns {Object}
   */
  formatEmployeeResponse(emp) {
    if (!emp) return null;
    const weeklyOffs = emp.weekly_offs || [];
    const activeWo = weeklyOffs.find((w) => w.is_active) || weeklyOffs[0];
    const weekdayNum = activeWo !== undefined && activeWo !== null && activeWo.weekday !== undefined
      ? activeWo.weekday
      : 0;
    const weekdayName = WEEKDAY_NAMES[weekdayNum] || 'Sunday';

    return {
      ...emp,
      weekly_off: weekdayName,
      weekly_off_day: weekdayNum,
      weekly_offs: weeklyOffs.map((w) => ({
        ...w,
        weekday_name: WEEKDAY_NAMES[w.weekday] || 'Sunday',
      })),
    };
  }

  /**
   * Create a new employee
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createEmployee(data) {
    const {
      employee_code,
      full_name,
      email,
      phone,
      pod_id,
      designation,
      joining_date,
    } = data;

    // 1. Mandatory field validations
    if (!employee_code || typeof employee_code !== 'string' || employee_code.trim() === '') {
      throw new AppError('Employee code is required', 400, {
        code: 'EMPLOYEE_CODE_REQUIRED',
        suggestion: 'Please provide a unique employee ID code (e.g. DS008).',
      });
    }
    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
      throw new AppError('Full name is required', 400, {
        code: 'FULL_NAME_REQUIRED',
        suggestion: 'Please enter the full legal name of the employee.',
      });
    }

    const trimmedCode = employee_code.trim();
    const trimmedName = full_name.trim();

    // 2. Validate email format if provided
    let cleanEmail = null;
    if (email && email.trim() !== '') {
      cleanEmail = email.trim().toLowerCase();
      if (!this.validateEmail(cleanEmail)) {
        throw new AppError('Invalid email format', 400, {
          code: 'INVALID_EMAIL_FORMAT',
          suggestion: 'Please enter a valid email address (e.g. employee@datastraw.io).',
        });
      }
    }

    // 3. Validate phone format if provided
    let cleanPhone = null;
    if (phone && phone.trim() !== '') {
      cleanPhone = phone.trim();
      if (!this.validatePhone(cleanPhone)) {
        throw new AppError('Invalid phone number format', 400, {
          code: 'INVALID_PHONE_FORMAT',
          suggestion: 'Please enter a valid phone number (e.g. +91 9876543210).',
        });
      }
    }

    // 4. Validate pod_id if provided
    let cleanPodId = null;
    if (pod_id) {
      if (!this.validateUUID(pod_id)) {
        throw new AppError('Invalid pod ID format', 400, {
          code: 'INVALID_POD_ID_FORMAT',
          suggestion: 'Please select a valid operational pod from the list.',
        });
      }
      const podExists = await employeeRepository.checkPodExists(pod_id);
      if (!podExists) {
        throw new AppError('Referenced pod does not exist', 400, {
          code: 'REFERENCED_POD_NOT_FOUND',
          suggestion: 'The selected pod no longer exists. Please refresh and select an active pod.',
        });
      }
      cleanPodId = pod_id;
    }

    // 5. Check duplicate employee_code
    const existingCode = await employeeRepository.findByCode(trimmedCode);
    if (existingCode.data) {
      throw new AppError(`Employee code '${trimmedCode}' is already in use`, 409, {
        code: 'DUPLICATE_EMPLOYEE_CODE',
        details: { employee_code: trimmedCode },
        suggestion: 'An employee with this ID code already exists. Please enter a different unique ID.',
      });
    }

    // 6. Check duplicate email if provided
    if (cleanEmail) {
      const existingEmail = await employeeRepository.findByEmail(cleanEmail);
      if (existingEmail.data) {
        throw new AppError(`Email '${cleanEmail}' is already in use`, 409, {
          code: 'DUPLICATE_EMAIL',
          details: { email: cleanEmail },
          suggestion: 'An employee with this email already exists. Please provide a different email address.',
        });
      }
    }

    // 7. Prepare payload for insertion
    const payload = {
      employee_code: trimmedCode,
      full_name: trimmedName,
      email: cleanEmail,
      phone: cleanPhone,
      pod_id: cleanPodId,
      designation: designation ? designation.trim() : null,
      joining_date: joining_date || null,
      employment_status: 'ACTIVE',
    };

    const { data: createdEmployee, error } = await employeeRepository.create(payload);

    if (error) {
      // Check for Postgres unique violation codes (23505) as fallback
      if (error.code === '23505') {
        if (error.message.includes('employee_code')) {
          throw new AppError(`Employee code '${trimmedCode}' already exists`, 409);
        }
        if (error.message.includes('email')) {
          throw new AppError(`Email '${cleanEmail}' already exists`, 409);
        }
        throw new AppError('A record with duplicate unique fields already exists', 409);
      }
      throw new AppError(`Failed to create employee: ${error.message}`, 500);
    }

    // Persist weekly off if provided
    if (data.weekly_off !== undefined || data.weeklyOff !== undefined) {
      const wOffVal = data.weekly_off ?? data.weeklyOff;
      const normalizedWOff = this.normalizeWeekday(wOffVal);
      await employeeRepository.upsertWeeklyOff(createdEmployee.id, normalizedWOff);
    }

    const { data: freshCreated } = await employeeRepository.findById(createdEmployee.id);
    return this.formatEmployeeResponse(freshCreated || createdEmployee);
  }

  /**
   * Retrieve all employees with pagination, search, and filters
   * @param {Object} queryParams
   * @returns {Promise<Object>}
   */
  async getAllEmployees(queryParams) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 10));
    const search = queryParams.search ? String(queryParams.search).trim() : null;
    const pod_id = queryParams.pod_id || queryParams.podId || null;
    const employment_status = queryParams.employment_status || queryParams.status || null;

    if (pod_id && !this.validateUUID(pod_id)) {
      throw new AppError('Invalid pod ID filter format', 400);
    }

    if (
      employment_status &&
      !['ACTIVE', 'INACTIVE'].includes(employment_status.toUpperCase())
    ) {
      throw new AppError("Invalid status filter. Must be 'ACTIVE' or 'INACTIVE'", 400);
    }

    const { data, count, error } = await employeeRepository.findAll({
      page,
      limit,
      search,
      pod_id,
      employment_status: employment_status ? employment_status.toUpperCase() : null,
    });

    if (error) {
      throw new AppError(`Failed to fetch employees: ${error.message}`, 500);
    }

    const totalPages = Math.ceil(count / limit) || (count > 0 ? 1 : 0);

    return {
      employees: (data || []).map((e) => this.formatEmployeeResponse(e)),
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get employee by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getEmployeeById(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid employee ID format', 400);
    }

    const { data: employee, error } = await employeeRepository.findById(id);

    if (error) {
      throw new AppError(`Failed to retrieve employee: ${error.message}`, 500);
    }

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    return this.formatEmployeeResponse(employee);
  }

  /**
   * Update employee details
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateEmployee(id, updateData) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid employee ID format', 400);
    }

    // Verify employee exists
    const { data: existingEmployee, error: fetchError } = await employeeRepository.findById(id);
    if (fetchError) {
      throw new AppError(`Failed to check employee: ${fetchError.message}`, 500);
    }
    if (!existingEmployee) {
      throw new AppError('Employee not found', 404);
    }

    const payload = {};

    // Do NOT allow changing id or employee_code
    // Allowed fields: full_name, email, phone, pod_id, designation, joining_date, employment_status

    if (updateData.full_name !== undefined) {
      if (typeof updateData.full_name !== 'string' || updateData.full_name.trim() === '') {
        throw new AppError('Full name cannot be empty', 400);
      }
      payload.full_name = updateData.full_name.trim();
    }

    if (updateData.email !== undefined) {
      if (updateData.email === null || updateData.email.trim() === '') {
        payload.email = null;
      } else {
        const cleanEmail = updateData.email.trim().toLowerCase();
        if (!this.validateEmail(cleanEmail)) {
          throw new AppError('Invalid email format', 400);
        }
        // Check duplicate email if it differs from current employee email
        if (cleanEmail !== existingEmployee.email?.toLowerCase()) {
          const duplicate = await employeeRepository.findByEmail(cleanEmail);
          if (duplicate.data && duplicate.data.id !== id) {
            throw new AppError(`Email '${cleanEmail}' is already in use by another employee`, 409, {
              code: 'DUPLICATE_EMAIL',
              details: { email: cleanEmail },
              suggestion: 'Please choose a different email address not assigned to another team member.',
            });
          }
        }
        payload.email = cleanEmail;
      }
    }

    if (updateData.phone !== undefined) {
      if (updateData.phone === null || updateData.phone.trim() === '') {
        payload.phone = null;
      } else {
        const cleanPhone = updateData.phone.trim();
        if (!this.validatePhone(cleanPhone)) {
          throw new AppError('Invalid phone number format', 400);
        }
        payload.phone = cleanPhone;
      }
    }

    if (updateData.pod_id !== undefined) {
      if (updateData.pod_id === null || updateData.pod_id === '') {
        payload.pod_id = null;
      } else {
        if (!this.validateUUID(updateData.pod_id)) {
          throw new AppError('Invalid pod ID format', 400);
        }
        const podExists = await employeeRepository.checkPodExists(updateData.pod_id);
        if (!podExists) {
          throw new AppError('Referenced pod does not exist', 400);
        }
        payload.pod_id = updateData.pod_id;
      }
      // If moving away from a pod this employee leads, clear lead reference on that pod
      await employeeRepository.clearLeadingPodsIfNotMatching(id, payload.pod_id);
    }

    if (updateData.designation !== undefined) {
      payload.designation = updateData.designation ? updateData.designation.trim() : null;
    }

    if (updateData.joining_date !== undefined) {
      payload.joining_date = updateData.joining_date || null;
    }

    if (updateData.employment_status !== undefined) {
      const statusUpper = String(updateData.employment_status).toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(statusUpper)) {
        throw new AppError("Employment status must be either 'ACTIVE' or 'INACTIVE'", 400);
      }
      payload.employment_status = statusUpper;
    }

    const hasWeeklyOffUpdate =
      updateData.weekly_off !== undefined ||
      updateData.weeklyOff !== undefined ||
      updateData.weekly_off_day !== undefined;

    if (Object.keys(payload).length === 0 && !hasWeeklyOffUpdate) {
      throw new AppError('No valid fields provided for update', 400);
    }

    let updatedEmployee = null;
    if (Object.keys(payload).length > 0) {
      payload.updated_at = new Date().toISOString();
      const { data, error: updateError } = await employeeRepository.update(id, payload);

      if (updateError) {
        if (updateError.code === '23505') {
          throw new AppError('Duplicate unique value constraint violated', 409);
        }
        throw new AppError(`Failed to update employee: ${updateError.message}`, 500);
      }
      updatedEmployee = data;
    }

    if (hasWeeklyOffUpdate) {
      const rawWOff = updateData.weekly_off ?? updateData.weeklyOff ?? updateData.weekly_off_day;
      const normalizedWOff = this.normalizeWeekday(rawWOff);
      await employeeRepository.upsertWeeklyOff(id, normalizedWOff);
    }

    const { data: freshUpdated } = await employeeRepository.findById(id);
    return this.formatEmployeeResponse(freshUpdated || updatedEmployee || existingEmployee);
  }

  /**
   * Deactivate an employee (soft delete)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deactivateEmployee(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid employee ID format', 400);
    }

    // Verify employee exists
    const { data: existingEmployee, error: fetchError } = await employeeRepository.findById(id);
    if (fetchError) {
      throw new AppError(`Failed to fetch employee: ${fetchError.message}`, 500);
    }
    if (!existingEmployee) {
      throw new AppError('Employee not found', 404);
    }

    // Prevent repeated deactivation
    if (existingEmployee.employment_status === 'INACTIVE') {
      throw new AppError('Employee is already inactive', 409, {
        code: 'ALREADY_INACTIVE',
        details: { employee_id: id, current_status: 'INACTIVE' },
        suggestion: 'This employee has already been deactivated. No further action is required.',
      });
    }

    const payload = {
      employment_status: 'INACTIVE',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedEmployee, error: updateError } = await employeeRepository.update(
      id,
      payload
    );

    if (updateError) {
      throw new AppError(`Failed to deactivate employee: ${updateError.message}`, 500);
    }

    return updatedEmployee;
  }

  /**
   * Check deletion eligibility and return historical reference counts
   * Used by frontend before showing confirmation dialogs
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async checkDeletionEligibility(id) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid employee ID format', 400);
    }

    const { data: employee, error: fetchError } = await employeeRepository.findById(id);
    if (fetchError) {
      throw new AppError(`Failed to fetch employee: ${fetchError.message}`, 500);
    }
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    const { assignmentCount, rosterCount, leaveCount } =
      await employeeRepository.countHistoricalRecords(id);

    const isProtected = rosterCount > 0 || assignmentCount > 0 || leaveCount > 0;

    return {
      employeeId: id,
      employeeCode: employee.employee_code,
      fullName: employee.full_name,
      employmentStatus: employee.employment_status,
      podId: employee.pod_id,
      canDelete: !isProtected,
      isProtected,
      rosterCount,
      assignmentCount,
      leaveCount,
      reasons: [
        ...(rosterCount > 0 ? [`${rosterCount} historical roster shift(s)`] : []),
        ...(assignmentCount > 0 ? [`${assignmentCount} workflow assignment(s)`] : []),
        ...(leaveCount > 0 ? [`${leaveCount} leave record(s)`] : []),
      ],
      warningMessage: isProtected
        ? 'Permanent deletion is unavailable because this employee has historical records. You can deactivate and unassign this employee while preserving their historical roster data.'
        : null,
    };
  }

  /**
   * Delete an employee
   * If permanent is false, deactivates the employee (soft delete).
   * If permanent is true, checks historical roster/assignment records before allowing permanent deletion.
   * @param {string} id
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async deleteEmployee(id, { permanent = false } = {}) {
    if (!this.validateUUID(id)) {
      throw new AppError('Invalid employee ID format', 400);
    }

    // Verify employee exists
    const { data: employee, error: fetchError } = await employeeRepository.findById(id);
    if (fetchError) {
      throw new AppError(`Failed to fetch employee: ${fetchError.message}`, 500);
    }
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    if (!permanent) {
      return this.deactivateEmployee(id);
    }

    // Permanent deletion requested: Check historical schedule and workflow records
    const { assignmentCount, rosterCount, leaveCount } =
      await employeeRepository.countHistoricalRecords(id);

    if (rosterCount > 0 || assignmentCount > 0 || leaveCount > 0) {
      const reasons = [];
      if (rosterCount > 0) reasons.push(`${rosterCount} historical roster shift(s)`);
      if (assignmentCount > 0) reasons.push(`${assignmentCount} workflow assignment(s)`);
      if (leaveCount > 0) reasons.push(`${leaveCount} leave record(s)`);

      throw new AppError(
        `Cannot permanently delete employee '${employee.full_name}' (${employee.employee_code}). ` +
          `This employee is referenced by ${reasons.join(' and ')}. ` +
          `To preserve historical roster records and audit integrity, please deactivate the employee and set their Pod to 'Unassigned' instead.`,
        409,
        {
          code: 'EMPLOYEE_HAS_HISTORICAL_RECORDS',
          details: {
            employeeId: id,
            employeeCode: employee.employee_code,
            rosterCount,
            assignmentCount,
            leaveCount,
          },
          suggestion:
            'Deactivate the employee and select Unassigned (No Pod) to retire them without damaging historical schedule logs.',
        }
      );
    }

    // Safe to delete permanently
    const { data: deleted, error: delError } = await employeeRepository.deletePermanently(id);
    if (delError) {
      throw new AppError(`Failed to delete employee: ${delError.message}`, 500);
    }

    return {
      message: `Employee '${employee.full_name}' permanently deleted successfully`,
      deletedEmployee: employee,
    };
  }
}

export const employeeService = new EmployeeService();
export default employeeService;
