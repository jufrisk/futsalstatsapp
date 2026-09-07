# Futsal Stats App – Technical Specification v2

## 1. Stack

```text
React
TypeScript
Vite
Tailwind CSS
Dexie.js
IndexedDB
vite-plugin-pwa
Zod
date-fns
Vitest
Playwright
```

Ei backendia MVP:ssä.

---

# 2. Arkkitehtuuriperiaate

Ottelun tapahtumaloki on source of truth.

```text
initial state
+
ordered events
=
current match state
```

Pelaajien ottelu- tai kausitilastoja ei käytetä lähdedatana.

---

# 3. Projektirakenne

```text
src/
├── app/
├── components/
├── domain/
│   ├── season.ts
│   ├── team.ts
│   ├── player.ts
│   ├── match.ts
│   ├── matchEvent.ts
│   └── statistics.ts
├── features/
│   ├── seasons/
│   ├── matches/
│   ├── players/
│   ├── liveMatch/
│   ├── statistics/
│   └── exports/
├── db/
├── services/
│   ├── matchEngine.ts
│   ├── statisticsEngine.ts
│   ├── seasonStatisticsEngine.ts
│   └── exportService.ts
└── tests/
```

---

# 4. Season

```ts
export interface Season {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Esimerkki:

```json
{
  "name": "2026–27"
}
```

---

# 5. Team

```ts
export interface Team {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

---

# 6. Player

```ts
export interface Player {
  id: string;
  teamId: string;

  // Required jersey number.
  number: number;

  // Optional. The app must work with number-only players.
  name?: string;

  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

# 7. Match

```ts
export type MatchStatus =
  | "DRAFT"
  | "READY"
  | "LIVE"
  | "FINISHED";

export type MatchVenue =
  | "HOME"
  | "AWAY";

export interface Match {
  id: string;
  seasonId: string;
  teamId: string;

  opponentName: string;
  date: string;
  venue: MatchVenue;

  status: MatchStatus;

  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}
```

Tulosta ei tarvitse tallentaa authoritative-kenttänä.

Se voidaan laskea tapahtumista.

---

# 8. Match roster

```ts
export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;

  // Historical snapshot for this specific match.
  playerNumber: number;
  playerName?: string;

  selected: boolean;
  startingLineup: boolean;
}
```

---

# 9. Event types

```ts
export type MatchEventType =
  | "MATCH_STARTED"
  | "SUBSTITUTION"
  | "OWN_GOAL"
  | "OPPONENT_GOAL"
  | "PERIOD_CHANGED"
  | "MATCH_FINISHED";
```

---

# 10. MatchEvent

```ts
export type EventSource =
  | "MANUAL"
  | "PALLOLIITTO"
  | "RECONCILED";

export interface MatchEvent {
  id: string;

  matchId: string;

  type: MatchEventType;

  sequence: number;

  period: 1 | 2;

  matchTimeSeconds?: number;

  source: EventSource;

  createdAt: string;
  updatedAt: string;

  payload: MatchEventPayload;
}
```

MVP käyttää:

```text
source = MANUAL
```

---

# 11. Own goal payload

```ts
export interface OwnGoalPayload {
  // Optional own-team scorer.
  scorerPlayerId?: string;

  // Optional own-team assister.
  assistPlayerId?: string;

  // Own-team players on court at the time of the goal.
  lineupPlayerIds: string[];
}
```

---

# 12. Opponent goal payload

```ts
export interface OpponentGoalPayload {
  // Own-team players on court at the time the opponent scored.
  lineupPlayerIds: string[];
}
```

---

# 13. Substitution payload

```ts
export interface SubstitutionPayload {
  playerOutId: string;
  playerInId: string;
  lineupAfter: string[];
}
```

---

# 14. Maaliaika

Peliaika syötetään käsin.

UI näyttää:

```text
MM:SS
```

Tietokantaan:

```ts
matchTimeSeconds: number
```

Esimerkiksi:

```text
07:34 -> 454
```

Helper:

```ts
function parseMatchTime(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}
```

Validointi:

```text
0 <= minutes <= 20
0 <= seconds <= 59
```

Tarvittaessa voidaan sallia kilpailukohtaisesti muu maksimiaika myöhemmin.

---

# 15. MatchState

```ts
export interface MatchState {
  ownScore: number;
  opponentScore: number;

  currentPeriod: 1 | 2;

  lineupPlayerIds: string[];

  playerStats: Record<string, PlayerMatchStats>;
}
```

---

# 16. PlayerMatchStats

```ts
export interface PlayerMatchStats {
  playerId: string;

  goals: number;
  assists: number;

  plus: number;
  minus: number;

  plusMinus: number;
}
```

---

# 17. Reducer

```ts
function reduceMatchEvents(
  initialState: MatchState,
  events: MatchEvent[]
): MatchState
```

Eventit järjestetään:

```ts
sequence ASC
```

Ei peliajan perusteella.

Tämä on tärkeää, koska käyttäjä voi kirjata tapahtumia viiveellä.

---

# 18. OWN_GOAL reducer

```text
ownScore +1

for each lineupPlayerId:
  plus +1

if scorer:
  goals +1

if assister:
  assists +1
```

---

# 19. OPPONENT_GOAL reducer

```text
opponentScore +1

for each lineupPlayerId:
  minus +1
```

---

# 20. SUBSTITUTION reducer

```text
remove playerOut
add playerIn
```

---

# 21. Event edit

Vanhan eventin muokkaus päivittää:

```text
payload
period
matchTimeSeconds
updatedAt
```

Sen jälkeen reducer ajetaan uudelleen koko ottelulle.

---

# 22. Event delete

Poisto:

```ts
await db.matchEvents.delete(eventId);
```

Sen jälkeen:

```text
rebuild state
```

---

# 23. Undo

Undo = viimeisen eventin poisto.

```ts
const lastEvent =
  events.sort((a,b) => b.sequence - a.sequence)[0];
```

Poista ja laske tila uudelleen.

---

# 24. Sequence

Jokaisella tapahtumalla monotonisesti kasvava sequence.

```text
1
2
3
4
...
```

Eventin editointi EI muuta sequencea.

---

# 25. IndexedDB schema

```ts
class FutsalStatsDatabase extends Dexie {
  seasons!: Table<Season>;
  teams!: Table<Team>;
  players!: Table<Player>;
  matches!: Table<Match>;
  matchPlayers!: Table<MatchPlayer>;
  matchEvents!: Table<MatchEvent>;

  constructor() {
    super("FutsalStats");

    this.version(1).stores({
      seasons: "id,name,active",
      teams: "id,name",
      players: "id,teamId,number,active",
      matches: "id,seasonId,teamId,date,status",
      matchPlayers: "id,matchId,playerId",
      matchEvents: "id,matchId,sequence,type,period"
    });
  }
}
```

---

# 26. IDs

```ts
crypto.randomUUID()
```

---

# 27. Immediate persistence

Kaikki live-eventit tallennetaan välittömästi IndexedDB:hen.

```text
user action
→ validate
→ write IndexedDB
→ rebuild / update UI
```

Älä pidä kirjoittamatonta eventtiä vain React-statessa.

---

# 28. Refresh recovery

Kun live-ottelu avataan:

1. lue match
2. lue roster
3. lue kaikki eventit
4. aja reducer
5. näytä palautettu tila

---

# 29. Ottelulista

Query:

```text
matches WHERE seasonId = activeSeasonId
ORDER BY date DESC
```

Näytä status.

---

# 30. Ottelutilastot

Lasketaan:

```ts
calculateMatchStatistics(matchId)
```

joka käyttää eventtejä.

---

# 31. Season statistics

```ts
calculateSeasonStatistics(seasonId)
```

Flow:

```text
season matches
→ each match events
→ match stats
→ aggregate by playerId
```

---

# 32. Player season stats

```ts
export interface PlayerSeasonStats {
  playerId: string;

  appearances: number;

  goals: number;
  assists: number;
  points: number;

  plus: number;
  minus: number;
  plusMinus: number;
}
```

---

# 33. Appearance definition

MVP:

Pelaajalle tulee ottelu:

```text
appearance +1
```

jos hän kuuluu ottelun valittuun kokoonpanoon.

Jos myöhemmin halutaan erotella oikeasti kentällä pelanneet:

```text
hasEnteredCourt
```

voidaan laskea tapahtumista.

---

# 34. Data consistency

Kausitilastoa ei kirjoiteta tietokantaan pysyvänä summana.

Sama ottelutilastoille.

Tarvittaessa voidaan käyttää runtime-cachea suorituskykyyn.

---

# 35. Event edit modal

Goal event:

```text
period
matchTime
scorer
assist
lineupPlayerIds
```

Opponent goal:

```text
period
matchTime
lineupPlayerIds
```

Substitution:

```text
playerOut
playerIn
lineupAfter
```

---

# 36. Audit metadata

MVP:

```ts
createdAt
updatedAt
```

Mahdollinen myöhempi:

```ts
EventRevision[]
```

---

# 37. PWA

```ts
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Futsal Stats",
    short_name: "Futsal Stats",
    display: "standalone",
    start_url: "/"
  }
});
```

---

# 38. Offline cache

Service Worker cache:

- application shell
- JS
- CSS
- icons

Ei tarvitse cachettaa API-dataa MVP:ssä.

---

# 39. Static hosting

Tuotantoon voidaan julkaista esimerkiksi:

```text
Cloudflare Pages
GitHub Pages
```

Hosting ei sisällä otteludataa.

---

# 40. JSON export

Täysi backup:

```ts
export interface AppBackup {
  schemaVersion: 1;

  exportedAt: string;

  seasons: Season[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  matchPlayers: MatchPlayer[];
  matchEvents: MatchEvent[];
}
```

---

# 41. JSON import

Import:

1. parse
2. Zod validation
3. schemaVersion check
4. conflict handling
5. IndexedDB transaction
6. UI refresh

---

# 42. CSV match player stats

```text
number
name
goals
assists
plus
minus
plusMinus
```

---

# 43. CSV match events

```text
sequence
period
time
type
scorer
assist
lineup
```

---

# 44. Future Palloliitto integration

Ei toteuteta MVP:ssä.

Arkkitehtuurivaraus:

```ts
source
externalEventId?
externalMatchId?
```

Älä lisää verkko- tai API-riippuvuutta live-otteluun.

Mahdollinen tuleva flow:

```text
finished match
→ fetch official events
→ compare
→ user reconciliation
→ event updates
```

---

# 45. Tests

Pakolliset unit-testit:

- own goal
- opponent goal
- scorer
- assist
- plus/minus
- substitution
- undo
- edit goal scorer
- edit assist
- edit lineup on goal
- delete event
- event ordering
- reload rebuild
- season aggregation
- old match edit updates season totals
- match time parse/validation

---

# 46. Playwright E2E

Testiskenaario:

```text
create season
create team
add players
create match
select roster
select starting five
start match
substitution
own goal
enter 07:34
select scorer
select assist
opponent goal
enter 12:18
undo
re-add opponent goal
finish match
open statistics
edit scorer
verify match stats
open season stats
verify edited totals
export backup
reload application
verify data remains
```

---

# 47. Critical requirements

1. data safety before animations
2. tablet touch usability
3. offline reliability
4. event log as truth
5. editable history
6. deterministic recalculation
7. no backend dependency


---

# 48. Player identity rules

`Player.number` is required.

`Player.name` is optional.

Valid players:

```json
{
  "number": 9
}
```

```json
{
  "number": 9,
  "name": "Sofia"
}
```

Display helper:

```ts
function formatPlayerLabel(number: number, name?: string): string {
  return name?.trim()
    ? `#${number} ${name.trim()}`
    : `#${number}`;
}
```

Rules:

- never require a player name
- never hide the jersey number
- show `#9 Sofia` when a name exists
- show `#9` when a name does not exist
- validate jersey number as an integer
- prevent duplicate active jersey numbers inside the same team
- save `playerNumber` and optional `playerName` into `MatchPlayer` as a match-specific snapshot
- use the match snapshot for historical match exports and displays

Add tests for:

- creating a player with number only
- creating a player with number and name
- rejecting missing jersey number
- duplicate jersey number validation
- `#9` label formatting
- `#9 Sofia` label formatting
- preserving historical match number after master player number changes


---

# 49. Default jersey number vs match jersey number

There are two distinct jersey-number concepts.

## Player default number

```ts
Player.number
```

This is the player's default jersey number in team master data.

## Match-specific number

```ts
MatchPlayer.playerNumber
```

This is the jersey number actually used in a specific match.

When a player is added to a match roster:

```ts
const matchPlayer: MatchPlayer = {
  id: crypto.randomUUID(),
  matchId,
  playerId: player.id,
  playerNumber: player.number,
  playerName: player.name,
  selected: true,
  startingLineup: false
};
```

The user may edit `MatchPlayer.playerNumber` before the match.

Editing `MatchPlayer.playerNumber` MUST NOT update `Player.number`.

Example:

```text
Player.number = 9

Match A:
MatchPlayer.playerNumber = 9

Match B:
MatchPlayer.playerNumber = 17

Match C:
MatchPlayer.playerNumber = 9
```

## Historical presentation

All match-specific UI and exports must resolve jersey numbers from:

```ts
MatchPlayer.playerNumber
```

not from current `Player.number`.

This includes:

- live match player labels
- scorer selector
- assist selector
- event log labels
- match statistics
- match CSV
- match JSON presentation

## Validation

Within one match roster, selected players must have unique `playerNumber` values.

Pseudo-validation:

```ts
function validateUniqueMatchNumbers(
  matchPlayers: MatchPlayer[]
): ValidationResult
```

Only selected roster players need to be considered.

Duplicate numbers must block match start.

## UI behavior

Roster rows should expose the match-specific number as an inline numeric input.

Example:

```text
[✓] [17] Sofia
```

The field initializes from the player's default number.

Tests required:

- roster inherits default number
- match-specific number can be changed
- changing match-specific number does not alter player default number
- next match again inherits player default number
- historical match retains overridden number
- duplicate selected match numbers are rejected
- match export uses match-specific number


---

# 50. Own-team-only player data

The MVP tracks player-level data for the user's own team only.

Do not create opponent player entities.

Opponent data is limited to match-level information such as:

```ts
opponentName
opponentScore
```

and opponent goal events.

For an opponent goal, store only:

```ts
interface OpponentGoalPayload {
  lineupPlayerIds: string[]; // own team only
}
```

Do not store:

```text
opponent scorer
opponent assist
opponent lineup
opponent player IDs
opponent player names
opponent jersey numbers
```

---

# 51. Optional scorer and assist

For `OWN_GOAL` only:

```ts
interface OwnGoalPayload {
  scorerPlayerId?: string;
  assistPlayerId?: string;
  lineupPlayerIds: string[];
}
```

`scorerPlayerId` and `assistPlayerId` are optional.

The following is a fully valid own-goal event:

```json
{
  "type": "OWN_GOAL",
  "period": 1,
  "matchTimeSeconds": 454,
  "payload": {
    "lineupPlayerIds": ["p1", "p4", "p7", "p9", "p14"]
  }
}
```

The following is also valid:

```json
{
  "type": "OWN_GOAL",
  "period": 1,
  "matchTimeSeconds": 454,
  "payload": {
    "scorerPlayerId": "p9",
    "assistPlayerId": "p7",
    "lineupPlayerIds": ["p1", "p4", "p7", "p9", "p14"]
  }
}
```

Plus/minus calculation must not depend on scorer or assist fields.

---

# 52. Opponent goal restrictions

`OPPONENT_GOAL` MUST NOT contain:

```text
scorerPlayerId
assistPlayerId
opponentLineupPlayerIds
```

The only player IDs associated with an opponent goal are the own-team players receiving the minus.

---

# 53. Player statistics behavior

Player match statistics may include:

```text
goals
assists
plus
minus
plusMinus
```

However:

```text
goals
assists
```

represent only manually entered optional data.

They are not required for a complete match.

Plus/minus remains complete as long as goal events and own-team lineups are recorded correctly.

---

# 54. Goal edit behavior

For `OWN_GOAL`, editor supports:

```text
period
matchTimeSeconds
lineupPlayerIds
scorerPlayerId?   optional
assistPlayerId?   optional
```

For `OPPONENT_GOAL`, editor supports only:

```text
period
matchTimeSeconds
lineupPlayerIds   own team only
```

Never render opponent scorer, assist or lineup inputs.
