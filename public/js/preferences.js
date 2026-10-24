/* Persistent interface preferences kept locally so they apply before API data. */
(function () {
  const STORAGE_KEY = 'fp_color_mode';
  const preferred = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

  function current() { return localStorage.getItem(STORAGE_KEY) || preferred; }
  function apply(mode = current()) {
    const next = mode === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.colorMode = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(STORAGE_KEY, next);
    document.querySelectorAll('[data-color-mode-toggle]').forEach((button) => {
      const isLight = next === 'light';
      button.textContent = isLight ? '☀️' : '🌙';
      button.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(isLight));
    });
    window.dispatchEvent(new CustomEvent('colorModeApplied', { detail: { mode: next } }));
  }

  function bindColorToggle(button) {
    if (button.dataset.colorToggleBound === 'true') return;
    button.dataset.colorToggleBound = 'true';
    button.addEventListener('click', () => apply(current() === 'light' ? 'dark' : 'light'));
  }

  function addControls() {
    const topbar = document.querySelector('.topbar');
    if (topbar && !document.getElementById('preferenceControls')) {
      const controls = document.createElement('div');
      controls.id = 'preferenceControls';
      controls.className = 'preference-controls';
      controls.innerHTML = '<button type="button" class="utility-button" data-color-mode-toggle aria-label="Toggle color mode">🌙</button><button type="button" class="utility-button language-button" data-language-toggle aria-label="Switch language">हिं</button>';
      topbar.appendChild(controls);
      window.I18n?.apply(controls);
    }
    document.querySelectorAll('[data-color-mode-toggle]').forEach(bindColorToggle);
    apply();
  }
  window.FitPulsePreferences = { apply, current };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addControls);
  else addControls();
})();
