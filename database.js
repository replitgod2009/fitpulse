const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const defaultDataDirectory = process.env.RENDER === 'true'
  ? '/var/data'
  : path.join(__dirname, 'data');
const dataDirectory = process.env.DATA_DIR || defaultDataDirectory;
const configuredDatabasePath = process.env.DB_FILE || path.join(dataDirectory, 'fitpulse.sqlite');
const databasePath = path.resolve(configuredDatabasePath);

// On Render this resolves to /var/data/fitpulse.sqlite, the mounted persistent disk.
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
console.log('🗄️ FitPulse database: ' + databasePath);
const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password TEXT NOT NULL,
    age INTEGER,
    weight REAL,
    height REAL,
    fitness_goal TEXT NOT NULL DEFAULT 'stay_fit',
    activity_level TEXT NOT NULL DEFAULT 'moderate',
    streak INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    badges TEXT NOT NULL DEFAULT '[]',
    last_workout_date TEXT,
    streak_freezes INTEGER NOT NULL DEFAULT 0,
    freeze_week_key TEXT,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    exercises TEXT NOT NULL DEFAULT '[]',
    total_duration INTEGER NOT NULL DEFAULT 0,
    total_calories INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    completion_notes TEXT,
    completion_mood TEXT,
    completion_photo TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    date TEXT NOT NULL,
    water_intake REAL NOT NULL DEFAULT 0,
    sleep_hours REAL NOT NULL DEFAULT 0,
    steps INTEGER NOT NULL DEFAULT 0,
    mood TEXT NOT NULL DEFAULT 'good',
    UNIQUE (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_low_id INTEGER NOT NULL,
    user_high_id INTEGER NOT NULL,
    requested_by_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    CHECK (user_low_id < user_high_id),
    CHECK (requested_by_id = user_low_id OR requested_by_id = user_high_id),
    UNIQUE (user_low_id, user_high_id),
    FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    serving TEXT NOT NULL DEFAULT '',
    calories REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fat REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS daily_rewards (
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    base_points INTEGER NOT NULL DEFAULT 0,
    perfect_awarded INTEGER NOT NULL DEFAULT 0,
    awarded_at TEXT,
    PRIMARY KEY (user_id, day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS activities_user_date_idx ON activities(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS friendships_user_low_status_idx ON friendships(user_low_id, status);
  CREATE INDEX IF NOT EXISTS friendships_user_high_status_idx ON friendships(user_high_id, status);
  CREATE INDEX IF NOT EXISTS meals_user_day_idx ON meals(user_id, day DESC);
  CREATE INDEX IF NOT EXISTS daily_rewards_user_day_idx ON daily_rewards(user_id, day DESC);
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some(column => column.name === columnName)) return;

  try {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    // Two app instances can initialize against the same SQLite file at once.
    // If the other instance won the migration race, the desired schema exists.
    if (!/duplicate column name/i.test(error.message)) throw error;
  }
}

// CREATE TABLE IF NOT EXISTS does not upgrade databases created by older builds.
ensureColumn('workouts', 'completed_at', 'TEXT');
ensureColumn('workouts', 'completion_notes', 'TEXT');
ensureColumn('workouts', 'completion_mood', 'TEXT');
ensureColumn('workouts', 'completion_photo', 'TEXT');
ensureColumn('users', 'streak_freezes', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'freeze_week_key', 'TEXT');
ensureColumn('users', 'longest_streak', 'INTEGER NOT NULL DEFAULT 0');

// Backfill the best available date for workouts completed before completed_at existed.
database.prepare(`
  UPDATE workouts
  SET completed_at = date
  WHERE completed = 1 AND (completed_at IS NULL OR completed_at = '')
`).run();

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKeyToUtc(day) {
  const parts = String(day || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function calendarDayDistance(fromDay, toDay) {
  const from = dayKeyToUtc(fromDay);
  const to = dayKeyToUtc(toDay);
  if (from == null || to == null) return null;
  return Math.round((to - from) / 86400000);
}

function weekKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  // ISO weeks make the once-per-week freeze rule stable across a Sunday boundary.
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function calculateWorkoutPoints(workout) {
  return Math.max(10, Math.round((Number(workout?.total_calories) || 0) / 10) + 10);
}

function statusError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasPerfectDayReward(userId, day = localDayKey()) {
  const reward = database.prepare(`
    SELECT perfect_awarded
    FROM daily_rewards
    WHERE user_id = ? AND day = ?
  `).get(Number(userId), day);
  return Boolean(reward?.perfect_awarded);
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    _id: String(row.id),
    name: row.name,
    email: row.email,
    age: row.age,
    weight: row.weight,
    height: row.height,
    fitnessGoal: row.fitness_goal,
    activityLevel: row.activity_level,
    streak: row.streak,
    totalPoints: row.total_points,
    badges: parseJson(row.badges, []),
    lastWorkoutDate: row.last_workout_date,
    streakFreezes: Number(row.streak_freezes) || 0,
    freezeClaimedThisWeek: row.freeze_week_key === weekKey(),
    longestStreak: Math.max(Number(row.longest_streak) || 0, Number(row.streak) || 0),
    perfectDayToday: hasPerfectDayReward(row.id),
    createdAt: row.created_at
  };
}

function toWorkout(row) {
  return {
    _id: String(row.id),
    user: String(row.user_id),
    date: row.date,
    exercises: parseJson(row.exercises, []),
    totalDuration: row.total_duration,
    totalCalories: row.total_calories,
    notes: row.notes,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || null,
    completionNotes: row.completion_notes || '',
    completionMood: row.completion_mood || null,
    completionPhoto: row.completion_photo || null
  };
}

function toMeal(row) {
  return {
    _id: String(row.id),
    user: String(row.user_id),
    day: row.day,
    date: row.date,
    name: row.name,
    serving: row.serving || '',
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0
  };
}

function toActivity(row) {
  return {
    _id: String(row.id),
    user: String(row.user_id),
    day: row.day,
    date: row.date,
    waterIntake: row.water_intake,
    sleepHours: row.sleep_hours,
    steps: row.steps,
    mood: row.mood
  };
}

function findUserByEmail(email) {
  return database.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
}

function findUserById(id) {
  return database.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
}

function createUser({ name, email, password, age, weight, height, fitnessGoal, activityLevel }) {
  const result = database.prepare(`
    INSERT INTO users (name, email, password, age, weight, height, fitness_goal, activity_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    email.toLowerCase().trim(),
    password,
    age ?? null,
    weight ?? null,
    height ?? null,
    fitnessGoal || 'stay_fit',
    activityLevel || 'moderate'
  );
  return findUserById(result.lastInsertRowid);
}

function getWorkouts(userId) {
  return database.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC').all(Number(userId)).map(toWorkout);
}

function createWorkout(userId, payload) {
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  const result = database.prepare(`
    INSERT INTO workouts (user_id, date, exercises, total_duration, total_calories, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    Number(userId),
    new Date().toISOString(),
    JSON.stringify(exercises),
    Number(payload.totalDuration) || 0,
    Number(payload.totalCalories) || 0,
    payload.notes || ''
  );
  return toWorkout(database.prepare('SELECT * FROM workouts WHERE id = ?').get(result.lastInsertRowid));
}

function normalizeCompletionPayload(payload = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  const completionNotes = has('completionNotes')
    ? String(payload.completionNotes || '').trim().slice(0, 1200)
    : undefined;
  let completionMood;
  if (has('completionMood')) {
    completionMood = payload.completionMood ? String(payload.completionMood).toLowerCase() : null;
    if (completionMood && !['energized', 'fine', 'exhausted'].includes(completionMood)) {
      throw statusError('Choose a valid post-workout mood.');
    }
  }

  let completionPhoto;
  if (has('completionPhoto')) {
    completionPhoto = payload.completionPhoto || null;
    if (completionPhoto && (
      typeof completionPhoto !== 'string'
      || completionPhoto.length > 1600000
      || !/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(completionPhoto)
    )) {
      throw statusError('Workout photos must be a compressed JPG, PNG, or WebP under 1 MB.');
    }
  }
  return { completionNotes, completionMood, completionPhoto };
}

function claimPerfectDayBonus(userId, day) {
  const existing = database.prepare(`
    SELECT perfect_awarded FROM daily_rewards WHERE user_id = ? AND day = ?
  `).get(Number(userId), day);
  if (existing?.perfect_awarded) return { awarded: false, bonusPoints: 0 };

  const activity = database.prepare(`
    SELECT water_intake, sleep_hours, steps FROM activities WHERE user_id = ? AND day = ?
  `).get(Number(userId), day);
  if (!activity || Number(activity.water_intake) < 8 || Number(activity.sleep_hours) < 7 || Number(activity.steps) < 6000) {
    return { awarded: false, bonusPoints: 0 };
  }

  const completedToday = database.prepare(`
    SELECT total_calories, completed_at, date FROM workouts WHERE user_id = ? AND completed = 1
  `).all(Number(userId)).filter((workout) => localDayKey(workout.completed_at || workout.date) === day);
  if (!completedToday.length) return { awarded: false, bonusPoints: 0 };

  const bonusPoints = completedToday.reduce((sum, workout) => sum + calculateWorkoutPoints(workout), 0);
  const result = database.prepare(`
    INSERT INTO daily_rewards (user_id, day, base_points, perfect_awarded, awarded_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(user_id, day) DO UPDATE SET
      base_points = excluded.base_points,
      perfect_awarded = 1,
      awarded_at = excluded.awarded_at
    WHERE daily_rewards.perfect_awarded = 0
  `).run(Number(userId), day, bonusPoints, new Date().toISOString());
  return result.changes ? { awarded: true, bonusPoints } : { awarded: false, bonusPoints: 0 };
}

function completeWorkout(userId, workoutId, payload = {}) {
  const numericUserId = Number(userId);
  const numericWorkoutId = Number(workoutId);
  const workoutRow = database.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(numericWorkoutId, numericUserId);
  if (!workoutRow) return null;

  const completion = normalizeCompletionPayload(payload);
  const now = new Date();
  const completedAt = workoutRow.completed_at || now.toISOString();
  const today = localDayKey(now);

  database.exec('BEGIN');
  try {
    database.prepare(`
      UPDATE workouts
      SET completed = 1,
          completed_at = COALESCE(completed_at, ?),
          completion_notes = CASE WHEN ? THEN ? ELSE completion_notes END,
          completion_mood = CASE WHEN ? THEN ? ELSE completion_mood END,
          completion_photo = CASE WHEN ? THEN ? ELSE completion_photo END
      WHERE id = ? AND user_id = ?
    `).run(
      completedAt,
      completion.completionNotes !== undefined ? 1 : 0, completion.completionNotes,
      completion.completionMood !== undefined ? 1 : 0, completion.completionMood,
      completion.completionPhoto !== undefined ? 1 : 0, completion.completionPhoto,
      numericWorkoutId, numericUserId
    );

    const user = findUserById(numericUserId);
    let streak = Number(user.streak) || 0;
    let totalPoints = Number(user.total_points) || 0;
    let streakFreezes = Number(user.streak_freezes) || 0;
    let longestStreak = Math.max(Number(user.longest_streak) || 0, streak);
    let badges = parseJson(user.badges, []);
    let lastWorkoutDate = user.last_workout_date;
    let freezeUsed = false;

    if (!workoutRow.completed) {
      const lastDay = lastWorkoutDate ? localDayKey(lastWorkoutDate) : null;
      if (lastDay !== today) {
        const gap = lastDay ? calendarDayDistance(lastDay, today) : null;
        if (gap === 1) {
          streak += 1;
        } else if (gap === 2 && streakFreezes > 0) {
          streak += 1;
          streakFreezes -= 1;
          freezeUsed = true;
        } else {
          streak = 1;
        }
        lastWorkoutDate = now.toISOString();
        totalPoints += calculateWorkoutPoints(workoutRow);
      }
      longestStreak = Math.max(longestStreak, streak);
    }

    const perfectDay = claimPerfectDayBonus(numericUserId, today);
    if (perfectDay.awarded) {
      totalPoints += perfectDay.bonusPoints;
      if (!badges.includes('Perfect Day')) badges.push('Perfect Day');
    }
    if (freezeUsed && !badges.includes('Frozen but Focused')) badges.push('Frozen but Focused');
    if (streak >= 7 && !badges.includes('Week Warrior')) badges.push('Week Warrior');
    if (streak >= 30 && !badges.includes('Monthly Master')) badges.push('Monthly Master');
    if (totalPoints >= 1000 && !badges.includes('Point Hunter')) badges.push('Point Hunter');

    database.prepare(`
      UPDATE users
      SET streak = ?, total_points = ?, badges = ?, last_workout_date = ?,
          streak_freezes = ?, longest_streak = ?
      WHERE id = ?
    `).run(streak, totalPoints, JSON.stringify(badges), lastWorkoutDate, streakFreezes, longestStreak, numericUserId);

    database.exec('COMMIT');
    const updatedUser = findUserById(numericUserId);
    return {
      workout: toWorkout(database.prepare('SELECT * FROM workouts WHERE id = ?').get(numericWorkoutId)),
      user: toPublicUser(updatedUser),
      perfectDay,
      freezeUsed
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function deleteWorkout(userId, workoutId) {
  database.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(Number(workoutId), Number(userId));
}

function getActivities(userId) {
  return database.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC').all(Number(userId)).map(toActivity);
}

function upsertActivity(userId, { waterIntake, sleepHours, steps, mood }) {
  const numericUserId = Number(userId);
  const now = new Date();
  const day = localDayKey(now);
  database.exec('BEGIN');
  try {
    database.prepare(`
      INSERT INTO activities (user_id, day, date, water_intake, sleep_hours, steps, mood)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, day) DO UPDATE SET
        date = excluded.date,
        water_intake = excluded.water_intake,
        sleep_hours = excluded.sleep_hours,
        steps = excluded.steps,
        mood = excluded.mood
    `).run(
      numericUserId,
      day,
      now.toISOString(),
      Math.max(0, Number(waterIntake) || 0),
      Math.max(0, Number(sleepHours) || 0),
      Math.max(0, Math.round(Number(steps) || 0)),
      ['great', 'good', 'okay', 'tired'].includes(mood) ? mood : 'good'
    );

    const perfectDay = claimPerfectDayBonus(numericUserId, day);
    if (perfectDay.awarded) {
      const user = findUserById(numericUserId);
      const badges = parseJson(user.badges, []);
      if (!badges.includes('Perfect Day')) badges.push('Perfect Day');
      database.prepare(`
        UPDATE users SET total_points = ?, badges = ? WHERE id = ?
      `).run((Number(user.total_points) || 0) + perfectDay.bonusPoints, JSON.stringify(badges), numericUserId);
    }

    database.exec('COMMIT');
    const activity = toActivity(database.prepare('SELECT * FROM activities WHERE user_id = ? AND day = ?').get(numericUserId, day));
    activity.perfectDayAwarded = perfectDay.awarded;
    activity.perfectDayBonus = perfectDay.bonusPoints;
    return activity;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function getLeaderboard() {
  return database.prepare(`
    SELECT name, total_points, streak, badges
    FROM users
    ORDER BY total_points DESC, created_at ASC
    LIMIT 20
  `).all().map(row => ({
    name: row.name,
    totalPoints: row.total_points,
    streak: row.streak,
    badges: parseJson(row.badges, [])
  }));
}

function getMeals(userId) {
  return database.prepare(`
    SELECT * FROM meals WHERE user_id = ? ORDER BY date DESC, id DESC
  `).all(Number(userId)).map(toMeal);
}

function createMeal(userId, payload) {
  const now = new Date();
  const result = database.prepare(`
    INSERT INTO meals (user_id, day, date, name, serving, calories, protein, carbs, fat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(userId),
    localDayKey(now),
    now.toISOString(),
    String(payload.name || '').trim().slice(0, 120),
    String(payload.serving || '').trim().slice(0, 80),
    Math.max(0, Number(payload.calories) || 0),
    Math.max(0, Number(payload.protein) || 0),
    Math.max(0, Number(payload.carbs) || 0),
    Math.max(0, Number(payload.fat) || 0)
  );
  return toMeal(database.prepare('SELECT * FROM meals WHERE id = ?').get(result.lastInsertRowid));
}

function deleteMeal(userId, mealId) {
  database.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(Number(mealId), Number(userId));
}

function claimStreakFreeze(userId, action) {
  const numericUserId = Number(userId);
  const user = findUserById(numericUserId);
  if (!user) throw statusError('User not found.', 404);
  if (!['claim', 'buy'].includes(action)) throw statusError('Choose a valid streak-freeze action.');
  const currentWeek = weekKey();
  if (user.freeze_week_key === currentWeek) {
    throw statusError('You have already earned a Streak Freeze this week.', 409);
  }
  const freezeCount = Number(user.streak_freezes) || 0;
  if (freezeCount >= 3) throw statusError('Use a Streak Freeze before adding another one.', 409);
  let totalPoints = Number(user.total_points) || 0;
  if (action === 'buy') {
    if (totalPoints < 150) throw statusError('You need 150 points to buy a Streak Freeze.', 400);
    totalPoints -= 150;
  }
  database.prepare(`
    UPDATE users
    SET streak_freezes = ?, freeze_week_key = ?, total_points = ?
    WHERE id = ?
  `).run(freezeCount + 1, currentWeek, totalPoints, numericUserId);
  const updatedUser = toPublicUser(findUserById(numericUserId));
  return {
    user: updatedUser,
    msg: action === 'buy' ? 'Streak Freeze purchased for 150 points.' : 'Weekly Streak Freeze claimed.'
  };
}
function socialError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toFriendSummary(row) {
  return {
    _id: String(row.user_id),
    name: row.name,
    totalPoints: row.total_points,
    streak: row.streak,
    badges: parseJson(row.badges, [])
  };
}

function toFriendRequest(row, viewerId) {
  return {
    id: String(row.request_id),
    status: row.status,
    direction: Number(row.requested_by_id) === Number(viewerId) ? 'outgoing' : 'incoming',
    createdAt: row.created_at,
    respondedAt: row.responded_at || null,
    user: toFriendSummary(row)
  };
}

function getFriendRequestForViewer(requestId, viewerId) {
  return database.prepare(`
    SELECT
      f.id AS request_id,
      f.status,
      f.created_at,
      f.responded_at,
      f.requested_by_id,
      u.id AS user_id,
      u.name,
      u.total_points,
      u.streak,
      u.badges
    FROM friendships f
    JOIN users u ON u.id = CASE
      WHEN f.user_low_id = ? THEN f.user_high_id
      ELSE f.user_low_id
    END
    WHERE f.id = ?
      AND (f.user_low_id = ? OR f.user_high_id = ?)
  `).get(Number(viewerId), Number(requestId), Number(viewerId), Number(viewerId));
}

function createFriendRequest(userId, email) {
  const requesterId = Number(userId);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const recipient = findUserByEmail(normalizedEmail);

  if (!recipient) throw socialError('No FitPulse account was found for that email.', 404);
  if (recipient.id === requesterId) throw socialError('You cannot send a friend request to yourself.', 400);

  const userLowId = Math.min(requesterId, recipient.id);
  const userHighId = Math.max(requesterId, recipient.id);
  const existing = database.prepare(`
    SELECT id, status
    FROM friendships
    WHERE user_low_id = ? AND user_high_id = ?
  `).get(userLowId, userHighId);

  let requestId;
  if (existing) {
    if (existing.status === 'accepted') throw socialError('You are already friends.', 409);
    if (existing.status === 'pending') throw socialError('A friend request is already pending.', 409);

    database.prepare(`
      UPDATE friendships
      SET requested_by_id = ?, status = 'pending', created_at = ?, responded_at = NULL
      WHERE id = ?
    `).run(requesterId, new Date().toISOString(), existing.id);
    requestId = existing.id;
  } else {
    try {
      const result = database.prepare(`
        INSERT INTO friendships (user_low_id, user_high_id, requested_by_id, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(userLowId, userHighId, requesterId, new Date().toISOString());
      requestId = Number(result.lastInsertRowid);
    } catch (error) {
      if (/UNIQUE constraint failed: friendships\.user_low_id, friendships\.user_high_id/i.test(error.message)) {
        throw socialError('A friend request is already pending.', 409);
      }
      throw error;
    }
  }

  return toFriendRequest(getFriendRequestForViewer(requestId, requesterId), requesterId);
}

function getFriends(userId) {
  const viewerId = Number(userId);
  const friends = database.prepare(`
    SELECT u.id AS user_id, u.name, u.total_points, u.streak, u.badges
    FROM friendships f
    JOIN users u ON u.id = CASE
      WHEN f.user_low_id = ? THEN f.user_high_id
      ELSE f.user_low_id
    END
    WHERE f.status = 'accepted'
      AND (f.user_low_id = ? OR f.user_high_id = ?)
    ORDER BY LOWER(u.name) ASC
  `).all(viewerId, viewerId, viewerId).map(toFriendSummary);

  const incoming = database.prepare(`
    SELECT
      f.id AS request_id,
      f.status,
      f.created_at,
      f.responded_at,
      f.requested_by_id,
      u.id AS user_id,
      u.name,
      u.total_points,
      u.streak,
      u.badges
    FROM friendships f
    JOIN users u ON u.id = f.requested_by_id
    WHERE f.status = 'pending'
      AND f.requested_by_id != ?
      AND (f.user_low_id = ? OR f.user_high_id = ?)
    ORDER BY f.created_at DESC
  `).all(viewerId, viewerId, viewerId).map(row => toFriendRequest(row, viewerId));

  const outgoing = database.prepare(`
    SELECT
      f.id AS request_id,
      f.status,
      f.created_at,
      f.responded_at,
      f.requested_by_id,
      u.id AS user_id,
      u.name,
      u.total_points,
      u.streak,
      u.badges
    FROM friendships f
    JOIN users u ON u.id = CASE
      WHEN f.user_low_id = ? THEN f.user_high_id
      ELSE f.user_low_id
    END
    WHERE f.status = 'pending' AND f.requested_by_id = ?
    ORDER BY f.created_at DESC
  `).all(viewerId, viewerId).map(row => toFriendRequest(row, viewerId));

  return { friends, incoming, outgoing };
}

function respondToFriendRequest(userId, requestId, action) {
  const viewerId = Number(userId);
  const numericRequestId = Number(requestId);
  if (!Number.isSafeInteger(numericRequestId) || numericRequestId < 1) {
    throw socialError('Invalid friend request.', 400);
  }
  if (!['accept', 'decline'].includes(action)) {
    throw socialError('Choose either accept or decline.', 400);
  }

  const request = database.prepare(`
    SELECT id, requested_by_id, status
    FROM friendships
    WHERE id = ? AND (user_low_id = ? OR user_high_id = ?)
  `).get(numericRequestId, viewerId, viewerId);

  if (!request) throw socialError('Friend request not found.', 404);
  if (Number(request.requested_by_id) === viewerId) {
    throw socialError('Only the recipient can respond to this request.', 403);
  }
  if (request.status !== 'pending') throw socialError('This friend request has already been handled.', 409);

  const status = action === 'accept' ? 'accepted' : 'declined';
  const update = database.prepare(`
    UPDATE friendships
    SET status = ?, responded_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(status, new Date().toISOString(), numericRequestId);

  if (!update.changes) throw socialError('This friend request has already been handled.', 409);
  return toFriendRequest(getFriendRequestForViewer(numericRequestId, viewerId), viewerId);
}

function getFriendsLeaderboard(userId) {
  const viewerId = Number(userId);
  return database.prepare(`
    SELECT u.id AS user_id, u.name, u.total_points, u.streak, u.badges
    FROM users u
    WHERE u.id = ? OR u.id IN (
      SELECT CASE
        WHEN f.user_low_id = ? THEN f.user_high_id
        ELSE f.user_low_id
      END
      FROM friendships f
      WHERE f.status = 'accepted'
        AND (f.user_low_id = ? OR f.user_high_id = ?)
    )
    ORDER BY u.total_points DESC, u.created_at ASC
    LIMIT 100
  `).all(viewerId, viewerId, viewerId, viewerId).map(row => ({
    ...toFriendSummary(row),
    isCurrentUser: Number(row.user_id) === viewerId
  }));
}

function getFriendsActivityFeed(userId, { days = 1, limit = 12 } = {}) {
  const viewerId = Number(userId);
  const safeDays = Math.min(Math.max(Math.floor(Number(days)) || 1, 1), 31);
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit)) || 12, 1), 50);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (safeDays - 1));

  return database.prepare(`
    SELECT
      w.id AS workout_id,
      w.notes,
      w.total_duration,
      w.total_calories,
      COALESCE(w.completed_at, w.date) AS completed_at,
      u.id AS user_id,
      u.name
    FROM workouts w
    JOIN users u ON u.id = w.user_id
    JOIN friendships f ON f.status = 'accepted' AND (
      (f.user_low_id = ? AND f.user_high_id = w.user_id)
      OR (f.user_high_id = ? AND f.user_low_id = w.user_id)
    )
    WHERE w.completed = 1
      AND COALESCE(w.completed_at, w.date) >= ?
    ORDER BY COALESCE(w.completed_at, w.date) DESC
    LIMIT ?
  `).all(viewerId, viewerId, start.toISOString(), safeLimit).map(row => ({
    id: String(row.workout_id),
    type: 'workout_completed',
    completedAt: row.completed_at,
    user: {
      _id: String(row.user_id),
      name: row.name
    },
    workout: {
      _id: String(row.workout_id),
      name: (row.notes || '').trim() || 'Workout',
      totalDuration: row.total_duration,
      totalCalories: row.total_calories
    }
  }));
}

module.exports = {
  claimStreakFreeze,
  createMeal,
  createUser,
  createFriendRequest,
  completeWorkout,
  createWorkout,
  deleteMeal,
  deleteWorkout,
  findUserByEmail,
  findUserById,
  getActivities,
  getFriends,
  getFriendsActivityFeed,
  getFriendsLeaderboard,
  getLeaderboard,
  getMeals,
  getWorkouts,
  respondToFriendRequest,
  toPublicUser,
  upsertActivity
};
