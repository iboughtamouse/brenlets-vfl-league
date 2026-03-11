import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VflDatabase, extractVflId } from '../../src/db/index.js';

// Tests run against a dedicated vfl_test database in the local Docker Postgres
// container. This keeps test runs from wiping dev data. Each test gets a clean
// slate — tables are dropped and recreated.
const TEST_CONNECTION =
  process.env.TEST_DATABASE_URL ?? 'postgresql://vfl:vfl@localhost:5432/vfl_test';

const EVENT = 'VCT 2026 : Masters Santiago';
const EVENT_2 = 'VCT 2026: Kickoff';

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

  it('throws on empty string', () => {
    expect(() => extractVflId('')).toThrow('Cannot extract VFL ID');
  });
});

describe('VflDatabase', () => {
  let db: VflDatabase;

  beforeEach(async () => {
    db = new VflDatabase(TEST_CONNECTION);
    // Clean slate: drop tables and recreate.
    await db.pool.query('DROP TABLE IF EXISTS scores');
    await db.pool.query('DROP TABLE IF EXISTS teams');
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  describe('teams', () => {
    it('inserts and retrieves a team', async () => {
      await db.upsertTeam(
        22832,
        'devin',
        'https://www.valorantfantasyleague.net/team/22832',
        'JOGOMO',
      );

      const teams = await db.getTeams();
      expect(teams).toHaveLength(1);
      expect(teams[0]).toEqual({
        vfl_id: 22832,
        manager: 'devin',
        url: 'https://www.valorantfantasyleague.net/team/22832',
        team_name: 'JOGOMO',
      });
    });

    it('updates team_name on re-upsert', async () => {
      await db.upsertTeam(
        22832,
        'devin',
        'https://www.valorantfantasyleague.net/team/22832',
        'Old Name',
      );
      await db.upsertTeam(
        22832,
        'devin',
        'https://www.valorantfantasyleague.net/team/22832',
        'New Name',
      );

      const teams = await db.getTeams();
      expect(teams).toHaveLength(1);
      expect(teams[0]!.team_name).toBe('New Name');
    });

    it('returns teams sorted by manager name', async () => {
      await db.upsertTeam(1, 'Zigman', 'https://www.valorantfantasyleague.net/team/1', null);
      await db.upsertTeam(2, 'Alice', 'https://www.valorantfantasyleague.net/team/2', null);
      await db.upsertTeam(3, 'Bren', 'https://www.valorantfantasyleague.net/team/3', null);

      const managers = (await db.getTeams()).map((t) => t.manager);
      expect(managers).toEqual(['Alice', 'Bren', 'Zigman']);
    });
  });

  // -------------------------------------------------------------------------
  // Scores
  // -------------------------------------------------------------------------

  describe('scores', () => {
    beforeEach(async () => {
      await db.upsertTeam(
        100,
        'Seal',
        'https://www.valorantfantasyleague.net/team/100',
        'seals kittens',
      );
    });

    it('inserts and retrieves a score via standings', async () => {
      await db.upsertScore(100, EVENT, 1, 457, '2026-02-26T00:00:00.000Z');

      const standings = await db.getStandings(EVENT, 1);
      expect(standings).toHaveLength(1);
      expect(standings[0]).toMatchObject({
        vfl_id: 100,
        manager: 'Seal',
        event: EVENT,
        game_week: 1,
        points: 457,
      });
    });

    it('updates points on re-upsert for same team + event + game_week', async () => {
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT, 1, 200, '2026-02-26T01:00:00.000Z');

      const standings = await db.getStandings(EVENT, 1);
      expect(standings).toHaveLength(1);
      expect(standings[0]!.points).toBe(200);
      expect(standings[0]!.scraped_at).toBe('2026-02-26T01:00:00.000Z');
    });

    it('keeps separate rows for different game weeks', async () => {
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT, 2, 250, '2026-03-05T00:00:00.000Z');

      const history = await db.getTeamHistory(100, EVENT);
      expect(history).toHaveLength(2);
      expect(history[0]!.game_week).toBe(1);
      expect(history[0]!.points).toBe(100);
      expect(history[1]!.game_week).toBe(2);
      expect(history[1]!.points).toBe(250);
    });

    it('keeps separate rows for same game week across different events', async () => {
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT_2, 1, 999, '2026-02-26T00:00:00.000Z');

      const standingsEvent1 = await db.getStandings(EVENT, 1);
      const standingsEvent2 = await db.getStandings(EVENT_2, 1);

      expect(standingsEvent1).toHaveLength(1);
      expect(standingsEvent1[0]!.points).toBe(100);
      expect(standingsEvent2).toHaveLength(1);
      expect(standingsEvent2[0]!.points).toBe(999);
    });

    it('returns standings sorted by points descending', async () => {
      await db.upsertTeam(
        200,
        'Alice',
        'https://www.valorantfantasyleague.net/team/200',
        'babu world',
      );
      await db.upsertTeam(300, 'Bren', 'https://www.valorantfantasyleague.net/team/300', 'LAMBS');

      await db.upsertScore(100, EVENT, 1, 200, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(200, EVENT, 1, 500, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(300, EVENT, 1, 350, '2026-02-26T00:00:00.000Z');

      const standings = await db.getStandings(EVENT, 1);
      expect(standings.map((s) => s.points)).toEqual([500, 350, 200]);
      expect(standings.map((s) => s.manager)).toEqual(['Alice', 'Bren', 'Seal']);
    });
  });

  // -------------------------------------------------------------------------
  // getLatestGameWeek
  // -------------------------------------------------------------------------

  describe('getLatestGameWeek', () => {
    it('returns null when no scores exist', async () => {
      expect(await db.getLatestGameWeek(EVENT)).toBeNull();
    });

    it('returns the highest game week number for an event', async () => {
      await db.upsertTeam(100, 'Seal', 'https://www.valorantfantasyleague.net/team/100', null);
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT, 3, 300, '2026-03-12T00:00:00.000Z');

      expect(await db.getLatestGameWeek(EVENT)).toBe(3);
    });

    it('scopes game weeks to the correct event', async () => {
      await db.upsertTeam(100, 'Seal', 'https://www.valorantfantasyleague.net/team/100', null);
      await db.upsertScore(100, EVENT, 3, 300, '2026-03-12T00:00:00.000Z');
      await db.upsertScore(100, EVENT_2, 1, 50, '2026-01-01T00:00:00.000Z');

      expect(await db.getLatestGameWeek(EVENT)).toBe(3);
      expect(await db.getLatestGameWeek(EVENT_2)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getLatestEvent / getEvents / getGameWeeksForEvent
  // -------------------------------------------------------------------------

  describe('event queries', () => {
    beforeEach(async () => {
      await db.upsertTeam(100, 'Seal', 'https://www.valorantfantasyleague.net/team/100', null);
    });

    it('getLatestEvent returns null when no scores exist', async () => {
      expect(await db.getLatestEvent()).toBeNull();
    });

    it('getLatestEvent returns the most recently inserted event', async () => {
      await db.upsertScore(100, EVENT_2, 1, 50, '2026-01-01T00:00:00.000Z');
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');

      expect(await db.getLatestEvent()).toBe(EVENT);
    });

    it('getEvents returns all distinct events', async () => {
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT_2, 1, 50, '2026-01-01T00:00:00.000Z');

      const events = await db.getEvents();
      expect(events).toHaveLength(2);
      expect(events).toContain(EVENT);
      expect(events).toContain(EVENT_2);
    });

    it('getGameWeeksForEvent returns weeks descending for an event', async () => {
      await db.upsertScore(100, EVENT, 1, 100, '2026-02-26T00:00:00.000Z');
      await db.upsertScore(100, EVENT, 3, 300, '2026-03-12T00:00:00.000Z');
      await db.upsertScore(100, EVENT_2, 1, 50, '2026-01-01T00:00:00.000Z');

      expect(await db.getGameWeeksForEvent(EVENT)).toEqual([3, 1]);
      expect(await db.getGameWeeksForEvent(EVENT_2)).toEqual([1]);
    });
  });

  // -------------------------------------------------------------------------
  // saveFetchBatch
  // -------------------------------------------------------------------------

  describe('saveFetchBatch', () => {
    it('saves valid results and skips errored ones', async () => {
      const results = [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 457,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: null,
          gameWeek: null,
          points: null,
          fetchedAt: '2026-02-26T00:00:00.000Z',
          error: 'Timeout',
        },
        {
          manager: 'Bren',
          url: 'https://www.valorantfantasyleague.net/team/5989',
          teamName: 'SACRIFICAL LAMBS',
          gameWeek: 1,
          points: 320,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      const saved = await db.saveFetchBatch(EVENT, results);

      expect(saved).toBe(2);
      expect(await db.getTeams()).toHaveLength(2);

      const standings = await db.getStandings(EVENT, 1);
      expect(standings).toHaveLength(2);
      expect(standings.map((s) => s.manager)).toEqual(['Seal', 'Bren']); // 457 > 320
    });

    it('skips results with null gameWeek or points', async () => {
      const results = [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: null as number | null,
          points: 100,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: 'babu world',
          gameWeek: 1,
          points: null as number | null,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      const saved = await db.saveFetchBatch(EVENT, results);
      expect(saved).toBe(0);
    });

    it('is atomic — all or nothing on failure', async () => {
      // First, insert a valid batch.
      await db.saveFetchBatch(EVENT, [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 100,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ]);
      expect(await db.getTeams()).toHaveLength(1);

      // Now try a batch where one entry has an invalid URL (no vfl_id).
      // The whole transaction should roll back.
      const badBatch = [
        {
          manager: 'Alice',
          url: 'https://www.valorantfantasyleague.net/team/32627',
          teamName: 'babu world',
          gameWeek: 2,
          points: 200,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Bad',
          url: 'https://example.com/invalid',
          teamName: 'oops',
          gameWeek: 2,
          points: 50,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ];

      await expect(db.saveFetchBatch(EVENT, badBatch)).rejects.toThrow('Cannot extract VFL ID');

      // Alice should NOT have been saved (transaction rolled back).
      expect(await db.getTeams()).toHaveLength(1);
      expect((await db.getTeams())[0]!.manager).toBe('Seal');
    });
  });

  // -------------------------------------------------------------------------
  // Event Total Standings
  // -------------------------------------------------------------------------

  describe('getEventTotalStandings', () => {
    it('sums points across game weeks and sorts descending', async () => {
      await db.saveFetchBatch(EVENT, [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 100,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 2,
          points: 300,
          fetchedAt: '2026-03-05T00:00:00.000Z',
        },
        {
          manager: 'Bren',
          url: 'https://www.valorantfantasyleague.net/team/5989',
          teamName: 'SACRIFICAL LAMBS',
          gameWeek: 1,
          points: 200,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          manager: 'Bren',
          url: 'https://www.valorantfantasyleague.net/team/5989',
          teamName: 'SACRIFICAL LAMBS',
          gameWeek: 2,
          points: 150,
          fetchedAt: '2026-03-05T00:00:00.000Z',
        },
      ]);

      const standings = await db.getEventTotalStandings(EVENT);
      expect(standings).toHaveLength(2);

      // Seal: 100 + 300 = 400, Bren: 200 + 150 = 350 → Seal first
      expect(standings[0]!.manager).toBe('Seal');
      expect(Number(standings[0]!.points)).toBe(400);
      expect(standings[1]!.manager).toBe('Bren');
      expect(Number(standings[1]!.points)).toBe(350);
    });

    it('returns empty array when no scores exist for event', async () => {
      const standings = await db.getEventTotalStandings(EVENT);
      expect(standings).toHaveLength(0);
    });

    it('only includes scores from the requested event', async () => {
      await db.saveFetchBatch(EVENT, [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 100,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ]);
      await db.saveFetchBatch(EVENT_2, [
        {
          manager: 'Seal',
          url: 'https://www.valorantfantasyleague.net/team/4617',
          teamName: 'seals kittens',
          gameWeek: 1,
          points: 999,
          fetchedAt: '2026-02-26T00:00:00.000Z',
        },
      ]);

      const standings = await db.getEventTotalStandings(EVENT);
      expect(standings).toHaveLength(1);
      expect(Number(standings[0]!.points)).toBe(100);
    });
  });
});
