import { describe, it, expect } from 'vitest';
import { scoreableGameweeks, type CurrentEvent } from '../../src/scraper/index.js';

describe('scoreableGameweeks', () => {
  const makeEvent = (matches: { gameweek: number; havePointsBeenAssigned: boolean }[]) =>
    ({
      id: 7,
      name: 'Test Event',
      gameweekPeriods: [],
      eventMatches: matches.map((m, i) => ({
        id: String(i),
        isComplete: m.havePointsBeenAssigned,
        ...m,
      })),
    }) satisfies CurrentEvent;

  it('returns gameweeks that have points assigned', () => {
    const event = makeEvent([
      { gameweek: 1, havePointsBeenAssigned: true },
      { gameweek: 1, havePointsBeenAssigned: true },
      { gameweek: 2, havePointsBeenAssigned: true },
      { gameweek: 3, havePointsBeenAssigned: false },
    ]);
    expect(scoreableGameweeks(event)).toEqual([1, 2]);
  });

  it('returns empty array when no matches have points', () => {
    const event = makeEvent([
      { gameweek: 1, havePointsBeenAssigned: false },
      { gameweek: 2, havePointsBeenAssigned: false },
    ]);
    expect(scoreableGameweeks(event)).toEqual([]);
  });

  it('returns empty array when there are no matches', () => {
    const event = makeEvent([]);
    expect(scoreableGameweeks(event)).toEqual([]);
  });

  it('includes a gameweek if even one match has points assigned', () => {
    const event = makeEvent([
      { gameweek: 2, havePointsBeenAssigned: false },
      { gameweek: 2, havePointsBeenAssigned: false },
      { gameweek: 2, havePointsBeenAssigned: true },
    ]);
    expect(scoreableGameweeks(event)).toEqual([2]);
  });

  it('returns gameweeks in ascending order', () => {
    const event = makeEvent([
      { gameweek: 3, havePointsBeenAssigned: true },
      { gameweek: 1, havePointsBeenAssigned: true },
    ]);
    expect(scoreableGameweeks(event)).toEqual([1, 3]);
  });
});
