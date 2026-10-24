(function initThemePicker() {
  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  window.showThemePicker = function showThemePicker() {
    if (document.querySelector('.theme-picker-overlay')) return;

    const overlay = createElement('div', 'theme-picker-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'themePickerTitle');

    const picker = createElement('section', 'theme-picker');
    const header = createElement('div', 'tp-head');
    const title = createElement('h2', '', 'Choose your training vibe');
    title.id = 'themePickerTitle';
    header.append(title, createElement('p', '', 'Switch instantly whenever you want. Your workout data stays exactly where it is.'));

    const grid = createElement('div', 'tp-grid');
    const themes = (window.ThemeSystem && window.ThemeSystem.available) || [];
    themes.forEach((theme) => {
      const card = createElement('button', 'tp-card');
      card.type = 'button';
      card.setAttribute('aria-label', 'Use ' + theme.name);
      card.append(
        createElement('span', 'tp-emoji', theme.emoji),
        createElement('span', 'tp-name', theme.name),
        createElement('span', 'tp-desc', theme.desc)
      );
      card.addEventListener('click', async () => {
        card.disabled = true;
        await window.ThemeSystem.load(theme.id);
        overlay.remove();
      });
      grid.appendChild(card);
    });

    const skip = createElement('button', 'btn-ghost tp-skip', 'Use Standard');
    skip.type = 'button';
    skip.addEventListener('click', async () => {
      await window.ThemeSystem.load('standard');
      overlay.remove();
    });

    picker.append(header, grid, skip);
    overlay.appendChild(picker);
    document.body.appendChild(overlay);
    picker.querySelector('button')?.focus();
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-theme-picker]');
    if (!trigger) return;
    event.preventDefault();
    window.showThemePicker();
  });

  try {
    if (!localStorage.getItem('fp_theme')) window.showThemePicker();
  } catch {
    // The default theme remains usable when storage is unavailable.
  }
}());
