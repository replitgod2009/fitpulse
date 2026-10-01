api.requireAuth();
let weeklyChart;

const GOAL_PLANS = {
  lose_weight: [
    { name: 'Jump Rope', category: 'cardio', duration: 15, calories: 200 },
    { name: 'Burpees', category: 'hiit', duration: 10, calories: 150 },
    { name: 'Mountain Climbers', category: 'hiit', duration: 8, calories: 100 },
    { name: 'Walking', category: 'cardio', duration: 30, calories: 120 },
    { name: 'Plank', category: 'core', duration: 5, calories: 40 }
  ],
  gain_muscle: [
    { name: 'Bench Press', category: 'strength', duration: 15, calories: 120 },
    { name: 'Deadlifts', category: 'strength', duration: 20, calories: 180 },
    { name: 'Pull-ups', category: 'strength', duration: 10, calories: 90 },
    { name: 'Squats', category: 'strength', duration: 12, calories: 100 },
    { name: 'Lunges', category: 'strength', duration: 12, calories: 100 }
  ],
  stay_fit: [
    { name: 'Running', category: 'cardio', duration: 30, calories: 300 },
    { name: 'Sun Salutation', category: 'yoga', duration: 20, calories: 90 },
    { name: 'Push-ups', category: 'strength', duration: 10, calories: 80 },
    { name: 'Plank', category: 'core', duration: 5, calories: 40 },
    { name: 'Walking', category: 'cardio', duration: 30, calories: 120 }
  ],
  endurance: [
    { name: 'Running', category: 'cardio', duration: 45, calories: 450 },
    { name: 'Cycling', category: 'cardio', duration: 45, calories: 400 },
    { name: 'Rowing', category: 'cardio', duration: 25, calories: 250 },
    { name: 'Swimming', category: 'cardio', duration: 40, calories: 350 },
    { name: 'Tabata Sprints', category: 'hiit', duration: 20, calories: 250 }
  ]
};

function removeSkeleton(el, value) {
  el.classList.remove('skeleton');
  el.textContent = value;
}

async function loadDashboard() {
  try {
    const [user, workouts, activities] = await Promise.all([
      api.get('/auth/me'),
      api.get('/workouts'),
      api.get('/activities')
    ]);

    document.getElementById('userName').textContent = esc(user.name.split(' ')[0]);
    document.getElementById('streakVal').textContent = user.streak || 0;
    document.getElementById('pointsVal').textContent = user.totalPoints || 0;
    document.getElementById('badgeCount').textContent = (user.badges || []).length;

    const today = new Date().toDateString();
    const todayWorkouts = workouts.filter(w => new Date(w.date).toDateString() === today);
    const todayCal = todayWorkouts.reduce((s, w) => s + (w.totalCalories || 0), 0);
    const todayMin = todayWorkouts.reduce((s, w) => s + (w.totalDuration || 0), 0);
    const todayActivity = activities.find(a => new Date(a.date).toDateString() === today);

    removeSkeleton(document.getElementById('todayCal'), todayCal);
    removeSkeleton(document.getElementById('todayMin'), todayMin);
    removeSkeleton(document.getElementById('waterVal'), todayActivity?.waterIntake || 0);
    removeSkeleton(document.getElementById('badgeCount'), (user.badges || []).length);

    if (todayActivity) {
      document.getElementById('qWater').value = todayActivity.waterIntake || 0;
      document.getElementById('qSleep').value = todayActivity.sleepHours || 7;
      document.getElementById('qSteps').value = todayActivity.steps || 0;
      document.getElementById('qMood').value = todayActivity.mood || 'good';
    }

    renderRecommendations(user.fitnessGoal);
    renderWeeklyChart(workouts);
  } catch (err) {
    console.error(err);
  }
}

function renderRecommendations(goal) {
  const plan = GOAL_PLANS[goal] || GOAL_PLANS.stay_fit;
  const container = document.getElementById('recommendations');
  if (!container) return;

  container.innerHTML = plan.map(ex => `
    <div class="rec-card">
      <h4>${esc(ex.name)}</h4>
      <div class="meta">${esc(ex.category)} · ${ex.duration} min · ${ex.calories} kcal</div>
    </div>
  `).join('') + `
    <div class="rec-card" style="display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--gradient-soft);border-color:var(--primary)"
         onclick='useRecommendedPlan(${JSON.stringify(plan).replace(/'/g, "&#39;")}, ${JSON.stringify(goal)})'>
      <div style="text-align:center">
        <div style="font-size:1.4rem;margin-bottom:4px">✨</div>
        <b>Use this plan →</b>
      </div>
    </div>
  `;
}

window.useRecommendedPlan = (plan, goal) => {
  localStorage.setItem('fp_queued_exercises', JSON.stringify(plan));
  const names = { lose_weight: 'Weight Loss Plan', gain_muscle: 'Muscle Building Plan', stay_fit: 'Stay Fit Plan', endurance: 'Endurance Builder' };
  localStorage.setItem('fp_queued_name', names[goal] || 'My Workout');
  window.location.href = '/planner.html';
};

function renderWeeklyChart(workouts) {
  const days = [], cals = [];
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
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(124,58,237,0.7)';
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(124,58,237,0.3)');
          gradient.addColorStop(1, 'rgba(34,211,238,0.9)');
          return gradient;
        },
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
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