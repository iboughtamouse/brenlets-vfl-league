/**
 * Parsing utilities for VFL team page data.
 *
 * These are pure functions that operate on text extracted from the DOM.
 * Keeping them separate from Playwright allows unit testing against
 * simple string inputs rather than requiring a browser.
 */

export interface GwLabelResult {
  gameWeek: number;
  points: number;
}

/**
 * Parse the game week label displayed on a VFL team page.
 *
 * Expected format: "GW 1: 0 PTS" or "GW 2: 457 PTS"
 * Returns null if the label doesn't match the expected pattern.
 */
export function parseGwLabel(label: string): GwLabelResult | null {
  const match = label.trim().match(/^GW\s*(\d+)\s*:\s*([\d.]+)\s*PTS$/i);
  if (!match) return null;

  return {
    gameWeek: parseInt(match[1], 10),
    points: parseFloat(match[2]),
  };
}
