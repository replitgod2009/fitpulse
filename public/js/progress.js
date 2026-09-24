api.requireAuth();

async function loadProgress() {
  try {
    const [user, workouts, activities] = await Promise.all([
      api.get('/auth/me'),
      api.get('/workouts'),
      api.get('/activities')
    ]);

    // Sort chronologically
    const sorted = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sorted.map(w => new Date(w.date).toLocaleDateString());
    const calData = sorted.map(w => w.totalCalories || 0);
    const durData = sorted.map(w => w.totalDuration || 0);

    new Chart(document.getElementById('calChart').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Calories',
          data: calData,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.15)',
          fill: true, tension: 0.35, pointRadius: 4
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

    new Chart(document.getElementById('durChart').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Minutes',
          data: durData,
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.15)',
          fill: true, tension: 0.35, pointRadius: 4
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

    // Badges
    const badges = user.badges || [];
    document.getElementById('badgesContainer').innerHTML = badges.length
      ? badges.map(b => `<div class="badge gold">🏅 ${esc(b)}</div>`).join('')
      : '<p class="muted">No badges yet. Complete workouts to earn them!</p>';

    // Activities
    document.getElementById('activitiesList').innerHTML = activities.length
      ? activities.map(a => `
        <div class="activity-row">
          <div><span class="k">Date</span><br/>${new Date(a.date).toLocaleDateString()}</div>
          <div><span class="k">Water</span><br/>${a.waterIntake || 0} glasses</div>
          <div><span class="k">Sleep</span><br/>${a.sleepHours || 0} hrs</div>
          <div><span class="k">Steps</span><br/>${a.steps || 0}</div>
          <div><span class="k">Mood</span><br/>${esc(a.mood || '-')}</div>
        </div>
      `).join('')
      : '<p class="muted">No activities logged yet.</p>';
  } catch (err) { console.error(err); }
}

loadProgress();