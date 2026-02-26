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
 * Extract team name and GW label from a single already-navigated page.
 */
async function extractTeamData(page: Page): Promise<{
  teamName: string | null;
  gwLabel: string | null;
}> {
  await page.waitForSelector('[data-testid="team-page"]', { timeout: 15_000 });

  const teamName = await page.$eval('[data-testid="team-page"] .text-5xl', (el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('*').forEach((child) => child.remove());
    return clone.textContent?.trim() ?? null;
  });

  const gwLabel = await page.$eval(
    '[data-testid="team-page"] .text-stone-500',
    (el) => el.textContent?.trim() ?? null,
  );

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

/**
 * Scrape all teams. Launches a single browser, visits each page sequentially,
 * and returns an array of results.
 */
export async function scrapeAll(teams: TeamConfig[]): Promise<ScrapedTeam[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();
  const results: ScrapedTeam[] = [];

  try {
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
  } finally {
    await browser.close();
  }

  return results;
}
