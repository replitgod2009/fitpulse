const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  waterIntake: { type: Number, default: 0 },
  sleepHours: { type: Number, default: 0 },
  steps: { type: Number, default: 0 },
  mood: { type: String, enum: ['great', 'good', 'okay', 'tired'], default: 'good' }
});

module.exports = mongoose.model('Activity', activitySchema);
