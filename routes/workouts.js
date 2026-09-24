const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create workout
router.post('/', auth, async (req, res) => {
  try {
    const workout = new Workout({ ...req.body, user: req.user.id });
    await workout.save();
    res.json(workout);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all workouts for user
router.get('/', auth, async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user.id }).sort({ date: -1 });
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Mark workout complete + update streak/points
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { completed: true },
      { new: true }
    );
    if (!workout) return res.status(404).json({ msg: 'Workout not found' });

    const user = await User.findById(req.user.id);
    const today = new Date().toDateString();
    const last = user.lastWorkoutDate ? new Date(user.lastWorkoutDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (last !== today) {
      user.streak = last === yesterday ? user.streak + 1 : 1;
      user.lastWorkoutDate = new Date();
      user.totalPoints += Math.round((workout.totalCalories || 0) / 10) + 10;
    }

    if (user.streak >= 7 && !user.badges.includes('Week Warrior')) user.badges.push('Week Warrior');
    if (user.streak >= 30 && !user.badges.includes('Monthly Master')) user.badges.push('Monthly Master');
    if (user.totalPoints >= 1000 && !user.badges.includes('Point Hunter')) user.badges.push('Point Hunter');

    await user.save();
    res.json({ workout, user: { streak: user.streak, totalPoints: user.totalPoints, badges: user.badges } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete workout
router.delete('/:id', auth, async (req, res) => {
  try {
    await Workout.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ msg: 'Deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
