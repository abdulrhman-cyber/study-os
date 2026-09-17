/* ═══════════════ STUDY OS — Edge Function: send-due-push ═══════════════
   ترسل الإشعارات المستحقة من جدول push_schedule عبر Web Push (VAPID).
   تُشغَّل تلقائيًا من pg_cron كل دقيقة، وتعمل حتى لو التطبيق مقفول.

   ── النشر (مرة واحدة) ──────────────────────────────────────────────
   1) ثبّت Supabase CLI:  npm i -g supabase
   2) supabase login
   3) supabase link --project-ref <YOUR-PROJECT-REF>
   4) supabase functions deploy send-due-push --no-verify-jwt
   5) اضبط الأسرار:
        supabase secrets set `
          VAPID_PUBLIC_KEY="<public>" `
          VAPID_PRIVATE_KEY="<private>" `
          VAPID_SUBJECT="mailto:you@example.com" `
          CRON_SECRET="<random-long-string>"
      (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مضبوطان تلقائيًا في بيئة الدوال.)
   6) ولّد مفاتيح VAPID لو لسه:  npx web-push generate-vapid-keys
      ثم ضع المفتاح العام في js/supabase-config.js (vapidPublicKey).
   7) فعّل الجدولة: نفّذ كتلة pg_cron في push-notifications.sql.

   ── فحص سريع ──────────────────────────────────────────────────────
   curl -H "x-cron-secret: $CRON_SECRET" https://<ref>.functions.supabase.co/send-due-push?action=health
   curl -X POST -H "x-cron-secret: $CRON_SECRET" -H "content-type: application/json" `
        -d '{"action":"test","userId":"<uid>"}' https://<ref>.functions.supabase.co/send-due-push
   ═════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const MAX_ATTEMPTS = 5;
const BATCH = 200;
const KEEP_SENT_DAYS = 7;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

/* import ديناميكي: حتى لو تعذّر تحميل مكتبة web-push، يظل action=health يعمل ويخبرنا بالسبب */
let _webpush: any = null;
async function getWebPush() {
  if (_webpush) return _webpush;
  const mod: any = await import("npm:web-push@3.6.7");
  _webpush = mod.default || mod;
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    _webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  }
  return _webpush;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS)
  });
}

function authorized(req: Request): boolean {
  const secret = req.headers.get("x-cron-secret") || "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const okSecret = !!CRON_SECRET && secret === CRON_SECRET;
  const okService = !!bearer && bearer === SERVICE_ROLE;
  return okSecret || okService;
}

type Row = {
  id: string; user_id: string; title: string; body: string;
  icon: string | null; url: string | null; dedupe_key: string; attempts: number | null;
};
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function cleanup() {
  const sentCutoff = new Date(Date.now() - KEEP_SENT_DAYS * 86400000).toISOString();
  await sb.from("push_schedule").delete().not("sent_at", "is", null).lt("sent_at", sentCutoff);
  const failCutoff = new Date(Date.now() - 2 * 86400000).toISOString();
  await sb.from("push_schedule").delete().gte("attempts", MAX_ATTEMPTS).lt("created_at", failCutoff);
}

async function health() {
  let webpushOk = true, webpushError: string | null = null;
  try { await getWebPush(); } catch (e: any) { webpushOk = false; webpushError = (e && e.message) || String(e); }
  const [{ count: subs }, { count: pending }] = await Promise.all([
    sb.from("push_subscriptions").select("id", { count: "exact", head: true }),
    sb.from("push_schedule").select("id", { count: "exact", head: true }).is("sent_at", null).lte("fire_at", new Date().toISOString())
  ]);
  return json({
    ok: !!(VAPID_PUBLIC && VAPID_PRIVATE) && webpushOk,
    vapidPublic: !!VAPID_PUBLIC,
    vapidPrivate: !!VAPID_PRIVATE,
    vapidSubject: VAPID_SUBJECT,
    cronSecret: !!CRON_SECRET,
    webpushOk, webpushError,
    subscriptions: subs ?? null,
    duePending: pending ?? null,
    serverTime: new Date().toISOString()
  });
}

async function testSend(userId: string) {
  const webpush = await getWebPush();
  const { data: subs } = await sb.from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth").eq("user_id", userId);
  if (!subs || subs.length === 0) return json({ ok: false, error: "no-subscriptions" }, 404);
  const payload = JSON.stringify({
    title: "اختبار Web Push",
    body: "إن وصلك هذا فالدالة تعمل — جرّب بعدها إغلاق التاب تمامًا.",
    icon: "img/logo.png", url: "./#/dashboard", tag: "health_test_" + Date.now()
  });
  const results: any[] = [];
  for (const s of subs as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 });
      results.push({ id: s.id, ok: true });
    } catch (e: any) {
      results.push({ id: s.id, ok: false, status: e?.statusCode || e?.status || null, error: (e?.message || String(e)).slice(0, 200) });
    }
  }
  return json({ ok: results.some(r => r.ok), subscriptions: subs.length, results });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  let body: any = {};
  if (req.method === "POST") { try { body = await req.json(); } catch (_e) { body = {}; } }
  const action = url.searchParams.get("action") || body.action || "run";

  if (action === "health") return await health();
  if (action === "test") {
    const userId = url.searchParams.get("userId") || body.userId;
    if (!userId) return json({ error: "userId required" }, 400);
    return await testSend(userId);
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "VAPID keys not configured" }, 500);

  let webpush: any;
  try { webpush = await getWebPush(); }
  catch (e: any) { return json({ error: "web-push import failed", detail: (e && e.message) || String(e) }, 500); }

  const now = new Date().toISOString();

  const { data: due, error } = await sb
    .from("push_schedule")
    .select("id,user_id,title,body,icon,url,dedupe_key,attempts")
    .lte("fire_at", now)
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("fire_at", { ascending: true })
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);
  if (!due || due.length === 0) { await cleanup(); return json({ processed: 0, sent: 0, failed: 0 }); }

  const rows = due as Row[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", userIds);

  const byUser: Record<string, Sub[]> = {};
  ((subs || []) as Sub[]).forEach((s) => { (byUser[s.user_id] = byUser[s.user_id] || []).push(s); });

  let sent = 0, failed = 0, attempted = 0;
  const dead404: string[] = [];   // 404/410 → محذوف نهائيًا
  const dead403: string[] = [];   // 403 → مفتاح VAPID مختلف (مشتبه)
  const errorCounts: Record<string, number> = {};

  for (const row of rows) {
    const list = byUser[row.user_id] || [];
    if (list.length === 0) {
      await sb.from("push_schedule").update({ sent_at: new Date().toISOString(), error: "no-subscriptions" }).eq("id", row.id);
      continue;
    }
    const payload = JSON.stringify({
      title: row.title, body: row.body || "",
      icon: row.icon || "img/logo.png", url: row.url || "", tag: row.dedupe_key
    });

    let anyOk = false;
    let lastErr = "";
    let lastCode: number | null = null;
    for (const s of list) {
      attempted++;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600 }
        );
        anyOk = true;
      } catch (e: any) {
        const code = e && (e.statusCode || e.status);
        lastErr = (e && e.message) || String(e);
        lastCode = code || null;
        errorCounts[String(code || "unknown")] = (errorCounts[String(code || "unknown")] || 0) + 1;
        if (code === 404 || code === 410) dead404.push(s.id);
        else if (code === 403) dead403.push(s.id); // VapidPkHashMismatch / UnauthorizedRegistration
        console.warn("push send failed", { subId: s.id, code, message: lastErr });
      }
    }

    if (anyOk) {
      sent++;
      await sb.from("push_schedule").update({ sent_at: new Date().toISOString(), error: null }).eq("id", row.id);
    } else {
      failed++;
      await sb.from("push_schedule")
        .update({ attempts: (row.attempts || 0) + 1, error: (lastErr || "send failed").slice(0, 300) })
        .eq("id", row.id);
    }
  }

  const removed = [...new Set(dead404)];
  // أمان: لو *كل* المحاولات رجعت 403 فهذا غالبًا خطأ إعداد VAPID عام، لا اشتراكات ميتة.
  const globalKeyMismatch = attempted > 0 && dead403.length === attempted;
  if (!globalKeyMismatch) {
    dead403.forEach((id) => { if (!removed.includes(id)) removed.push(id); });
  } else {
    console.error("ALL sends returned 403 — VAPID keys likely don't match subscriptions; not deleting.");
  }
  if (removed.length) await sb.from("push_subscriptions").delete().in("id", removed);
  await cleanup();

  return json({
    processed: rows.length, sent, failed,
    attempted, errorCounts,
    removedSubscriptions: removed.length,
    globalKeyMismatch
  });
});
