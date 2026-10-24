/* global api, esc, Chart */

api.requireAuth();

const HEATMAP_WEEKS = 12;
const progressState = {
  loaded: false,
  user: null,
  completedWorkouts: [],
  activities: [],
  meals: [],
  mealsAvailable: false
};

const progressCharts = {};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function valueOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  if (typeof esc === 'function') return esc(value);
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseAppDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  if (!value) return null;

  const raw = String(value);
  const dayOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    const [, year, month, day] = dayOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value = new Date()) {
  const date = parseAppDate(value) || new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, amount) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function localDayKey(value) {
  const date = parseAppDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(value) {
  const date = startOfDay(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = parseAppDate(value);
  if (!date) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatDayRange(start, end) {
  const first = formatDate(start, { month: 'short', day: 'numeric' });
  const last = formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${first} – ${last}`;
}

function formatInteger(value) {
  return new Intl.NumberFormat().format(Math.round(valueOrZero(value)));
}

function formatGrams(value) {
  const rounded = Math.round(valueOrZero(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(1));
}

function isCompletedWorkout(workout) {
  const completed = workout?.completed;
  return completed === true
    || completed === 1
    || completed === '1'
    || completed === 'true'
    || Boolean(workout?.completedAt || workout?.completed_at);
}

function workoutDate(workout) {
  return parseAppDate(workout?.completedAt || workout?.completed_at || workout?.date);
}

function workoutDayKey(workout) {
  return localDayKey(workoutDate(workout));
}

function workoutDuration(workout) {
  return valueOrZero(workout?.totalDuration ?? workout?.total_duration);
}

function workoutCalories(workout) {
  return valueOrZero(workout?.totalCalories ?? workout?.total_calories);
}

function activityDayKey(activity) {
  return localDayKey(activity?.day || activity?.date);
}

function getWorkoutDaySummary(workouts) {
  const summaries = new Map();

  workouts.forEach((workout) => {
    const key = workoutDayKey(workout);
    if (!key) return;

    const summary = summaries.get(key) || { count: 0, duration: 0, calories: 0 };
    summary.count += 1;
    summary.duration += workoutDuration(workout);
    summary.calories += workoutCalories(workout);
    summaries.set(key, summary);
  });

  return summaries;
}

function getCssVariable(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function destroyChart(name) {
  if (progressCharts[name]) {
    progressCharts[name].destroy();
    delete progressCharts[name];
  }
}

function getChartShell(canvasId) {
  const canvas = document.getElementById(canvasId);
  return canvas ? canvas.closest('.progress-chart-shell') : null;
}

function setChartMessage(canvasId, message) {
  const shell = getChartShell(canvasId);
  if (!shell) return;

  const canvas = document.getElementById(canvasId);
  shell.classList.add('is-empty');
  if (canvas) canvas.setAttribute('aria-hidden', 'true');

  let empty = shell.querySelector('.chart-empty-copy');
  if (!empty) {
    empty = document.createElement('p');
    empty.className = 'chart-empty-copy muted';
    shell.appendChild(empty);
  }
  empty.textContent = message;
}

function clearChartMessage(canvasId) {
  const shell = getChartShell(canvasId);
  if (!shell) return;

  shell.classList.remove('is-empty');
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.removeAttribute('aria-hidden');
  shell.querySelector('.chart-empty-copy')?.remove();
}

function chartIsAvailable() {
  return typeof window.Chart === 'function';
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#101827',
        borderColor: 'rgba(255,255,255,.16)',
        borderWidth: 1,
        titleColor: '#f5f7fb',
        bodyColor: '#c7d2e3',
        padding: 10
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: getCssVariable('--muted', '#8892a8') },
        grid: { color: 'rgba(136,146,168,.18)' }
      },
      x: {
        ticks: { color: getCssVariable('--muted', '#8892a8'), maxRotation: 0, autoSkip: true },
        grid: { display: false }
      }
    }
  };
}

function renderConsistencyHeatmap(workouts) {
  const grid = document.getElementById('consistencyGrid');
  const tooltip = document.getElementById('heatmapTooltip');
  if (!grid || !tooltip) return;

  const today = startOfDay(new Date());
  const firstDay = addDays(startOfWeek(today), -((HEATMAP_WEEKS - 1) * 7));
  const summaries = getWorkoutDaySummary(workouts);
  const totalWorkoutDays = [...summaries.values()].filter((summary) => summary.count > 0).length;

  setText('consistencyRange', formatDayRange(firstDay, today));
  setText(
    'heatmapSummary',
    workouts.length
      ? `${workouts.length} completed workout${workouts.length === 1 ? '' : 's'} across ${totalWorkoutDays} active day${totalWorkoutDays === 1 ? '' : 's'}.`
      : 'Complete a workout to light up your consistency grid.'
  );

  grid.innerHTML = '';
  tooltip.hidden = true;

  for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const date = addDays(firstDay, (week * 7) + day);
      const dayKey = localDayKey(date);
      const summary = summaries.get(dayKey) || { count: 0, duration: 0, calories: 0 };
      const future = date.getTime() > today.getTime();
      const level = summary.count === 0 ? 'none' : summary.count === 1 ? 'one' : 'many';
      const dayLabel = formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' });
      const tooltipText = future
        ? `${dayLabel} — upcoming`
        : summary.count
          ? `${dayLabel} — ${summary.count} workout${summary.count === 1 ? '' : 's'}, ${formatInteger(summary.duration)} min, ${formatInteger(summary.calories)} kcal`
          : `${dayLabel} — no completed workout`;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `heatmap-cell heatmap-${level}${future ? ' heatmap-future' : ''}`;
      cell.setAttribute('aria-label', tooltipText);
      cell.title = tooltipText;
      cell.dataset.tooltip = tooltipText;

      if (future) {
        cell.disabled = true;
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.addEventListener('pointerenter', () => showHeatmapTooltip(cell));
        cell.addEventListener('pointermove', () => positionHeatmapTooltip(cell));
        cell.addEventListener('pointerleave', hideHeatmapTooltip);
        cell.addEventListener('focus', () => showHeatmapTooltip(cell));
        cell.addEventListener('blur', hideHeatmapTooltip);
        cell.addEventListener('click', () => showHeatmapTooltip(cell));
        cell.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') hideHeatmapTooltip();
        });
      }

      grid.appendChild(cell);
    }
  }
}

function showHeatmapTooltip(cell) {
  const tooltip = document.getElementById('heatmapTooltip');
  if (!tooltip || !cell?.dataset.tooltip) return;

  tooltip.textContent = cell.dataset.tooltip;
  tooltip.hidden = false;
  positionHeatmapTooltip(cell);
}

function positionHeatmapTooltip(cell) {
  const tooltip = document.getElementById('heatmapTooltip');
  if (!tooltip || tooltip.hidden || !cell) return;

  const rect = cell.getBoundingClientRect();
  const gap = 10;
  const maxLeft = Math.max(gap, window.innerWidth - tooltip.offsetWidth - gap);
  const desiredLeft = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
  const left = Math.min(Math.max(gap, desiredLeft), maxLeft);
  const placeBelow = rect.top - tooltip.offsetHeight - gap < gap;
  const top = placeBelow ? rect.bottom + gap : rect.top - tooltip.offsetHeight - gap;

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function hideHeatmapTooltip() {
  const tooltip = document.getElementById('heatmapTooltip');
  if (tooltip) tooltip.hidden = true;
}

function renderRecords(user, workouts) {
  const longestWorkout = workouts.reduce((record, workout) => (
    !record || workoutDuration(workout) > workoutDuration(record) ? workout : record
  ), null);
  const highestCalorieWorkout = workouts.reduce((record, workout) => (
    !record || workoutCalories(workout) > workoutCalories(record) ? workout : record
  ), null);
  const longestStreak = valueOrZero(user?.longestStreak ?? user?.longest_streak ?? user?.streak);
  const currentStreak = valueOrZero(user?.streak);

  if (longestWorkout) {
    setText('recordLongestWorkout', `${formatInteger(workoutDuration(longestWorkout))} min`);
    setText('recordLongestWorkoutDate', formatDate(workoutDate(longestWorkout)));
  } else {
    setText('recordLongestWorkout', '—');
    setText('recordLongestWorkoutDate', 'Complete a workout to set this record.');
  }

  if (highestCalorieWorkout) {
    setText('recordMostCalories', `${formatInteger(workoutCalories(highestCalorieWorkout))} kcal`);
    setText('recordMostCaloriesDate', formatDate(workoutDate(highestCalorieWorkout)));
  } else {
    setText('recordMostCalories', '—');
    setText('recordMostCaloriesDate', 'Complete a workout to set this record.');
  }

  setText('recordLongestStreak', longestStreak ? `${formatInteger(longestStreak)} days` : '—');
  setText('recordCurrentStreak', `Current streak: ${formatInteger(currentStreak)} day${currentStreak === 1 ? '' : 's'}`);
}

function renderOverviewCharts(workouts) {
  const overviewState = document.getElementById('overviewChartState');
  const summaryByDay = getWorkoutDaySummary(workouts);
  const entries = [...summaryByDay.entries()]
    .sort(([first], [second]) => first.localeCompare(second));

  destroyChart('calories');
  destroyChart('duration');

  if (!entries.length) {
    setChartMessage('calChart', 'Complete a workout to see your calorie trend.');
    setChartMessage('durChart', 'Complete a workout to see your duration trend.');
    if (overviewState) {
      overviewState.textContent = 'Only completed workouts are included in your progress charts.';
      overviewState.hidden = false;
    }
    return;
  }

  clearChartMessage('calChart');
  clearChartMessage('durChart');
  if (overviewState) overviewState.hidden = true;

  if (!chartIsAvailable()) {
    setChartMessage('calChart', 'Charts are unavailable right now.');
    setChartMessage('durChart', 'Charts are unavailable right now.');
    return;
  }

  const labels = entries.map(([day]) => formatDate(day, { month: 'short', day: 'numeric' }));
  const calories = entries.map(([, summary]) => Math.round(summary.calories));
  const durations = entries.map(([, summary]) => Math.round(summary.duration));
  const pointRadius = labels.length > 28 ? 2 : 4;
  const lineOptions = chartOptions();

  try {
    progressCharts.calories = new Chart(document.getElementById('calChart').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Calories burned',
          data: calories,
          borderColor: getCssVariable('--violet', '#a855f7'),
          backgroundColor: 'rgba(168,85,247,.16)',
          fill: true,
          tension: 0.35,
          pointRadius,
          pointHoverRadius: 5
        }]
      },
      options: lineOptions
    });

    progressCharts.duration = new Chart(document.getElementById('durChart').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Minutes trained',
          data: durations,
          borderColor: getCssVariable('--cyan', '#22d3ee'),
          backgroundColor: 'rgba(34,211,238,.15)',
          fill: true,
          tension: 0.35,
          pointRadius,
          pointHoverRadius: 5
        }]
      },
      options: lineOptions
    });
  } catch (error) {
    console.error('Could not render overview charts', error);
    setChartMessage('calChart', 'Charts are unavailable right now.');
    setChartMessage('durChart', 'Charts are unavailable right now.');
  }
}

function renderBadges(badges) {
  const container = document.getElementById('badgesContainer');
  if (!container) return;

  container.innerHTML = badges.length
    ? badges.map((badge) => `<div class="badge-item gold">🏅 ${escapeHtml(badge)}</div>`).join('')
    : '<p class="muted">No badges yet. Complete workouts to earn them!</p>';
}

function renderActivities(activities) {
  const container = document.getElementById('activitiesList');
  if (!container) return;

  const sorted = [...activities].sort((first, second) => (
    String(activityDayKey(second)).localeCompare(String(activityDayKey(first)))
  ));

  container.innerHTML = sorted.length
    ? sorted.map((activity) => `
        <div class="activity-row">
          <div><span class="k">Date</span><br/>${escapeHtml(formatDate(activity.day || activity.date))}</div>
          <div><span class="k">Water</span><br/>${formatGrams(activity.waterIntake ?? activity.water_intake)} glasses</div>
          <div><span class="k">Sleep</span><br/>${formatGrams(activity.sleepHours ?? activity.sleep_hours)} hrs</div>
          <div><span class="k">Steps</span><br/>${formatInteger(activity.steps)}</div>
          <div><span class="k">Mood</span><br/>${escapeHtml(activity.mood || '-')}</div>
        </div>
      `).join('')
    : '<p class="muted">No activities logged yet.</p>';
}

function moodPresentation(mood) {
  const normalized = String(mood || '').trim().toLowerCase();
  const moods = {
    energized: ['😃', 'Energized'],
    great: ['😃', 'Great'],
    good: ['🙂', 'Good'],
    fine: ['😐', 'Fine'],
    okay: ['😐', 'Okay'],
    tired: ['😫', 'Tired'],
    exhausted: ['😫', 'Exhausted']
  };
  const [emoji, label] = moods[normalized] || ['💬', mood || 'No mood logged'];
  return { emoji, label };
}

function safePhotoUrl(value) {
  if (typeof value !== 'string') return '';
  const photo = value.trim();
  if (!photo) return '';

  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(photo)) return photo;
  if (/^https:\/\//i.test(photo)) return photo;
  if (photo.startsWith('/')) return photo;
  return '';
}

function workoutTitle(workout) {
  return workout?.title
    || workout?.name
    || workout?.workoutName
    || workout?.workout_name
    || workout?.notes
    || 'Workout';
}

function renderCompletedWorkoutHistory(workouts, activities) {
  const container = document.getElementById('completedWorkoutsList');
  if (!container) return;

  const activityByDay = new Map(activities.map((activity) => [activityDayKey(activity), activity]));
  const sorted = [...workouts].sort((first, second) => {
    const firstDate = workoutDate(first)?.getTime() || 0;
    const secondDate = workoutDate(second)?.getTime() || 0;
    return secondDate - firstDate;
  });

  setText('completedWorkoutsCount', `${sorted.length} completed`);
  if (!sorted.length) {
    container.innerHTML = '<p class="progress-empty-state">No completed workouts yet. Finish a session to begin your training journal.</p>';
    return;
  }

  container.innerHTML = sorted.map((workout) => {
    const dayKey = workoutDayKey(workout);
    const activity = activityByDay.get(dayKey);
    const mood = workout.completionMood ?? workout.completion_mood ?? activity?.mood;
    const moodInfo = moodPresentation(mood);
    const completionNote = workout.completionNotes ?? workout.completion_notes;
    const photo = safePhotoUrl(workout.completionPhoto ?? workout.completion_photo ?? workout.photoUrl ?? workout.photo_url ?? workout.photo);
    const exercises = asArray(workout.exercises).slice(0, 3).map((exercise) => exercise?.name).filter(Boolean);
    const exerciseSummary = exercises.length ? exercises.join(' · ') : 'Completed session';

    return `
      <article class="completed-workout-card${photo ? ' has-photo' : ''}">
        ${photo ? `<img class="completed-workout-photo" src="${escapeHtml(photo)}" alt="Workout memory from ${escapeHtml(formatDate(workoutDate(workout)))}" loading="lazy" referrerpolicy="no-referrer" />` : ''}
        <div class="completed-workout-content">
          <div class="completed-workout-topline">
            <span class="completed-workout-date">${escapeHtml(formatDate(workoutDate(workout)))}</span>
            <span class="completed-workout-mood" title="Post-workout mood">${moodInfo.emoji} ${escapeHtml(moodInfo.label)}</span>
          </div>
          <h4>${escapeHtml(workoutTitle(workout))}</h4>
          <p class="completed-workout-meta">${formatInteger(workoutDuration(workout))} min · ${formatInteger(workoutCalories(workout))} kcal · ${escapeHtml(exerciseSummary)}</p>
          ${completionNote ? `<p class="completed-workout-note">“${escapeHtml(completionNote)}”</p>` : '<p class="completed-workout-note is-muted">No post-workout note logged.</p>'}
        </div>
      </article>
    `;
  }).join('');
}

function normaliseMeal(meal) {
  const source = meal || {};
  return {
    _id: source._id ?? source.id ?? '',
    day: localDayKey(source.day || source.date || source.createdAt || source.created_at),
    date: source.date || source.day || source.createdAt || source.created_at || '',
    name: source.name || source.foodName || source.food_name || 'Meal',
    serving: source.serving || source.portion || source.quantity || '',
    calories: valueOrZero(source.calories ?? source.kcal),
    protein: valueOrZero(source.protein ?? source.proteinGrams ?? source.protein_grams),
    carbs: valueOrZero(source.carbs ?? source.carbohydrates ?? source.carbsGrams ?? source.carbs_grams),
    fat: valueOrZero(source.fat ?? source.fatGrams ?? source.fat_grams)
  };
}

function extractMeals(response) {
  if (Array.isArray(response)) return response.map(normaliseMeal);
  if (Array.isArray(response?.meals)) return response.meals.map(normaliseMeal);
  if (Array.isArray(response?.data)) return response.data.map(normaliseMeal);
  return [];
}

async function loadMealsSafely() {
  try {
    const response = await api.get('/meals');
    return { available: true, meals: extractMeals(response) };
  } catch (error) {
    console.warn('Meal tracking is unavailable.', error);
    return { available: false, meals: [], error };
  }
}

function totalsForMeals(meals) {
  return meals.reduce((totals, meal) => ({
    calories: totals.calories + meal.calories,
    protein: totals.protein + meal.protein,
    carbs: totals.carbs + meal.carbs,
    fat: totals.fat + meal.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function renderNutritionSummary(meals, completedWorkouts, mealsAvailable) {
  const today = startOfDay(new Date());
  const todayKey = localDayKey(today);
  const completedByDay = getWorkoutDaySummary(completedWorkouts);
  const burnedToday = completedByDay.get(todayKey)?.calories || 0;
  const todayMeals = meals.filter((meal) => meal.day === todayKey);
  const totals = totalsForMeals(todayMeals);

  setText('nutritionDayLabel', formatDate(today, { weekday: 'long', month: 'short', day: 'numeric' }));
  setText('nutritionBurned', mealsAvailable ? `${formatInteger(burnedToday)} kcal` : '—');

  if (!mealsAvailable) {
    setText('nutritionStatus', 'Meal tracking is being set up. Your completed workouts are still safely saved.');
    setText('nutritionCalories', '—');
    setText('nutritionBalance', '—');
    setText('macroProtein', '—');
    setText('macroCarbs', '—');
    setText('macroFat', '—');
    return;
  }

  const balance = totals.calories - burnedToday;
  setText('nutritionStatus', todayMeals.length
    ? `${todayMeals.length} meal${todayMeals.length === 1 ? '' : 's'} logged today.`
    : 'No meals logged today. Add one from the Dashboard to start tracking fuel.');
  setText('nutritionCalories', `${formatInteger(totals.calories)} kcal`);
  setText('nutritionBurned', `${formatInteger(burnedToday)} kcal`);
  setText('nutritionBalance', `${balance > 0 ? '+' : ''}${formatInteger(balance)} kcal`);
  setText('macroProtein', formatGrams(totals.protein));
  setText('macroCarbs', formatGrams(totals.carbs));
  setText('macroFat', formatGrams(totals.fat));
}

function renderMealHistory(meals, mealsAvailable) {
  const container = document.getElementById('mealHistoryList');
  if (!container) return;

  setText('mealHistoryCount', mealsAvailable ? `${meals.length} meal${meals.length === 1 ? '' : 's'}` : 'Unavailable');
  if (!mealsAvailable) {
    container.innerHTML = '<p class="progress-empty-state">Meal history will appear here once nutrition tracking is available.</p>';
    return;
  }

  const sorted = [...meals].sort((first, second) => {
    const firstDate = parseAppDate(first.date || first.day)?.getTime() || 0;
    const secondDate = parseAppDate(second.date || second.day)?.getTime() || 0;
    return secondDate - firstDate;
  });

  if (!sorted.length) {
    container.innerHTML = '<p class="progress-empty-state">No meals yet. Add a meal from the Dashboard to see calories and macros here.</p>';
    return;
  }

  container.innerHTML = sorted.slice(0, 24).map((meal) => `
    <article class="meal-history-card">
      <div>
        <h4>${escapeHtml(meal.name)}</h4>
        <p>${escapeHtml(meal.serving || 'Serving not specified')} · ${escapeHtml(formatDate(meal.date || meal.day))}</p>
      </div>
      <div class="meal-history-nutrition">
        <strong>${formatInteger(meal.calories)} kcal</strong>
        <span>P ${formatGrams(meal.protein)}g · C ${formatGrams(meal.carbs)}g · F ${formatGrams(meal.fat)}g</span>
      </div>
    </article>
  `).join('');
}

function renderNutritionCharts(meals, completedWorkouts, mealsAvailable) {
  destroyChart('nutritionCalories');
  destroyChart('macros');

  if (!mealsAvailable) {
    setChartMessage('nutritionCaloriesChart', 'Nutrition charts will appear when meal tracking is available.');
    setChartMessage('macroChart', 'Nutrition charts will appear when meal tracking is available.');
    return;
  }

  if (!chartIsAvailable()) {
    setChartMessage('nutritionCaloriesChart', 'Charts are unavailable right now.');
    setChartMessage('macroChart', 'Charts are unavailable right now.');
    return;
  }

  clearChartMessage('nutritionCaloriesChart');
  const today = startOfDay(new Date());
  const completedByDay = getWorkoutDaySummary(completedWorkouts);
  const mealsByDay = new Map();
  meals.forEach((meal) => {
    if (!meal.day) return;
    mealsByDay.set(meal.day, (mealsByDay.get(meal.day) || 0) + meal.calories);
  });

  const labels = [];
  const intake = [];
  const burn = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const dayKey = localDayKey(day);
    labels.push(formatDate(day, { weekday: 'short' }));
    intake.push(Math.round(mealsByDay.get(dayKey) || 0));
    burn.push(Math.round(completedByDay.get(dayKey)?.calories || 0));
  }

  try {
    progressCharts.nutritionCalories = new Chart(document.getElementById('nutritionCaloriesChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Calories eaten',
            data: intake,
            backgroundColor: 'rgba(168,85,247,.78)',
            borderRadius: 7
          },
          {
            label: 'Calories burned',
            data: burn,
            backgroundColor: 'rgba(34,211,238,.82)',
            borderRadius: 7
          }
        ]
      },
      options: {
        ...chartOptions(),
        plugins: {
          ...chartOptions().plugins,
          legend: {
            display: true,
            labels: { color: getCssVariable('--muted', '#8892a8'), boxWidth: 10, usePointStyle: true }
          }
        }
      }
    });
  } catch (error) {
    console.error('Could not render nutrition calorie chart', error);
    setChartMessage('nutritionCaloriesChart', 'Charts are unavailable right now.');
  }

  const todayKey = localDayKey(today);
  const macroTotals = totalsForMeals(meals.filter((meal) => meal.day === todayKey));
  const macroValues = [macroTotals.protein, macroTotals.carbs, macroTotals.fat];
  if (!macroValues.some((value) => value > 0)) {
    setChartMessage('macroChart', 'Add a meal with macros to see your daily split.');
    return;
  }

  clearChartMessage('macroChart');
  try {
    progressCharts.macros = new Chart(document.getElementById('macroChart').getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Protein', 'Carbs', 'Fat'],
        datasets: [{
          data: macroValues,
          backgroundColor: ['#6edcff', '#a855f7', '#ffc76a'],
          borderColor: '#111721',
          borderWidth: 4,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: getCssVariable('--muted', '#8892a8'), boxWidth: 10, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: '#101827',
            borderColor: 'rgba(255,255,255,.16)',
            borderWidth: 1,
            titleColor: '#f5f7fb',
            bodyColor: '#c7d2e3',
            callbacks: {
              label(context) {
                return `${context.label}: ${formatGrams(context.raw)}g`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Could not render macro chart', error);
    setChartMessage('macroChart', 'Charts are unavailable right now.');
  }
}

function selectProgressTab(tabName) {
  const isNutrition = tabName === 'nutrition';
  const overviewTab = document.getElementById('overviewTab');
  const nutritionTab = document.getElementById('nutritionTab');
  const overviewPanel = document.getElementById('overviewPanel');
  const nutritionPanel = document.getElementById('nutritionPanel');

  if (!overviewTab || !nutritionTab || !overviewPanel || !nutritionPanel) return;

  overviewTab.classList.toggle('active', !isNutrition);
  nutritionTab.classList.toggle('active', isNutrition);
  overviewTab.setAttribute('aria-selected', String(!isNutrition));
  nutritionTab.setAttribute('aria-selected', String(isNutrition));
  overviewTab.tabIndex = isNutrition ? -1 : 0;
  nutritionTab.tabIndex = isNutrition ? 0 : -1;
  overviewPanel.hidden = isNutrition;
  nutritionPanel.hidden = !isNutrition;

  if (isNutrition && progressState.loaded) {
    renderNutritionCharts(progressState.meals, progressState.completedWorkouts, progressState.mealsAvailable);
  }
}

function setupTabs() {
  const overviewTab = document.getElementById('overviewTab');
  const nutritionTab = document.getElementById('nutritionTab');
  if (!overviewTab || !nutritionTab) return;

  overviewTab.addEventListener('click', () => selectProgressTab('overview'));
  nutritionTab.addEventListener('click', () => selectProgressTab('nutrition'));

  [overviewTab, nutritionTab].forEach((tab, index, tabs) => {
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const targetIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[targetIndex].focus();
      selectProgressTab(targetIndex === 1 ? 'nutrition' : 'overview');
    });
  });
}

function renderLoadFailure() {
  setText('heatmapSummary', 'We could not load your progress right now. Please try again.');
  setChartMessage('calChart', 'Progress data is unavailable right now.');
  setChartMessage('durChart', 'Progress data is unavailable right now.');
  setText('completedWorkoutsCount', 'Unavailable');
  const history = document.getElementById('completedWorkoutsList');
  if (history) history.innerHTML = '<p class="progress-empty-state">Your workout history could not be loaded.</p>';
  renderNutritionSummary([], [], false);
  renderMealHistory([], false);
}

async function loadProgress() {
  try {
    const mealsRequest = loadMealsSafely();
    const [user, workouts, activities, mealResult] = await Promise.all([
      api.get('/auth/me'),
      api.get('/workouts'),
      api.get('/activities'),
      mealsRequest
    ]);

    const completedWorkouts = asArray(workouts).filter(isCompletedWorkout);
    const normalizedActivities = asArray(activities);
    const meals = mealResult.meals;

    progressState.loaded = true;
    progressState.user = user || {};
    progressState.completedWorkouts = completedWorkouts;
    progressState.activities = normalizedActivities;
    progressState.meals = meals;
    progressState.mealsAvailable = mealResult.available;

    renderConsistencyHeatmap(completedWorkouts);
    renderRecords(user, completedWorkouts);
    renderOverviewCharts(completedWorkouts);
    renderCompletedWorkoutHistory(completedWorkouts, normalizedActivities);
    renderBadges(asArray(user?.badges));
    renderActivities(normalizedActivities);
    renderNutritionSummary(meals, completedWorkouts, mealResult.available);
    renderMealHistory(meals, mealResult.available);

    if (!document.getElementById('nutritionPanel')?.hidden) {
      renderNutritionCharts(meals, completedWorkouts, mealResult.available);
    }
  } catch (error) {
    console.error('Could not load progress', error);
    renderLoadFailure();
  }
}

setupTabs();
loadProgress();
