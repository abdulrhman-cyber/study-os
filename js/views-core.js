/* ═══════════════ STUDY OS — views-core.js (dashboard, todo, timer, subjects) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Views = App.Views || {};
(function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;

  App.Views.registry = App.Views.registry || {};
  App.Views.titles = App.Views.titles || {};
  App.Views.register = function (route, render, opts){
    opts = opts || {};
    App.Views.registry[route] = { render: render, rerender: opts.rerender !== false };
    App.Views.titles[route] = opts.title || route;
  };
  App.Views.run = function (route, ctx){
    const r = App.Views.registry[route] || App.Views.registry["dashboard"];
    const root = document.getElementById("view-root");
    root.dataset.view = route;
    root.innerHTML = '<div class="skeleton-stack" aria-hidden="true"><div class="sk hero"></div><div class="sk grid"><div class="sk card"></div><div class="sk card"></div><div class="sk card"></div><div class="sk card"></div></div><div class="sk card tall"></div></div>';
    requestAnimationFrame(() => {
      try { r.render(root, ctx || {}); }
      catch(e){
        console.error(e);
        root.innerHTML = UI.empty("info", "تعذر تحميل البيانات",
          "حدث خطأ في عرض هذه الصفحة. حاول مرة أخرى." ,
          '<button class="btn primary sm" onclick="location.reload()">إعادة التحميل</button>');
      }
      App.Router && App.Router.onRendered && App.Router.onRendered(route);
    });
  };

  /* ════════════════════ DASHBOARD ════════════════════ */
  App.Views.register("dashboard", function (root){
    const st = S.getState();
    const ts = S.todayStats();
    const today = U.todayKey();
    const nba = S.nextBestAction();
    const daily = st.daily[today] || {};
    const level = D.levelInfo(st.xp);
    const streak = D.streakOf(st);

    const tasksToday = st.tasks.filter(t => t.date === today);
    const pendingToday = tasksToday.filter(t => !t.completed);
    const doneToday = tasksToday.filter(t => t.completed);
    const hwToday = st.homework.filter(h => !h.completed && h.deadline === today);
    const hwSoon = st.homework.filter(h => !h.completed && h.deadline === U.addDaysKey(today, 1));
    const mistakesDue = S.reviewQueue();
    const hunger = (st.settings.dailyGoalMinutes - (daily.studyMin || 0));
    const wg = S.goalStatus("week");
    const mg = S.goalStatus("month");

    root.innerHTML =
      '<div class="page-head">' +
        '<div><div class="page-title">بصمة اليوم</div><div class="page-sub">' + U.fmtDate(today, { dayName: true, year: true }) + ' — ' + (ts.tasksLeft ? ts.tasksLeft + " مهام متبقية" : "لا مهام باقية") + '</div></div>' +
        '<div class="head-actions"><button class="btn primary sm" data-go="session">' + I.get("sessions", 16) + 'جلسة مذاكرة</button>' +
        '<button class="btn emerald sm" data-go="focus">' + I.get("focus", 16) + 'ابدأ Focus</button></div>' +
      '</div>' +

      '<div class="hero glass-2">' +
        '<div>' +
          '<div class="chip" style="margin-bottom:10px">' + I.get("sun", 13) + ' ' + U.greeting() + (st.user.name ? "، " + U.esc(st.user.name) : "") + '</div>' +
          '<h1>' + (ts.tasksLeft ? "جاهز لإنجاز " + ts.tasksLeft + (ts.tasksLeft === 1 ? " مهمة" : " مهام") + "؟" : "أنجزت كل مهام اليوم. عظيم!") + '</h1>' +
          (ts.tasksLeft
            ? '<p class="hero-sub">هدفك اليوم ' + U.fmtDur(ts.goalTotal) + ' — أنجزت ' + U.fmtDur(ts.goalMin) + ' حتى الآن' + (hunger > 0 ? "، باقي " + U.fmtDur(hunger) : "") + '.</p>'
            : '<p class="hero-sub">هدفك اليوم ' + U.fmtDur(ts.goalTotal) + ' — أنجزت ' + U.fmtDur(ts.goalMin) + '. خذ استراحة تستحقها.</p>') +
          '<div class="hero-stats">' +
            '<div class="hero-stat"><b>' + U.fmtDur(ts.goalMin) + '</b><span>المنجز</span></div>' +
            '<div class="hero-stat"><b>' + U.fmtDur(Math.max(0, hunger)) + '</b><span>المتبقي</span></div>' +
            '<div class="hero-stat"><b>' + ts.goalPct + '%</b><span>الإنجاز</span></div>' +
          '</div>' +
          '<div class="hero-cta">' +
            '<button class="btn primary" data-go="session">' + I.get("play", 16) + 'ابدأ جلسة مذاكرة</button>' +
            '<button class="btn emerald" data-go="focus">' + I.get("focus", 16) + 'ابدأ Focus</button>' +
            '<button class="btn glass" data-go="todo">' + I.get("tasks", 16) + 'عرض المهام</button>' +
          '</div>' +
        '</div>' +
        '<div class="hero-ring">' +
          '<div class="ring-wrap" id="goal-ring">' + UI.ring(70, 11, ts.goalPct) + UI.ringCenter(ts.goalPct + "%", "هدف اليوم") + '</div>' +
          '<div class="goal-week">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
              '<span class="small" style="color:var(--text-2);font-weight:700">أسبوعك <span class="num">' + wg.pct + '%</span></span>' +
              (wg.behind ? '<span class="badge red">' + I.get("zap", 10) + 'متأخر عن هدف أسبوعك</span>' : '') +
            '</div>' +
            UI.bar(wg.pct, { thin: true, gold: true }) +
            '<span class="small muted num" style="display:block;text-align:left">' + U.fmtDur(wg.done) + ' / ' + U.fmtDur(wg.goal) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dash-grid">' +
        '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
          nbaCard(nba) +
          '<div class="card glass-1">' +
            '<div class="card-title">' + I.get("target", 17) + 'مهمة اليوم <span class="ct-sub">' + doneToday.length + '/' + tasksToday.length + ' أنجزت</span></div>' +
            (tasksToday.length ? tasksToday.slice(0, 8).map(taskRow).join("") : missionEmpty(st)) +
          '</div>' +
          '<div class="grid cols-2">' + quickTimerCard(st, ts) + scheduleCard(st, ts) + '</div>' +
          '<div class="card glass-1">' +
            '<div class="card-title">' + I.get("analytics", 17) + 'نظرة تحليلية سريعة</div>' +
            miniWeekChart(st) +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
              '<span class="badge neutral">' + I.get("flame", 12) + ' سلسلة: ' + streak + ' يوم</span>' +
              '<span class="badge gold">' + I.get("xp", 12) + ' ' + levelInfo(level) + '</span>' +
              '<span class="badge emerald">' + I.get("achievements", 12) + ' ' + Object.keys(st.unlocked).length + '/' + D.defs.length + ' إنجازات</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
          '<div class="grid cols-2" style="gap:12px">' +
            UI.statCard("clock", U.fmtDur(daily.studyMin || 0), "وقت الدراسة اليوم", "gold") +
            UI.statCard("sessions", (daily.sessions || 0), "جلسات اليوم") +
            UI.statCard("tasks", doneToday.length + "/" + tasksToday.length, "مهام أنجزت") +
            UI.statCard("homework", hwToday.length ? hwToday.length + " اليوم" : (hwSoon.length ? "غدًا" : "لا شيء"), "واجبات قادمة") +
            UI.statCard("flame", streak, "Streak") +
            UI.statCard("xp", U.fmtNum(st.xp), "XP · المستوى " + level.level, "gold") +
            UI.statCard("calendar", wg.pct + "%", "هدف الأسبوع") +
            UI.statCard("target", mg.pct + "%", "هدف الشهر") +
          '</div>' +
          yesterdaySummary(st) +
          streakCalendar(st) +
          subjectsSnap(st) +
          activityCard(st) +
          achievementsSnap(st) +
        '</div>' +
      '</div>';

    bind(root);
    taskRowBind(root);
  }, { rerender: true, title: "لوحة التحكم" });

  UI.ringCenter = function (big, small){ return '<div class="ring-center"><b class="num">' + big + '</b><span>' + small + '</span></div>'; };

  function levelInfo(lv){ return "المستوى " + lv.level + " · " + U.fmtNum(lv.have) + "/" + U.fmtNum(lv.need) + " XP"; }

  function nbaCard(nba){
    return '<div class="nba-card glass-2">' +
      '<div class="nba-tag">' + I.get("zap", 13) + 'أفضل خطوة تالية · Next Best Action</div>' +
      '<div class="nba-title">' + I.get(nba.icon, 19) + ' ' + U.esc(nba.title) + '</div>' +
      '<div class="nba-reason">' + U.esc(nba.body) + '<br><span class="muted" style="font-size:11px">سبب الاقتراح: ' + U.esc(nba.reason) + '</span></div>' +
      (nba.btn && nba.btn.length ? '<div class="nba-cta">' + nba.btn.map(b => '<button class="btn primary sm" data-go="' + (nba.route || "dashboard") + '">' + U.esc(b) + '</button>').join("") + '</div>' : '') +
    '</div>';
  }

  function taskRow(t){
    return '<div class="mission-item ' + (t.completed ? "done" : "") + '" data-task="' + t.id + '">' +
      '<button class="check-mark ' + (t.completed ? "on" : "") + '" data-act="toggle" data-id="' + t.id + '" aria-label="إكمال المهمة">' + I.get("check", 16) + '</button>' +
      '<div class="mi-txt">' + U.esc(t.title) + (t.desc ? '<span class="mi-sub">' + U.esc(t.desc) + '</span>' : '') + '</div>' +
      '<span class="mi-subj" style="color:' + D.subjectById(t.subject).accent + '">' + D.subjectById(t.subject).name + '</span>' +
    '</div>';
  }

  function missionEmpty(st){
    const today = U.todayKey();
    const ov = st.tasks.filter(t => !t.completed && t.date < today).length;
    const err = S.reviewQueue().length;
    let html = '<div class="mission-item"><div class="mi-txt muted">' + (ov ? "لديك " + ov + " مهام متأخرة بانتظارك." : 'يوم هادئ — أضف أول مهمة.') + '</div>' +
      '<button class="btn primary sm" data-go="todo">' + I.get("plus", 14) + 'إضافة مهمة</button></div>';
    if (err) html += '<div class="mission-item"><div class="mi-txt muted">بنك الأخطاء يضم ' + err + ' أخطاء تحتاج مراجعة</div>' +
      '<button class="btn emerald sm" data-go="errors">مراجعة الآن</button></div>';
    return html;
  }

  function quickTimerCard(st, ts){
    return '<div class="card glass-1 qt-card">' +
      '<div class="card-title">' + I.get("timer", 17) + 'مؤقت سريع <span class="ct-sub">Pomodoro</span></div>' +
      '<div class="timer-clock" id="qt-clock" style="font-size:46px;margin:6px 0 2px;text-align:center">00:25:00</div>' +
      '<div style="text-align:center;font-size:11px;color:var(--text-3);font-weight:700" id="qt-label">جلسة بومودورو</div>' +
      '<div style="display:flex;justify-content:center;gap:8px;margin-top:12px">' +
        '<button class="btn primary sm" id="qt-play">' + I.get("play", 15) + 'ابدأ</button>' +
        '<button class="btn glass sm" id="qt-reset">' + I.get("reset", 15) + 'تصفير</button>' +
      '</div>' +
    '</div>';
  }

  function yesterdaySummary(st){
    const sm = S.dailySummary(U.yesterdayKey());
    const rows = [];
    if (sm.studyMin) rows.push({ ic: "clock", v: U.fmtDur(sm.studyMin), l: "دراسة" });
    if (sm.sessions) rows.push({ ic: "sessions", v: sm.sessions, l: "جلسات" });
    if (sm.exams) rows.push({ ic: "achievements", v: sm.exams, l: "امتحانات" });
    if (sm.reviews) rows.push({ ic: "errors", v: sm.reviews, l: "مراجعات أخطاء" });
    if (sm.tasksDone) rows.push({ ic: "tasks", v: sm.tasksDone, l: "مهام" });
    if (sm.hwDone) rows.push({ ic: "homework", v: sm.hwDone, l: "واجبات" });
    const later = [];
    if (sm.hwTomorrow) later.push(sm.hwTomorrow + " واجبات");
    if (sm.dueReviewsTomorrow) later.push("مراجعة " + sm.dueReviewsTomorrow + " أخطاء");

    return '<div class="card glass-1 day-sum-card">' +
      '<div class="card-title">' + I.get("analytics", 17) + 'خلاصة يوم أمس <span class="ct-sub">Yesterday</span>' +
        (rows.length ? '<span class="badge neutral" style="float:left">' + U.fmtDate(U.yesterdayKey(), { short: true }) + '</span>' : '') + '</div>' +
      (rows.length
        ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">' + rows.map(r =>
            '<span class="badge glass">' + I.get(r.ic, 12) + ' ' + r.v + ' ' + r.l + '</span>').join("") + '</div>' +
          (later.length ? '<div class="muted small" style="margin-top:10px">' + I.get("book", 12) + ' القادم: ' + later.join(" · ") + '</div>' : '')
        : '<div class="day-summary muted small" style="margin-top:10px">' + I.get("clock", 13) + ' أمس هادئ تمامًا — ابدأ يومًا جديدًا قويًا.</div>') +
    '</div>';
  }

  function scheduleCard(st){
    const today = U.todayKey();
    const withTime = st.tasks.filter(t => t.date === today && t.time).sort((a,b) => a.time.localeCompare(b.time));
    const noTime = st.tasks.filter(t => t.date === today && !t.time);
    let html = '<div class="card glass-1">' +
      '<div class="card-title">' + I.get("calendar", 17) + 'جدول اليوم <span class="ct-sub">Schedule</span></div>';
    if (!withTime.length && !noTime.length){
      html += '<p class="muted small">لا توجد مهام مجدولة اليوم. أضف مهمة وحدد وقتها.</p>';
    } else {
      html += '<div class="timeline">';
      withTime.forEach(t => {
        html += '<div class="tl-item"><div class="tl-time">' + t.time + '</div><div class="tl-name">' + U.esc(t.title) +
          '<span style="font-size:10px;color:var(--text-3)"> — ' + D.subjectById(t.subject).name + '</span></div></div>';
      });
      noTime.slice(0, 4).forEach(t => {
        html += '<div class="tl-item focus"><div class="tl-time" style="color:var(--em-3)">بدون وقت</div><div class="tl-name">' + U.esc(t.title) + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function miniWeekChart(st){
    const days = [];
    for (let i = 6; i >= 0; i--){
      const d = U.addDaysKey(U.todayKey(), -i);
      days.push({ d, min: (st.daily[d] || {}).studyMin || 0 });
    }
    const max = Math.max(1, ...days.map(x => x.min));
    const weekMin = days.reduce((a, x) => a + x.min, 0);
    return '<div>' +
      '<div class="bars" style="height:110px">' +
      days.map(x => {
        const h = Math.round(x.min / max * 100);
        return '<div class="bar-col"><div class="bar-holder"><div class="bar-fill' + (x.d === U.todayKey() ? " highlight" : "") + '" data-h="' + h + '" style="height:' + h + '%"></div></div><div class="bar-label">' + U.DAYS_ABBR[U.fromKey(x.d).getDay()] + '</div></div>';
      }).join("") +
      '</div>' +
      '<div class="muted small" style="margin-top:8px">' + U.fmtDur(weekMin) + ' هذا الأسبوع' + (max > 0 ? ' — أفضل يوم: ' + U.fmtDur(max) + '.' : '') + '</div>' +
    '</div>';
  }

  function streakCalendar(st){
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const first = new Date(y, mo, 1);
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const startPad = (first.getDay() + 6) % 7; // أسبوع يبدأ الإثنين
    const todayK = U.todayKey();
    const minMap = {};
    (st.blocks || []).forEach(b => { if (b && b.minutes) minMap[b.date] = (minMap[b.date] || 0) + (b.minutes || 0); });
    const dows = ["ح","ن","ث","ر","خ","ج","س"];
    let cells = dows.map(d => '<div class="sc-dow">' + d + "</div>").join("");
    for (let i = 0; i < startPad; i++) cells += '<div class="sc-day day-blank"></div>';
    for (let d = 1; d <= daysInMonth; d++){
      const k = U.dateKey(new Date(y, mo, d));
      const min = minMap[k] || 0;
      const lvl = min >= 180 ? 4 : min >= 90 ? 3 : min >= 30 ? 2 : min > 0 ? 1 : 0;
      const cls = "sc-day" + (lvl ? " l" + lvl : "") + (k === todayK ? " today" : "") + (k > todayK ? " future" : "");
      cells += '<div class="' + cls + '" title="' + k + (min ? " — " + U.fmtDur(min) : "") + '"></div>';
    }
    return '<div class="card glass-1">' +
      '<div class="card-title">' + I.get("flame", 17) + 'سلسلتك هذا الشهر <span class="ct-sub">' + U.fmtDate(todayK) + "</span></div>" +
      '<div class="streak-cal">' + cells + "</div>" +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--text-3);flex-wrap:wrap;gap:4px">' +
        '<span>' + I.get("flame", 12) + "السلسلة: " + D.streakOf(st) + " يوم</span>" +
        "<span>أطول سلسلة: " + D.longestStreakOf(st) + "</span>" +
        "<span>أقل ← أكثر</span>" +
      "</div>" +
    "</div>";
  }

  function subjectsSnap(st){
    const list = D.subjects.filter(s => s.id !== "general");
    const sp = S.subjectProgress(st);
    return '<div class="card glass-1">' +
      '<div class="card-title">' + I.get("book", 17) + 'المواد <span class="ct-sub" style="cursor:pointer" data-go="subjects">عرض الكل ←</span></div>' +
      list.map(s => {
        const d = sp[s.id] || { done: 0, goal: 0, pct: 0 };
        const reached = d.goal > 0 && d.done >= d.goal;
        return '<div class="mission-item" style="cursor:pointer" data-subj="' + s.id + '">' +
          '<div class="subj-ic" style="width:36px;height:36px;font-size:17px;margin:0;color:' + s.accent + ';border-color:color-mix(in srgb,' + s.accent + ' 30%, transparent)">' + I.subj(s, 17) + '</div>' +
          '<div class="mi-txt" style="width:100%"><div style="display:flex;justify-content:space-between"><b style="font-size:13px">' + s.name + '</b><span class="small muted num" style="direction:ltr">' + U.fmtDur(d.done) + (d.goal ? " / " + (d.goal / 60) + "س" : "") + (reached ? ' <span class="badge emerald">' + I.get("check", 10) + 'حقّقت هدفه</span>' : "") + '</span></div><div style="margin-top:5px">' + UI.bar(d.pct, reached ? { gold: true } : {}) + '</div></div>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  function activityCard(st){
    const today = U.todayKey();
    const log = S.studyTimeline(st, today);
    return '<div class="card glass-1">' +
      '<div class="card-title">' + I.get("clock", 17) + 'سجل نشاط اليوم <span class="ct-sub">Timeline</span></div>' +
      (log.length ? log.map(a =>
        '<div class="activity-item"><span class="act-time num" style="flex:none;min-width:42px">' + a.timeLabel + '</span>' +
        '<div class="act-ic">' + I.get(a.icon, 15) + '</div>' +
        '<div class="act-txt">' + U.esc(a.txt) + '</div></div>').join("")
        : '<p class="muted small">سجّل جلسة أو أنهِ مهمة ليظهر نشاطك الزمني هنا.</p>') +
    '</div>';
  }

  function achievementsSnap(st){
    const unlocked = Object.keys(st.unlocked);
    const recent = unlocked.slice(-6).reverse();
    return '<div class="card glass-1">' +
      '<div class="card-title">' + I.get("achievements", 17) + 'الإنجازات <span class="ct-sub" style="cursor:pointer" data-go="achievements">' + unlocked.length + ' مفتوح — عرض ←</span></div>' +
      (recent.length ?
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' + recent.map(id => {
          const da = D.defs.find(x => x.id === id);
          return da ? '<span class="chip" data-tooltip="' + U.esc(da.name) + '">' + I.get(da.icon, 13) + ' ' + da.name + '</span>' : '';
        }).join("") + '</div>'
        : '<p class="muted small">أنجز مهامك لتفتح أول وسام.</p>') +
    '</div>';
  }

  function bind(root){
    root.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", e => {
      const go = e.currentTarget.dataset.go;
      if (go === "session"){ UI.startSessionFlow && UI.startSessionFlow(); }
      else if (go === "focus"){ App.Router.go("timer", { launch: "focus" }); }
      else if (go === "todo"){ App.Router.go("todo"); }
      else App.Router.go(go);
    }));
    root.querySelectorAll("[data-subj]").forEach(b => b.addEventListener("click", () => openSubjectModal(b.dataset.subj)));
    document.getElementById("qt-play").addEventListener("click", toggleQuickTimer);
    document.getElementById("qt-reset").addEventListener("click", () => { App.Timer.cancel(); UI.toast("تم تصفير المؤقت."); });
  }
  function toggleQuickTimer(){
    const t = App.Timer;
    if (!t.active()){
t.launch({ type: "custom", clock: "countdown", minutes: 25, subject: D.defSubject(), context:
      "dashboard" });
      refreshQt();
      return;
    }
    if (t.isRunning()){ t.pause(); refreshQt(); }
    else { t.resume && t.resume(); refreshQt(); }
  }
  function refreshQt(){
    const snap = App.Timer.snapshot();
    const clock = document.getElementById("qt-clock");
    const label = document.getElementById("qt-label");
    if (clock) clock.textContent = snap.active ? snap.display : "00:25:00";
    if (label){
      label.innerHTML = snap.active
        ? (snap.type === "pomodoro" ? "Pomodoro · " + (snap.phase === "break" ? "راحة" : "دراسة") : snap.displayLong + " جارية")
        : "جلسة بومودورو · 25 دقيقة";
    }
  }
  function taskRowBind(root){
    root.querySelectorAll("[data-act='toggle']").forEach(b => {
      b.addEventListener("click", () => { S.toggleTask(b.dataset.id); });
    });
  }

  /* ════════════════════ TO-DO ════════════════════ */
  const TODO_TITLES = {};
  App.Views.register("todo", function (root, ctx){
    const st = S.getState();
    const today = U.todayKey();
    let sel = ctx.date && /^\d{4}-\d{2}-\d{2}$/.test(ctx.date) ? ctx.date : today;
    root.innerHTML = renderTodo(st, sel);
    bindTodo(root, st, sel);
  }, { rerender: true, title: "المهام" });

  function renderTodo(st, sel){
    const today = U.todayKey();
    const tasks = st.tasks.filter(t => t.date === sel);
    const done = tasks.filter(t => t.completed).sort((a,b) => (a.completedAt || "").localeCompare(b.completedAt || "")).reverse();
    const pending = tasks.filter(t => !t.completed).sort((a,b) => prioSort(a,b));
    const overdueAll = (sel === today) ? st.tasks.filter(t => !t.completed && t.date < today).sort((a,b) => a.date.localeCompare(b.date)) : null;
    const daily = st.daily[sel] || {};
    const completedTotal = st.tasks.filter(t => t.completed && t.completedOn === sel).length;
    const dayTitle = U.relativeDay(sel) + (sel !== today ? " — " + U.fmtDate(sel, { year: sel.split("-")[0] !== today.split("-")[0] }) : "");

    const sections = [];
    if (overdueAll && overdueAll.length){
      sections.push({ title: "مهام متأخرة لم تُنجز", cls: "overdue-sc", note: "لم تُنجز هذه المهام.", rows: overdueAll.map(t => taskCard(t, { overdue: true })) });
    }
    sections.push({ title: sel === today ? "مهام اليوم" : "مهام " + U.fmtDate(sel, { short: true }), cls: "", note: pending.length ? pending.length + " متبقية" : "", rows: pending.map(t => taskCard(t, {})) });
    if (done.length) sections.push({ title: "المكتملة", cls: "done-sc", note: done.length + " منجزة", rows: done.map(t => taskCard(t, { done: true })) });

    return '' +
      '<div class="page-head">' +
        '<div><div class="page-title">مهامك</div><div class="page-sub">خطّط ليومك وارجع لماضيك — كل يوم له سجله الخاص.</div></div>' +
        '<div class="head-actions">' +
          '<button class="btn primary sm" data-todo="add">' + I.get("plus", 15) + 'إضافة مهمة</button>' +
        '</div>' +
      '</div>' +

      '<div class="grid todo-top">' +
        '<div class="daynav glass-1">' +
          '<button data-todo="prev" aria-label="الأمس">' + I.get("chevron_right", 18) + '</button>' +
          '<div class="dn-center">' + ((sel === today) ? "اليوم" : (U.isToday(sel) ? "اليوم" : U.fmtDate(sel, { dayName: (U.daysBetween(today, sel) <= 1 && U.daysBetween(today, sel) >= -1) }))) + '<small>' + (sel === today ? U.fmtDate(today, { year: true }) : U.fmtDate(sel, { dayName: true, year: true })) + '</small></div>' +
          '<button data-todo="next" aria-label="غدًا">' + I.get("chevron_left", 18) + '</button>' +
          '<button class="btn-pick-day" data-todo="pick" title="اختيار تاريخ">' + I.get("calendar2", 17) + '</button>' +
        '</div>' +
        '<div class="day-summary card glass-1" style="padding:14px">' +
          '<div class="day-sum-card"><b>' + U.fmtDur(daily.studyMin || 0) + '</b><span>وقت الدراسة</span></div>' +
          '<div class="day-sum-card"><b>' + (daily.sessions || 0) + '</b><span>الجلسات</span></div>' +
          '<div class="day-sum-card"><b>' + completedTotal + '/' + tasks.length + '</b><span>المهام</span></div>' +
          '<div class="day-sum-card"><b>' + (daily.homeworkCompleted || 0) + '</b><span>واجبات</span></div>' +
          '<div class="day-sum-card"><b>' + (tasks.length ? Math.round(completedTotal / tasks.length * 100) : 100) + '%</b><span>إنجاز</span></div>' +
        '</div>' +
      '</div>' +

      (overdueAll && overdueAll.length ? reschedBanner(overdueAll.length) : "") +

      sections.map(sec =>
        '<div class="todo-section">' +
          '<div class="todo-sec-head"><h3>' + sec.title + '</h3>' +
          (sec.note ? '<span class="sc">' + sec.note + '</span>' : '') +
          (sec.cls === "overdue-sc" ? '<span class="badge red">' + I.get("errors", 11) + 'لم تُنجز هذه المهمة</span>' : '') +
          '<span class="sepline"></span></div>' +
          (sec.rows.length ? '<div class="todo-list">' + sec.rows.join("") + '</div>'
            : UI.empty("tasks", "لا توجد مهام", "يوم هادئ؟ أضف أول مهمة.")) +
        '</div>'
      ).join("") +

      (sel === today && !st.tasks.filter(t => t.date === today).length ?
        '<button class="btn glass block" data-todo="add">' + I.get("plus", 15) + 'أضِف أول مهمة اليوم</button>' : "");
  }

  function prioSort(a, b){
    const p = { high: 0, mid: 1, low: 2 };
    if ((a.time||"") !== (b.time||"")) return (a.time||"99").localeCompare(b.time||"99");
    return (p[a.priority] || 1) - (p[b.priority] || 1);
  }

  function taskCard(t, o){
    const today = U.todayKey();
    const subj = D.subjectById(t.subject);
    return '<div class="task-item glass-1 ' + (o.done ? "done" : "") + (o.overdue ? " overdue" : "") + '">' +
      '<button class="check-mark task-box ' + (o.done ? "on" : "") + '" data-todo="toggle" data-id="' + t.id + '" aria-label="إكمال">' + I.get("check", 16) + '</button>' +
      '<div class="task-txt">' +
        '<span style="display:flex;gap:8px;align-items:center"><span>' + U.esc(t.title) + '</span>' + (o.overdue ? '<span class="badge red">' + I.get("errors", 10) + 'لم تُنجز</span>' : '') + '</span>' +
        (t.desc ? '<span class="task-desc">' + U.esc(t.desc) + '</span>' : '') +
        '<div class="task-meta">' +
          (t.priority !== "mid" || !t.completed ? UI.prioTag(t.priority) : '') +
          (t.time ? '<span class="task-time">' + I.get("clock", 11) + t.time + '</span>' : '') +
          '<span class="task-time" style="color:' + subj.accent + '">' + I.subj(subj, 11) + ' ' + subj.name + '</span>' +
          t.tags.map(tg => '<span class="task-tag">#' + U.esc(tg) + '</span>').join("") +
        '</div>' +
      '</div>' +
      '<div class="task-actions">' +
        (o.overdue ? '<button title="نقل إلى غدًا" data-todo="resched" data-id="' + t.id + '" data-to="' + U.tomorrowKey() + '" aria-label="نقل إلى غدًا">' + I.get("calendar2", 14) + '</button>' : '') +
        '<button title="تعديل" data-todo="edit" data-id="' + t.id + '" aria-label="تعديل">' + I.get("edit", 14) + '</button>' +
        '<button class="del" title="حذف" data-todo="del" data-id="' + t.id + '" aria-label="حذف">' + I.get("trash", 14) + '</button>' +
      '</div>' +
    '</div>';
  }

  function reschedBanner(n){
    return '<div class="resched-banner">' +
      I.get("calendar", 16) +
      '<span>' + n + (n === 1 ? ' مهمة لم تُنجز.' : ' مهام لم تُنجز.') + ' انقلها ليوم جديد وأكمل المسيرة.</span>' +
      '<span class="rb-act"><button class="btn sm primary" data-todo="resched-all">' + I.get("calendar2", 13) + 'نقل الكل إلى غدًا</button>' +
      '<button class="btn sm ghost" data-todo="pick">اختيار تاريخ</button></span>' +
    '</div>';
  }

  function bindTodo(root, st, sel){
    const today = U.todayKey();
    root.querySelectorAll("[data-todo='toggle']").forEach(b => b.addEventListener("click", () => S.toggleTask(b.dataset.id)));
    root.querySelectorAll("[data-todo='resched']").forEach(b => b.addEventListener("click", () => {
      S.rescheduleTask(b.dataset.id, b.dataset.to);
      UI.toast("نُقلت المهمة إلى غدًا.", "gold", "calendar");
    }));
    root.querySelectorAll("[data-todo='edit']").forEach(b => b.addEventListener("click", () => App.Modals && App.Modals.openTaskModal(b.dataset.id)));
    root.querySelectorAll("[data-todo='del']").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.id;
      UI.dangerConfirm("حذف المهمة", "هل أنت متأكد؟ سيتم حذف المهمة نهائيًا.", "حذف", () => { S.deleteTask(id); UI.toast("حُذفت المهمة.", "gold", "trash"); });
    }));
    root.querySelectorAll("[data-todo='add']").forEach(b => b.addEventListener("click", () => App.Modals && App.Modals.openTaskModal(null, sel)));
    root.querySelectorAll("[data-todo='resched-all']").forEach(b => b.addEventListener("click", () => {
      let n = 0;
      st.tasks.filter(t => !t.completed && t.date < today).forEach(t => { S.rescheduleTask(t.id, U.tomorrowKey()); n++; });
      UI.toast("نُقلت " + n + " مهمة إلى غدًا.", "gold", "calendar");
    }));
    root.querySelector("[data-todo='prev']").addEventListener("click", () => App.Router.go("todo", { date: U.addDaysKey(sel, -1) }));
    root.querySelector("[data-todo='next']").addEventListener("click", () => App.Router.go("todo", { date: U.addDaysKey(sel, 1) }));
    root.querySelector("[data-todo='pick']").addEventListener("click", (e) => {
      openDatePicker(e.currentTarget, sel, k => App.Router.go("todo", { date: k }));
    });
  }

  /* ════════════════════ TIMER ════════════════════ */
  App.Views.register("timer", function (root, ctx){
    const st = S.getState();
    const snap = App.Timer.snapshot();
    const s = st.settings;
    const active = snap.active;
    root.innerHTML = renderTimer(st, s, snap, active, ctx);
    bindTimer(root, st, s, ctx);
  }, { rerender: false, title: "المؤقت" });

  function renderTimer(st, s, snap, active, ctx){
    if (active) return timerLiveCard(st, s, snap);
    return timerConfigCard(st, s);
  }

  function timerLiveCard(st, s, snap){
    const phaseLabel = snap.phase === "break" ? "وقت الراحة" : snap.phase === "longbreak" ? "استراحة طويلة" : snap.type === "focus" ? "Focus" : snap.type === "pomodoro" ? "Pomodoro" : "مؤقت مخصص";
    return '' +
      '<div class="page-head"><div><div class="page-title">المؤقت — Study Timer</div>' +
      '<div class="page-sub">عدّ تنازلي، توقيت، استراحات منظمة، ووضع تركيز كامل.</div></div>' +
      '<div class="head-actions">' +
        '<span class="chip" style="color:var(--em-3)">' + I.get("timer", 13) + ' جلسة جارية…</span>' +
      '</div></div>' +
      '<div class="uni-t card glass-1">' +
        '<div class="t-head"><span class="t-head-ic">' + I.get("timer", 17) + '</span>وضع المؤقت' +
          '<span class="t-head-tip">' + phaseLabel + (snap.title ? ' — ' + snap.title : '') + '</span></div>' +
        '<div class="timer-stage">' +
          '<div class="timer-clock num" id="timer-clock">' + snap.display + '</div>' +
          '<div class="timer-typelabel ' + (snap.phase === "break" || snap.phase === "longbreak" ? "phase-break" : "") + '" id="timer-typelabel">' +
            I.get(snap.type === "focus" ? "focus" : snap.type === "pomodoro" ? "play" : "timer", 15) + ' ' + phaseLabel +
          '</div>' +
          (snap.type === "pomodoro" ? '<div class="timer-cycles" id="timer-cycles">' + snap.dots.map(on => '<i class="' + (on ? "on" : "") + '"></i>').join("") + '</div>' : '') +
          '<div class="timer-controls">' +
            '<button class="btn primary" id="timer-play">' + (App.Timer.isRunning() ? I.get("pause", 17) + 'إيقاف مؤقت' : I.get("play", 17) + 'متابعة') + '</button>' +
            '<button class="btn emerald" id="timer-finish">' + I.get("check", 17) + 'إنهاء الجلسة</button>' +
            '<button class="btn danger" id="timer-cancel">' + I.get("close", 17) + 'إلغاء</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function timerConfigCard(st, s){
    return '' +
      '<div class="page-head"><div><div class="page-title">المؤقت — Study Timer</div>' +
      '<div class="page-sub">اختر الوضع، حدّد المدة، ثم ابدأ — الكل في بطاقة واحدة.</div></div></div>' +

      '<div class="uni-t card glass-1">' +
        '<div class="t-head"><span class="t-head-ic">' + I.get("timer", 17) + '</span>وضع المؤقت' +
          '<span class="t-head-tip">اختر الوضع للمتابعة</span></div>' +

        '<div class="t-modes">' +
          '<button type="button" class="t-mode active" data-tmode="custom">' + I.get("timer", 15) + 'المؤقت العادي</button>' +
          '<button type="button" class="t-mode" data-tmode="pomodoro">' + I.get("play", 15) + 'بومودورو</button>' +
          '<button type="button" class="t-mode" data-tmode="focus">' + I.get("focus", 15) + 'التركيز</button>' +
        '</div>' +

        '<div class="t-panels">' +
          timerPanel("custom", customConfig(s)) +
          timerPanel("pomodoro", pomodoroConfig(s), true) +
          timerPanel("focus", focusConfig(s), true) +
        '</div>' +
      '</div>';
  }

  function timerPanel(id, inner, hidden){
    return '<div class="t-panel" data-tpanel="' + id + '"' + (hidden ? " hidden" : "") + '>' + inner + '</div>';
  }

  function customDurField(){
    return '<div class="c-dur" hidden>' +
      '<div class="c-field"><label>الساعات</label><input type="number" class="input" data-ck="h" min="0" max="23" value="0"></div>' +
      '<div class="c-field"><label>الدقائق</label><input type="number" class="input" data-ck="m" min="0" max="59" value="25"></div>' +
      '<div class="c-field"><label>الثواني</label><input type="number" class="input" data-ck="s" min="0" max="59" value="0"></div>' +
    '</div>';
  }

  function customConfig(s){
    return '' +
      '<div class="t-sec"><label class="t-label">اختيار المدة</label>' +
        '<div class="t-preset" data-pg="dur">' +
          [15, 25, 30, 45, 60].map(v => '<span class="chip' + (v === 25 ? " active" : "") + '" data-dur="' + v + '">' + v + ' د</span>').join("") +
          '<span class="chip" data-ccustom>كاستم</span>' +
        '</div>' +
        customDurField() +
      '</div>' +
      '<div class="t-sec"><label class="t-label">المادة</label>' + subjSelect("custom") + '</div>' +
      '<div class="t-sec"><label class="t-label">عنوان اختياري</label><input class="input" data-launch-field="title" placeholder="مثال: مراجعة الفصل الثالث"></div>' +
      '<button type="button" class="btn primary block" data-launch="custom">' + I.get("play", 16) + 'ابدأ المؤقت</button>';
  }

  function pomodoroConfig(s){
    const study = s.pomodoroStudy, br = s.pomodoroBreak;
    return '' +
      '<div class="t-sec"><label class="t-label">مدة التركيز</label>' +
        '<div class="t-preset" data-pg="study">' +
          [15, 25, 30, 45, 50].map(v => '<span class="chip' + (v === study ? " active" : "") + '" data-study="' + v + '">' + v + ' دقيقة</span>').join("") +
        '</div></div>' +
      '<div class="t-sec"><label class="t-label">مدة الاستراحة</label>' +
        '<div class="t-preset" data-pg="br">' +
          [5, 10, 15, 20, 30].map(v => '<span class="chip' + (v === br ? " active" : "") + '" data-br="' + v + '">' + v + ' دقائق</span>').join("") +
        '</div></div>' +
      '<div class="t-sec"><label class="t-label">المادة</label>' + subjSelect("pomo") + '</div>' +
      '<div class="t-sec"><label class="t-label">عنوان اختياري</label><input class="input" data-launch-field="title" placeholder="مثال: جولة رياضيات"></div>' +
      '<button type="button" class="btn emerald block" data-launch="pomodoro">' + I.get("play", 16) + 'ابدأ بومودورو</button>';
  }

  function focusConfig(s){
    const dur = s.focusDuration;
    return '' +
      '<div class="t-sec"><label class="t-label">مدة الجلسة</label>' +
        '<div class="t-preset" data-pg="fdur">' +
          [15, 25, 30, 45, 60].map(v => '<span class="chip' + (v === dur ? " active" : "") + '" data-fdur="' + v + '">' + v + ' د</span>').join("") +
          '<span class="chip" data-fcustom>كاستم</span>' +
        '</div>' +
        customDurField() +
      '</div>' +
      '<div class="t-sec"><label class="t-label">المادة</label>' + subjSelect("focus") + '</div>' +
      '<div class="t-sec"><label class="t-label">عنوان اختياري</label><input class="input" data-launch-field="title" placeholder="مثال: إنجاز مشروع البرمجة"></div>' +
      '<button type="button" class="btn emerald block" data-launch="focus">' + I.get("focus", 16) + 'ابدأ جلسة التركيز</button>';
  }

  function subjSelect(id, extraClass){
    return '<select class="input ' + (extraClass || "") + '" data-launch-field="subject">' +
      D.subjects.map(x => '<option value="' + x.id + '">' + x.name + '</option>').join("") + '</select>';
  }

  function bindTimer(root, st, s, ctx){
    const get = name => document.getElementById(name);

    const modeBtns = root.querySelectorAll(".t-mode");
    const panels = root.querySelectorAll(".t-panel");
    const showMode = mode => {
      modeBtns.forEach(m => m.classList.toggle("active", m.dataset.tmode === mode));
      panels.forEach(p => {
        const on = p.dataset.tpanel === mode;
        if (on){
          p.hidden = false;
          p.classList.remove("in");
          void p.offsetWidth;
          p.classList.add("in");
        } else p.hidden = true;
      });
    };
    modeBtns.forEach(m => m.addEventListener("click", () => showMode(m.dataset.tmode)));

    function revealCustom(panel){
      const cd = panel.querySelector(".c-dur");
      if (!cd) return;
      cd.hidden = false;
      cd.classList.remove("in");
      void cd.offsetWidth;
      cd.classList.add("in");
      panel.dataset.dur = "";
    }
    function hideCustom(panel){
      const cd = panel.querySelector(".c-dur");
      if (cd) cd.hidden = true;
    }

    root.querySelectorAll("[data-pg]").forEach(grp => {
      grp.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
        grp.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        const panel = c.closest(".t-panel");
        if (c.dataset.study != null) S.updateSettings({ pomodoroStudy: +c.dataset.study });
        else if (c.dataset.br != null) S.updateSettings({ pomodoroBreak: +c.dataset.br });
        else if (c.dataset.fdur != null){ panel.dataset.dur = c.dataset.fdur; hideCustom(panel); }
        else if (c.dataset.dur != null){ panel.dataset.dur = c.dataset.dur; hideCustom(panel); }
        else if (c.dataset.ccustom != null || c.dataset.fcustom != null) revealCustom(panel);
      }));
    });

    function launch(mode, btn){
      const panel = (btn && btn.closest) ? (btn.closest(".t-panel") || root) : root;
      const field = nm => {
        const el = panel.querySelector("[data-launch-field='" + nm + "']");
        return el || null;
      };
      const subject = () => { const f = field("subject"); return f && f.value ? f.value : D.defSubject(); };
      const title = () => { const f = field("title"); return f ? f.value : ""; };
      const customDur = () => {
        const cd = panel.querySelector(".c-dur");
        if (!cd || cd.hidden) return 0;
        const g = k => { const i = panel.querySelector("[data-ck='" + k + "']"); return i ? (parseInt(i.value, 10) || 0) : 0; };
        return g("h") * 60 + g("m") + Math.round(g("s") / 60 * 100) / 100;
      };

      if (mode === "custom"){
        const preset = parseInt(panel.dataset.dur, 10) || 0;
        const minutes = Math.max(1, customDur() || preset || 25);
        App.Timer.launch({ type: "custom", clock: "countdown", minutes, subject: subject(), title: title(), context: "page" });
        UI.toast("بدأ مؤقت مخصص — ركّز!", "gold", "play");
      } else if (mode === "pomodoro"){
        const studyC = panel.querySelector(".t-preset .chip.active[data-study]");
        const brC = panel.querySelector(".t-preset .chip.active[data-br]");
        const study = studyC ? +studyC.dataset.study : s.pomodoroStudy;
        const br = brC ? +brC.dataset.br : s.pomodoroBreak;
        App.Timer.launch({
          type: "pomodoro", subject: subject(), title: title(),
          studyMin: study, breakMin: br, longMin: s.pomodoroLong, sessions: s.pomodoroSessions,
          context: "page"
        });
        UI.toast("بعد " + study + " دقيقة دراسة تأتيك راحة " + br + " دقائق.", "gold", "timer");
      } else if (mode === "focus"){
        const preset = parseInt(panel.dataset.dur, 10) || 0;
        const minutes = Math.max(1, customDur() || preset || s.focusDuration);
        S.updateSettings({ focusDuration: Math.round(minutes) });
        App.Timer.launch({ type: "focus", minutes, subject: subject(), title: title(), context: "page" });
        UI.toast("بدأت جلسة Focus — ركّز بعمق.", "gold", "focus");
        App.Router.enterTheatre && App.Router.enterTheatre();
      }
      App.Router.rerender();
    }

    root.querySelectorAll("[data-launch]").forEach(b => b.addEventListener("click", () => launch(b.dataset.launch, b)));

    const play = get("timer-play"), finish = get("timer-finish"), cancel = get("timer-cancel");
    if (play) play.addEventListener("click", () => {
      if (App.Timer.isRunning()){ App.Timer.pause(); }
      else App.Timer.resume();
      refreshTimerUI();
    });
    if (finish) finish.addEventListener("click", () => {
      const done = App.Timer.finish(false);
      if (done && done.minutes) UI.toast("سُجّلت " + U.fmtDur(done.minutes) + " في " + D.subjName(done.subject) + ".", "success", "check");
      App.Router.rerender();
    });
    if (cancel) cancel.addEventListener("click", () => {
      App.Timer.cancel();
      UI.toast("أُلغيت الجلسة دون تسجيل.", "gold", "info");
      App.Router.rerender();
    });
  }

  function refreshTimerUI(){
    const route = (location.hash || "#/dashboard").replace("#/", "").split("/")[0];
    if (route !== "timer") return;
    const snap = App.Timer.snapshot();
    const clock = document.getElementById("timer-clock");
    const typelabel = document.getElementById("timer-typelabel");
    const cycles = document.getElementById("timer-cycles");
    if (clock) clock.textContent = snap.active ? snap.display : "00:00";
    if (typelabel){
      const phaseLabel = snap.phase === "break" ? "وقت الراحة" : snap.phase === "longbreak" ? "استراحة طويلة" : snap.type === "focus" ? "Focus" : snap.type === "pomodoro" ? "Pomodoro" : "مؤقت مخصص";
      typelabel.innerHTML = snap.active ? App.Icons.get(snap.type === "focus" ? "focus" : snap.type === "pomodoro" ? "play" : "timer", 15) + ' ' + phaseLabel : App.Icons.get("info", 15) + ' لم يبدأ أي مؤقت بعد';
      typelabel.classList.toggle("phase-break", snap.phase === "break" || snap.phase === "longbreak");
    }
    if (cycles && snap.type === "pomodoro") cycles.innerHTML = snap.dots.map(on => '<i class="' + (on ? "on" : "") + '"></i>').join("");
    const play = document.getElementById("timer-play");
    if (play) play.innerHTML = App.Timer.isRunning()
      ? App.Icons.get("pause", 17) + 'إيقاف مؤقت'
      : App.Icons.get("play", 17) + 'متابعة';
  }

  /* ════════════════════ SUBJECTS ════════════════════ */
  App.Views.register("subjects", function (root){
    const st = S.getState();
    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">المواد</div><div class="page-sub">كل مادة مركز لكل بياناتها: وقت، مهام، واجبات، ملاحظات، أخطاء، جلسات.</div></div></div>' +
      '<div class="grid cols-2">' +
      D.subjects.map(s => {
        const mins = st.blocks.filter(b => b.subject === s.id).reduce((a, b) => a + b.minutes, 0);
        const tasks = st.tasks.filter(t => t.subject === s.id);
        const tasksDone = tasks.filter(t => t.completed).length;
        const hw = st.homework.filter(h => h.subject === s.id);
        const errs = st.mistakes.filter(m => m.subject === s.id);
        const last = st.blocks.filter(b => b.subject === s.id).sort((a,b) => b.ts.localeCompare(a.ts))[0];
        const pct = Math.min(100, Math.round(mins / (s.hourGoal * 60) * 100));
        return '<div class="card glass-1 subj-card" data-open-subj="' + s.id + '">' +
          '<div class="subj-ic" style="color:' + s.accent + ';border-color:color-mix(in srgb,' + s.accent + ' 30%, transparent)">' + I.subj(s, 22) + '</div>' +
          '<div class="subj-name">' + s.name + '</div>' +
          '<div class="muted small">الهدف ' + s.hourGoal + ' ساعة</div>' +
          '<div style="margin-top:10px">' + UI.bar(pct) + '</div>' +
          '<div class="subj-meta">' +
            '<span>' + I.get("clock", 12) + '<b>' + U.fmtDur(mins) + '</b></span>' +
            '<span>' + I.get("tasks", 12) + '<b>' + tasksDone + '/' + tasks.length + '</b></span>' +
            '<span>' + I.get("homework", 12) + '<b>' + hw.filter(h => !h.completed).length + '</b></span>' +
            '<span>' + I.get("errors", 12) + '<b>' + errs.length + '</b></span>' +
          '</div>' +
          (last ? '<div class="muted small" style="margin-top:8px">آخر جلسة: ' + U.relativeDay(last.date) + ' — ' + U.fmtDur(last.minutes) + '</div>' : '') +
        '</div>';
      }).join("") +
      '</div>';
    root.querySelectorAll("[data-open-subj]").forEach(b => b.addEventListener("click", () => openSubjectModal(b.dataset.openSubj)));
  }, { rerender: true, title: "المواد" });

  /* ── Subject detail modal ── */
  function openSubjectModal(id){
    const s = D.subjectById(id);
    const st = S.getState();
    const mins = st.blocks.filter(b => b.subject === id).reduce((a, b) => a + b.minutes, 0);
    const tasks = st.tasks.filter(t => t.subject === id);
    const hw = st.homework.filter(h => h.subject === id);
    const notes = st.notes.filter(n => n.subject === id && !n.archived);
    const errs = st.mistakes.filter(m => m.subject === id);
    const blocks = st.blocks.filter(b => b.subject === id).sort((a,b) => b.ts.localeCompare(a.ts));
    const pct = Math.min(100, Math.round(mins / (s.hourGoal * 60) * 100));
    const tabs = ["overview", "tasks", "homework", "notes", "mistakes", "sessions"];
    const tabNames = { overview: "نظرة عامة", tasks: "المهام", homework: "الواجبات", notes: "الملاحظات", mistakes: "بنك الأخطاء", sessions: "الجلسات" };

    const body = '<div class="subj-cover">' +
      '<div class="subj-ic" style="width:56px;height:56px;color:' + s.accent + '">' + I.subj(s, 26) + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:18px;font-weight:900">' + s.name + '</div>' +
        '<div class="muted small" style="margin-bottom:6px">' + U.fmtDur(mins) + ' إجمالًا · الهدف ' + s.hourGoal + ' ساعة</div>' +
        UI.bar(pct) +
      '</div>' +
      '<div class="ring-wrap" style="width:92px;height:92px">' + UI.ring(34, 8, pct) + UI.ringCenter(pct + "%", "تقدم") + '</div>' +
    '</div>' +
    '<div class="detail-stats">' +
      '<div class="pstat"><b data-prefix="وقت الدراسة">' + U.fmtDur(mins) + '</b></div>' +
      '<div class="pstat"><b data-prefix="مهام">' + tasks.filter(t => t.completed).length + '/' + tasks.length + '</b></div>' +
      '<div class="pstat"><b data-prefix="واجبات">' + hw.filter(h => !h.completed).length + '</b></div>' +
      '<div class="pstat"><b data-prefix="ملاحظات">' + notes.length + '</b></div>' +
      '<div class="pstat"><b data-prefix="أخطاء">' + errs.length + '</b></div>' +
      '<div class="pstat"><b data-prefix="جلسات">' + blocks.length + '</b></div>' +
    '</div>' +
    '<div class="detail-tabs">' + tabs.map(t => '<button class="detail-tab' + (t === "overview" ? " active" : "") + '" data-dtab="' + t + '">' + tabNames[t] + '</button>').join("") + '</div>' +
    '<div id="subj-detail-body"></div>';

    UI.openModal(UI.modalShell(I.subj(s, 18) + ' ' + s.name, body, ""));
    const m = document.getElementById("modal-root");
    const renderTabs = t => {
      const target = m.querySelector("#subj-detail-body");
      m.querySelectorAll("[data-dtab]").forEach(x => x.classList.toggle("active", x.dataset.dtab === t));
      if (t === "overview"){
        target.innerHTML = overviewTab(blocks, errs);
      } else if (t === "tasks"){
        target.innerHTML = tasks.length
          ? tasks.map(x => '<div class="mini-row">' + I.get(x.completed ? "checkdone" : "tasks", 14) + '<span style="flex:1">' + U.esc(x.title) + '</span>' + (x.completed ? '<span class="badge emerald">مكتملة</span>' : '<span class="badge neutral">باقية</span>') + '</div>').join("")
          : UI.empty("tasks", "لا مهام لهذه المادة", "أضف مهمة مرتبطة بهذه المادة.");
      } else if (t === "homework"){
        target.innerHTML = hw.length
          ? hw.map(x => '<div class="mini-row">' + I.get("homework", 14) + '<span style="flex:1">' + U.esc(x.title) + '</span><span class="badge ' + (x.completed ? "emerald" : "amber") + '">' + (x.completed ? "مكتمل" : hwCountB(x)) + '</span></div>').join("")
          : UI.empty("homework", "لا واجبات", "هذه المادة لا تحمل واجبات حاليًا.");
      } else if (t === "notes"){
        target.innerHTML = notes.length
          ? notes.map(x => '<div class="mini-row">' + (x.pinned ? I.get("pin", 14) : I.get("notes", 14)) + '<b style="flex:1">' + U.esc(x.title) + '</b><span class="muted small">' + x.content.slice(0, 40) + '…</span></div>').join("")
          : UI.empty("notes", "لا ملاحظات", "احفظ أهم المفاهيم في خزنتك المعرفية.");
      } else if (t === "mistakes"){
        target.innerHTML = errs.length
          ? errs.map(x => '<div class="mini-row">' + I.get("errors", 14) + '<b style="flex:1">' + U.esc(x.question).slice(0, 60) + '…</b>' + errStatusChip(x.status) + '</div>').join("")
          : UI.empty("errors", "لا أخطاء", '"' + 'رائع! لم تسجل أخطاء في هذه المادة.' + '"');
      } else if (t === "sessions"){
        target.innerHTML = blocks.length
          ? blocks.slice(0, 20).map(x => '<div class="mini-row">' + I.get(x.mode === "focus" ? "focus" : "sessions", 14) + '<span style="flex:1">' + U.fmtTimeHM(new Date(x.ts)) + ' — ' + U.relativeDay(x.date) + (x.title ? " · " + U.esc(x.title) : "") + '</span><b class="num">' + U.fmtDur(x.minutes) + '</b></div>').join("")
          : UI.empty("sessions", "لا جلسات بعد", "ابدأ أول جلسة مذاكرة في هذه المادة.");
      }
    };
    function hwCountB(x){
      const c = S.hwCountdown(x);
      return c.txt;
    }
    function overviewTab(blocks2, errs2){
      const week = blocks2.filter(b => U.daysBetween(b.date, U.todayKey()) <= 7 && U.daysBetween(b.date, U.todayKey()) >= 0).reduce((a, b) => a + b.minutes, 0);
      const last = blocks2[0];
      return '<div class="grid cols-2" style="gap:10px">' +
        '<div class="mini-row">' + I.get("clock", 14) + '<b style="flex:1">هذا الأسبوع</b>' + U.fmtDur(week) + '</div>' +
        '<div class="mini-row">' + I.get("zap", 14) + '<b style="flex:1">نقاط الخبرة المكتسبة</b>' + U.fmtNum(App.Store.xpOf({ minutes: mins, mode: "custom" })) + ' تقريبًا</div>' +
        (last ? '<div class="mini-row">' + I.get("sessions", 14) + '<b style="flex:1">آخر جلسة</b>' + U.relativeDay(last.date) + ' — ' + U.fmtDur(last.minutes) + '</div>' : '') +
        '<div class="mini-row">' + I.get("errors", 14) + '<b style="flex:1">أخطاء غير متقنة</b>' + errs2.filter(e => e.status !== "mastered").length + '</div>' +
      '</div>';
    }
    m.querySelectorAll("[data-dtab]").forEach(b => b.addEventListener("click", () => renderTabs(b.dataset.dtab)));
    renderTabs("overview");
  }
  App.Views.openSubjectModal = openSubjectModal;

  /* ── Error status chip (shared) ── */
  function errStatusChip(status){
    const map = {
      new: ["new", "جديد", "New"],
      review: ["review", "يحتاج مراجعة", "Review"],
      improving: ["improving", "يتحسن", "Improving"],
      mastered: ["mastered", "مُتقن", "Mastered"]
    };
    const m = map[status] || map.new;
    return '<span class="err-status ' + m[0] + '"><i></i>' + m[1] + '</span>';
  }
  App.Views.errStatusChip = errStatusChip;

  /* ── Date picker popover ── */
  function openDatePicker(anchor, selectedKey, onPick){
    const body =
      '<div class="cal-head" style="justify-content:space-between">' +
        '<button class="icon-btn small" id="dp-prev">' + I.get("chevron_right", 16) + '</button>' +
        '<div class="cal-title" id="dp-title"></div>' +
        '<button class="icon-btn small" id="dp-next">' + I.get("chevron_left", 16) + '</button>' +
      '</div>' +
      '<div class="cal-grid" id="dp-grid" data-month=""></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:14px">' +
        '<button class="btn ghost sm" id="dp-today">اليوم</button>' +
        '<button class="btn primary sm" id="dp-ok">اختيار</button>' +
      '</div>';
    UI.openModal(UI.modalShell('اختيار تاريخ', body, ""));
    const m = document.getElementById("modal-root");
    let month = new Date(U.fromKey(selectedKey));
    function paint(){
      let cellH = "";
      for (let i = 0; i < 7; i++) cellH += '<div class="cal-dow">' + U.DAYS_ABBR[i] + '</div>';
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const startOffset = (first.getDay() + 6) % 7; // Monday-first
      const gridStart = new Date(first); gridStart.setDate(1 - startOffset);
      m.querySelector("#dp-title").textContent = U.MONTHS_AR[month.getMonth()] + " " + month.getFullYear();
      for (let i = 0; i < 42; i++){
        const d = U.addDays(gridStart, i);
        const k = U.dateKey(d);
        const other = d.getMonth() !== month.getMonth();
        cellH += '<div class="cal-cell ' + (other ? "other" : "") + (k === selectedKey ? " selected" : "") + (k === U.todayKey() ? " today" : "") + '" data-dpk="' + k + '" style="min-height:0;padding:6px;justify-content:center">' +
          '<div class="cal-num" style="text-align:center">' + d.getDate() + '</div></div>';
      }
      m.querySelector("#dp-grid").innerHTML = cellH;
      m.querySelectorAll("[data-dpk]").forEach(c => c.addEventListener("click", () => {
        selectedKey = c.dataset.dpk;
        paint();
      }));
    }
    m.querySelector("#dp-prev").addEventListener("click", () => { month.setMonth(month.getMonth() - 1); paint(); });
    m.querySelector("#dp-next").addEventListener("click", () => { month.setMonth(month.getMonth() + 1); paint(); });
    m.querySelector("#dp-today").addEventListener("click", () => { selectedKey = U.todayKey(); paint(); });
    m.querySelector("#dp-ok").addEventListener("click", () => { UI.closeModal(); onPick(selectedKey); });
    paint();
  }
  App.Views.openTodoPicker = openDatePicker;
  App.Views.refreshTimerUI = refreshTimerUI;
  App.Views.refreshQt = refreshQt;

})();