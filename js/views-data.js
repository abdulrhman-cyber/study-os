/* ═══════════════ STUDY OS — views-data.js (analytics, errors, sessions, homework, calendar, notes) ═══════════════ */
"use strict";
window.App = window.App || {};
(function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;
  const V = App.Views;

  /* ════════════════════ ANALYTICS ════════════════════ */
  let aFilter = { kind: "week", from: null, to: null };

  function rangeOf(kind){
    const today = new Date();
    const tf = U.todayKey();
    if (kind === "day") return { from: tf, to: tf };
    if (kind === "week") return { from: U.addDaysKey(tf, -6), to: tf };
    if (kind === "month") return { from: U.dateKey(U.startOfMonth(today)), to: tf };
    if (kind === "year") return { from: U.dateKey(U.startOfYear(today)), to: tf };
    return { from: aFilter.from || U.addDaysKey(tf, -13), to: aFilter.to || tf };
  }

  V.register("analytics", function (root){
    const st = S.getState();
    const r = rangeOf(aFilter.kind);
    root.innerHTML = renderAnalytics(st, r);
    bindAnalytics(root, st, r);
  }, { rerender: true, title: "التحليلات" });

  function renderAnalytics(st, r){
    const today = U.todayKey();
    const daysIn = U.daysBetween(r.from, r.to) + 1;
    const blocks = st.blocks.filter(b => b.date >= r.from && b.date <= r.to);
    const studyMin = blocks.reduce((a, b) => a + b.minutes, 0);
    const goalTotal = st.settings.dailyGoalMinutes * daysIn;
    const goalPct = Math.min(100, Math.round(studyMin / goalTotal * 100));
    const activeDays = new Set(blocks.map(b => b.date)).size;
    const rngKeys = U.rangeKeys(r.from, r.to);

    // per day
    const perDay = rngKeys.map(k => ({ k, min: (st.daily[k] || {}).studyMin || 0 }));
    // per subject
    const subjBars = D.subjects.filter(x => x.id !== "general").map(s => ({
      s, min: blocks.filter(b => b.subject === s.id).reduce((a, b) => a + b.minutes, 0)
    })).sort((a, b) => b.min - a.min);

    const tasksDoneRng = st.tasks.filter(t => t.completed && t.completedOn >= r.from && t.completedOn <= r.to).length;
    const tasksDueRng = st.tasks.filter(t => t.date >= r.from && t.date <= r.to).length;
    const hwDoneRng = st.homework.filter(h => h.completed && h.completedOn >= r.from && h.completedOn <= r.to).length;

    return '' +
      '<div class="page-head"><div><div class="page-title">تحليلات دراستك</div>' +
      '<div class="page-sub">أرقام تروي قصة تقدمك — من ' + U.fmtDate(r.from, { short: true }) + ' إلى ' + U.fmtDate(r.to, { short: true }) + ' (' + daysIn + ' يومًا).</div></div></div>' +

      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:18px">' +
        '<div class="filter-bar">' + ["day","week","month","year","custom"].map(k => {
          const names = { day: "اليوم", week: "الأسبوع", month: "الشهر", year: "السنة", custom: "مخصص" };
          return '<button class="filter-chip' + (aFilter.kind === k ? " active" : "") + '" data-fk="' + k + '">' + names[k] + '</button>';
        }).join("") + '</div>' +
        (aFilter.kind === "custom" ?
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<input type="date" class="input" id="an-from" value="' + (aFilter.from || U.addDaysKey(today, -13)) + '">' +
            '<span class="muted small">إلى</span>' +
            '<input type="date" class="input" id="an-to" value="' + (aFilter.to || today) + '">' +
            '<button class="btn primary sm" id="an-apply">تطبيق</button>' +
          '</div>' : '') +
      '</div>' +

      '<div class="grid cols-4" style="margin-bottom:16px">' +
        UI.statCard("clock", U.fmtDur(studyMin), "إجمالي الدراسة", "gold") +
        UI.statCard("sessions", blocks.length, "عدد الجلسات") +
        UI.statCard("tasks", tasksDoneRng, "مهام مكتملة") +
        UI.statCard("homework", hwDoneRng, "واجبات منجزة") +
      '</div>' +

      '<div class="grid cols-2 an-split">' +
        '<div class="card glass-1 chart-card">' +
          '<div class="chart-head"><h3>إكمال هدف الدراسة</h3><span class="ch-note">Goal Completion</span></div>' +
          '<div class="chart-wrap"><div style="width:180px;height:180px;position:relative">' +
            donut(goalPct, studyMin, goalTotal) +
            '<div class="donut-center"><b class="num">' + goalPct + '%</b><span>' + U.fmtDur(studyMin) + ' / ' + U.fmtDur(goalTotal) + '</span></div>' +
          '</div></div>' +
          '<div class="donut-legend" style="margin-top:14px">' +
            '<div class="dl-row"><span class="dl-dot" style="background:var(--em-grad)"></span>نشط ' + activeDays + ' يومًا من ' + daysIn + '</div>' +
            '<div class="dl-row"><span class="dl-dot" style="background:var(--gold-grad)"></span>نسبة الالتزام ' + Math.round(activeDays / daysIn * 100) + '%</div>' +
          '</div>' +
        '</div>' +

        '<div class="card glass-1 chart-card">' +
          '<div class="chart-head"><h3>وقت الدراسة عبر الوقت</h3><span class="ch-note">Study Time Over Time</span></div>' +
          '<div class="chart-wrap">' + lineChart(perDay) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid cols-2 an-split an-split-b">' +
        '<div class="card glass-1 chart-card">' +
          '<div class="chart-head"><h3>وقت الدراسة حسب المادة</h3><span class="ch-note">By Subject</span></div>' +
          '<div class="bars">' + (subjBars.some(x => x.min) ?
            subjBars.map(x => {
              const h = Math.max(4, Math.round(x.min / Math.max(1, subjBars[0].min) * 100));
              return '<div class="bar-col" title="' + x.s.name + '">' +
                '<div class="bar-holder"><div class="bar-fill' + (x === subjBars[0] ? " highlight" : "") + '" style="height:' + h + '%"></div></div>' +
                '<div class="bar-label">' + x.s.name + '</div><div class="bar-val">' + U.fmtDur(x.min) + '</div></div>';
            }).join("")
            : '<div class="muted small" style="align-self:center">لا وقت مسجل في هذه الفترة.</div>') + '</div>' +
        '</div>' +
        '<div class="card glass-1 chart-card">' +
          '<div class="chart-head"><h3>خريطة النشاط</h3><span class="ch-note">Heatmap</span></div>' +
          heatmap(st) +
        '</div>' +
      '</div>' +

      '<div class="card glass-1" style="margin-top:16px">' +
        '<div class="card-title">' + I.get("analytics", 17) + 'إحصائيات شاملة <span class="ct-sub">Statistics</span></div>' +
        '<div class="stat-grid">' +
          pstat("total", "إجمالي ساعات الدراسة", U.fmtDur(studyMin)) +
          pstat("avg", "متوسط الجلسة", avgText(blocks)) +
          pstat("count", "عدد الجلسات", blocks.length + "") +
          pstat("tasks", "مهام مكتملة", tasksDoneRng + "") +
          pstat("commit", "نسبة الالتزام", Math.round(activeDays / daysIn * 100) + "%") +
          pstat("best", "أفضل مادة", bestSubj(st, r, subjBars)) +
          pstat("day", "أكثر يوم إنتاجية", bestWeekday(st, r)) +
          pstat("streak", "السلسلة الحالية", D.streakOf(st) + " يوم") +
          pstat("long", "أطول سلسلة", D.longestStreakOf(st) + " يوم") +
          pstat("target", "أفضل درجة امتحان", bestExam(st)) +
        '</div>' +
      '</div>' +

      '<div class="card glass-1" style="margin-top:16px">' +
        '<div class="card-title">' + I.get("achievements", 17) + 'الامتحانات الأخيرة <span class="ct-sub">Exams</span></div>' +
        (st.exams && st.exams.length ?
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">' +
            st.exams.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8).map(x =>
              '<div class="calitem-row">' + I.get("timer", 13) +
              '<span style="flex:1">' + U.esc(x.title || "") + ' · ' + U.fmtDate(x.ts.slice(0, 10), { short: true }) + '</span>' +
              '<span class="muted small">' + U.fmtClockFullWords(x.durationSec || 0) + '</span>' +
              '<span class="badge ' + (x.score >= 0.7 ? "emerald" : x.score >= 0.4 ? "amber" : "red") + '">' + x.correct + '/' + x.count + ' (' + Math.round(x.score * 100) + '%)</span>' +
              '</div>').join("") +
          '</div>'
          : '<p class="muted small" style="margin-top:10px">لا امتحانات بعد — جرّب «وضع الامتحان» من بنك الأخطاء.</p>') +
      '</div>' +

      '<div class="card glass-1" style="margin-top:16px">' +
        '<div class="card-title">' + I.get("zap", 17) + 'رؤى ذكية <span class="ct-sub">Insights</span></div>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' + insights(st, r).map(inp =>
          '<div class="insight"><span class="in-ic">' + I.get(inp.icon || "zap", 16) + '</span><span>' + inp.txt + '</span></div>'
        ).join("") + '</div>' +
      '</div>';
  }

  function pstat(prefix, label, val){
    return '<div class="pstat"><b data-prefix="' + label + '">' + val + '</b></div>';
  }
  function avgText(blocks){
    if (!blocks.length) return "0د";
    return U.fmtDur(Math.round(blocks.reduce((a, b) => a + b.minutes, 0) / blocks.length));
  }
  function bestSubj(st, r, bars){
    const b = bars.find(x => x.min > 0);
    return b ? b.s.name : "—";
  }
  function bestWeekday(st, r){
    const by = {};
    const rng = U.rangeKeys(r.from, r.to);
    rng.forEach(k => {
      const min = (st.daily[k] || {}).studyMin || 0;
      if (!min) return;
      const wd = (U.fromKey(k).getDay() + 6) % 7;
      by[wd] = (by[wd] || 0) + min;
    });
    let best = -1, bv = 0;
    for (const k in by){ if (by[k] > bv){ bv = by[k]; best = +k; } }
    if (best < 0) return "—";
    return U.DAYS_AR[(best + 6 + 1) % 7];
  }
  function bestExam(st){
    const ex = (st.exams || []).filter(x => x.count);
    if (!ex.length) return "—";
    const top = ex.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    return top.correct + "/" + top.count + " (" + Math.round(top.score * 100) + "%)";
  }

  function donut(pct, min, total){
    const r = 78, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, pct) / 100);
    return '<svg width="180" height="180" viewBox="0 0 180 180">' +
      '<defs><linearGradient id="dn-g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#BFA06A"/><stop offset=".55" stop-color="#2F7568"/><stop offset="1" stop-color="#6FA99B"/></linearGradient></defs>' +
      '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="16"/>' +
      '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="url(#dn-g)" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 90 90)" style="transition:stroke-dashoffset 1s var(--ease)"/>' +
    '</svg>';
  }

  function lineChart(perDay){
    if (!perDay.length) return '<p class="muted small">لا بيانات.</p>';
    const W = 600, H = 150, pad = 26;
    const max = Math.max(1, ...perDay.map(p => p.min));
    const n = perDay.length;
    const step = Math.max(1, Math.round(n / 40));
    const pts = perDay.filter((_, i) => i % step === 0 || i === n - 1);
    const px = i => pad + i * ((W - pad * 2) / (pts.length - 1 || 1));
    const py = m => H - pad - (m / max) * (H - pad * 2 - 14);
    const path = pts.map((p, i) => (i ? "L" : "M") + px(i).toFixed(1) + " " + py(p.min).toFixed(1)).join(" ");
    const area = path + " L" + px(pts.length - 1).toFixed(1) + " " + (H - pad + 6) + " L" + pad + " " + (H - pad + 6) + " Z";
    const labels = pts.map((p, i) => '<text class="axis-label" x="' + px(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + (pts.length > 18 ? "" : p.k.slice(8)) + '</text>').join("");
    return '<svg class="line-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs>' +
        '<linearGradient id="lc-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#BFA06A"/><stop offset="1" stop-color="#6FA99B"/></linearGradient>' +
        '<linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F7568" stop-opacity=".5"/><stop offset="1" stop-color="#2F7568" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<line class="grid-line" x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '"/>' +
      '<line class="grid-line" x1="' + pad + '" y1="' + py(max) + '" x2="' + (W - pad) + '" y2="' + py(max) + '"/>' +
      '<path class="line-area" d="' + area + '"/>' +
      '<path class="line-path" d="' + path + '"/>' +
      labels +
    '</svg>';
  }

  function heatmap(st){
    const today = new Date();
    const monday = U.startOfWeek(today);
    const grid = [];
    const end = new Date(monday); end.setDate(monday.getDate() + 6);
    const startD = new Date(monday); startD.setDate(monday.getDate() - 17 * 7);
    let d = new Date(startD);
    while (d <= end){
      const k = U.dateKey(d);
      const min = (st.daily[k] || {}).studyMin || 0;
      let lvl = 0;
      if (min > 0 && min < 30) lvl = 1;
      else if (min >= 30 && min < 90) lvl = 2;
      else if (min >= 90 && min < 180) lvl = 3;
      else if (min >= 180) lvl = 4;
      grid.push({ k, lvl, min });
      d = U.addDays(d, 1);
    }
    return '<div style="position:relative">' +
      '<div style="display:flex;gap:3px">' +
        '<div style="display:flex;flex-direction:column;gap:7px;font-size:8.5px;color:var(--text-4);font-weight:700;padding-top:2px">' +
          ["أحد","أربع","سبت"].join('<i></i>').split('<i></i>').map(x => '<span>' + x + '</span>').join("") +
        '</div>' +
        '<div class="heatmap">' + grid.map(g =>
          '<div class="hm-cell" data-l="' + g.lvl + '" data-tooltip="' + U.fmtDate(g.k, { short: true }) + ' — ' + U.fmtDur(g.min) + '"></div>'
        ).join("") + '</div>' +
      '</div>' +
      '<div class="hm-legend"><span>أقل</span><div class="hm-cell" data-l="0"></div><div class="hm-cell" data-l="1"></div><div class="hm-cell" data-l="2"></div><div class="hm-cell" data-l="3"></div><div class="hm-cell" data-l="4"></div><span>أكثر</span></div>' +
    '</div>';
  }

  function insights(st, r){
    const out = [];
    const weekNow = blocksInRange(st, U.addDaysKey(U.todayKey(), -6), U.todayKey());
    const weekPrev = blocksInRange(st, U.addDaysKey(U.todayKey(), -13), U.addDaysKey(U.todayKey(), -7));
    const all = D.subjects.filter(x => x.id !== "general").map(s => ({
      s, now: weekNow.filter(b => b.subject === s.id).reduce((a, b) => a + b.minutes, 0),
      prev: weekPrev.filter(b => b.subject === s.id).reduce((a, b) => a + b.minutes, 0)
    }));
    const growing = all.find(x => x.now > x.prev && x.prev === 0 && x.now >= 30) || all.find(x => x.now > x.prev && x.prev > 0 && (x.now - x.prev) / x.prev >= 0.3);
    if (growing && growing.now >= 30)
      out.push({ icon: "analytics", txt: 'أداؤك في ' + growing.s.name + ' ارتفع هذا الأسبوع مقارنة بالأسبوع السابق (' + U.fmtDur(growing.prev) + ' ← ' + U.fmtDur(growing.now) + '). استمر!' });
    else if (growing)
      out.push({ icon: "info", txt: 'تحرز تقدمًا في ' + growing.s.name + ' — ثبّت هذه الوتيرة في أسبوعك الحالي.' });
    const dropping = all.find(x => x.prev > x.now && x.prev > 0 && (x.prev - x.now) / x.prev >= 0.35);
    if (dropping)
      out.push({ icon: "target", txt: 'تراجع نسبي في ' + dropping.s.name + ' هذا الأسبوع (' + U.fmtDur(dropping.prev) + ' ← ' + U.fmtDur(dropping.now) + '). راجع خطتك هناك.' });

    const byHour = {};
    st.blocks.forEach(b => { const h = new Date(b.ts).getHours(); byHour[h] = (byHour[h] || 0) + b.minutes; });
    let bh = -1, bv = 0;
    for (const k in byHour){ if (byHour[k] > bv){ bv = byHour[k]; bh = +k; } }
    if (bh >= 0){
      const ap = bh >= 12 ? "مساءً" : "صباحًا";
      const hh = (bh % 12 || 12);
      out.push({ icon: "clock", txt: 'أنت أكثر إنتاجية بين الساعة ' + hh + ' و' + (hh + 1) + ' ' + ap + ' — خصّص أصعب المهام لهذه الفترة.' });
    }
    const repErr = D.subjects.filter(x => x.id !== "general").map(s => ({
      s, n: st.mistakes.filter(m => m.subject === s.id && m.status !== "mastered").length
    })).sort((a, b) => b.n - a.n)[0];
    if (repErr && repErr.n >= 3)
      out.push({ icon: "errors", txt: 'لديك ' + repErr.n + ' أخطاء غير متقنة في ' + repErr.s.name + ' — ابدأ مراجعة بنك أخطائك منها.' });

    const avgNow = weekNow.length ? weekNow.reduce((a, b) => a + b.minutes, 0) / weekNow.length : 0;
    const avgPrev = weekPrev.length ? weekPrev.reduce((a, b) => a + b.minutes, 0) / weekPrev.length : 0;
    if (avgNow && avgPrev)
      out.push({ icon: "sessions", txt: 'متوسط جلساتك ' + (avgNow >= avgPrev ? 'تحسّن' : 'انخفض') + ' من ' + U.fmtDur(avgPrev) + ' إلى ' + U.fmtDur(avgNow) + ' لكل جلسة.' });
    const streak = D.streakOf(st);
    if (streak >= 3)
      out.push({ icon: "flame", txt: 'سلسلتك الحالية ' + streak + ' يوم — حافظ عليها اليوم لتصل إلى ' + (streak + 1) + '!' });
    const totalM = st.blocks.reduce((a, b) => a + b.minutes, 0);
    if (totalM)
      out.push({ icon: "shield", txt: 'إجمالي دراستك الكلي: ' + U.fmtDur(totalM) + '. كل ساعة تبني عادةً أقوى.' });
    if (!out.length) out.push({ icon: "zap", txt: "ابدأ الدراسة لتولّد رؤى ذكية حول نمطك." });
    return out;
  }
  function blocksInRange(st, from, to){
    return st.blocks.filter(b => b.date >= from && b.date <= to);
  }

  function bindAnalytics(root, st, r){
    root.querySelectorAll("[data-fk]").forEach(b => b.addEventListener("click", () => {
      aFilter.kind = b.dataset.fk;
      if (b.dataset.fk === "custom" && !aFilter.from){ aFilter.from = U.addDaysKey(U.todayKey(), -13); aFilter.to = U.todayKey(); }
      App.Router.rerender();
    }));
    const apply = root.querySelector("#an-apply");
    if (apply) apply.addEventListener("click", () => {
      const f = root.querySelector("#an-from").value, t = root.querySelector("#an-to").value;
      if (f && t && f <= t){ aFilter.from = f; aFilter.to = t; App.Router.rerender(); }
      else UI.toast("حدد نطاقًا صحيحًا (من ≤ إلى).", "error", "info");
    });
  }

  /* ════════════════════ ERROR BANK ════════════════════ */
  let errF = { subject: "all", status: "all" };
  V.register("errors", function (root){
    const st = S.getState();
    root.innerHTML = renderErrors(st);
    bindErrors(root, st);
  }, { rerender: true, title: "بنك الأخطاء" });

  function renderErrors(st){
    let list = st.mistakes.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (errF.subject !== "all") list = list.filter(m => m.subject === errF.subject);
    if (errF.status !== "all") list = list.filter(m => m.status === errF.status);
    const due = S.reviewQueue().length;
    const mastered = st.mistakes.filter(m => m.status === "mastered").length;

    return '' +
      '<div class="page-head"><div><div class="page-title">بنك الأخطاء</div>' +
      '<div class="page-sub">حوّل أخطاءك إلى نقاط قوة — سجّل، راجع، وأتقن.</div></div>' +
      '<div class="head-actions">' +
        '<button class="btn glass" data-err="daily">' + I.get("sun", 15) + 'جرعة اليوم</button>' +
        '<button class="btn emerald" data-err="quiz">' + I.get("target", 16) + 'اختبرني من أخطائي</button>' +
        '<button class="btn glass" data-err="exam">' + I.get("timer", 16) + 'وضع الامتحان</button>' +
        '<button class="btn primary" data-err="add">' + I.get("plus", 15) + 'إضافة خطأ</button>' +
      '</div></div>' +

      weaknessDash(list) +

      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">' +
        '<div class="filter-bar" style="padding:4px">' +
          ["all", ...D.subjects.map(s => s.id)].map(sub => {
            const name = sub === "all" ? "كل المواد" : D.subjectById(sub).name;
            return '<button class="filter-chip' + (errF.subject === sub ? " active" : "") + '" data-ef="' + sub + '">' + name + '</button>';
          }).join("") +
        '</div>' +
        '<span class="badge neutral">' + due + ' تحتاج مراجعة</span>' +
        '<span class="badge emerald">' + mastered + ' مُتقن</span>' +
      '</div>' +

      (list.length ? '<div class="grid cols-2 err-grid">' + list.slice(0, 40).map(m => mistakeCard(m)).join("") + '</div>'
        : '<div class="card glass-1">' + UI.empty("errors", "رائع! لم تسجّل أخطاء بعد",
            'عندما تخطئ في سؤال أو تمرين، سجّله هنا ليتحول إلى فرصة مراجعة ذكية.',
            '<button class="btn primary" data-err="add">' + I.get("plus", 15) + 'سجّل أول خطأ</button>') + '</div>');
  }

  function weaknessDash(list){
    if (!list.length) return "";
    const wCount = m => (m.reviewLog || []).filter(r => r.correct === false).length;
    const rec = list.filter(m => wCount(m) >= 2).sort((a, b) => wCount(b) - wCount(a)).slice(0, 4);
    const nonMastered = list.filter(m => m.status !== "mastered").length;
    const from = U.addDaysKey(U.todayKey(), -6);
    let rev = 0, wrong = 0;
    list.forEach(m => (m.reviewLog || []).forEach(r => { if (r.date >= from){ rev++; if (!r.correct) wrong++; } }));
    const acc = rev ? Math.round(((rev - wrong) / rev) * 100) : -1;
    const subjects = D.subjects.filter(s => s.id !== "general" && list.some(m => m.subject === s.id))
      .map(s => ({ s, n: list.filter(m => m.subject === s.id && m.status !== "mastered").length }))
      .sort((a, b) => b.n - a.n);
    const maxN = Math.max(1, ...subjects.map(x => x.n));
    const stat = (v, l, c) => '<div class="wd-mini"><b style="color:' + c + '">' + v + '</b><span>' + l + '</span></div>';
    return '<div class="card glass-1 weak-dash">' +
      '<div class="wd-head">' + I.get("target", 15) + ' نقاط ضعفك <span class="wd-period">آخر 7 أيام</span></div>' +
      '<div class="wd-grid">' +
        stat(rec.length, "أخطاء تكررت (غلطت فيها مرتين+)", "var(--danger-text)") +
        stat(nonMastered, "أخطاء غير متقنة", "var(--gold-2)") +
        stat(acc < 0 ? "—" : acc + "%", "دقة مراجعاتك", "var(--em-3)") +
      '</div>' +
      (subjects.length ? '<div class="wd-dist">' + subjects.map(x =>
        '<div class="wd-row"><span class="wd-name">' + I.subj(x.s, 13) + ' ' + x.s.name + '</span>' +
        '<div class="wd-bar"><i style="width:' + Math.round(x.n / maxN * 100) + '%"></i></div>' +
        '<b class="wd-num">' + x.n + '</b></div>').join("") + '</div>' : '') +
      (rec.length ? '<div class="wd-rec">' + rec.map(m =>
        '<button class="wd-rec-row" data-err="qone" data-id="' + m.id + '" title="مراجعة هذا السؤال">' +
          '<span class="chip" style="color:' + D.subjectById(m.subject).accent + ';border-color:color-mix(in srgb,' + D.subjectById(m.subject).accent + ' 35%, transparent)">' + D.subjectById(m.subject).name + '</span>' +
          '<span class="wd-q">' + U.esc(m.question).slice(0, 60) + '</span>' +
          '<span class="badge red">غلطت ' + wCount(m) + ' مرات</span>' +
        '</button>').join("") + '</div>' : '') +
    '</div>';
  }

  function dailyDeckPool(){
    const st = S.getState(); const today = U.todayKey();
    const doneToday = m => (m.reviewLog || []).some(r => r.date === today);
    const pool = st.mistakes.filter(m => !doneToday(m));
    const priority = [];
    const add = m => { if (priority.length < 8 && !priority.some(x => x.id === m.id)) priority.push(m); };
    pool.filter(m => m.nextReview && m.nextReview <= today).forEach(add);
    pool.filter(m => m.status === "new" || m.status === "review").forEach(add);
    pool.filter(m => (m.reviewLog || []).filter(r => r.correct === false).length >= 2).forEach(add);
    pool.forEach(add);
    const out = priority.slice(0, 8);
    for (let i = out.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }

  function mistakeCard(m){
    const subj = D.subjectById(m.subject);
    const isMcq = m.type === "mcq";
    return '<div class="card glass-1 mistake-item" data-mistake="' + m.id + '">' +
      '<div class="mistake-meta">' +
        '<span class="chip" style="color:' + subj.accent + '">' + I.subj(subj, 13) + ' ' + subj.name + '</span>' +
        '<span class="badge neutral">' + (isMcq ? "اختياري" : "مقالي") + '</span>' +
        V.errStatusChip(m.status) +
        '<span class="muted small">' + (m.reviews || 0) + ' مراجعات</span>' +
      '</div>' +
      '<div class="mistake-q">' + U.esc(m.question) + '</div>' +
      UI.qImg(m.imageUrl) +
      (isMcq ?
        '<div style="display:flex;flex-direction:column;gap:5px;margin:6px 0">' +
          (m.options || []).map((o, i) => {
            const isC = U.isAnswerCorrect(U.optLetter(i), m.correctAnswerId || m.correctAnswer, m.options);
            const isS = U.isAnswerCorrect(U.optLetter(i), m.studentAnswerId || m.studentAnswer, m.options);
            const cls = "opt-row" + (isS ? " sel" : "") + (isC ? " correct" : isS ? " wrong" : "");
            return '<div class="' + cls + '"><span class="or-let">' + String.fromCharCode(65 + i) + '</span><span style="flex:1">' + U.esc(o) + '</span>' +
              (isC ? '<span class="badge emerald">الصحيحة</span>' : (isS ? '<span class="badge red">اختيارك</span>' : '')) + '</div>';
          }).join("") +
        '</div>'
      :
        '<div class="grid cols-2" style="gap:8px;margin:8px 0">' +
          '<div class="mini-row">' + I.get("user", 13) + '<b style="flex:1">إجابتك</b></div>' +
          '<div class="mini-row" style="grid-column:1/-1;display:block;font-size:12px;color:var(--text-2)">' + U.esc(m.studentAnswer || "").slice(0, 120) + '…</div>' +
          (m.modelAnswer ? '<div class="mini-row" style="grid-column:1/-1">' + I.get("check", 13) + '<b style="flex:1">النموذجية</b><span class="muted small">' + U.esc(m.modelAnswer).slice(0, 90) + '…</span></div>' : '') +
        '</div>') +
      (m.explanation ? '<div class="review-feedback good" style="margin:0"><b>لماذا؟</b> ' + U.esc(m.explanation) + '</div>' : '') +
      (m.reason ? '<div class="muted small" style="margin-top:6px">سبب الخطأ: ' + U.esc(m.reason) + '</div>' : '') +
      '<div class="mistake-actions">' +
        '<button class="btn sm ghost" data-err="edit" data-id="' + m.id + '">' + I.get("edit", 13) + 'تعديل</button>' +
        '<button class="btn sm danger" data-err="del" data-id="' + m.id + '">' + I.get("trash", 13) + '</button>' +
      '</div>' +
    '</div>';
  }

  function bindErrors(root, st){
    root.querySelectorAll("[data-ef]").forEach(b => b.addEventListener("click", () => {
      errF.subject = b.dataset.ef;
      App.Router.rerender();
    }));
    root.querySelectorAll("[data-err='add']").forEach(b => b.addEventListener("click", () => App.Modals.openMistakeModal()));
    root.querySelectorAll("[data-err='edit']").forEach(b => b.addEventListener("click", () => App.Modals.openMistakeModal(b.dataset.id)));
    root.querySelectorAll("[data-err='del']").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id;
      UI.dangerConfirm("حذف الخطأ", "سيُحذف هذا الخطأ من بنكك نهائيًا ويؤثر على إحصائيات المادة.", "حذف", () => { S.deleteMistake(id); UI.toast("حُذف الخطأ.", "gold", "trash"); });
    }));
    root.querySelectorAll("[data-err='quiz']").forEach(b => b.addEventListener("click", () => startQuiz()));
    root.querySelectorAll("[data-err='exam']").forEach(b => b.addEventListener("click", () => buildExamSetup()));
  }

  /* ── Intelligent review quiz ── */
  function startQuiz(){
    const st = S.getState();
    if (!st.mistakes || !st.mistakes.length){ UI.toast("لا أخطاء في بنكك لتبدأ المراجعة.", "gold", "errors"); return; }
    buildQuizSetup();
  }

  const QZ_REVIEW = [
    { id: "all",   t: "جميع الأسئلة" },
    { id: "weak",  t: "الأسئلة غير المتقنة" },
    { id: "due",   t: "الأسئلة التي تحتاج مراجعة" },
    { id: "erred", t: "الأسئلة التي أخطأت فيها" },
    { id: "done",  t: "الأسئلة المتقنة" }
  ];
  const QZ_REVIEW_TEST = {
    all:   m => true,
    weak:  m => m.status !== "mastered",
    due:   m => m.status === "new" || m.status === "review",
    erred: m => (m.lastWrong > 0) || (m.reviewLog || []).some(r => r.correct === false),
    done:  m => m.status === "mastered"
  };
  function quizPool(cfg){
    return S.getState().mistakes.filter(m =>
      (!cfg.subject || m.subject === cfg.subject) &&
      (cfg.qtype === "all" || m.type === cfg.qtype) &&
      QZ_REVIEW_TEST[cfg.review](m));
  }

  function buildQuizSetup(){
    const st = S.getState();
    const cfg = { subject: "", review: "all", qtype: "all", count: "10" };
    const withMist = D.subjects.filter(s => st.mistakes.some(m => m.subject === s.id));
    cfg.subject = (withMist[0] || D.subjects[0]).id;

    const m = UI.openModal(UI.modalShell(
      I.get("target", 18) + ' اختبار الأخطاء',
      '<div id="qz-setup"></div>',
      '<button class="btn ghost" data-close>إلغاء</button>' +
      '<button class="btn primary" id="qz-start">' + I.get("play", 15) + 'بدء الاختبار</button>'
    ), {});

    const root = m.querySelector("#qz-setup");
    function render(){
      const avail = quizPool(cfg).length;
      const asked = cfg.count === "all" ? avail : Math.min(+cfg.count, avail);
      root.innerHTML =
        '<div class="qz-intro">' + I.get("target", 15) + 'ماذا تريد أن تراجع؟</div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("book", 14) + 'اختر المادة</div>' +
          '<div class="seg qz-subj">' + D.subjects.map(s => {
            const n = st.mistakes.filter(x => x.subject === s.id).length;
            return '<button class="' + (cfg.subject === s.id ? "active" : "") + '" data-subj="' + s.id + '">' + I.subj(s, 13) + ' ' + s.name +
              (n ? '<span class="chip qz-chip">' + n + '</span>' : '') + '</button>';
          }).join("") + '</div></div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("errors", 14) + 'ما نوع الأسئلة التي تريد مراجعتها؟</div>' +
          '<div class="qz-reviews">' + QZ_REVIEW.map(r => {
            const n = quizPool({ subject: cfg.subject, qtype: cfg.qtype, review: r.id }).length;
            return '<button class="qz-opt' + (cfg.review === r.id ? " sel" : "") + '" data-review="' + r.id + '">' +
              '<span class="qz-radio" aria-hidden="true"></span><span style="flex:1">' + r.t + '</span>' +
              '<span class="badge">' + n + '</span></button>';
          }).join("") + '</div></div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("edit", 14) + 'نوع السؤال</div>' +
          '<div class="seg qz-type">' +
            '<button class="' + (cfg.qtype === "all" ? "active" : "") + '" data-qtype="all">جميع الأنواع</button>' +
            '<button class="' + (cfg.qtype === "mcq" ? "active" : "") + '" data-qtype="mcq">اختيار من متعدد</button>' +
            '<button class="' + (cfg.qtype === "essay" ? "active" : "") + '" data-qtype="essay">مقالي</button>' +
          '</div></div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("target", 14) + 'كم سؤالًا تريد؟</div>' +
          '<div class="seg qz-count">' +
            ["5","10","15","20"].map(n => '<button class="' + (cfg.count === n ? "active" : "") + '" data-count="' + n + '">' + n + '</button>').join("") +
            '<button class="' + (cfg.count === "all" ? "active" : "") + '" data-count="all">كل الأسئلة المتاحة' + (avail ? ' (' + avail + ')' : '') + '</button>' +
          '</div></div>' +

        '<div class="qz-summary">' + (avail ? 'ستُراجع <b>' + asked + '</b> سؤالًا' +
          (asked < avail ? ' من أصل <b>' + avail + '</b>' : ' من مادة ' + D.subjectById(cfg.subject).name) +
          (cfg.qtype === "mcq" ? ' — اختيار من متعدد' : cfg.qtype === "essay" ? ' — مقالي' : '') +
          '<span class="muted small"> · ' + U.esc(QZ_REVIEW.find(r => r.id === cfg.review).t) + '</span>'
          : 'لا توجد أسئلة مطابقة لهذه الاختيارات.') + '</div>';

      document.getElementById("qz-start").disabled = !avail;
      root.querySelectorAll("[data-subj]").forEach(b => b.addEventListener("click", () => { cfg.subject = b.dataset.subj; render(); }));
      root.querySelectorAll("[data-review]").forEach(b => b.addEventListener("click", () => { cfg.review = b.dataset.review; render(); }));
      root.querySelectorAll("[data-qtype]").forEach(b => b.addEventListener("click", () => { cfg.qtype = b.dataset.qtype; render(); }));
      root.querySelectorAll("[data-count]").forEach(b => b.addEventListener("click", () => { cfg.count = b.dataset.count; render(); }));
    }
    render();

    document.getElementById("qz-start").addEventListener("click", () => {
      const pool = quizPool(cfg);
      if (!pool.length){ UI.toast("لا توجد أسئلة مطابقة لهذه الاختيارات.", "error", "errors"); return; }
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      const n = cfg.count === "all" ? shuffled.length : Math.min(+cfg.count, shuffled.length);
      UI.closeModal();
      runQuiz(shuffled.slice(0, n));
    });
  }

  function runQuiz(pool){
    const results = [];
    let idx = 0;

    const m = document.getElementById("modal-root");
    let view = "intro";
    function show(){
      if (idx >= pool.length){
        const correct = results.filter(r => r.correct).length;
        UI.openModal(UI.modalShell(I.get("achievements", 18) + ' نتيجة المراجعة', '' +
          '<div style="text-align:center;padding:10px 0">' +
          '<div style="font-size:42px;font-weight:900;color:var(--gold-2)" class="num">' + correct + '/' + results.length + '</div>' +
          '<div class="muted" style="margin-bottom:14px">' + (correct / results.length >= 0.7 ? "أداء رائع — تواصل المراجعة الدورية." : correct / results.length >= 0.4 ? "لست بعيدًا — راجع الأخطاء التي فاتتك." : "ابدأ بإعادة قراءة الشروحات ثم أعد المحاولة.") + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;text-align:right;margin-bottom:14px">' +
            results.map((r, i) => '<div class="calitem-row">' + I.get(r.correct ? "check" : "close", 13) +
              '<span style="color:' + (r.correct ? "var(--em-3)" : "var(--danger-text)") + '">' + (r.correct ? "أجبت صحيحًا" : "خاطئ") + '</span>' +
              '<span class="muted small" style="flex:1">' + U.esc(r.question).slice(0, 50) + '…</span></div>').join("") +
          '</div>' +
          '<button class="btn primary block" data-close>إغلاق</button>' +
          '</div>'));
        return;
      }
      const it = pool[idx];
      if (it.type === "mcq") showMcq(it);
      else showEssay(it);
    }

    function showMcq(it){
      const opts = (it.options || []).slice();
      const corId = U.optId(it.correctAnswerId || it.correctAnswer, opts);
      UI.openModal(UI.modalShell(
        I.get("target", 18) + ' اختبار الأخطاء — ' + D.subjectById(it.subject).name + ' <span class="badge gold">' + (idx + 1) + '/' + pool.length + '</span>',
        '<div class="mistake-q" style="font-size:15px">' + U.esc(it.question) + '</div>' +
        UI.qImg(it.imageUrl) +
        '<div style="margin-top:14px">' +
          opts.map((o, i) =>
            '<div class="opt-row" data-oi="' + i + '"><span class="or-let">' + U.optLetter(i) + '</span>' +
            '<span style="flex:1">' + U.esc(o) + '</span></div>').join("") +
        '</div>' +
        '<div id="quiz-feedback"></div>',
        '<button class="btn primary" id="qf-next" disabled>التالي</button>'
      ), {});
      m.querySelectorAll("[data-oi]").forEach(row => row.addEventListener("click", () => {
        const oi = +row.dataset.oi;
        const selId = U.optLetter(oi);
        const correct = U.isAnswerCorrect(selId, corId, opts);
        m.querySelectorAll("[data-oi]").forEach(x => x.classList.remove("sel"));
        row.classList.add("sel");
        S.recordReview(it.id, { correct, score: correct ? 1 : 0, answerId: selId });
        results.push({ correct, question: it.question, answerId: selId, correctId: corId });
        m.querySelectorAll("[data-oi]").forEach(x => {
          if (U.isAnswerCorrect(U.optLetter(+x.dataset.oi), corId, opts)){
            x.classList.add("correct");
            x.insertAdjacentHTML("beforeend", '<span class="badge emerald">الصحيحة</span>');
          } else if (x === row){
            x.classList.add("wrong");
          }
          x.style.pointerEvents = "none";
        });
        if (!correct) UI.toast("أخطأت في هذا السؤال — راجع الشرح.", "error", "errors");
        const fb = m.querySelector("#quiz-feedback");
        fb.innerHTML = (correct
          ? '<div class="review-feedback good"><b>إجابة صحيحة</b> — رائع!</div>' +
            '<div class="muted small" style="margin-top:6px">الإجابة الصحيحة: <b>' + U.esc(U.ansLabel(opts, corId)) + '</b></div>'
          : '<div class="review-feedback wrong"><b>إجابة خاطئة</b></div>' +
            '<div class="muted small" style="margin-top:8px">إجابتك: <b>' + U.esc(U.ansLabel(opts, selId)) + '</b></div>' +
            '<div class="muted small" style="margin-top:2px">الإجابة الصحيحة: <b>' + U.esc(U.ansLabel(opts, corId)) + '</b></div>') +
          (it.explanation ? '<div class="review-feedback bad" style="margin-top:8px"><b>لماذا؟</b> ' + U.esc(it.explanation) + '</div>' : '');
        m.querySelector("#qf-next").disabled = false;
      }));
      m.querySelector("#qf-next").addEventListener("click", () => { idx++; show(); });
    }

    function showEssay(it){
      UI.openModal(UI.modalShell(
        I.get("edit", 18) + ' إجابة مقالية — ' + D.subjectById(it.subject).name + ' <span class="badge gold">' + (idx + 1) + '/' + pool.length + '</span>',
        '<div class="mistake-q" style="font-size:15px">' + U.esc(it.question) + '</div>' +
        UI.qImg(it.imageUrl) +
        '<div class="field" style="margin-top:14px"><label>إجابتك</label><textarea class="input" id="qe-answer" style="min-height:120px" placeholder="اكتب إجابتك كاملة بمعنى ودقيق كما ستفعل في الامتحان"></textarea></div>' +
        '<div id="qe-feedback"></div>',
        '<button class="btn primary" id="qe-submit">تصحيح إجابتي</button>'
      ), { autoFocus: "#qe-answer" });
      m.querySelector("#qe-submit").addEventListener("click", () => {
        const ans = m.querySelector("#qe-answer").value.trim();
        if (!ans){ UI.toast("اكتب إجابتك أولًا.", "error", "info"); return; }
        const g = U.gradeEssay(ans, it.modelAnswer, it.keyPoints);
        const correct = g.score >= 0.6;
        S.recordReview(it.id, { correct, score: g.score });
        results.push({ correct, question: it.question });
        const fb = m.querySelector("#qe-feedback");
        if (g.score >= 0.9){
          fb.innerHTML = '<div class="review-feedback good"><b>إجابة صحيحة</b> — إجابتك تغطي الفكرة الأساسية والنقاط المطلوبة، حتى لو اختلفت الصياغة.</div>';
        } else if (correct){
          fb.innerHTML = '<div class="review-feedback good"><b>إجابة صحيحة جزئيًا</b><br>إجابتك صحيحة في الفكرة الأساسية، لكن ينقصها:<br>' +
            g.miss.map(p => '<div class="kp-item"><span class="kp-dot"></span>' + U.esc(p) + '</div>').join("") +
            '<div class="muted small" style="margin-top:6px">الإجابة النموذجية تحتوي على نقاط أكثر — راجعها وأضفها لإجابتك.</div></div>';
        } else {
          fb.innerHTML = '<div class="review-feedback wrong"><b>إجابتك ناقصة</b><br>النقاط التي فاتتك:' +
            g.miss.map(p => '<div class="kp-item"><span class="kp-dot"></span>' + U.esc(p) + '</div>').join("") +
            (it.modelAnswer ? '<div class="muted small" style="margin-top:6px"><b>الإجابة النموذجية:</b><div style="margin-top:4px">' + U.esc(it.modelAnswer) + '</div></div>' : '') +
          '</div>';
        }
        if (fb.scrollIntoView) fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
        m.querySelector("#qe-submit").outerHTML = '<button class="btn primary" id="qe-next">التالي</button>';
        m.querySelector("#qe-next").addEventListener("click", () => { idx++; show(); });
      });
    }

    show();
  }

  /* entry for the "review now" flow used by homework/summary surfaces */
  App.Views.launchReview = function (pool){
    if (!pool || !pool.length){ UI.toast("لا أخطاء مستحقة للمراجعة الآن — فحص بعد يوم/3 أيام/أسبوع.", "gold", "errors"); return; }
    runQuiz(pool.slice());
  };

  /* ════════════════════ EXAM MODE ════════════════════ */
  const EXAM_SEC_PER = { mcq: 45, essay: 120 }; // per-question time budget
  function exPool(cfg){
    const st = S.getState();
    return st.mistakes.filter(m =>
      (!cfg.subjects || !cfg.subjects.length || cfg.subjects.includes(m.subject)) &&
      (cfg.qtype === "all" || m.type === cfg.qtype));
  }
  function exAsked(pl, count){
    const n = count === "all" ? pl.length : Math.min(+count, pl.length);
    return pl.slice(0, n);
  }
  function exTotalSec(list){
    return list.reduce((a, x) => a + (EXAM_SEC_PER[x.type] || 60), 0);
  }

  function buildExamSetup(){
    const st = S.getState();
    const cfg = { subjects: [], qtype: "all", count: "15" };
    const withMist = D.subjects.filter(s => st.mistakes.some(m => m.subject === s.id));
    if (withMist.length && !cfg.subjects.length) cfg.subjects = [withMist[0].id];

    const m = UI.openModal(UI.modalShell(
      I.get("timer", 18) + ' وضع الامتحان — بناء اختبار',
      '<div id="ex-setup"></div>',
      '<button class="btn ghost" data-close>إلغاء</button>' +
      '<button class="btn primary" id="ex-start">' + I.get("play", 15) + 'بدء الامتحان</button>'
    ), {});
    const root = m.querySelector("#ex-setup");

    function render(){
      const pl = exPool(cfg);
      const asked = exAsked(pl, cfg.count);
      const secs = exTotalSec(asked);
      const mins = Math.max(1, Math.round(secs / 60));
      const subjectsOk = cfg.subjects.length > 0;

      root.innerHTML =
        '<div class="qz-intro">' + I.get("timer", 15) + 'إعداد امتحان: بدون إجابة فورية، مؤقت محسوب، وتقرير نهائي.</div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("book", 14) + 'اختر مواد الامتحان (واحدة أو أكثر)</div>' +
          '<div class="seg qz-subj">' + D.subjects.map(s => {
            const n = st.mistakes.filter(x => x.subject === s.id).length;
            return '<button class="' + (cfg.subjects.includes(s.id) ? "active" : "") + '" data-esubj="' + s.id + '">' + I.subj(s, 13) + ' ' + s.name +
              (n ? '<span class="chip qz-chip">' + n + '</span>' : '') + '</button>';
          }).join("") + '</div></div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("edit", 14) + 'نوع الأسئلة</div>' +
          '<div class="seg qz-type">' +
            '<button class="' + (cfg.qtype === "all" ? "active" : "") + '" data-eqtype="all">جميع الأنواع</button>' +
            '<button class="' + (cfg.qtype === "mcq" ? "active" : "") + '" data-eqtype="mcq">اختيار من متعدد</button>' +
            '<button class="' + (cfg.qtype === "essay" ? "active" : "") + '" data-eqtype="essay">مقالي</button>' +
          '</div></div>' +

        '<div class="qz-step"><div class="qz-step-label">' + I.get("target", 14) + 'كم سؤالًا؟</div>' +
          '<div class="seg qz-count">' +
            ["5","10","15","20"].map(n => '<button class="' + (cfg.count === n ? "active" : "") + '" data-ecount="' + n + '">' + n + '</button>').join("") +
            '<button class="' + (cfg.count === "all" ? "active" : "") + '" data-ecount="all">كل الأسئلة المتاحة' + (asked.length ? ' (' + asked.length + ')' : '') + '</button>' +
          '</div></div>' +

        '<div class="qz-summary">' + (subjectsOk && asked.length ?
          'سينعقد امتحان من <b>' + asked.length + '</b> سؤالا' + (asked.length < pl.length ? ' من أصل <b>' + pl.length + '</b> متاحة' : '') +
          ' — المؤقت المحسوب: <b>' + mins + (mins === 1 ? ' دقيقة' : ' دقائق') + '</b>' +
          '<span class="muted small"> (' + EXAM_SEC_PER.mcq + 'ث/اختياري، ' + EXAM_SEC_PER.essay + 'ث/مقالي)</span>'
          : (!subjectsOk ? 'اختر مادة واحدة على الأقل.' : 'لا أسئلة مطابقة للمواد المختارة.')) + '</div>';

      document.getElementById("ex-start").disabled = !(subjectsOk && asked.length);
      root.querySelectorAll("[data-esubj]").forEach(b => b.addEventListener("click", () => {
        const id = b.dataset.esubj;
        const i = cfg.subjects.indexOf(id);
        if (i >= 0) cfg.subjects.splice(i, 1); else cfg.subjects.push(id);
        render();
      }));
      root.querySelectorAll("[data-eqtype]").forEach(b => b.addEventListener("click", () => { cfg.qtype = b.dataset.eqtype; render(); }));
      root.querySelectorAll("[data-ecount]").forEach(b => b.addEventListener("click", () => { cfg.count = b.dataset.ecount; render(); }));
    }
    render();

    document.getElementById("ex-start").addEventListener("click", () => {
      if (!cfg.subjects.length){ UI.toast("اختر مادة واحدة على الأقل.", "error", "info"); return; }
      const pl = exPool(cfg);
      if (!pl.length){ UI.toast("لا أسئلة في بنك المواضيع المختارة.", "error", "errors"); return; }
      const asked = exAsked(pl, cfg.count);
      const examPool = asked.slice();
      for (let i = examPool.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [examPool[i], examPool[j]] = [examPool[j], examPool[i]];
      }
      UI.closeModal();
      runExam(examPool, cfg.subjects.slice());
    });
  }

  function runExam(pool, subjects){
    let idx = 0;
    let done = false;
    let timer = null;
    let submitLock = false;
    const totalSec = exTotalSec(pool);
    let remaining = totalSec;
    const answers = []; // { sel, text }
    const optMix = {}; // per-question: { list, corrText } after shuffling options
    for (let si = pool.length - 1; si > 0; si--){
      const sj = Math.floor(Math.random() * (si + 1));
      const tmp = pool[si]; pool[si] = pool[sj]; pool[sj] = tmp;
    }
    const m = document.getElementById("modal-root");
    const subjLabel = (subjects || []).map(id => D.subjectById(id).name).join("، ");

    function stopTimer(){ if (timer){ clearInterval(timer); timer = null; } }
    function paintClock(){
      const el = document.getElementById("ex-time");
      if (el) el.textContent = U.fmtClockFull(remaining);
    }
    function tick(){
      remaining = Math.max(0, remaining - 1);
      paintClock();
      if (remaining <= 0 && !done) finish();
    }

    function show(){
      if (done) return;
      if (idx >= pool.length){ finish(); return; }
      const it = pool[idx];
      const body =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">' +
          '<span class="badge gold">' + I.get("timer", 12) + ' باقي: <b id="ex-time">' + U.fmtClockFull(remaining) + '</b></span>' +
          '<span class="badge neutral">سؤال ' + (idx + 1) + ' / ' + pool.length + '</span>' +
          '<span class="chip" style="color:' + D.subjectById(it.subject).accent + '">' + I.subj(D.subjectById(it.subject), 12) + ' ' + D.subjectById(it.subject).name + '</span>' +
          '<span class="badge neutral">' + (it.type === "mcq" ? "اختياري" : "مقالي") + '</span>' +
        '</div>' +
        '<div class="mistake-q" style="font-size:16px;margin-bottom:14px">' + U.esc(it.question) + '</div>' +
        UI.qImg(it.imageUrl) +
        (it.type === "mcq"
          ? (function(){
              const orig = (it.options || []).slice();
              const cid = U.optId(it.correctAnswerId || it.correctAnswer, orig).charCodeAt(0) - 65;
              const corrText = (cid >= 0 && cid < orig.length) ? orig[cid] : "";
              const list = orig.slice();
              for (let k = list.length - 1; k > 0; k--){
                const j = Math.floor(Math.random() * (k + 1));
                const t = list[k]; list[k] = list[j]; list[j] = t;
              }
              optMix[it.id] = { list: list, corrText: corrText };
              return '<div style="display:flex;flex-direction:column;gap:8px">' + list.map((o, i) =>
                '<div class="opt-row" data-oi="' + i + '"><span class="or-let">' + U.optLetter(i) + '</span>' +
                '<span style="flex:1">' + U.esc(o) + '</span></div>').join("") + '</div>';
            })()
          : '<div class="field"><label>إجابتك — ستُقيَّم بالنقاط الأساسية</label><textarea class="input" id="ex-ans" style="min-height:130px" placeholder="اكتب إجابة كاملة منظمة بالنقاط"></textarea></div>');

      UI.openModal(UI.modalShell(
        I.get("timer", 18) + ' امتحان — ' + subjLabel,
        body,
        '<span class="muted small" style="flex:1">' + U.esc(it.explanation ? "" : "") + '</span>' +
        '<button class="btn ghost" data-exit>إنهاء مبكر</button>' +
        '<button class="btn primary" data-enx="1">' + (idx === pool.length - 1 ? 'إنهاء الامتحان' : I.get("chevron_right", 14) + 'التالي') + '</button>',
        { size: "lg" }
      ), { onOpen: function (){ if (!timer){ timer = setInterval(tick, 1000); } paintClock(); } });

      m.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", stopTimer));
      m.querySelector("[data-exit]").addEventListener("click", () => {
        stopTimer();
        finish();
      });
      m.querySelector("[data-enx]").addEventListener("click", () => {
        capture(it);
        if (idx === pool.length - 1){ finish(); }
        else { idx++; show(); }
      });
      if (it.type === "mcq"){
        const prev = answers[idx] && answers[idx].sel != null ? answers[idx].sel : null;
        m.querySelectorAll("[data-oi]").forEach(row => {
          if (String(U.optLetter(+row.dataset.oi)) === String(prev)) row.classList.add("sel");
          row.addEventListener("click", () => {
            m.querySelectorAll("[data-oi]").forEach(x => x.classList.remove("sel"));
            row.classList.add("sel");
          });
        });
      } else {
        const tx = document.getElementById("ex-ans");
        if (tx && answers[idx] && answers[idx].text != null) tx.value = answers[idx].text;
      }
    }

    function capture(it){
      if (answers[idx]) return;
      const a = { answered: false, sel: null, text: "" };
      const cur = document.getElementById("modal-root");
      if (it.type === "mcq"){
        const sel = cur.querySelector(".opt-row.sel");
        if (sel){ a.sel = sel.dataset.oi; a.oi = +sel.dataset.oi; }
        a.answered = !!sel;
      } else {
        const ta = cur.querySelector("#ex-ans");
        a.text = (ta && ta.value || "").trim();
        a.answered = a.text.length > 0;
      }
      answers[idx] = a;
    }

    function finish(){
      if (done || submitLock) return;
      done = true; submitLock = true;
      stopTimer();
      if (!answers[idx]) capture(pool[idx]); // read the open question if possible
      while (idx < pool.length){ answers[idx] = answers[idx] || { answered: false, sel: null, text: "" }; idx++; }
      const res = pool.map((it, i) => grade(it, answers[i] || { answered: false }));
      const correct = res.filter(r => r.correct).length;
      const score = pool.length ? correct / pool.length : 0;
      const spentSec = totalSec - remaining;
      report(res, correct, score, spentSec, subjLabel, subjects);
    }

    function grade(it, a){
      if (!a || !a.answered) return { it, correct: false, sel: a && a.sel, text: a && a.text, correctLabel: correctLabel(it) };
      if (it.type === "mcq"){
        const m = optMix[it.id];
        const selText = m && a.sel != null ? m.list[+a.sel] : null;
        const c = !!m && selText != null && selText === m.corrText;
        return { it, correct: c, sel: a.sel, text: a.text, correctLabel: correctLabel(it) };
      }
      const g = U.gradeEssay(a.text, it.modelAnswer, it.keyPoints);
      return { it, correct: g.score >= 0.6, score: g.score, text: a.text, correctLabel: correctLabel(it) };
    }
    function correctLabel(it){
      return it.type === "mcq" ? U.ansLabel((it.options || []), it.correctAnswerId || it.correctAnswer) : U.esc(it.modelAnswer || "");
    }

    function report(res, correct, score, spentSec, subjLabel2, subjects2){
      submitLock = false;
      const wrongIds = res.filter(r => !r.correct).map(r => r.it.id);
      UI.openModal(UI.modalShell(
        I.get("achievements", 18) + ' نتيجة الامتحان',
        '<div style="text-align:center;padding:8px 0">' +
          '<div style="font-size:44px;font-weight:900;color:var(--gold-2)" class="num">' + correct + '/' + pool.length + '</div>' +
          '<div class="muted" style="margin-bottom:12px">' + Math.round(score * 100) + '% · استغرقت ' + U.fmtClockFullWords(spentSec) + '</div>' +
          '<div class="badge ' + (score >= 0.7 ? "emerald" : score >= 0.4 ? "amber" : "red") + '">' +
            (score >= 0.7 ? "أداء ممتاز — واصل" : score >= 0.4 ? "مقبول — ركّز على أخطائك" : "يحتاج مراجعة جادة") + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin:14px 0;text-align:right">' +
          res.map((r, i) => '<div class="calitem-row">' + I.get(r.correct ? "check" : "close", 13) +
            '<span style="color:' + (r.correct ? "var(--em-3)" : "var(--danger-text)") + '">' + (r.correct ? "صحيح" : "خاطئ") + '</span>' +
            '<span class="muted small" style="flex:1" title="' + U.esc(r.it.question) + '">' + U.esc(r.it.question).slice(0, 44) + '…</span></div>').join("") +
        '</div>' +
        '<div class="review-feedback neutral" style="margin:0"><b>الحفظ:</b> يُخزَّن التقرير في التحليلات، ويمكنك مراجعة أخطائك فورًا أو إعادة الاختبار.</div>',
        '<button class="btn ghost" data-close>إغلاق</button>' +
        '<button class="btn emerald" id="ex-retry">' + I.get("reload", 14) + 'إعادة الاختبار</button>' +
        '<button class="btn glass" id="ex-wrong">' + I.get("target", 14) + 'مراجعة أخطائي (' + wrongIds.length + ')</button>' +
        '<button class="btn primary" id="ex-save">' + I.get("download", 14) + 'حفظ التقرير</button>',
        { size: "lg" }
      ), {});
      m.querySelector("#ex-save").addEventListener("click", () => {
        S.addExam({ subjects: subjects2, title: subjLabel2, count: pool.length, correct, score, durationSec: spentSec, wrong: wrongIds });
        if (correct) { const got = S.grantXP(correct * 8, "امتحان مكتمل"); UI.toast("حُفظ التقرير +" + got.amount + " XP.", "success", "achievements"); }
        else UI.toast("حُفظت نتيجة الامتحان.", "gold", "achievements");
        UI.closeModal();
      });
      m.querySelector("#ex-wrong").addEventListener("click", () => {
        const wrongPool = pool.filter(x => wrongIds.indexOf(x.id) >= 0);
        UI.closeModal();
        App.Views.launchReview(wrongPool);
      });
      m.querySelector("#ex-retry").addEventListener("click", () => {
        UI.closeModal();
        runExam(pool.slice(), subjects2);
      });
    }

    show();
  }

  /* ════════════════════ SESSIONS ════════════════════ */
  V.register("sessions", function (root){
    const st = S.getState();
    const blocks = st.blocks.slice().sort((a, b) => b.ts.localeCompare(a.ts));
    const totalM = blocks.reduce((a, b) => a + b.minutes, 0);
    const weekM = blocks.filter(b => U.daysBetween(b.date, U.todayKey()) <= 6 && U.daysBetween(b.date, U.todayKey()) >= 0).reduce((a, b) => a + b.minutes, 0);
    const avg = blocks.length ? Math.round(totalM / blocks.length) : 0;
    const byDate = {};
    blocks.forEach(b => { (byDate[b.date] = byDate[b.date] || []).push(b); });
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">جلسات الدراسة</div>' +
      '<div class="page-sub">سجل كل لحظات التركيز — كل جلسة خطوة نحو الهدف.</div></div>' +
      '<div class="head-actions"><button class="btn primary" data-ses="start">' + I.get("play", 15) + 'ابدأ جلسة</button></div></div>' +

      '<div class="grid cols-4" style="margin-bottom:16px">' +
        UI.statCard("clock", U.fmtDur(totalM), "إجمالي الوقت", "gold") +
        UI.statCard("sessions", blocks.length, "الجلسات") +
        UI.statCard("timer", U.fmtDur(avg), "متوسط الجلسة") +
        UI.statCard("zap", U.fmtDur(weekM), "هذا الأسبوع") +
      '</div>' +

      (dates.length ? dates.slice(0, 14).map(d => {
        const list = byDate[d];
        const mins = list.reduce((a, b) => a + b.minutes, 0);
        return '<div class="todo-section">' +
          '<div class="todo-sec-head"><h3>' + (d === U.todayKey() ? "اليوم" : U.relativeDay(d)) + '</h3>' +
          '<span class="sc">' + U.fmtDur(mins) + ' · ' + list.length + ' جلسات</span><span class="sepline"></span></div>' +
          '<div class="todo-list">' + list.slice(0, 12).map(b => {
            const subj = D.subjectById(b.subject);
            const t = new Date(b.ts);
            return '<div class="task-item glass-1" style="align-items:center">' +
              '<div class="act-ic" style="color:' + subj.accent + '">' + I.get(b.mode === "focus" ? "focus" : b.mode === "pomodoro" ? "timer" : "sessions", 15) + '</div>' +
              '<div class="task-txt" style="flex:1">' +
                '<span class="muted small" style="display:block">' + U.fmtTimeHM(t) + ' · ' + (b.mode === "focus" ? "Focus" : b.mode === "pomodoro" ? "بومودورو" : "مخصص") + '</span>' +
                '<b>' + U.esc(b.title || subj.name) + '</b>' +
                (b.notes ? '<span class="task-desc">' + U.esc(b.notes) + '</span>' : '') +
              '</div>' +
              '<span class="chip">' + subj.name + '</span>' +
              '<b class="num" style="font-size:15px;color:var(--gold-2)">' + U.fmtDur(b.minutes) + '</b>' +
              '<button class="icon-btn small" data-ses-del="' + b.id + '" title="حذف" aria-label="حذف">' + I.get("trash", 14) + '</button>' +
            '</div>';
          }).join("") + '</div></div>';
      }).join("")
      : '<div class="card glass-1">' + UI.empty("sessions", "ابدأ أول جلسة مذاكرة",
          'كل جلسة (بومودورو، تركيز، أو مخصص) تُسجَّل هنا وتؤثر على هدفك اليومي وتحليلاتك.',
          '<button class="btn primary" data-ses="start">' + I.get("play", 15) + 'ابدأ جلسة</button>') + '</div>');

    root.querySelectorAll("[data-ses='start']").forEach(b => b.addEventListener("click", () => UI.startSessionFlow && UI.startSessionFlow()));
    root.querySelectorAll("[data-ses-del]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.sesDel;
      UI.dangerConfirm("حذف الجلسة", "ستُحذف الجلسة ووقتها من التحليلات وهدف اليوم.", "حذف", () => { S.deleteBlock(id); UI.toast("حُذفت الجلسة.", "gold", "trash"); });
    }));
  }, { rerender: true, title: "جلسات الدراسة" });

  /* ════════════════════ HOMEWORK ════════════════════ */
  V.register("homework", function (root){
    const st = S.getState();
    S.refreshHwStatus();
    const sec = { overdue: [], today: [], upcoming: [], completed: [] };
    st.homework.forEach(h => {
      if (h.completed) sec.completed.push(h);
      else if (h.status === "overdue") sec.overdue.push(h);
      else if (h.status === "today") sec.today.push(h);
      else sec.upcoming.push(h);
    });
    const sortP = (a, b) => ((b.priority === "high") - (a.priority === "high")) || a.deadline.localeCompare(b.deadline);
    Object.keys(sec).forEach(k => sec[k].sort(sortP));
    const rvNow = S.reviewQueue();

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">الواجبات</div>' +
      '<div class="page-sub">لا واجب ضائع بعد اليوم — تابع تواريخك ومنزلياتك.</div></div>' +
      '<div class="head-actions"><button class="btn primary" data-hw="add">' + I.get("plus", 15) + 'إضافة واجب</button></div></div>' +

      (rvNow.length ?
        '<div class="todo-section review-due">' +
          '<div class="todo-sec-head"><h3>مراجعات أخطاء مستحقة</h3><span class="sc">' + rvNow.length + '</span>' +
          '<span class="badge amber">' + I.get("errors", 11) + 'جدولة ذكية 1/3/7</span><span class="sepline"></span></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 0 4px">' +
            rvNow.slice(0, 6).map(m => reviewDueChip(m)).join("") +
            (rvNow.length > 6 ? '<span class="chip neutral">+' + (rvNow.length - 6) + ' أخرى</span>' : '') +
          '</div>' +
          '<div class="todo-list"><div class="task-item glass-1" style="align-items:center">' +
            '<div class="act-ic" style="color:var(--gold-2)">' + I.get("target", 15) + '</div>' +
            '<span class="task-txt" style="flex:1"><b>مراجعتها اليوم تثبّتها في ذاكرتك</b>' +
            '<span class="task-desc">الإجابة الصحيحة اليوم تجدد موعدها (بعد يوم/3 أيام/أسبوع). الخطأ يعيدها اليوم.</span></span>' +
            '<button class="btn emerald sm" data-rv="now">' + I.get("play", 14) + 'مراجعة ' + rvNow.length + '</button>' +
          '</div></div>' +
        '</div>' : '') +

      [["overdue", "متأخرة", "red"], ["today", "مستحقة اليوم", "amber"], ["upcoming", "قادمة", ""], ["completed", "مكتملة", "emerald"]].map(g => {
        const key = g[0];
        const list = sec[key];
        if (!list.length) return "";
        return '<div class="todo-section">' +
          '<div class="todo-sec-head"><h3>' + g[1] + '</h3><span class="sc">' + list.length + '</span><span class="sepline"></span></div>' +
          '<div class="todo-list">' + list.map(h => hwCard(h)).join("") + '</div></div>';
      }).join("") +

      (!st.homework.length ? '<div class="card glass-1">' + UI.empty("homework", "لا واجبات بعد",
        'أضف واجبك الأول وتابع مواعيده مع تنبيهات ذكية.',
        '<button class="btn primary" data-hw="add">' + I.get("plus", 15) + 'إضافة واجب</button>') + '</div>' : "");

    root.querySelectorAll("[data-hw='add']").forEach(b => b.addEventListener("click", () => App.Modals.openHwModal()));
    root.querySelectorAll("[data-rv='now']").forEach(b => b.addEventListener("click", () => App.Views.launchReview(S.reviewQueue())));
    root.querySelectorAll("[data-hw='toggle']").forEach(b => b.addEventListener("click", () => S.toggleHw(b.dataset.id)));
    root.querySelectorAll("[data-hw='edit']").forEach(b => b.addEventListener("click", () => App.Modals.openHwModal(b.dataset.id)));
    root.querySelectorAll("[data-hw='del']").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id;
      UI.dangerConfirm("حذف الواجب", "سيُحذف الواجب نهائيًا.", "حذف", () => { S.deleteHw(id); UI.toast("حُذف الواجب.", "gold", "trash"); });
    }));
  }, { rerender: true, title: "الواجبات" });

  function reviewDueChip(m){
    const subj = D.subjectById(m.subject);
    const dueOn = m.nextReview && m.nextReview <= U.todayKey() ? (m.nextReview === U.todayKey() ? "مستحقة اليوم" : "متأخرة " + U.daysBetween(m.nextReview, U.todayKey()) + " يوم") : "";
    return '<span class="chip rv-due" style="color:' + subj.accent + ';padding:6px 10px;gap:5px">' + I.subj(subj, 12) + ' ' + subj.name +
      '<b style="font-weight:700">' + U.esc(String(m.question).slice(0, 34)) + (String(m.question).length > 34 ? "…" : "") + '</b>' +
      (dueOn ? '<span class="tiny-dot" title="' + dueOn + '"></span>' : '') + '</span>';
  }

  function hwCard(h){
    const subj = D.subjectById(h.subject);
    const cd = S.hwCountdown(h);
    return '<div class="task-item glass-1 hw-item ' + (h.completed ? "done" : "") + (h.status === "overdue" ? " overdue" : "") + '" style="display:flex;flex-direction:column;align-items:stretch;gap:8px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<button class="check-mark task-box ' + (h.completed ? "on" : "") + '" data-hw="toggle" data-id="' + h.id + '" aria-label="إنجاز الواجب">' + I.get("check", 16) + '</button>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="hw-title">' + U.esc(h.title) + '</div>' +
          (h.lesson ? '<div class="hw-lesson">' + U.esc(h.lesson) + '</div>' : '') +
          (h.desc ? '<div class="task-desc" style="white-space:normal">' + U.esc(h.desc) + '</div>' : '') +
          '<div class="task-meta">' +
            UI.prioTag(h.priority) +
            '<span class="chip" style="color:' + subj.accent + '">' + I.subj(subj, 13) + ' ' + subj.name + '</span>' +
            (h.exercises ? '<span class="chip">' + h.exercises + ' تمارين</span>' : '') +
            '<span class="task-time">' + I.get("calendar", 11) + (h.completed ? "أُنجز " + U.relativeDay(h.completedOn) : "مستحق " + U.fmtDate(h.deadline, { short: true })) + '</span>' +
            '<span class="hw-countdown ' + cd.cls + '">' + I.get(cd.cls === "ok" && !h.completed ? "clock" : "flag", 11) + cd.txt + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="task-actions">' +
          '<button title="تعديل" data-hw="edit" data-id="' + h.id + '" aria-label="تعديل">' + I.get("edit", 14) + '</button>' +
          '<button class="del" title="حذف" data-hw="del" data-id="' + h.id + '" aria-label="حذف">' + I.get("trash", 14) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ════════════════════ CALENDAR ════════════════════ */
  let calState = { view: "month", cursor: new Date(), sel: U.todayKey() };
  V.register("calendar", function (root){
    const st = S.getState();
    root.innerHTML = renderCalendar(st);
    bindCalendar(root, st);
  }, { rerender: true, title: "التقويم" });

  function renderCalendar(st){
    const c = calState;
    const sel = c.sel;
    const daily = st.daily[sel] || {};
    const selTasks = st.tasks.filter(t => t.date === sel);
    const selHw = st.homework.filter(h => h.deadline === sel && !h.completed);
    const selBlocks = st.blocks.filter(b => b.date === sel);
    const selNotes = st.notes.filter(n => U.dateKey(new Date(n.createdAt)) === sel && !n.archived);
    const monthTitle = U.MONTHS_AR[c.cursor.getMonth()] + " " + c.cursor.getFullYear();

    let gridMain = "";
    if (c.view === "month" || c.view === "week"){
      let gridStart;
      if (c.view === "week"){
        gridStart = U.startOfWeek(c.cursor);
      } else {
        const first = new Date(c.cursor.getFullYear(), c.cursor.getMonth(), 1);
        const startOffset = (first.getDay() + 6) % 7;
        gridStart = new Date(first); gridStart.setDate(1 - startOffset);
      }
      const cells = c.view === "month" ? 42 : 7;
      let g = "";
      if (c.view === "month") for (let i = 0; i < 7; i++) g += '<div class="cal-dow">' + U.DAYS_ABBR[i] + '</div>';
      for (let i = 0; i < cells; i++){
        const d = U.addDays(gridStart, i);
        const k = U.dateKey(d);
        const other = c.view === "month" && d.getMonth() !== c.cursor.getMonth();
        const tCnt = st.tasks.filter(t => t.date === k && !t.completed).length;
        const hCnt = st.homework.filter(h => h.deadline === k && !h.completed).length;
        const sMin = (st.daily[k] || {}).studyMin || 0;
        const sCnt = (st.daily[k] || {}).sessions || 0;
        g += '<div class="cal-cell ' + (other ? "other" : "") + (k === U.todayKey() ? " today" : "") + (k === sel ? " selected" : "") + '" data-cal="' + k + '" role="button" tabindex="0">' +
          '<div class="cal-num">' + d.getDate() + '</div>' +
          '<div class="cal-items">' +
            (hCnt ? '<span class="cal-mini hw">' + hCnt + ' واجب</span>' : '') +
            (tCnt ? '<span class="cal-mini task">' + tCnt + ' مهمة</span>' : '') +
            (sMin ? '<span class="cal-mini session">' + U.fmtDur(sMin) + '</span>' : '') +
          '</div></div>';
      }
      gridMain = '<div class="cal-grid">' + g + '</div>';
    }

    return '' +
      '<div class="page-head"><div><div class="page-title">التقويم</div>' +
      '<div class="page-sub">خطط مهامك وواجباتك وجلساتك عبر الزمن.</div></div></div>' +

      '<div class="card glass-1" style="padding:18px">' +
        '<div class="cal-head">' +
          '<button class="btn ghost sm" data-cal="today">اليوم</button>' +
          '<button class="icon-btn" data-cal="prev" aria-label="السابق">' + I.get("chevron_right", 18) + '</button>' +
          '<div class="cal-title">' + monthTitle + '</div>' +
          '<button class="icon-btn" data-cal="next" aria-label="التالي">' + I.get("chevron_left", 18) + '</button>' +
          '<div class="cal-view-tabs" style="margin-inline-start:auto">' +
            '<button class="' + (c.view === "month" ? "active" : "") + '" data-cal="view" data-v="month">شهر</button>' +
            '<button class="' + (c.view === "week" ? "active" : "") + '" data-cal="view" data-v="week">أسبوع</button>' +
            '<button class="' + (c.view === "day" ? "active" : "") + '" data-cal="view" data-v="day">يوم</button>' +
          '</div>' +
        '</div>' +
        gridMain +
      '</div>' +

      '<div class="card glass-1" style="margin-top:16px">' +
        '<div class="cal-day-title">' + (U.isToday(sel) ? "اليوم" : U.fmtDate(sel, { dayName: true, year: true })) +
          '<span class="cd-sub num">' + U.fmtDur(daily.studyMin || 0) + ' · ' + (daily.sessions || 0) + ' جلسات</span></div>' +
        '<div class="cal-day-panel" style="margin-top:12px">' +
          renderCalItems(st, sel) +
        '</div>' +
      '</div>';
  }

  function renderCalItems(st, sel){
    const out = [];
    const tps = st.tasks.filter(t => t.date === sel);
    tps.forEach(t => {
      out.push('<div class="calitem-row">' +
        (t.completed ? '<span class="badge emerald">مكتملة</span>' : '<button class="check-mark" style="width:24px;height:24px;border-radius:8px" data-caltoggle="' + t.id + '">' + I.get("check", 14) + '</button>') +
        '<span style="flex:1">' + U.esc(t.title) + '</span>' +
        (t.time ? '<span class="ci-time">' + t.time + '</span>' : '') +
        (t.completed ? '' :
          '<button class="btn sm ghost" data-calmove="' + t.id + '">' + I.get("calendar2", 12) + 'نقل إلى غدًا</button>') +
        '</div>');
    });
    st.homework.filter(h => h.deadline === sel).forEach(h => {
      out.push('<div class="calitem-row"><span class="badge amber">واجب</span><span style="flex:1">' + U.esc(h.title) + ' — ' + D.subjectById(h.subject).name + '</span>' +
        (h.completed ? '<span class="badge emerald">مكتمل</span>' : S.hwCountdown(h).txt) + '</div>');
    });
    st.blocks.filter(b => b.date === sel).forEach(b => {
      const subj = D.subjectById(b.subject);
      out.push('<div class="calitem-row"><span class="cal-mini session" style="font-size:10px">' + (b.mode === "focus" ? "Focus" : b.mode === "pomodoro" ? "بومودورو" : "جلسة") + '</span>' +
        '<span style="flex:1">' + U.esc(b.title || subj.name) + '</span><span class="ci-time">' + U.fmtTimeHM(new Date(b.ts)) + ' · ' + U.fmtDur(b.minutes) + '</span></div>');
    });
    st.notes.filter(n => !n.archived && (U.dateKey(new Date(n.createdAt)) === sel || U.dateKey(new Date(n.updatedAt)) === sel)).forEach(n => {
      out.push('<div class="calitem-row">' + I.get("notes", 13) + '<span style="flex:1">' + U.esc(n.title) + '</span><span class="muted small">ملاحظة</span></div>');
    });
    if (!out.length) out.push(UI.empty("calendar", "يوم هادئ", "لا مهام أو واجبات أو جلسات في هذا اليوم."));
    return out.join("");
  }

  function bindCalendar(root, st){
    const c = calState;
    root.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.cal;
      if (act === "view"){ c.view = b.dataset.v; }
      else if (act === "prev"){ if (c.view === "month") c.cursor.setMonth(c.cursor.getMonth() - 1); else c.cursor = U.addDays(c.cursor, c.view === "week" ? -7 : -1); }
      else if (act === "next"){ if (c.view === "month") c.cursor.setMonth(c.cursor.getMonth() + 1); else c.cursor = U.addDays(c.cursor, c.view === "week" ? 7 : 1); }
      else if (act === "today"){ c.cursor = new Date(); c.sel = U.todayKey(); }
      App.Router.rerender();
    }));
    root.querySelectorAll("[data-cal]").forEach(b => b.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") b.click(); }));
    root.querySelectorAll("[data-caltoggle]").forEach(b => b.addEventListener("click", () => S.toggleTask(b.dataset.caltoggle)));
    root.querySelectorAll("[data-calmove]").forEach(b => b.addEventListener("click", () => {
      S.rescheduleTask(b.dataset.calmove, U.tomorrowKey());
      UI.toast("نُقلت المهمة إلى غدًا.", "gold", "calendar");
    }));
    root.querySelectorAll("[data-cal]").forEach(b => {});
  }
  App.Views.calSel = () => { calState.sel = U.todayKey(); calState.cursor = new Date(); };

  /* ════════════════════ NOTES ════════════════════ */
  let noteQ = { q: "", subject: "all", archived: false };
  V.register("notes", function (root){
    const st = S.getState();
    let list = st.notes.filter(n => !!n.archived === noteQ.archived);
    if (noteQ.subject !== "all") list = list.filter(n => n.subject === noteQ.subject);
    if (noteQ.q) list = list.filter(n => (n.title + " " + n.content + " " + n.tags.join(" ")).toLowerCase().includes(noteQ.q.toLowerCase()));
    list = list.sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">الملاحظات</div>' +
      '<div class="page-sub">خزنتك المعرفية — معلومة، مراجعة، قاعدة، أو مفهوم.</div></div>' +
      '<div class="head-actions">' +
        '<button class="btn ' + (noteQ.archived ? "emerald" : "ghost") + '" data-note="arch">' + I.get("archive", 15) + (noteQ.archived ? "ملاحظاتي" : "المؤرشفة") + '</button>' +
        '<button class="btn primary" data-note="add">' + I.get("plus", 15) + 'إضافة ملاحظة</button>' +
      '</div></div>' +

      '<div class="notes-toolbar">' +
        '<div class="search-box">' + I.get("search", 16) + '<input class="input" id="note-search" placeholder="ابحث في ملاحظاتك…" value="' + U.esc(noteQ.q) + '"></div>' +
        '<div class="filter-bar" style="padding:4px">' +
          ["all", ...D.subjects.map(s => s.id)].map(sub =>
            '<button class="filter-chip' + (noteQ.subject === sub ? " active" : "") + '" data-nf="' + sub + '">' + (sub === "all" ? "كل شيء" : D.subjectById(sub).name) + '</button>').join("") +
        '</div>' +
      '</div>' +

      (list.length ? '<div class="grid cols-3">' + list.map(n => noteCard(n)).join("") + '</div>'
        : '<div class="card glass-1">' + UI.empty("notes", noteQ.q ? "لا نتائج للبحث" : (noteQ.archived ? "لا ملاحظات مؤرشفة" : "خزنتك فارغة"),
            noteQ.q ? "جرّب كلمات أخرى." : "احفظ كل معلومة تنساها هنا لتصبح مرجعك الشخصي.",
            noteQ.q ? "" : '<button class="btn primary" data-note="add">' + I.get("plus", 15) + 'أول ملاحظة</button>') + '</div>');

    root.querySelectorAll("[data-note='add']").forEach(b => b.addEventListener("click", () => App.Modals.openNoteModal()));
    root.querySelectorAll("[data-note='arch']").forEach(b => b.addEventListener("click", () => { noteQ.archived = !noteQ.archived; App.Router.rerender(); }));
    root.querySelectorAll("[data-nf]").forEach(b => b.addEventListener("click", () => { noteQ.subject = b.dataset.nf; App.Router.rerender(); }));
    root.querySelectorAll("[data-npin]").forEach(b => b.addEventListener("click", () => S.togglePin(b.dataset.npin)));
    root.querySelectorAll("[data-narch]").forEach(b => b.addEventListener("click", () => S.toggleArchive(b.dataset.narch)));
    root.querySelectorAll("[data-nedit]").forEach(b => b.addEventListener("click", () => App.Modals.openNoteModal(b.dataset.nedit)));
    root.querySelectorAll("[data-ndel]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.ndel;
      UI.dangerConfirm("حذف الملاحظة", "ستفقد هذه الملاحظة نهائيًا.", "حذف", () => { S.deleteNote(id); UI.toast("حُذفت الملاحظة.", "gold", "trash"); });
    }));
    const search = document.getElementById("note-search");
    if (search) search.addEventListener("input", U.debounce(function(){ noteQ.q = this.value; App.Router.rerender(); }, 250));
  }, { rerender: true, title: "الملاحظات" });

  function noteCard(n){
    const subj = D.subjectById(n.subject);
    return '<div class="card glass-1 note-card' + (n.pinned ? " pinned" : "") + '">' +
      '<div class="note-title">' + (n.pinned ? I.get("pin", 14) : "") + U.esc(n.title) + '</div>' +
      '<div class="note-preview">' + U.esc(n.content.length > 130 ? n.content.slice(0, 130) + "…" : n.content) + '</div>' +
      '<div class="note-meta">' +
        '<span class="chip" style="color:' + subj.accent + ';padding:2px 8px;font-size:10px">' + subj.name + '</span>' +
        n.tags.map(t => '<span class="note-tag">#' + U.esc(t) + '</span>').join("") +
        '<span class="muted small num">' + U.fmtDate(n.updatedAt.slice(0, 10), { short: true }) + '</span>' +
      '</div>' +
      '<div class="note-actions">' +
        '<button data-npin="' + n.id + '" title="تثبيت" aria-label="تثبيت">' + I.get("pin", 13) + '</button>' +
        '<button data-narch="' + n.id + '" title="أرشفة" aria-label="أرشفة">' + I.get("archive", 13) + '</button>' +
        '<button data-nedit="' + n.id + '" title="تعديل" aria-label="تعديل">' + I.get("edit", 13) + '</button>' +
        '<button class="del" data-ndel="' + n.id + '" title="حذف" aria-label="حذف">' + I.get("trash", 13) + '</button>' +
      '</div>' +
    '</div>';
  }

})();