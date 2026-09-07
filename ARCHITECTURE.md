# Futsal Stats App – Data Flow & Architecture v2

## 1. High-level architecture

```text
STATIC PWA HOST
Cloudflare Pages / GitHub Pages
             |
             | application files only
             v
         TABLET / BROWSER
             |
             +-- Service Worker cache
             |
             +-- React application
             |
             +-- IndexedDB
                   |
                   +-- seasons
                   +-- teams
                   +-- players
                   +-- matches
                   +-- matchPlayers
                   +-- matchEvents
```

No server-side database.

---

# 2. Source of truth

```text
MatchEvent[]
```

is the authoritative match data.

Derived:

```text
score
goals
assists
plus
minus
plusMinus
season totals
```

---

# 3. Match lifecycle

```text
CREATE
  |
  v
DRAFT
  |
roster + starting five
  |
  v
READY
  |
start
  |
  v
LIVE
  |
finish
  |
  v
FINISHED
```

FINISHED can still be edited.

---

# 4. Event lifecycle

```text
user action
  |
validate
  |
create MatchEvent
  |
IndexedDB transaction
  |
reducer
  |
UI update
```

---

# 5. Event editing

```text
existing event
   |
edit
   |
validate
   |
IndexedDB update
   |
read all match events
   |
reducer
   |
updated match statistics
   |
season aggregation
```

---

# 6. Season aggregation

```text
SEASON
  |
  +-- match 1 events
  +-- match 2 events
  +-- match 3 events
  |
  v
calculate match stats
  |
  v
aggregate playerId
  |
  v
season stats
```

---

# 7. Manual goal time

No synchronized match clock is required.

```text
scoreboard in venue
        |
user reads official time
        |
enters MM:SS
        |
store period + seconds
```

---

# 8. Backup

```text
IndexedDB
   |
Export all
   |
app-backup.json
```

Restore:

```text
app-backup.json
   |
validate
   |
IndexedDB transaction
```

---

# 9. Future Palloliitto integration boundary

Future only:

```text
Palloliitto / Taso
       |
fetch official match events
       |
normalize external events
       |
comparison screen
       |
user confirms differences
       |
update local MatchEvents
```

Never make external data the automatic source of truth without reconciliation.


---

# 10. Player identity and match snapshots

Player master data:

```text
Player
├── id
├── teamId
├── number   REQUIRED
└── name     OPTIONAL
```

Match roster:

```text
MatchPlayer
├── playerId
├── playerNumber   REQUIRED SNAPSHOT
└── playerName?    OPTIONAL SNAPSHOT
```

Reason:

```text
Player uses #9 in Match A
        |
later changes to #10
        |
Match A must still display #9
```

All historical match displays and exports should use the match-specific snapshot.

The application must work correctly when every player has only a jersey number and no name.


---

# 11. Jersey-number inheritance model

```text
TEAM PLAYER
Player.number = default jersey number
        |
        | copy when roster is created
        v
MATCH PLAYER
MatchPlayer.playerNumber = match-specific jersey number
        |
        +-- may stay equal to default
        |
        +-- may be overridden for this match only
```

Example:

```text
Player:
Sofia
default #9

Match 1 snapshot:
#9

Match 2 snapshot:
#17

Match 3 snapshot:
#9
```

Changing Match 2 never mutates the Player master record.

Historical match rendering always reads the snapshot first.


---

# 12. Own-team-only event model

Player-level event data belongs only to the user's own team.

```text
OWN_GOAL
├── period
├── time
├── own lineup
├── scorer?   optional, own team
└── assist?   optional, own team
```

```text
OPPONENT_GOAL
├── period
├── time
└── own lineup
```

There is no opponent-player model in the MVP.

The opponent goal exists only to:

1. update the score
2. assign -1 to the own-team players on court

Optional scorer/assist data never affects plus/minus calculations.
