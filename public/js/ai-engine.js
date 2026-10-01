// ============================================================
// FitPulse AI Trainer — Rule-Based Workout Engine
// Deterministic, fast, no API key needed
// ============================================================

const EXERCISE_DB = {
  cardio: [
    { name: 'Jumping Jacks',       duration: 3,  calories: 30,  intensity: 'low',    equipment: 'none' },
    { name: 'High Knees',          duration: 3,  calories: 40,  intensity: 'medium', equipment: 'none' },
    { name: 'Burpees',             duration: 5,  calories: 70,  intensity: 'high',   equipment: 'none' },
    { name: 'Mountain Climbers',   duration: 3,  calories: 35,  intensity: 'medium', equipment: 'none' },
    { name: 'Jump Rope',           duration: 5,  calories: 60,  intensity: 'medium', equipment: 'rope' },
    { name: 'Running',             duration: 15, calories: 150, intensity: 'medium', equipment: 'none' },
    { name: 'Cycling',             duration: 15, calories: 130, intensity: 'medium', equipment: 'bike' },
    { name: 'Rowing',              duration: 10, calories: 100, intensity: 'high',   equipment: 'machine' },
    { name: 'Skaters',             duration: 3,  calories: 35,  intensity: 'medium', equipment: 'none' }
  ],
  strength: [
    { name: 'Push-ups',            duration: 3,  calories: 25,  intensity: 'medium', equipment: 'none' },
    { name: 'Squats',              duration: 3,  calories: 30,  intensity: 'medium', equipment: 'none' },
    { name: 'Lunges',              duration: 3,  calories: 30,  intensity: 'medium', equipment: 'none' },
    { name: 'Glute Bridges',       duration: 3,  calories: 20,  intensity: 'low',    equipment: 'none' },
    { name: 'Tricep Dips (chair)', duration: 3,  calories: 25,  intensity: 'medium', equipment: 'chair' },
    { name: 'Incline Push-ups',    duration: 3,  calories: 20,  intensity: 'low',    equipment: 'chair' },
    { name: 'Dumbbell Rows',       duration: 5,  calories: 40,  intensity: 'medium', equipment: 'dumbbells' },
    { name: 'Bench Press',         duration: 8,  calories: 60,  intensity: 'high',   equipment: 'barbell' },
    { name: 'Deadlifts',           duration: 10, calories: 80,  intensity: 'high',   equipment: 'barbell' },
    { name: 'Pull-ups',            duration: 5,  calories: 45,  intensity: 'high',   equipment: 'bar' }
  ],
  core: [
    { name: 'Plank',               duration: 1,  calories: 8,   intensity: 'low',    equipment: 'none' },
    { name: 'Crunches',            duration: 2,  calories: 15,  intensity: 'low',    equipment: 'none' },
    { name: 'Russian Twists',      duration: 2,  calories: 18,  intensity: 'medium', equipment: 'none' },
    { name: 'Leg Raises',          duration: 2,  calories: 18,  intensity: 'medium', equipment: 'none' },
    { name: 'Bicycle Crunches',    duration: 3,  calories: 22,  intensity: 'medium', equipment: 'none' },
    { name: 'Side Planks',         duration: 2,  calories: 12,  intensity: 'low',    equipment: 'none' },
    { name: 'V-ups',               duration: 2,  calories: 20,  intensity: 'high',   equipment: 'none' },
    { name: 'Hanging Knee Raises', duration: 3,  calories: 25,  intensity: 'high',   equipment: 'bar' }
  ],
  hiit: [
    { name: 'Tabata Burpees',      duration: 4,  calories: 60,  intensity: 'high',   equipment: 'none' },
    { name: 'Box Jumps',           duration: 4,  calories: 55,  intensity: 'high',   equipment: 'box' },
    { name: 'Sprint Intervals',    duration: 8,  calories: 100, intensity: 'high',   equipment: 'none' },
    { name: 'Battle Ropes',        duration: 5,  calories: 60,  intensity: 'high',   equipment: 'ropes' },
    { name: 'Kettlebell Swings',   duration: 5,  calories: 65,  intensity: 'high',   equipment: 'kettlebell' }
  ],
  yoga: [
    { name: 'Sun Salutation',      duration: 5,  calories: 25,  intensity: 'low',    equipment: 'mat' },
    { name: 'Downward Dog',        duration: 2,  calories: 8,   intensity: 'low',    equipment: 'mat' },
    { name: 'Warrior II',          duration: 3,  calories: 12,  intensity: 'low',    equipment: 'mat' },
    { name: 'Tree Pose',           duration: 2,  calories: 6,   intensity: 'low',    equipment: 'mat' },
    { name: 'Child Pose',          duration: 2,  calories: 4,   intensity: 'low',    equipment: 'mat' },
    { name: 'Cat-Cow Stretch',     duration: 3,  calories: 8,   intensity: 'low',    equipment: 'mat' },
    { name: 'Pigeon Pose',         duration: 3,  calories: 10,  intensity: 'low',    equipment: 'mat' }
  ],
  mobility: [
    { name: 'Arm Circles',         duration: 2,  calories: 5,   intensity: 'low',    equipment: 'none' },
    { name: 'Hip Circles',         duration: 2,  calories: 6,   intensity: 'low',    equipment: 'none' },
    { name: 'Leg Swings',          duration: 2,  calories: 8,   intensity: 'low',    equipment: 'none' },
    { name: 'Neck Rolls',          duration: 1,  calories: 3,   intensity: 'low',    equipment: 'none' },
    { name: 'Ankle Rotations',     duration: 1,  calories: 3,   intensity: 'low',    equipment: 'none' },
    { name: 'Torso Twists',        duration: 2,  calories: 6,   intensity: 'low',    equipment: 'none' }
  ]
};

// ============================================================
// GOAL → WORKOUT TEMPLATE
// ============================================================
const GOAL_TEMPLATES = {
  lose_weight: {
    label: 'Weight Loss',
    mix: { cardio: 3, hiit: 1, core: 1 },  // 3 cardio, 1 hiit, 1 core = 5 exercises
    restSeconds: 30,
    focus: 'Burn calories & boost metabolism',
    tip: 'Keep rest short and heart rate elevated'
  },
  gain_muscle: {
    label: 'Muscle Building',
    mix: { strength: 4, core: 1 },
    restSeconds: 60,
    focus: 'Build strength & muscle mass',
    tip: 'Focus on controlled reps and full range of motion'
  },
  stay_fit: {
    label: 'General Fitness',
    mix: { cardio: 2, strength: 2, core: 1 },
    restSeconds: 45,
    focus: 'Balanced workout for overall health',
    tip: 'Mix intensity to keep it interesting'
  },
  endurance: {
    label: 'Endurance',
    mix: { cardio: 4, hiit: 1 },
    restSeconds: 40,
    focus: 'Improve stamina & cardiovascular capacity',
    tip: 'Aim for steady breathing throughout'
  },
  flexibility: {
    label: 'Flexibility & Recovery',
    mix: { yoga: 4, mobility: 2 },
    restSeconds: 20,
    focus: 'Improve mobility & reduce tension',
    tip: 'Breathe deeply into every stretch'
  }
};

// ============================================================
// INTENSITY MULTIPLIER BY ENERGY LEVEL
// ============================================================
const ENERGY_PREFERENCE = {
  low:    { avoidIntensity: ['high'],        repsMultiplier: 0.7 },
  medium: { avoidIntensity: [],              repsMultiplier: 1.0 },
  high:   { preferIntensity: ['high','medium'], repsMultiplier: 1.3 }
};

// ============================================================
// CORE: buildWorkout()
// ============================================================
function buildWorkout({ goal, minutes, energy, equipment, user }) {
  const template = GOAL_TEMPLATES[goal] || GOAL_TEMPLATES.stay_fit;
  const energyPref = ENERGY_PREFERENCE[energy] || ENERGY_PREFERENCE.medium;

  // Flatten candidates from the mix, filtered by available equipment & energy
  const candidates = [];
  for (const [cat, count] of Object.entries(template.mix)) {
    const pool = (EXERCISE_DB[cat] || []).filter(ex =>
      equipmentOk(ex.equipment, equipment) &&
      energyOk(ex.intensity, energyPref)
    );

    // shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count && i < shuffled.length; i++) {
      candidates.push({ ...shuffled[i], category: cat });
    }
  }

  // Fill remaining slots from any category if we're short
  let slotShort = Object.values(template.mix).reduce((a, b) => a + b, 0) - candidates.length;
  if (slotShort > 0) {
    const backupPool = Object.values(EXERCISE_DB).flat()
      .filter(ex => equipmentOk(ex.equipment, equipment) && energyOk(ex.intensity, energyPref))
      .filter(ex => !candidates.some(c => c.name === ex.name));
    const shuffled = backupPool.sort(() => Math.random() - 0.5);
    for (let i = 0; i < slotShort && i < shuffled.length; i++) {
      candidates.push({ ...shuffled[i], category: 'strength' });
    }
  }

  // Scale total duration to match `minutes`
  const totalBaseDuration = candidates.reduce((s, e) => s + e.duration, 0) || 1;
  const scale = minutes / totalBaseDuration;

  const exercises = candidates.map(ex => {
    const scaledDuration = Math.max(1, Math.round(ex.duration * scale));
    const scaledCalories = Math.round(ex.calories * scale * energyPref.repsMultiplier);
    return {
      name: ex.name,
      category: ex.category,
      duration: scaledDuration,
      calories: scaledCalories,
      intensity: ex.intensity,
      rest: template.restSeconds,
      sets: goal === 'gain_muscle' ? 3 : 2,
      reps: goal === 'gain_muscle' ? '8–12' : '10–15'
    };
  });

  const totalDuration = exercises.reduce((s, e) => s + e.duration, 0) + template.restSeconds * exercises.length / 60;
  const totalCalories = exercises.reduce((s, e) => s + e.calories, 0);

  // Warmup + cooldown
  const warmup = { name: 'Warm-up', duration: 3, calories: 15, category: 'mobility' };
  const cooldown = { name: 'Cool-down Stretch', duration: 3, calories: 10, category: 'mobility' };

  return {
    goal,
    goalLabel: template.label,
    focus: template.focus,
    tip: template.tip,
    energy,
    minutes,
    equipment,
    warmup,
    exercises,
    cooldown,
    totalDuration: Math.round(totalDuration + 6), // +6 for warmup/cooldown
    totalCalories: totalCalories + warmup.calories + cooldown.calories,
    generatedAt: new Date().toISOString(),
    user: user ? { name: user.name, streak: user.streak, level: user.totalPoints > 500 ? 'Advanced' : user.totalPoints > 100 ? 'Intermediate' : 'Beginner' } : null
  };
}

function equipmentOk(exEquip, userEquip) {
  if (userEquip === 'full_gym') return true;
  if (userEquip === 'home_gym') return exEquip === 'none' || exEquip === 'dumbbells' || exEquip === 'mat' || exEquip === 'chair' || exEquip === 'bar';
  return exEquip === 'none'; // bodyweight only
}

function energyOk(exIntensity, pref) {
  if (pref.avoidIntensity?.includes(exIntensity)) return false;
  return true;
}

// ============================================================
// NARRATIVE: natural-language explanation
// ============================================================
function narratePlan(plan) {
  const { goalLabel, focus, minutes, energy, exercises, tip, totalCalories } = plan;
  const lines = [];

  lines.push(`Here's your **${goalLabel}** session for today 💪`);
  lines.push(``);
  lines.push(`⏱ **${minutes} min** · 🔥 ~${totalCalories} kcal · ⚡ Energy: **${energy}**`);
  lines.push(`🎯 Focus: *${focus}*`);
  lines.push(``);
  lines.push(`**Warm-up** — ${plan.warmup.duration} min of light movement`);
  lines.push(``);
  exercises.forEach((ex, i) => {
    const reps = ex.sets ? `${ex.sets}×${ex.reps}` : '';
    lines.push(`**${i + 1}. ${ex.name}** — ${ex.duration} min · ${reps ? reps + ' · ' : ''}${ex.calories} kcal`);
  });
  lines.push(``);
  lines.push(`**Cool-down** — ${plan.cooldown.duration} min of stretching`);
  lines.push(``);
  lines.push(`💡 *Coach tip: ${tip}*`);
  lines.push(``);
  lines.push(`Tap **Start Workout** below to open the planner with this plan ready to go.`);

  return lines.join('\n');
}

// Expose globally
window.AIEngine = { buildWorkout, narratePlan, GOAL_TEMPLATES, EXERCISE_DB };