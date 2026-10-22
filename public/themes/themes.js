const ThemeSystem = {
  current: null,
  themes: {},

  async load(themeId) {
    if (!this.themes[themeId]) {
      const res = await fetch(`/themes/${themeId}.json`);
      this.themes[themeId] = await res.json();
    }
    this.current = this.themes[themeId];
    this.apply();
    localStorage.setItem('fp_theme', themeId);
  },

  apply() {
    const t = this.current;
    const root = document.documentElement;

    // Apply all colors as CSS variables
    Object.entries(t.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Apply text labels
    document.querySelectorAll('[data-theme-label]').forEach(el => {
      const key = el.dataset.themeLabel;
      if (t.labels[key]) el.textContent = t.labels[key];
    });

    // Apply background effect
    document.body.dataset.bgEffect = t.background || 'default';

    // Dispatch event so pages can update dynamically
    window.dispatchEvent(new CustomEvent('themeApplied', { detail: t }));
  },

  getUserRank(totalXP) {
    const ranks = this.current?.ranks || [];
    for (let i = ranks.length - 1; i >= 0; i--) {
      if (totalXP >= ranks[i].minXP) return ranks[i];
    }
    return ranks[0] || { name: 'Beginner', emoji: '⭐' };
  },

  translateExercise(category) {
    return this.current?.exerciseNames?.[category] || category;
  }
};

// Auto-load saved theme on every page
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('fp_theme') || 'standard';
  ThemeSystem.load(saved);
});