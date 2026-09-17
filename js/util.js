/* ═══════════════ STUDY OS — util.js (dates, formats, events) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Util = (function () {
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const MONTHS_ABBR = ["ينا","فبر","مار","أبر","ماي","يون","يول","أغس","سبت","أكت","نوف","ديس"];
  const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const DAYS_ABBR = ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"];

  function pad(n){ return String(n).padStart(2,"0"); }
  function dateKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate());
  }
  function fromKey(k){
    const p = k.split("-").map(Number);
    return new Date(p[0], p[1]-1, p[2]);
  }
  function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
  function addDaysKey(k, n){ return dateKey(addDays(fromKey(k), n)); }
  function todayKey(){ return dateKey(); }
  function yesterdayKey(){ return addDaysKey(todayKey(), -1); }
  function tomorrowKey(){ return addDaysKey(todayKey(), 1); }
  function isToday(k){ return k === todayKey(); }
  function isPast(k){ return k < todayKey(); }
  function isFuture(k){ return k > todayKey(); }

  function startOfWeek(d){ d = d || new Date(); const x = new Date(d); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
  function startOfYear(d){ return new Date(d.getFullYear(), 0, 1); }

  function fmtDate(k, opts){
    const d = fromKey(k); opts = opts || {};
    const dayName = DAYS_AR[d.getDay()];
    let out = d.getDate() + " " + MONTHS_AR[d.getMonth()];
    if (opts.year) out += " " + d.getFullYear();
    if (opts.dayName) out = dayName + "، " + out;
    if (opts.short) out = d.getDate() + " " + MONTHS_ABBR[d.getMonth()];
    return out;
  }
  function relativeDay(k){
    const t = todayKey();
    if (k === t) return "اليوم";
    if (k === yesterdayKey()) return "أمس";
    if (k === tomorrowKey()) return "غدًا";
    const diff = Math.round((fromKey(k) - fromKey(t)) / 86400000);
    if (diff < 0) return "منذ " + (-diff) + " أيام";
    return "بعد " + diff + " أيام";
  }
  function fmtClock(d){
    return { h: d.getHours(), m: pad(d.getMinutes()) };
  }
  function fmtTimeHM(d, withDay){ // "5:00 مساءً"
    let h = d.getHours(), m = d.getMinutes();
    const ap = h >= 12 ? "مساءً" : "صباحًا";
    let hh = h % 12; if (hh === 0) hh = 12;
    return hh + ":" + pad(m) + " " + ap;
  }
  function fmtDur(min){
    min = Math.round(min || 0);
    const h = Math.floor(min/60), m = min%60;
    if (h && m) return h + "س " + m + "د";
    if (h) return h + "س";
    return m + "د";
  }
  function fmtClockFull(sec){ // 2h 35m or 25:00 style for short
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    if (h > 0) return h + ":" + pad(m) + ":" + pad(s);
    return pad(m) + ":" + pad(s);
  }
  function fmtClockFullWords(sec){
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec/3600), m = Math.round((sec%3600)/60);
    if (h && m) return h + "س " + m + "د";
    if (h) return h + "س";
    return m + "د";
  }
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }
  function greeting(){
    const h = new Date().getHours();
    if (h < 5) return "وقت متأخر";
    if (h < 12) return "صباح الخير";
    if (h < 18) return "مساء الخير";
    return "مساء الخير";
  }
  function iso(){ return new Date().toISOString(); }
  function fmtNum(n){ return Number(n||0).toLocaleString("en-US"); }

  /* event bus */
  const listeners = {};
  function on(name, cb){ (listeners[name] = listeners[name] || []).push(cb); return () => { off(name, cb); }; }
  function off(name, cb){ const l = listeners[name]; if (!l) return; const i = l.indexOf(cb); if (i>=0) l.splice(i,1); }
  function emit(name, payload){ const l = listeners[name]; if (l) l.slice().forEach(cb => { try { cb(payload); } catch(e){ console.error(e); } }); }
  function debounce(fn, ms){
    let t; return function(){ clearTimeout(t); const a = arguments, th = this; t = setTimeout(() => fn.apply(th, a), ms); };
  }
  function el(html){
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function nl(html){ const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.childNodes; }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function minToSec(min){ return Math.round(min*60); }
  const AR_STOPWORDS = new Set(("في من على إلى عن أن إن الذي التي الذين اللذين اللاتي ثم أو و لا ما لم لن كان كانت هو هي هذا هذه ذلك تلك مع غير سوى كل بعض قد إذا أ ن ها ت م ك ي ب ل ا ف ون ية ية ث ه ان ر").split(" "));
  function keywords(text){
    if (!text) return [];
    const words = String(text).replace(/[^\u0600-\u06FF\s]/g," ").split(/\s+/);
    const seen = new Set(); const out = [];
    words.forEach(w => {
      w = w.trim();
      if (!w || w.length < 2) return;
      if (AR_STOPWORDS.has(w)) return;
      if (seen.has(w)) return;
      seen.add(w); out.push(w);
    });
    return out.slice(0, 24);
  }
  function sentencePoints(model){ // derive key points from model answer
    if (!model) return [];
    return String(model).split(/[.۔؟!؟\n؟,!]/).map(s => s.trim()).filter(s => s.length > 8).slice(0, 6);
  }
  function gradeEssay(student, model, manualPoints){
    const s = String(student||"").toLowerCase();
    let points = (manualPoints && manualPoints.length ? manualPoints : sentencePoints(model));
    let total = points.length, covered = 0; const miss = [];
    points.forEach(p => {
      const kws = keywords(p);
      if (!kws.length){ total--; return; }
      let hit = 0;
      kws.forEach(k => { if (s.includes(k)) hit++; });
      if (hit / kws.length >= 0.55) covered++; else miss.push(p);
    });
    if (!total) return { score: 0, covered: 0, miss: [] };
    const score = covered / total;
    return { score: score, covered: covered, miss: miss };
  }
  function daysBetween(a, b){ return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
  function shrinkImage(dataUrl, maxDim){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || 1) * scale));
          const h = Math.max(1, Math.round((img.height || 1) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/png"));
        } catch(e){ resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  function rangeKeys(fromK, toK){
    const out = []; let d = fromKey(fromK); const end = fromKey(toK);
    while (d <= end){ out.push(dateKey(d)); d = addDays(d, 1); }
    return out;
  }
  /* ── MCQ canonical answer IDs ── */
  function optLetter(idx){ return String.fromCharCode(65 + Number(idx)); }
  function optId(v, options){
    if (options && Array.isArray(options) && options.length){
      const i = options.indexOf(v);
      if (i >= 0) return String.fromCharCode(65 + i);
      if (typeof v === "number" && v >= 0 && v < options.length) return String.fromCharCode(65 + v);
    }
    if (typeof v === "number" && v >= 0 && v < 26) return String.fromCharCode(65 + v);
    const s = String(v == null ? "" : v).trim().toUpperCase();
    if (/^[A-Z]$/.test(s)) return s;
    if (/^\d+$/.test(s)){ const n = +s - 1; return (n >= 0 && n < 26) ? String.fromCharCode(65 + n) : ""; }
    return s;
  }
  function isAnswerCorrect(selected, correct, options){
    const s = optId(selected, options), c = optId(correct, options);
    return s.length === 1 && s === c;
  }
  function ansLabel(options, v){
    if (!Array.isArray(options) || !options.length) return String(v == null ? "" : v);
    const id = optId(v, options);
    const i = id.length === 1 ? id.charCodeAt(0) - 65 : -1;
    if (i >= 0 && i < options.length) return id + " — " + options[i];
    return String(v == null ? "" : v);
  }
  return {
    pad, dateKey, fromKey, addDays, addDaysKey, todayKey, yesterdayKey, tomorrowKey,
    isToday, isPast, isFuture, startOfWeek, startOfMonth, endOfMonth, startOfYear,
    fmtDate, relativeDay, fmtClock, fmtTimeHM, fmtDur, fmtClockFull, fmtClockFullWords,
    esc, uid, greeting, iso, fmtNum, on, off, emit, debounce, el, nl, clamp,
    minToSec, keywords, sentencePoints, gradeEssay, daysBetween, rangeKeys, shrinkImage,
    optLetter, optId, isAnswerCorrect, ansLabel,
    MONTHS_AR, MONTHS_ABBR, DAYS_AR, DAYS_ABBR
  };
})();