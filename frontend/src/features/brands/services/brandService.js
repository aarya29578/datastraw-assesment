import { apiClient } from '../../../services/api/apiClient';
import { brandAdapter } from '../../../services/api/adapters';

export const brandService = {
  /**
   * Fetch all brands from backend API
   */
  async getBrands(params = {}) {
    const query = {
      limit: params.limit || 100,
      page: params.page || 1,
      search: params.search,
      status: params.status && params.status !== 'ALL' ? params.status : undefined,
    };
    const response = await apiClient.get('/brands', query);
    const list = Array.isArray(response) ? response : response.brands || [];
    return list.map(brandAdapter.toFrontend);
  },

  /**
   * Fetch a single brand by ID
   */
  async getBrandById(id) {
    const response = await apiClient.get(`/brands/${id}`);
    return brandAdapter.toFrontend(response);
  },

  /**
   * Create a new brand
   */
  async createBrand(data) {
    const payload = brandAdapter.toBackend(data);
    const created = await apiClient.post('/brands', payload);
    return brandAdapter.toFrontend(created);
  },

  /**
   * Update brand details
   */
  async updateBrand(id, updatedFields) {
    const payload = brandAdapter.toBackend(updatedFields);
    const updated = await apiClient.put(`/brands/${id}`, payload);
    return brandAdapter.toFrontend(updated);
  },

  /**
   * Delete / Deactivate a brand
   */
  async deleteBrand(id, { permanent = false } = {}) {
    const url = permanent ? `/brands/${id}?permanent=true` : `/brands/${id}`;
    const res = await apiClient.delete(url);
    return res;
  },

  /**
   * Permanently delete a brand
   */
  async deleteBrandPermanently(id) {
    return this.deleteBrand(id, { permanent: true });
  },
};

export default brandService;
