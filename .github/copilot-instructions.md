# Copilot Instructions — Brenlets VFL Hub

## What This Project Is

A lightweight web app that automates weekly standings tracking for a ~15-person Fantasy Valorant league (Brenlets VFL). Currently the commissioner manually visits 15 team pages on valorantfantasyleague.net, reads scores, and posts them to Discord. This project eliminates that.

No code exists yet. This is an active, early-stage build.

## Working Approach

This project is **collaboration-oriented, not solutions-oriented**. Do not rush to "done". Take time to establish correct foundations — version control, testing strategy, schema decisions, stack choices — before writing implementation code. Shortcuts compound. Flag tradeoffs rather than silently picking one.

The workflow is **AI-driven, human-assisted**: AI agents write all code, documentation, and configuration. The human (project owner) reviews every change and makes final calls on architecture and direction.

Documentation should capture **decisions and architecture**, not metrics. Line counts, test counts, and other numerical snapshots drift immediately and produce noise during review. The right things to document are: why a decision was made, what was considered and rejected, and how the system is structured. When updating documentation, update the meaning — not the numbers.

## Architecture

```
[ valorantfantasyleague.net ]
        |
        | HTTP GET (nightly cron via GitHub Actions)
        v
[ Scraper (Node.js + Cheerio) ] --> [ SQLite ] --> [ Web App (Node.js) ] --> [ Browser ]
```

VFL exposes no public API. All data is scraped from individual team pages (e.g. `https://www.valorantfantasyleague.net/team/22832`). No authentication is required, no JS rendering needed — confirmed via PoC.

## Settled Stack Decisions

| Layer    | Decision                                                  |
| -------- | --------------------------------------------------------- |
| Language | TypeScript throughout                                     |
| Scraper  | Node.js + Cheerio                                         |
| Database | SQLite (15 teams × ~52 game weeks — no need for Postgres) |
| Web App  | Node.js + Express or Hono (TBD)                           |
| Frontend | Plain HTML/CSS or minimal React (TBD — keep it simple)    |
| Cron     | GitHub Actions scheduled workflow                         |
| Hosting  | Railway or Render (TBD)                                   |

## Team URL List

Managed as a committed JSON config file in the repo. Not hardcoded in source, not in a database table, not behind an admin UI. Roster changes = one-line JSON edit + commit.

## Game Week Identification — Needs Verification

The scraper is intended to read the game week number directly from VFL page HTML. **This has not been confirmed yet.** The first implementation task must be: fetch one team page, inspect raw HTML, and verify whether a game week label is present in the markup. If it is not, the fallback is commissioner-triggered scrapes with a manually supplied game week label.

Do not build the data model around game week parsing until this is verified.

## Data Model (Intended)

- `teams` — manager name, VFL team URL
- `scores` — team_id, game_week, points, scraped_at

Team names are re-fetched on every scrape (they change between game weeks). They are not stored once at setup time.

## Access Model

- Standings page: **fully public**, no authentication
- Commissioner admin area (manage team list): **lightweight access control** on that one section only — no user accounts, no roles system
- User accounts / membership features: explicitly deferred to v2
- Discord bot: explicitly deferred to v2

## Planned Implementation Order

1. Fetch one team page → inspect HTML → confirm game week parsing approach
2. Scraper that fetches all team pages and outputs structured JSON
3. Define SQLite schema → wire scraper writes to it
4. Standings web page (read-only, public)
5. GitHub Actions cron job
6. Commissioner admin area (last — it's the only piece requiring access control)

## Commit Convention

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) standard. This is enforced via commitlint + Husky at the `commit-msg` hook level — non-conforming messages will be rejected.

Examples:

- `feat: add standings page`
- `fix: handle missing game week label in scraper`
- `chore: update teams.json with new manager`
- `test: add parser unit tests`
- `docs: update architecture overview`

## Code Style

Formatting and linting are automated — do not maintain style preferences in documentation.

- **Prettier** (`.prettierrc`): enforces formatting. Run `npm run format` to format, `npm run format:check` to verify.
- **ESLint** (`eslint.config.js`): TypeScript-aware linting via `typescript-eslint`. Run `npm run lint`.
- **Pre-commit hook**: runs `lint` and `format:check` automatically before every commit.

## Testing Strategy

**Framework:** Vitest. Zero config, ESM-native, current standard for new Node.js projects.

**Scraper** is the highest-value test target — most fragile, hardest to debug silently.

- Save real HTML from a VFL team page as a fixture file
- Unit test parser functions against that fixture with explicit assertions (e.g. `expect(result.points).toBe(457)`) — not snapshots
- When VFL changes their markup, a failing test identifies exactly which field broke

**Snapshot testing:** Deferred. After the scraper is implemented and we've seen what the HTML actually looks like, evaluate whether snapshotting the raw HTML fixture is a worthwhile early-warning layer for structural drift. Do not assume it's needed — verify first.

**Database layer:** Integration tests for the core write/read paths. Confirm schema and queries behave as expected.

**Web app routes:** Minimal smoke tests — routes respond, return correct shape. Thin logic doesn't warrant heavy coverage.

**No E2E browser tests for v1.**

## What Has Not Been Decided Yet

- Express vs Hono
- Plain HTML vs minimal React
- Exact hosting provider
- Whether game week is parsed from the page or manually labelled
