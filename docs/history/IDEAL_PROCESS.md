# Ideal Process

> **Historical document.** This vision has been realized — the app is live and functioning as described below.

## For Managers

A manager can visit a URL at any time and see:

- Current game week standings, sorted by points
- Their own team's rank and score
- Point totals from previous game weeks
- (Stretch) A graph showing score progression across the season

No Discord message required. No waiting on the commissioner. Data is just there.

## For the Commissioner

The commissioner's only ongoing responsibility is maintaining the list of team URLs if a manager joins, leaves, or their VFL team ID changes. Everything else is automated.

At the end of a game week, standings are already updated. The commissioner can optionally still post a summary to Discord, but the source of truth is the website — not a manually typed message.

## Data Freshness

Scores update every 15 minutes after matches conclude via an automated job. Since VFL game weeks don't change by the minute, hourly is sufficient. An on-demand "refresh now" trigger would be a nice-to-have for after game weeks officially close.

## What the Site Looks Like (Roughly)

- Single page, probably.
- Standings table: Rank | Manager | Team Name | GW Points | Season Total
- Game week selector to view historical standings
- Links to each team's VFL page (already familiar to managers)
- Nothing fancy. Readable on mobile. Fast.

## What Success Looks Like

The commissioner stops having to do this manually. Managers can check standings without asking. The historical record exists automatically as game weeks accumulate.
