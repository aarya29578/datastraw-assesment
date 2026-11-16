import { availabilityRepository } from './availability.repository.js';
import { AppError } from '../../utils/appError.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

class AvailabilityService {
  validateUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id.trim());
  }

  validateDate(dateStr) {
    return typeof dateStr === 'string' && DATE_REGEX.test(dateStr.trim());
  }

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
    throw new AppError(`Invalid weekday: ${val}. Must be 0 (Sun) to 6 (Sat) or Day name.`, 400);
  }

  // ==========================================
  // 1. Weekly Offs
  // ==========================================
  async createWeeklyOff(data) {
    const { employee_id, weekday, effective_from, effective_to, is_active = true } = data;

    if (!employee_id || !this.validateUUID(employee_id)) {
      throw new AppError('Valid employee ID is required', 400);
    }
    const { data: employee } = await availabilityRepository.checkEmployeeExists(employee_id);
    if (!employee) throw new AppError('Referenced employee does not exist', 400);

    const normalizedDay = this.normalizeWeekday(weekday);
    const fromDate = effective_from ? effective_from.trim() : new Date().toISOString().split('T')[0];
    if (!this.validateDate(fromDate)) throw new AppError('Effective from date must be YYYY-MM-DD', 400);

    let toDate = null;
    if (effective_to) {
      toDate = effective_to.trim();
      if (!this.validateDate(toDate)) throw new AppError('Effective to date must be YYYY-MM-DD', 400);
      if (toDate < fromDate) throw new AppError('Effective to cannot be earlier than effective from', 400);
    }

    const payload = {
      employee_id,
      weekday: normalizedDay,
      effective_from: fromDate,
      effective_to: toDate,
      is_active: Boolean(is_active),
    };

    const { data: created, error } = await availabilityRepository.createWeeklyOff(payload);
    if (error) throw new AppError(`Failed to create weekly off: ${error.message}`, 500);

    return {
      ...created,
      weekday_name: WEEKDAY_NAMES[created.weekday],
    };
  }

  async getAllWeeklyOffs(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const { employee_id, pod_id, is_active, target_date } = query;

    if (employee_id && !this.validateUUID(employee_id)) throw new AppError('Invalid employee ID', 400);
    if (pod_id && !this.validateUUID(pod_id)) throw new AppError('Invalid pod ID', 400);

    let activeFilter = null;
    if (is_active !== undefined) activeFilter = is_active === 'true' || is_active === true;

    const { data, count, error } = await availabilityRepository.findWeeklyOffs({
      page,
      limit,
      employee_id,
      pod_id,
      is_active: activeFilter,
      target_date,
    });
    if (error) throw new AppError(`Failed to retrieve weekly offs: ${error.message}`, 500);

    const formatted = (data || []).map((w) => ({
      ...w,
      weekday_name: WEEKDAY_NAMES[w.weekday],
    }));

    return {
      weekly_offs: formatted,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  async getWeeklyOffById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid weekly off ID', 400);
    const { data, error } = await availabilityRepository.findWeeklyOffById(id);
    if (error) throw new AppError(`Failed to retrieve weekly off: ${error.message}`, 500);
    if (!data) throw new AppError('Weekly off record not found', 404);
    return { ...data, weekday_name: WEEKDAY_NAMES[data.weekday] };
  }

  async updateWeeklyOff(id, updateData) {
    if (!this.validateUUID(id)) throw new AppError('Invalid weekly off ID', 400);
    await this.getWeeklyOffById(id);

    const payload = {};
    if (updateData.weekday !== undefined) payload.weekday = this.normalizeWeekday(updateData.weekday);
    if (updateData.is_active !== undefined) payload.is_active = Boolean(updateData.is_active);
    if (updateData.effective_from !== undefined) {
      if (!this.validateDate(updateData.effective_from)) throw new AppError('Invalid effective_from date', 400);
      payload.effective_from = updateData.effective_from;
    }
    if (updateData.effective_to !== undefined) {
      if (updateData.effective_to === null || updateData.effective_to === '') {
        payload.effective_to = null;
      } else {
        if (!this.validateDate(updateData.effective_to)) throw new AppError('Invalid effective_to date', 400);
        payload.effective_to = updateData.effective_to;
      }
    }

    const { data, error } = await availabilityRepository.updateWeeklyOff(id, payload);
    if (error) throw new AppError(`Failed to update weekly off: ${error.message}`, 500);
    return { ...data, weekday_name: WEEKDAY_NAMES[data.weekday] };
  }

  async deleteWeeklyOff(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid weekly off ID', 400);
    await this.getWeeklyOffById(id);
    const { data, error } = await availabilityRepository.deleteWeeklyOff(id);
    if (error) throw new AppError(`Failed to delete weekly off: ${error.message}`, 500);
    return data || { id, message: 'Weekly off deleted successfully' };
  }

  // ==========================================
  // 2. Leaves
  // ==========================================
  normalizeLeaveType(type) {
    if (!type) return 'ANNUAL';
    const clean = type.trim().toUpperCase();
    if (clean === 'SL' || clean === 'SICK') return 'SICK';
    if (clean === 'PL' || clean === 'CL' || clean === 'ANNUAL' || clean === 'CASUAL') return 'ANNUAL';
    if (clean === 'UNPAID') return 'UNPAID';
    return 'ANNUAL'; // fallback to valid check constraint
  }

  async createLeave(data) {
    const { employee_id, leave_type = 'ANNUAL', start_date, end_date, reason } = data;

    if (!employee_id || !this.validateUUID(employee_id)) throw new AppError('Valid employee ID is required', 400);
    const { data: employee } = await availabilityRepository.checkEmployeeExists(employee_id);
    if (!employee) throw new AppError('Referenced employee does not exist', 400);

    if (!start_date || !this.validateDate(start_date)) throw new AppError('Valid start date (YYYY-MM-DD) is required', 400);
    const endDateVal = end_date ? end_date : start_date;
    if (!this.validateDate(endDateVal)) throw new AppError('Valid end date (YYYY-MM-DD) is required', 400);
    if (endDateVal < start_date) throw new AppError('End date cannot be earlier than start date', 400);

    const payload = {
      employee_id,
      leave_type: this.normalizeLeaveType(leave_type),
      start_date,
      end_date: endDateVal,
      reason: reason ? reason.trim() : null,
      status: 'PENDING',
    };

    const { data: created, error } = await availabilityRepository.createLeave(payload);
    if (error) throw new AppError(`Failed to submit leave request: ${error.message}`, 500);
    return created;
  }

  async getAllLeaves(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const { employee_id, pod_id, status, start_date, end_date } = query;

    if (employee_id && !this.validateUUID(employee_id)) throw new AppError('Invalid employee ID', 400);
    if (pod_id && !this.validateUUID(pod_id)) throw new AppError('Invalid pod ID', 400);

    const { data, count, error } = await availabilityRepository.findLeaves({
      page,
      limit,
      employee_id,
      pod_id,
      status: status ? status.trim().toUpperCase() : null,
      start_date,
      end_date,
    });
    if (error) throw new AppError(`Failed to retrieve leaves: ${error.message}`, 500);

    return {
      leaves: data || [],
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  async getLeaveById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid leave ID', 400);
    const { data, error } = await availabilityRepository.findLeaveById(id);
    if (error) throw new AppError(`Failed to retrieve leave: ${error.message}`, 500);
    if (!data) throw new AppError('Leave record not found', 404);
    return data;
  }

  async updateLeave(id, updateData) {
    if (!this.validateUUID(id)) throw new AppError('Invalid leave ID', 400);
    const existing = await this.getLeaveById(id);
    if (existing.status !== 'PENDING') {
      throw new AppError(`Cannot edit a leave that is already ${existing.status}`, 400);
    }

    const payload = {};
    if (updateData.leave_type) payload.leave_type = this.normalizeLeaveType(updateData.leave_type);
    if (updateData.reason !== undefined) payload.reason = updateData.reason ? updateData.reason.trim() : null;
    if (updateData.start_date || updateData.end_date) {
      const sDate = updateData.start_date || existing.start_date;
      const eDate = updateData.end_date || existing.end_date;
      if (!this.validateDate(sDate) || !this.validateDate(eDate)) throw new AppError('Invalid date format', 400);
      if (eDate < sDate) throw new AppError('End date cannot be earlier than start date', 400);
      payload.start_date = sDate;
      payload.end_date = eDate;
    }

    const { data, error } = await availabilityRepository.updateLeave(id, payload);
    if (error) throw new AppError(`Failed to update leave: ${error.message}`, 500);
    return data;
  }

  async setLeaveStatus(id, newStatus, approverId = null) {
    if (!this.validateUUID(id)) throw new AppError('Invalid leave ID', 400);
    const existing = await this.getLeaveById(id);

    if (existing.status === newStatus) {
      throw new AppError(`Leave request is already marked as ${newStatus}`, 409, {
        code: 'LEAVE_ALREADY_IN_STATE',
        details: { leaveId: id, currentStatus: existing.status },
        suggestion: `This leave request is already ${newStatus.toLowerCase()}. No status change needed.`,
      });
    }

    if (approverId && !this.validateUUID(approverId)) throw new AppError('Invalid approver ID', 400);

    const payload = {
      status: newStatus,
      approved_by: approverId,
      approved_at: newStatus === 'APPROVED' || newStatus === 'REJECTED' ? new Date().toISOString() : null,
    };

    const { data, error } = await availabilityRepository.updateLeave(id, payload);
    if (error) throw new AppError(`Failed to set leave status: ${error.message}`, 500);
    return data;
  }

  // ==========================================
  // 3. Comp-Offs
  // ==========================================
  async createCompOff(data) {
    const { employee_id, earned_on, off_date, expires_on, reason } = data;

    if (!employee_id || !this.validateUUID(employee_id)) throw new AppError('Valid employee ID is required', 400);
    const { data: employee } = await availabilityRepository.checkEmployeeExists(employee_id);
    if (!employee) throw new AppError('Referenced employee does not exist', 400);

    if (!earned_on || !this.validateDate(earned_on)) throw new AppError('Valid earned date is required', 400);
    if (!off_date || !this.validateDate(off_date)) throw new AppError('Valid off date is required', 400);
    if (off_date < earned_on) throw new AppError('Off date cannot be prior to earned date', 400);

    // Calculate expiry (default 90 days after earned_on)
    let expiryDate = expires_on;
    if (!expiryDate) {
      const earnedDateObj = new Date(earned_on);
      earnedDateObj.setDate(earnedDateObj.getDate() + 90);
      expiryDate = earnedDateObj.toISOString().split('T')[0];
    } else {
      if (!this.validateDate(expiryDate)) throw new AppError('Invalid expires_on date', 400);
    }

    if (off_date > expiryDate) {
      throw new AppError(`Off date (${off_date}) exceeds comp-off expiry date (${expiryDate})`, 400);
    }

    const payload = {
      employee_id,
      earned_on,
      off_date,
      expires_on: expiryDate,
      reason: reason ? reason.trim() : null,
      status: 'PENDING',
    };

    const { data: created, error } = await availabilityRepository.createCompOff(payload);
    if (error) throw new AppError(`Failed to create comp-off: ${error.message}`, 500);
    return created;
  }

  async getAllCompOffs(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
    const { employee_id, pod_id, status, target_date } = query;

    if (employee_id && !this.validateUUID(employee_id)) throw new AppError('Invalid employee ID', 400);
    if (pod_id && !this.validateUUID(pod_id)) throw new AppError('Invalid pod ID', 400);

    const { data, count, error } = await availabilityRepository.findCompOffs({
      page,
      limit,
      employee_id,
      pod_id,
      status: status ? status.trim().toUpperCase() : null,
      target_date,
    });
    if (error) throw new AppError(`Failed to retrieve comp-offs: ${error.message}`, 500);

    return {
      comp_offs: data || [],
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  async getCompOffById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid comp-off ID', 400);
    const { data, error } = await availabilityRepository.findCompOffById(id);
    if (error) throw new AppError(`Failed to retrieve comp-off: ${error.message}`, 500);
    if (!data) throw new AppError('Comp-off record not found', 404);
    return data;
  }

  async updateCompOff(id, updateData) {
    if (!this.validateUUID(id)) throw new AppError('Invalid comp-off ID', 400);
    const existing = await this.getCompOffById(id);
    if (existing.status !== 'PENDING') throw new AppError(`Cannot edit a comp-off that is ${existing.status}`, 400);

    const payload = {};
    if (updateData.reason !== undefined) payload.reason = updateData.reason;
    if (updateData.off_date) {
      if (!this.validateDate(updateData.off_date)) throw new AppError('Invalid off date', 400);
      if (updateData.off_date < existing.earned_on) throw new AppError('Off date cannot precede earned date', 400);
      if (existing.expires_on && updateData.off_date > existing.expires_on) {
        throw new AppError('Off date cannot be after expiry date', 400);
      }
      payload.off_date = updateData.off_date;
    }

    const { data, error } = await availabilityRepository.updateCompOff(id, payload);
    if (error) throw new AppError(`Failed to update comp-off: ${error.message}`, 500);
    return data;
  }

  async setCompOffStatus(id, newStatus, approverId = null) {
    if (!this.validateUUID(id)) throw new AppError('Invalid comp-off ID', 400);
    const existing = await this.getCompOffById(id);

    if (newStatus === 'APPROVED' && existing.expires_on) {
      const today = new Date().toISOString().split('T')[0];
      if (existing.expires_on < today) {
        throw new AppError('Cannot approve an expired comp-off request', 400);
      }
    }

    const payload = {
      status: newStatus,
      approved_by: approverId,
      approved_at: newStatus === 'APPROVED' || newStatus === 'REJECTED' ? new Date().toISOString() : null,
    };

    const { data, error } = await availabilityRepository.updateCompOff(id, payload);
    if (error) throw new AppError(`Failed to set comp-off status: ${error.message}`, 500);
    return data;
  }

  // ==========================================
  // 4. Public Holidays
  // ==========================================
  async createHoliday(data) {
    const { holiday_date, holiday_name, description, is_active = true } = data;

    if (!holiday_date || !this.validateDate(holiday_date)) {
      throw new AppError('Valid holiday date (YYYY-MM-DD) is required', 400);
    }
    if (!holiday_name || typeof holiday_name !== 'string' || holiday_name.trim() === '') {
      throw new AppError('Holiday name is required', 400);
    }

    const existing = await availabilityRepository.findHolidayByDate(holiday_date);
    if (existing.data) {
      throw new AppError(`A public holiday is already registered on ${holiday_date} (${existing.data.holiday_name})`, 409);
    }

    const payload = {
      holiday_date,
      holiday_name: holiday_name.trim(),
      description: description ? description.trim() : null,
      is_active: Boolean(is_active),
    };

    const { data: created, error } = await availabilityRepository.createHoliday(payload);
    if (error) throw new AppError(`Failed to create public holiday: ${error.message}`, 500);
    return created;
  }

  async getAllHolidays(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 100));
    const { year, is_active } = query;

    let activeFilter = null;
    if (is_active !== undefined) activeFilter = is_active === 'true' || is_active === true;

    const { data, count, error } = await availabilityRepository.findHolidays({
      page,
      limit,
      year: year ? parseInt(year, 10) : null,
      is_active: activeFilter,
    });
    if (error) throw new AppError(`Failed to retrieve public holidays: ${error.message}`, 500);

    return {
      holidays: data || [],
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) || 0 },
    };
  }

  async getHolidayById(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid holiday ID', 400);
    const { data, error } = await availabilityRepository.findHolidayById(id);
    if (error) throw new AppError(`Failed to retrieve holiday: ${error.message}`, 500);
    if (!data) throw new AppError('Holiday not found', 404);
    return data;
  }

  async updateHoliday(id, updateData) {
    if (!this.validateUUID(id)) throw new AppError('Invalid holiday ID', 400);
    const existing = await this.getHolidayById(id);

    const payload = {};
    if (updateData.holiday_name !== undefined) {
      if (!updateData.holiday_name.trim()) throw new AppError('Holiday name cannot be empty', 400);
      payload.holiday_name = updateData.holiday_name.trim();
    }
    if (updateData.description !== undefined) payload.description = updateData.description;
    if (updateData.is_active !== undefined) payload.is_active = Boolean(updateData.is_active);

    if (updateData.holiday_date && updateData.holiday_date !== existing.holiday_date) {
      if (!this.validateDate(updateData.holiday_date)) throw new AppError('Invalid date format', 400);
      const duplicate = await availabilityRepository.findHolidayByDate(updateData.holiday_date);
      if (duplicate.data && duplicate.data.id !== id) {
        throw new AppError(`A holiday already exists on ${updateData.holiday_date}`, 409);
      }
      payload.holiday_date = updateData.holiday_date;
    }

    const { data, error } = await availabilityRepository.updateHoliday(id, payload);
    if (error) throw new AppError(`Failed to update holiday: ${error.message}`, 500);
    return data;
  }

  async deleteHoliday(id) {
    if (!this.validateUUID(id)) throw new AppError('Invalid holiday ID', 400);
    await this.getHolidayById(id);
    const { data, error } = await availabilityRepository.deleteHoliday(id);
    if (error) throw new AppError(`Failed to delete holiday: ${error.message}`, 500);
    return data || { id, message: 'Holiday deleted successfully' };
  }
}

export const availabilityService = new AvailabilityService();
export default availabilityService;
