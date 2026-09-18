/* ═══════════════ STUDY OS — Edge Function: ai-assistant ═══════════════
   الوسيط الآمن بين Study OS و Gemini API.
   المتصفح لا يخاطب Gemini أبدًا — كل الطلبات تمر عبر هذه الدالة فقط،
   والمفتاح GEMINI_API_KEY يقرأ حصريًا من أسرار Supabase ولا يُرسل للمتصفح.

   ── المعمارية ──────────────────────────────────────────────────────
   Browser → supabase.functions.invoke("ai-assistant", {...})
          → هذه الدالة تتحقق من JWT ثم تخاطب Gemini
          → تعيد الرد (أو رسالة خطأ عربية) إلى المتصفح.

   ── الأمان ─────────────────────────────────────────────────────────
   • تُرفض الطلبات غير الموثَّقة فورًا (401) دون أي اتصال بـ Gemini.
   • هوية المستخدم تُستخرج من JWT وليس من أي قيمة يرسلها المتصفح.
   • النموذج ليس قابلًا للضبط من المتصفح — يُغيّر من المتغير GEMINI_MODEL هنا.
   • لا تُطبع قيمة المفتاح أبدًا في logs. health يعرض hasKey فقط (boolean).

   ── النشر (مرة واحدة) ──────────────────────────────────────────────
   ثبّت Supabase CLI ثم:
     supabase login
     supabase link --project-ref <YOUR-PROJECT-REF>
     supabase secrets set GEMINI_API_KEY="<google-ai-studio-key>"
     supabase functions deploy ai-assistant
   (verify_jwt افتراضي مفعّل — وهذا المطلوب هنا.)
   فحص سريع بعد النشر:
     curl https://<ref>.functions.supabase.co/ai-assistant?action=health
   يعيد { ok, model, hasKey } — إن hasKey=false فالمفتاح غير مضبوط في الأسرار.
   ═════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

/* ── النموذج: غيّره من هنا فقط (متوفر في Free Tier) ── */
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const MODES = ["chat", "explain_question", "quiz", "study_plan", "progress_analysis", "error_bank_help"];

/* ── حدود لحماية الحصة المجانية ومنع الإساءة ── */
const MAX_MESSAGE_CHARS = 4000;      // أقصى طول لرسالة الطالب
const MAX_CONTEXT_CHARS = 7000;      // أقصى حجم لسياق Study OS المرسل
const MAX_HISTORY_TURNS = 12;        // عدد محادثات السابقة التي نرسلها
const MAX_HISTORY_MSG_CHARS = 1600;  // قصّ كل رسالة سابقة
const MAX_OUTPUT_TOKENS = 1600;      // أقصى طول للرد
const GEMINI_TIMEOUT_MS = 55000;     // مهلة اتصال Gemini
const REQ_LIMIT = 20;                // أقصى طلبات لكل مستخدم
const REQ_WINDOW_MS = 60000;         // خلال هذه النافذة الزمنية

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS)
  });
}

const sb = createClient(
  Deno.env.get("SUPABASE_URL") || "http://localhost:54321",
  Deno.env.get("SUPABASE_ANON_KEY") || "anon",
  { auth: { persistSession: false } }
);

/* ── نظام إخفاق بسيط في الذاكرة لكل مستخدم ── */
const hitLog: Record<string, number[]> = {};
function rateLimited(uid: string): boolean {
  const now = Date.now();
  const list = (hitLog[uid] || []).filter(t => now - t < REQ_WINDOW_MS);
  if (list.length >= REQ_LIMIT) { hitLog[uid] = list; return true; }
  list.push(now);
  hitLog[uid] = list;
  return false;
}

function truncate(s: string | null | undefined, n: number): string {
  s = (s == null ? "" : String(s));
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

/* ── توجيه النظام: عربي واضح، يعتمد على البيانات المرسلة فقط ── */
function systemPrompt(mode: string): string {
  const base =
    "أنت «مساعد Study OS» — مساعد ذكي مدمج في نظام دراسي للطلاب (بكالوريا/ثانوية). " +
    "قواعد إلزامية:\n" +
    "1) ردّ بالعربية الفصيحة البسيطة والواضحة ما لم يطلب المستخدم لغة أخرى. " +
    "2) هدفك أن يفهم الطالب لا أن تحفظ الإجابة فقط: اشرح الخطوات والسبب. " +
    "3) لا تخترع أرقامًا أو بيانات غير موجودة في السياق المقدَّم إليك. " +
    "4) إذا كانت المعلومات ناقصة، قل ذلك بوضوح واطلب ما تحتاجه. " +
    "5) في أسئلة الاختيار المتعدد: اشرح الإجابة الصحيحة ولماذا الاختيارات الأخرى خاطئة عند الإمكان. " +
    "6) لا تدّعِ أنك نفّذت إجراءات داخل النظام (إضافة مهام، تعديل درجات، ...)؛ أنت تحلل وتشرح وتقترح فقط، وحالة النظام للقراءة ولا تُعدّلها. " +
    "7) إذا لم تكن متأكدًا من شيء فقل ذلك بدل التخمين. " +
    "8) كن مهذبًا ومشجعًا، واجعل الرد منظمًا وقصيرًا بما يخدم الفهم.";

  const modeRules: Record<string, string> = {
    explain_question:
      "الوضع: شرح سؤال. قد يستقبل السؤال نصًا مباشرًا من الطالب أو كائن سؤال من بنك أخطائه (context.question). " +
      "اشرح السؤال خطوة بخطوة، ووضح لماذا كانت إجابته خاطئة (studentAnswer) إن وُجدت، وعرض النموذج الصحيح. ",
    quiz:
      "الوضع: اختبار تفاعلي. ابدأ بسؤال واحد فقط (اخياري أو مباشر) وانتظر إجابة الطالب. " +
      "لا تعرض الإجابة الصحيحة قبل أن يجيب. إن كانت إجابته صحيحة فامتدحه واشرح السبب بإيجاز وانتقل لسؤال آخر. " +
      "إن كانت خاطئة فوضّح الخطأ، واعرض الإجابة الصحيحة، واقترح نقطة مراجعة، ثم اسأل إن أراد سؤالًا آخر أو إنهاء. " +
      "لا تُعدّل أي بيانات في Study OS.",
    study_plan:
      "الوضع: خطة مذاكرة. استخدم فقط بيانات السياق (context.plan): المواد وأهدافها، مواعيد الامتحانات، الأهداف الزمنية، الجلسات الأخيرة، نقاط الضعف، والخطط الحالية. " +
      "طوّر خطة مقترحة واقعية ومقسمة (يوميًا/أسبوعيًا) دون تعديل أي بيانات، ووضح أنها اقتراح فقط.",
    progress_analysis:
      "الوضع: تحليل المستوى. حلِّل الأرقام الفعلية من context.progress فقط: وقت الدراسة، أهداف اليوم/الأسبوع/الشهر، السلسلة، عدد الأسئلة والدقة، المواد. " +
      "اعرض الحالة بصدق، وأعط ملاحظات بناءة وتحفيزية. لا تختلق أرقامًا.",
    error_bank_help:
      "الوضع: مساعدة في خطأ من بنك الأخطاء. اشرح السؤال المحدد في context.question، ووضح إجابة الطالب الخاطئة، " +
      "والسبب المحتمل إن وُجد، والنموذج الصحيح، وسؤال مشابه للمراجعة.",
    chat:
      "الوضع: محادثة عامة. إذا لم يطلب المستخدم بياناته فاعتمد على المعرفة العامة للمذاكرة دون إرسال بيانات النظام."
  };

  return base + "\n" + (modeRules[mode] || modeRules.chat) +
    "\nالرد بالعربية دائمًا ما لم يطلب غيرها.";
}

/* ── تحويل الطلب إلى contents صالحة لنموذج Gemini ── */
function toContents(body: any): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  const hist = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  for (const h of hist) {
    if (!h || typeof h.text !== "string" || !h.text.trim()) continue;
    const role = h.role === "model" ? "model" : "user";
    contents.push({ role, parts: [{ text: truncate(h.text, MAX_HISTORY_MSG_CHARS) }] });
  }
  contents.push({ role: "user", parts: [{ text: truncate(body.message, MAX_MESSAGE_CHARS) }] });
  return contents;
}

/* ── استدعاء Gemini ── */
async function callGemini(prompt: string, contents: { role: string; parts: { text: string }[] }[]) {
  const res = await fetch(GEMINI_URL + "?key=" + encodeURIComponent(GEMINI_API_KEY), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt }] },
      contents,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.5 }
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
  });

  let raw = "";
  try { raw = await res.text(); } catch (_e) { raw = ""; }
  let data: any = {};
  if (raw) { try { data = JSON.parse(raw); } catch (_e) { /* جسم خطأ غير JSON */ } }

  if (!res.ok) {
    if (res.status === 429) return { rate: true };
    if (res.status === 400 || res.status === 403) return { config: res.status };
    if (res.status === 408 || res.status === 504) return { timeout: true };
    return { server: res.status };
  }

  const cand = data && data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const text = parts.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("\n").trim();
  if (!text) return { empty: true, reason: cand && cand.finishReason || null };
  return { text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("action") === "health") {
    return json({
      ok: true,
      model: GEMINI_MODEL,
      hasKey: !!GEMINI_API_KEY,
      serverTime: new Date().toISOString()
    });
  }
  if (req.method !== "POST") return json({ ok: false, code: "validation", error: "غير مدعوم." }, 400);

  /* 1) تأكد من الهوية من JWT — لا نثق بأي userId من المتصفح */
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth) return json({ ok: false, code: "auth", error: "غير مسجّل الدخول." }, 401);
  let user: any = null;
  try {
    const r = await sb.auth.getUser(auth);
    if (r.error || !r.data || !r.data.user) return json({ ok: false, code: "auth", error: "جلسة غير صالحة." }, 401);
    user = r.data.user;
  } catch (_e) {
    return json({ ok: false, code: "auth", error: "تعذر التحقق من الجلسة." }, 401);
  }
  const uid = String(user.id || user.sub || "u");

  /* 2) اقرأ الطلب وافحصه */
  let body: any = {};
  try { body = await req.json(); } catch (_e) { body = {}; }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ ok: false, code: "validation", error: "اكتب رسالة أولًا." }, 400);
  if (message.length > MAX_MESSAGE_CHARS) {
    return json({ ok: false, code: "validation", error: "الرسالة طويلة جدًا — الحد الأقصى " + MAX_MESSAGE_CHARS + " حرف." }, 400);
  }
  const mode = MODES.indexOf(body.mode) >= 0 ? body.mode : "chat";
  const context = (body.context && typeof body.context === "object") ? body.context : {};
  const contextStr = truncate(JSON.stringify(context), MAX_CONTEXT_CHARS);

  /* 3) حد الاستخدام */
  if (rateLimited(uid)) {
    return json({ ok: false, code: "rate-limit", error: "وصل المساعد إلى حد الاستخدام المؤقت. حاول مرة أخرى بعد قليل." }, 429);
  }

  /* 4) التحقق من المفتاح قبل الاتصال بـ Gemini */
  if (!GEMINI_API_KEY) {
    console.error("AI: GEMINI_API_KEY missing in Edge Function secrets (no key value logged).");
    return json({ ok: false, code: "missing-key", error: "المساعد غير مكوّن حاليًا — جرّب بعد قليل." }, 502);
  }

  /* 5) استدعاء Gemini */
  let result: any;
  try {
    result = await callGemini(systemPrompt(mode) + "\nسياق Study OS (استخدمه فقط):\n" + contextStr +
      "\n—————\n", toContents(body));
  } catch (e: any) {
    console.error("AI: gemini call threw", (e && e.name) || "error"); // دون تسجيل المفتاح
    return json({ ok: false, code: "server", error: "حدث خطأ مؤقت في المساعد. حاول مرة أخرى." }, 502);
  }

  if (result.text) {
    return json({ ok: true, reply: result.text, model: GEMINI_MODEL });
  }
  if (result.rate) {
    return json({ ok: false, code: "rate-limit", error: "وصل المساعد إلى حد الاستخدام المؤقت. حاول مرة أخرى بعد قليل." }, 429);
  }
  if (result.config) {
    console.error("AI: gemini rejected the request (status " + result.config + ") - check GEMINI_API_KEY validity.");
    return json({ ok: false, code: "server", error: "حدث خطأ مؤقت في المساعد. حاول مرة أخرى." }, 502);
  }
  if (result.empty || result.timeout) {
    return json({ ok: false, code: "timeout", error: "استغرق المساعد وقتًا أطول من المتوقع — حاول مرة أخرى." }, 504);
  }
  return json({ ok: false, code: "server", error: "حدث خطأ مؤقت في المساعد. حاول مرة أخرى." }, 502);
});