const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const safe = (u) => {
  const o = u.toObject();
  delete o.password;
  return o;
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, age, weight, height, fitnessGoal, activityLevel } = req.body;
    if (!name || !email || !password) return res.status(400).json({ msg: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters' });

    if (await User.findOne({ email: email.toLowerCase() })) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, age, weight, height, fitnessGoal, activityLevel });
    res.json({ token: sign(user.id), user: safe(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    res.json({ token: sign(user.id), user: safe(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
