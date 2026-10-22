const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDirectory = path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = process.env.DB_FILE || path.join(dataDirectory, 'fitpulse.sqlite');
const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;

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

  CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS activities_user_date_idx ON activities(user_id, date DESC);
`);

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
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
    completed: Boolean(row.completed)
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

function completeWorkout(userId, workoutId) {
  const workoutRow = database.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(Number(workoutId), Number(userId));
  if (!workoutRow) return null;

  database.exec('BEGIN');
  try {
    database.prepare('UPDATE workouts SET completed = 1 WHERE id = ?').run(Number(workoutId));
    const user = findUserById(userId);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const last = user.last_workout_date ? new Date(user.last_workout_date).toDateString() : null;
    let streak = user.streak;
    let totalPoints = user.total_points;
    let badges = parseJson(user.badges, []);
    let lastWorkoutDate = user.last_workout_date;

    if (!workoutRow.completed && last !== today) {
      streak = last === yesterday ? streak + 1 : 1;
      lastWorkoutDate = new Date().toISOString();
      totalPoints += Math.round((workoutRow.total_calories || 0) / 10) + 10;
    }

    if (streak >= 7 && !badges.includes('Week Warrior')) badges.push('Week Warrior');
    if (streak >= 30 && !badges.includes('Monthly Master')) badges.push('Monthly Master');
    if (totalPoints >= 1000 && !badges.includes('Point Hunter')) badges.push('Point Hunter');

    database.prepare(`
      UPDATE users
      SET streak = ?, total_points = ?, badges = ?, last_workout_date = ?
      WHERE id = ?
    `).run(streak, totalPoints, JSON.stringify(badges), lastWorkoutDate, Number(userId));

    database.exec('COMMIT');
    return {
      workout: toWorkout(database.prepare('SELECT * FROM workouts WHERE id = ?').get(Number(workoutId))),
      user: { streak, totalPoints, badges }
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
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
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
    Number(userId),
    day,
    now.toISOString(),
    Number(waterIntake) || 0,
    Number(sleepHours) || 0,
    Number(steps) || 0,
    mood || 'good'
  );
  return toActivity(database.prepare('SELECT * FROM activities WHERE user_id = ? AND day = ?').get(Number(userId), day));
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

module.exports = {
  createUser,
  completeWorkout,
  createWorkout,
  deleteWorkout,
  findUserByEmail,
  findUserById,
  getActivities,
  getLeaderboard,
  getWorkouts,
  toPublicUser,
  upsertActivity
};
