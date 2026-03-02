# Brenlets VFL Hub

Automated standings tracker for the [Brenlets VFL](https://www.valorantfantasyleague.net/) fantasy Valorant league. Scrapes team pages on a schedule after matches conclude, stores scores in Postgres, and serves a public standings page.

**Live at:** [brenlets-vfl-league.vercel.app](https://brenlets-vfl-league.vercel.app/)

## Working Approach

This project is **AI-driven, human-assisted**: AI agents write all code, documentation, and configuration. The human (project owner) reviews every change and makes final calls on architecture and direction.

- **Collaboration-oriented, not solutions-oriented.** Don't rush to "done". Take time to establish correct foundations. Shortcuts compound. Flag tradeoffs rather than silently picking one.
- **Small, reviewable chunks.** Each unit of work should be one logical change — a new module, a schema change, a test file. Complete one piece, pause for human review, then proceed.
- **Document decisions and architecture, not metrics.** Line counts, test counts, and other numerical snapshots drift immediately. Document _why_ a decision was made, what was considered and rejected, and how the system is structured.

## Architecture

```
[ valorantfantasyleague.net ]
        |
        | Playwright (headless Chromium, scheduled via GitHub Actions)
        v
[ Scraper (GitHub Actions) ] --> [ Postgres (Railway) ] <-- [ Web App (Vercel) ] --> [ Browser ]
```

- **Scraper** runs in GitHub Actions on a schedule. Writes directly to Railway Postgres.
- **Database** is Postgres on Railway. Accessible from both GitHub Actions and Vercel.
- **Web app** is Hono (API) + Preact (frontend) on Vercel. Reads from Postgres.

VFL is a Next.js app — all team data is rendered client-side. Playwright runs headless Chromium, waits for the page to render, then reads the DOM. No authentication required.

## Key Files

```
config/teams.json         — League roster (manager name + VFL URL)
src/scraper/parser.ts     — parseGwLabel + normalizeEventName (pure functions)
src/scraper/index.ts      — Playwright scraper (scrapeAll, scrapeCurrentEvent, extractTeamData)
src/db/index.ts           — VflDatabase class (schema, queries, batch save)
src/web/app.ts            — Hono API routes (shared by dev server + Vercel)
src/web/server.ts         — Local dev server (@hono/node-server + static files)
api/index.ts              — Vercel serverless entry point (re-exports Hono app)
client/src/App.tsx        — Preact frontend (single component, retro GeoCities aesthetic)
scripts/scrape-all.ts     — CLI entry: scrape all teams → save to DB
fixtures/                 — Saved HTML fixture for testing
tests/                    — Vitest unit + integration tests
.github/workflows/        — GitHub Actions (scheduled scraping)
```

## Data Model

See `src/db/index.ts` for the DDL. Two tables:

- **teams** — `vfl_id` (integer PK from URL), `manager`, `url`, `team_name`
- **scores** — `team_vfl_id` (FK → teams), `event`, `game_week`, `points`, `scraped_at`, with `UNIQUE(team_vfl_id, event, game_week)`

Upsert semantics: re-scraping the same event + game week updates the existing row rather than duplicating. All distinct event + game week combinations are preserved for history. Team names are re-fetched on every scrape (they change between game weeks).

## API Routes

See `src/web/app.ts` for implementation. All params optional, defaulting to latest event/week.

- `GET /health` — DB connectivity check
- `GET /api/standings/events` — list all events + latest
- `GET /api/standings/weeks?event=X` — game weeks for an event (descending)
- `GET /api/standings?event=X&gw=N` — standings for an event + game week

## Scraping Flow

1. `scrapeCurrentEvent` visits `/leaderboard`, reads the "Current Event" dropdown → event name. `normalizeEventName` strips trailing ": Week N" suffixes (VFL appends these once matches begin; we store the base event name only).
2. `scrapeAll` iterates `config/teams.json`, visits each team page sequentially
3. Waits for `[data-testid="team-page"]`, extracts team name (`.text-5xl`) and GW label (`.text-5xl .text-2xl`)
4. `parseGwLabel` parses "GW N: X PTS" via regex
5. `saveScrapeBatch` upserts all teams + scores in a single transaction (atomic — rolls back on any failure)

## Commands

```bash
npm test              # Vitest (unit + integration)
npm run scrape        # Run scraper, save to DB
npm run dev:server    # Local dev server (API + client)
npm run lint          # ESLint
npm run format        # Prettier
```

## Tooling

- **Conventional Commits** enforced by commitlint + Husky (`commit-msg` hook)
- **Prettier + ESLint** run automatically on pre-commit hook — don't document style rules, the tools enforce them
- **GitHub Actions** runs the scraper hourly from 7PM–10AM Eastern (after matches conclude) and on push to `config/teams.json`

## Testing Strategy

- **Parser unit tests** (`tests/scraper/parser.test.ts`) — regex edge cases for GW labels and event name normalization
- **Fixture-based DOM tests** (`tests/scraper/fixture.test.ts`) — scraper selectors against saved HTML from a real VFL page. When VFL changes their markup, this test breaks and shows exactly what changed.
- **DB integration tests** (`tests/db/index.test.ts`) — runs against a dedicated `vfl_test` database in the local Docker Postgres container, isolated from dev data. Tests upsert semantics, transactions, standings queries.
- No snapshot tests (evaluated and rejected — see `docs/architecture.md`)
- No E2E browser tests for v1

## Deeper Reading

- [docs/architecture.md](docs/architecture.md) — Stack decisions, component details, VFL API investigation, risks, testing philosophy
- [docs/decisions/](docs/decisions/) — Design docs for completed features (event model, etc.)
- [docs/history/](docs/history/) — Historical planning docs (original process, ideal process, implementation plan)
