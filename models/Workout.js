const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  exercises: [{
    name: String,
    category: String,
    duration: Number, // minutes
    calories: Number,
    completed: { type: Boolean, default: false }
  }],
  totalDuration: { type: Number, default: 0 },
  totalCalories: { type: Number, default: 0 },
  notes: String,
  completed: { type: Boolean, default: false }
});

module.exports = mongoose.model('Workout', workoutSchema);
