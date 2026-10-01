api.requireAuth();

async function loadLeaderboard() {
  try {
    const users = await api.get('/activities/leaderboard');

    const podium = document.getElementById('podium');
    if (users.length >= 1) {
      const top3 = users.slice(0, 3);
      const slots = [];
      if (top3[1]) slots.push({ u: top3[1], cls: 'second', medal: '🥈' });
      if (top3[0]) slots.push({ u: top3[0], cls: 'first', medal: '🥇' });
      if (top3[2]) slots.push({ u: top3[2], cls: 'third', medal: '🥉' });

      podium.innerHTML = slots.map(s => `
        <div class="podium-slot ${s.cls}">
          <div style="font-size:1.8rem">${s.medal}</div>
          <div class="name">${esc(s.u.name)}</div>
          <div class="pts">${s.u.totalPoints} pts</div>
        </div>
      `).join('');
    } else {
      podium.innerHTML = '<p class="muted">No one on the board yet.</p>';
    }

    document.getElementById('leaderBody').innerHTML = users.map((u, i) => `
      <tr>
        <td><span class="rank-badge">${i + 1}</span></td>
        <td><b>${esc(u.name)}</b></td>
        <td>⭐ ${u.totalPoints}</td>
        <td>🔥 ${u.streak || 0}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

loadLeaderboard();