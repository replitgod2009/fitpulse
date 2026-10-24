/* Dashboard extensions: meal logging, streak protection, habit anchoring,
   friend activity, and a transparent Perfect Day progress card. */
(function () {
  const FOODS = [
    { name: 'Banana', serving: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    { name: 'Apple', serving: '1 medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
    { name: 'Oats', serving: '40 g', calories: 150, protein: 5, carbs: 27, fat: 3 },
    { name: 'Paneer', serving: '100 g', calories: 265, protein: 18, carbs: 6, fat: 20 },
    { name: 'Chicken breast', serving: '100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: 'Eggs', serving: '2 eggs', calories: 144, protein: 12.6, carbs: 0.8, fat: 9.6 },
    { name: 'Rice, cooked', serving: '1 cup', calories: 205, protein: 4.3, carbs: 45, fat: 0.4 },
    { name: 'Dal, cooked', serving: '1 cup', calories: 230, protein: 18, carbs: 40, fat: 1 },
    { name: 'Greek yogurt', serving: '170 g', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
    { name: 'Peanut butter', serving: '2 tbsp', calories: 190, protein: 8, carbs: 7, fat: 16 },
    { name: 'Protein shake', serving: '1 scoop', calories: 120, protein: 24, carbs: 3, fat: 2 },
    { name: 'Roti', serving: '1 medium', calories: 120, protein: 3, carbs: 18, fat: 3 }
  ];

  const dayKey = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };
  const t = (key, fallback) => window.I18n?.t(key, fallback) || fallback;

  function toast(message, type = 'success') {
    let node = document.querySelector('.fp-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'fp-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add('show');
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => node.classList.remove('show'), 3500);
  }

  function insertUI() {
    const main = document.querySelector('.main');
    const recommendations = document.getElementById('recommendations')?.closest('section');
    if (!main || document.getElementById('wellnessToolkit')) return;
    const section = document.createElement('section');
    section.id = 'wellnessToolkit';
    section.className = 'dashboard-toolkit';
    section.innerHTML = `
      <div class="panel nutrition-snapshot">
        <div class="panel-heading-row">
          <div><span class="eyebrow-mini">FUEL</span><h3 data-i18n="nutrition">Nutrition</h3></div>
          <button type="button" id="openMealModal" class="btn-primary compact" data-i18n="addMeal">Add Meal</button>
        </div>
        <div class="macro-snapshot" id="macroSnapshot"><span class="muted">Loading meals…</span></div>
        <a href="/progress.html#nutrition" class="text-link">See nutrition details →</a>
      </div>
      <div class="panel streak-protection">
        <div class="panel-heading-row"><div><span class="eyebrow-mini">CONSISTENCY</span><h3 data-i18n="streakFreeze">Streak Freeze</h3></div><span id="freezeCount" class="freeze-count">🧊 0</span></div>
        <p class="muted" id="freezeCopy">Keep one day off from breaking your momentum.</p>
        <div class="inline-actions"><button type="button" id="claimFreeze" class="btn-ghost compact" data-i18n="claimFreeze">Claim weekly freeze</button><button type="button" id="buyFreeze" class="btn-ghost compact" data-i18n="buyFreeze">Buy for 150 pts</button></div>
      </div>
      <div class="panel perfect-day-panel">
        <div class="panel-heading-row"><div><span class="eyebrow-mini">BONUS</span><h3 data-i18n="perfectDay">Perfect Day</h3></div><span id="perfectState" class="perfect-state">0/4</span></div>
        <p class="muted">Complete a workout, log water, sleep, and steps to earn 2× XP.</p>
        <div id="perfectChecklist" class="perfect-checklist"></div>
      </div>
      <div class="panel habit-panel">
        <div><span class="eyebrow-mini">ROUTINE</span><h3 data-i18n="habitAnchor">Habit anchor</h3></div>
        <p class="muted" data-i18n="workoutTime">What time do you usually work out?</p>
        <form id="habitForm" class="habit-form"><input id="habitTime" type="time" aria-label="Usual workout time" required /><button class="btn-primary compact" data-i18n="saveReminder">Save reminder</button></form>
        <small class="muted">Notifications run while FitPulse is open. Install the PWA for the best reminder experience.</small>
      </div>
      <div class="panel friend-feed-panel">
        <div class="panel-heading-row"><div><span class="eyebrow-mini">SOCIAL</span><h3 data-i18n="activityFeed">Friends activity</h3></div><a href="/leaderboard.html" class="text-link">Leaderboard →</a></div>
        <div id="friendFeed" class="friend-feed"><p class="muted">Loading your circle…</p></div>
      </div>
    `;
    if (recommendations) main.insertBefore(section, recommendations);
    else main.appendChild(section);

    const modal = document.createElement('div');
    modal.id = 'mealModal';
    modal.className = 'fp-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="fp-modal-card" role="dialog" aria-modal="true" aria-labelledby="mealModalTitle">
        <button class="modal-close" type="button" aria-label="Close">×</button>
        <span class="eyebrow-mini">NUTRITION</span><h2 id="mealModalTitle" data-i18n="addMeal">Add Meal</h2>
        <form id="mealForm" class="meal-form">
          <label for="mealSearch" data-i18n="searchFood">Search a food</label>
          <input id="mealSearch" list="foodOptions" autocomplete="off" data-i18n-placeholder="searchFood" placeholder="Search a food" required />
          <datalist id="foodOptions"></datalist>
          <label for="mealServing">Serving</label><input id="mealServing" placeholder="1 serving" />
          <div class="macro-input-grid">
            <label>kcal<input id="mealCalories" type="number" min="0" step="1" required /></label>
            <label><span data-i18n="protein">Protein</span> g<input id="mealProtein" type="number" min="0" step="0.1" required /></label>
            <label><span data-i18n="carbs">Carbs</span> g<input id="mealCarbs" type="number" min="0" step="0.1" required /></label>
            <label><span data-i18n="fat">Fat</span> g<input id="mealFat" type="number" min="0" step="0.1" required /></label>
          </div>
          <button class="btn-primary" type="submit" data-i18n="addFood">Add food</button>
        </form>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('foodOptions').innerHTML = FOODS.map((food) => `<option value="${esc(food.name)}">${esc(food.serving)} · ${food.calories} kcal</option>`).join('');
    bindEvents();
    window.I18n?.apply(section);
  }

  function showModal(show) {
    const modal = document.getElementById('mealModal');
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.setAttribute('aria-hidden', String(!show));
    if (show) document.getElementById('mealSearch').focus();
  }

  function fillFood(name) {
    const food = FOODS.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase());
    if (!food) return;
    document.getElementById('mealServing').value = food.serving;
    document.getElementById('mealCalories').value = food.calories;
    document.getElementById('mealProtein').value = food.protein;
    document.getElementById('mealCarbs').value = food.carbs;
    document.getElementById('mealFat').value = food.fat;
  }

  function bindEvents() {
    document.getElementById('openMealModal')?.addEventListener('click', () => showModal(true));
    document.querySelector('#mealModal .modal-close')?.addEventListener('click', () => showModal(false));
    document.getElementById('mealModal')?.addEventListener('click', (event) => { if (event.target.id === 'mealModal') showModal(false); });
    document.getElementById('mealSearch')?.addEventListener('change', (event) => fillFood(event.target.value));
    document.getElementById('mealForm')?.addEventListener('submit', saveMeal);
    document.getElementById('habitForm')?.addEventListener('submit', saveHabit);
    document.getElementById('claimFreeze')?.addEventListener('click', () => manageFreeze('claim'));
    document.getElementById('buyFreeze')?.addEventListener('click', () => manageFreeze('buy'));
  }

  async function saveMeal(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api.post('/meals', {
        name: document.getElementById('mealSearch').value.trim(),
        serving: document.getElementById('mealServing').value.trim(),
        calories: Number(document.getElementById('mealCalories').value),
        protein: Number(document.getElementById('mealProtein').value),
        carbs: Number(document.getElementById('mealCarbs').value),
        fat: Number(document.getElementById('mealFat').value)
      });
      event.currentTarget.reset();
      showModal(false);
      toast('Meal logged — your fuel is counted.');
      loadMeals();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function loadMeals() {
    const target = document.getElementById('macroSnapshot');
    if (!target) return;
    try {
      const meals = await api.get('/meals');
      const today = meals.filter((meal) => (meal.day || dayKey(new Date(meal.date))) === dayKey());
      const totals = today.reduce((sum, meal) => ({
        calories: sum.calories + Number(meal.calories || 0), protein: sum.protein + Number(meal.protein || 0),
        carbs: sum.carbs + Number(meal.carbs || 0), fat: sum.fat + Number(meal.fat || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      target.innerHTML = `
        <div class="calorie-total"><b>${Math.round(totals.calories)}</b><span>kcal today</span></div>
        <div><b>${totals.protein.toFixed(0)}g</b><span>${t('protein', 'Protein')}</span></div>
        <div><b>${totals.carbs.toFixed(0)}g</b><span>${t('carbs', 'Carbs')}</span></div>
        <div><b>${totals.fat.toFixed(0)}g</b><span>${t('fat', 'Fat')}</span></div>`;
    } catch (error) {
      target.innerHTML = '<span class="muted">Meal tracking is loading. Try refreshing in a moment.</span>';
    }
  }

  async function manageFreeze(action) {
    try {
      const response = await api.post('/auth/streak-freeze', { action });
      renderFreeze(response.user || response);
      toast(response.msg || 'Your streak protection is ready.');
      window.dispatchEvent(new CustomEvent('fitpulse:userUpdated', { detail: response.user || response }));
    } catch (error) { toast(error.message, 'error'); }
  }

  async function saveHabit(event) {
    event.preventDefault();
    try {
      const time = await window.HabitReminders?.save(document.getElementById('habitTime').value);
      toast(`Workout reminder set for ${time}.`);
    } catch (error) { toast(error.message, 'error'); }
  }

  function renderFreeze(user) {
    const count = Number(user?.streakFreezes || 0);
    const currentWeek = user?.freezeClaimedThisWeek;
    const countNode = document.getElementById('freezeCount');
    const claim = document.getElementById('claimFreeze');
    const buy = document.getElementById('buyFreeze');
    if (countNode) countNode.textContent = `🧊 ${count}`;
    if (claim) { claim.disabled = Boolean(currentWeek) || count >= 3; claim.textContent = currentWeek ? 'Claimed this week' : t('claimFreeze', 'Claim weekly freeze'); }
    if (buy) buy.disabled = count >= 3 || Number(user?.totalPoints || 0) < 150;
  }

  function renderPerfect(workouts, activity, user) {
    const today = dayKey();
    const completed = workouts.some((workout) => workout.completed && dayKey(new Date(workout.completedAt || workout.date)) === today);
    const checks = [
      ['Workout', completed], ['8 glasses', Number(activity?.waterIntake || 0) >= 8],
      ['7 hr sleep', Number(activity?.sleepHours || 0) >= 7], ['6k steps', Number(activity?.steps || 0) >= 6000]
    ];
    document.getElementById('perfectState').textContent = user?.perfectDayToday ? '2× XP ✓' : `${checks.filter(([, done]) => done).length}/4`;
    document.getElementById('perfectChecklist').innerHTML = checks.map(([label, done]) => `<span class="${done ? 'done' : ''}">${done ? '✓' : '○'} ${label}</span>`).join('');
  }

  async function loadFriendFeed() {
    const container = document.getElementById('friendFeed');
    if (!container) return;
    try {
      const feedResponse = await api.get('/social/feed');
      const feed = Array.isArray(feedResponse) ? feedResponse : (feedResponse.activities || []);
      if (!feed.length) { container.innerHTML = '<p class="muted">Your friends’ wins will appear here. Add a friend from the leaderboard.</p>'; return; }
      container.innerHTML = feed.slice(0, 4).map((entry) => {
        const name = entry.name || entry.user?.name || '?';
        const workout = entry.workout || entry;
        return `<div class="friend-feed-item"><span class="feed-avatar">${esc(name.slice(0, 1).toUpperCase())}</span><div><b>${esc(name)}</b> finished <strong>${esc(workout.name || entry.workoutName || 'a workout')}</strong><small>${workout.totalDuration || entry.totalDuration || 0} min · ${workout.totalCalories || entry.totalCalories || 0} kcal · ${new Date(entry.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div></div>`;
      }).join('');
    } catch {
      container.innerHTML = '<p class="muted">Build your circle from the Friends tab to see activity here.</p>';
    }
  }

  async function hydrate() {
    try {
      const [user, workouts, activities] = await Promise.all([api.get('/auth/me'), api.get('/workouts'), api.get('/activities')]);
      const activity = activities.find((entry) => (entry.day || dayKey(new Date(entry.date))) === dayKey());
      renderFreeze(user);
      renderPerfect(workouts, activity, user);
      document.getElementById('habitTime').value = window.HabitReminders?.getTime() || '';
    } catch (error) { console.warn('Could not load dashboard extensions', error); }
    loadMeals();
    loadFriendFeed();
  }

  function init() { insertUI(); hydrate(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('languageApplied', () => { window.I18n?.apply(document.getElementById('wellnessToolkit')); loadMeals(); });
  window.addEventListener('fitpulse:activityLogged', hydrate);
})();
