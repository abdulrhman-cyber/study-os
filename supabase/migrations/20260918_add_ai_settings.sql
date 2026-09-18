-- ═══════════════ STUDY OS — ai_settings table ═══════════════
-- Stores per-user encrypted Gemini API key for the AI Assistant.

create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemini_api_key_encrypted text not null,
  gemini_model text not null default 'gemini-2.5-flash-lite',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_settings_user_id_key unique (user_id)
);

-- Enable RLS
alter table public.ai_settings enable row level security;

-- Policies: users can only manage their own row
create policy "ai_settings_select_own"
  on public.ai_settings for select
  using (auth.uid() = user_id);

create policy "ai_settings_insert_own"
  on public.ai_settings for insert
  with check (auth.uid() = user_id);

create policy "ai_settings_update_own"
  on public.ai_settings for update
  using (auth.uid() = user_id);

create policy "ai_settings_delete_own"
  on public.ai_settings for delete
  using (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists idx_ai_settings_user_id on public.ai_settings(user_id);
