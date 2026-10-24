const express = require('express');
const database = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  try {
    res.json(database.getMeals(req.user.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not load meals' });
  }
});

router.post('/', auth, (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ msg: 'Choose a food to log' });
    const fields = ['calories', 'protein', 'carbs', 'fat'];
    if (fields.some((field) => !Number.isFinite(Number(req.body[field])) || Number(req.body[field]) < 0)) {
      return res.status(400).json({ msg: 'Nutrition values must be valid positive numbers' });
    }
    res.status(201).json(database.createMeal(req.user.id, req.body));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not save meal' });
  }
});

router.delete('/:id', auth, (req, res) => {
  try {
    database.deleteMeal(req.user.id, req.params.id);
    res.json({ msg: 'Meal removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not remove meal' });
  }
});

module.exports = router;
