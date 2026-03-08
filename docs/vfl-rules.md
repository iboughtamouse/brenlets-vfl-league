# VFL Scoring Rules

Reference: https://www.valorantfantasyleague.net/rules

## Squad Composition

- 6 players: 1 Initiator, 1 Duelist, 1 Controller, 1 Sentinel, 2 Wildcards (any role)
- Budget ≤ 50 VP total
- Max 2 players from the same VCT team

## IGL

Each gameweek, one player is designated the IGL. That player **scores double points** for the week. This is the `isIgl` field in the API.

## Wildcards

The 2 wildcard slots are **role-flexible roster positions only** — they have no effect on scoring. `isWildcard: true` in the API means the player occupies one of those flexible slots.

## Scoring

### General

Players only score their **top 2 map scores** per gameweek. A player who scores 10, 8, 5 across 3 maps receives 18 points, not 23.

### Kills (per map)

| Condition | Points                                               |
| --------- | ---------------------------------------------------- |
| 0 kills   | -3                                                   |
| 1–4 kills | -1                                                   |
| 10+ kills | +1, then +1 per additional 5 kills (15=+2, 20=+3, …) |

### Multi-kills in a Round

| Condition | Points |
| --------- | ------ |
| 4K        | +1     |
| 5K+       | +3     |
| 6K        | +5     |
| 7K        | +10    |

### Map Wins

| Condition          | Points |
| ------------------ | ------ |
| Any map win        | +1     |
| Win by 5–9 rounds  | +1     |
| Win by 10+ rounds  | +2     |
| Lose by 10+ rounds | -1     |
| 13-0 map win       | +5     |
| 0-13 map loss      | -5     |

### Series Wins

| Condition      | Points |
| -------------- | ------ |
| 2-0 series win | +2     |
| 3-0 series win | +4     |
| 3-1 series win | +1     |

### Bonus Points (VLR Rating)

Based on average VLR rating across all maps played in the match.

| Condition                      | Points |
| ------------------------------ | ------ |
| Highest avg VLR rating on team | +3     |
| Second highest                 | +2     |
| Third highest                  | +1     |
| 1.5+ avg VLR rating            | +1     |
| 1.75+ avg VLR rating           | +2     |
| 2.0+ avg VLR rating            | +3     |

## API Fields

The `/api/fantasyteam/team` endpoint returns per-player point breakdowns:

- `totalEventPoints` — cumulative points across all gameweeks in the event
- `currentGameweekPoints` — points for the current/active gameweek (zeros when no matches live)
- Both split into `killPoints`, `mapPoints`, `bonusPoints`, `totalPoints`
- `isIgl` — this player is the IGL this gameweek (their `totalPoints` already reflects the 2x multiplier in `gameweekPoints`)
- `isWildcard` — this player occupies a wildcard roster slot (no scoring effect)
