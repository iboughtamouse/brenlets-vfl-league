/**
 * scrape-all.ts
 *
 * Fetches scores for all teams in config/teams.json from the VFL API
 * and saves them to the Postgres database.
 *
 * Run with: npm run scrape
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchAll, type TeamConfig } from '../src/scraper/index.js';
import { VflDatabase } from '../src/db/index.js';

const teamsPath = resolve(import.meta.dirname, '..', 'config', 'teams.json');
const teams: TeamConfig[] = JSON.parse(await readFile(teamsPath, 'utf-8'));

console.log(`\nFetching ${teams.length} teams...\n`);

const { event, teams: results } = await fetchAll(teams);

const succeeded = results.filter((r) => !r.error).length;
const failed = results.filter((r) => r.error).length;

console.log(`\nDone: ${succeeded} succeeded, ${failed} failed.\n`);
console.log(`Event: ${event}`);

// Save to database
const db = new VflDatabase();

try {
  await db.initialize();
  const saved = await db.saveScrapeBatch(event, results);
  console.log(`Saved ${saved} results to database.`);
} finally {
  await db.close();
}
