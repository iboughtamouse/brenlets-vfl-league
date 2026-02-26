import { describe, it, expect } from 'vitest';
import { parseGwLabel } from '../../src/scraper/parser.js';

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
