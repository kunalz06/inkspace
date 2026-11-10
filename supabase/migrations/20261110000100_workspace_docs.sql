-- InkSpace cloud synchronization schema. Apply only to its dedicated Supabase project.
create table if not exists public.workspace_docs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create index if not exists workspace_docs_owner_updated_idx
 on public.workspace_docs (owner_id, updated_at desc);
create or replace function public.inkspace_touch_updated_at()
 returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;$$;
create trigger inkspace_touch_docs before update on public.workspace_docs
 for each row execute function public.inkspace_touch_updated_at();
alter table public.workspace_docs enable row level security;
create policy "Owners read own workspaces" on public.workspace_docs
 for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners create own workspaces" on public.workspace_docs
 for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners update own workspaces" on public.workspace_docs
 for update to authenticated using ((select auth.uid()) = owner_id)
 with check ((select auth.uid()) = owner_id);
create policy "Owners delete own workspaces" on public.workspace_docs
 for delete to authenticated using ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.workspace_docs to authenticated;
revoke all on public.workspace_docs from anon;
