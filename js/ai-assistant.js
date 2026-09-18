/* ═══════════════ STUDY OS — ai-assistant.js (المساعد الذكي) ═══════════════
   طبقة العميل للمساعد الذكي: صفحة كاملة (#/ai-assistant) تتخاطب مع Gemini
   حصريًا عبر Edge Function `ai-assistant` في Supabase. لا يوجد أي اتصال
   مباشر بـ Gemini، ولا يُحفظ أي مفتاح/رمز في هذا الملف أو في التخزين.

   ── المعمارية ──────────────────────────────────────────────────────
   المتصفح → App.Sync.client().functions.invoke("ai-assistant", {...})
           → Supabase Edge Function تتحقق من JWT وتتصل بـ Gemini
           → الرد (أو رسالة خطأ عربية) يعود إلى الصفحة.

   ── الخصوصية ───────────────────────────────────────────────────────
   • لا تُرسل كلمة مرور ولا refresh token ولا أي secret — فقط هوية المستخدم
     عبر رأس Authorization (Bearer access_token) إلى Edge Function ليُتحقق منها
     بخدمة getUser ولا يُرسل أي userId ثقةً من المتصفح.
   • buildAIContext تبني سياقًا ضيقًا حسب السؤال فقط، عند الإرسال لا عند الكتابة.
   • المحادثة في الذاكرة فقط أثناء فتح الصفحة — لا تُحفظ ولا تدخل في المزامنة.
   ═════════════════════════════════════════════════════════════════════ */
"use strict";
window.App = window.App || {};
App.Assistant = (function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;
  const $ = id => document.getElementById(id);

  /* ── حالة في الذاكرة فقط ── */
  let msgs = [];            // [{ id, role: "user"|"ai", text, mode, error?, typing?, retry?, code?, tag?, t }]
  let mode = "chat";        // الوضع النشط (يبقى لأحاديث المتابعة)
  let sending = false;
  let pendingMistakeId = null;  // خطأ منتقى من بنك الأخطاء
  let pendingAuto = null;       // إرسال تلقائي عند فتح الصفحة من رابط خارجي
  let signedIn = false;         // آخر حالة مصادقة معروفة (تُستخدم للإشعارات فقط)
  let stickBottom = true;       // تمرير تلقائي حتى الأسفل ما لم يصعد المستخدم

  const MAX_CHARS = 4000;
  const EDGE_FN = "ai-assistant";
  const CLIENT_TIMEOUT_MS = 65000;

  const MODES = ["chat", "explain_question", "quiz", "study_plan", "progress_analysis", "error_bank_help"];
  const MODE_LABEL = {
    chat: "محادثة",
    explain_question: "شرح سؤال",
    quiz: "اختبار تفاعلي",
    study_plan: "خطة مذاكرة",
    progress_analysis: "تحليل المستوى",
    error_bank_help: "شرح خطأ"
  };
  const QUICK_START = {
    explain_question: "أريد شرح سؤال أخطأت فيه — سأرسله لك الآن.",
    quiz: "اختبرني — سؤال واحد في كل مرة، وقوّم إجاباتي.",
    progress_analysis: "حلّل مستواي في الدراسة من بياناتي.",
    study_plan: "ساعدني أضع خطة مذاكرة واضحة."
  };
  const QUICK_CARDS = [
    { m: "explain_question", ic: "📚", t: "اشرح لي سؤالًا", d: "افهم السؤال خطوة بخطوة" },
    { m: "quiz", ic: "🧠", t: "اختبرني", d: "اختبر معلوماتي بطريقة ذكية" },
    { m: "progress_analysis", ic: "📊", t: "حلل مستواي", d: "اعرف نقاط القوة والضعف" },
    { m: "study_plan", ic: "📅", t: "ساعدني في خطة مذاكرة", d: "أنشئ خطة مناسبة لوقتي وأهدافي" }
  ];
  const SEND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const COPY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHECK_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const WIFI_OFF_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 13.4A13.9 13.9 0 0 0 6 9.6"/><path d="M16.2 16.4a8 8 0 0 0-8.4-1.1"/><path d="M12 20h.01"/><path d="M2 2l20 20"/></svg>';
  const AI_LOGO_SRC = "img/ai-logo.png";

  /* ── سياق Study OS: يُبنى فقط عند الضغط على إرسال، حسب الوضع ── */
  function mistakeNugget(m){
    const n = {
      subject: D.subjName(m.subject),
      type: m.type === "mcq" ? "اختياري" : "مقالي",
      question: m.question || "",
      studentAnswer: m.studentAnswer || "",
      explanation: m.explanation || "",
      reason: m.reason || ""
    };
    if (m.type === "mcq"){
      const opts = m.options || [];
      n.options = opts;
      n.correctAnswer = m.correctAnswer || "";
      if (m.studentAnswerId && opts.length){
        const i = String(m.studentAnswerId).charCodeAt(0) - 65;
        if (i >= 0 && i < opts.length) n.studentAnswer = opts[i];
      }
    } else {
      n.modelAnswer = m.modelAnswer || "";
    }
    return n;
  }

  function buildAIContext(m, st){
    st = st || S.getState();
    const c = {};
    if (m === "progress_analysis"){
      const po = S.progressOverview(st);
      const today = U.todayKey();
      const last7 = [];
      for (let i = 6; i >= 0; i--){
        const k = U.addDaysKey(today, -i);
        const d = st.daily[k] || {};
        last7.push({ date: k, studyMin: d.studyMin || 0, sessions: d.sessions || 0 });
      }
      const perSubjectMinutes = {};
      D.subjects.filter(x => x.id !== "general").forEach(x => { perSubjectMinutes[x.name] = po.perSubject[x.id] || 0; });
      c.progress = {
        totalStudyMin: po.totalMin,
        sessionsTotal: po.sessionsTotal,
        weekStudyMin: po.weekNow,
        prevWeekStudyMin: po.weekPrev,
        weekChangePct: po.deltaPct,
        bestSubject: po.best ? D.subjName(po.best.subject) : null,
        leastSubject: po.least ? D.subjName(po.least.subject) : null,
        perSubjectMinutes,
        dailyGoalMin: st.settings.dailyGoalMinutes,
        weeklyGoalMin: st.settings.weeklyGoalMinutes,
        monthlyGoalMin: st.settings.monthlyGoalMinutes,
        goals: { todayPct: S.goalStatus("day").pct, weekPct: S.goalStatus("week").pct, monthPct: S.goalStatus("month").pct },
        streak: D.streakOf(st),
        longestStreak: D.longestStreakOf(st),
        totalQuestions: po.questions,
        masteredQuestions: po.mastered,
        reviewsTotal: po.reviewsTotal,
        reviewAccuracyPct: po.accurate,
        repeatedMistakes: po.repeated,
        last7
      };
    } else if (m === "study_plan"){
      const sp = S.subjectProgress(st);
      const spMap = {};
      D.subjects.filter(x => x.id !== "general").forEach(x => {
        spMap[x.name] = { monthlyMin: (sp[x.id] || {}).done || 0, monthlyGoalMin: (sp[x.id] || {}).goal || 0, pct: (sp[x.id] || {}).pct || 0 };
      });
      const exams = (st.exams || []).map(x => ({
        date: x.date, title: x.title || "", subject: D.subjName(x.subject),
        scorePct: x.count ? Math.round((x.correct || 0) / x.count * 100) : null
      })).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const weaknesses = D.subjects.filter(x => x.id !== "general").map(x => ({
        name: x.name,
        openMistakes: (st.mistakes || []).filter(mm => mm.subject === x.id && mm.status !== "mastered").length
      })).sort((a, b) => b.openMistakes - a.openMistakes);
      c.plan = {
        subjects: D.subjects.filter(x => x.id !== "general").map(x => ({ name: x.name, hourGoal: x.hourGoal })),
        monthly: spMap,
        goals: { dailyMin: st.settings.dailyGoalMinutes, weeklyMin: st.settings.weeklyGoalMinutes, monthlyMin: st.settings.monthlyGoalMinutes },
        upcomingExams: exams,
        currentPlans: (st.studyPlans || []).map(p => ({ subject: D.subjName(p.subject), examDate: p.examDate, chapters: p.chapters, dailyMinutes: p.dailyMinutes })),
        recentSessions: (st.blocks || []).slice(-12).map(b => ({ date: b.date, subject: D.subjName(b.subject || "general"), minutes: b.minutes })).reverse(),
        weaknesses
      };
    } else if (m === "explain_question" || m === "error_bank_help"){
      const mk = pendingMistakeId ? S.findMistake(pendingMistakeId) : null;
      c.question = mk ? mistakeNugget(mk) : null;
    } else {
      const ts = S.todayStats();
      c.summary = {
        todayStudyMin: ts.goalMin,
        dailyGoalMin: st.settings.dailyGoalMinutes,
        streak: D.streakOf(st),
        level: D.levelInfo(st.xp).level,
        subjects: D.subjects.filter(x => x.id !== "general").map(x => x.name)
      };
    }
    return c;
  }

  /* ── الاتصال بالـ Edge Function عبر supabase.functions.invoke ── */
  /* قراءة نتيجة invoke من supabase-js 2.x:
     - الاستجابة الناجحة: { data: { ok:true, reply } } أو { data: { ok:false, code, error } }
     - مع إصدارات supabase-js الأحدث (مثل 2.116.0) يكون error.context كائن Response خامًا
       (لا يُحوَّل JSON تلقائيًا) — نقرأ status والجسد منه حتى تظهر رسائلنا العربية.
     - مع الإصدارات القديمة: error.context = { status, data } (جسم محلل). */
  async function parseInvoke(res){
    if (!res) return { ok: false, status: 0, code: "", msg: "" };
    if (res.data){
      const d = res.data;
      if (d && typeof d === "object" && d.ok === false){
        return { ok: false, status: d.status || 0, code: d.code || "", msg: d.error || "" };
      }
      return { ok: true, reply: (d && d.reply) || "" };
    }
    // res.error — نستخرج الحالة والجسم من صيغ الخطأ المتوقعة
    const e = res.error || {};
    const ctx = (e && e.context) || {};
    if (ctx instanceof Response){
      // supabase-js 2.116.0+: error.context هو Response فعلي
      const status = ctx.status || e.status || 0;
      let code = "", msg = "";
      try {
        let body = null;
        const ct = String((ctx.headers && ctx.headers.get && ctx.headers.get("content-type")) || "");
        const r = (typeof ctx.clone === "function") ? ctx.clone() : ctx;
        try {
          body = (ct.indexOf("application/json") !== -1) ? await r.json() : await r.text();
        } catch(_e2){
          try { body = await r.text(); } catch(_e3){ body = null; }
        }
        if (body && typeof body === "object"){
          code = body.code || "";
          msg = body.error || body.message || body.msg || "";
        } else if (typeof body === "string" && body){
          msg = body;
        }
      } catch(_e){ /* نكتفي برسالة المكتبة العامة */ }
      return { ok: false, status: +status || 0, code: code || "", msg: msg || e.message || "" };
    }
    let body = ctx.data;
    if (!body || typeof body !== "object") body = {};
    const status = ctx.status || e.status || 0;
    return { ok: false, status: +status || 0, code: body.code || "", msg: body.error || body.message || e.message || "" };
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function withTimeout(p, ms){
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { const e = new Error("timeout"); e.name = "TimeoutError"; reject(e); }, ms);
      p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  async function callEdge(payload){
    const c = await App.Sync.client();
    // الهوية الحصرية من جلسة Supabase الحقيقية — لا anon ولا userId مفبرك
    const s = await c.auth.getSession();
    const session = s && s.data && s.data.session;
    if (!session || !session.access_token){
      return { ok: false, status: 401, code: "auth", msg: "سجل الدخول لاستخدام المساعد الذكي." };
    }
    const res = await c.functions.invoke(EDGE_FN, {
      body: payload,
      headers: { Authorization: "Bearer " + session.access_token }
    });
    return parseInvoke(res);
  }

  function retryable(status, code){
    if (status === 0) return true;                  // خطأ شبكة/مهلة
    if (status === 429 || status === 401 || status === 403 || status === 400 || code === "GEMINI_TIMEOUT") return false;
    if (status >= 500) return true;
    return code === "server" || code === "timeout";
  }

  function userError(status, code){
    if (code === "auth" || status === 401 || status === 403) return "سجل الدخول لاستخدام المساعد الذكي.";
    if (code === "rate-limit" || status === 429) return "وصل المساعد إلى حد الاستخدام المؤقت. حاول مرة أخرى بعد قليل.";
    if (code === "missing-key") return "المساعد غير مكوّن حاليًا — جرّب بعد قليل.";
    if (code === "GEMINI_TIMEOUT" || code === "timeout" || status === 504) return "المساعد الذكي استغرق وقتًا أطول من المتوقع. حاول مرة أخرى.";
    if (status >= 500 || status === 0) return "تعذر الاتصال بالمساعد حاليًا.";
    return "حدث خطأ في المساعد — حاول مرة أخرى.";
  }

  async function attempt(payload){
    try {
      const r = await withTimeout(callEdge(payload), CLIENT_TIMEOUT_MS);
      if (r.ok) return { ok: true, reply: r.reply };
      return { ok: false, status: r.status, code: r.code, msg: r.msg, again: retryable(r.status, r.code) };
    } catch (e){
      return { ok: false, status: 0, code: (e && e.name === "TimeoutError") ? "timeout" : "", msg: "", again: true };
    }
  }

  /* ── الإرسال ── */
  async function send(text, m){
    const msg = (text || "").trim();
    const md = MODES.indexOf(m) >= 0 ? m : "chat";
    if (!msg || sending) return;
    if (msg.length > MAX_CHARS){ UI.toast("الرسالة طويلة جدًا — الحد الأقصى " + MAX_CHARS + " حرف.", "error", "info"); return; }
    if (typeof navigator === "undefined" || !navigator.onLine){
      pushUser(msg, md);
      pushAI("المساعد الذكي يحتاج إلى اتصال بالإنترنت.", { error: true });
      return;
    }

    sending = true;
    setSendingUI(true);
    stickBottom = true;
    pushUser(msg, md);
    const pendingId = pushAI("", { typing: true });

    let s;
    try { s = await App.Sync.getSession(); } catch (_e){ s = { ok: false }; }
    if (!s || !s.ok || !s.session){
      signedIn = false;
      applyShellState();
      patchAI(pendingId, "سجل الدخول لاستخدام المساعد الذكي.", { error: true, code: "auth" });
      endSend();
      return;
    }
    signedIn = true;
    applyShellState();

    mode = md; // المتابعات تستمر بنفس الوضع (الاختبار مثلًا) حتى يغيّر المستخدم
    const payload = {
      message: msg,
      mode: md,
      context: buildAIContext(md, S.getState()),
      history: msgsToHistory()
    };

    let out = await attempt(payload);
    if (out.again){
      await sleep(1200);
      if (!sending) return; // غادر المستخدم الصفحة أثناء الانتظار
      out = await attempt(payload);
    }

    if (out.ok){
      patchAI(pendingId, out.reply, {});
    } else {
      patchAI(pendingId, out.msg || userError(out.status, out.code), { error: true, retry: !!(out.again), code: out.code });
    }
    endSend();
  }

  function endSend(){
    sending = false;
    setSendingUI(false);
  }

  function msgsToHistory(){
    const out = [];
    for (let i = Math.max(0, msgs.length - 16); i < msgs.length; i++){
      const x = msgs[i];
      if (!x || x.typing || x.error) continue;
      if (x.role === "user" || x.role === "ai"){
        out.push({ role: x.role === "user" ? "user" : "model", text: x.text });
      }
    }
    return out;
  }

  /* ── الرسائل في الذاكرة ── */
  let seq = 0;
  function pushUser(text, md){
    const id = "u" + (++seq);
    const x = { id, role: "user", text, mode: md, tag: MODE_LABEL[md] || "", t: Date.now() };
    msgs.push(x);
    paint();
    return id;
  }
  function pushAI(text, o){
    o = o || {};
    const id = "a" + (++seq);
    msgs.push({ id, role: "ai", text, typing: !!o.typing, error: !!o.error, retry: !!o.retry, code: o.code || "", t: Date.now() });
    paint();
    return id;
  }
  function patchAI(id, text, o){
    o = o || {};
    const x = msgs.find(m => m.id === id);
    if (!x) return;
    x.text = text;
    x.typing = false;
    x.error = !!o.error;
    x.retry = !!o.retry;
    x.code = o.code || "";
    paint();
  }

  function lastUserMsg(){
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user") return msgs[i];
    return null;
  }

  /* ── العرض ── */
  function escText(t){
    if (!t) return "";
    return U.esc(String(t)).replace(/\n/g, "<br>");
  }

  /* عرض Markdown آمن: كل النص يُهرب قبل أي تحويل، ولا يُدخل أي HTML من المصدر. */
  function inlineMD(s){
    s = s.replace(/`([^`\n]+)`/g, (m, c) => '<code class="ai-c">' + c + '</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function renderMD(text){
    text = String(text || "");
    const blocks = [];
    text = text.replace(/```[a-z]*\n?([\s\S]*?)```/g, (m, code) => {
      blocks.push('<pre><code>' + U.esc(code) + '</code></pre>');
      return "\u0000BLK" + (blocks.length - 1) + "\u0000";
    });
    const out = [];
    text.split(/\n\s*\n/).forEach(seg0 => {
      if (!seg0.trim()) return;
      const bm = seg0.match(/^\u0000BLK(\d+)\u0000$/);
      if (bm){ out.push(blocks[+bm[1]]); return; }
      seg0 = inlineMD(U.esc(seg0));
      const lines = seg0.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      if (lines.every(l => /^&gt;/.test(l))){
        out.push('<blockquote>' + lines.map(l => l.replace(/^&gt;\s?/, "")).join('<br>') + '</blockquote>');
        return;
      }
      const h = lines[0].match(/^(#{1,3})\s+(.*)$/);
      if (h){ out.push('<h' + (h[1].length + 1) + '>' + h[2] + '</h' + (h[1].length + 1) + '>'); return; }
      let html = "", openU = false, openO = false, any = false;
      lines.forEach(l => {
        const um = l.match(/^[-*]\s+(.*)$/);
        const om = l.match(/^\d+[.)]\s+(.*)$/);
        if (um){
          if (openO){ html += '</ol>'; openO = false; }
          if (!openU){ html += '<ul>'; openU = true; }
          html += '<li>' + um[1] + '</li>'; any = true; return;
        }
        if (om){
          if (openU){ html += '</ul>'; openU = false; }
          if (!openO){ html += '<ol>'; openO = true; }
          html += '<li>' + om[1] + '</li>'; any = true; return;
        }
        if (openU){ html += '</ul>'; openU = false; }
        if (openO){ html += '</ol>'; openO = false; }
        if (/^-{3,}$/.test(l)){ html += '<hr>'; any = true; return; }
        html += '<p>' + l + '</p>'; any = true;
      });
      if (openU) html += '</ul>';
      if (openO) html += '</ol>';
      if (any && html) out.push(html);
    });
    return out.join("");
  }

  function avatarGlyph(){
    const a = (S.getState().user && S.getState().user.avatar) || "🙂";
    if (a.indexOf("data:image") === 0 || a.indexOf("http") === 0){
      return '<img class="av-img" src="' + a + '" alt="">';
    }
    return '<span>' + a + '</span>';
  }

  function bubbleHTML(x){
    const role = x.role === "user" ? "user" : "ai";
    const cls = "ai-msg " + role + (x.error ? " err" : "") + (x.typing ? " thinking" : "");
    const av = role === "ai"
      ? '<span class="ai-av"><img class="ai-logo-img" src="' + AI_LOGO_SRC + '" alt="" decoding="async"></span>'
      : '<span class="ai-av">' + avatarGlyph() + '</span>';
    let body;
    if (x.typing){
      body = '<span class="ai-think-txt">جاري التفكير</span><span class="t i1"></span><span class="t i2"></span><span class="t i3"></span>';
    } else if (x.error){
      body = '<div class="ai-md"><p>' + escText(x.text) + '</p></div>';
    } else if (role === "ai"){
      body = '<div class="ai-md">' + renderMD(x.text) + '</div>';
    } else {
      body = '<div class="ai-md"><p>' + escText(x.text) + '</p></div>';
    }
    const time = x.t ? '<span class="ai-time num">' + U.fmtTimeHM(new Date(x.t)) + '</span>' : "";
    const meta = '<div class="ai-meta"><span class="ai-role">' + (role === "ai" ? "مساعد Study OS" : "أنت") + '</span>' + time + '</div>';
    const tag = x.tag && role === "user" ? '<span class="ai-tag">' + U.esc(x.tag) + '</span>' : "";
    let actions = "";
    if (role === "ai" && !x.typing && !x.error){
      actions = '<div class="ai-actions"><button class="ai-act ai-copy" data-ai="copy" data-copy="' + x.id + '" aria-label="نسخ الرد">' + COPY_ICON + '<span>نسخ</span></button></div>';
    } else if (x.error && x.retry){
      actions = '<div class="ai-actions"><button class="ai-act ai-retry" data-ai="retry" aria-label="إعادة المحاولة">' + I.get("refresh", 12) + '<span>إعادة المحاولة</span></button></div>';
    } else if (x.error && x.code === "auth"){
      actions = '<div class="ai-actions"><button class="ai-act ai-login danger" data-ai="login" aria-label="تسجيل الدخول">' + I.get("user", 12) + '<span>تسجيل الدخول</span></button></div>';
    }
    return '<div class="' + cls + '" data-id="' + x.id + '">' + av + '<div class="ai-bubble">' + meta + tag + body + actions + '</div></div>';
  }

  function welcome(){
    return '<div class="ai-welcome">' +
      '<div class="ai-logo"><img class="ai-logo-img" src="' + AI_LOGO_SRC + '" alt="المساعد الذكي" decoding="async"><span class="ai-spark">' + I.get("star", 13) + '</span></div>' +
      '<h2 class="ai-w-title">أهلاً بك 👋</h2>' +
      '<p class="ai-w-hello">أنا مساعد Study OS</p>' +
      '<p class="ai-w-sub">اسألني عن دراستك، اشرح لي سؤالًا، اختبرني، أو ساعدني في تنظيم مذاكرتك.</p>' +
      '<div class="ai-quick">' + QUICK_CARDS.map(q =>
        '<button class="quick" data-ai="qa" data-mode="' + q.m + '">' +
          '<span class="q-ic" aria-hidden="true">' + q.ic + '</span>' +
          '<span class="q-txt"><b>' + q.t + '</b><small>' + q.d + '</small></span>' +
        '</button>').join("") +
      '</div>' +
    '</div>';
  }

  function headerHTML(){
    return '<header class="ai-header">' +
      '<div class="ai-head-brand">' +
        '<span class="ai-head-ic"><img class="ai-logo-img" src="' + AI_LOGO_SRC + '" alt="" decoding="async"></span>' +
        '<div class="ai-head-txt">' +
          '<div class="page-title">المساعد الذكي</div>' +
          '<div class="ai-head-sub">Study OS AI</div>' +
        '</div>' +
      '</div>' +
      '<div class="ai-head-side">' +
        '<span class="ai-status" id="ai-status"><i class="ai-status-dot" aria-hidden="true"></i><span id="ai-status-txt">جاهز للمساعدة</span></span>' +
        '<button class="btn glass sm ai-clear" data-ai="clear" id="ai-clear" aria-label="بدء محادثة جديدة">' + I.get("plus", 14) + '<span>محادثة جديدة</span></button>' +
      '</div>' +
    '</header>';
  }

  function paint(){
    const chat = $("ai-chat"), inner = $("ai-chat-in");
    if (!chat || !inner) return;
    const clr = $("ai-clear");
    if (clr) clr.hidden = !msgs.length;
    if (!msgs.length){
      inner.className = "ai-chat-in centered";
      inner.innerHTML = welcome();
    } else {
      inner.className = "ai-chat-in";
      inner.innerHTML = msgs.map(bubbleHTML).join("");
    }
    if (stickBottom && msgs.length) requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
    else if (!msgs.length) chat.scrollTop = 0;
    const modebar = $("ai-modebar");
    if (modebar){
      const chip = modebar.querySelector(".ai-mode-chip");
      if (chip) chip.textContent = "الوضع: " + (MODE_LABEL[mode] || mode);
      modebar.hidden = mode === "chat";
    }
  }

  function setSendingUI(on){
    const btn = $("ai-send");
    const input = $("ai-input");
    const box = $("ai-inputbox");
    if (btn){
      btn.disabled = on;
      btn.setAttribute("aria-busy", on ? "true" : "false");
      btn.innerHTML = on ? '<span class="ai-send-load" aria-hidden="true"><i></i><i></i><i></i></span>' : SEND_ICON;
    }
    if (input) input.readOnly = on;
    if (box) box.classList.toggle("busy", on);
  }

  function autosize(){
    const el = $("ai-input");
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, 190) + "px";
    const btn = $("ai-send");
    if (btn) btn.classList.toggle("off", !el.value.trim());
  }

  function resetAll(){
    msgs = [];
    mode = "chat";
    pendingMistakeId = null;
    pendingAuto = null;
    stickBottom = true;
    const input = $("ai-input");
    if (input){ input.value = ""; autosize(); }
    paint();
    refreshGate();
    if (input) input.focus();
  }

  /* ── حالات الصفحة: تسجيل الدخول والاتصال ── */
  async function refreshGate(){
    let ok = false;
    try { const s = await App.Sync.getSession(); ok = !!(s && s.ok && s.session); } catch (_e){ ok = false; }
    signedIn = ok;
    applyShellState();
  }

  function applyShellState(){
    const on = (typeof navigator !== "undefined") ? navigator.onLine : true;
    const status = $("ai-status"), txt = $("ai-status-txt");
    if (status) status.classList.toggle("off", !on);
    if (txt) txt.textContent = on ? "جاهز للمساعدة" : "غير متصل";
    const notice = $("ai-notice");
    if (!notice) return;
    if (!on){
      notice.className = "ai-notice show offline";
      notice.innerHTML = WIFI_OFF_ICON + '<span>المساعد الذكي يحتاج إلى اتصال بالإنترنت.</span>';
    } else if (!signedIn){
      notice.className = "ai-notice show warn";
      notice.innerHTML = '<span>سجل الدخول لاستخدام المساعد الذكي.</span>' +
        '<button class="ai-act ai-login danger" data-ai="login" aria-label="تسجيل الدخول">' + I.get("user", 12) + '<span>تسجيل الدخول</span></button>';
    } else {
      notice.className = "ai-notice";
      notice.innerHTML = "";
    }
  }

  function doLogin(){
    if (!App.Sync || !App.Sync.signIn){
      UI.toast("طبقة السحابة غير محمّلة — تحقق من الاتصال.", "error", "info");
      return;
    }
    Promise.resolve(App.Sync.signIn()).then(res => {
      if (res && res.error) UI.toast("تعذر فتح تسجيل الدخول — حاول مرة أخرى.", "error", "info");
    }).catch(() => {});
  }

  async function copyMessage(id, btn){
    const x = msgs.find(m => m.id === id);
    if (!x || !x.text) return;
    let okc = false;
    try { await navigator.clipboard.writeText(x.text); okc = true; } catch (_e){ okc = false; }
    btn.innerHTML = okc ? CHECK_ICON + '<span>تم النسخ</span>' : COPY_ICON + '<span>نسخ</span>';
    btn.classList.toggle("done", okc);
    setTimeout(() => {
      btn.classList.remove("done");
      btn.innerHTML = COPY_ICON + '<span>نسخ</span>';
    }, 1500);
  }

  /* ── الربط ── */
  function bind(root){
    const sendBtn = $("ai-send");
    const input = $("ai-input");
    if (sendBtn) sendBtn.addEventListener("click", () => { const v = input ? input.value : ""; if (input){ input.value = ""; autosize(); } send(v, mode); });
    if (input){
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey){
          e.preventDefault();
          const v = input.value;
          input.value = "";
          autosize();
          send(v, mode);
        }
        autosize();
      });
      input.addEventListener("input", autosize);
    }
    const chat = $("ai-chat");
    /* تمرير ذكي: نلتصق بالأسفل إلا إذا صعد المستخدم */
    if (chat) chat.addEventListener("scroll", () => {
      stickBottom = (chat.scrollHeight - chat.scrollTop - chat.clientHeight) < 120;
    }, { passive: true });
    /* تفويض: الأزرار الداخلية تُعاد لصقها في كل paint، فنفوض النقرات على الحاوية الثابتة. */
    if (chat){
      chat.addEventListener("click", e => {
        const q = e.target.closest("[data-ai='qa']");
        if (q){
          const m = q.dataset.mode;
          mode = m;
          pendingMistakeId = null;
          send(QUICK_START[m] || "", m);
          return;
        }
        const rt = e.target.closest("[data-ai='retry']");
        if (rt){
          const last = lastUserMsg();
          if (last) send(last.text, last.mode || "chat");
          return;
        }
        const cp = e.target.closest("[data-ai='copy']");
        if (cp){
          copyMessage(cp.getAttribute("data-copy"), cp);
          return;
        }
        const lg = e.target.closest("[data-ai='login']");
        if (lg){ doLogin(); return; }
      });
    }
    const notice = $("ai-notice");
    if (notice){
      notice.addEventListener("click", e => {
        if (e.target.closest("[data-ai='login']")) doLogin();
      });
    }
    root.querySelectorAll("[data-ai='clear']").forEach(b => b.addEventListener("click", resetAll));
    root.querySelectorAll("[data-ai='modechat']").forEach(b => b.addEventListener("click", () => { mode = "chat"; pendingMistakeId = null; }));
  }

  /* ── الصفحة ── */
  function render(root, ctx){
    if (ctx && ctx.mistake){
      pendingMistakeId = ctx.mistake;
      pendingAuto = { m: "error_bank_help", text: "اشرح لي هذا الخطأ من بنك أخطائي وساعدني أفهمه ولا تكتفِ بالإجابة — اشرح السبب." };
    }
    document.body.classList.add("ai-route");
    root.innerHTML =
      '<div class="ai-page">' +
        headerHTML() +
        '<div class="ai-body">' +
          '<div class="ai-chat" id="ai-chat" role="log" aria-live="polite">' +
            '<div class="ai-chat-in" id="ai-chat-in"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ai-inputbar">' +
          '<div class="ai-modebar" id="ai-modebar" hidden>' +
            '<span class="ai-mode-chip">' + (MODE_LABEL[mode] || mode) + '</span>' +
            '<button class="ai-mode-clear" data-ai="modechat" title="العودة لمحادثة عادية" aria-label="العودة لمحادثة عادية">' + I.get("close", 12) + '</button>' +
          '</div>' +
          '<div class="ai-notice" id="ai-notice" role="status" aria-live="polite"></div>' +
          '<div class="ai-input" id="ai-inputbox">' +
            '<textarea id="ai-input" class="ai-input-ta" rows="1" placeholder="اكتب سؤالك للمساعد..." enterkeyhint="send" autocomplete="off" aria-label="رسالتك للمساعد"></textarea>' +
            '<button class="ai-send" id="ai-send" aria-label="إرسال" title="إرسال">' + SEND_ICON + '</button>' +
          '</div>' +
          '<div class="ai-hint"><span><span class="k">Enter</span> للإرسال · <span class="k">Shift+Enter</span> لسطر جديد</span><span class="ai-hint-sub">مساعد مدعوم بالذكاء الاصطناعي — قد يرتكب أخطاء، تأكد من المعلومات المهمة</span></div>' +
        '</div>' +
      '</div>';

    paint();
    applyShellState();
    refreshGate();
    const input = $("ai-input");
    if (input){ autosize(); setTimeout(() => input.focus(), 120); }

    bind(root);
    if (pendingAuto){
      const auto = pendingAuto;
      pendingAuto = null;
      setTimeout(() => send(auto.text, auto.m), 140);
    }
  }

  /* ── واجهة عامة (تستخدمها بنك الأخطاء وغيرها) ── */
  function askAboutMistake(id){
    pendingMistakeId = id;
    pendingAuto = { m: "error_bank_help", text: "اشرح لي هذا الخطأ من بنك أخطائي وساعدني أفهمه ولا تكتفِ بالإجابة — اشرح السبب." };
    App.Router.go("ai-assistant", { mistake: id });
  }

  window.addEventListener("online", applyShellState);
  window.addEventListener("offline", applyShellState);

  App.Views.register("ai-assistant", render, { rerender: false, title: "المساعد الذكي" });

  return {
    send, resetAll, askAboutMistake, buildAIContext,
    state: () => ({ msgs: msgs.slice(), mode }),
    clearPending: () => { pendingMistakeId = null; pendingAuto = null; }
  };
})();