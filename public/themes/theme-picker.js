// Show this only if user hasn't picked a theme yet
if (!localStorage.getItem('fp_theme')) {
  showThemePicker();
}

function showThemePicker() {
  const overlay = document.createElement('div');
  overlay.className = 'theme-picker-overlay';
  overlay.innerHTML = `
    <div class="theme-picker">
      <div class="tp-head">
        <h2>Choose your training vibe 🎮</h2>
        <p>You can switch anytime in Settings. Don't watch anime? No worries — pick Standard.</p>
      </div>
      <div class="tp-grid" id="tpGrid"></div>
      <button class="btn-ghost" id="tpSkip">Skip for now</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const themes = [
    { id: 'standard', name: 'Standard',       emoji: '💪', desc: 'Clean and simple' },
    { id: 'hunter',   name: 'Hunter Mode',    emoji: '⚔', desc: 'Rise from E-Rank' },
    { id: 'onepunch', name: 'One Punch',      emoji: '👊', desc: '100 reps a day' },
    { id: 'warrior',  name: 'Warrior Mode',   emoji: '⚡', desc: 'Train like a Saiyan' },
    { id: 'ninja',    name: 'Ninja Mode',     emoji: '🥷', desc: 'Master your chakra' },
    { id: 'hero',     name: 'Hero Mode',      emoji: '🦸', desc: 'Go beyond limits' },
    { id: 'titan',    name: 'Titan Mode',     emoji: '🗿', desc: 'Break the walls' },
    { id: 'breath',   name: 'Breath Mode',    emoji: '🌊', desc: 'Master the breathing' }
  ];

  const grid = document.getElementById('tpGrid');
  themes.forEach(t => {
    const card = document.createElement('button');
    card.className = 'tp-card';
    card.innerHTML = `
      <div class="tp-emoji">${t.emoji}</div>
      <div class="tp-name">${t.name}</div>
      <div class="tp-desc">${t.desc}</div>
    `;
    card.addEventListener('click', () => {
      localStorage.setItem('fp_theme', t.id);
      overlay.remove();
      window.location.reload();
    });
    grid.appendChild(card);
  });

  document.getElementById('tpSkip').addEventListener('click', () => {
    localStorage.setItem('fp_theme', 'standard');
    overlay.remove();
  });
}