-- First Step database. Paste this into Supabase → SQL Editor → Run.
-- One table holds each user's tasks, settings and profile as JSON documents.

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.items enable row level security;

-- Every user can only see and change their own rows.
drop policy if exists "own rows: read"   on public.items;
drop policy if exists "own rows: insert" on public.items;
drop policy if exists "own rows: update" on public.items;
drop policy if exists "own rows: delete" on public.items;

create policy "own rows: read"   on public.items for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.items for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.items for delete using (auth.uid() = user_id);
