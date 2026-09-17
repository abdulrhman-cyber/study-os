/* ═══════════════ STUDY OS — timer.js (custom / stopwatch / pomodoro / focus engine) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Timer = (function () {
  const U = App.Util;
  const D = App.Data;
  const Store = null; // set lazily

  let st = {
    mode: "idle",            // idle | running | paused | waiting
    type: "custom",          // custom | pomodoro | focus
    clock: "countdown",      // countdown | countup
    total: 0, remaining: 0, elapsed: 0,
    subject: D.defSubject(), title: "", notes: "",
    endAt: 0, startAt: 0,
    pomo: { phase: "study", cycle: 1, done: 0, studyMin: 25, breakMin: 5, longMin: 20, sessions: 4 },
    context: "page",
    list: null
  };
  let interval = null;

  function applySettings(s){
    st.pomo.studyMin = s.pomodoroStudy;
    st.pomo.breakMin = s.pomodoroBreak;
    st.pomo.longMin = s.pomodoroLong;
    st.pomo.sessions = s.pomodoroSessions;
  }

  function active(){
    return st.mode !== "idle";
  }
  function isRunning(){ return st.mode === "running"; }
  function isPaused(){ return st.mode === "paused" || st.mode === "waiting"; }

  function stopTick(){
    if (interval){ clearInterval(interval); interval = null; }
  }
  function emitTick(){
    U.emit("tick", snapshot());
  }

  function tick(){
    const now = Date.now();
    if (st.clock === "countdown"){
      st.remaining = Math.max(0, Math.ceil((st.endAt - now) / 1000));
    } else {
      st.elapsed = Math.floor((now - st.startAt) / 1000);
    }
    emitTick();
    if (st.clock === "countdown" && st.remaining <= 0){
      completeSegment();
    }
  }

  function start(){
    stopTick();
    const now = Date.now();
    if (st.clock === "countdown"){
      st.endAt = now + st.remaining * 1000;
    } else if (st.remaining > 0){ // resume from paused countup keeps elapsed
      st.startAt = now;
    }
    st.mode = "running";
    interval = setInterval(tick, 1000);
    emitTick();
    U.emit("timer", st);
  }
  function pause(){
    if (st.clock === "countdown"){
      const now = Date.now();
      st.remaining = Math.max(0, Math.ceil((st.endAt - now) / 1000));
    }
    st.mode = "paused";
    stopTick();
    emitTick();
    U.emit("timer", st);
  }
  function finish(cancel){
    stopTick();
    if (cancel){ reset(); return null; }
    if (st.type === "pomodoro" && st.pomo.phase !== "study"){
      st.pomo.phase = "study";
      if (st.pomo.cycle) st.pomo.cycle++;
      st.total = U.minToSec(st.pomo.studyMin);
      st.remaining = st.total;
      st.mode = "running";
      start();
      U.emit("phase", { msg: "جاهز لجولة جديدة؟", next: true });
      return null;
    }
    const sec = secondsSoFar();
    const minutes = Math.round(sec / 60);
    const shouldRecord = minutes >= 1 || st.type === "pomodoro" || st.type === "focus";
    if (!shouldRecord){ reset(); return { cancelled: true }; }
    const mode = st.type === "pomodoro" ? "pomodoro" : st.type === "focus" ? "focus" : "custom";
    const done = {
      sec, minutes, mode,
      subject: st.subject,
      label: st.type === "pomodoro" ? "بومودورو" : st.type === "focus" ? "جلسة تركيز" : "جلسة دراسة"
    };
    const xp = App.Store.addBlock({
      subject: st.subject, minutes, mode,
      title: st.title, notes: st.notes,
      startedAt: new Date(st.startAt || Date.now()).toISOString()
    });
    reset();
    U.emit("complete", done);
    if (xp && xp.xp) App.UI.floatXP(xp.xp.amount, done.label);
    return done;
  }
  function cancel(){
    stopTick();
    reset();
  }
  function reset(){
    st = Object.assign(st, {
      mode: "idle", type: "custom", clock: "countdown", total: 0, remaining: 0, elapsed: 0,
      subject: D.defSubject(), title: "", notes: "", endAt: 0, startAt: 0, context: "page",
      pomo: { phase: "study", cycle: 1, done: 0, studyMin: 25, breakMin: 5, longMin: 20, sessions: 4 }
    });
    applySettings(App.Store.getState().settings);
    emitTick();
    U.emit("timer", st);
  }

  function secondsSoFar(){
    if (st.clock === "countdown") return st.total - st.remaining;
    return st.elapsed;
  }

  /* ── launches ── */
  function launch(opts){
    opts = opts || {};
    applySettings(App.Store.getState().settings);
    st.type = opts.type || "custom";
    st.subject = opts.subject || D.defSubject();
    st.title = opts.title || "";
    st.notes = opts.notes || "";
    st.context = opts.context || "page";
    if (st.type === "pomodoro"){
      st.clock = "countdown";
      st.pomo = { phase: "study", cycle: 1, done: 0, studyMin: opts.studyMin || st.pomo.studyMin, breakMin: opts.breakMin, longMin: opts.longMin, sessions: opts.sessions };
      st.total = U.minToSec(st.pomo.studyMin);
      st.remaining = st.total;
    } else if (st.type === "focus"){
      st.clock = "countdown";
      const min = opts.minutes || App.Store.getState().settings.focusDuration;
      st.total = U.minToSec(min);
      st.remaining = st.total;
    } else {
      st.clock = opts.clock || "countdown";
      if (st.clock === "countdown"){
        const min = opts.minutes || 25;
        st.total = U.minToSec(min);
        st.remaining = st.total;
      } else {
        st.total = 0; st.elapsed = 0;
      }
    }
    start();
    return snapshot();
  }

  function completeSegment(){
    stopTick();
    if (st.type === "pomodoro"){
      const wasStudy = st.pomo.phase === "study";
      const min = st.pomo.phase === "study" ? st.pomo.studyMin : (st.pomo.phase === "longbreak" ? st.pomo.longMin : st.pomo.breakMin);
      const rec = wasStudy;
      if (rec){
        const xp = App.Store.addBlock({ subject: st.subject, minutes: min, mode: "pomodoro", title: st.title, notes: st.notes, startedAt: new Date(st.startAt).toISOString() });
        if (xp && xp.xp) App.UI.floatXP(xp.xp.amount, "بومودورو");
      }
      if (wasStudy){
        U.emit("phase", { msg: "أحسنت، وقت الراحة", next: true });
        st.pomo.done++;
        if (st.pomo.done % st.pomo.sessions === 0){
          st.pomo.phase = "longbreak";
        } else st.pomo.phase = "break";
        st.total = U.minToSec(st.pomo.phase === "break" ? st.pomo.breakMin : st.pomo.longMin);
        st.remaining = st.total;
        st.mode = "running";
        start();
      } else {
        U.emit("phase", { msg: st.pomo.phase === "longbreak" ? "استراحة طويلة انتهت. جاهز لجولة جديدة؟" : "جاهز لجولة جديدة؟", next: true });
        st.pomo.phase = "study";
        if (st.pomo.phase === "study") st.pomo.cycle++;
        st.total = U.minToSec(st.pomo.studyMin);
        st.remaining = st.total;
        st.mode = "running";
        start();
      }
    } else {
      const sec = st.clock === "countdown" ? st.total : st.elapsed;
      const minutes = Math.max(1, Math.floor(sec / 60));
      const xp = App.Store.addBlock({ subject: st.subject, minutes, mode: st.type === "focus" ? "focus" : "custom", title: st.title, notes: st.notes, startedAt: new Date(st.startAt || Date.now()).toISOString() });
      const done = { sec, minutes, mode: st.type, subject: st.subject, label: st.type === "focus" ? "جلسة تركيز" : "جلسة دراسة" };
      reset();
      U.emit("complete", done);
      if (xp && xp.xp) App.UI.floatXP(xp.xp.amount, done.label);
    }
  }

  function pomoDots(){
    const total = st.pomo.sessions;
    const idx = st.pomo.done % total;
    const arr = [];
    for (let i = 0; i < total; i++) arr.push(i < idx);
    return arr;
  }

  function snapshot(){
    const s = App.Store.getState().settings;
    const min = st.type === "pomodoro" ? (st.pomo.phase === "study" ? st.pomo.studyMin : st.pomo.phase === "break" ? st.pomo.breakMin : st.pomo.longMin) : st.type === "focus" ? st.focusMin || s.focusDuration : 0;
    let pct = 0;
    if (st.clock === "countdown" && st.total > 0){
      pct = Math.round(((st.total - st.remaining) / st.total) * 100);
    } else if (st.clock === "countup" && st.total > 0){
      pct = Math.min(100, Math.round((st.elapsed / (st.total * 60)) * 100));
    } else if (st.clock === "countup"){
      pct = 0;
    }
    return {
      mode: st.mode, type: st.type, clock: st.clock,
      total: st.total, remaining: st.remaining, elapsed: st.elapsed,
      subject: st.subject, title: st.title, notes: st.notes,
      phase: st.type === "pomodoro" ? st.pomo.phase : null,
      cycle: st.pomo.cycle, done: st.pomo.done,
      display: U.fmtClockFull(st.clock === "countdown" ? st.remaining : st.elapsed),
      displayLong: U.fmtClockFullWords(st.clock === "countdown" ? st.remaining : st.elapsed),
      pct, dots: pomoDots(), sessions: s.pomodoroSessions,
      focusMin: s.focusDuration,
      active: active()
    };
  }

  return {
    snapshot, active, isRunning, isPaused,
    launch, start: (m) => { if (st.mode === "paused") { start(); } }, resume: start,
    pause, finish, cancel, reset, tick
  };
})();