api.requireAuth();

const EXERCISES = [
  { name: 'Running', category: 'cardio', duration: 30, calories: 300, desc: 'Steady-pace outdoor or treadmill run.' },
  { name: 'Cycling', category: 'cardio', duration: 45, calories: 400, desc: 'Indoor or outdoor cycling session.' },
  { name: 'Jump Rope', category: 'cardio', duration: 15, calories: 200, desc: 'High-intensity jump rope intervals.' },
  { name: 'Swimming', category: 'cardio', duration: 40, calories: 350, desc: 'Full-body low-impact cardio.' },
  { name: 'Walking', category: 'cardio', duration: 30, calories: 120, desc: 'Brisk walking for recovery.' },
  { name: 'Rowing', category: 'cardio', duration: 25, calories: 250, desc: 'Full-body rowing machine workout.' },

  { name: 'Push-ups', category: 'strength', duration: 10, calories: 80, desc: 'Chest, shoulders, triceps.' },
  { name: 'Squats', category: 'strength', duration: 12, calories: 100, desc: 'Lower body compound movement.' },
  { name: 'Deadlifts', category: 'strength', duration: 20, calories: 180, desc: 'Posterior chain strength.' },
  { name: 'Bench Press', category: 'strength', duration: 15, calories: 120, desc: 'Upper body pushing strength.' },
  { name: 'Pull-ups', category: 'strength', duration: 10, calories: 90, desc: 'Back and biceps.' },
  { name: 'Lunges', category: 'strength', duration: 12, calories: 100, desc: 'Unilateral leg strength.' },

  { name: 'Sun Salutation', category: 'yoga', duration: 20, calories: 90, desc: 'Flowing sequence for flexibility.' },
  { name: 'Hatha Yoga', category: 'yoga', duration: 40, calories: 150, desc: 'Slow-paced postures and breath.' },
  { name: 'Vinyasa Flow', category: 'yoga', duration: 30, calories: 180, desc: 'Dynamic sequence.' },
  { name: 'Yin Yoga', category: 'yoga', duration: 45, calories: 100, desc: 'Deep stretch recovery.' },

  { name: 'Burpees', category: 'hiit', duration: 10, calories: 150, desc: 'Explosive full-body movement.' },
  { name: 'Mountain Climbers', category: 'hiit', duration: 8, calories: 100, desc: 'Core and cardio combo.' },
  { name: 'Tabata Sprints', category: 'hiit', duration: 20, calories: 250, desc: '20s on / 10s off intervals.' },
  { name: 'Box Jumps', category: 'hiit', duration: 10, calories: 130, desc: 'Plyometric power.' },

  { name: 'Plank', category: 'core', duration: 5, calories: 40, desc: 'Isometric core hold.' },
  { name: 'Crunches', category: 'core', duration: 8, calories: 60, desc: 'Abdominal isolation.' },
  { name: 'Russian Twists', category: 'core', duration: 8, calories: 70, desc: 'Oblique rotation work.' },
  { name: 'Leg Raises', category: 'core', duration: 8, calories: 60, desc: 'Lower-ab focus.' }
];

let currentCat = 'all';
let query = '';
let queue = JSON.parse(localStorage.getItem('fp_queued_exercises') || '[]');

function updateQueueUI() {
  const btn = document.getElementById('openPlannerBtn');
  const count = document.getElementById('queueCount');
  if (queue.length) {
    btn.style.display = 'inline-block';
    count.textContent = queue.length;
  } else {
    btn.style.display = 'none';
  }
}

function render() {
  const grid = document.getElementById('exerciseGrid');
  const filtered = EXERCISES.filter(ex =>
    (currentCat === 'all' || ex.category === currentCat) &&
    ex.name.toLowerCase().includes(query.toLowerCase())
  );

  if (!filtered.length) {
    grid.innerHTML = '<p class="muted">No exercises found.</p>';
    return;
  }

  grid.innerHTML = filtered.map(ex => `
    <div class="ex-card">
      <img src="https://source.unsplash.com/400x300/?${ex.category},fitness,exercise" alt="${esc(ex.name)}" loading="lazy"
           onerror="this.style.display='none'"/>
      <div class="content">
        <span class="cat">${esc(ex.category)}</span>
        <h4>${esc(ex.name)}</h4>
        <p>${esc(ex.desc)}</p>
        <div class="nums">
          <span>⏱ ${ex.duration} min</span>
          <span>🔥 ${ex.calories} kcal</span>
        </div>
        <button class="btn-primary" style="width:100%" onclick='queueExercise(${JSON.stringify(ex).replace(/'/g, "&#39;")})'>
          + Add to workout
        </button>
      </div>
    </div>
  `).join('');
}

window.queueExercise = (ex) => {
  queue.push({ name: ex.name, category: ex.category, duration: ex.duration, calories: ex.calories });
  localStorage.setItem('fp_queued_exercises', JSON.stringify(queue));
  updateQueueUI();
  alert(`Added "${ex.name}" to your workout queue ✅`);
};

document.getElementById('searchEx').addEventListener('input', (e) => {
  query = e.target.value;
  render();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCat = chip.dataset.cat;
    render();
  });
});

document.getElementById('openPlannerBtn').addEventListener('click', () => {
  window.location.href = '/planner.html';
});

updateQueueUI();
render();