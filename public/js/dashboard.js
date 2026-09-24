api.requireAuth();
let weeklyChart;

const GOAL_PLANS = {
  lose_weight: { label: 'Lose Weight', name: 'Fat Burn Circuit', exercises: [
    { name: 'Running', category: 'cardio', duration: 30, calories: 300 },
    { name: 'Jump Rope', category: 'cardio', duration: 15, calories: 200 },
    { name: 'Burpees', category: 'hiit', duration: 10, calories: 150 },
    { name: 'Mountain Climbers', category: 'hiit', duration: 8, calories: 100 },
    { name: 'Plank', category: 'core', duration: 5, calories: 40 } ] },
  gain_muscle: { label: 'Gain Muscle', name: 'Muscle Builder', exercises: [
    { name: 'Bench Press', category: 'strength', duration: 15, calories: 120 },
    { name: 'Squats', category: 'strength', duration: 12, calories: 100 },
    { name: 'Deadlifts', category: 'strength', duration: 20, calories: 180 },
    { name: 'Pull-ups', category: 'strength', duration: 10, calories: 90 },
    { name: 'Push-ups', category: 'strength', duration: 10, calories: 80 } ] },
  stay_fit: { label: 'Stay Fit', name: 'Balanced Day', exercises: [
    { name: 'Walking', category: 'cardio', duration: 30, calories: 120 },
    { name: 'Squats', category: 'strength', duration: 12, calories: 100 },
    { name: 'Push-ups', category: 'strength', duration: 10, calories: 80 },
    { name: 'Sun Salutation', category: 'yoga', duration: 20, calories: 90 },
    { name: 'Plank', category: 'core', duration: 5, calories: 40 } ] },
  endurance: { label: 'Build Endurance', name: 'Endurance Base', exercises: [
    { name: 'Cycling', category: 'cardio', duration: 45, calories: 400 },
    { name: 'Swimming', category: 'cardio', duration: 40, calories: 350 },
    { name: 'Rowing', category: 'cardio', duration: 25, calories: 250 },
    { name: 'Running', category: 'cardio', duration: 30, calories: 300 } ] }
};

function renderRecommendation(goal) {
  const plan = GOAL_PLANS[goal] || GOAL_PLANS.stay_fit;
  const mins = plan.exercises.reduce((s, x) => s + x.duration, 0);
  const kcal = plan.exercises.reduce((s, x) => s + x.calories, 0);
  document.getElementById('recGoal').textContent = `· goal: ${plan.label}`;
  document.getElementById('recBody').innerHTML = `
    <h4>${esc(plan.name)} <span class="muted">· ${mins} min · ${kcal} kcal</span></h4>
    <div class="rec-list">${plan.exercises.map(x => `<span class="chip">${esc(x.name)}</span>`).join('')}</div>
    <button class="btn-primary" id="useRec">Use this plan →</button>`;
  document.getElementById('useRec').addEventListener('click', () => {
    localStorage.setItem('fp_queue', JSON.stringify(plan.exercises));
    localStorage.setItem('fp_queue_name', plan.name);
    window.location.href = 'planner.html';
  });
}

async function loadDashboard() {
  try {
    const [user, workouts, activities] = await Promise.all([
      api.get('/auth/me'),
      api.get('/workouts'),
      api.get('/activities')
    ]);

    document.getElementById('userName').textContent = user.name.split(' ')[0];
    document.getElementById('streakVal').textContent = user.streak || 0;
    document.getElementById('pointsVal').textContent = user.totalPoints || 0;
    document.getElementById('badgeCount').textContent = (user.badges || []).length;

    // Today's stats
    const today = new Date().toDateString();
    const todayWorkouts = workouts.filter(w => new Date(w.date).toDateString() === today);
    const todayCal = todayWorkouts.reduce((s, w) => s + (w.totalCalories || 0), 0);
    const todayMin = todayWorkouts.reduce((s, w) => s + (w.totalDuration || 0), 0);
    const todayActivity = activities.find(a => new Date(a.date).toDateString() === today);

    document.getElementById('todayCal').textContent = todayCal;
    document.getElementById('todayMin').textContent = todayMin;
    document.getElementById('waterVal').textContent = todayActivity?.waterIntake || 0;
    document.getElementById('stepsVal').textContent = todayActivity?.steps || 0;
    document.getElementById('sleepVal').textContent = todayActivity?.sleepHours || 0;
    document.getElementById('moodVal').textContent = todayActivity ? `hours · mood: ${todayActivity.mood}` : 'hours';
    renderRecommendation(user.fitnessGoal);

    // Prefill quick log if exists
    if (todayActivity) {
      document.getElementById('qWater').value = todayActivity.waterIntake || 0;
      document.getElementById('qSleep').value = todayActivity.sleepHours || 7;
      document.getElementById('qSteps').value = todayActivity.steps || 0;
      document.getElementById('qMood').value = todayActivity.mood || 'good';
    }

    renderWeeklyChart(workouts);
  } catch (err) {
    console.error(err);
  }
}

function renderWeeklyChart(workouts) {
  const days = [];
  const cals = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en', { weekday: 'short' }));
    const total = workouts
      .filter(w => new Date(w.date).toDateString() === d.toDateString())
      .reduce((s, w) => s + (w.totalCalories || 0), 0);
    cals.push(total);
  }

  const ctx = document.getElementById('weeklyChart').getContext('2d');
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Calories',
        data: cals,
        backgroundColor: 'rgba(124,58,237,0.7)',
        borderRadius: 8
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#8892a8' }, grid: { color: '#222c46' } },
        x: { ticks: { color: '#8892a8' }, grid: { display: false } }
      }
    }
  });
}

document.getElementById('quickLogForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.post('/activities', {
      waterIntake: +document.getElementById('qWater').value,
      sleepHours: +document.getElementById('qSleep').value,
      steps: +document.getElementById('qSteps').value,
      mood: document.getElementById('qMood').value
    });
    alert('Activity logged ✅');
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
});

loadDashboard();