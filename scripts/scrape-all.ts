/**
 * scrape-all.ts
 *
 * Runs the scraper against all teams in config/teams.json and prints
 * the results as JSON. This is the entry point for manual runs and
 * will later be called by the GitHub Actions cron job.
 *
 * Run with: npm run scrape
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scrapeAll, type TeamConfig } from '../src/scraper/index.js';

const teamsPath = resolve(import.meta.dirname, '..', 'config', 'teams.json');
const teams: TeamConfig[] = JSON.parse(await readFile(teamsPath, 'utf-8'));

console.log(`\nScraping ${teams.length} teams...\n`);

const results = await scrapeAll(teams);

const succeeded = results.filter((r) => !r.error).length;
const failed = results.filter((r) => r.error).length;

console.log(`\nDone: ${succeeded} succeeded, ${failed} failed.\n`);
console.log(JSON.stringify(results, null, 2));
