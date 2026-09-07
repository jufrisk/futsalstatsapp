-- Futsal Stats – shared state table.
-- Run once in the Supabase SQL editor (Dashboard -> SQL -> New query).
--
-- The whole application document lives in a single row. `version` is bumped on
-- every write and used for optimistic concurrency; the app merges per record.

create table if not exists public.app_state (
  id          text primary key default 'main',
  version     bigint not null default 0,
  data        jsonb  not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.app_state (id, version, data)
values ('main', 0, '{}'::jsonb)
on conflict (id) do nothing;

-- The password gate is client-side only, so the anon role needs read + write on
-- this one row. (Tighten this later with a real auth model + RLS if desired.)
alter table public.app_state enable row level security;

drop policy if exists "anon can read app_state" on public.app_state;
create policy "anon can read app_state"
  on public.app_state for select
  to anon, authenticated
  using (true);

drop policy if exists "anon can update app_state" on public.app_state;
create policy "anon can update app_state"
  on public.app_state for update
  to anon, authenticated
  using (id = 'main')
  with check (id = 'main');

drop policy if exists "anon can insert app_state" on public.app_state;
create policy "anon can insert app_state"
  on public.app_state for insert
  to anon, authenticated
  with check (id = 'main');

-- Enable realtime so other devices update within ~1s (free tier).
-- Wrapped so re-running the whole file is safe.
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
end $$;
