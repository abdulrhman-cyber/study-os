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
  let msgs = [];            // [{ id, role: "user"|"ai", text, mode, error?, typing?, tag? }]
  let mode = "chat";        // الوضع النشط (يبقى لأحاديث المتابعة)
  let sending = false;
  let pendingMistakeId = null;  // خطأ منتقى من بنك الأخطاء
  let pendingAuto = null;       // إرسال تلقائي عند فتح الصفحة من رابط خارجي

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
  const SEND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

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
    if (status === 429 || status === 401 || status === 403 || status === 400) return false;
    if (status >= 500) return true;
    return code === "server" || code === "timeout";
  }

  function userError(status, code){
    if (code === "auth" || status === 401 || status === 403) return "سجل الدخول لاستخدام المساعد الذكي.";
    if (code === "rate-limit" || status === 429) return "وصل المساعد إلى حد الاستخدام المؤقت. حاول مرة أخرى بعد قليل.";
    if (code === "missing-key") return "المساعد غير مكوّن حاليًا — جرّب بعد قليل.";
    if (code === "timeout" || status === 504) return "استغرق المساعد وقتًا أطول من المتوقع — حاول مرة أخرى.";
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
    pushUser(msg, md);
    const pendingId = pushAI("", { typing: true });

    let s;
    try { s = await App.Sync.getSession(); } catch (_e){ s = { ok: false }; }
    if (!s || !s.ok || !s.session){
      patchAI(pendingId, "سجل الدخول لاستخدام المساعد الذكي.", { error: true });
      endSend();
      return;
    }

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
      patchAI(pendingId, out.msg || userError(out.status, out.code), { error: true, retry: !!(out.again) });
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
    const x = { id, role: "user", text, mode: md, tag: MODE_LABEL[md] || "" };
    msgs.push(x);
    paint();
    return id;
  }
  function pushAI(text, o){
    o = o || {};
    const id = "a" + (++seq);
    msgs.push({ id, role: "ai", text, typing: !!o.typing, error: !!o.error, retry: !!o.retry });
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

  function bubbleHTML(x){
    const role = x.role === "user" ? "user" : "ai";
    const cls = "ai-msg " + role + (x.error ? " err" : "") + (x.typing ? " thinking" : "");
    const av = role === "ai"
      ? '<span class="ai-av">' + I.get("robot", 17) + '</span>'
      : '<span class="ai-av">' + (S.getState().user.avatar || "🙂") + '</span>';
    const body = x.typing
      ? '<span class="t i1"></span><span class="t i2"></span><span class="t i3"></span>'
      : escText(x.text);
    const tag = x.tag && role === "user" ? '<div class="ai-tag">' + U.esc(x.tag) + '</div>' : "";
    const retry = x.error && x.retry ? '<button class="btn sm ghost ai-retry" data-ai="retry">' + I.get("refresh", 13) + 'إعادة المحاولة</button>' : "";
    return '<div class="' + cls + '" data-id="' + x.id + '">' + av + '<div class="ai-bubble">' + tag + body + retry + '</div></div>';
  }

  function welcome(){
    return '<div class="ai-welcome">' +
      '<div class="ai-logo">' + I.get("robot", 46) + '</div>' +
      '<h2 class="ai-w-title">مساعد Study OS</h2>' +
      '<p class="ai-w-name">مساعدك الذكي للمذاكرة</p>' +
      '<p class="ai-w-sub">اسألني عن دروسك، أخطائك، خطتك الدراسية أو تقدمك.</p>' +
      '<div class="ai-quick">' +
        '<button class="quick" data-ai="qa" data-mode="explain_question">📚 اشرح لي سؤالًا</button>' +
        '<button class="quick" data-ai="qa" data-mode="quiz">🧠 اختبرني</button>' +
        '<button class="quick" data-ai="qa" data-mode="progress_analysis">📊 حلل مستواي</button>' +
        '<button class="quick" data-ai="qa" data-mode="study_plan">📅 ساعدني في خطة مذاكرة</button>' +
      '</div>' +
    '</div>';
  }

  function paint(){
    const chat = $("ai-chat");
    if (!chat) return;
    const clr = document.querySelector("[data-ai='clear']");
    if (!msgs.length){
      chat.innerHTML = welcome();
      const qa = $("ai-modebar");
      if (qa) qa.hidden = true;
      if (clr) clr.style.display = "none";
      return;
    }
    chat.innerHTML = msgs.map(bubbleHTML).join("");
    chat.scrollTop = chat.scrollHeight;
    if (clr) clr.style.display = "";
    const modebar = $("ai-modebar");
    if (modebar){
      const chip = modebar.querySelector(".ai-mode-chip");
      if (chip) chip.textContent = "الوضع: " + (MODE_LABEL[mode] || mode);
      modebar.hidden = mode === "chat";
    }
  }

  function setSendingUI(on){
    const btn = $("ai-send");
    const bar = document.querySelector(".ai-inputbar");
    if (btn) btn.disabled = on;
    if (bar) bar.classList.toggle("busy", on);
  }

  function autosize(){
    const el = $("ai-input");
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }

  function resetAll(){
    msgs = [];
    mode = "chat";
    pendingMistakeId = null;
    pendingAuto = null;
    const input = $("ai-input");
    if (input) input.value = "";
    paint();
    if (input) input.focus();
  }

  /* ── الربط ── */
  function bind(root){
    const sendBtn = $("ai-send");
    const input = $("ai-input");
    if (sendBtn) sendBtn.addEventListener("click", () => { const v = input ? input.value : ""; input.value = ""; autosize(); send(v, mode); });
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
    /* تفويض: أزرار الترحيب السريعة وإعادة المحاولة تُعاد لصقها في كل paint،
       فندير نقراتها على مستوى حاوية المحادثة الثابتة بدل ربطها بأزرار مؤقتة. */
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
        }
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
      '<div class="page-head">' +
        '<div><div class="page-title">المساعد الذكي</div>' +
        '<div class="page-sub">Gemini عبر Study OS — اشرح، اختبر، حلّل، ونظّم خطتك.</div></div>' +
        '<div class="head-actions">' +
          '<button class="btn glass sm" data-ai="clear" style="' + (msgs.length ? "" : "display:none") + '">' + I.get("reset", 14) + 'محادثة جديدة</button>' +
        '</div>' +
      '</div>' +
      '<div class="ai-page">' +
        '<div class="ai-chat" id="ai-chat" role="log" aria-live="polite"></div>' +
        '<div class="ai-inputbar">' +
          '<div class="ai-modebar" id="ai-modebar" hidden>' +
            '<span class="ai-mode-chip">' + (MODE_LABEL[mode] || mode) + '</span>' +
            '<button class="ai-mode-clear" data-ai="modechat" title="العودة لمحادثة عادية">' + I.get("close", 12) + '</button>' +
          '</div>' +
          '<div class="ai-input">' +
            '<textarea id="ai-input" class="input ai-input-ta" rows="1" placeholder="اكتب سؤالك للمساعد..." enterkeyhint="send" autocomplete="off"></textarea>' +
            '<button class="btn primary ai-send" id="ai-send" aria-label="إرسال">' + SEND_ICON + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    paint();
    const clear = root.querySelector("[data-ai='clear']");
    if (clear) clear.style.display = msgs.length ? "" : "none";
    const input = $("ai-input");
    if (input) setTimeout(() => input.focus(), 120);

    root.querySelectorAll("[data-ai='modechat']").forEach(b => {
      b.addEventListener("click", () => { mode = "chat"; pendingMistakeId = null; });
    });
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

  App.Views.register("ai-assistant", render, { rerender: false, title: "المساعد الذكي" });

  return {
    send, resetAll, askAboutMistake, buildAIContext,
    state: () => ({ msgs: msgs.slice(), mode }),
    clearPending: () => { pendingMistakeId = null; pendingAuto = null; }
  };
})();