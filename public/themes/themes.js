const STANDARD_THEME = {
  id: 'standard',
  name: 'Standard',
  emoji: '💪',
  tagline: 'Clean, focused training',
  colors: {
    bg: '#080a0f',
    bg2: '#0d1118',
    panel: '#111721',
    panel2: '#171e2a',
    border: '#273446',
    text: '#f5f7fb',
    muted: '#9aa5b5',
    primary: '#c8ff45',
    primary2: '#9687ff',
    accent: '#6edcff',
    gradient: 'linear-gradient(135deg, #c8ff45 0%, #6edcff 100%)'
  },
  background: 'default',
  labels: {
    welcome: 'Welcome back',
    pointsLabel: 'Points',
    streakLabel: 'Streak',
    rankLabel: 'Rank',
    questLabel: 'Daily Quest',
    completeMessage: 'Workout complete. Nicely done.',
    dayOneRank: 'Beginner'
  },
  ranks: [
    { minXP: 0, name: 'Beginner', emoji: '⭐' },
    { minXP: 200, name: 'Mover', emoji: '🔥' },
    { minXP: 600, name: 'Athlete', emoji: '🏅' },
    { minXP: 1500, name: 'Champion', emoji: '👑' }
  ],
  exerciseNames: {
    cardio: 'Cardio',
    strength: 'Strength',
    hiit: 'HIIT',
    yoga: 'Yoga',
    core: 'Core'
  }
};

function hexToRgb(color) {
  const hex = String(color || '').replace('#', '').trim();
  if (!/^[\da-f]{6}$/i.test(hex)) return '200, 255, 69';
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16)
  ].join(', ');
}

const ThemeSystem = {
  current: STANDARD_THEME,
  themes: { standard: STANDARD_THEME },
  available: [
    { id: 'standard', name: 'Standard', emoji: '💪', desc: 'Clean and focused' },
    { id: 'hunter', name: 'Hunter Mode', emoji: '⚔', desc: 'Rise from E-Rank' },
    { id: 'one-punch', name: 'One Punch', emoji: '👊', desc: 'One routine at a time' }
  ],

  async load(themeId) {
    const wanted = this.available.some((theme) => theme.id === themeId) ? themeId : 'standard';
    let theme = this.themes[wanted];

    if (!theme && wanted !== 'standard') {
      try {
        const response = await fetch('/themes/' + encodeURIComponent(wanted) + '.json', { cache: 'force-cache' });
        if (!response.ok) throw new Error('Theme could not be loaded');
        theme = await response.json();
        if (!theme || !theme.colors) throw new Error('Theme data is invalid');
        this.themes[wanted] = theme;
      } catch (error) {
        console.warn('Using the Standard theme instead:', error);
        theme = STANDARD_THEME;
      }
    }

    this.current = theme || STANDARD_THEME;
    this.apply();
    try {
      localStorage.setItem('fp_theme', this.current.id || wanted);
    } catch {
      // Private browsing can block localStorage; the active page still receives the theme.
    }
    return this.current;
  },

  apply() {
    const theme = this.current || STANDARD_THEME;
    const colors = theme.colors || STANDARD_THEME.colors;
    const root = document.documentElement;
    const primaryRgb = hexToRgb(colors.primary);
    const accentRgb = hexToRgb(colors.accent);

    // Keep the original JSON vocabulary, then map it to FitPulse's live CSS tokens.
    Object.entries(colors).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    const variables = {
      '--ink': colors.text,
      '--faint': colors.muted,
      '--bg-soft': colors.bg2,
      '--surface': colors.panel,
      '--surface-2': colors.panel2,
      '--surface-3': colors.panel2,
      '--line': colors.border,
      '--lime': colors.primary,
      '--lime-soft': 'rgba(' + primaryRgb + ', .14)',
      '--violet': colors.primary2,
      '--cyan': colors.accent,
      '--primary': colors.primary,
      '--primary-2': colors.primary2,
      '--accent': colors.accent,
      '--primary-rgb': primaryRgb,
      '--accent-rgb': accentRgb,
      '--gradient': colors.gradient,
      '--gradient-soft': 'linear-gradient(135deg, rgba(' + primaryRgb + ', .18), rgba(' + accentRgb + ', .10))',
      '--gradient-dark': 'linear-gradient(135deg, rgba(' + primaryRgb + ', .19), rgba(' + accentRgb + ', .08))'
    };
    Object.entries(variables).forEach(([key, value]) => {
      if (value) root.style.setProperty(key, value);
    });

    document.querySelectorAll('[data-theme-label]').forEach((element) => {
      const key = element.dataset.themeLabel;
      const label = theme.labels && theme.labels[key];
      if (label) {
        element.textContent = window.I18n?.language === 'hi'
          ? window.I18n.t('theme.' + key, label)
          : label;
      }
    });

    document.querySelectorAll('[data-theme-exercise]').forEach((element) => {
      const category = element.dataset.themeExercise;
      element.textContent = this.translateExercise(category);
    });

    let points = 0;
    try {
      const savedUser = JSON.parse(localStorage.getItem('fp_user') || 'null');
      points = Number(savedUser && savedUser.totalPoints) || 0;
    } catch {
      points = 0;
    }
    const rank = this.getUserRank(points);
    document.querySelectorAll('[data-theme-rank]').forEach((element) => {
      element.textContent = rank.emoji + ' ' + rank.name;
    });

    if (document.body) {
      document.body.dataset.bgEffect = theme.background || 'default';
      document.body.dataset.themeId = theme.id || 'standard';
      document.body.classList.add('theme-active');
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', colors.primary || STANDARD_THEME.colors.primary);

    window.dispatchEvent(new CustomEvent('themeApplied', { detail: theme }));
  },

  getUserRank(totalXP) {
    const ranks = this.current && this.current.ranks ? this.current.ranks : [];
    for (let index = ranks.length - 1; index >= 0; index -= 1) {
      if (Number(totalXP) >= ranks[index].minXP) return ranks[index];
    }
    return ranks[0] || { name: 'Beginner', emoji: '⭐' };
  },

  translateExercise(category) {
    const exerciseNames = this.current && this.current.exerciseNames;
    return (exerciseNames && exerciseNames[category]) || category;
  }
};

window.ThemeSystem = ThemeSystem;

window.addEventListener('languageApplied', () => ThemeSystem.apply());

function loadSavedTheme() {
  let saved = 'standard';
  try {
    saved = localStorage.getItem('fp_theme') || 'standard';
  } catch {
    // Standard is already safe to use.
  }
  ThemeSystem.load(saved);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', loadSavedTheme, { once: true });
} else {
  loadSavedTheme();
}
