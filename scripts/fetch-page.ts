/**
 * fetch-page.ts
 *
 * One-off script to fetch a single VFL team page and print the raw HTML.
 * Purpose: inspect the actual markup to confirm:
 *   1. Where the team name lives in the DOM
 *   2. Where the point total lives in the DOM
 *   3. Whether a game week label is present anywhere in the HTML
 *
 * Run with: npm run fetch-page
 */

const TEAM_URL = 'https://www.valorantfantasyleague.net/team/22832';

const response = await fetch(TEAM_URL);

if (!response.ok) {
  console.error(`Failed to fetch ${TEAM_URL}: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const html = await response.text();

console.log('=== RAW HTML ===\n');
console.log(html);
