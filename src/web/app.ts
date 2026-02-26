/**
 * Hono app definition — API routes only.
 *
 * Separated from the server entry point so the same app can be used by:
 *   - src/web/server.ts  (local dev via @hono/node-server)
 *   - api/index.ts       (Vercel serverless function)
 *
 * API routes:
 *   GET /api/standings         — standings for the latest game week (or ?gw=N)
 *   GET /api/standings/weeks   — list of available game weeks
 */

import { Hono } from 'hono';
import { VflDatabase } from '../db/index.js';

const app = new Hono();

// Lazy-initialized DB — created on first request, reused across warm
// invocations in serverless. In local dev, the pool stays alive for the
// lifetime of the process.
let db: VflDatabase | null = null;

function getDb(): VflDatabase {
  if (!db) {
    db = new VflDatabase();
  }
  return db;
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

/** List available game weeks (descending). */
app.get('/api/standings/weeks', async (c) => {
  const pool = getDb().pool;
  await getDb().initialize();

  const result = await pool.query('SELECT DISTINCT game_week FROM scores ORDER BY game_week DESC');

  const weeks = result.rows.map((r: { game_week: number }) => r.game_week);
  const latest = weeks[0] ?? null;

  return c.json({ weeks, latest });
});

/** Get standings for a game week. Defaults to latest. */
app.get('/api/standings', async (c) => {
  const database = getDb();
  await database.initialize();

  const gwParam = c.req.query('gw');
  let gameWeek: number | null;

  if (gwParam != null) {
    gameWeek = Number(gwParam);
    if (Number.isNaN(gameWeek)) {
      return c.json({ error: 'Invalid game week parameter' }, 400);
    }
  } else {
    gameWeek = await database.getLatestGameWeek();
  }

  if (gameWeek == null) {
    return c.json({ standings: [], gameWeek: null });
  }

  const standings = await database.getStandings(gameWeek);
  return c.json({ standings, gameWeek });
});

export { app };
