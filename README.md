# FitPulse 💪
Fitness tracker: workout planner, streaks/points/badges, activity logging, leaderboard.

## Run locally
1. Install Node 18+ and MongoDB (or use a free MongoDB Atlas cluster)
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in
4. `npm run dev`
5. Open http://localhost:5000

## Deploy (Render)
Push to GitHub, create a Blueprint on Render, set `MONGO_URI` (Atlas string).

## Structure
- `server.js` - Express app, serves `public/` and `/api`
- `models/` - Mongoose schemas (User, Workout, Activity)
- `routes/` - auth, workouts, activities (+ leaderboard)
- `middleware/auth.js` - JWT check
- `public/` - frontend
