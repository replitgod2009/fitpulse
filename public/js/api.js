// API base — relative URL works on localhost AND Render
const API_URL = '/api';

// HTML escape helper — prevents XSS
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
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      this.clearAuth();
      window.location.href = '/login.html';
      throw new Error('Session expired');
    }
    if (!res.ok) throw new Error(data.msg || 'Request failed');
    return data;
  },

  get: (e) => api.request(e),
  post: (e, body) => api.request(e, { method: 'POST', body: JSON.stringify(body) }),
  put: (e, body) => api.request(e, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (e, body) => api.request(e, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (e) => api.request(e, { method: 'DELETE' }),
};

// Auto-bind logout button if present
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      api.clearAuth();
      window.location.href = '/login.html';
    });
  }
});