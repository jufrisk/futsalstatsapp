# AI Coding Agent Prompt – Futsal Stats App v2

Build the application described in:

- README.md
- TECHNICAL_SPEC.md
- UX_AND_RULES.md

These files are authoritative.

## Product

A tablet-first, offline-first futsal match and season statistics application.

## MVP constraints

NO backend.
NO authentication.
NO cloud database.
NO Azure dependency.
NO Palloliitto/Taso API in MVP.

Use static PWA hosting only.

All user data lives in IndexedDB.

## Stack

- React
- TypeScript
- Vite
- Tailwind
- Dexie.js
- IndexedDB
- vite-plugin-pwa
- Zod
- Vitest
- Playwright

## Main navigation

```text
Matches | Players | Season
```

Matches is the default view.

## Matches screen

Display all matches for the active season.

Support:

- create new match
- future matches
- live match continuation
- completed match statistics
- editing completed matches

## Critical live match behavior

Do NOT implement a continuously running match clock as a required workflow.

For every goal, ask the user to enter the official futsal clock time manually as MM:SS.

Store:

```ts
period
matchTimeSeconds
```

## Event sourcing

The event log is the source of truth.

```text
initial state + ordered events = match state
```

Do not persist authoritative match or season statistic totals.

Recalculate them from events.

## Own goal flow

```text
tap OWN GOAL
→ enter official match time
→ select scorer
→ select optional assister
→ store current lineup in event
→ persist immediately
```

## Opponent goal flow

```text
tap OPPONENT GOAL
→ enter official match time
→ store current lineup
→ persist immediately
```

## Substitution

```text
tap court player
→ tap bench player
→ persist substitution
```

## Plus/minus

Own goal:
current lineup gets +1.

Opponent goal:
current lineup gets -1.

## Error correction

Must support all of:

1. Undo last event
2. Open any event
3. Edit event
4. Delete event

A goal edit must support changing:

- period
- match time
- scorer
- assister
- lineup

After any edit, rebuild all statistics.

## Completed match

A FINISHED match is NOT immutable.

Users must be able to edit completed matches.

## Season statistics

Aggregate all matches dynamically.

Player stats:

- appearances
- goals
- assists
- points
- plus
- minus
- plusMinus

Editing an old match must automatically change season totals.

## Persistence

Persist every event immediately to IndexedDB.

Reloading the browser must restore live state exactly.

## Offline

The application shell must work offline via PWA caching.

No live match feature may require internet.

## Export

Implement:

- player stats CSV
- match events CSV
- single-match JSON
- full application JSON backup
- JSON restore

## Future integration

Do not implement Palloliitto/Taso integration.

Only reserve data-model fields such as:

```ts
source: "MANUAL" | "PALLOLIITTO" | "RECONCILED"
externalMatchId?
externalEventId?
```

The MVP uses MANUAL only.

## Required tests

Unit:

- goal
- opponent goal
- scorer
- assist
- plus/minus
- substitutions
- manual match-time parsing
- undo
- event editing
- event deletion
- lineup correction
- rebuild after reload
- season aggregation
- old-match correction changes season stats

E2E:

Create a full season, players and a match, run live stats, correct errors, finish the match, edit a completed goal and verify season totals update.

## Priority

1. data reliability
2. fast touch UX
3. easy correction
4. offline reliability
5. season statistics
6. visual polish

Keep the app runnable after every implementation phase.


---

## Mandatory jersey-number requirement

Every player MUST have a jersey number.

Player name is OPTIONAL.

The application must fully support number-only players.

Examples:

```text
#9
#14
```

When a name exists:

```text
#9 Sofia
```

Never display a player's name without the jersey number in match-related UI.

The jersey number must be visible in:

- player management
- roster selection
- starting five
- court
- bench
- scorer selection
- assist selection
- event log
- match statistics
- season statistics
- CSV exports

Store `playerNumber` and optional `playerName` snapshots in the match roster so historical matches retain the number used in that match even if player master data is edited later.

Add automated tests for number-only players and historical number snapshots.


---

## Match-specific jersey number override

Implement separate default and match-specific jersey numbers.

```ts
Player.number
```

is the team-level default.

```ts
MatchPlayer.playerNumber
```

is the number used in that individual match.

When creating a match roster, initialize:

```ts
MatchPlayer.playerNumber = Player.number
```

The roster UI must let the user edit this number inline.

Example:

```text
[x] [17] Sofia
```

Changing it must affect only the current match.

It MUST NOT modify `Player.number`.

All match-specific UI and exports must display `MatchPlayer.playerNumber`.

The next newly-created match must again inherit the current `Player.number`.

Selected roster players must have unique match-specific jersey numbers. Block match start if duplicates exist.

Add tests covering inheritance, override isolation, historical preservation and exports.


---

## Own-team-only statistics and optional goal details

Track player-level data for the user's own team only.

### Own goal

Minimum valid workflow:

```text
OWN GOAL
→ enter match time
→ capture current own-team lineup
→ save
```

Optional:

```text
scorer
assist
```

Both scorer and assist belong to the own team and both may be omitted.

The user must be able to add, edit or remove these optional fields later.

### Opponent goal

Workflow:

```text
OPPONENT GOAL
→ enter match time
→ capture current own-team lineup
→ save
```

Never ask for or store:

- opponent scorer
- opponent assist
- opponent lineup
- opponent player names
- opponent jersey numbers

The opponent goal exists only to update the score and assign minus values to own-team players on court.

### Plus/minus independence

Plus/minus must work correctly even if no scorer or assist is ever entered for any own-team goal.

Add tests for:

- own goal without scorer
- own goal without assist
- own goal with scorer only
- own goal with scorer and assist
- opponent goal containing only own-team lineup
- opponent goal UI having no opponent-player fields
