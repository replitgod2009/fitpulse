const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('name totalPoints streak badges')
      .sort({ totalPoints: -1 })
      .limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// All activities for user
router.get('/', auth, async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.user.id }).sort({ date: -1 });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Log activity (one entry per day: updates today's if it exists)
router.post('/', auth, async (req, res) => {
  try {
    const { waterIntake, sleepHours, steps, mood } = req.body;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);

    const activity = await Activity.findOneAndUpdate(
      { user: req.user.id, date: { $gte: start, $lt: end } },
      { $set: { waterIntake, sleepHours, steps, mood }, $setOnInsert: { user: req.user.id, date: new Date() } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
