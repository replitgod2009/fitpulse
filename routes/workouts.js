const express = require('express');
const database = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, (req, res) => {
  try {
    res.json(database.createWorkout(req.user.id, req.body));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not save workout' });
  }
});

router.get('/', auth, (req, res) => {
  try {
    res.json(database.getWorkouts(req.user.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not load workouts' });
  }
});

router.patch('/:id/complete', auth, (req, res) => {
  try {
    const result = database.completeWorkout(req.user.id, req.params.id);
    if (!result) return res.status(404).json({ msg: 'Workout not found' });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not complete workout' });
  }
});

router.delete('/:id', auth, (req, res) => {
  try {
    database.deleteWorkout(req.user.id, req.params.id);
    res.json({ msg: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Could not delete workout' });
  }
});

module.exports = router;
