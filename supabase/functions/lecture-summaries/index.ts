/* ═══════════════ STUDY OS — Edge Function: lecture-summaries ═══════════════
   إدارة ملخصات المحاضرات: CRUD + رفع ملفات PDF عبر Supabase Storage.
   - GET: list summaries for a subject
   - POST: upload PDF + create metadata
   - PUT: update metadata or replace file
   - DELETE: delete metadata + file
   ═════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS)
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "anon";
const BUCKET = "lecture-summaries";

function userClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

async function requireUser(req: Request): Promise<{ ok: boolean; userId?: string; error?: string; token?: string }> {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth) return { ok: false, error: "غير مسجّل الدخول." };
  try {
    const verifySb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const result = await verifySb.auth.getUser(auth);
    if (result.error || !result.data?.user) return { ok: false, error: "جلسة غير صالحة." };
    return { ok: true, userId: result.data.user.id, token: auth };
  } catch {
    return { ok: false, error: "تعذر التحقق من الجلسة." };
  }
}

function uuid(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const user = await requireUser(req);
  if (!user.ok) return json({ ok: false, error: user.error }, 401);
  const userId = user.userId!;
  const sb = userClient(user.token!);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "signed-url") {
        const filePath = url.searchParams.get("path");
        if (!filePath) return json({ ok: false, error: "path مطلوب." }, 400);
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(filePath, 3600);
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, url: data.signedUrl });
      }

      const subjectId = url.searchParams.get("subject_id");
      if (!subjectId) return json({ ok: false, error: "subject_id مطلوب." }, 400);

      const { data, error } = await sb
        .from("lecture_summaries")
        .select("*")
        .eq("user_id", userId)
        .eq("subject_id", subjectId)
        .order("lecture_number", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false });

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, summaries: data || [] });
    }

    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const title = (formData.get("title") as string || "").trim();
        const subjectId = (formData.get("subject_id") as string || "").trim();
        const lectureNumber = formData.get("lecture_number") ? parseInt(formData.get("lecture_number") as string) : null;
        const unit = (formData.get("unit") as string || "").trim() || null;

        if (!file) return json({ ok: false, error: "ملف PDF مطلوب." }, 400);
        if (!title) return json({ ok: false, error: "اسم الملخص مطلوب." }, 400);
        if (!subjectId) return json({ ok: false, error: "المادة مطلوبة." }, 400);
        if (file.type !== "application/pdf") return json({ ok: false, error: "يُسمح فقط بملفات PDF." }, 400);

        const id = uuid();
        const ext = file.name.split(".").pop() || "pdf";
        const filePath = `${userId}/${subjectId}/${id}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadErr } = await sb.storage
          .from(BUCKET)
          .upload(filePath, arrayBuffer, { contentType: "application/pdf", upsert: false });

        if (uploadErr) return json({ ok: false, error: "فشل رفع الملف: " + uploadErr.message }, 500);

        const { error: insertErr } = await sb
          .from("lecture_summaries")
          .insert({
            id,
            user_id: userId,
            subject_id: subjectId,
            title,
            lecture_number: lectureNumber,
            unit,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            status: "unread",
            is_favorite: false,
            last_page: 0
          });

        if (insertErr) {
          await sb.storage.from(BUCKET).remove([filePath]);
          return json({ ok: false, error: "فشل حفظ البيانات: " + insertErr.message }, 500);
        }

        return json({ ok: true, id });
      }

      return json({ ok: false, error: "صيغة الطلب غير صالحة." }, 400);
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const { id, title, lecture_number, unit, status, is_favorite, last_page, replace_file } = body;
      if (!id) return json({ ok: false, error: "id مطلوب." }, 400);

      const update: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) update.title = title;
      if (lecture_number !== undefined) update.lecture_number = lecture_number;
      if (unit !== undefined) update.unit = unit;
      if (status !== undefined) update.status = status;
      if (is_favorite !== undefined) update.is_favorite = is_favorite;
      if (last_page !== undefined) update.last_page = last_page;

      const { error } = await sb
        .from("lecture_summaries")
        .update(update)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ ok: false, error: "id مطلوب." }, 400);

      const { data: row, error: selErr } = await sb
        .from("lecture_summaries")
        .select("file_path")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (selErr) return json({ ok: false, error: selErr.message }, 500);
      if (!row) return json({ ok: false, error: "الملخص غير موجود." }, 404);

      await sb.storage.from(BUCKET).remove([row.file_path]);

      const { error: delErr } = await sb
        .from("lecture_summaries")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (delErr) return json({ ok: false, error: delErr.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e: any) {
    return json({ ok: false, error: (e && e.message) || "خطأ داخلي." }, 500);
  }
});
