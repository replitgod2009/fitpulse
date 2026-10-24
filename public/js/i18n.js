/* Lightweight, JSON-backed UI translation layer. Pages opt in with data-i18n. */
(function () {
  const fallback = {
    dashboard: 'Dashboard', planner: 'Planner', library: 'Library', progress: 'Progress', leaderboard: 'Leaderboard',
    welcomeBack: 'Welcome back', streak: 'Streak', points: 'Points', calories: "Today's Calories", workoutMinutes: 'Workout Minutes',
    waterIntake: 'Water Intake', badges: 'Badges', weeklyCalories: 'Weekly Calories', quickLog: 'Quick Log',
    water: 'Water (glasses)', sleep: 'Sleep (hours)', steps: 'Steps', mood: 'Mood', logActivity: 'Log Activity',
    recommended: 'Recommended for you', addMeal: 'Add Meal', mealsToday: 'Meals today', activityFeed: 'Friends activity',
    habitAnchor: 'Habit anchor', workoutTime: 'What time do you usually work out?', saveReminder: 'Save reminder',
    start: 'Start', saveWorkout: 'Save Workout', createWorkout: 'Create Workout', yourWorkouts: 'Your Workouts',
    dailyQuest: 'Daily Quest', theme: 'Theme', language: 'Language', lightMode: 'Light mode', darkMode: 'Dark mode',
    nutrition: 'Nutrition', records: 'Personal Records', consistency: 'Consistency', noActivity: 'No activity yet',
    kcalBurned: 'kcal burned', minutesToday: 'minutes today', glasses: 'glasses', earned: 'earned',
    searchFood: 'Search a food', addFood: 'Add food', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
    perfectDay: 'Perfect Day', streakFreeze: 'Streak Freeze', claimFreeze: 'Claim weekly freeze', buyFreeze: 'Buy freeze',
    friendsOnly: 'Friends', global: 'Global', sendFriendRequest: 'Add friend by email',
    workoutComplete: 'Workout complete', howFeel: 'How do you feel?', notes: 'Notes', photo: 'Photo', share: 'Share',
    logout: 'Logout', aiTrainer: 'AI Trainer', aiTrainerHeading: 'Meet Pulse — your AI Trainer',
    aiTrainerCopy: 'Get a personalized workout in under 30 seconds. Just answer 4 quick questions.',
    talkToTrainer: 'Talk to AI Trainer →'
  };

  function valueFor(dictionary, key) {
    return key.split('.').reduce((value, part) => value && value[part], dictionary);
  }

  const I18n = {
    language: localStorage.getItem('fp_language') || 'en',
    dictionaries: { en: fallback },

    async load(language) {
      if (this.dictionaries[language]) return this.dictionaries[language];
      const response = await fetch(`/i18n/${language}.json`);
      if (!response.ok) throw new Error('Translation unavailable');
      this.dictionaries[language] = await response.json();
      return this.dictionaries[language];
    },

    t(key, fallbackText = '') {
      return valueFor(this.dictionaries[this.language] || fallback, key)
        || valueFor(fallback, key)
        || fallbackText
        || key;
    },

    async setLanguage(language) {
      const next = language === 'hi' ? 'hi' : 'en';
      try {
        await this.load(next);
      } catch (error) {
        console.warn('Could not load translation', error);
        return;
      }
      this.language = next;
      localStorage.setItem('fp_language', next);
      document.documentElement.lang = next;
      this.apply();
      window.dispatchEvent(new CustomEvent('languageApplied', { detail: { language: next } }));
    },

    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach((element) => {
        const translated = this.t(element.dataset.i18n, element.textContent.trim());
        if (translated) element.textContent = translated;
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        element.placeholder = this.t(element.dataset.i18nPlaceholder, element.placeholder || '');
      });
      root.querySelectorAll('[data-i18n-title]').forEach((element) => {
        element.title = this.t(element.dataset.i18nTitle, element.title || '');
      });
      root.querySelectorAll('[data-language-toggle]').forEach((element) => {
        element.textContent = this.language === 'hi' ? 'EN' : 'हिं';
        element.setAttribute('aria-label', this.language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें');
      });
    },

    async init() {
      try {
        await this.load(this.language);
      } catch {
        this.language = 'en';
      }
      document.documentElement.lang = this.language;
      this.apply();
      window.dispatchEvent(new CustomEvent('languageApplied', { detail: { language: this.language } }));
      document.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-language-toggle]');
        if (toggle) this.setLanguage(this.language === 'hi' ? 'en' : 'hi');
      });
    }
  };

  window.I18n = I18n;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => I18n.init());
  else I18n.init();
})();
