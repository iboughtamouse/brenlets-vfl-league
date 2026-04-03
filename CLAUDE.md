# Brenlets VFL Hub

Automated standings tracker for the [Brenlets VFL](https://www.valorantfantasyleague.net/) fantasy Valorant league. Fetches scores from the VFL JSON API on a schedule after matches conclude, stores them in Postgres, and serves a public standings page.

**Live at:** [brenlets-vfl-league.vercel.app](https://brenlets-vfl-league.vercel.app/)

## Working Approach

This project is **AI-driven, human-assisted**: AI agents write all code, documentation, and configuration. The human (project owner) reviews every change and makes final calls on architecture and direction.

- **Collaboration-oriented, not solutions-oriented.** Don't rush to "done". Take time to establish correct foundations. Shortcuts compound. Flag tradeoffs rather than silently picking one.
- **Small, reviewable chunks.** Each unit of work should be one logical change — a new module, a schema change, a test file. Complete one piece, pause for human review, then proceed.
- **Document decisions and architecture, not metrics.** Line counts, test counts, and other numerical snapshots drift immediately. Document _why_ a decision was made, what was considered and rejected, and how the system is structured.

## Architecture

```
[ api.valorantfantasyleague.net ]
        |
        | JSON API (scheduled via GitHub Actions)
        v
[ Fetcher (GitHub Actions) ] --> [ Postgres (Railway) ] <-- [ Web App (Vercel) ] --> [ Browser ]
```

- **Fetcher** runs in GitHub Actions on a schedule. Calls VFL's JSON API and writes to Railway Postgres.
- **Database** is Postgres on Railway. Accessible from both GitHub Actions and Vercel.
- **Web app** is Hono (API) + Preact (frontend) on Vercel. Reads from Postgres.

VFL exposes a public JSON API. Two key endpoints:

- `GET /api/event/currentevent` — event metadata, gameweek periods, match completion status
- `GET /api/fantasyteam/team?userId=N&eventId=N&gameweek=N` — individual team scores

## Key Files

```
config/teams.json         — League roster (manager name + VFL URL)
src/scraper/index.ts      — VFL API client (fetchAll, fetchCurrentEvent, scoreableGameweeks)
src/db/index.ts           — VflDatabase class (schema, queries, batch save)
src/web/app.ts            — Hono API routes (shared by dev server + Vercel)
src/web/server.ts         — Local dev server (@hono/node-server + static files)
api/index.ts              — Vercel serverless entry point (re-exports Hono app)
client/src/App.tsx        — Preact frontend (single component, retro GeoCities aesthetic)
scripts/fetch-all.ts      — CLI entry: fetch all teams → save to DB
tests/                    — Vitest unit + integration tests
.github/workflows/        — GitHub Actions (scheduled fetching)
```

## Data Model

See `src/db/index.ts` for the DDL. Two tables:

- **teams** — `vfl_id` (integer PK from URL), `manager`, `url`, `team_name`
- **scores** — `team_vfl_id` (FK → teams), `event`, `game_week`, `points`, `scraped_at`, with `UNIQUE(team_vfl_id, event, game_week)`

Upsert semantics: re-fetching the same event + game week updates the existing row rather than duplicating. All distinct event + game week combinations are preserved for history. Team names are re-fetched on every run (they change between game weeks).

## API Routes

See `src/web/app.ts` for implementation. All params optional, defaulting to latest event/week.

- `GET /health` — DB connectivity check
- `GET /api/standings/events` — list all events + latest
- `GET /api/standings/weeks?event=X` — game weeks for an event (descending)
- `GET /api/standings?event=X&gw=N` — standings for an event + game week

## Fetching Flow

1. `fetchCurrentEvent()` calls `/api/event/currentevent` → event metadata including matches with `havePointsBeenAssigned` flags
2. `scoreableGameweeks(event)` filters to gameweeks where at least one match has points assigned (prevents writing 0-point rows for unplayed GWs)
3. `fetchAll(teams)` iterates all scoreable GWs × all teams from `config/teams.json`, calling `/api/fantasyteam/team` for each
4. `saveFetchBatch` upserts all teams + scores in a single transaction (atomic — rolls back on any failure)

## Commands

```bash
npm test              # Vitest (unit + integration)
npm run fetch         # Run fetcher, save to DB
npm run dev:server    # Local dev server (API + client)
npm run lint          # ESLint
npm run format        # Prettier
```

## Tooling

- **Conventional Commits** enforced by commitlint + Husky (`commit-msg` hook)
- **Prettier + ESLint** run automatically on pre-commit hook — don't document style rules, the tools enforce them
- **GitHub Actions** runs the fetcher every 15 minutes, all day (VCT runs across Pacific, EMEA, and Americas time zones so matches can conclude at any hour) and on push to `config/teams.json`

## Testing Strategy

- **API client unit tests** (`tests/scraper/parser.test.ts`) — `extractUserId` URL parsing, `scoreableGameweeks` match filtering logic
- **DB integration tests** (`tests/db/index.test.ts`) — runs against a dedicated `vfl_test` database in the local Docker Postgres container, isolated from dev data. Tests upsert semantics, transactions, standings queries.
- No snapshot tests (evaluated and rejected — see `docs/architecture.md`)

## Deeper Reading

- [docs/architecture.md](docs/architecture.md) — Stack decisions, component details, VFL API investigation, risks, testing philosophy
- [docs/decisions/](docs/decisions/) — Design docs for completed features (event model, etc.)
- [docs/history/](docs/history/) — Historical planning docs (original process, ideal process, implementation plan)
