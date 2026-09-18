/* ═══════════════ STUDY OS — Edge Function: ai-assistant ═══════════════
   المساعد الذكي — يستخدم مفتاح Gemini الخاص بالمستخدم.
   1) يتحقق من JWT
   2) يقرأ ai_settings → يفك تشفير المفتاح
   3) يبني البرومبت حسب الوضع
   4) يتصل بـ Gemini API
   5) يُرجع الرد
   ═════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const ENCRYPTION_KEY = Deno.env.get("AI_SETTINGS_ENCRYPTION_KEY") || "";

/* ── AES-GCM decryption ── */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function decrypt(cipherHex: string, hexKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(hexKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const all = hexToBytes(cipherHex);
  const iv = all.slice(0, 12);
  const data = all.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

/* ── System prompts per mode ── */
const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `أنت مساعد Study OS — مساعد دراسي ذكي باللغة العربية.
اسمك "مساعد Study OS" وأنت جزء من تطبيق لإدارة الدراسة.
أجب بشكل مفيد ومختصر باللغة العربية فقط.
إذا كان السؤال غير متعلق بالدراسة، أجب بإجابة مختصرة.`,
  explain_question: `أنت مساعد Study OS — متخصص في شرح الأسئلة.
解答 بالعربية، خطوة بخطوة، باحترافية تعليمية.
ابدأ بتحليل السؤال، ثم الشرح التفصيلي مع ذكر القاعدة المعرفية المستخدمة.
إذا كان هناك خطأ في إجابة الطالب، اشرح السبب وكيفية التفكير الصحيح.`,
  quiz: `أنت مساعد Study OS — متخصص في إجراء الاختبارات التفاعلية.
أجرِ اختبارًا تفاعليًا: سؤال واحد في كل مرة.
ابدأ بسؤال واحد فقط، ثم انتظر إجابة الطالب قبل السؤال التالي.
قوّم إجابة الطالب فورًا مع الشرح.`,
  study_plan: `أنت مساعد Study OS — متخصص في وضع خطط المذاكرة.
استخدم بيانات الطالب لإنشاء خطة مذاكرة مخصصة.
حدد الأهداف اليومية والأسبوعية، ووزّع الوقت على المواد.`,
  progress_analysis: `أنت مساعد Study OS — متخصص في تحليل التقدم الدراسي.
حلّل بيانات الطالب واستنتج نقاط القوة والضعف.
قدم توصيات محددة لتحسين الأداء.`,
  error_bank_help: `أنت مساعد Study OS — متخصص في شرح الأخطاء.
اشرح الخطأ بالتفصيل، السبب، والطريقة الصحيحة.
استخدم أمثلة توضيحية.`
};

/* ── Build Gemini contents ── */
function buildContents(
  mode: string,
  message: string,
  context: any,
  history: Array<{ role: string; text: string }>
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const systemText = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.chat;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  /* system instruction as first user message */
  contents.push({ role: "user", parts: [{ text: systemText }] });
  contents.push({ role: "model", parts: [{ text: "فهمت، سأتبع هذه التعليمات بالضبط." }] });

  /* conversation history */
  for (const h of history) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    });
  }

  /* context injection */
  let contextStr = "";
  if (context && Object.keys(context).length > 0) {
    contextStr = "\n\n[بيانات الطالب]\n" + JSON.stringify(context, null, 2) + "\n[/بيانات الطالب]";
  }

  /* current message */
  contents.push({
    role: "user",
    parts: [{ text: message + contextStr }]
  });

  return contents;
}

/* ── Call Gemini API ── */
async function callGemini(
  apiKey: string,
  model: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.9
      }
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return { ok: false, error: `Gemini API ${res.status}: ${errBody.slice(0, 300)}` };
  }

  const data = await res.json();
  const candidates = data.candidates || [];
  if (candidates.length === 0) return { ok: false, error: "لم يُرجع Gemini أي رد." };

  const parts = candidates[0]?.content?.parts || [];
  const text = parts.map((p: any) => p.text || "").join("").trim();
  if (!text) return { ok: false, error: "رد Gemini فارغ." };

  return { ok: true, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  /* ── auth ── */
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth) return json({ ok: false, code: "auth", error: "غير مسجّل الدخول." }, 401);

  let userId: string;
  try {
    const result = await sb.auth.getUser(auth);
    if (result.error || !result.data?.user) {
      return json({ ok: false, code: "auth", error: "جلسة غير صالحة." }, 401);
    }
    userId = result.data.user.id;
  } catch {
    return json({ ok: false, code: "auth", error: "تعذر التحقق من الجلسة." }, 401);
  }

  /* Set the JWT on the Supabase client so auth.uid() works in RLS policies */
  await sb.auth.setSession({ access_token: auth, refresh_token: "" });

  /* ── env ── */
  if (!ENCRYPTION_KEY) return json({ ok: false, error: "AI_SETTINGS_ENCRYPTION_KEY غير مضبوط." }, 500);

  /* ── read body ── */
  let body: any = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const message = (body.message || "").trim();
  const mode = (body.mode || "chat").trim();
  const context = body.context || {};
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) return json({ ok: false, error: "الرسالة فارغة." }, 400);

  /* ── get user's API key ── */
  const { data: settings, error: dbErr } = await sb
    .from("ai_settings")
    .select("gemini_api_key_encrypted, gemini_model")
    .eq("user_id", userId)
    .maybeSingle();

  if (dbErr) return json({ ok: false, error: "خطأ في قاعدة البيانات." }, 500);
  if (!settings) return json({ ok: false, code: "no_key", error: "لم تُضف مفتاح Gemini API بعد. أضفه من الإعدادات." }, 404);

  let apiKey: string;
  try {
    apiKey = await decrypt(settings.gemini_api_key_encrypted, ENCRYPTION_KEY);
  } catch {
    return json({ ok: false, error: "تعذر فك تشفير المفتاح." }, 500);
  }

  const model = settings.gemini_model || "gemini-2.5-flash-lite";

  /* ── build & call ── */
  const contents = buildContents(mode, message, context, history);
  const geminiRes = await callGemini(apiKey, model, contents);

  if (!geminiRes.ok) {
    return json({ ok: false, error: geminiRes.error || "فشل الاتصال بـ Gemini." }, 502);
  }

  return json({ ok: true, text: geminiRes.text });
});
