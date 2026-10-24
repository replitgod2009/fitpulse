api.requireAuth();

const exerciseList = document.getElementById('exerciseList');
const CATEGORY_OPTIONS = ['cardio', 'strength', 'yoga', 'hiit', 'core'];

function positiveNumber(value, fallback, minimum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= minimum ? numeric : fallback;
}

function normaliseExercise(exercise) {
  const source = exercise || {};
  return {
    name: String(source.name || '').trim(),
    category: CATEGORY_OPTIONS.includes(source.category) ? source.category : 'cardio',
    duration: positiveNumber(source.duration, 20, 1),
    calories: positiveNumber(source.calories, 150, 0),
    sets: Math.round(positiveNumber(source.sets, 3, 1)),
    reps: Math.round(positiveNumber(source.reps, 10, 0)),
    restSeconds: Math.round(positiveNumber(source.restSeconds, 20, 0))
  };
}

function categoryLabel(category) {
  return window.ThemeSystem ? window.ThemeSystem.translateExercise(category) : category;
}

function applyCategoryLabels(scope) {
  scope.querySelectorAll('[data-theme-exercise]').forEach((element) => {
    element.textContent = categoryLabel(element.dataset.themeExercise);
  });
}

function addExerciseRow(exercise) {
  const values = normaliseExercise(exercise);
  const row = document.createElement('div');
  row.className = 'exercise-row';

  const categoryOptions = CATEGORY_OPTIONS.map((category) => {
    const selected = values.category === category ? ' selected' : '';
    return '<option value="' + category + '" data-theme-exercise="' + category + '"' + selected + '>' + categoryLabel(category) + '</option>';
  }).join('');

  row.innerHTML = [
    '<input aria-label="Exercise name" placeholder="Exercise name" value="' + esc(values.name) + '" class="ex-name" required />',
    '<select aria-label="Exercise category" class="ex-cat">' + categoryOptions + '</select>',
    '<input aria-label="Work minutes" type="number" class="ex-dur" placeholder="Min" value="' + values.duration + '" min="1" required />',
    '<input aria-label="Calories" type="number" class="ex-cal" placeholder="Kcal" value="' + values.calories + '" min="0" required />',
    '<input aria-label="Sets" type="number" class="ex-sets" placeholder="Sets" value="' + values.sets + '" min="1" required />',
    '<input aria-label="Reps per set" type="number" class="ex-reps" placeholder="Reps" value="' + values.reps + '" min="0" required />',
    '<input aria-label="Rest seconds" type="number" class="ex-rest" placeholder="Rest sec" value="' + values.restSeconds + '" min="0" required />',
    '<button type="button" class="remove-btn" aria-label="Remove exercise">×</button>'
  ].join('');

  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  exerciseList.appendChild(row);
  applyCategoryLabels(row);
}

function readExercises() {
  return [...document.querySelectorAll('.exercise-row')]
    .map((row) => normaliseExercise({
      name: row.querySelector('.ex-name').value,
      category: row.querySelector('.ex-cat').value,
      duration: row.querySelector('.ex-dur').value,
      calories: row.querySelector('.ex-cal').value,
      sets: row.querySelector('.ex-sets').value,
      reps: row.querySelector('.ex-reps').value,
      restSeconds: row.querySelector('.ex-rest').value
    }))
    .filter((exercise) => exercise.name);
}

(function prefillFromQueue() {
  let queue = null;
  try {
    queue = JSON.parse(localStorage.getItem('fp_queued_exercises') || 'null');
  } catch {
    queue = null;
  }
  const queuedName = localStorage.getItem('fp_queued_name') || '';

  if (Array.isArray(queue) && queue.length) {
    if (queuedName) document.getElementById('wName').value = queuedName;
    queue.forEach((exercise) => addExerciseRow(exercise));
    localStorage.removeItem('fp_queued_exercises');
    localStorage.removeItem('fp_queued_name');
  } else {
    addExerciseRow();
  }
}());

document.getElementById('addExercise').addEventListener('click', () => addExerciseRow());

document.getElementById('workoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('wName').value.trim();
  const exercises = readExercises();

  if (!exercises.length) {
    alert('Add at least one named exercise.');
    return;
  }

  const totalDuration = exercises.reduce((sum, exercise) => sum + exercise.duration, 0);
  const totalCalories = exercises.reduce((sum, exercise) => sum + exercise.calories, 0);

  try {
    await api.post('/workouts', { exercises, totalDuration, totalCalories, notes: name });
    document.getElementById('wName').value = '';
    exerciseList.innerHTML = '';
    addExerciseRow();
    await loadWorkouts();
  } catch (error) {
    alert(error.message);
  }
});

function workoutExerciseMarkup(exercise) {
  const item = normaliseExercise(exercise);
  const reps = item.reps ? ' · ' + item.sets + ' sets × ' + item.reps + ' reps' : ' · ' + item.sets + ' sets';
  return [
    '<div class="ex">• ' + esc(item.name) + ' (<span data-theme-exercise="' + esc(item.category) + '">' + esc(categoryLabel(item.category)) + '</span>) — ' + item.duration + ' min, ' + item.calories + ' kcal</div>',
    '<div class="workout-ex-meta">' + reps + ' · ' + item.restSeconds + ' sec rest</div>'
  ].join('');
}

function bindWorkoutActions(container) {
  container.querySelectorAll('[data-complete-id]').forEach((button) => {
    button.addEventListener('click', () => completeWorkout(button.dataset.completeId));
  });
  container.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', () => deleteWorkout(button.dataset.deleteId));
  });
}

async function loadWorkouts() {
  const container = document.getElementById('workoutsContainer');
  try {
    const workouts = await api.get('/workouts');
    if (!workouts.length) {
      container.innerHTML = '<p class="muted">No workouts yet. Create your first one above!</p>';
      return;
    }

    container.innerHTML = workouts.map((workout) => {
      const title = esc(workout.notes) || 'Workout';
      const actionMarkup = workout.completed
        ? '<span class="muted">Completed ✓</span>'
        : '<a class="btn-primary" href="/workout.html?id=' + encodeURIComponent(workout._id) + '">▶ Start</a>' +
          '<button class="btn-ghost" type="button" data-complete-id="' + esc(workout._id) + '">Mark complete</button>';
      return [
        '<article class="workout-item ' + (workout.completed ? 'done' : '') + '">',
        '<h4>' + title + (workout.completed ? ' ✅' : '') + '</h4>',
        '<div class="meta">' + new Date(workout.date).toLocaleString() + ' · ' + Number(workout.totalDuration || 0) + ' min · ' + Number(workout.totalCalories || 0) + ' kcal</div>',
        (workout.exercises || []).map(workoutExerciseMarkup).join(''),
        '<div class="workout-actions">' + actionMarkup + '<button class="btn-ghost" type="button" data-delete-id="' + esc(workout._id) + '">Delete</button></div>',
        '</article>'
      ].join('');
    }).join('');

    applyCategoryLabels(container);
    bindWorkoutActions(container);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="muted">Could not load workouts. Please try again.</p>';
  }
}

async function completeWorkout(id) {
  try {
    const result = await api.patch('/workouts/' + encodeURIComponent(id) + '/complete', {});
    const user = result.user || {};
    alert('Great job! 🔥 Streak: ' + (user.streak || 0) + ' | Points: ' + (user.totalPoints || 0));
    await loadWorkouts();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteWorkout(id) {
  if (!confirm('Delete this workout?')) return;
  try {
    await api.del('/workouts/' + encodeURIComponent(id));
    await loadWorkouts();
  } catch (error) {
    alert(error.message);
  }
}

window.addEventListener('themeApplied', () => {
  applyCategoryLabels(document);
});

loadWorkouts();
