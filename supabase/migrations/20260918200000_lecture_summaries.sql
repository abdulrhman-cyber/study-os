-- ═══════════════ STUDY OS — Lecture Summaries ═══════════════
-- lecture_summaries table + RLS + Storage bucket

-- Table
create table if not exists public.lecture_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text not null,
  title text not null,
  lecture_number integer,
  unit text,
  file_path text not null,
  file_name text not null,
  file_size integer not null default 0,
  status text not null default 'unread',
  is_favorite boolean not null default false,
  last_page integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_lecture_summaries_user_id on public.lecture_summaries(user_id);
create index if not exists idx_lecture_summaries_subject on public.lecture_summaries(user_id, subject_id);

-- Enable RLS
alter table public.lecture_summaries enable row level security;

-- Drop old policies if any
drop policy if exists "ls_select_own" on public.lecture_summaries;
drop policy if exists "ls_insert_own" on public.lecture_summaries;
drop policy if exists "ls_update_own" on public.lecture_summaries;
drop policy if exists "ls_delete_own" on public.lecture_summaries;

-- Policies
create policy "ls_select_own"
  on public.lecture_summaries for select
  using (auth.uid() = user_id);

create policy "ls_insert_own"
  on public.lecture_summaries for insert
  with check (auth.uid() = user_id);

create policy "ls_update_own"
  on public.lecture_summaries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ls_delete_own"
  on public.lecture_summaries for delete
  using (auth.uid() = user_id);

-- Storage bucket (created via Supabase dashboard or CLI)
-- supabase storage create lecture-summaries --public=false
-- Storage policies applied separately via dashboard
