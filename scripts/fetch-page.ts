/**
 * fetch-page.ts
 *
 * Inspection script: renders a single VFL team page using Playwright and
 * extracts the data visible on screen. Purpose: confirm DOM selectors for
 * team name, game week label, and points before building the real scraper.
 *
 * VFL is a Next.js app — all data is rendered client-side via JavaScript.
 * Plain HTTP fetch returns "Loading team data..."; Playwright executes the
 * full page so we read exactly what a user sees.
 *
 * Run with: npm run fetch-page
 */

import { chromium } from '@playwright/test';

const TEAM_URL = 'https://www.valorantfantasyleague.net/team/22832';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log(`Navigating to ${TEAM_URL}...\n`);
await page.goto(TEAM_URL, { waitUntil: 'networkidle' });

// Print the full rendered HTML so we can identify the correct selectors.
const html = await page.content();
console.log('=== RENDERED HTML ===\n');
console.log(html);

await browser.close();
