/**
 * Hono app definition — API routes only.
 *
 * Separated from the server entry point so the same app can be used by:
 *   - src/web/server.ts  (local dev via @hono/node-server)
 *   - api/index.ts       (Vercel serverless function)
 *
 * API routes:
 *   GET /api/standings         — standings for latest event + game week (or ?event=X&gw=N)
 *   GET /api/standings/weeks   — list of available game weeks for the current event
 *   GET /api/standings/events  — list of all events
 */

import { Hono } from 'hono';
import { VflDatabase } from '../db/index.js';

const app = new Hono();

// ---------------------------------------------------------------------------
// Global error handler — catch unhandled errors in any route
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[${c.req.method}] ${c.req.path} — unhandled error:`, err);

  // Don't leak internal details to the client
  return c.json({ error: 'Internal server error' }, 500);
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', async (c) => {
  try {
    const database = getDb();
    await database.initialize();
    await database.pool.query('SELECT 1');
    return c.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err);
    return c.json({ status: 'error', message: 'Database unreachable' }, 503);
  }
});

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

/** List all events. */
app.get('/api/standings/events', async (c) => {
  const database = getDb();
  await database.initialize();

  const events = await database.getEvents();
  const latest = await database.getLatestEvent();

  return c.json({ events, latest });
});

/** List available game weeks for an event (descending). Defaults to latest event. */
app.get('/api/standings/weeks', async (c) => {
  const database = getDb();
  await database.initialize();

  const eventParam = c.req.query('event');
  const event = eventParam ?? (await database.getLatestEvent());

  if (!event) {
    return c.json({ event: null, weeks: [], latest: null });
  }

  const weeks = await database.getGameWeeksForEvent(event);
  const latest = weeks[0] ?? null;

  return c.json({ event, weeks, latest });
});

/** Get standings for a game week. Defaults to latest event + latest game week. */
app.get('/api/standings', async (c) => {
  const database = getDb();
  await database.initialize();

  // Resolve event
  const eventParam = c.req.query('event');
  const event = eventParam ?? (await database.getLatestEvent());

  if (!event) {
    return c.json({ standings: [], event: null, gameWeek: null });
  }

  // Resolve game week
  const gwParam = c.req.query('gw');
  let gameWeek: number | null;

  if (gwParam != null) {
    gameWeek = Number(gwParam);
    if (Number.isNaN(gameWeek)) {
      return c.json({ error: 'Invalid game week parameter' }, 400);
    }
  } else {
    gameWeek = await database.getLatestGameWeek(event);
  }

  if (gameWeek == null) {
    return c.json({ standings: [], event, gameWeek: null });
  }

  const standings = await database.getStandings(event, gameWeek);
  return c.json({ standings, event, gameWeek });
});

export { app };
