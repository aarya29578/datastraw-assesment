import { apiClient } from '../../../services/api/apiClient';
import { employeeAdapter } from '../../../services/api/adapters';

export const employeeService = {
  /**
   * Fetch all employees from backend API with optional search and filters
   */
  async getEmployees(params = {}) {
    const query = {
      limit: params.limit || 100,
      page: params.page || 1,
      search: params.search,
      pod_id: params.podId,
      status: params.status && params.status !== 'ALL' ? params.status : undefined,
    };
    const response = await apiClient.get('/employees', query);
    const list = Array.isArray(response) ? response : response.employees || [];
    return list.map(employeeAdapter.toFrontend);
  },

  /**
   * Fetch a single employee by ID
   */
  async getEmployeeById(id) {
    const response = await apiClient.get(`/employees/${id}`);
    return employeeAdapter.toFrontend(response);
  },

  /**
   * Create a new employee
   */
  async createEmployee(data) {
    const payload = employeeAdapter.toBackend(data);
    const created = await apiClient.post('/employees', payload);
    return employeeAdapter.toFrontend(created);
  },

  /**
   * Update employee details
   */
  async updateEmployee(id, updatedFields) {
    const payload = employeeAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/employees/${id}`, payload);
    return employeeAdapter.toFrontend(updated);
  },

  /**
   * Toggle employee active/inactive status (or soft-deactivate)
   */
  async toggleEmployeeStatus(id) {
    const employee = await this.getEmployeeById(id);
    if (!employee) throw new Error('Employee not found');
    if (employee.status === 'ACTIVE') {
      const deactivated = await apiClient.delete(`/employees/${id}`);
      return employeeAdapter.toFrontend(deactivated);
    } else {
      const activated = await apiClient.put(`/employees/${id}`, { employment_status: 'ACTIVE' });
      return employeeAdapter.toFrontend(activated);
    }
  },

  /**
   * Check deletion eligibility and return historical reference counts
   */
  async checkDeletionEligibility(id) {
    const response = await apiClient.get(`/employees/${id}/deletion-check`);
    return response;
  },

  /**
   * Delete an employee (permanently if permitted, otherwise returns conflict explaining historical records)
   */
  async deleteEmployee(id, permanent = true) {
    return apiClient.delete(`/employees/${id}`, { permanent: permanent ? 'true' : 'false' });
  },
};

export default employeeService;
