# Futsal Stats App – developer guide

Implementation of the spec in [README.md](README.md), [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md),
[UX_AND_RULES.md](UX_AND_RULES.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

Tablet-first, offline-first PWA. IndexedDB is the local store; an **optional** Supabase
document syncs it across every device (see "Shared cloud sync" below). Editing the player
list and finished-match results is gated by a shared password.

## Stack

React 18 · TypeScript · Vite · Tailwind · Dexie.js · vite-plugin-pwa · Zod · date-fns ·
Vitest · Playwright · React Router (hash routing, so it works from any static path).

## Commands

```bash
npm install
npm run dev            # local dev server (http://localhost:5173)
npm run build          # type-check + production build to dist/
npm run preview        # serve the production build
npm run typecheck      # tsc only
npm run lint           # eslint
npm test               # Vitest unit tests
npm run test:e2e       # Playwright end-to-end (builds + previews automatically)
```

First Playwright run needs a browser: `npm run test:e2e:install` (or `npx playwright install chromium`).

## Architecture

```
Event log (MatchEvent[])  ─►  reducer  ─►  MatchState  ─►  match stats  ─►  season stats
        (source of truth)                 (never persisted as totals)
```

- **`src/domain/`** – Zod schemas (`schemas.ts`) are the source of truth; TS types are
  inferred (`types.ts`). Label rules (`format.ts`), validation (`validation.ts`).
- **`src/db/`** – Dexie database (`database.ts`) and every mutation (`repositories.ts`).
  All live events are written to IndexedDB immediately; UI reads via `dexie-react-hooks`
  live queries, so a browser reload restores state exactly.
- **`src/services/`**
  - `matchEngine.ts` – `reduceMatchEvents(initialState, events)`, ordered by `sequence`.
  - `statisticsEngine.ts` – per-match player stats from events + roster snapshot.
  - `seasonStatisticsEngine.ts` – season aggregation from every match's events. Editing an
    old match changes season totals automatically (nothing is cached in the DB).
  - `matchTime.ts` – manual `MM:SS` parsing/validation (`07:34` → `454`s).
  - `exportService.ts` – player-stats CSV, events CSV, download helpers.
  - `backupService.ts` – full JSON backup / restore (`replace` or `merge`), single-match JSON.
  - `sync/` – shared-cloud sync (see below).
- **`src/features/`** – `matches/` (list, new, prepare/roster), `liveMatch/` (live view,
  goal dialog, event editor), `matchReview/` (Yhteenveto / Pelaajat / Maalit & +/- /
  Tapahtumat tabs), `players/`, `season/`, `settings/`.

## Shared cloud sync (optional)

Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (see `.env.example`) and run
`supabase/schema.sql` once. Without them the app is local-only, exactly as before.

- **Model** – the whole app state is one JSON document in `app_state.data` (one row),
  guarded by a `version` counter. `src/services/sync/`:
  - `merge.ts` – pure per-record merge: newest `updatedAt` wins; a tombstone wins unless
    the record was touched after it was deleted. Order-independent + idempotent (tested).
  - `snapshot.ts` – build the doc from IndexedDB / apply a merged doc back into it.
  - `remoteStore.ts` – pull, and optimistic push (`update … where version = base`).
  - `syncEngine.ts` – pull → merge → apply → push loop, retried on version conflict.
    Triggered by: app start (before bootstrap), a Supabase **realtime** subscription on
    `app_state` (free tier), a 60s interval, window focus / reconnect, and Dexie write
    hooks (debounced 1.5s). Status is exposed via `useSyncStatus()`.
- **Deletes** propagate via a `tombstones` Dexie table (DB v2); `deletePlayer`,
  `deleteMatch`, `deleteEvent`, `undoLastEvent` and a `replace` restore write them.
- **Which season you're viewing** is per-device (`src/app/activeSeason.ts`, localStorage)
  — it never syncs, so switching seasons on one tablet doesn't move everyone.
- **Bundle** – `@supabase/supabase-js` is split into its own `supabase` chunk and is
  cached by the service worker after first load.

## Edit password

`src/app/adminAuth.tsx` – shared secret `"MuutaTuloksia"`, **client-side gate only**
(remembered per device in localStorage; not enforced by the database). `ensureAdmin()`
returns `true` immediately when unlocked, otherwise shows a password modal. It gates:
adding / editing / deleting players, creating a season, and — on a **FINISHED** match —
editing/adding/deleting events, "Jatka tilastointia", deleting the match, and restoring /
clearing data in Settings. Running a live match and creating a new match are **not** gated.

## Key domain rules implemented

- Jersey number is required; name is optional; number-only players work everywhere.
  `MatchPlayer.playerNumber` is a per-match snapshot – overriding it never touches
  `Player.number`, and historical matches keep the number used at the time.
- Own goal: `+1` to every own player on court; optional scorer/assist. Opponent goal:
  `+1` opponent score, `-1` to every own player on court; **no** opponent-player data.
- Plus/minus never depends on scorer/assist being filled in.
- **Goal situation** (`OWN_GOAL`/`OPPONENT_GOAL` payload `situation`): `OPEN_PLAY`
  (default) accrues +/-; `PENALTY_6M`, `PENALTY_10M` and `UNEVEN_STRENGTH` (a red card /
  2-minute exclusion, e.g. 4v3) count for the score (and the scorer) only — no +/- is
  gathered. `goalCountsForPlusMinus()` in `src/domain/goals.ts` is the single gate, used
  by the reducer.
- **Max five on court per goal**: a goal's own-team lineup can never exceed
  `MAX_COURT_PLAYERS` (5). Enforced in `GoalDialog` (save disabled) and again in
  `repositories.ts` (`recordOwnGoal` / `recordOpponentGoal` / `updateEvent` throw).
  Fewer than five is allowed (short-handed play).
- +/- is shown **per goal** (`GoalBreakdownList` – who was on court for each goal),
  not rolled up per player in the live view. The match "Pelaajat" table and the Season
  table still carry a per-player +/- column (original spec).
- Undo = delete the last event and recompute. Any event can be opened, edited or deleted;
  all stats rebuild afterwards. A `FINISHED` match is still fully editable.
- No running match clock – the official time is typed per goal (custom numpad).

## PWA / hosting

`npm run build` emits static files (`dist/`) plus a service worker (`registerType:
"autoUpdate"`). It is a static SPA — the only backend is the optional Supabase document,
reached from the browser. `base: "./"` + **hash routing** means it also runs from a
sub-path (e.g. `user.github.io/repo/`) with **no** server-side SPA rewrite rule.

For shared sync, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` as build-time env
vars on the host below and redeploy. They are baked into the bundle at build time.

Icons are generated by `node scripts/generate-icons.mjs` (committed under `public/icons/`).

### GitHub Pages

`.github/workflows/deploy-pages.yml` builds and publishes `dist/` on every push to
`main`. Enable it once: repo **Settings → Pages → Build and deployment → Source =
GitHub Actions**. (The workflow adds `.nojekyll` so `assets/` is served verbatim.)

### Vercel

Import the repo — `vercel.json` sets framework `vite`, build `npm run build`, output
`dist`. Nothing else needed.

### Netlify

`netlify.toml` sets build `npm run build`, publish `dist`. No redirect rule needed
(hash routing).

### Cloudflare Pages

Framework preset **Vite**, build command `npm run build`, output directory `dist`.

Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in each host's env settings
(GitHub Actions: repo **Variables**; Vercel/Netlify/Cloudflare: project env vars).

> Without Supabase configured, IndexedDB is per browser origin — deploying moves no data.
> With it configured, every device that loads the same build shares one dataset. Either
> way, **Asetukset → Varmuuskopioi kaikki (JSON)** exports a portable backup.

## Tests

Unit (`tests/unit/`): match engine (goals, opponent goals, scorer, assist, plus/minus
independence, substitutions, ordering by sequence, undo, reload determinism, penalty
goals gather no +/-), match-time parsing/validation, statistics engine (roster snapshot,
sorting, penalty exclusion), validation rules, season aggregation (incl. "editing an old
match changes season totals"), sync merge (per-record LWW, tombstones, order-independent,
idempotent), and DB repositories against `fake-indexeddb` (number
inheritance/override isolation, immediate persistence + reload rebuild, finished-match
goal edit updates season stats, backup round-trip, CSV uses match-specific numbers).

E2E (`tests/e2e/full-season.spec.ts`): the full scenario from `TECHNICAL_SPEC` §46 –
create players and a match, pick roster + starting five, run the live match (substitution,
own goal `07:34` with scorer/assist, opponent goal `12:18`, undo, re-add, a 6 m penalty
goal that gathers no +/-, open the goal-by-goal breakdown), finish, edit a completed goal,
verify match + season stats changed, export a backup and confirm data survives a reload.
