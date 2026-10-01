api.requireAuth();

const exerciseList = document.getElementById('exerciseList');

function addExerciseRow(name = '', category = 'cardio', duration = 20, calories = 150) {
  const row = document.createElement('div');
  row.className = 'exercise-row';
  row.innerHTML = `
    <input placeholder="Exercise name" value="${esc(name)}" class="ex-name" required />
    <select class="ex-cat">
      <option value="cardio" ${category === 'cardio' ? 'selected' : ''}>Cardio</option>
      <option value="strength" ${category === 'strength' ? 'selected' : ''}>Strength</option>
      <option value="yoga" ${category === 'yoga' ? 'selected' : ''}>Yoga</option>
      <option value="hiit" ${category === 'hiit' ? 'selected' : ''}>HIIT</option>
      <option value="core" ${category === 'core' ? 'selected' : ''}>Core</option>
    </select>
    <input type="number" class="ex-dur" placeholder="Min" value="${duration}" min="1" required />
    <input type="number" class="ex-cal" placeholder="Kcal" value="${calories}" min="0" required />
    <button type="button" class="remove-btn">×</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  exerciseList.appendChild(row);
}

// Load queued exercises from library or dashboard
(function prefillFromQueue() {
  const queue = JSON.parse(localStorage.getItem('fp_queued_exercises') || 'null');
  const queuedName = localStorage.getItem('fp_queued_name') || '';

  if (queue && queue.length) {
    if (queuedName) document.getElementById('wName').value = queuedName;
    queue.forEach(ex => addExerciseRow(ex.name, ex.category, ex.duration, ex.calories));
    localStorage.removeItem('fp_queued_exercises');
    localStorage.removeItem('fp_queued_name');
  } else {
    addExerciseRow();
  }
})();

document.getElementById('addExercise').addEventListener('click', () => addExerciseRow());

document.getElementById('workoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('wName').value;
  const rows = document.querySelectorAll('.exercise-row');
  const exercises = [...rows].map(r => ({
    name: r.querySelector('.ex-name').value,
    category: r.querySelector('.ex-cat').value,
    duration: +r.querySelector('.ex-dur').value,
    calories: +r.querySelector('.ex-cal').value
  })).filter(x => x.name);

  if (!exercises.length) return alert('Add at least one exercise');

  const totalDuration = exercises.reduce((s, x) => s + x.duration, 0);
  const totalCalories = exercises.reduce((s, x) => s + x.calories, 0);

  try {
    await api.post('/workouts', { exercises, totalDuration, totalCalories, notes: name });
    document.getElementById('wName').value = '';
    exerciseList.innerHTML = '';
    addExerciseRow();
    loadWorkouts();
  } catch (err) {
    alert(err.message);
  }
});

async function loadWorkouts() {
  try {
    const workouts = await api.get('/workouts');
    const container = document.getElementById('workoutsContainer');
    if (!workouts.length) {
      container.innerHTML = '<p class="muted">No workouts yet. Create your first one above!</p>';
      return;
    }
    container.innerHTML = workouts.map(w => `
      <div class="workout-item ${w.completed ? 'done' : ''}">
        <h4>${esc(w.notes) || 'Workout'} ${w.completed ? '✅' : ''}</h4>
        <div class="meta">${new Date(w.date).toLocaleString()} · ${w.totalDuration} min · ${w.totalCalories} kcal</div>
        ${w.exercises.map(ex => `<div class="ex">• ${esc(ex.name)} (${esc(ex.category)}) — ${ex.duration} min, ${ex.calories} kcal</div>`).join('')}
        <div style="margin-top:12px; display:flex; gap:8px">
          ${!w.completed ? `<button class="btn-primary" onclick="completeWorkout('${w._id}')">Mark Complete</button>` : ''}
          <button class="btn-ghost" onclick="deleteWorkout('${w._id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

window.completeWorkout = async (id) => {
  try {
    const res = await api.patch(`/workouts/${id}/complete`);
    alert(`Great job! 🔥 Streak: ${res.user.streak} | Points: ${res.user.totalPoints}`);
    loadWorkouts();
  } catch (err) {
    alert(err.message);
  }
};

window.deleteWorkout = async (id) => {
  if (!confirm('Delete this workout?')) return;
  try {
    await api.del(`/workouts/${id}`);
    loadWorkouts();
  } catch (err) {
    alert(err.message);
  }
};

loadWorkouts();