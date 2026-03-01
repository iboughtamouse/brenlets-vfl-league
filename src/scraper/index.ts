/**
 * Scraper module — fetches all VFL team pages and extracts standings data.
 *
 * Uses Playwright (headless Chromium) because VFL is a Next.js app that
 * renders all team data client-side. Plain HTTP returns "Loading team data...".
 *
 * Reuses a single browser instance across all team pages for efficiency.
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { parseGwLabel, type GwLabelResult } from './parser.js';

export interface TeamConfig {
  manager: string;
  url: string;
}

export interface ScrapedTeam {
  manager: string;
  url: string;
  teamName: string | null;
  gameWeek: number | null;
  points: number | null;
  scrapedAt: string; // ISO 8601
  error?: string;
}

/**
 * Visit the VFL leaderboard and extract the current event name.
 *
 * The leaderboard has a "Current Event" label followed by a button whose
 * text content is the event name (e.g. "VCT 2026 : Masters Santiago").
 */
export async function scrapeCurrentEvent(page: Page): Promise<string> {
  await page.goto('https://www.valorantfantasyleague.net/leaderboard', {
    waitUntil: 'networkidle',
    timeout: 30_000,
  });

  const eventName = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')];
    const currentEventLabel = labels.find(
      (l) => l.textContent?.trim().toLowerCase() === 'current event',
    );
    if (!currentEventLabel) return null;

    const parent = currentEventLabel.parentElement;
    if (!parent) return null;

    const button = parent.querySelector('button');
    return button?.textContent?.trim() ?? null;
  });

  if (!eventName) {
    throw new Error('Could not find current event name on leaderboard page');
  }

  return eventName;
}

/**
 * Extract team name and GW label from a single already-navigated page.
 */
async function extractTeamData(page: Page): Promise<{
  teamName: string | null;
  gwLabel: string | null;
}> {
  await page.waitForSelector('[data-testid="team-page"]', { timeout: 15_000 });

  // Wait for the GW label to hydrate — the page container renders before the
  // game week data on VFL's Next.js client. The GW label is a .text-2xl child
  // inside the .text-5xl team name container. Its color class varies by score
  // (text-stone-500, text-fuchsia-500, text-orange-900, etc.) so we match on
  // the size class which is consistent.
  const gwSelector = '[data-testid="team-page"] .text-5xl .text-2xl';
  await page.waitForSelector(gwSelector, { timeout: 15_000 });

  const teamName = await page.$eval('[data-testid="team-page"] .text-5xl', (el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('*').forEach((child) => child.remove());
    return clone.textContent?.trim() ?? null;
  });

  const gwLabel = await page.$eval(gwSelector, (el) => el.textContent?.trim() ?? null);

  return { teamName, gwLabel };
}

/**
 * Scrape a single team page. Returns structured data or an error marker.
 */
async function scrapeTeam(page: Page, team: TeamConfig): Promise<ScrapedTeam> {
  const scrapedAt = new Date().toISOString();

  try {
    await page.goto(team.url, { waitUntil: 'networkidle', timeout: 30_000 });
    const { teamName, gwLabel } = await extractTeamData(page);

    const parsed: GwLabelResult | null = gwLabel ? parseGwLabel(gwLabel) : null;

    return {
      manager: team.manager,
      url: team.url,
      teamName,
      gameWeek: parsed?.gameWeek ?? null,
      points: parsed?.points ?? null,
      scrapedAt,
    };
  } catch (err) {
    return {
      manager: team.manager,
      url: team.url,
      teamName: null,
      gameWeek: null,
      points: null,
      scrapedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ScrapeResult {
  event: string;
  teams: ScrapedTeam[];
}

/**
 * Scrape all teams. Launches a single browser, visits the leaderboard to
 * determine the current event, then visits each team page sequentially.
 */
export async function scrapeAll(teams: TeamConfig[]): Promise<ScrapeResult> {
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();
  const results: ScrapedTeam[] = [];

  try {
    // Step 1: Get the current event name from the leaderboard
    console.log('Fetching current event from leaderboard...');
    const event = await scrapeCurrentEvent(page);
    console.log(`Current event: ${event}\n`);

    // Step 2: Scrape each team page
    for (const team of teams) {
      console.log(`Scraping ${team.manager} (${team.url})...`);
      const result = await scrapeTeam(page, team);

      if (result.error) {
        console.error(`  ✗ ${team.manager}: ${result.error}`);
      } else {
        console.log(`  ✓ ${result.teamName} — GW${result.gameWeek}: ${result.points} PTS`);
      }

      results.push(result);
    }

    return { event, teams: results };
  } finally {
    await browser.close();
  }
}
