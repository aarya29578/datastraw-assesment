import { apiClient } from '../../../services/api/apiClient';
import { podAdapter } from '../../../services/api/adapters';

export const podService = {
  /**
   * Fetch all pods from backend API
   */
  async getPods(params = {}) {
    const query = {
      limit: params.limit || 100,
      page: params.page || 1,
      search: params.search,
    };
    const response = await apiClient.get('/pods', query);
    const list = Array.isArray(response) ? response : response.pods || [];
    return list.map(podAdapter.toFrontend);
  },

  /**
   * Fetch a single pod by ID
   */
  async getPodById(id) {
    const response = await apiClient.get(`/pods/${id}`);
    return podAdapter.toFrontend(response);
  },

  /**
   * Create a new pod
   */
  async createPod(data) {
    const payload = podAdapter.toBackend(data);
    const created = await apiClient.post('/pods', payload);
    return podAdapter.toFrontend(created);
  },

  /**
   * Update pod details
   */
  async updatePod(id, updatedFields) {
    const payload = podAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/pods/${id}`, payload);
    return podAdapter.toFrontend(updated);
  },

  /**
   * Delete a pod
   */
  async deletePod(id) {
    return apiClient.delete(`/pods/${id}`);
  },
};

export default podService;
