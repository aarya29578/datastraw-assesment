/**
 * Centralized HTTP API Client for DataStraw
 * Communicates with the Express.js Backend via native fetch
 */

const BASE_URL = import.meta.env.VITE_API_URL;

class ApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
  }

  /**
   * Builds full URL with query parameters
   */
  buildUrl(endpoint, params = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, String(val));
      }
    });

    return url.toString();
  }

  /**
   * Retrieves auth token from localStorage if user is authenticated
   */
  getAuthHeader() {
    const token = localStorage.getItem('datastraw_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Core HTTP request handler
   */
  async request(endpoint, { method = 'GET', body = null, params = {}, headers = {} } = {}) {
    const url = this.buildUrl(endpoint, params);

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...headers,
      },
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);

      // Handle file downloads (CSV, Excel)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
        if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
        return await response.text();
      }

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = json.message || json.error?.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = json.code || null;
        error.details = json.details || null;
        error.suggestion = json.suggestion || null;
        error.errors = json.errors || null;
        throw error;
      }

      return json.data !== undefined ? json.data : json;
    } catch (err) {
      if (!err.status && err.message.includes('fetch')) {
        console.warn(`[API Client Network Error] Could not connect to backend at ${this.baseUrl}.`);
      }
      throw err;
    }
  }

  get(endpoint, params = {}) {
    return this.request(endpoint, { method: 'GET', params });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, { method: 'POST', body });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, { method: 'PATCH', body });
  }

  delete(endpoint, params = {}) {
    return this.request(endpoint, { method: 'DELETE', params });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
