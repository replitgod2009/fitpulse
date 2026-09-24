const API_URL = '/api';

// Escape user-provided text before putting it in innerHTML
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    if (!this.token()) window.location.href = 'login.html';
  },

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      // expired / invalid token: clear it and send to login
      this.clearAuth();
      if (!window.location.pathname.endsWith('login.html')) window.location.href = 'login.html';
      throw new Error(data.msg || 'Session expired');
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

// Logout button handler
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', () => {
    api.clearAuth();
    window.location.href = 'login.html';
  });
});