const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

function showTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  }
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));

if (window.location.hash === '#register') showTab('register');

// If already logged in, verify token & redirect
(async () => {
  if (api.token()) {
    try {
      await api.get('/auth/me');
      window.location.href = '/dashboard.html';
    } catch {
      api.clearAuth();
    }
  }
})();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const data = await api.post('/auth/login', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    });
    api.saveAuth(data.token, data.user);
    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  try {
    const data = await api.post('/auth/register', {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
      age: +document.getElementById('regAge').value || undefined,
      weight: +document.getElementById('regWeight').value || undefined,
      height: +document.getElementById('regHeight').value || undefined,
      fitnessGoal: document.getElementById('regGoal').value,
      activityLevel: document.getElementById('regActivity').value
    });
    api.saveAuth(data.token, data.user);
    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = err.message;
  }
});