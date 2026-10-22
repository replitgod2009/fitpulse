const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();
const sign = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, age, weight, height, fitnessGoal, activityLevel } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ msg: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }
    if (database.findUserByEmail(normalizedEmail)) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = database.createUser({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      age,
      weight,
      height,
      fitnessGoal,
      activityLevel
    });

    res.json({ token: sign(user.id), user: database.toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not create account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = database.findUserByEmail(req.body.email || '');
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    res.json({ token: sign(user.id), user: database.toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not sign in' });
  }
});

router.get('/me', auth, (req, res) => {
  try {
    const user = database.findUserById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(database.toPublicUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not load account' });
  }
});

module.exports = router;
