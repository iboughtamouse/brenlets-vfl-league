# Copilot Instructions — Brenlets VFL Hub

## What This Project Is

A lightweight web app that automates weekly standings tracking for a Fantasy Valorant league (Brenlets VFL). The commissioner currently visits each team page on valorantfantasyleague.net, reads scores, and posts them to Discord manually. This project eliminates that.

The scraper and database layer are implemented and working. The web app and scheduled automation are next.

## Working Approach

This project is **collaboration-oriented, not solutions-oriented**. Do not rush to "done". Take time to establish correct foundations — version control, testing strategy, schema decisions, stack choices — before writing implementation code. Shortcuts compound. Flag tradeoffs rather than silently picking one.

The workflow is **AI-driven, human-assisted**: AI agents write all code, documentation, and configuration. The human (project owner) reviews every change and makes final calls on architecture and direction.

**Work in small, reviewable chunks.** Each unit of work should be small enough for a human to review in one sitting — typically one logical change (a new module, a schema change, a test file). Do not stack multiple features or major changes into a single review pass. Complete one piece, pause for human review, then proceed. This is non-negotiable.

Documentation should capture **decisions and architecture**, not metrics. Line counts, test counts, and other numerical snapshots drift immediately and produce noise during review. The right things to document are: why a decision was made, what was considered and rejected, and how the system is structured. When updating documentation, update the meaning — not the numbers.

## Architecture

```
[ valorantfantasyleague.net ]
        |
        | Playwright (headless Chromium, nightly cron via GitHub Actions)
        v
[ Scraper (Node.js + Playwright) ] --> [ SQLite ] --> [ Web App (Node.js) ] --> [ Browser ]
```

VFL is a Next.js app — all team data is rendered client-side via JavaScript. Plain HTTP returns only "Loading team data...". Playwright runs a headless browser, waits for the page to fully render, then reads the DOM. No authentication is required.

The VFL API (`api.valorantfantasyleague.net`) was investigated as an alternative but rejected: it requires authentication for game week metadata, auth is unreliable (expires randomly, requires Discord-based registration), and undocumented endpoints could change without notice. Reading the rendered page is more stable and honest — we see exactly what users see.

## Settled Stack Decisions

| Layer    | Decision                                                 |
| -------- | -------------------------------------------------------- |
| Language | TypeScript throughout                                    |
| Scraper  | Node.js + Playwright (headless Chromium)                 |
| Database | SQLite (small league, low volume — no need for Postgres) |
| Web App  | Node.js + Express or Hono (TBD)                          |
| Frontend | Plain HTML/CSS or minimal React (TBD — keep it simple)   |
| Cron     | GitHub Actions scheduled workflow                        |
| Hosting  | Railway or Render (TBD)                                  |

## Team URL List

Managed as a committed JSON config file in the repo. Not hardcoded in source, not in a database table, not behind an admin UI. Roster changes = one-line JSON edit + commit.

## Game Week Identification — Confirmed

The rendered VFL team page displays the game week label directly below the team name (e.g. "GW 1: 0 PTS"). Playwright reads this from the DOM after the page fully renders. No auth required, no inference needed — the label is right there on screen.

The VFL API was investigated as an alternative. It was rejected: game week metadata requires authentication, VFL auth is unreliable (expires randomly, requires Discord-based registration), and undocumented endpoints could change without notice.

## Data Model

- `teams` — `vfl_id` (integer PK, extracted from URL), `manager`, `url`, `team_name`
- `scores` — `team_vfl_id` (FK → teams), `game_week`, `points`, `scraped_at`, with a unique constraint on `(team_vfl_id, game_week)`

Team names are re-fetched on every scrape (they change between game weeks) and stored on the `teams` row — always reflecting the current name. Historical names are not tracked.

Upsert semantics: re-scraping the same game week updates the existing row. All distinct game weeks are preserved for week-over-week history.

## Access Model

- Standings page: **fully public**, no authentication
- Commissioner admin area (manage team list): **lightweight access control** on that one section only — no user accounts, no roles system
- User accounts / membership features: explicitly deferred to v2
- Discord bot: explicitly deferred to v2

## Planned Implementation Order

1. ~~Fetch one team page → inspect HTML → confirm game week parsing approach~~ ✓
2. ~~Scraper that fetches all team pages and outputs structured JSON~~ ✓
3. ~~Define SQLite schema → wire scraper writes to it~~ ✓
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

**Snapshot testing:** Evaluated and rejected. VFL pages contain too much noise (scripts, ads, player rosters, Next.js hydration data) for snapshots to be useful — they'd trip on every irrelevant change and train us to ignore them. The fixture-based selector test already catches the failure we care about: our DOM selectors breaking against VFL's markup.

**Database layer:** Integration tests for the core write/read paths. Confirm schema and queries behave as expected.

**Web app routes:** Minimal smoke tests — routes respond, return correct shape. Thin logic doesn't warrant heavy coverage.

**No E2E browser tests for v1.**

## What Has Not Been Decided Yet

- Express vs Hono
- Plain HTML vs minimal React
- Exact hosting provider
