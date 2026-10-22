const API_URL = '/api';

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const api = {
  token: () => localStorage.getItem('fp_token'),
  user: () => JSON.parse(localStorage.getItem('fp_user') || 'null'),

  saveAuth(token, user) {
    localStorage.setItem('fp_token', token);
    localStorage.setItem('fp_user', JSON.stringify(user));
  },

  clearAuth() {
    localStorage.removeItem('fp_token');
    localStorage.removeItem('fp_user');
  },

  requireAuth() {
    if (!this.token()) window.location.href = '/login.html';
  },

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.token();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, { ...options, headers, signal: controller.signal });
    } catch (error) {
      throw new Error(error.name === 'AbortError'
        ? 'The local server took too long to respond.'
        : 'Unable to connect to the local server.');
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      this.clearAuth();
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }
    if (!response.ok) throw new Error(data.msg || 'Request failed');
    return data;
  },

  get: endpoint => api.request(endpoint),
  post: (endpoint, body) => api.request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => api.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => api.request(endpoint, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: endpoint => api.request(endpoint, { method: 'DELETE' })
};

document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      api.clearAuth();
      window.location.href = '/login.html';
    });
  }
});
