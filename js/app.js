/* ═══════════════ STUDY OS — app.js (boot, shell, router, focus theatre, global ticks) ═══════════════ */
"use strict";
window.App = window.App || {};
(function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;
  const $ = id => document.getElementById(id);
  function avatarMarkup(a){
    a = a || "🎓";
    if (a.indexOf("data:image") === 0 || a.indexOf("http") === 0) return '<img class="av-img" src="' + a + '" alt="" role="presentation">';
    return '<span class="av-emoji">' + a + '</span>';
  }

  if (!App.Store) throw new Error("store.js must load before app.js");

  /* ── tweaks that pure-CSS can't do ── */
  function applyTheme(){
    const st = S.getState();
    let theme = st.settings.theme;
    if (theme === "system") theme = (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F3F1EA" : "#0E1013");
  }
  function applyLayout(){
    const st = S.getState();
    const collapsed = st.settings.sidebarMode === "collapsed";
    document.body.classList.toggle("collapsed", collapsed);
    document.body.classList.toggle("side-collapsed", collapsed);
    document.body.setAttribute("data-density", st.settings.density || "comfortable");
  }
  function applyThemeFromSystem(){ applyTheme(); }

  /* عنوان الشريط العلوي (لا صغير المحتوى): نحكم على المساحة الفعلية لا على
     breakpoint وحيد. لا نعرض العنوان إلا إن وسعه مكانه كاملًا دون قصّ أو نقاط —
     وإلا نخفيه بالكامل. الشاشات الصغيرة (≤480) تُخفيه دائمًا. عنوان الصفحة
     داخل المحتوى (.page-title) لا يُمسّ نهائيًا. */
  function fitTopbarTitle(){
    const el = $("tb-title");
    if (!el) return;
    if (document.documentElement.classList.contains("is-native")){ el.classList.remove("tb-title-hidden"); return; }
    el.classList.remove("tb-title-hidden");            // نعيد القياس وهو مرئي
    const fits = el.scrollWidth <= el.clientWidth;      // مساحة فعلية في الشريط
    el.classList.toggle("tb-title-hidden", window.innerWidth <= 480 || !fits);
  }
  window.addEventListener("resize", fitTopbarTitle);
  window.addEventListener("load", fitTopbarTitle);

  /* البحث في الشريط العلوي: عند ضيق المساحة لا نسمح بسحق زر القائمة/الأيقونات.
     القاعدة CSS (≤830) تُقلّص البحث إلى أيقونة. هنا نتحقق من المساحة الفعلية
     فنجبر نفس السلوك breakeven ضمن المدى 831–899 بأي اسم العناصر/خط عرض. */
  let searchIconForced = false;
  function fitTopbarSpace(){
    const bar = document.querySelector(".topbar");
    const menu = $("tb-menu");
    const s = $("tb-search");
    if (!bar || !menu || !s) return;
    if (searchIconForced){
      if (window.innerWidth >= 900) searchIconForced = false;   // متسع بوضوح: نعيد النص
    } else {
      const natural = menu.offsetWidth;                          // 38 إذا لم يُسحق
      if (natural > 0 && natural < 30 && window.innerWidth < 900) searchIconForced = true;
    }
    s.classList.toggle("tb-search-icon", searchIconForced);
  }
  function fitTopbar(){
    fitTopbarSpace();     // أولًا: شكل البحث يؤثر على المساحة المتاحة للعنوان
    fitTopbarTitle();
  }
  window.addEventListener("resize", fitTopbar);
  window.addEventListener("load", fitTopbar);

  /* يعلّم الصفحة أنها تعمل داخل تطبيق أندرويد (Capacitor) لإخفاء اسم الصفحة من الشريط العلوي */
  function markNative(){
    const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    document.documentElement.classList.toggle("is-native", isNative);
  }

  /* ── shell ── */
  const NAV_GROUPS = [
    ["الرئيسية", ["dashboard"]],
    ["الدراسة", ["subjects", "sessions", "timer"]],
    ["التنظيم", ["todo", "homework", "calendar", "notes", "summaries"]],
    ["التحليل", ["analytics", "errors", "achievements"]],
    ["النظام", ["notifications"]],
    ["المساعد", ["ai-assistant"]]
  ];
  function buildNav(){
    const nav = $("side-nav");
    nav.innerHTML = NAV_GROUPS.map(g =>
      '<div class="nav-cap">' + g[0] + '</div>' +
      g[1].map(route => {
        const p = D.pageByRoute[route];
        if (!p) return "";
        return '<a class="side-nav-item" data-route="' + p.route + '" href="#/' + p.route + '" data-tooltip="' + p.name + '" data-tip="' + p.name + '">' +
          '<span class="side-nav-icon">' + I.get(p.icon, 20) + '</span>' +
          '<span class="side-nav-label">' + p.name + '</span>' +
          '<span class="side-nav-num">' + p.num + '</span>' +
        '</a>';
      }).join("")
    ).join("");
  }

  let current = { route: "dashboard", ctx: {}, entry: null };

  function paintShell(){
    const st = S.getState();
    const routeN = current.route;
    document.querySelectorAll(".side-nav-item").forEach(a => a.classList.toggle("active", a.dataset.route === routeN));

    const ts = S.todayStats();
    const goal = st.settings.dailyGoalMinutes;
    const el = $("sidebar-goal");
    if (el){
      const pct = ts.goalPct || 0;
      const rem = goal - ts.goalMin;
      el.innerHTML =
        '<div class="side-goal-top"><span class="num">اليوم</span><b class="num">' + U.fmtDur(ts.goalMin) + ' / ' + U.fmtDur(goal) + '</b></div>' +
        '<div class="progress thin ' + (ts.goalMin >= goal ? "goal-hit" : "") + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="muted small">' + (ts.goalMin >= goal ? "👏 تحقق هدف اليوم" : "باقٍ " + U.fmtDur(Math.max(0, rem))) + '</div>';
    }
    $("side-avatar").innerHTML = avatarMarkup(st.user.avatar);
    $("side-user-name").textContent = st.user.name || "طالب";
    $("side-user-grade").textContent = st.user.grade || "ثانية ثانوي — بكالوريا";

    $("tb-title").textContent = App.Views.titles[routeN] || routeN;
    fitTopbar();
    $("tb-streak").innerHTML = I.get("flame", 14) + '<b class="num">' + D.streakOf(st) + '</b>';
    $("tb-xp").innerHTML = I.get("xp", 14) + '<b class="num">' + U.fmtNum(st.xp) + '</b>';
    $("tb-theme").innerHTML = st.settings.theme === "light" ? I.get("moon", 18) : I.get("sun", 18);
    $("tb-bell-badge").hidden = S.unreadCount() === 0;
    $("tb-avatar").innerHTML = avatarMarkup(st.user.avatar);

    applyTheme();
    applyLayout();
  }

  /* ── router ── */
  const Router = {
    go(route, opts){
      opts = opts || {};
      current.ctx = opts;
      location.hash = "#/" + route + (opts.date ? "/" + opts.date : "");
    },
    rerender(){ renderView(current.route, current.ctx); },
    refreshShell(){ paintShell(); },
    applyTheme, applyLayout,
    onRendered(route){
      current.entry = (App.Views.registry || {})[route] || null;
      paintShell();
      if (route === "timer" && current.ctx && current.ctx.launch === "focus" && !App.Timer.active()){
        current.ctx = {};
        App.Timer.launch({ type: "focus", subject: D.defSubject(), context: "page" });
        enterTheatre();
      }
    },
    enterTheatre, exitTheatre,
    current(){ return current; }
  };
  App.Router = Router;

  function parseHash(){
    const h = (location.hash || "#/dashboard").replace(/^#\/?/, "");
    const parts = h.split("/");
    return { route: parts[0] || "dashboard", date: parts[1] };
  }
  function renderView(r, ctx){
    App.Views.run(r, ctx || {});
  }
  function route(){
    const p = parseHash();
    document.body.classList.toggle("ai-route", p.route === "ai-assistant");
    const ctx = current.ctx || {};
    if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) ctx.date = ctx.date || p.date;
    current.ctx = {};
    current.route = p.route;
    renderView(p.route, ctx);
  }
  window.addEventListener("hashchange", route);

  /* ── global reactions ── */
  function onStoreChange(ev){
    paintShell();
    const entry = current.entry;
    if (entry && entry.rerender) renderView(current.route, current.ctx);
    else if (!entry){
      // not yet rendered (still on dashboard fallback) — render
      route();
    }
  }

  /* ── reminders ── */
  function checkReminders(){
    const before = S.getState().notifications.length;
    S.generateReminders();
    const after = S.getState().notifications.length;
    if (after > before){ S.save(); U.emit("change", { reason: "reminders" }); }
  }

  /* ── focus theatre ── */
  let theatreActive = false;
  function enterTheatre(){
    if (!App.Timer.active()){ Router.go("timer"); return; }
    const t = $("theatre");
    t.hidden = false;
    t.setAttribute("aria-hidden", "false");
    document.body.classList.add("theatre-open");
    theatreActive = true;
    const q = D.FOCUS_QUOTES[Math.floor(Math.random() * D.FOCUS_QUOTES.length)];
    $("theatre-quote").textContent = q;
    updateTheatre(App.Timer.snapshot());
  }
  function exitTheatre(){
    const t = $("theatre");
    t.hidden = true;
    t.setAttribute("aria-hidden", "true");
    document.body.classList.remove("theatre-open");
    theatreActive = false;
  }
  function updateTheatre(snap){
    if (!theatreActive) return;
    const mode = snap.type === "pomodoro" ? "POMODORO" : (snap.type === "custom" ? "TIMER" : "FOCUS");
    $("theatre-ring").innerHTML = UI.ring(118, 13, snap.pct) +
      '<div class="ring-core"><div class="theatre-clock">' + snap.display + '</div>' +
      '<div class="theatre-mode">' + mode + '</div></div>';
    $("th-pomo").textContent = snap.type === "pomodoro" ? (snap.done % snap.sessions) + "/" + snap.sessions : snap.displayLong;
    $("th-total").textContent = snap.display;
    $("th-pct").textContent = snap.pct + "%";
    $("theatre-bar-fill").style.width = snap.pct + "%";
    $("theatre-subject").textContent = (snap.subject ? D.subjName(snap.subject) : "دراسة") + (snap.title ? " · " + snap.title : "");
    $("theatre-pause-txt").textContent = snap.mode === "running" ? "إيقاف مؤقت" : "متابعة";
  }
  function bindTheatre(){
    $("theatre-exit").addEventListener("click", () => { exitTheatre(); UI.toast("خرجت من وضع التركيز. الجلسة مستمرة.", "gold", "focus"); });
    $("theatre-pause").addEventListener("click", () => {
      if (App.Timer.isRunning()) App.Timer.pause();
      else { App.Timer.resume && App.Timer.resume(); }
      updateTheatre(App.Timer.snapshot());
    });
    $("theatre-finish").addEventListener("click", () => {
      const done = App.Timer.finish(false);
      exitTheatre();
      if (done && done.minutes) UI.toast("أحسنت! سُجّلت جلسة " + U.fmtDur(done.minutes) + ".", "success", "check");
      else UI.toast("انتهت الجلسة الحالية.", "gold", "info");
      if (current.route === "timer") App.Views.refreshTimerUI && App.Views.refreshTimerUI();
    });
  }

  /* ── timer widget updates (subscribe once) ── */
  U.on("tick", snap => { if (!snap.active) return; widgetTimerUpdate(); });
  U.on("timer", () => widgetTimerUpdate());
  U.on("complete", () => { if (theatreActive) exitTheatre(); widgetTimerUpdate(); });
  U.on("phase", () => { updateTheatre(App.Timer.snapshot()); });
  U.on("unlocked", list => { UI.enqueueUnlocked && UI.enqueueUnlocked(list); });
  U.on("xp", () => { paintShell(); });
  function widgetTimerUpdate(){
    const route = Router.current().route;
    if (route === "timer" && App.Views.refreshTimerUI) App.Views.refreshTimerUI();
    if (route === "dashboard" && App.Views.refreshQt) App.Views.refreshQt();
    updateTheatre(App.Timer.snapshot());
    paintShell();
  }

  /* ── shell interactions ── */
  function bindShell(){
    $("tb-menu").addEventListener("click", () => {
      const c = $("side-drawer");
      c.checked = !c.checked;
    });
    $("scrim").addEventListener("click", () => { $("side-drawer").checked = false; });
    $("side-collapse").addEventListener("click", e => {
      e.stopPropagation();
      const st = S.getState();
      S.updateSettings({ sidebarMode: st.settings.sidebarMode === "expanded" ? "collapsed" : "expanded" });
    });
    $("side-user").addEventListener("click", () => Router.go("profile"));
    $("tb-theme").addEventListener("click", () => {
      const st = S.getState();
      const cur = st.settings.theme;
      if (cur === "light") S.updateSettings({ theme: "dark" });
      else if (cur === "dark") S.updateSettings({ theme: "light" });
      else S.updateSettings({ theme: document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark" });
    });
    $("tb-bell").addEventListener("click", () => Router.go("notifications"));
    $("tb-search").addEventListener("click", () => App.Modals.openPalette());
    $("tb-quick-add").addEventListener("click", () => { const f = $("fab-btn"); if (f) f.click(); });
    $("tb-avatar").addEventListener("click", () => Router.go("profile"));
    if (window.matchMedia){
      const mql = matchMedia("(prefers-color-scheme: light)");
      if (mql.addEventListener) mql.addEventListener("change", applyThemeFromSystem);
      else if (mql.addListener) mql.addListener(applyThemeFromSystem);
    }
  }

  /* ── day rollover tick ── */
  let lastDay = U.todayKey();
  setInterval(() => {
    const d = U.todayKey();
    if (d !== lastDay){
      lastDay = d;
      S.save();
      U.emit("change", { reason: "rollover" });
      checkReminders();
    }
  }, 45000);

  /* ── boot ── */
  function boot(){
    markNative();
    window.addEventListener("load", markNative);
    S.load();
    applyTheme();
    applyLayout();
    buildNav();
    bindShell();
    bindTheatre();
    U.on("change", onStoreChange);
    App.Modals && App.Modals.init();
    App.Sync && App.Sync.init && App.Sync.init();
    if ("serviceWorker" in navigator && window.isSecureContext !== false)
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      });
    checkReminders();
    setInterval(checkReminders, 60 * 1000);
    route();
    animate();
  }
  function animate(){
    const fill = $("boot-fill"), pct = $("boot-pct");
    const start = Date.now(), T = 600;
    function step(){
      const k = Math.min(1, (Date.now() - start) / T);
      const eased = 1 - Math.pow(1 - k, 3);
      const p = Math.round(100 * eased);
      fill.style.width = p + "%";
      pct.textContent = p + "%";
      if (k < 1){ requestAnimationFrame(step); return; }
      const b = $("boot");
      b.classList.add("out");
      const app = $("app");
      app.style.opacity = "1";
      b.setAttribute("aria-hidden", "true");
      setTimeout(() => { b.style.display = "none"; }, 450);
    }
    requestAnimationFrame(step);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();