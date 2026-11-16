import { apiClient } from '../../../services/api/apiClient';
import { assignmentAdapter } from '../../../services/api/adapters';

export const assignmentService = {
  /**
   * Fetch all assignments from backend API
   */
  async getAssignments(params = {}) {
    const query = {
      limit: params.limit || 200,
      page: params.page || 1,
      employee_id: params.employeeId,
      brand_id: params.brandId,
      process_id: params.processId,
      pod_id: params.podId,
      search: params.search,
    };
    const response = await apiClient.get('/assignments', query);
    const list = Array.isArray(response) ? response : response.assignments || [];
    return list.map(assignmentAdapter.toFrontend);
  },

  /**
   * Fetch a single assignment by ID
   */
  async getAssignmentById(id) {
    const response = await apiClient.get(`/assignments/${id}`);
    return assignmentAdapter.toFrontend(response);
  },

  /**
   * Create assignment(s) - supports multi-process fan-out
   */
  async createAssignment(data) {
    const payload = assignmentAdapter.toBackend(data);
    const result = await apiClient.post('/assignments', payload);
    if (Array.isArray(result)) {
      return result.map(assignmentAdapter.toFrontend);
    }
    return assignmentAdapter.toFrontend(result);
  },

  /**
   * Update an assignment
   */
  async updateAssignment(id, updatedFields) {
    const payload = assignmentAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/assignments/${id}`, payload);
    return assignmentAdapter.toFrontend(updated);
  },

  /**
   * Delete an assignment
   */
  async deleteAssignment(id) {
    return apiClient.delete(`/assignments/${id}`);
  },
};

export default assignmentService;
