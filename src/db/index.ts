/**
 * Database layer — Postgres via node-postgres (pg).
 *
 * Schema:
 *   teams  — one row per VFL team (keyed by the numeric ID from the URL)
 *   scores — one row per team per event per game week (upserted on re-fetch)
 *
 * All operations are async. The pool manages connections automatically.
 */

import pg from 'pg';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamRow {
  vfl_id: number;
  manager: string;
  url: string;
  team_name: string | null;
}

export interface ScoreRow {
  id: number;
  team_vfl_id: number;
  event: string;
  game_week: number;
  points: number;
  scraped_at: string; // ISO 8601
}

export interface StandingsRow {
  vfl_id: number;
  manager: string;
  url: string;
  team_name: string | null;
  event: string;
  game_week: number;
  points: number;
  scraped_at: string;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS teams (
    vfl_id    INTEGER PRIMARY KEY,
    manager   TEXT NOT NULL,
    url       TEXT NOT NULL UNIQUE,
    team_name TEXT
  );

  CREATE TABLE IF NOT EXISTS scores (
    id          SERIAL PRIMARY KEY,
    team_vfl_id INTEGER NOT NULL REFERENCES teams(vfl_id),
    event       TEXT    NOT NULL,
    game_week   INTEGER NOT NULL,
    points      REAL    NOT NULL,
    scraped_at  TEXT    NOT NULL,
    UNIQUE(team_vfl_id, event, game_week)
  );
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the numeric team ID from a VFL URL like ".../team/22832". */
export function extractVflId(url: string): number {
  const match = url.match(/\/team\/(\d+)/);
  if (!match) {
    throw new Error(`Cannot extract VFL ID from URL: ${url}`);
  }
  return Number(match[1]);
}

// ---------------------------------------------------------------------------
// Database class
// ---------------------------------------------------------------------------

export class VflDatabase {
  readonly pool: pg.Pool;
  private initialized = false;

  constructor(connectionString?: string) {
    const connStr =
      connectionString ?? process.env.DATABASE_URL ?? 'postgresql://vfl:vfl@localhost:5432/vfl';

    this.pool = new Pool({ connectionString: connStr });
  }

  /** Run schema migrations. Call once at startup. Idempotent — skips if already run. */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.pool.query(SCHEMA);
    this.initialized = true;
  }

  // -----------------------------------------------------------------------
  // Teams
  // -----------------------------------------------------------------------

  /** Upsert a team — insert or update manager/url/team_name. */
  async upsertTeam(
    vflId: number,
    manager: string,
    url: string,
    teamName: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO teams (vfl_id, manager, url, team_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(vfl_id) DO UPDATE SET
         manager   = EXCLUDED.manager,
         url       = EXCLUDED.url,
         team_name = EXCLUDED.team_name`,
      [vflId, manager, url, teamName],
    );
  }

  /** Get all teams. */
  async getTeams(): Promise<TeamRow[]> {
    const result = await this.pool.query('SELECT * FROM teams ORDER BY manager');
    return result.rows;
  }

  // -----------------------------------------------------------------------
  // Scores
  // -----------------------------------------------------------------------

  /** Upsert a score — insert or update points/scraped_at for (team, event, game_week). */
  async upsertScore(
    teamVflId: number,
    event: string,
    gameWeek: number,
    points: number,
    scrapedAt: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO scores (team_vfl_id, event, game_week, points, scraped_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(team_vfl_id, event, game_week) DO UPDATE SET
         points     = EXCLUDED.points,
         scraped_at = EXCLUDED.scraped_at`,
      [teamVflId, event, gameWeek, points, scrapedAt],
    );
  }

  /** Get all scores for a specific event + game week, joined with team info. */
  async getStandings(event: string, gameWeek: number): Promise<StandingsRow[]> {
    const result = await this.pool.query(
      `SELECT t.vfl_id, t.manager, t.url, t.team_name,
              s.event, s.game_week, s.points, s.scraped_at
       FROM scores s
       JOIN teams t ON t.vfl_id = s.team_vfl_id
       WHERE s.event = $1 AND s.game_week = $2
       ORDER BY s.points DESC`,
      [event, gameWeek],
    );
    return result.rows;
  }

  /** Get the latest event name, or null if no scores exist. */
  async getLatestEvent(): Promise<string | null> {
    const result = await this.pool.query(
      `SELECT event FROM scores ORDER BY scraped_at DESC LIMIT 1`,
    );
    return result.rows[0]?.event ?? null;
  }

  /** Get the latest (highest) game week for a given event, or null if none. */
  async getLatestGameWeek(event: string): Promise<number | null> {
    const result = await this.pool.query(
      'SELECT MAX(game_week) AS gw FROM scores WHERE event = $1',
      [event],
    );
    return result.rows[0]?.gw ?? null;
  }

  /** Get distinct game weeks for an event (descending). */
  async getGameWeeksForEvent(event: string): Promise<number[]> {
    const result = await this.pool.query(
      'SELECT DISTINCT game_week FROM scores WHERE event = $1 ORDER BY game_week DESC',
      [event],
    );
    return result.rows.map((r: { game_week: number }) => r.game_week);
  }

  /** Get all distinct event names. */
  async getEvents(): Promise<string[]> {
    const result = await this.pool.query('SELECT DISTINCT event FROM scores ORDER BY event');
    return result.rows.map((r: { event: string }) => r.event);
  }

  /** Get all scores for a specific team within an event. */
  async getTeamHistory(vflId: number, event: string): Promise<ScoreRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM scores
       WHERE team_vfl_id = $1 AND event = $2
       ORDER BY game_week ASC`,
      [vflId, event],
    );
    return result.rows;
  }

  // -----------------------------------------------------------------------
  // Bulk operations (used by scraper)
  // -----------------------------------------------------------------------

  /**
   * Save a batch of scrape results. Runs inside a transaction for atomicity.
   * Skips entries with errors or missing data.
   *
   * Returns the count of successfully saved results.
   */
  async saveScrapeBatch(
    event: string,
    results: Array<{
      manager: string;
      url: string;
      teamName: string | null;
      gameWeek: number | null;
      points: number | null;
      scrapedAt: string;
      error?: string;
    }>,
  ): Promise<number> {
    const client = await this.pool.connect();
    let saved = 0;

    try {
      await client.query('BEGIN');

      for (const r of results) {
        if (r.error || r.gameWeek == null || r.points == null) {
          continue;
        }

        const vflId = extractVflId(r.url);

        await client.query(
          `INSERT INTO teams (vfl_id, manager, url, team_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT(vfl_id) DO UPDATE SET
             manager   = EXCLUDED.manager,
             url       = EXCLUDED.url,
             team_name = EXCLUDED.team_name`,
          [vflId, r.manager, r.url, r.teamName],
        );

        await client.query(
          `INSERT INTO scores (team_vfl_id, event, game_week, points, scraped_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT(team_vfl_id, event, game_week) DO UPDATE SET
             points     = EXCLUDED.points,
             scraped_at = EXCLUDED.scraped_at`,
          [vflId, event, r.gameWeek, r.points, r.scrapedAt],
        );

        saved++;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return saved;
  }

  /** Close all pool connections. */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
