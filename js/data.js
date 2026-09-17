/* ═══════════════ STUDY OS — data.js (subjects, pages, achievements, insights) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Data = (function () {
  const U = App.Util;

  /* ── Subjects ── */
  const subjects = [
    { id: "arabic",       name: "اللغة العربية",      icon: "arabic",       iconImg: "img/arabic.webp",       accent: "#E8CF98", hourGoal: 24 },
    { id: "english",      name: "اللغة الإنجليزية",   icon: "english",      iconImg: "img/english.webp",      accent: "#6FA99B", hourGoal: 24 },
    { id: "history",      name: "التاريخ",            icon: "history",      iconImg: "img/history.webp",      accent: "#D6B77A", hourGoal: 30 },
    { id: "programming",  name: "البرمجة",            icon: "code",         iconImg: "img/programming.webp",  accent: "#2F7568", hourGoal: 36 }
  ];
  const LEGACY_GENERAL = { id: "general", name: "غير مصنف", icon: "star", accent: "#BFA06A", hourGoal: 12 };
  const subjectById = id => subjects.find(s => s.id === id) || (id === "general" ? LEGACY_GENERAL : subjects[subjects.length-1] || LEGACY_GENERAL);
  const defSubject = () => (subjects.length ? subjects[0].id : "general");
  function subjName(id){ return subjectById(id).name; }

  /* ── Pages (navigation) ── */
  const navPages = [
    { route: "dashboard",     num: "01", name: "الرئيسية",   en: "Dashboard",        icon: "dashboard" },
    { route: "subjects",      num: "02", name: "المواد",     en: "Subjects",         icon: "book" },
    { route: "sessions",      num: "03", name: "جلسات الدراسة", en: "Study Sessions", icon: "sessions" },
    { route: "timer",         num: "04", name: "المؤقت",     en: "Timer",            icon: "timer" },
    { route: "todo",          num: "05", name: "المهام",     en: "To-Do",            icon: "tasks" },
    { route: "homework",      num: "06", name: "الواجبات",   en: "Homeworks",        icon: "homework" },
    { route: "calendar",      num: "07", name: "التقويم",    en: "Calendar",         icon: "calendar" },
    { route: "notes",         num: "08", name: "الملاحظات",  en: "Notes",            icon: "notes" },
    { route: "analytics",     num: "09", name: "التحليلات",  en: "Analytics",        icon: "analytics" },
    { route: "errors",        num: "10", name: "بنك الأخطاء", en: "Error Bank",      icon: "errors" },
    { route: "achievements",  num: "11", name: "الإنجازات",  en: "Achievements",     icon: "achievements" },
    { route: "notifications", num: "12", name: "التنبيهات",  en: "Notifications",    icon: "bell" }
  ];
  const pageByRoute = {};
  navPages.forEach(p => pageByRoute[p.route] = p);
  const extraPages = [
    { route: "profile", name: "الملف الشخصي", en: "Profile", icon: "user" },
    { route: "settings", name: "الإعدادات", en: "Settings", icon: "settings" }
  ];

  /* ── XP / level math ── */
  function levelInfo(xp){
    xp = Math.max(0, Math.floor(xp));
    let level = 1, need = 100, spent = 0;
    while (xp >= spent + need){ spent += need; level++; need = 100 + (level-1)*50; }
    const have = xp - spent;
    return { level, have, need, pct: Math.min(100, Math.round(have/need*100)) };
  }

  /* ── Achievements (100+) ── */
  const ACH_GROUPS = [
    { id: "daily", name: "يومي", en: "Daily" },
    { id: "consistency", name: "الالتزام", en: "Consistency" },
    { id: "time", name: "وقت الدراسة", en: "Study Time" },
    { id: "tasks", name: "المهام", en: "Tasks" },
    { id: "homework", name: "الواجبات", en: "Homework" },
    { id: "subjects", name: "المواد", en: "Subjects" },
    { id: "review", name: "المراجعة وبنك الأخطاء", en: "Review" },
    { id: "focus", name: "التركيز", en: "Focus" },
    { id: "pomodoro", name: "بومودورو", en: "Pomodoro" },
    { id: "milestones", name: "محطات", en: "Milestones" }
  ];
  const groupOf = id => (ACH_GROUPS.find(g => g.id === id) || ACH_GROUPS[7]);
  let defs = [];
  const ns = {};

  function def(id, name, desc, icon, check, group){
    defs.push({ id, name, desc, icon, group: group || "daily", xp: 50, check });
  }

  /* counters bound at evaluation time */
  function stats(s){
    const now = U.todayKey();
    const today = s.daily[now] || {};
    const totalMinutes = sum(s.blocks, b => b.minutes);
    const tasksDone = s.tasks.filter(t => t.completed).length;
    const hwDone = s.homework.filter(h => h.completed).length;
    const pomos = s.pomodoroCount || 0;
    const focusCount = s.blocks.filter(b => b.mode === "focus").length;
    const totalSessions = s.blocks.length;
    const mistakesCnt = s.mistakes.length;
    const reviewed = s.mistakes.reduce((a, m) => a + (m.reviews || 0), 0);
    const mastered = s.mistakes.filter(m => m.status === "mastered").length;
    const streak = streakOf(s);
    return { now, today, totalMinutes, tasksDone, hwDone, pomos, focusCount, totalSessions, mistakesCnt, reviewed, mastered, streak,
      hours: Math.floor(totalMinutes/60) };
  }
  function sum(arr, fn){ return arr.reduce((a, x) => a + fn(x), 0); }
  function tsCount(s, key){ return Object.values(s.daily).reduce((a, d) => a + (d[key] || 0), 0); }
  function activeDaysCount(s){ return Object.keys(s.daily).filter(k => isActiveDay(s, k)).length; }
  function isActiveDay(s, k){ const d = s.daily[k]; return !!(d && (d.studyMin > 0 || (d.tasksCompleted > 0) || (d.homeworkCompleted > 0))); }
  function streakOf(s){
    let streak = 0; let d = new Date();
    if (!isActiveDay(s, U.dateKey(d))){ d = U.addDays(d, -1); }
    while (isActiveDay(s, U.dateKey(d))){ streak++; d = U.addDays(d, -1); }
    return streak;
  }
  function longestStreakOf(s){
    const days = Object.keys(s.daily).sort();
    let best = 0, cur = 0, prev = null;
    days.forEach(k => {
      if (isActiveDay(s, k)){ cur = (prev && U.daysBetween(prev, k) === 1) ? cur + 1 : 1; best = Math.max(best, cur); }
      else cur = 0;
      prev = k;
    });
    return best;
  }
  function unlockGolden(name){ // built-ins name to id
    return "gold_" + name;
  }

  function _m(prefix, values, base){
    defs = defs.filter(d => !d.id.startsWith(prefix));
  }

  function buildAll(){
    defs = [];
    const U2 = U;

    /* DAILY (12) */
    def("d_first_goal", "واصل هدفك", "أنهِ هدف الدراسة اليومي", "target",
      s => (s.daily[U2.todayKey()] || {}).studyMin >= s.settings.dailyGoalMinutes);
    def("d_all_tasks", "منجز اليوم", "أنهِ جميع مهام اليوم", "checkdone",
      s => { const t = U2.todayKey(); const ds = s.tasks.filter(x => x.date === t); return ds.length > 0 && ds.every(x => x.completed); });
    def("d_no_miss", "كمال", "أنهِ يومًا دون أي مهمة متأخرة", "star",
      s => { const t = U2.todayKey(); return !s.tasks.some(x => x.date < t && !x.completed || (x.date === t && x.completed)); });
    def("d_pomo_1", "بومودورو واحد", "أنجز جولة بومودورو واحدة", "timer",
      s => { /* handled via pomodoro counters */ return (s.daily[U2.todayKey()] || {}).pomodoros >= 1; });
    def("d_review_1", "مراجعة يومية", "راجع خطأً واحدًا اليوم", "errors",
      s => (s.daily[U2.todayKey()] || {}).reviews >= 1);
    def("d_focus_1", "شخص مركّز", "أنجز جلسة تركيز اليوم", "focus",
      s => (s.daily[U2.todayKey()] || {}).focus >= 1);
    def("d_session_3", "يوم حافل", "أنجز 3 جلسات دراسة في يوم واحد", "sessions",
      s => (s.daily[U2.todayKey()] || {}).sessions >= 3);
    def("d_2hr", "ساعتان ذهبيتان", "ادرس ساعتين في يوم واحد", "clock",
      s => (s.daily[U2.todayKey()] || {}).studyMin >= 120);
    def("d_4hr", "مثابر اليوم", "ادرس 4 ساعات في يوم واحد", "clock",
      s => (s.daily[U2.todayKey()] || {}).studyMin >= 240);
    def("d_hw_1", "واجب اليوم", "أنجز واجبًا اليوم", "homework",
      s => (s.daily[U2.todayKey()] || {}).homeworkCompleted >= 1);
    def("d_task_3", "مهام اليوم", "أنجز 3 مهام في يوم واحد", "tasks",
      s => (s.daily[U2.todayKey()] || {}).tasksCompleted >= 3);
    def("d_early", "بكر", "ادرس قبل الثامنة صباحًا", "sun",
      s => s.blocks.some(b => { const dt = new Date(b.ts); const t = U2.todayKey(); return b.date === t && (new Date(b.startedAt || b.ts).getHours()) < 8; }));

    /* CONSISTENCY (12) */
    const streakDefs = [[1,"خطوة أولى","أيام متتالية"],[[3],"3 أيام متتالية","3"]];
    def("c_1", "خطوة أولى", "3 أيام متتالية من الالتزام", "flame", s => streakOf(s) >= 3, "consistency");
    def("c_7", "أسبوع متين", "7 أيام متتالية", "flame", s => streakOf(s) >= 7, "consistency");
    def("c_14", "أسبوعان", "14 يومًا متتاليًا", "flame", s => streakOf(s) >= 14, "consistency");
    def("c_21", "21 يومًا", "21 يومًا متتاليًا", "flame", s => streakOf(s) >= 21, "consistency");
    def("c_30", "شهر كامل", "30 يومًا متتاليًا", "flame", s => streakOf(s) >= 30, "consistency");
    def("c_45", "سباق طويل", "45 يومًا متتاليًا", "flame", s => streakOf(s) >= 45, "consistency");
    def("c_60", "سلسلة ماسية", "60 يومًا متتاليًا", "flame", s => streakOf(s) >= 60, "consistency");
    def("c_75", "قوة داخلية", "75 يومًا متتاليًا", "flame", s => streakOf(s) >= 75, "consistency");
    def("c_90", "ربع سنة", "90 يومًا متتاليًا", "flame", s => streakOf(s) >= 90, "consistency");
    def("c_100", "مئة يوم", "100 يوم متتالي", "flame", s => streakOf(s) >= 100, "consistency");
    def("c_10_act", "نشاط أسبوعي", "ادرس 10 أيام إجمالًا", "star", s => activeDaysCount(s) >= 10, "consistency");
    def("c_30_act", "باحث عن التقدم", "ادرس 30 يومًا إجمالًا", "star", s => activeDaysCount(s) >= 30, "consistency");

    /* STUDY TIME hours (16) */
    const hourMarks = [1,2,5,10,15,25,50,75,100,150,200,300,400,500,750,1000];
    hourMarks.forEach((h, i) => {
      const id = "t_h" + h;
      def(id, h + " ساعة دراسة", "سجّل " + h + " ساعات من الدراسة", "clock",
        s => sum(s.blocks, b => b.minutes) >= h * 60, "time");
    });

    /* TASKS (14) */
    const taskMarks = [1,5,10,25,50,100,250,500,750,1000,1500,2000,3000,5000];
    taskMarks.forEach(n => {
      def("k_done_" + n, (n >= 1000 ? (n/1000 + " ألف") : n) + " مهمة مُنجزة", "أكمل " + n + " مهام", "tasks",
        s => stats(s).tasksDone >= n, "tasks");
    });

    /* HOMEWORK (8) */
    const hwMarks = [1,5,10,25,50,100,200,500];
    hwMarks.forEach(n => {
      def("w_done_" + n, (n === 500 ? "خمسمئة" : n) + " واجب", "أنجز " + n + " واجبات", "homework",
        s => stats(s).hwDone >= n, "homework");
    });

    /* SUBJECTS (10) */
    def("s_first_3", "استكشاف", "ادرس 3 مواد مختلفة", "book", s => new Set(s.blocks.filter(b=>b.subject!=="general").map(b=>b.subject)).size >= 3, "subjects");
    def("s_first_all", "استكشاف كامل", "ادرس جميع المواد الأربع", "book", s => new Set(s.blocks.filter(b=>b.subject!=="general").map(b=>b.subject)).size >= 4, "subjects");
    const shMarks = [1,5,8,10,15];
    subjects.filter(x => x.id !== "general").forEach(sub => {
      shMarks.forEach(h => {
        const id = "s_h_" + sub.id + "_" + h;
        def(id, sub.name + " — " + h + " ساعات", "ادرس " + sub.name + " " + h + " ساعات", "book",
          s => sum(s.blocks.filter(b => b.subject === sub.id), b => b.minutes) >= h * 60, "subjects");
      });
    });
    def("s_master_1", "أول مادة منجزة", "ادرس مادة " + subjects[0].name + " 24 ساعة", "shield",
      s => sum(s.blocks.filter(b => b.subject === subjects[0].id), b => b.minutes) >= 24*60, "subjects");

    /* ERROR BANK / REVIEW (12) */
    const addMarks = [1,5,10,25,50,100];
    addMarks.forEach(n => {
      def("e_add_" + n, n + " أخطاء مسجلة", "سجّل " + n + " أخطاء في بنك الأخطاء", "errors",
        s => s.mistakes.length >= n, "review");
    });
    const revMarks = [1,10,25,50,100];
    revMarks.forEach(n => {
      def("e_rev_" + n, n + " مراجعات", "راجع أخطاءك " + n + " مرات", "errors",
        s => s.mistakes.reduce((a, m) => a + (m.reviews || 0), 0) >= n, "review");
    });
    const masMarks = [1,5,10,20,50];
    masMarks.forEach(n => {
      def("e_mas_" + n, n + " أخطاء مُتقنة", "أتقن " + n + " أخطاء بالكامل", "shield",
        s => s.mistakes.filter(m => m.status === "mastered").length >= n, "review");
    });

    /* FOCUS (8) */
    const focMarks = [1,3,5,10,20,50,100,200];
    focMarks.forEach(n => {
      def("f_n_" + n, n + (n===1?"":"") + " جلسات تركيز", "أنجز " + n + " جلسات تركيز", "focus",
        s => s.blocks.filter(b => b.mode === "focus").length >= n, "focus");
    });

    /* POMODORO (8) */
    const pomMarks = [1,5,10,25,50,100,250,500];
    pomMarks.forEach(n => {
      def("p_" + n, n + " بومودورو", "أنجز " + n + " جولات بومودورو", "timer",
        s => (s.pomodoroCount || 0) >= n, "pomodoro");
    });

    /* MILESTONES (XP + misc) (12) */
    const xpMarks = [300,500,1000,2000,3500,5000,7500,10000,15000,20000,30000,50000];
    xpMarks.forEach(n => {
      def("x_" + n, n.toLocaleString("en-US") + " نقطة خبرة", "اجمع " + n.toLocaleString("en-US") + " XP", "xp",
        s => (s.xp || 0) >= n, "milestones");
    });

    return defs;
  }
  buildAll();

  /* tips & quotes for focus theatre */
  const FOCUS_QUOTES = [
    "ركز. جلسة واحدة فقط.",
    "كل شيء يبدو صعبًا قبل أن يصبح سهلًا.",
    "النجاح هو مجموع الجهود الصغيرة المتكررة.",
    "أنت لا تحتاج أن تكون مثاليًا، فقط ثابتًا.",
    "دقيقة واحدة من التركيز تغيّر المحاضرة كلها.",
    "الانضباط هو الجسر بين الأهداف والإنجاز.",
    "افعلها الآن، فبعد ساعة ستشكر نفسك."
  ];

  /* MVP strings / mission suggestions */
  const MISSION_HINTS = {
    arabic: "مراجعة قواعد اللغة العربية",
    english: "ممارسة اللغة الإنجليزية",
    history: "مراجعة التاريخ",
    programming: "حل تمرين برمجي"
  };

  return {
    subjects, subjectById, defSubject, subjName, navPages, extraPages, pageByRoute,
    levelInfo, ACH_GROUPS, groupOf, defs, names: ns,
    stats, sum, streakOf, longestStreakOf, activeDaysCount, isActiveDay, unlockGolden,
    FOCUS_QUOTES, MISSION_HINTS
  };
})();