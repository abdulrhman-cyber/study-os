-- ═══════════════ STUDY OS — Fix ai_settings RLS ═══════════════
-- Ensures all RLS policies exist for ai_settings table.
-- This migration is idempotent (safe to run multiple times).

-- Enable RLS (in case it was disabled)
alter table public.ai_settings enable row level security;

-- Drop old policies if they exist, then recreate
drop policy if exists "ai_settings_select_own" on public.ai_settings;
drop policy if exists "ai_settings_insert_own" on public.ai_settings;
drop policy if exists "ai_settings_update_own" on public.ai_settings;
drop policy if exists "ai_settings_delete_own" on public.ai_settings;

-- SELECT: user can read only their own row
create policy "ai_settings_select_own"
  on public.ai_settings for select
  using (auth.uid() = user_id);

-- INSERT: user can insert only their own row
create policy "ai_settings_insert_own"
  on public.ai_settings for insert
  with check (auth.uid() = user_id);

-- UPDATE: user can update only their own row
create policy "ai_settings_update_own"
  on public.ai_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: user can delete only their own row
create policy "ai_settings_delete_own"
  on public.ai_settings for delete
  using (auth.uid() = user_id);
