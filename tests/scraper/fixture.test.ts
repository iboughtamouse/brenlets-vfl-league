/**
 * Fixture-based test for scraper DOM extraction.
 *
 * This is the primary breakage detector for VFL markup changes.
 * It loads the saved HTML fixture and runs the same selector + extraction
 * logic that the live scraper uses. If VFL changes their page structure,
 * this test fails and tells us exactly what broke.
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseGwLabel } from '../../src/scraper/parser.js';

let doc: Document;

beforeAll(async () => {
  const fixturePath = resolve(import.meta.dirname, '..', '..', 'fixtures', 'team-page-22832.html');
  const html = await readFile(fixturePath, 'utf-8');
  document.documentElement.innerHTML = html;
  doc = document;
});

describe('fixture: team-page-22832', () => {
  it('finds the team-page container', () => {
    const container = doc.querySelector('[data-testid="team-page"]');
    expect(container).not.toBeNull();
  });

  it('extracts the team name (text node only, children stripped)', () => {
    const el = doc.querySelector('[data-testid="team-page"] .text-5xl');
    expect(el).not.toBeNull();

    // Replicate the scraper's clone-and-strip logic
    const clone = el!.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('*').forEach((child) => child.remove());
    const teamName = clone.textContent?.trim() ?? null;

    expect(teamName).toBe('JOGOMO DA GOAT N HIS MANY HOES');
  });

  it('extracts the game week label', () => {
    const el = doc.querySelector('[data-testid="team-page"] .text-stone-500');
    expect(el).not.toBeNull();

    const gwLabel = el!.textContent?.trim() ?? null;
    expect(gwLabel).toBe('GW 1: 0 PTS');
  });

  it('parses the extracted GW label into structured data', () => {
    const el = doc.querySelector('[data-testid="team-page"] .text-stone-500');
    const gwLabel = el!.textContent?.trim() ?? null;

    const parsed = parseGwLabel(gwLabel!);
    expect(parsed).not.toBeNull();
    expect(parsed!.gameWeek).toBe(1);
    expect(parsed!.points).toBe(0);
  });
});
