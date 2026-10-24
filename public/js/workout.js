api.requireAuth();

const elements = {
  stage: document.getElementById('workoutStage'),
  loading: document.getElementById('loadingState'),
  start: document.getElementById('startState'),
  active: document.getElementById('activeState'),
  completion: document.getElementById('completionState'),
  startName: document.getElementById('startWorkoutName'),
  startSummary: document.getElementById('startWorkoutSummary'),
  begin: document.getElementById('beginWorkout'),
  timer: document.getElementById('workoutTimer'),
  phaseLabel: document.getElementById('phaseLabel'),
  currentExercise: document.getElementById('currentExercise'),
  setRepInfo: document.getElementById('setRepInfo'),
  nextExercise: document.getElementById('nextExercise'),
  progress: document.getElementById('workoutProgress'),
  pause: document.getElementById('pauseWorkout'),
  skip: document.getElementById('skipPhase'),
  voice: document.getElementById('voiceToggle'),
  exit: document.getElementById('exitWorkout'),
  completionForm: document.getElementById('completionForm'),
  completionIntro: document.getElementById('completionIntro'),
  completionResult: document.getElementById('completionResult'),
  completionNotes: document.getElementById('completionNotes'),
  completionPhoto: document.getElementById('completionPhoto'),
  photoPreview: document.getElementById('photoPreview'),
  completionStatus: document.getElementById('completionStatus'),
  saveCompletion: document.getElementById('saveCompletion'),
  completionStats: document.getElementById('completionStats'),
  share: document.getElementById('shareWorkout')
};

const CATEGORY_FALLBACKS = ['cardio', 'strength', 'yoga', 'hiit', 'core'];
const state = {
  workout: null,
  exercises: [],
  exerciseIndex: 0,
  setIndex: 0,
  phase: 'ready',
  afterRest: null,
  phaseEndAt: null,
  pausedRemaining: 0,
  timerId: null,
  paused: false,
  transitioning: false,
  finished: false,
  started: false,
  voiceEnabled: true,
  audioContext: null,
  mood: null,
  completionPhoto: null,
  completionResult: null,
  metadataFallback: false
};

function numberOr(value, fallback, minimum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum ? number : fallback;
}

function normaliseExercise(exercise) {
  const source = exercise || {};
  const category = CATEGORY_FALLBACKS.includes(source.category) ? source.category : 'cardio';
  return {
    name: String(source.name || 'Exercise').trim() || 'Exercise',
    category,
    duration: numberOr(source.duration, 1, 0.02),
    calories: numberOr(source.calories, 0, 0),
    sets: Math.max(1, Math.round(numberOr(source.sets, 3, 1))),
    reps: Math.max(0, Math.round(numberOr(source.reps, 10, 0))),
    restSeconds: Math.max(0, Math.round(numberOr(source.restSeconds, 20, 0))),
    workSeconds: numberOr(source.workSeconds, 0, 0)
  };
}

function currentExercise() {
  return state.exercises[state.exerciseIndex];
}

function nextExercise() {
  return state.exercises[state.exerciseIndex + 1];
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return String(minutes).padStart(2, '0') + ':' + remainder;
}

function spokenDuration(totalSeconds) {
  const seconds = Math.max(1, Math.round(totalSeconds));
  if (seconds < 60) return seconds + ' seconds';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes + (minutes === 1 ? ' minute' : ' minutes') + (remainder ? ' ' + remainder + ' seconds' : '');
}

function workSecondsFor(exercise) {
  const total = exercise.workSeconds > 0 ? exercise.workSeconds : exercise.duration * 60;
  return Math.max(1, Math.round(total / exercise.sets));
}

function setDescription(exercise, setIndex) {
  const base = 'Set ' + (setIndex + 1) + ' of ' + exercise.sets;
  return exercise.reps ? base + ' · ' + exercise.reps + ' reps' : base + ' · work at your pace';
}

function showOnly(section) {
  ['loading', 'start', 'active', 'completion'].forEach((name) => {
    elements[name].hidden = name !== section;
  });
}

function clearTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimer() {
  if (state.finished || state.phase === 'ready') return;

  const remaining = state.paused
    ? state.pausedRemaining
    : Math.max(0, Math.ceil((state.phaseEndAt - Date.now()) / 1000));
  elements.timer.textContent = formatTime(remaining);

  if (!state.paused && remaining <= 0) completeCurrentPhase();
}

function updateActiveUi() {
  const exercise = currentExercise();
  if (!exercise) return;

  elements.stage.dataset.phase = state.paused ? 'paused' : state.phase;
  elements.pause.textContent = state.paused ? '▶ Resume' : 'Ⅱ Pause';

  if (state.phase === 'rest') {
    elements.phaseLabel.textContent = 'Recovery';
    elements.currentExercise.textContent = 'Rest and reset';
    elements.setRepInfo.textContent = state.afterRest === 'nextSet'
      ? exercise.name + ' · ' + setDescription(exercise, state.setIndex + 1)
      : 'Next: ' + (nextExercise() ? nextExercise().name : 'finish strong');
    elements.skip.textContent = 'Skip rest';
    elements.nextExercise.textContent = state.afterRest === 'nextSet'
      ? exercise.name + ' · next set'
      : (nextExercise() ? nextExercise().name : 'Finish workout');
  } else {
    elements.phaseLabel.textContent = 'Work set';
    elements.currentExercise.textContent = exercise.name;
    elements.setRepInfo.textContent = setDescription(exercise, state.setIndex);
    elements.skip.textContent = 'Skip set';

    if (state.setIndex + 1 < exercise.sets) {
      elements.nextExercise.textContent = 'Rest ' + exercise.restSeconds + ' sec · ' + exercise.name + ' set ' + (state.setIndex + 2);
    } else if (nextExercise()) {
      elements.nextExercise.textContent = nextExercise().name + (nextExercise().reps ? ' · ' + nextExercise().reps + ' reps' : '');
    } else {
      elements.nextExercise.textContent = 'Finish strong';
    }
  }

  elements.progress.textContent = 'Exercise ' + (state.exerciseIndex + 1) + ' of ' + state.exercises.length;
  updateTimer();
}

function speak(text) {
  if (!state.voiceEnabled || !state.started || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function unlockAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    state.audioContext = state.audioContext || new AudioContextClass();
    if (state.audioContext.state === 'suspended') await state.audioContext.resume();
  } catch {
    state.audioContext = null;
  }
}

function signalPhaseEnd() {
  if (navigator.vibrate) navigator.vibrate([120, 70, 180]);
  if (!state.audioContext) return;
  try {
    const context = state.audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .36);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .38);
  } catch {
    // A blocked audio output should not interrupt the workout.
  }
}

function beginCountdown(seconds) {
  clearTimer();
  state.paused = false;
  state.pausedRemaining = 0;
  state.phaseEndAt = Date.now() + Math.max(1, seconds) * 1000;
  updateActiveUi();
  state.timerId = window.setInterval(updateTimer, 250);
}

function startWorkPhase() {
  const exercise = currentExercise();
  if (!exercise) {
    finishWorkout();
    return;
  }
  state.phase = 'work';
  state.afterRest = null;
  const seconds = workSecondsFor(exercise);
  beginCountdown(seconds);
  speak('Starting ' + exercise.name + '. ' + spokenDuration(seconds) + '. ' + setDescription(exercise, state.setIndex) + '.');
}

function startRestPhase(nextAction) {
  const exercise = currentExercise();
  state.phase = 'rest';
  state.afterRest = nextAction;
  const seconds = exercise.restSeconds;

  if (seconds <= 0) {
    advanceAfterRest();
    return;
  }

  beginCountdown(seconds);
  const nextText = nextAction === 'nextSet'
    ? 'Then repeat ' + exercise.name + '.'
    : (nextExercise() ? 'Then move to ' + nextExercise().name + '.' : 'Then you are done.');
  speak('Rest for ' + spokenDuration(seconds) + '. ' + nextText);
}

function advanceAfterWork() {
  const exercise = currentExercise();
  if (state.setIndex + 1 < exercise.sets) {
    startRestPhase('nextSet');
    return;
  }
  if (nextExercise()) {
    startRestPhase('nextExercise');
    return;
  }
  finishWorkout();
}

function advanceAfterRest() {
  if (state.afterRest === 'nextSet') {
    state.setIndex += 1;
  } else if (state.afterRest === 'nextExercise') {
    state.exerciseIndex += 1;
    state.setIndex = 0;
  }
  startWorkPhase();
}

function completeCurrentPhase() {
  if (state.transitioning || state.finished) return;
  state.transitioning = true;
  clearTimer();
  signalPhaseEnd();

  if (state.phase === 'work') {
    advanceAfterWork();
  } else if (state.phase === 'rest') {
    advanceAfterRest();
  }

  window.setTimeout(() => {
    state.transitioning = false;
  }, 100);
}

function togglePause() {
  if (state.finished || state.phase === 'ready') return;
  if (state.paused) {
    state.paused = false;
    state.phaseEndAt = Date.now() + Math.max(1, state.pausedRemaining) * 1000;
    state.timerId = window.setInterval(updateTimer, 250);
    updateActiveUi();
    speak('Resuming.');
    return;
  }

  state.pausedRemaining = Math.max(1, Math.ceil((state.phaseEndAt - Date.now()) / 1000));
  state.paused = true;
  clearTimer();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  updateActiveUi();
}

function skipPhase() {
  if (state.finished || state.phase === 'ready') return;
  state.paused = false;
  completeCurrentPhase();
}

function finishWorkout() {
  clearTimer();
  state.finished = true;
  state.phase = 'finished';
  state.phaseEndAt = null;
  showOnly('completion');
  speak('Great job. Your workout is complete.');
}

function selectMood(mood) {
  state.mood = mood;
  document.querySelectorAll('[data-mood]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mood === mood));
  });
}

function waitForImage(image) {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('That image could not be read.'));
  });
}

async function compressPhoto(file) {
  if (!file) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > 6 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 6 MB.');
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.src = objectUrl;
  try {
    await waitForImage(image);
    const maxSide = 1080;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', .8);
    if (dataUrl.length > Math.floor(1.5 * 1024 * 1024)) {
      throw new Error('That image is still too large after compression. Choose a smaller photo.');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function unsyncedCompletionKey() {
  return 'fp_unsynced_completion_' + (state.workout && state.workout._id);
}

async function saveCompletion(event) {
  event.preventDefault();
  elements.saveCompletion.disabled = true;
  elements.completionStatus.textContent = 'Saving your win…';

  const payload = {
    completionNotes: elements.completionNotes.value.trim(),
    completionMood: state.mood,
    completionPhoto: state.completionPhoto
  };

  let result;
  try {
    result = await api.patch('/workouts/' + encodeURIComponent(state.workout._id) + '/complete', payload);
  } catch (metadataError) {
    // Older deployments can still mark the workout complete even before metadata columns arrive.
    try {
      localStorage.setItem(unsyncedCompletionKey(), JSON.stringify(payload));
    } catch {
      // Completion itself remains more important than retaining an unsynced memory.
    }
    try {
      result = await api.patch('/workouts/' + encodeURIComponent(state.workout._id) + '/complete', {});
      state.metadataFallback = true;
    } catch (completionError) {
      elements.saveCompletion.disabled = false;
      elements.completionStatus.textContent = completionError.message || metadataError.message;
      return;
    }
  }

  state.completionResult = result || {};
  elements.completionForm.classList.add('hidden');
  elements.completionIntro.classList.add('hidden');
  elements.completionResult.classList.add('visible');

  const user = state.completionResult.user || {};
  const streak = Number(user.streak || 0);
  const points = Number(user.totalPoints || 0);
  elements.completionStats.textContent = state.metadataFallback
    ? 'Workout complete. Your note and photo are kept on this device until this app finishes syncing them.'
    : 'Streak: ' + streak + ' days · Points: ' + points;
  elements.completionStatus.textContent = '';
}

function cssVariable(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? line + ' ' + word : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawShareCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext('2d');
  const primary = cssVariable('--primary', '#c8ff45');
  const accent = cssVariable('--accent', '#6edcff');
  const background = cssVariable('--bg', '#080a0f');
  const workoutName = state.workout.notes || 'Workout';
  const user = state.completionResult && state.completionResult.user ? state.completionResult.user : {};

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, accent);
  context.fillStyle = gradient;
  context.globalAlpha = .18;
  context.beginPath();
  context.arc(900, 180, 370, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = primary;
  context.font = '800 42px Inter, Arial, sans-serif';
  context.fillText('FITPULSE  •  WORKOUT COMPLETE', 82, 118);
  context.fillStyle = '#f5f7fb';
  context.font = '900 94px Inter, Arial, sans-serif';
  let y = 290;
  wrapCanvasText(context, workoutName, 860).slice(0, 3).forEach((line) => {
    context.fillText(line, 82, y);
    y += 108;
  });

  context.fillStyle = '#9aa5b5';
  context.font = '600 38px Inter, Arial, sans-serif';
  context.fillText('I just crushed a FitPulse workout.', 82, 645);
  context.fillStyle = '#f5f7fb';
  context.font = '800 48px Inter, Arial, sans-serif';
  context.fillText(String(state.workout.totalDuration || 0) + ' min  •  ' + String(state.workout.totalCalories || 0) + ' kcal', 82, 730);
  context.fillStyle = primary;
  context.font = '900 116px Inter, Arial, sans-serif';
  context.fillText('🔥 ' + String(user.streak || 0) + '-day streak', 82, 890);
  context.fillStyle = '#9aa5b5';
  context.font = '700 31px Inter, Arial, sans-serif';
  context.fillText('fitpulse • keep your momentum', 82, 982);
  return canvas;
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareWorkout() {
  elements.share.disabled = true;
  const original = elements.share.textContent;
  elements.share.textContent = 'Creating image…';

  try {
    const blob = await canvasBlob(drawShareCanvas());
    if (!blob) throw new Error('Could not create the share image.');
    const file = new File([blob], 'fitpulse-workout.png', { type: 'image/png' });
    const title = 'FitPulse workout complete';
    const text = 'I just completed ' + (state.workout.notes || 'a workout') + ' on FitPulse.';

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ title, text, files: [file] });
        elements.completionStats.textContent = 'Share sheet opened — nice work.';
      } catch (error) {
        if (error && error.name !== 'AbortError') throw error;
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fitpulse-workout.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      elements.completionStats.textContent = 'Your share image has been downloaded.';
    }
  } catch (error) {
    elements.completionStats.textContent = error.message || 'Could not create the share image.';
  } finally {
    elements.share.disabled = false;
    elements.share.textContent = original;
  }
}

async function loadWorkout() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    elements.loading.innerHTML = '<p class="workout-eyebrow">Workout mode</p><h1>No workout selected</h1><p>Return to the planner and choose Start on a saved workout.</p>';
    return;
  }

  try {
    const workouts = await api.get('/workouts');
    const workout = workouts.find((item) => String(item._id) === String(id));
    if (!workout) throw new Error('Workout not found.');

    state.workout = workout;
    state.exercises = (workout.exercises || []).map(normaliseExercise);
    if (!state.exercises.length) throw new Error('This workout has no exercises.');

    elements.startName.textContent = workout.notes || 'Your workout is ready';
    elements.startSummary.textContent = state.exercises.length + ' exercises · ' + Number(workout.totalDuration || 0) + ' min · ' + Number(workout.totalCalories || 0) + ' kcal';

    if (workout.completed) {
      elements.startSummary.textContent = 'This workout is already complete. Choose another one from your planner.';
      elements.begin.hidden = true;
    }

    showOnly('start');
  } catch (error) {
    elements.loading.innerHTML = '<p class="workout-eyebrow">Workout mode</p><h1>Could not open this workout</h1><p>' + esc(error.message || 'Please return to the planner and try again.') + '</p>';
  }
}

elements.begin.addEventListener('click', async () => {
  if (!state.workout || state.workout.completed) return;
  state.started = true;
  await unlockAudio();
  showOnly('active');
  startWorkPhase();
});

elements.pause.addEventListener('click', togglePause);
elements.skip.addEventListener('click', skipPhase);
elements.completionForm.addEventListener('submit', saveCompletion);
elements.share.addEventListener('click', shareWorkout);

elements.voice.addEventListener('click', () => {
  state.voiceEnabled = !state.voiceEnabled;
  elements.voice.setAttribute('aria-pressed', String(state.voiceEnabled));
  elements.voice.textContent = state.voiceEnabled ? '🔊 Voice on' : '🔇 Voice off';
  if (!state.voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
});

document.querySelectorAll('[data-mood]').forEach((button) => {
  button.addEventListener('click', () => selectMood(button.dataset.mood));
});

elements.completionPhoto.addEventListener('change', async () => {
  const file = elements.completionPhoto.files && elements.completionPhoto.files[0];
  elements.completionStatus.textContent = '';
  if (!file) {
    state.completionPhoto = null;
    elements.photoPreview.removeAttribute('src');
    elements.photoPreview.classList.remove('visible');
    return;
  }

  try {
    elements.completionStatus.textContent = 'Preparing photo…';
    state.completionPhoto = await compressPhoto(file);
    elements.photoPreview.src = state.completionPhoto;
    elements.photoPreview.classList.add('visible');
    elements.completionStatus.textContent = 'Photo ready to save.';
  } catch (error) {
    state.completionPhoto = null;
    elements.completionPhoto.value = '';
    elements.photoPreview.removeAttribute('src');
    elements.photoPreview.classList.remove('visible');
    elements.completionStatus.textContent = error.message;
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !state.paused) updateTimer();
});

elements.exit.addEventListener('click', (event) => {
  if (!state.started || state.finished) return;
  if (!confirm('Leave this workout? Your active timer will stop.')) event.preventDefault();
});

window.addEventListener('pagehide', () => {
  clearTimer();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
});

if (!('speechSynthesis' in window)) {
  state.voiceEnabled = false;
  elements.voice.disabled = true;
  elements.voice.textContent = 'Voice unavailable';
}

loadWorkout();
