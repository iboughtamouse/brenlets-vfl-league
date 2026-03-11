/**
 * VFL API client — fetches event metadata and team scores from the
 * VFL JSON API.
 *
 * Two endpoints:
 *   GET /api/event/currentevent  → event metadata, matches, gameweek periods
 *   GET /api/fantasyteam/team    → individual team scores per gameweek
 */

const API_BASE = 'https://api.valorantfantasyleague.net/api';

import { extractVflId } from '../db/index.js';

// ---------------------------------------------------------------------------
// Types — shaped from the actual API responses
// ---------------------------------------------------------------------------

export interface TeamConfig {
  manager: string;
  url: string;
}

export interface GameweekPeriod {
  id: number;
  eventId: number;
  gameweek: number;
  startTime: string; // Unix timestamp as string
  endTime: string;
}

export interface EventMatch {
  id: string;
  gameweek: number;
  isComplete: boolean;
  havePointsBeenAssigned: boolean;
}

export interface CurrentEvent {
  id: number;
  name: string;
  gameweekPeriods: GameweekPeriod[];
  eventMatches: EventMatch[];
}

export interface TeamScore {
  manager: string;
  url: string;
  teamName: string | null;
  gameWeek: number;
  points: number;
  fetchedAt: string;
  error?: string;
}

export interface FetchResult {
  event: string;
  teams: TeamScore[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** Fetch the current event metadata from VFL. */
export async function fetchCurrentEvent(): Promise<CurrentEvent> {
  const res = await fetch(`${API_BASE}/event/currentevent`);
  if (!res.ok) {
    throw new Error(`VFL /event/currentevent returned HTTP ${res.status}`);
  }
  return res.json() as Promise<CurrentEvent>;
}

interface FantasyTeamResponse {
  name: string | null;
  gameweekPoints: number | null;
  gameweek: number | null;
}

/** Fetch a single team's score for a specific event + gameweek. */
async function fetchTeamScore(
  userId: number,
  eventId: number,
  gameweek: number,
): Promise<FantasyTeamResponse> {
  const res = await fetch(
    `${API_BASE}/fantasyteam/team?userId=${userId}&eventId=${eventId}&gameweek=${gameweek}`,
  );
  if (!res.ok) {
    throw new Error(`VFL /fantasyteam/team returned HTTP ${res.status}`);
  }
  return res.json() as Promise<FantasyTeamResponse>;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Determine which gameweeks have at least one match with points assigned.
 * These are the gameweeks we should write scores for.
 */
export function scoreableGameweeks(event: CurrentEvent): number[] {
  const gws = new Set<number>();
  for (const match of event.eventMatches) {
    if (match.havePointsBeenAssigned) {
      gws.add(match.gameweek);
    }
  }
  return [...gws].sort((a, b) => a - b);
}

/**
 * Fetch scores for all teams across all scoreable gameweeks.
 */
export async function fetchAll(teams: TeamConfig[]): Promise<FetchResult> {
  console.log('Fetching current event from VFL API...');
  const event = await fetchCurrentEvent();
  console.log(`Current event: ${event.name} (id=${event.id})\n`);

  const gws = scoreableGameweeks(event);
  console.log(`Scoreable gameweeks: ${gws.length ? gws.join(', ') : 'none'}\n`);

  const results: TeamScore[] = [];
  const fetchedAt = new Date().toISOString();

  for (const gw of gws) {
    console.log(`--- GW${gw} ---`);
    for (const team of teams) {
      const userId = extractVflId(team.url);
      try {
        const data = await fetchTeamScore(userId, event.id, gw);
        results.push({
          manager: team.manager,
          url: team.url,
          teamName: data.name,
          gameWeek: gw,
          points: data.gameweekPoints ?? 0,
          fetchedAt,
        });
        console.log(`  ✓ ${team.manager.padEnd(14)} ${data.name} — ${data.gameweekPoints} pts`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          manager: team.manager,
          url: team.url,
          teamName: null,
          gameWeek: gw,
          points: 0,
          fetchedAt,
          error: message,
        });
        console.error(`  ✗ ${team.manager.padEnd(14)} ERROR: ${message}`);
      }
    }
  }

  return { event: event.name, teams: results };
}
