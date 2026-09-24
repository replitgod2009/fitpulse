api.requireAuth();

async function loadLeaderboard() {
  try {
    const users = await api.get('/activities/leaderboard');

    // Podium
    const podium = document.getElementById('podium');
    if (users.length >= 1) {
      const top3 = users.slice(0, 3);
      const order = [top3[1], top3[0], top3[2]].filter(Boolean);
      const classes = ['second', 'first', 'third'];
      const medals = ['🥈', '🥇', '🥉'];
      podium.innerHTML = order.map((u, i) => `
        <div class="podium-slot ${classes[i]}">
          <div style="font-size:1.8rem">${medals[i]}</div>
          <div class="name">${esc(u.name)}</div>
          <div class="pts">${u.totalPoints} pts</div>
        </div>
      `).join('');
    }

    // Table
    document.getElementById('leaderBody').innerHTML = users.map((u, i) => `
      <tr>
        <td><span class="rank-badge">${i + 1}</span></td>
        <td><b>${esc(u.name)}</b></td>
        <td>⭐ ${u.totalPoints}</td>
        <td>🔥 ${u.streak || 0}</td>
      </tr>
    `).join('');
  } catch (err) { console.error(err); }
}

loadLeaderboard();