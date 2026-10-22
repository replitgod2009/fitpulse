# FitPulse 💪
Fitness tracker: workout planner, streaks/points/badges, activity logging, leaderboard.

## Run locally
1. Install Node 22.5+ (the app uses Node's built-in SQLite driver)
2. `npm install`
3. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`
4. `npm run dev`
5. Open http://localhost:5000

The first run creates `data/fitpulse.sqlite` automatically. Accounts, workouts,
activities, streaks, points, badges, and leaderboard entries are stored in this
local SQLite database. Keep the `data/` folder when deploying locally so the data
persists between launches.

## Deploy (Render)
Push to GitHub and create a Blueprint on Render. A persistent disk is required if
you want SQLite data to survive redeploys; for a local launch, keep `data/` beside
the app.

## Structure
- `server.js` - Express app, serves `public/` and `/api`
- `database.js` - Local SQLite schema and persistence helpers
- `routes/` - auth, workouts, activities (+ leaderboard)
- `middleware/auth.js` - JWT check
- `public/` - frontend
