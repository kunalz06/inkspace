-- Limit authenticated users to the DML operations required by InkSpace sync.
-- TRUNCATE bypasses row-level security and must not be granted to app roles.
revoke truncate, references, trigger on table public.workspace_docs
  from authenticated, anon, public;
revoke all on function public.inkspace_touch_updated_at()
  from public, anon, authenticated;
