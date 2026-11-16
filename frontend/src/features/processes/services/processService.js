import { apiClient } from '../../../services/api/apiClient';
import { processAdapter } from '../../../services/api/adapters';

export const processService = {
  /**
   * Fetch all processes from backend API
   */
  async getProcesses(params = {}) {
    const query = {
      limit: params.limit || 100,
      page: params.page || 1,
      search: params.search,
      status: params.status && params.status !== 'ALL' ? params.status : undefined,
    };
    const response = await apiClient.get('/processes', query);
    const list = Array.isArray(response) ? response : response.processes || [];
    return list.map(processAdapter.toFrontend);
  },

  /**
   * Fetch a single process by ID
   */
  async getProcessById(id) {
    const response = await apiClient.get(`/processes/${id}`);
    return processAdapter.toFrontend(response);
  },

  /**
   * Create a new process
   */
  async createProcess(data) {
    const payload = processAdapter.toBackend(data);
    if (!payload.code) {
      payload.code = (data.name || 'PROC')
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 4) + Date.now().toString().slice(-4);
    }
    const created = await apiClient.post('/processes', payload);
    return processAdapter.toFrontend(created);
  },

  /**
   * Update process details
   */
  async updateProcess(id, updatedFields) {
    const payload = processAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/processes/${id}`, payload);
    return processAdapter.toFrontend(updated);
  },

  /**
   * Delete / Deactivate a process
   */
  async deleteProcess(id) {
    const deactivated = await apiClient.delete(`/processes/${id}`);
    return processAdapter.toFrontend(deactivated);
  },

  /**
   * Permanently delete a process
   */
  async deleteProcessPermanently(id) {
    const deleted = await apiClient.delete(`/processes/${id}?permanent=true`);
    return deleted;
  },

  /**
   * Toggle process status (ACTIVE <-> INACTIVE)
   */
  async toggleProcessStatus(id) {
    const current = await this.getProcessById(id);
    if (current.status === 'ACTIVE') {
      return this.deleteProcess(id);
    } else {
      return this.updateProcess(id, { status: 'ACTIVE' });
    }
  },

  /**
   * Alias for toggleProcessStatus
   */
  async toggleProcess(id) {
    return this.toggleProcessStatus(id);
  },
};

export default processService;
