-- TAYAN — schema for signed-in sync. Run once in the Supabase SQL editor (or `supabase db push`).

-- one JSON document per user per kind: settings, races (trophy case), log (training log)
create table if not exists public.user_docs (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null check (key in ('settings', 'races', 'log')),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_docs enable row level security;

create policy "user_docs: read own"   on public.user_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_docs: insert own" on public.user_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_docs: update own" on public.user_docs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_docs: delete own" on public.user_docs for delete to authenticated using ((select auth.uid()) = user_id);

-- private bucket for trophy-case photos, stored as <user id>/<photo id>.jpg (compressed client-side, ≤ 5 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('race-photos', 'race-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "race-photos: read own" on storage.objects for select to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "race-photos: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "race-photos: update own" on storage.objects for update to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "race-photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
