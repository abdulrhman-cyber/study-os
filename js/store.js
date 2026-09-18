/* ═══════════════ STUDY OS — store.js (state, persistence, actions, XP) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Store = (function () {
  const U = App.Util;
  const D = App.Data;
  const KEY = "studyos.v1";                 // مساحة بيانات الضيف (قبل تسجيل الدخول)
  const USER_PREFIX = "studyos.v1.u.";      // مساحة بيانات كل مستخدم مسجّل (مفتاح مرتبط بـ user id)
  const LAST_USER_KEY = "studyos.lastUser"; // آخر مستخدم فعّال — لعرض الكاش فورًا عند الإقلاع

  let activeKey = KEY;
  let lastSavedAt = "";

  function userKey(uid){ return USER_PREFIX + String(uid); }
  function guestKey(){ return KEY; }
  function currentKey(){ return activeKey; }

  function defaults(){
    return {
      v: 1,
      seeded: false,
      user: { name: "طالب", avatar: "🎓", grade: "ثانية ثانوي — بكالوريا" },
      settings: {
        theme: "dark",
        sidebarMode: "expanded",
        density: "comfortable",
        dailyGoalMinutes: 240,
        pomodoroStudy: 25, pomodoroBreak: 5, pomodoroLong: 20, pomodoroSessions: 4,
        focusDuration: 30,
        sound: true,
        browserNotif: false,
        pushNotif: false,
        notif: { study: true, homework: true, dailyGoal: true, achievements: true, streak: true, review: true }
      },
      xp: 0,
      tasks: [], homework: [], blocks: [], mistakes: [], notes: [], exams: [],
      notifications: [], activityLog: [], unlocked: {},
      pomodoroCount: 0,
      daily: {},
      levelUps: []
    };
  }

  let state = null;
  let saveTimer = null;

  function save(){
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 120);
  }

  /* كتابة فورية لمساحة العمل الحالية (نستدعيها قبل تبديل المستخدم/مساحة العمل) */
  function flush(){
    if (saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
    try {
      lastSavedAt = U.iso();
      localStorage.setItem(activeKey, JSON.stringify({ v: 1, savedAt: lastSavedAt, data: state }));
    } catch(e){ console.warn("save failed", e); }
  }

  /* قراءة ملف محلي — يدعم الصيغة الحديثة { savedAt, data } والصيغة القديمة (الحالة مباشرة) */
  function readFile(key){
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const data = (parsed.data && Array.isArray(parsed.data.tasks)) ? parsed.data
                 : (Array.isArray(parsed.tasks) ? parsed : null);
      if (!data) return null;
      return { savedAt: parsed.savedAt || "", data: normalizeState(Object.assign(defaults(), data)) };
    } catch(e){ return null; }
  }

  function bootKey(){
    try {
      const last = localStorage.getItem(LAST_USER_KEY);
      if (last) return userKey(last);
    } catch(e){}
    return KEY;
  }

  function load(key){
    activeKey = key || bootKey();
    const file = readFile(activeKey);
    if (file){ state = file.data; lastSavedAt = file.savedAt || ""; }
    else { state = defaults(); lastSavedAt = ""; }
    normalize(state);
    return state;
  }

  function normalize(st){
    st = st || state;
    const def = defaults();
    st.settings = Object.assign({}, def.settings, st.settings || {});
    st.settings.notif = Object.assign({}, def.settings.notif, (st.settings && st.settings.notif) || {});
    st.user = Object.assign({}, def.user, st.user || {});
    if (!st.daily) st.daily = {};
    if (!st.activityLog) st.activityLog = [];
    if (!st.unlocked) st.unlocked = {};
    ["tasks","homework","blocks","mistakes","notes","exams","notifications","levelUps"].forEach(k => {
      if (!Array.isArray(st[k])) st[k] = [];
    });
    // legacy mistakes: backfill spaced-review scheduling fields
    st.mistakes.forEach(m => {
      if (m.reviewStage == null) m.reviewStage = (m.status === "mastered" ? 2 : 0);
      if (m.nextReview == null) m.nextReview = (m.status === "mastered" ? null : U.todayKey());
    });
    rebuildDaily(st);
    return st;
  }
  function normalizeState(st){ return normalize(st); }

  /* ── daily rollup (derived, single source of truth) ── */
  function rebuildDaily(st){
    st = st || state;
    const daily = {};
    function bump(k, field, n){
      if (!k) return;
      daily[k] = daily[k] || {};
      daily[k][field] = (daily[k][field] || 0) + (n || 1);
    }
    st.tasks.forEach(t => { if (t.completed && t.completedOn) bump(t.completedOn, "tasksCompleted"); });
    st.homework.forEach(h => { if (h.completed && h.completedOn) bump(h.completedOn, "homeworkCompleted"); });
    st.blocks.forEach(b => {
      bump(b.date, "studyMin", b.minutes);
      if (b.mode === "focus") bump(b.date, "focus");
      if (b.mode === "pomodoro") bump(b.date, "pomodoros");
      if (b.mode !== "quick") bump(b.date, "sessions");
    });
    st.mistakes.forEach(m => {
      (m.reviewLog || []).forEach(r => bump(r.date, "reviews"));
    });
    (st.exams || []).forEach(x => bump(x.date, "exams"));
    st.daily = daily;
  }

  /* ── activity log ── */
  function logActivity(txt, icon, kind){
    state.activityLog.unshift({ txt, icon: icon || "star", kind: kind || "info", ts: U.iso() });
    if (state.activityLog.length > 150) state.activityLog.length = 150;
  }

  /* ── notifications ── */
  let notifSeq = 1;
  function addNotif(type, title, body, icon, opts){
    opts = opts || {};
    const n = { id: "n" + (notifSeq++) + U.uid(), type, title, body, icon: icon || "bell", read: false, ts: U.iso() };
    if (opts.key) n.key = opts.key;
    state.notifications.unshift(n);
    if (state.notifications.length > 120) state.notifications.length = 120;
    U.emit("notif", n);
    return n;
  }
  function unreadCount(){
    return state.notifications.filter(n => !n.read).length;
  }

  /* ── XP ── */
  function xpOf(block){
    let x = Math.max(1, block.minutes);
    if (block.mode === "pomodoro") x += 15;
    else if (block.mode === "focus") x += 20;
    else if (block.mode === "custom") x += 10;
    return Math.round(x);
  }
  function grantXP(n, label){
    n = Math.max(1, Math.round(n));
    state.xp += n;
    const before = D.levelInfo(state.xp - n);
    const after = D.levelInfo(state.xp);
    U.emit("xp", { amount: n, label, level: after.level, leveled: after.level > before.level, info: after });
    return { amount: n, leveled: after.level > before.level, level: after.level, info: after };
  }

  /* ── task XP rewards ── */
  const REWARDS = { task: 10, homework: 20, mistakeReview: 5, mistakeAdd: 0, note: 2 };

  /* ── action helpers ── */
  function changed(reason){
    rebuildDaily();
    save();
    const unlocked = evaluateAchievements();
    U.emit("change", { reason, unlocked });
    return unlocked;
  }

  /* ══ TASKS ══ */
  function addTask(data){
    const t = Object.assign({
      id: U.uid(), title: "", desc: "", subject: D.defSubject(), priority: "mid",
      date: U.todayKey(), time: "", tags: [],
      completed: false, createdAt: U.iso()
    }, data);
    state.tasks.push(t);
    logActivity("أضفت مهمة: «" + t.title + "»", "tasks", "task");
    addNotif("taskAdded", "مهمة جديدة", "أُضيفت مهمة: «" + t.title + "»", "tasks", { key: "task_add_" + t.id });
    changed("task_added");
    return t;
  }
  function findTask(id){ return state.tasks.find(t => t.id === id); }
  function updateTask(id, patch){
    const t = findTask(id); if (!t) return;
    Object.assign(t, patch);
    changed("task_updated");
  }
  function deleteTask(id){
    state.tasks = state.tasks.filter(t => t.id !== id);
    changed("task_deleted");
  }
  function toggleTask(id){
    const t = findTask(id); if (!t) return;
    t.completed = !t.completed;
    if (t.completed){ t.completedOn = U.todayKey(); t.completedAt = U.iso(); }
    else { t.completedOn = null; t.completedAt = null; }
    logActivity(t.completed ? "أكملت مهمة: «" + t.title + "»" : "ألغيت إكمال مهمة: «" + t.title + "»",
      t.completed ? "check" : "tasks", "task");
    if (t.completed){
      grantXP(REWARDS.task, "مهمة مكتملة");
      addNotif("taskDone", "مهمة مكتملة", "أحسنت! أكملت مهمة: «" + t.title + "»", "check", { key: "task_done_" + t.id });
    }
    changed("task_toggled");
  }
  function rescheduleTask(id, toDate){
    const t = findTask(id); if (!t) return;
    t.date = toDate;
    t.completed = false; t.completedOn = null; t.completedAt = null;
    logActivity("نُقلت مهمة «" + t.title + "» إلى " + U.fmtDate(toDate), "calendar", "task");
    addNotif("taskSoon", "تمت إعادة الجدولة", "نُقلت المهمة «" + t.title + "» إلى " + U.fmtDate(toDate), "calendar");
    changed("task_rescheduled");
  }

  /* ══ HOMEWORK ══ */
  function addHomework(data){
    const h = Object.assign({
      id: U.uid(), title: "", subject: D.defSubject(), lesson: "", desc: "", exercises: 0,
      deadline: U.addDaysKey(U.todayKey(), 2), priority: "mid", status: "upcoming",
      completed: false, createdAt: U.iso()
    }, data);
    state.homework.push(h);
    logActivity("أضفت واجبًا: «" + h.title + "»", "homework", "hw");
    changed("homework_added");
    return h;
  }
  function findHw(id){ return state.homework.find(h => h.id === id); }
  function updateHw(id, patch){
    const h = findHw(id); if (!h) return; Object.assign(h, patch); updateHwStatus(h); changed("homework_updated");
  }
  function deleteHw(id){
    state.homework = state.homework.filter(h => h.id !== id);
    changed("homework_deleted");
  }
  function toggleHw(id){
    const h = findHw(id); if (!h) return;
    h.completed = !h.completed;
    if (h.completed){ h.completedOn = U.todayKey(); h.status = "completed"; }
    else h.completedOn = null;
    updateHwStatus(h);
    logActivity(h.completed ? "أكملت واجبًا: «" + h.title + "»" : "أعدت فتح واجب: «" + h.title + "»", "check", "hw");
    if (h.completed){
      grantXP(REWARDS.homework, "واجب مكتمل");
      addNotif("hwDone", "واجب مكتمل", "أنجزت واجب: «" + h.title + "»", "check", { key: "hw_done_" + h.id });
    }
    changed("homework_toggled");
  }
  function updateHwStatus(h){
    if (h.completed){ h.status = "completed"; return; }
    const today = U.todayKey();
    h.status = h.deadline === today ? "today" : (h.deadline < today ? "overdue" : "upcoming");
  }
  function refreshHwStatus(){
    state.homework.forEach(updateHwStatus);
  }
  function hwCountdown(h){
    if (h.completed) return { cls: "ok", txt: "تم الإنجاز" };
    const diff = U.daysBetween(U.todayKey(), h.deadline);
    if (diff < 0) return { cls: "critical", txt: "متأخر" };
    if (diff === 0) return { cls: "critical", txt: "مستحق اليوم" };
    if (diff === 1) return { cls: "critical", txt: "متبقي يوم واحد" };
    return { cls: "ok", txt: "متبقي " + diff + " أيام" };
  }

  /* ══ STUDY BLOCKS (timer completions + sessions) ══ */
  function addBlock(data){
    const b = Object.assign({
      id: U.uid(), date: U.todayKey(), ts: U.iso(), startedAt: null,
      subject: D.defSubject(), minutes: 0, mode: "custom", title: "", notes: ""
    }, data);
    if (b.minutes <= 0) return null;
    state.blocks.push(b);
    logActivity("أنهيت جلسة " + U.fmtDur(b.minutes) + " في " + D.subjName(b.subject), "sessions", "study");
    const xp = grantXP(xpOf(b), b.mode === "pomodoro" ? "جولة بومودورو" : b.mode === "focus" ? "جلسة تركيز" : "جلسة دراسة");
    if (b.mode === "pomodoro") state.pomodoroCount++;
    addNotif("sessionDone", "أحسنت!", "أنهيت " + U.fmtDur(b.minutes) + " دراسة في " + D.subjName(b.subject) + " +" + xp.amount + " XP", "sessions");
    changed("block_added");
    return { block: b, xp };
  }
  function deleteBlock(id){
    state.blocks = state.blocks.filter(b => b.id !== id);
    changed("block_deleted");
  }

  /* ══ MISTAKES ══ */
  function addMistake(data){
    const m = Object.assign({
      id: U.uid(), subject: D.defSubject(), type: "mcq",
      question: "", imageUrl: "", options: [], correctAnswer: "", studentAnswer: "",
      correctAnswerId: "", studentAnswerId: "",
      explanation: "", reason: "", modelAnswer: "", keyPoints: [],
      status: "new", reviews: 0, reviewLog: [],
      createdAt: U.iso(), lastWrong: 0, reviewStage: 0, nextReview: U.todayKey()
    }, data);
    if (!m.keyPoints || !m.keyPoints.length) m.keyPoints = U.sentencePoints(m.modelAnswer);
    state.mistakes.push(m);
    logActivity("سجّلت خطأً في " + D.subjName(m.subject), "errors", "mistake");
    changed("mistake_added");
    return m;
  }
  function findMistake(id){ return state.mistakes.find(m => m.id === id); }
  function updateMistake(id, patch){
    const m = findMistake(id); if (!m) return;
    Object.assign(m, patch);
    changed("mistake_updated");
  }
  function deleteMistake(id){
    state.mistakes = state.mistakes.filter(m => m.id !== id);
    changed("mistake_deleted");
  }
  function recordReview(id, result){
    const m = findMistake(id); if (!m) return;
    m.reviews = (m.reviews || 0) + 1;
    m.reviewLog = m.reviewLog || [];
    m.reviewLog.push({ date: U.todayKey(), correct: result.correct, score: result.score || 0, answerId: result.answerId || "", ts: U.iso() });
    if (result.answerId) m.studentAnswerId = String(result.answerId).trim().toUpperCase();
    if (result.correct){
      m.lastWrong = 0;
      m.reviewStage = (m.reviewStage || 0) + 1;
      const idx = Math.min(m.reviewStage - 1, REVIEW_INTERVALS.length - 1);
      m.nextReview = U.addDaysKey(U.todayKey(), REVIEW_INTERVALS[idx]);
      if (m.status === "new") m.status = "improving";
      else if (m.status === "review" || m.status === "improving") m.status = "mastered";
    } else {
      m.lastWrong = (m.lastWrong || 0) + 1;
      m.reviewStage = 0;
      m.nextReview = U.todayKey();
      m.status = "review";
    }
    if (result.correct && result.score < 1) m.status = "improving";
    if (result.correct) grantXP(REWARDS.mistakeReview, "مراجعة أخطاء");
    logActivity(result.correct ? "أجبت صحيحًا على سؤال من بنك أخطائك" : "أخطأت مجددًا في سؤال من بنك أخطائك",
      result.correct ? "check" : "errors", "review");
    changed("mistake_reviewed");
    return m;
  }

  /* ── Spaced repetition ── */
  const REVIEW_INTERVALS = [1, 3, 7]; // days: بعد يوم / 3 أيام / أسبوع
  function reviewQueue(){
    const today = U.todayKey();
    return state.mistakes.filter(m =>
      m.status === "new" || m.status === "review" ||
      (m.nextReview && m.nextReview <= today));
  }
  function reviewSchedules(){
    const today = U.todayKey();
    return state.mistakes.map(m => ({
      id: m.id, status: m.status, nextReview: m.nextReview,
      fresh: m.nextReview == null || m.nextReview > today, due: m.nextReview != null && m.nextReview <= today,
      stage: m.reviewStage || 0
    }));
  }

  /* ══ EXAMS (exam mode reports) ══ */
  function addExam(data){
    const x = Object.assign({
      id: U.uid(), ts: U.iso(), date: U.todayKey(), title: "",
      subjects: [], count: 0, correct: 0, score: 0, durationSec: 0, wrong: []
    }, data);
    state.exams.push(x);
    logActivity("أنهيت امتحانًا: " + x.correct + "/" + x.count + " صحيح (" + Math.round(x.score * 100) + "%)", "achievements", "exam");
    addNotif("exam", "امتحان مكتمل", "أنجزت امتحانًا: " + x.correct + "/" + x.count + " (" + Math.round(x.score * 100) + "%) — " + U.fmtClockFullWords(x.durationSec || 0), "achievements", { key: "exam_" + x.id });
    changed("exam_added");
    return x;
  }

  /* ══ Daily summary ══ */
  function dailySummary(k){
    const d = state.daily[k] || {};
    const tomorrow = U.addDaysKey(k, 1);
    return {
      k,
      studyMin: d.studyMin || 0,
      sessions: d.sessions || 0,
      pomodoros: d.pomodoros || 0,
      exams: d.exams || 0,
      reviews: d.reviews || 0,
      tasksDone: state.tasks.filter(t => t.completed && t.completedOn === k).length,
      hwDone: state.homework.filter(h => h.completed && h.completedOn === k).length,
      hwToday: state.homework.filter(h => !h.completed && h.deadline === k).length,
      hwTomorrow: state.homework.filter(h => !h.completed && h.deadline === tomorrow).length,
      dueReviewsTomorrow: state.mistakes.filter(m => m.nextReview && m.nextReview === tomorrow).length
    };
  }
  function dailySummaryText(sm, isToday){
    const parts = [];
    if (sm.studyMin) parts.push(U.fmtDur(sm.studyMin) + " دراسة");
    if (sm.sessions) parts.push(sm.sessions + " جلسات");
    if (sm.tasksDone) parts.push(sm.tasksDone + " مهام أنجزتها");
    if (sm.hwDone) parts.push(sm.hwDone + " واجبات");
    if (sm.reviews) parts.push(sm.reviews + " مراجعات أخطاء");
    if (sm.exams) parts.push(sm.exams + " امتحانات");
    let txt = (isToday ? "أنجزت اليوم:" : "أنجزت أمس:") + " " + (parts.join("، ") || "لا شيء مسجل.");
    if (!isToday){
      const later = [];
      if (sm.dueReviewsTomorrow) later.push(sm.dueReviewsTomorrow + " مراجعات أخطاء غدًا");
      if (sm.hwTomorrow) later.push(sm.hwTomorrow + " واجبات غدًا");
      if (later.length) txt += " القادم:" + later.join("، ") + ".";
    }
    return txt;
  }

  /* ══ NOTES ══ */
  function addNote(data){
    const n = Object.assign({
      id: U.uid(), title: "", content: "", subject: D.defSubject(), tags: [],
      pinned: false, archived: false, createdAt: U.iso(), updatedAt: U.iso()
    }, data);
    state.notes.push(n);
    logActivity("أضفت ملاحظة: «" + n.title + "»", "notes", "note");
    changed("note_added");
    return n;
  }
  function findNote(id){ return state.notes.find(n => n.id === id); }
  function updateNote(id, patch){
    const n = findNote(id); if (!n) return;
    patch.updatedAt = U.iso();
    Object.assign(n, patch);
    changed("note_updated");
  }
  function deleteNote(id){
    state.notes = state.notes.filter(n => n.id !== id);
    changed("note_deleted");
  }
  function togglePin(id){
    const n = findNote(id); if (!n) return;
    n.pinned = !n.pinned;
    changed("note_pinned");
  }
  function toggleArchive(id){
    const n = findNote(id); if (!n) return;
    n.archived = !n.archived;
    changed("note_archived");
  }

  /* ══ SETTINGS / user ══ */
  function updateSettings(patch){
    const merged = Object.assign({}, patch);
    if (merged.notif && state.settings && state.settings.notif){
      merged.notif = Object.assign({}, state.settings.notif, merged.notif);
    }
    Object.assign(state.settings, merged);
    save();
    U.emit("settings", state.settings);
    U.emit("change", { reason: "settings" });
  }
  function updateUser(patch){
    Object.assign(state.user, patch);
    save();
    U.emit("change", { reason: "user" });
  }

  /* ══ Achievements ══ */
  function evaluateAchievements(){
    const t0 = state.xp;
    const unlockedNow = [];
    D.defs.forEach(d => {
      if (state.unlocked[d.id]) return;
      let ok = false;
      try { ok = d.check(state); } catch(e){}
      if (ok){
        state.unlocked[d.id] = U.iso();
        const xp = grantXP(d.xp, "إنجاز: " + d.name);
        addNotif("achievement", "إنجاز مفتوح", "«" + d.name + "» +" + d.xp + " XP", "achievements", { key: "ach_" + d.id });
        logActivity("فتحت إنجازًا: «" + d.name + "»", "achievements", "achievement");
        unlockedNow.push({
          id: d.id, name: d.name, desc: d.desc, icon: d.icon, group: d.group,
          xp: d.xp, level: xp.info.level
        });
      }
    });
    if (unlockedNow.length) U.emit("unlocked", unlockedNow);
    return unlockedNow;
  }

  /* ══ Notifications management ══ */
  function markRead(id){ const n = state.notifications.find(n => n.id === id); if (n) n.read = true; save(); U.emit("change",{reason:"notif"}); }
  function markAllRead(){ state.notifications.forEach(n => n.read = true); save(); U.emit("change",{reason:"notif"}); }
  function clearNotifications(){ state.notifications = []; save(); U.emit("change",{reason:"notif"}); }

  /* ══ Reminder generation ══ */
  function generateReminders(opts){
    opts = opts || {};
    const s = state.settings.notif;
    const today = U.todayKey();
    function exists(key){ return state.notifications.some(n => n.key === key); }
    function addOnce(type, key, title, body, icon){
      if (exists(key)) return;
      if (type === "homework" && !s.homework) return;
      if (type === "task" && !s.study) return;
      if (type === "goal" && !s.dailyGoal) return;
      if (type === "achievement" && !s.achievements) return;
      if (type === "review" && !s.review) return;
      addNotif(type, title, body, icon, { key });
    }
    if (!opts.silentHomework){
      state.homework.forEach(h => {
        if (h.completed) return;
        const diff = U.daysBetween(today, h.deadline);
        if (diff === 0) addOnce("homework", "hw_today_" + h.id, "واجب مستحق اليوم", "واجب «" + h.title + "» مستحق اليوم في " + D.subjName(h.subject), "homework");
        if (diff === 1) addOnce("homework", "hw_tomorrow_" + h.id, "واجب مستحق غدًا", "لديك واجب «" + h.title + "» مستحق غدًا في " + D.subjName(h.subject), "homework");
        if (diff < 0) addOnce("homework", "hw_overdue_" + h.id, "واجب متأخر", "واجب «" + h.title + "» أصبح متأخرًا!", "homework");
      });
    }
    const pendingToday = state.tasks.filter(t => !t.completed && t.date === today);
    if (pendingToday.length && s.study)
      addOnce("task", "tasks_pending_" + today, "مهام اليوم", "لديك " + pendingToday.length + " مهام بانتظارك اليوم", "tasks");
    // تذكير بمهمة مجدولة (نافذة 0–15 دقيقة): يعمل بعد الإغلاق والرجوع حتى 15 دقيقة
    if (s.study){
      const now = new Date();
      const pad = n => (n < 10 ? "0" : "") + n;
      const toMin = s => { const p = (s || "").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); };
      const nowMin = now.getHours() * 60 + now.getMinutes();
      pendingToday.forEach(t => {
        if (!t.time) return;
        const taskMin = toMin(t.time);
        const diff = nowMin - taskMin;
        if (diff >= 0 && diff <= 15){
          const label = diff <= 1 ? "مهمة مجدولة الآن" : "فات موعد مهمة";
          const body = "مهمة «" + t.title + "»" +
            (t.subject && t.subject !== "general" ? " — " + D.subjName(t.subject) : "") +
            (diff ? " (كان موعدها " + t.time + ")" : "");
          addOnce("task", "task_due_" + t.id + "_" + today + "_" + t.time, label, body, "tasks");
        }
      });
    }
    const mistakesToReview = reviewQueue();
    if (mistakesToReview.length)
      addOnce("review", "review_pending_" + today, "بنك الأخطاء", "لديك " + mistakesToReview.length + " أخطاء بانتظار مراجعة اليوم", "errors");
    const yest = U.yesterdayKey();
    const ys = dailySummary(yest);
    if ((ys.studyMin || ys.tasksDone || ys.hwDone || ys.reviews || ys.exams) && s.study)
      addOnce("summary", "daily_summary_" + yest, "خلاصة يوم أمس", dailySummaryText(ys, false), "analytics");
    const td = dailySummary(today);
    if (new Date().getHours() >= 20 && (td.studyMin || td.tasksDone || td.hwDone || td.reviews || td.exams) && s.dailyGoal)
      addOnce("summary", "daily_summary_" + today, "ملخص يومك الحالي", dailySummaryText(td, true), "analytics");
    if (!D.isActiveDay(state, today) && D.longestStreakOf(state) >= 3 && U.isToday(today) && s.streak){
      setTimeout(() => {
        if (!D.isActiveDay(state, U.todayKey()))
          addOnce("streak", "streak_warn_" + today, "حافظ على سلسلتك", "لم تدرس اليوم بعد — سلسلتك من " + D.streakOf(state) + " أيام في خطر", "flame");
      }, 2000);
    }
  }

  /* ══ Next Best Action ══ */
  function nextBestAction(){
    const today = U.todayKey();
    const s = state;
    const tasks = s.tasks.filter(t => !t.completed);
    const overdue = tasks.filter(t => t.date < today);
    const todayPending = tasks.filter(t => t.date === today);
    const hw = s.homework.filter(h => !h.completed);
    const hwOverdue = hw.filter(h => h.deadline < today);
    const hwToday = hw.filter(h => h.deadline === today);
    const hwSoon = hw.filter(h => h.deadline === U.addDaysKey(today, 1));
    const dueQuiz = s.mistakes.filter(m => m.status === "new" || m.status === "review");
    const todayMin = (s.daily[today] || {}).studyMin || 0;

    function byPriority(arr){ return arr.slice().sort((a,b) => prioRank(a.priority) - prioRank(b.priority)); }
    function prioRank(p){ return p === "high" ? 0 : p === "mid" ? 1 : 2; }

    if (overdue.length){
      const t = byPriority(overdue)[0];
      return { icon: "tasks", title: "أنجز مهمتك المتأخرة", action: "ابدأ الآن",
        body: "مهمة «" + t.title + "» متأخرة منذ " + U.daysBetween(t.date, today) + " يوم.",
        reason: "ترتيب الأولوية الأقصى للمتأخرة — أنجزها أولًا للحفاظ على نسبة الالتزام.",
        btn: ["فتح المهام"], route: "todo" };
    }
    if (hwOverdue.length){
      const h = hwOverdue[0];
      return { icon: "homework", title: "واجب متأخر بانتظارك", action: "أنجز الواجب",
        body: "واجب «" + h.title + "» في " + D.subjName(h.subject) + " متأخر.",
        reason: "الواجبات المتأخرة تتراكم — إنجازها الآن يريح جدول الأيام القادمة.",
        btn: ["فتح الواجبات"], route: "homework" };
    }
    if (todayPending.length){
      const t = byPriority(todayPending)[0];
      return { icon: "tasks", title: "مهمة اليوم القادمة", action: "ابدأ الآن",
        body: "مهمة «" + t.title + "» بانتظارك اليوم" + (t.time ? " في " + t.time : "") + ".",
        reason: "إنجاز مهام اليوم يبقي التقويم نظيفًا ويرفع نسبة الالتزام.",
        btn: ["فتح المهام"], route: "todo" };
    }
    if (hwToday.length || hwSoon.length){
      const h = (hwToday.length ? hwToday : hwSoon)[0];
      const when = hwToday.length ? "اليوم" : "غدًا";
      return { icon: "homework", title: "حان وقت الواجب", action: "ابدأ الآن",
        body: "واجب «" + h.title + "» في " + D.subjName(h.subject) + " مستحق " + when + ".",
        reason: "أنهه الآن لتتفاجأ بمتسع من الوقت غدًا للمراجعة.",
        btn: ["فتح الواجبات"], route: "homework" };
    }
    if (dueQuiz.length){
      return { icon: "errors", title: "نقاط ضعفك بانتظارك", action: "اختبرني من أخطائي",
        body: "لديك " + dueQuiz.length + " أخطاء تحتاج مراجعة.",
        reason: "مراجعة الأخطاء أسرع طريق لرفع العلامات — اختبر نفسك الآن.",
        btn: ["مراجعة الأخطاء"], route: "errors" };
    }
    if (todayMin < s.settings.dailyGoalMinutes){
      const weakest = D.subjects.filter(x => x.id !== "general")
        .map(x => ({ x, min: s.blocks.filter(b => b.subject === x.id).reduce((a,b) => a + b.minutes, 0) }))
        .sort((a,b) => a.min - b.min)[0];
      const name = weakest ? weakest.x.name : "التاريخ";
      return { icon: "focus", title: "أكمل هدف اليوم", action: "ابدأ Focus",
        body: "أنجزت " + U.fmtDur(todayMin) + " من أصل " + U.fmtDur(s.settings.dailyGoalMinutes) + ". جلسة " + s.settings.focusDuration + " دقيقة في " + name + " سترفعك.",
        reason: "الالتزام بالهدف اليومي يبني سلسلة الالتزام وينمّي XP بسرعة.",
        btn: ["بدء جلسة"], route: "timer" };
    }
    return { icon: "star", title: "يوم مكتمل", action: "",
      body: "أنجزت هدفك اليوم بالكامل. خذ استراحة تستحقها، ثم خطط ليوم غد المشرق.",
      reason: "أنت متقدم على نفسك — استخدم الوقت لمراجعة الملاحظات أو التخطيط.",
      btn: ["عرض التقويم"], route: "calendar" };
  }

  /* ══ Backup ── */
  function exportData(){
    return JSON.stringify(
      { app: "StudyOS", version: 1, exportedAt: U.iso(), data: state }, null, 2);
  }
  function validateImport(json){
    try {
      const p = JSON.parse(json);
      const d = p && (p.data || p);
      if (!d || typeof d !== "object") return { ok: false, error: "بنية الملف غير صحيحة." };
      const arr = k => Array.isArray(d[k]);
      if (!arr("tasks") || !arr("homework") || !arr("blocks") || !arr("mistakes") || !arr("notes"))
        return { ok: false, error: "الملف لا يبدو نسخة احتياطية من Study OS." };
      return { ok: true, preview: {
        tasks: d.tasks.length, homework: d.homework.length, blocks: d.blocks.length,
        mistakes: d.mistakes.length, notes: d.notes.length, xp: d.xp || 0, user: (d.user && d.user.name) || "?"
      } };
    } catch(e){ return { ok: false, error: "تعذر قراءة الملف — صيغة JSON غير صالحة." }; }
  }
  function importData(json){
    const p = JSON.parse(json);
    const d = p && (p.data || p);
    state = Object.assign(defaults(), d);
    normalize();
    save();
    U.emit("change", { reason: "import" });
  }

  /* ══ Reset ══ */
  function seedDemo(){
    const today = U.todayKey();
    const yester = U.yesterdayKey();
    const tomorrow = U.tomorrowKey();
    const S = {};
    S.tasks = [
      { id: U.uid(), title: "مراجعة قواعد اللغة العربية", desc: "المجرورات وأحوالها", subject: "arabic", priority: "high", date: today, time: "17:00", tags: ["مراجعة"], completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "حفظ 10 كلمات إنجليزية", desc: "من الوحدة الرابعة", subject: "english", priority: "mid", date: today, time: "18:30", tags: ["مفردات"], completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "قراءة درس التاريخ", desc: "الحركة الوطنية في الجزائر", subject: "history", priority: "low", date: today, time: "20:00", tags: [], completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "حل تمارين الدوال", desc: "3 تمارين من الكتاب", subject: "programming", priority: "high", date: today, time: "21:00", tags: ["تمارين"], completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "مراجعة الذهبية للفصل الأول", subject: "history", priority: "mid", date: yester, time: "16:30", tags: [], completed: true, completedOn: yester, completedAt: U.iso(), createdAt: U.iso() },
      { id: U.uid(), title: "كتابة فقرة بالإنجليزية", subject: "english", priority: "mid", date: yester, time: "19:00", tags: ["كتابة"], completed: true, completedOn: yester, completedAt: U.iso(), createdAt: U.iso() },
      { id: U.uid(), title: "واجب الرياضيات: المتتاليات", subject: "programming", priority: "high", date: U.addDaysKey(today, 1), time: "09:00", tags: ["واجب"], completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "تحضير درس النصوص", subject: "arabic", priority: "low", date: U.addDaysKey(today, 2), time: "15:00", tags: [], completed: false, createdAt: U.iso() }
    ];
    S.homework = [
      { id: U.uid(), title: "واجب التاريخ: الحركة الوطنية", subject: "history", lesson: "الوحدة 3", desc: "إجابة عن السؤال المقالي صفحة 45", exercises: 2, deadline: tomorrow, priority: "high", completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "تدريبات اللغة الإنجليزية", subject: "english", lesson: "Unit 4 Grammar", desc: "تمارين 1-4", exercises: 4, deadline: U.addDaysKey(today, 2), priority: "mid", completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "واجب البرمجة: حلقة تكرار", subject: "programming", lesson: "Loops", desc: "كتابة 5 أمثلة", exercises: 5, deadline: U.addDaysKey(today, 3), priority: "mid", completed: false, createdAt: U.iso() },
      { id: U.uid(), title: "تمارين اللغة العربية", subject: "arabic", lesson: "المفعول المطلق", desc: "", exercises: 3, deadline: U.addDaysKey(today, -1), priority: "low", completed: true, completedOn: yester, createdAt: U.iso() }
    ];
    S.blocks = [];
    const modes = ["custom", "custom", "focus", "pomodoro"];
    const subjects = ["arabic", "english", "history", "programming"];
    for (let i = 0; i < 44; i++){
      const d = U.addDaysKey(today, -Math.min(i, 33));
      const mins = [25, 30, 45, 60, 20, 90][Math.floor(Math.random()*6)];
      const mode = modes[Math.floor(Math.random()*modes.length)];
      const subj = subjects[Math.floor(Math.random()*4)];
      const dt = U.fromKey(d); dt.setHours(17 + Math.floor(Math.random()*4), Math.floor(Math.random()*60), 0, 0);
      S.blocks.push({
        id: U.uid(), date: d, ts: dt.toISOString(), startedAt: new Date(dt.getTime() - mins*60000).toISOString(),
        subject: subj, minutes: mins, mode, title: "", notes: ""
      });
    }
    S.blocks.push({ id: U.uid(), date: today, ts: U.iso(), startedAt: U.iso(), subject: "history", minutes: 35, mode: "focus", title: "مراجعة مركزة", notes: "" });
    S.mistakes = [
      { id: U.uid(), subject: "history", type: "mcq", question: "متى تمّ تأسيس حكومة تصفية الاستعمار في الجزائر؟", options: ["1958", "1962", "1960", "1956"], correctAnswer: "1958", studentAnswer: "1962", explanation: "تأسست حكومة تصفية الاستعمار عام 1958 لتجهيز الجزائر للاستقلال.", reason: "خلط بين التواريخ", status: "new", reviews: 0, reviewLog: [], createdAt: U.iso() },
      { id: U.uid(), subject: "arabic", type: "essay", question: "ما إعراب المفعول المطلق؟ وما حالته إذا كان مؤكدًا للفعل?", studentAnswer: "المفعول المطلق يذكر بعد الفعل", modelAnswer: "المفعول المطلق مصدر منصوب يذكر بعد فعل من لفظه لفائدة معنوية كمصدر مؤكد للفعل أو مبين للنوع أو مبين للعدد. إذا كان مؤكدًا للفعل، يكون مفردًا.", explanation: "يذكّر الفعل بوظيفة المفعول المطلق في التركيب.", reason: "نقص في التفاصيل", status: "review", reviews: 1, reviewLog: [{ date: U.addDaysKey(today, -2), correct: false, score: 0.3, ts: U.iso() }], createdAt: U.iso(), keyPoints: [] },
      { id: U.uid(), subject: "programming", type: "mcq", question: "أي من التالي صحيح حول حلقة for في JavaScript؟", options: ["تستخدم لتنفيذ كود عددًا محددًا من المرات", "متعذرة الاستخدام مع المصفوفات", "تنفذ كودًا مرة واحدة", "تستخدم للتعامل مع DOM فقط"], correctAnswer: "تستخدم لتنفيذ كود عددًا محددًا من المرات", studentAnswer: "تنفذ كودًا مرة واحدة", explanation: "for تنفذ عددًا محددًا من التكرارات.", reason: "لم أقرأ البدائل جيدًا", status: "improving", reviews: 2, reviewLog: [{ date: U.addDaysKey(today, -4), correct: false, score: 0, ts: U.iso() }, { date: U.addDaysKey(today, -1), correct: true, score: 1, ts: U.iso() }], createdAt: U.iso() },
      { id: U.uid(), subject: "english", type: "mcq", question: "Choose the correct form: She … to the market yesterday.", options: ["go", "went", "goes", "gone"], correctAnswer: "went", studentAnswer: "went", explanation: "لأن الحدث وقع في الماضي.", reason: "", status: "mastered", reviews: 3, reviewLog: [{ date: U.addDaysKey(today, -6), correct: false, score: 0, ts: U.iso() }, { date: U.addDaysKey(today, -5), correct: true, score: 1, ts: U.iso() }, { date: U.addDaysKey(today, -3), correct: true, score: 1, ts: U.iso() }], createdAt: U.iso() }
    ];
    S.mistakes[1].keyPoints = U.sentencePoints(S.mistakes[1].modelAnswer);
    S.notes = [
      { id: U.uid(), title: "قاعدة المفعول المطلق", content: "المفعول المطلق: مصدر منصوب من لفظ الفعل.\n• مؤكد للفعل: رحتُ رحيلًا.\n• مبين للنوع: سار المشاة سيرَ المتثاقل.", subject: "arabic", tags: ["قواعد"], pinned: true, archived: false, createdAt: U.iso(), updatedAt: U.iso() },
      { id: U.uid(), title: "تواريخ مهمة في التاريخ", content: "• الحكومة المؤقتة: 1958\n• الاستقلال: 1962\n• بيان أول نوفمبر: 1954", subject: "history", tags: ["تواريخ"], pinned: false, archived: false, createdAt: U.iso(), updatedAt: U.iso() },
      { id: U.uid(), title: "For vs While", content: "for: عندما نعرف عدد التكرارات.\nwhile: عندما يعتمد التكرار على شرط.", subject: "programming", tags: ["برمجة"], pinned: true, archived: false, createdAt: U.iso(), updatedAt: U.iso() },
      { id: U.uid(), title: "مفردات Unit 4", content: "achieve = أنجز\nprove = يثبت\nreliable = موثوق", subject: "english", tags: ["مفردات"], pinned: false, archived: false, createdAt: U.iso(), updatedAt: U.iso() }
    ];
    state.tasks = state.tasks.concat(S.tasks);
    state.homework = state.homework.concat(S.homework);
    state.blocks = S.blocks;
    state.mistakes = S.mistakes;
    state.notes = S.notes;
    state.user = { name: "يوسف", avatar: "🎓", grade: "ثانية ثانوي — بكالوريا" };
    state.seeded = true;
    rebuildDaily();
    save();
    changed("seeded");
  }

  function resetAll(){
    state = defaults();
    save();
    U.emit("change", { reason: "reset" });
  }

  /* dashboard state bundling */
  function todayStats(){
    const today = U.todayKey();
    const daily = state.daily[today] || {};
    const goalt = (state.daily[today] || {}).studyMin || 0;
    const allToday = state.tasks.filter(t => t.date === today);
    const doneToday = allToday.filter(t => t.completed).length;
    return {
      today, daily,
      goalMin: goalt, goalTotal: state.settings.dailyGoalMinutes,
      goalPct: Math.min(100, Math.round(goalt / state.settings.dailyGoalMinutes * 100)),
      tasksTotal: allToday.length, tasksDone: doneToday,
      tasksLeft: allToday.length - doneToday,
      overdueCount: state.tasks.filter(t => !t.completed && t.date < today).length,
      subjectsCount: new Set(state.blocks.filter(b => b.subject !== "general").map(b => b.subject)).size
    };
  }

  function getState(){ return state; }

  /* ═══════════ مساحات العمل (ضيف / مستخدم) + الدمج الآمن ═══════════ */

  /* هل تحتوي الحالة على بيانات يملكها المستخدم فعلاً؟
     (نتجاهل التذكيرات وسجل النشاط لأنها مشتقة/مؤقتة وقد تُضاف تلقائيًا عند الإقلاع) */
  function hasContent(st){
    if (!st) return false;
    if (st.seeded) return true;
    if ((st.xp | 0) > 0) return true;
    if (["tasks","homework","blocks","mistakes","notes","exams"].some(k => (st[k] || []).length)) return true;
    if (st.unlocked && Object.keys(st.unlocked).length) return true;
    try {
      const def = defaults();
      if (JSON.stringify(st.settings) !== JSON.stringify(def.settings)) return true;
      if (st.user && (st.user.name !== def.user.name || st.user.avatar !== def.user.avatar || st.user.grade !== def.user.grade)) return true;
    } catch(e){}
    return false;
  }

  function itemTime(x){
    return (x && (x.updatedAt || x.updated_at || x.ts || x.createdAt || x.completedAt || "")) || "";
  }

  /* دمج مصفوفتين بواسطة id — يمنع التكرار، ويأخذ الأحدث عند التعارض */
  function mergeById(a, b){
    const map = new Map();
    (a || []).forEach(x => { if (x) map.set(x.id != null ? x.id : U.uid(), x); });
    (b || []).forEach(x => {
      if (!x) return;
      const id = x.id != null ? x.id : U.uid();
      const ex = map.get(id);
      if (!ex){ map.set(id, x); return; }
      map.set(id, itemTime(x) >= itemTime(ex) ? x : ex);
    });
    return Array.from(map.values());
  }

  function mergeActivity(a, b){
    const map = new Map();
    (a || []).concat(b || []).forEach(x => { if (x) map.set((x.ts || "") + "|" + (x.txt || ""), x); });
    return Array.from(map.values()).sort((x, y) => (y.ts || "").localeCompare(x.ts || "")).slice(0, 150);
  }

  /* merge آمن: كل الكيانات تُوحَّد بالـ id، والقيم العددية تأخذ الأقصى */
  function mergeStates(base, extra, opts){
    opts = opts || {};
    const out = Object.assign(defaults(), base || {});
    const e = extra || {};
    out.tasks = mergeById(out.tasks, e.tasks);
    out.homework = mergeById(out.homework, e.homework);
    out.blocks = mergeById(out.blocks, e.blocks);
    out.mistakes = mergeById(out.mistakes, e.mistakes);
    out.notes = mergeById(out.notes, e.notes);
    out.exams = mergeById(out.exams, e.exams);
    out.levelUps = mergeById(out.levelUps, e.levelUps);
    out.xp = Math.max(out.xp | 0, e.xp | 0);
    out.pomodoroCount = Math.max(out.pomodoroCount | 0, e.pomodoroCount | 0);
    out.seeded = !!(out.seeded || e.seeded);
    out.unlocked = Object.assign({}, out.unlocked, e.unlocked || {});
    /* skipPrefs: لا نُبقي تفضيلات الطرف الآخر عند الدمج — تُستخدم عند نقل بيانات الضيف
       إلى حساب فيه محتوى بالفعل، حتى لا تُستبدل إعدادات الحساب بإعدادات الضيف الافتراضية */
    if (!opts.skipPrefs){
      out.settings = Object.assign({}, out.settings, e.settings || {});
      out.settings.notif = Object.assign({}, (base && base.settings && base.settings.notif) || {}, (e.settings && e.settings.notif) || {});
      out.user = Object.assign({}, out.user, e.user || {});
    }
    if (!opts.skipDerived){
      out.notifications = mergeById(out.notifications, e.notifications)
        .sort((x, y) => (y.ts || "").localeCompare(x.ts || "")).slice(0, 120);
      out.activityLog = mergeActivity(out.activityLog, e.activityLog);
    }
    rebuildDaily(out);
    return out;
  }

  /* payload محلي بصيغة مطابقة للسحابة */
  function localPayload(){ return { v: 1, savedAt: lastSavedAt || U.iso(), data: state }; }

  /* تبديل مساحة العمل: يفلش الحالية، ثم يحمّل الحالة المطلوبة (أو من المفتاح) ويحفظها */
  function activateWorkspace(key, nextState){
    flush();
    activeKey = key || KEY;
    if (nextState){
      state = normalizeState(Object.assign(defaults(), nextState));
    } else {
      const f = readFile(activeKey);
      state = f ? f.data : defaults();
      lastSavedAt = f ? (f.savedAt || "") : "";
    }
    normalize(state);
    flush();
    U.emit("change", { reason: "workspace" });
    return state;
  }

  function setLastUser(uid){
    try { if (uid) localStorage.setItem(LAST_USER_KEY, String(uid)); else localStorage.removeItem(LAST_USER_KEY); }
    catch(e){}
  }

  /* نسخة أمان من بيانات الضيف + إفراغ مساحة الضيف بعد نجاح النقل */
  function backupGuest(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(KEY + ".bak." + U.todayKey(), raw);
    } catch(e){}
  }
  function clearGuest(){ try { localStorage.removeItem(KEY); } catch(e){} }

  return {
    load, getState, save, flush, defaults,
    userKey, guestKey, currentKey, readFile,
    activateWorkspace, setLastUser, localPayload, hasContent, mergeStates,
    backupGuest, clearGuest,
    addTask, updateTask, deleteTask, toggleTask, rescheduleTask, findTask,
    addHomework, updateHw, deleteHw, toggleHw, findHw, refreshHwStatus, hwCountdown,
    addBlock, deleteBlock,
    addMistake, updateMistake, deleteMistake, findMistake, recordReview,
    reviewQueue, reviewSchedules, addExam, dailySummary, dailySummaryText,
    addNote, updateNote, deleteNote, findNote, togglePin, toggleArchive,
    updateSettings, updateUser,
    grantXP, xpOf, evaluateAchievements,
    addNotif, markRead, markAllRead, clearNotifications, unreadCount,
    generateReminders, nextBestAction,
    exportData, validateImport, importData,
    resetAll, seedDemo, rebuildDaily, changed,
    todayStats
  };
})();