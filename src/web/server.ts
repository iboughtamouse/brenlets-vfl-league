/**
 * Web server — Hono on Node.js.
 *
 * API routes:
 *   GET /api/standings         — standings for the latest game week (or ?gw=N)
 *   GET /api/standings/weeks   — list of available game weeks
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { VflDatabase } from '../db/index.js';

const app = new Hono();
const db = new VflDatabase();

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

/** List available game weeks (descending). */
app.get('/api/standings/weeks', async (c) => {
  const result = await db.pool.query(
    'SELECT DISTINCT game_week FROM scores ORDER BY game_week DESC',
  );

  const weeks = result.rows.map((r: { game_week: number }) => r.game_week);
  const latest = weeks[0] ?? null;

  return c.json({ weeks, latest });
});

/** Get standings for a game week. Defaults to latest. */
app.get('/api/standings', async (c) => {
  const gwParam = c.req.query('gw');
  let gameWeek: number | null;

  if (gwParam != null) {
    gameWeek = Number(gwParam);
    if (Number.isNaN(gameWeek)) {
      return c.json({ error: 'Invalid game week parameter' }, 400);
    }
  } else {
    gameWeek = await db.getLatestGameWeek();
  }

  if (gameWeek == null) {
    return c.json({ standings: [], gameWeek: null });
  }

  const standings = await db.getStandings(gameWeek);
  return c.json({ standings, gameWeek });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);

await db.initialize();

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export { app };
