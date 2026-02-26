/**
 * Database layer — SQLite via better-sqlite3.
 *
 * Schema:
 *   teams  — one row per VFL team (keyed by the numeric ID from the URL)
 *   scores — one row per team per game week (upserted on re-scrape)
 *
 * All operations are synchronous (better-sqlite3's design). This is fine
 * for a low-volume app writing ~17 rows per scrape.
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';

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
  game_week: number;
  points: number;
  scraped_at: string; // ISO 8601
}

export interface StandingsRow {
  vfl_id: number;
  manager: string;
  url: string;
  team_name: string | null;
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
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    team_vfl_id INTEGER NOT NULL REFERENCES teams(vfl_id),
    game_week   INTEGER NOT NULL,
    points      REAL    NOT NULL,
    scraped_at  TEXT    NOT NULL,
    UNIQUE(team_vfl_id, game_week)
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
  readonly db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? resolve(import.meta.dirname, '..', '..', 'data', 'vfl.db');
    this.db = new Database(resolvedPath);

    // Enable WAL mode for better concurrent read performance.
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(SCHEMA);
  }

  // -----------------------------------------------------------------------
  // Teams
  // -----------------------------------------------------------------------

  /** Upsert a team — insert or update manager/url/team_name. */
  upsertTeam(vflId: number, manager: string, url: string, teamName: string | null): void {
    this.db
      .prepare(
        `INSERT INTO teams (vfl_id, manager, url, team_name)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(vfl_id) DO UPDATE SET
           manager   = excluded.manager,
           url       = excluded.url,
           team_name = excluded.team_name`,
      )
      .run(vflId, manager, url, teamName);
  }

  /** Get all teams. */
  getTeams(): TeamRow[] {
    return this.db.prepare('SELECT * FROM teams ORDER BY manager').all() as TeamRow[];
  }

  // -----------------------------------------------------------------------
  // Scores
  // -----------------------------------------------------------------------

  /** Upsert a score — insert or update points/scraped_at for (team, game_week). */
  upsertScore(teamVflId: number, gameWeek: number, points: number, scrapedAt: string): void {
    this.db
      .prepare(
        `INSERT INTO scores (team_vfl_id, game_week, points, scraped_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(team_vfl_id, game_week) DO UPDATE SET
           points     = excluded.points,
           scraped_at = excluded.scraped_at`,
      )
      .run(teamVflId, gameWeek, points, scrapedAt);
  }

  /** Get all scores for a specific game week, joined with team info. */
  getStandings(gameWeek: number): StandingsRow[] {
    return this.db
      .prepare(
        `SELECT t.vfl_id, t.manager, t.url, t.team_name,
                s.game_week, s.points, s.scraped_at
         FROM scores s
         JOIN teams t ON t.vfl_id = s.team_vfl_id
         WHERE s.game_week = ?
         ORDER BY s.points DESC`,
      )
      .all(gameWeek) as StandingsRow[];
  }

  /** Get the latest (highest) game week number, or null if no scores exist. */
  getLatestGameWeek(): number | null {
    const row = this.db.prepare('SELECT MAX(game_week) AS gw FROM scores').get() as
      | { gw: number | null }
      | undefined;
    return row?.gw ?? null;
  }

  /** Get all scores for a specific team across all game weeks. */
  getTeamHistory(vflId: number): ScoreRow[] {
    return this.db
      .prepare(
        `SELECT * FROM scores
         WHERE team_vfl_id = ?
         ORDER BY game_week ASC`,
      )
      .all(vflId) as ScoreRow[];
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
  saveScrapeBatch(
    results: Array<{
      manager: string;
      url: string;
      teamName: string | null;
      gameWeek: number | null;
      points: number | null;
      scrapedAt: string;
      error?: string;
    }>,
  ): number {
    let saved = 0;

    const run = this.db.transaction(() => {
      for (const r of results) {
        if (r.error || r.gameWeek == null || r.points == null) {
          continue;
        }

        const vflId = extractVflId(r.url);
        this.upsertTeam(vflId, r.manager, r.url, r.teamName);
        this.upsertScore(vflId, r.gameWeek, r.points, r.scrapedAt);
        saved++;
      }
    });

    run();
    return saved;
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}
