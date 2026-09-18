/* ═══════════════ STUDY OS — Edge Function: ai-settings ═══════════════
   إدارة مفتاح Gemini API الخاص بالمستخدم.
   - GET: هل المستخدم عنده مفتاح + النموذج؟
   - POST: حفظ/تحديث المفتاح (مشفر AES-GCM) + اختبار الاتصال
   - DELETE: حذف المفتاح
   ═════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

/* ── AES-GCM encryption helpers ── */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(hexKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipherBuf);
  const result = new Uint8Array(iv.length + cipherBytes.length);
  result.set(iv);
  result.set(cipherBytes, iv.length);
  return Array.from(result).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function decrypt(cipherHex: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const all = hexToBytes(cipherHex);
  const iv = all.slice(0, 12);
  const data = all.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

async function requireUser(req: Request): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth) return { ok: false, error: "غير مسجّل الدخول." };
  try {
    const result = await sb.auth.getUser(auth);
    if (result.error || !result.data?.user) {
      return { ok: false, error: "جلسة غير صالحة." };
    }
    return { ok: true, userId: result.data.user.id };
  } catch {
    return { ok: false, error: "تعذر التحقق من الجلسة." };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const user = await requireUser(req);
  if (!user.ok) return json({ ok: false, error: user.error }, 401);
  const userId = user.userId!;

  if (!ENCRYPTION_KEY) return json({ ok: false, error: "AI_SETTINGS_ENCRYPTION_KEY غير مضبوط." }, 500);

  try {
    if (req.method === "GET") {
      const { data } = await sb
        .from("ai_settings")
        .select("gemini_api_key_encrypted, gemini_model, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!data) return json({ ok: true, configured: false });

      return json({
        ok: true,
        configured: true,
        model: data.gemini_model,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    }

    if (req.method === "DELETE") {
      await sb.from("ai_settings").delete().eq("user_id", userId);
      return json({ ok: true });
    }

    if (req.method === "POST") {
      let body: any = {};
      try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

      const action = body.action || "save";

      if (action === "test") {
        const { data } = await sb
          .from("ai_settings")
          .select("gemini_api_key_encrypted, gemini_model")
          .eq("user_id", userId)
          .maybeSingle();
        if (!data) return json({ ok: false, error: "لم تُضف مفتاحًا بعد." }, 404);

        const plainKey = await decrypt(data.gemini_api_key_encrypted, ENCRYPTION_KEY);
        const model = data.gemini_model || "gemini-2.5-flash-lite";
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${plainKey}`;
        const res = await fetch(testUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Say hi in 5 words" }] }],
            generationConfig: { maxOutputTokens: 20 }
          })
        });
        if (!res.ok) {
          const err = await res.text().catch(() => "Unknown error");
          return json({ ok: false, error: `Gemini API error ${res.status}: ${err.slice(0, 200)}` }, 502);
        }
        return json({ ok: true });
      }

      const apiKey = (body.apiKey || "").trim();
      const model = (body.model || "gemini-2.5-flash-lite").trim();

      if (!apiKey) return json({ ok: false, error: "أدخل مفتاح Gemini API." }, 400);
      if (model !== "gemini-2.5-flash-lite") return json({ ok: false, error: "النموذج المدعوم حاليًا: gemini-2.5-flash-lite فقط." }, 400);

      const encrypted = await encrypt(apiKey, ENCRYPTION_KEY);

      const { error } = await sb
        .from("ai_settings")
        .upsert({
          user_id: userId,
          gemini_api_key_encrypted: encrypted,
          gemini_model: model,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (error) return json({ ok: false, error: "تعذر الحفظ: " + error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e: any) {
    return json({ ok: false, error: (e && e.message) || "خطأ داخلي." }, 500);
  }
});
