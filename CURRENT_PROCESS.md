# Current Process

## Context

The Brenlets VFL league is a Fantasy Valorant league managed informally through Discord. At the end of each game week, one person (the commissioner) is responsible for compiling standings and posting them to the group.

VFL (valorantfantasyleague.net) does not expose a public API. All data — team names, player scores, point totals — lives on individual team pages, one per manager.

## What Actually Happens Each Game Week

1. The commissioner manually navigates to each manager's team page on valorantfantasyleague.net.
   - There are currently ~15 managers in the league, meaning ~15 separate page loads.
2. On each page, the commissioner reads the team name and total point score for the game week.
3. All scores are manually compiled and sorted.
4. The commissioner formats the standings as a Discord message (markdown hyperlinks, point totals) and posts it to the league channel.

## Example Output

The final Discord post looks something like this:

```
**Brenlets VFL Final Standings GW1:**
devin ([JOGOMO DA GOAT N HIS MANY HOES](https://www.valorantfantasyleague.net/team/22832)): 457pts
NixX ([1leaf to the starxo](https://www.valorantfantasyleague.net/team/82)): 442pts
...
```

## Pain Points

- Entirely manual. No automation at any step.
- Error-prone — easy to misread a score or miss a team.
- Dependent on one person having the time and motivation to do it.
- No historical record beyond scrolling back through Discord.
- No way for managers to check standings mid-week or on demand.
- Team names change between game weeks and have to be rechecked every time.
