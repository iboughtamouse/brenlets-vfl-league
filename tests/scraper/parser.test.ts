import { describe, it, expect } from 'vitest';
import { parseGwLabel, normalizeEventName } from '../../src/scraper/parser.js';

describe('parseGwLabel', () => {
  it('parses a standard game week label', () => {
    const result = parseGwLabel('GW 1: 457 PTS');
    expect(result).not.toBeNull();
    expect(result!.gameWeek).toBe(1);
    expect(result!.points).toBe(457);
  });

  it('parses zero points', () => {
    const result = parseGwLabel('GW 1: 0 PTS');
    expect(result).not.toBeNull();
    expect(result!.gameWeek).toBe(1);
    expect(result!.points).toBe(0);
  });

  it('parses a higher game week number', () => {
    const result = parseGwLabel('GW 12: 312 PTS');
    expect(result).not.toBeNull();
    expect(result!.gameWeek).toBe(12);
    expect(result!.points).toBe(312);
  });

  it('handles decimal points', () => {
    const result = parseGwLabel('GW 3: 42.5 PTS');
    expect(result).not.toBeNull();
    expect(result!.points).toBe(42.5);
  });

  it('handles extra whitespace', () => {
    const result = parseGwLabel('  GW  2 :  100  PTS  ');
    expect(result).not.toBeNull();
    expect(result!.gameWeek).toBe(2);
    expect(result!.points).toBe(100);
  });

  it('is case-insensitive', () => {
    const result = parseGwLabel('gw 1: 50 pts');
    expect(result).not.toBeNull();
    expect(result!.gameWeek).toBe(1);
    expect(result!.points).toBe(50);
  });

  it('returns null for an empty string', () => {
    expect(parseGwLabel('')).toBeNull();
  });

  it('returns null for unrelated text', () => {
    expect(parseGwLabel('Loading team data...')).toBeNull();
  });

  it('returns null for a partial match', () => {
    expect(parseGwLabel('GW 1:')).toBeNull();
  });
});

describe('normalizeEventName', () => {
  it('strips ": Week N" suffix', () => {
    expect(normalizeEventName('VCT 2026 : Masters Santiago: Week 1')).toBe(
      'VCT 2026 : Masters Santiago',
    );
  });

  it('strips higher week numbers', () => {
    expect(normalizeEventName('VCT 2026 : Masters Santiago: Week 12')).toBe(
      'VCT 2026 : Masters Santiago',
    );
  });

  it('leaves bare event names unchanged', () => {
    expect(normalizeEventName('VCT 2026 : Masters Santiago')).toBe('VCT 2026 : Masters Santiago');
  });

  it('is case-insensitive for the Week suffix', () => {
    expect(normalizeEventName('Some Event: week 3')).toBe('Some Event');
  });

  it('handles extra whitespace around the suffix', () => {
    expect(normalizeEventName('Some Event:  Week  5  ')).toBe('Some Event');
  });

  it('does not strip Week from the middle of a name', () => {
    expect(normalizeEventName('Week 1 Finals: Grand Stage')).toBe('Week 1 Finals: Grand Stage');
  });
});
