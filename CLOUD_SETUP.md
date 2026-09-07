# Turning on shared stats (Supabase)

Do this once. Until you do, the app works exactly as before — data stays on each device.

## 1. Create a free Supabase project
1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name and a database password (you won't need the password again). Free tier is fine.
3. Wait ~2 minutes for it to provision.

## 2. Create the table
1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   It should say "Success".

## 3. Copy your keys
Left sidebar → **Project Settings** → **API**:
- **Project URL** → this is `VITE_SUPABASE_URL`
- **Project API keys → `anon` `public`** → this is `VITE_SUPABASE_ANON_KEY`

## 4. Give the keys to the hosting site
Set both as environment variables where the app is built, then redeploy:

| Host | Where |
|---|---|
| GitHub Pages | Repo → **Settings → Secrets and variables → Actions → Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy workflow |
| Vercel | Project → **Settings → Environment Variables** → add both → **Redeploy** |
| Netlify | Site → **Site configuration → Environment variables** → add both → **Trigger deploy** |
| Cloudflare Pages | Project → **Settings → Environment variables** → add both → **Retry deployment** |

For local testing: copy `.env.example` to `.env`, fill in the two values, run `npm run dev`.

## 5. Check it works
Open the app on two devices. Add a player on one — it appears on the other within a
second or two. The footer shows "Synkronoitu HH:MM"; tap it to force a refresh.

## The edit password
Editing the player list or the results of a **finished** match asks for the password
**`MuutaTuloksia`**. Enter it once per device (Asetukset → *Avaa muokkaus*); it's
remembered on that device until you tap *Lukitse muokkaus*. Scoring a live match and
adding a new match never ask for it.

This password only hides the edit buttons on a device — it is **not** enforced by the
database. Anyone with real technical skills and the site's address could still change
data directly. For a team app that's usually fine; if you need true protection, that
requires a server-side check (a later change).
