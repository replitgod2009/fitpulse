api.requireAuth();

let activeScope = 'global';
let leaderboardRequestVersion = 0;

const globalTab = document.getElementById('globalLeaderboardTab');
const friendsTab = document.getElementById('friendsLeaderboardTab');
const leaderboardHint = document.getElementById('leaderboardHint');
const podium = document.getElementById('podium');
const leaderBody = document.getElementById('leaderBody');
const friendRequestForm = document.getElementById('friendRequestForm');
const friendEmail = document.getElementById('friendEmail');
const sendFriendRequestBtn = document.getElementById('sendFriendRequestBtn');
const friendRequestMessage = document.getElementById('friendRequestMessage');
const incomingRequests = document.getElementById('incomingRequests');
const outgoingRequests = document.getElementById('outgoingRequests');
const friendsList = document.getElementById('friendsList');
const friendCount = document.getElementById('friendCount');

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setTabs(scope) {
  const isGlobal = scope === 'global';
  globalTab.className = `leaderboard-tab ${isGlobal ? 'btn-primary' : 'btn-ghost'}`;
  friendsTab.className = `leaderboard-tab ${isGlobal ? 'btn-ghost' : 'btn-primary'}`;
  globalTab.setAttribute('aria-selected', String(isGlobal));
  friendsTab.setAttribute('aria-selected', String(!isGlobal));
  leaderboardHint.textContent = isGlobal
    ? 'See how you stack up across FitPulse.'
    : 'You and your accepted friends, ranked together.';
}

function setLeaderboardLoading() {
  podium.innerHTML = '<p class="muted">Loading leaderboard…</p>';
  leaderBody.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
}

function renderLeaderboard(users, scope) {
  const leaderboard = Array.isArray(users) ? users : [];
  if (!leaderboard.length) {
    podium.innerHTML = `<p class="muted">${scope === 'friends'
      ? 'Add friends to start your private leaderboard.'
      : 'No one is on the board yet.'}</p>`;
    leaderBody.innerHTML = '<tr><td colspan="4" class="muted">No rankings yet.</td></tr>';
    return;
  }

  const topThree = leaderboard.slice(0, 3);
  const slots = [];
  if (topThree[1]) slots.push({ user: topThree[1], className: 'second', medal: '🥈' });
  if (topThree[0]) slots.push({ user: topThree[0], className: 'first', medal: '🥇' });
  if (topThree[2]) slots.push({ user: topThree[2], className: 'third', medal: '🥉' });

  podium.innerHTML = slots.map(({ user, className, medal }) => `
    <div class="podium-slot ${className}">
      <div style="font-size:1.8rem">${medal}</div>
      <div class="name">${esc(user.name)}${user.isCurrentUser ? ' <span class="you-label">You</span>' : ''}</div>
      <div class="pts">${numberValue(user.totalPoints)} pts</div>
    </div>
  `).join('');

  leaderBody.innerHTML = leaderboard.map((user, index) => `
    <tr class="${user.isCurrentUser ? 'current-user-row' : ''}">
      <td><span class="rank-badge">${index + 1}</span></td>
      <td><b>${esc(user.name)}</b>${user.isCurrentUser ? ' <span class="you-label">You</span>' : ''}</td>
      <td>⭐ ${numberValue(user.totalPoints)}</td>
      <td>🔥 ${numberValue(user.streak)}</td>
    </tr>
  `).join('');
}

function renderLeaderboardError() {
  podium.innerHTML = '<p class="muted">Could not load the leaderboard. Please try again.</p>';
  leaderBody.innerHTML = '<tr><td colspan="4" class="muted">Unable to load rankings.</td></tr>';
}

async function loadLeaderboard(scope = activeScope) {
  activeScope = scope;
  setTabs(scope);
  setLeaderboardLoading();
  const version = ++leaderboardRequestVersion;

  try {
    const response = scope === 'friends'
      ? await api.get('/social/leaderboard')
      : await api.get('/activities/leaderboard');
    const users = scope === 'friends' ? response.leaderboard : response;
    if (version !== leaderboardRequestVersion || scope !== activeScope) return;
    renderLeaderboard(users, scope);
  } catch (error) {
    if (version !== leaderboardRequestVersion || scope !== activeScope) return;
    console.error(error);
    renderLeaderboardError();
  }
}

function requestRow(request, incoming) {
  const person = request?.user || {};
  const requestId = esc(request?.id || '');
  const name = esc(person.name || 'FitPulse member');
  const points = numberValue(person.totalPoints);

  return `
    <article class="social-person-row">
      <div>
        <b>${name}</b>
        <p class="muted">⭐ ${points} points${incoming ? ' · wants to be friends' : ' · request sent'}</p>
      </div>
      ${incoming ? `
        <div class="social-actions">
          <button class="btn-primary social-action-btn" type="button" data-request-action="accept" data-request-id="${requestId}">Accept</button>
          <button class="btn-ghost social-action-btn" type="button" data-request-action="decline" data-request-id="${requestId}">Decline</button>
        </div>
      ` : '<span class="pending-label">Pending</span>'}
    </article>
  `;
}

function friendRow(friend) {
  const person = friend || {};
  return `
    <article class="social-person-row">
      <div>
        <b>${esc(person.name || 'FitPulse member')}</b>
        <p class="muted">⭐ ${numberValue(person.totalPoints)} points · 🔥 ${numberValue(person.streak)} streak</p>
      </div>
    </article>
  `;
}

function renderConnections(data) {
  const friends = Array.isArray(data?.friends) ? data.friends : [];
  const incoming = Array.isArray(data?.incoming) ? data.incoming : [];
  const outgoing = Array.isArray(data?.outgoing) ? data.outgoing : [];

  friendCount.textContent = `(${friends.length})`;
  friendsList.innerHTML = friends.length
    ? friends.map(friendRow).join('')
    : '<p class="muted">No friends yet. Invite someone to train together.</p>';

  incomingRequests.innerHTML = incoming.length
    ? `<h4 class="social-list-title">Incoming</h4>${incoming.map(request => requestRow(request, true)).join('')}`
    : '';
  outgoingRequests.innerHTML = outgoing.length
    ? `<h4 class="social-list-title">Sent</h4>${outgoing.map(request => requestRow(request, false)).join('')}`
    : '';

  if (!incoming.length && !outgoing.length) {
    incomingRequests.innerHTML = '<p class="muted">No pending friend requests.</p>';
  }
}

function renderConnectionsError() {
  incomingRequests.innerHTML = '<p class="muted">Could not load friend requests.</p>';
  outgoingRequests.innerHTML = '';
  friendsList.innerHTML = '<p class="muted">Could not load friends.</p>';
  friendCount.textContent = '';
}

async function loadConnections() {
  try {
    const connections = await api.get('/social/friends');
    renderConnections(connections);
  } catch (error) {
    console.error(error);
    renderConnectionsError();
  }
}

function setFriendRequestMessage(message, type = '') {
  friendRequestMessage.textContent = message;
  friendRequestMessage.dataset.type = type;
}

friendRequestForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = friendEmail.value.trim();
  if (!email) {
    setFriendRequestMessage('Enter your friend’s FitPulse email.', 'error');
    friendEmail.focus();
    return;
  }

  sendFriendRequestBtn.disabled = true;
  setFriendRequestMessage('Sending request…');
  try {
    const { request } = await api.post('/social/friend-requests', { email });
    setFriendRequestMessage(`Request sent to ${request.user.name}.`, 'success');
    friendRequestForm.reset();
    await loadConnections();
    if (activeScope === 'friends') await loadLeaderboard('friends');
  } catch (error) {
    setFriendRequestMessage(error.message || 'Could not send friend request.', 'error');
  } finally {
    sendFriendRequestBtn.disabled = false;
  }
});

incomingRequests.addEventListener('click', async event => {
  const button = event.target.closest('[data-request-action]');
  if (!button) return;

  const { requestAction, requestId } = button.dataset;
  button.disabled = true;
  try {
    const { request } = await api.patch(`/social/friend-requests/${encodeURIComponent(requestId)}`, {
      action: requestAction
    });
    setFriendRequestMessage(
      requestAction === 'accept' ? `You and ${request.user.name} are now friends!` : 'Friend request declined.',
      requestAction === 'accept' ? 'success' : ''
    );
    await loadConnections();
    if (activeScope === 'friends') await loadLeaderboard('friends');
  } catch (error) {
    setFriendRequestMessage(error.message || 'Could not update friend request.', 'error');
    button.disabled = false;
  }
});

globalTab.addEventListener('click', () => loadLeaderboard('global'));
friendsTab.addEventListener('click', () => loadLeaderboard('friends'));

loadLeaderboard();
loadConnections();
