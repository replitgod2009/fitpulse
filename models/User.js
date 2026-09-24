const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  age: Number,
  weight: Number,
  height: Number,
  fitnessGoal: { type: String, enum: ['lose_weight', 'gain_muscle', 'stay_fit', 'endurance'], default: 'stay_fit' },
  activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'], default: 'moderate' },
  streak: { type: Number, default: 0 },
  totalPoints: { type: Number, default: 0 },
  badges: { type: [String], default: [] },
  lastWorkoutDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
