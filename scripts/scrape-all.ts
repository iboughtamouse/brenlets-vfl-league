/**
 * scrape-all.ts
 *
 * Runs the scraper against all teams in config/teams.json, prints
 * the results, and saves them to the Postgres database.
 *
 * Run with: npm run scrape
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scrapeAll, type TeamConfig } from '../src/scraper/index.js';
import { VflDatabase } from '../src/db/index.js';

const teamsPath = resolve(import.meta.dirname, '..', 'config', 'teams.json');
const teams: TeamConfig[] = JSON.parse(await readFile(teamsPath, 'utf-8'));

console.log(`\nScraping ${teams.length} teams...\n`);

const { event, teams: results } = await scrapeAll(teams);

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
