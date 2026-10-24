const express = require('express');
const database = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendError(res, error, fallbackMessage) {
  const statusCode = Number(error.statusCode);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({ msg: error.message });
  }

  console.error(error);
  return res.status(500).json({ msg: fallbackMessage });
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

router.post('/friend-requests', auth, (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ msg: 'Enter a valid email address.' });
  }

  try {
    const request = database.createFriendRequest(req.user.id, email);
    return res.status(201).json({ request });
  } catch (error) {
    return sendError(res, error, 'Could not send friend request.');
  }
});

router.get('/friends', auth, (req, res) => {
  try {
    return res.json(database.getFriends(req.user.id));
  } catch (error) {
    return sendError(res, error, 'Could not load friends.');
  }
});

router.patch('/friend-requests/:id', auth, (req, res) => {
  const action = typeof req.body?.action === 'string' ? req.body.action : '';
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ msg: 'Choose either accept or decline.' });
  }

  try {
    const request = database.respondToFriendRequest(req.user.id, req.params.id, action);
    return res.json({ request });
  } catch (error) {
    return sendError(res, error, 'Could not update friend request.');
  }
});

router.get('/leaderboard', auth, (req, res) => {
  try {
    return res.json({ leaderboard: database.getFriendsLeaderboard(req.user.id) });
  } catch (error) {
    return sendError(res, error, 'Could not load friends leaderboard.');
  }
});

router.get('/feed', auth, (req, res) => {
  const days = positiveInteger(req.query.days, 1, 31);
  const limit = positiveInteger(req.query.limit, 12, 50);

  try {
    return res.json({ activities: database.getFriendsActivityFeed(req.user.id, { days, limit }) });
  } catch (error) {
    return sendError(res, error, 'Could not load friends activity.');
  }
});

module.exports = router;
