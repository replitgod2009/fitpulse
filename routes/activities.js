const express = require('express');
const database = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/leaderboard', auth, (req, res) => {
  try {
    res.json(database.getLeaderboard());
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not load leaderboard' });
  }
});

router.get('/', auth, (req, res) => {
  try {
    res.json(database.getActivities(req.user.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not load activities' });
  }
});

router.post('/', auth, (req, res) => {
  try {
    res.json(database.upsertActivity(req.user.id, req.body));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not save activity' });
  }
});

module.exports = router;
