import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VflDatabase, extractVflId } from '../../src/db/index.js';

// All tests use an in-memory database — no file I/O, no cleanup needed.

describe('extractVflId', () => {
  it('extracts numeric ID from a standard VFL team URL', () => {
    expect(extractVflId('https://www.valorantfantasyleague.net/team/22832')).toBe(22832);
  });

  it('extracts ID from URL with trailing slash', () => {
    expect(extractVflId('https://www.valorantfantasyleague.net/team/164/')).toBe(164);
  });

  it('throws on URL without team ID', () => {
    expect(() => extractVflId('https://example.com/nope')).toThrow('Cannot extract VFL ID');
  });
});

describe('VflDatabase', () => {
  let db: VflDatabase;

  beforeEach(() => {
    db = new VflDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  describe('teams', () => {
    it('inserts and retrieves a team', () => {
      db.upsertTeam(22832, 'devin', 'https://www.valorantfantasyleague.net/team/22832', 'JOGOMO');

      const teams = db.getTeams();
      expect(teams).toHaveLength(1);
      expect(teams[0]).toEqual({
        vfl_id: 22832,
        manager: 'devin',
        url: 'https://www.valorantfantasyleague.net/team/22832',
        team_name: 'JOGOMO',
      });
    });

    it('updates team_name on re-upsert', () => {
      db.upsertTeam(22832, 'devin', 'https://www.valorantfantasyleague.net/team/22832', 'Old Name');
      db.upsertTeam(22832, 'devin', 'https://www.valorantfantasyleague.net/team/22832', 'New Name');

      const teams = db.getTeams();
      expect(teams).toHaveLength(1);
      expect(teams[0]!.team_name).toBe('New Name');
    });

    it('returns teams sorted by manager name', () => {
      db.upsertTeam(1, 'Zigman', 'https://www.valorantfantasyleague.net/team/1', null);
      db.upsertTeam(2, 'Alice', 'https://www.valorantfantasyleague.net/team/2', null);
      db.upsertTeam(3, 'Bren', 'https://www.valorantfantasyleague.net/team/3', null);

      const managers = db.getTeams().map((t) => t.manager);
      expect(managers).toEqual(['Alice', 'Bren', 'Zigman']);
    });
  });

  // -------------------------------------------------------------------------
  // Scores
  // -------------------------------------------------------------------------

  describe('scores', () => {
    beforeEach(() => {
      db.upsertTeam(100, 'Seal', 'https://www.valorantfantasyleague.net/team/100', 'seals kittens');
    });

    it('inserts and retrieves a score via standings', () => {
      db.upsertScore(100, 1, 457, '2026-02-26T00:00:00.000Z');

      const standings = db.getStandings(1);
      expect(standings).toHaveLength(1);
      expect(standings[0]).toMatchObject({
        vfl_id: 100,
        manager: 'Seal',
        game_week: 1,
        points: 457,
      });
    });

    it('updates points on re-upsert for same team + game_week', () => {
      db.upsertScore(100, 1, 100, '2026-02-26T00:00:00.000Z');
      db.upsertScore(100, 1, 200, '2026-02-26T01:00:00.000Z');

      const standings = db.getStandings(1);
      expect(standings).toHaveLength(1);
      expect(standings[0]!.points).toBe(200);
      expect(standings[0]!.scraped_at).toBe('2026-02-26T01:00:00.000Z');
    });

    it('keeps separate rows for different game weeks', () => {
      db.upsertScore(100, 1, 100, '2026-02-26T00:00:00.000Z');
      db.upsertScore(100, 2, 250, '2026-03-05T00:00:00.000Z');

      const history = db.getTeamHistory(100);
      expect(history).toHaveLength(2);
      expect(history[0]!.game_week).toBe(1);
      expect(history[0]!.points).toBe(100);
      expect(history[1]!.game_week).toBe(2);
      expect(history[1]!.points).toBe(250);
    });

    it('returns standings sorted by points descending', () => {
      db.upsertTeam(200, 'Alice', 'https://www.valorantfantasyleague.net/team/200', 'babu world');
      db.upsertTeam(300, 'Bren', 'https://www.valorantfantasyleague.net/team/300', 'LAMBS');

      db.upsertScore(100, 1, 200, '2026-02-26T00:00:00.000Z');
      db.upsertScore(200, 1, 500, '2026-02-26T00:00:00.000Z');
      db.upsertScore(300, 1, 350, '2026-02-26T00:00:00.000Z');

      const standings = db.getStandings(1);
      expect(standings.map((s) => s.points)).toEqual([500, 350, 200]);
      expect(standings.map((s) => s.manager)).toEqual(['Alice', 'Bren', 'Seal']);
    });
  });

  // -------------------------------------------------------------------------
  // getLatestGameWeek
  // -------------------------------------------------------------------------

  describe('getLatestGameWeek', () => {
    it('returns null when no scores exist', () => {
      expect(db.getLatestGameWeek()).toBeNull();
    });

    it('returns the highest game week number', () => {
      db.upsertTeam(100, 'Seal', 'https://www.valorantfantasyleague.net/team/100', null);
      db.upsertScore(100, 1, 100, '2026-02-26T00:00:00.000Z');
      db.upsertScore(100, 3, 300, '2026-03-12T00:00:00.000Z');

      expect(db.getLatestGameWeek()).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // saveScrapeBatch
  // -------------------------------------------------------------------------

  describe('saveScrapeBatch', () => {
    it('saves valid results and skips errored ones', () => {
      const results = [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 457,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: null,
          gameWeek: null,
          points: null,
          scrapedAt: '2026-02-26T00:00:00.000Z',
          error: 'Timeout',
        },
        {
          manager: 'Bren',
          url: 'https://www.valorantfantasyleague.net/team/5989',
          teamName: 'SACRIFICAL LAMBS',
          gameWeek: 1,
          points: 320,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      const saved = db.saveScrapeBatch(results);

      expect(saved).toBe(2);
      expect(db.getTeams()).toHaveLength(2);

      const standings = db.getStandings(1);
      expect(standings).toHaveLength(2);
      expect(standings.map((s) => s.manager)).toEqual(['Seal', 'Bren']); // 457 > 320
    });

    it('skips results with null gameWeek or points', () => {
      const results = [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: null as number | null,
          points: 100,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: 'babu world',
          gameWeek: 1,
          points: null as number | null,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      const saved = db.saveScrapeBatch(results);
      expect(saved).toBe(0);
    });

    it('is atomic — all or nothing on failure', () => {
      // First, insert a valid batch.
      db.saveScrapeBatch([
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 100,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
      ]);
      expect(db.getTeams()).toHaveLength(1);

      // Now try a batch where one entry has an invalid URL (no vfl_id).
      // The whole transaction should roll back.
      const badBatch = [
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: 'babu world',
          gameWeek: 2,
          points: 200,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Bad',
          url: 'https://example.com/invalid',
          teamName: 'oops',
          gameWeek: 2,
          points: 50,
          scrapedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      expect(() => db.saveScrapeBatch(badBatch)).toThrow('Cannot extract VFL ID');

      // Alice should NOT have been saved (transaction rolled back).
      expect(db.getTeams()).toHaveLength(1);
      expect(db.getTeams()[0]!.manager).toBe('Seal');
    });
  });
});
