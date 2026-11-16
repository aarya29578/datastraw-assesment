import { apiClient } from '../../../services/api/apiClient';
import { availabilityAdapter } from '../../../services/api/adapters';

export const availabilityService = {
  // ==========================================
  // Weekly Offs
  // ==========================================
  async getWeeklyOffs(params = {}) {
    const query = {
      employee_id: params.employeeId,
      pod_id: params.podId,
    };
    const response = await apiClient.get('/availability/weekly-offs', query);
    const list = Array.isArray(response) ? response : response.weekly_offs || [];
    return list.map(availabilityAdapter.weeklyOffToFrontend);
  },

  async createWeeklyOff(data) {
    const payload = {
      employee_id: data.employeeId,
      weekday: data.weekday ?? data.weeklyOff,
      effective_from: data.effectiveFrom,
      effective_to: data.effectiveTo,
    };
    const created = await apiClient.post('/availability/weekly-offs', payload);
    return availabilityAdapter.weeklyOffToFrontend(created);
  },

  async updateWeeklyOff(id, data) {
    const payload = {
      weekday: data.weekday ?? data.weeklyOff,
      is_active: data.isActive,
    };
    const updated = await apiClient.put(`/availability/weekly-offs/${id}`, payload);
    return availabilityAdapter.weeklyOffToFrontend(updated);
  },

  async deleteWeeklyOff(id) {
    return apiClient.delete(`/availability/weekly-offs/${id}`);
  },

  // ==========================================
  // Leaves
  // ==========================================
  async getLeaves(params = {}) {
    const query = {
      employee_id: params.employeeId,
      pod_id: params.podId,
      status: params.status,
    };
    const response = await apiClient.get('/availability/leaves', query);
    const list = Array.isArray(response) ? response : response.leaves || [];
    return list.map(availabilityAdapter.leaveToFrontend);
  },

  async createLeave(data) {
    const payload = {
      employee_id: data.employeeId,
      leave_type: data.leaveType || 'PL',
      start_date: data.startDate,
      end_date: data.endDate || data.startDate,
      reason: data.reason,
    };
    const created = await apiClient.post('/availability/leaves', payload);
    return availabilityAdapter.leaveToFrontend(created);
  },

  async approveLeave(id, approverId = null) {
    const updated = await apiClient.patch(`/availability/leaves/${id}/approve`, { approved_by: approverId });
    return availabilityAdapter.leaveToFrontend(updated);
  },

  async rejectLeave(id, approverId = null) {
    const updated = await apiClient.patch(`/availability/leaves/${id}/reject`, { approved_by: approverId });
    return availabilityAdapter.leaveToFrontend(updated);
  },

  async cancelLeave(id) {
    const updated = await apiClient.patch(`/availability/leaves/${id}/cancel`, {});
    return availabilityAdapter.leaveToFrontend(updated);
  },

  async updateLeaveStatus(id, status, approverId = null) {
    const upper = (status || '').toUpperCase();
    if (upper === 'APPROVED') {
      return this.approveLeave(id, approverId);
    }
    if (upper === 'REJECTED') {
      return this.rejectLeave(id, approverId);
    }
    if (upper === 'CANCELLED') {
      return this.cancelLeave(id);
    }
    return this.approveLeave(id, approverId);
  },

  // ==========================================
  // Comp-Offs
  // ==========================================
  async getCompOffs(params = {}) {
    const query = {
      employee_id: params.employeeId,
      status: params.status,
    };
    const response = await apiClient.get('/availability/comp-offs', query);
    const list = Array.isArray(response) ? response : response.comp_offs || [];
    return list.map(availabilityAdapter.compOffToFrontend);
  },

  async createCompOff(data) {
    const payload = {
      employee_id: data.employeeId,
      earned_on: data.earnedDate,
      off_date: data.offDate,
      expires_on: data.expiresOn,
      reason: data.reason,
    };
    const created = await apiClient.post('/availability/comp-offs', payload);
    return availabilityAdapter.compOffToFrontend(created);
  },

  async approveCompOff(id) {
    const updated = await apiClient.patch(`/availability/comp-offs/${id}/approve`, {});
    return availabilityAdapter.compOffToFrontend(updated);
  },

  async rejectCompOff(id) {
    const updated = await apiClient.patch(`/availability/comp-offs/${id}/reject`, {});
    return availabilityAdapter.compOffToFrontend(updated);
  },

  // ==========================================
  // Public Holidays
  // ==========================================
  async getHolidays(params = {}) {
    const query = {
      year: params.year || 2026,
    };
    const response = await apiClient.get('/availability/holidays', query);
    const list = Array.isArray(response) ? response : response.holidays || [];
    return list.map(availabilityAdapter.holidayToFrontend);
  },

  async createHoliday(data) {
    const payload = {
      holiday_date: data.date,
      holiday_name: data.name,
      description: data.description,
    };
    const created = await apiClient.post('/availability/holidays', payload);
    return availabilityAdapter.holidayToFrontend(created);
  },

  async deleteHoliday(id) {
    return apiClient.delete(`/availability/holidays/${id}`);
  },
};

export default availabilityService;
