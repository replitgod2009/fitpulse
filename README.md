# FitPulse 💪

Fitness tracker: workout planner, streaks/points/badges, activity logging, leaderboard, nutrition, social features, and guided workouts.

## Run locally

1. Install Node 22.5+ (the app uses Node's built-in SQLite driver).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
4. Run `npm run dev`.
5. Open http://localhost:5000.

The first run creates `data/fitpulse.sqlite` automatically. Accounts, password hashes, workouts, activities, streaks, meals, friends, and progress data are stored in that SQLite database. Keep its data folder when deploying outside Render.

## Deploy on Render without losing registrations

Render Free web services erase local files—including SQLite databases—when they restart, redeploy, or spin down. This repository's `render.yaml` now puts the database at `/var/data/fitpulse.sqlite` on a 1 GB persistent disk.

A persistent disk requires a paid Render web-service plan. The supplied Blueprint uses Render's `0.5c-512mb` paid plan and one service instance, which is the right model for SQLite.

1. Commit and push these changes.
2. In the Render Dashboard, sync the `render.yaml` Blueprint for the existing `fitpulse` service. Review and approve the plan/disk change.
3. If the service was created manually instead of from the Blueprint, open **Disks** and add a 1 GB disk mounted at `/var/data`, then set `DB_FILE=/var/data/fitpulse.sqlite` in **Environment**.
4. Redeploy. The startup logs should include `FitPulse database: /var/data/fitpulse.sqlite`.

Data created after that deployment survives Render restarts and redeploys. Data already lost during earlier Free-service restarts cannot be recovered. If the currently running instance still contains users you need, back up its SQLite file before attaching the disk.

### Important production limits

- A persistent SQLite disk can be attached to only one running service instance; do not scale this app horizontally while it uses SQLite.
- Render takes disk snapshots daily, but keep an external backup for long-term recovery.
- If you later need multiple instances or managed point-in-time recovery, migrate the data layer to paid Render Postgres instead of sharing SQLite.

## Structure

- `server.js` - Express app, serves `public/` and `/api`
- `database.js` - SQLite schema, durable storage bootstrap, and persistence helpers
- `routes/` - auth, workouts, activities, meals, and social APIs
- `middleware/auth.js` - JWT check
- `public/` - frontend