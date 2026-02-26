# Technical Overview

## Proof of Concept

Before this document was written, the scraping approach was validated manually. Using a browser automation tool, all 15 team pages were fetched successfully with no authentication required, no rate limiting observed, and no JavaScript rendering needed. Page structure was consistent across all teams. Team names and point totals were immediately accessible in the page text.

This means the core data acquisition problem is already solved in principle.

---

## Architecture

```
[ VFL Website ]
      |
      | HTTP GET (nightly cron)
      v
[ Scraper ] --> [ Database ] --> [ Web App ] --> [ Browser ]
```

### Components

**Scraper**

- Fetches each team page by URL
- Parses team name and game week point total from page text
- Writes results to the database with a timestamp and game week identifier
- Runs on a schedule (nightly) or on-demand

**Database**

- Stores a snapshot per team per game week
- Enables historical standings, not just current week
- Schema is simple: teams table (manager name, VFL URL), scores table (team_id, game_week, points, scraped_at)

**Web App**

- Reads from the database
- Renders standings table, sorted by points
- Supports switching between game weeks
- No user accounts, no write operations from the frontend — read-only

**Cron / Scheduler**

- Triggers the scraper on a schedule
- Could be a GitHub Action (free, no server needed), a hosted cron service, or a simple interval on the server

---

## Suggested Stack

These are suggestions, not commitments. Chosen for simplicity and compatibility with an AI-assisted development workflow.

| Layer    | Option                                                  |
| -------- | ------------------------------------------------------- |
| Scraper  | Node.js + Cheerio (no headless browser needed)          |
| Database | PostgreSQL or SQLite (SQLite is fine for this scale)    |
| Web App  | Node.js + Express, or a lightweight framework like Hono |
| Frontend | Plain HTML/CSS or minimal React — nothing complex       |
| Hosting  | Railway or Render (free tiers exist, simple deploys)    |
| Cron     | GitHub Actions scheduled workflow                       |

---

## Known Risks and Constraints

**VFL could add bot detection.**
Currently there is none. If they add rate limiting or require JS execution, the scraper would need to be updated. Low likelihood for a small fan site, but worth noting.

**VFL could change their HTML structure.**
If they redesign the site, the scraper's selectors break. This has happened to every scraper ever written. The fix is usually quick but requires someone to notice and update it.

**Team URLs are static but team names are not.**
Team IDs (e.g. `/team/22832`) don't change, but team names change frequently — managers rename their teams between game weeks. The scraper handles this correctly by re-fetching the name each time rather than storing it once.

**There is no VFL API.**
This is not expected to change. The scraper approach is the only viable path short of VFL building official tooling.

**The team URL list needs manual maintenance.**
If a manager joins or leaves the league, someone has to update the list of URLs the scraper checks. This is a one-time human action per roster change, not ongoing work.

---

## Open Questions

- Where should the team URL list live? Hardcoded in config, a simple JSON file, or a small admin UI?
  - **Decision:** A JSON config file committed to the repo. Roster changes are a one-line edit, which is auditable and requires no admin UI.
- How do we define "game week"? Does VFL expose this anywhere on the page, or do we infer it from the calendar?
  - **Decision:** The scraper will attempt to read the game week number directly from the VFL page HTML. This needs to be verified on the first implementation task (fetch one page, inspect the raw HTML). If it isn't available in the markup, the fallback is commissioner-triggered scrapes with a manually supplied game week label.
- Should the site be public (anyone can visit) or access-controlled (league members only)?
  - **Decision:** Public — anyone with the URL can view standings. A lightweight protected admin area will exist for the commissioner to manage the team list (no full auth system, just access control on that one section). User accounts and membership features are deferred to v2.
- Do we want a Discord bot that posts standings automatically, in addition to or instead of the website?
  - **Decision:** Not in v1. The website is the source of truth. Discord integration is a v2 consideration.

---

## What to Bring Into a Coding Environment

When starting implementation (e.g. Claude Code in VS Code), this document set is the briefing. The most useful starting point is probably:

1. Stand up a scraper that can fetch all 15 team pages and print structured output (name, points, URL)
2. Decide on database and schema
3. Wire scraper output to database writes
4. Build the simplest possible standings page on top of that

Everything else — historical views, polish, hosting — comes after the core loop works.
