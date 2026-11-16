import { apiClient } from '../../../services/api/apiClient';
import { conflictAdapter } from '../../../services/api/adapters';

export const conflictService = {
  /**
   * Fetch all conflicts from backend API
   */
  async getConflicts(params = {}) {
    const query = {
      severity: params.severity && params.severity !== 'ALL' ? params.severity : undefined,
      status: params.status && params.status !== 'ALL' ? params.status : undefined,
      conflict_type: params.conflictType,
      roster_id: params.rosterId,
    };
    const response = await apiClient.get('/conflicts', query);
    const list = Array.isArray(response) ? response : response.conflicts || [];
    return list.map(conflictAdapter.toFrontend);
  },

  /**
   * Get conflict by ID
   */
  async getConflictById(id) {
    const response = await apiClient.get(`/conflicts/${id}`);
    return conflictAdapter.toFrontend(response);
  },

  /**
   * Mark conflict as resolved
   */
  async resolveConflict(id, resolutionNote = '') {
    const response = await apiClient.patch(`/conflicts/${id}/resolve`, { resolution_note: resolutionNote });
    return conflictAdapter.toFrontend(response);
  },

  /**
   * Resolve conflict with replacement employee
   */
  async resolveWithReplacement(id, { replacementEmployeeId, note = '' }) {
    const response = await apiClient.post(`/conflicts/${id}/resolve-with-replacement`, {
      replacement_employee_id: replacementEmployeeId,
      resolution_note: note,
    });
    return conflictAdapter.toFrontend(response);
  },

  /**
   * Mark conflict as ignored
   */
  async ignoreConflict(id) {
    const response = await apiClient.patch(`/conflicts/${id}/ignore`, {});
    return conflictAdapter.toFrontend(response);
  },

  /**
   * Validate a roster
   */
  async validateRoster(rosterId) {
    const response = await apiClient.post(`/conflicts/validate/${rosterId}`, {});
    const list = response.conflicts || [];
    return list.map(conflictAdapter.toFrontend);
  },
};

export default conflictService;
