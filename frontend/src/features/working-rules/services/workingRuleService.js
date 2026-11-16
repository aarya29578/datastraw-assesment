import { apiClient } from '../../../services/api/apiClient';
import { workingRuleAdapter } from '../../../services/api/adapters';

export const workingRuleService = {
  /**
   * Fetch all working rules from backend API
   */
  async getWorkingRules(params = {}) {
    const query = {
      limit: params.limit || 100,
      page: params.page || 1,
      brand_id: params.brandId,
      process_id: params.processId,
      is_active: params.isActive,
    };
    const response = await apiClient.get('/working-rules', query);
    const list = Array.isArray(response) ? response : response.working_rules || [];
    return list.map(workingRuleAdapter.toFrontend);
  },

  /**
   * Fetch a single working rule by ID
   */
  async getWorkingRuleById(id) {
    const response = await apiClient.get(`/working-rules/${id}`);
    return workingRuleAdapter.toFrontend(response);
  },

  /**
   * Create a new working rule
   */
  async createWorkingRule(data) {
    const payload = workingRuleAdapter.toBackend(data);
    const created = await apiClient.post('/working-rules', payload);
    return workingRuleAdapter.toFrontend(created);
  },

  /**
   * Update working rule details
   */
  async updateWorkingRule(id, updatedFields) {
    const payload = workingRuleAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/working-rules/${id}`, payload);
    return workingRuleAdapter.toFrontend(updated);
  },

  /**
   * Delete a working rule
   */
  async deleteWorkingRule(id) {
    return apiClient.delete(`/working-rules/${id}`);
  },
};

export default workingRuleService;
