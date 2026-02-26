/**
 * fetch-page.ts
 *
 * Inspection script: renders a single VFL team page using Playwright and
 * extracts the team name, game week, and points using confirmed DOM selectors.
 *
 * Confirmed HTML structure (as of 2026-02-26):
 *
 *   <div data-testid="team-page">
 *     <div class="... text-5xl ...">
 *       TEAM NAME HERE
 *       <div class="... text-stone-500">GW 1: 0 PTS</div>
 *     </div>
 *   </div>
 *
 * Selectors:
 *   - Root:     [data-testid="team-page"]     (stable test hook)
 *   - GW label: [data-testid="team-page"] .text-stone-500
 *   - Team name: first text node of [data-testid="team-page"] .text-5xl
 *
 * Run with: npm run fetch-page
 */

import { chromium } from '@playwright/test';

const TEAM_URL = 'https://www.valorantfantasyleague.net/team/22832';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log(`Navigating to ${TEAM_URL}...\n`);
await page.goto(TEAM_URL, { waitUntil: 'networkidle' });

// Wait for the team page content to be present
await page.waitForSelector('[data-testid="team-page"]');

// Extract team name: the text-5xl div contains the team name as a text node,
// with the GW label as a child element. We strip the child text to isolate it.
const teamName = await page.$eval('[data-testid="team-page"] .text-5xl', (el) => {
  // Clone and remove child elements to get only the direct text node
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('*').forEach((child) => child.remove());
  return clone.textContent?.trim() ?? null;
});

// Extract GW label: "GW 1: 0 PTS"
const gwLabel = await page.$eval(
  '[data-testid="team-page"] .text-stone-500',
  (el) => el.textContent?.trim() ?? null,
);

// Parse game week number and points from "GW 1: 0 PTS"
const gwMatch = gwLabel?.match(/GW\s*(\d+):\s*([\d.]+)\s*PTS/i);
const gameWeek = gwMatch ? parseInt(gwMatch[1], 10) : null;
const points = gwMatch ? parseFloat(gwMatch[2]) : null;

console.log('=== EXTRACTED DATA ===\n');
console.log({ teamName, gwLabel, gameWeek, points });

await browser.close();
