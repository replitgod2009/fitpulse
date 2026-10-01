api.requireAuth();

// ============================================================
// State machine for the chat
// ============================================================
const state = {
  step: 0,
  answers: {
    goal: null,
    minutes: null,
    energy: null,
    equipment: null
  },
  plan: null
};

const chatMessages = document.getElementById('chatMessages');
const chatOptions  = document.getElementById('chatOptions');
const chatForm     = document.getElementById('chatForm');
const chatInput    = document.getElementById('chatInput');
const chatTyping   = document.getElementById('chatTyping');

// ============================================================
// UI helpers
// ============================================================
function scrollBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(text, role = 'ai') {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  // Support **bold** and *italic* and `code` in AI messages
  if (role === 'ai') {
    bubble.innerHTML = formatMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  chatMessages.appendChild(bubble);
  scrollBottom();
}

function formatMarkdown(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

function showTyping(show = true) {
  chatTyping.style.display = show ? 'flex' : 'none';
  if (show) scrollBottom();
}

function clearOptions() {
  chatOptions.innerHTML = '';
}

function addOptions(options, onPick) {
  clearOptions();
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'chat-option';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      clearOptions();
      onPick(opt.value, opt.label);
    });
    chatOptions.appendChild(btn);
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// Conversation script
// ============================================================
async function askGoal() {
  const user = api.user();
  addMessage(`Hey ${user?.name ? user.name.split(' ')[0] : 'there'}! 👋 I'm **Pulse**, your AI trainer.\n\nI'll build you a personalized workout in under 30 seconds. What's your goal today?`);
  await delay(500);
  addOptions([
    { label: '🔥 Lose weight',        value: 'lose_weight' },
    { label: '💪 Build muscle',       value: 'gain_muscle' },
    { label: '⚡ Stay fit',            value: 'stay_fit' },
    { label: '🏃 Build endurance',    value: 'endurance' },
    { label: '🧘 Flexibility & recovery', value: 'flexibility' }
  ], (value) => {
    state.answers.goal = value;
    addMessage(value.replace(/_/g, ' '), 'user');
    setTimeout(askTime, 400);
  });
}

async function askTime() {
  addMessage(`Nice choice! 💪\n\nHow much time do you have?`);
  await delay(300);
  addOptions([
    { label: '⏱ 15 min (quick)',   value: 15 },
    { label: '⏱ 30 min',            value: 30 },
    { label: '⏱ 45 min',            value: 45 },
    { label: '⏱ 60 min (full)',     value: 60 }
  ], (value) => {
    state.answers.minutes = value;
    addMessage(`${value} minutes`, 'user');
    setTimeout(askEnergy, 400);
  });
}

async function askEnergy() {
  addMessage(`Got it. How's your energy **right now**?`);
  await delay(300);
  addOptions([
    { label: '😴 Low — take it easy', value: 'low' },
    { label: '🙂 Medium — normal',    value: 'medium' },
    { label: '⚡ High — let\'s go!',  value: 'high' }
  ], (value) => {
    state.answers.energy = value;
    addMessage(value, 'user');
    setTimeout(askEquipment, 400);
  });
}

async function askEquipment() {
  addMessage(`What equipment do you have access to?`);
  await delay(300);
  addOptions([
    { label: '🏠 Bodyweight only',    value: 'none' },
    { label: '🏋️ Home gym (basic)',   value: 'home_gym' },
    { label: '🏢 Full gym access',    value: 'full_gym' }
  ], (value) => {
    state.answers.equipment = value;
    const labels = { none: 'Bodyweight only', home_gym: 'Home gym', full_gym: 'Full gym' };
    addMessage(labels[value], 'user');
    setTimeout(generatePlan, 500);
  });
}

async function generatePlan() {
  showTyping(true);
  await delay(1200);

  const user = api.user();
  const plan = AIEngine.buildWorkout({
    goal: state.answers.goal,
    minutes: state.answers.minutes,
    energy: state.answers.energy,
    equipment: state.answers.equipment,
    user
  });
  state.plan = plan;

  showTyping(false);

  const narrative = AIEngine.narratePlan(plan);
  addMessage(narrative);

  // Show action buttons
  clearOptions();
  const actions = document.createElement('div');
  actions.className = 'chat-actions';
  actions.innerHTML = `
    <button class="btn-primary" id="startWorkoutBtn">▶ Start Workout</button>
    <button class="btn-ghost"   id="regenerateBtn">↻ Regenerate</button>
    <button class="btn-ghost"   id="restartChatBtn">💬 New Chat</button>
  `;
  chatOptions.appendChild(actions);

  document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
  document.getElementById('regenerateBtn').addEventListener('click', () => {
    addMessage('Give me a second, switching things up...', 'ai');
    setTimeout(() => {
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        const newPlan = AIEngine.buildWorkout({
          goal: state.answers.goal,
          minutes: state.answers.minutes,
          energy: state.answers.energy,
          equipment: state.answers.equipment,
          user
        });
        state.plan = newPlan;
        addMessage('Here\'s a fresh version 🔄');
        addMessage(AIEngine.narratePlan(newPlan));
        renderActions();
      }, 900);
    }, 300);
  });
  document.getElementById('restartChatBtn').addEventListener('click', restartChat);
}

function renderActions() {
  clearOptions();
  const actions = document.createElement('div');
  actions.className = 'chat-actions';
  actions.innerHTML = `
    <button class="btn-primary" id="startWorkoutBtn">▶ Start Workout</button>
    <button class="btn-ghost"   id="regenerateBtn">↻ Regenerate</button>
    <button class="btn-ghost"   id="restartChatBtn">💬 New Chat</button>
  `;
  chatOptions.appendChild(actions);
  document.getElementById('startWorkoutBtn').addEventListener('click', startWorkout);
  document.getElementById('regenerateBtn').addEventListener('click', () => {
    state.plan = AIEngine.buildWorkout({
      goal: state.answers.goal,
      minutes: state.answers.minutes,
      energy: state.answers.energy,
      equipment: state.answers.equipment,
      user: api.user()
    });
    addMessage('Here\'s a fresh version 🔄');
    addMessage(AIEngine.narratePlan(state.plan));
    renderActions();
  });
  document.getElementById('restartChatBtn').addEventListener('click', restartChat);
}

function startWorkout() {
  const plan = state.plan;
  if (!plan) return;

  // Package into what the planner expects
  const queuedExercises = [
    plan.warmup,
    ...plan.exercises,
    plan.cooldown
  ].map(ex => ({
    name: ex.name,
    category: ex.category || 'cardio',
    duration: ex.duration,
    calories: ex.calories
  }));

  localStorage.setItem('fp_queued_exercises', JSON.stringify(queuedExercises));
  localStorage.setItem('fp_queued_name', `AI Plan — ${plan.goalLabel}`);
  window.location.href = '/planner.html';
}

async function restartChat() {
  chatMessages.innerHTML = '';
  clearOptions();
  state.step = 0;
  state.answers = { goal: null, minutes: null, energy: null, equipment: null };
  state.plan = null;
  askGoal();
}

// ============================================================
// Boot
// ============================================================
document.getElementById('restartBtn').addEventListener('click', restartChat);
askGoal();