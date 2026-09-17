-- ═══════════════════════════════════════════════════════════════════════
--  STUDY OS — Web Push (اشتراكات + جدولة إشعارات)  ·  Supabase
-- ═══════════════════════════════════════════════════════════════════════
--  خطوات التنفيذ:
--   1) Supabase Dashboard → SQL Editor → New query → الصق هذا الملف كله → Run.
--   2) انشر Edge Function اسمها send-due-push (راجع مجلد supabase/functions).
--   3) اضبط أسرار الدالة:
--        supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
--                              VAPID_SUBJECT=mailto:you@example.com \
--                              CRON_SECRET=...
--   4) فعّل pg_cron + pg_net ثم فعّل الجدولة (الجزء الأخير في هذا الملف).
--   5) ضع VAPID_PUBLIC_KEY في js/supabase-config.js (نفس المفتاح العام).
--
--  ⚠️ الأمان: RLS هنا تمنع أي مستخدم من رؤية/تعديل اشتراكات أو جدولة غيره.
--     الدالة الإدارية تستخدم SERVICE ROLE فقط على الخادم (لا يوضع في العميل أبدًا).
-- ═══════════════════════════════════════════════════════════════════════

-- ── امتدادات مطلوبة ────────────────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ════════════════ 1) اشتراكات الأجهزة (Push Subscriptions) ════════════════
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null default '',
  auth        text not null default '',
  user_agent  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on public.push_subscriptions;
create policy "push_subs_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
create policy "push_subs_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subs_update_own" on public.push_subscriptions;
create policy "push_subs_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

grant all on public.push_subscriptions to anon, authenticated;

-- ════════════════ 2) جدول الإشعارات المجدولة (Push Schedule) ════════════════
create table if not exists public.push_schedule (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  dedupe_key   text not null,
  fire_at      timestamptz not null,
  title        text not null,
  body         text not null default '',
  icon         text default 'img/logo.png',
  url          text default '/',
  sent_at      timestamptz,
  attempts     integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
-- الأهم: فهرس جزئي يساعد الدالة على التقاط المستحق بسرعة
create index if not exists push_schedule_due_idx
  on public.push_schedule (fire_at) where sent_at is null;
create index if not exists push_schedule_user_idx on public.push_schedule (user_id);

alter table public.push_schedule enable row level security;

drop policy if exists "push_sched_select_own" on public.push_schedule;
create policy "push_sched_select_own" on public.push_schedule
  for select using (auth.uid() = user_id);

drop policy if exists "push_sched_insert_own" on public.push_schedule;
create policy "push_sched_insert_own" on public.push_schedule
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_sched_update_own" on public.push_schedule;
create policy "push_sched_update_own" on public.push_schedule
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_sched_delete_own" on public.push_schedule;
create policy "push_sched_delete_own" on public.push_schedule
  for delete using (auth.uid() = user_id);

grant all on public.push_schedule to anon, authenticated;

-- ── تحديث updated_at تلقائيًا ──────────────────────────────────────────
create or replace function public.set_push_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_push_subs_updated on public.push_subscriptions;
create trigger trg_push_subs_updated before insert or update on public.push_subscriptions
  for each row execute function public.set_push_updated_at();

drop trigger if exists trg_push_sched_updated on public.push_schedule;
create trigger trg_push_sched_updated before insert or update on public.push_schedule
  for each row execute function public.set_push_updated_at();

-- ════════════════ 3) الجدولة التلقائية (pg_cron + pg_net) ════════════════
--   تُشغّل Edge Function كل دقيقة فترسل ما حان وقته. عدّل القيمتين قبل التنفيذ:
--     • YOUR-PROJECT-REF  → مرجع مشروعك (نفسه في supabase-config.js)
--     • YOUR-CRON-SECRET  → نفس CRON_SECRET الذي ستضبطه في أسرار الدالة
--
--   ثم COMMENT/UNCOMMENT الكتلة. (يمكن تنفيذها لاحقًا بعد نشر الدالة.)
--
-- create extension if not exists pg_cron  with schema extensions;
-- create extension if not exists pg_net   with schema extensions;
--
-- select cron.unschedule('study-os-send-push')
--   where exists (select 1 from cron.job where jobname = 'study-os-send-push');
--
-- select cron.schedule(
--   'study-os-send-push',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-push',
--     headers := jsonb_build_object(
--                  'Content-Type', 'application/json',
--                  'x-cron-secret', 'YOUR-CRON-SECRET'
--                ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );

-- ✅ انتهى — الآن انشر الدالة واضبط الأسرار ثم فعّل pg_cron أعلاه.
