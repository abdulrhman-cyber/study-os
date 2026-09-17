/* ═══════════════ STUDY OS — ui.js (shared UI components) ═══════════════ */
"use strict";
window.App = window.App || {};
App.UI = (function () {
  const U = App.Util;
  const I = App.Icons;

  /* ── Toast ── */
  function toast(msg, type, icon){
    const root = document.getElementById("toast-root");
    const t = U.el(
      '<div class="toast ' + (type || "success") + '" role="status">' +
      '<span class="t-ic">' + I.get(icon || (type === "error" ? "close" : "check"), 15) + '</span>' +
      '<span>' + U.esc(msg) + '</span></div>');
    root.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 2600);
  }

  /* ── XP float ── */
  function floatXP(amount, label){
    const root = document.getElementById("float-root");
    const el = U.el('<div class="xp-float">+' + amount + ' XP' + (label ? " · " + U.esc(label) : "") + '</div>');
    root.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  /* ── Modal system ── */
  const modalRoot = () => document.getElementById("modal-root");
  function openModal(html, opts){
    opts = opts || {};
    const root = modalRoot();
    root.innerHTML = '<div class="modal-scrim" data-close></div>' + html;
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    if (opts.onOpen) opts.onOpen();
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
    const m = root.querySelector(".modal");
    if (m && opts.autoFocus){
      const f = m.querySelector(opts.autoFocus) || m.querySelector("input,textarea,select");
      if (f) setTimeout(() => { try { f.focus(); } catch(e){} }, 60);
    }
    return root;
  }
  function closeModal(){
    const root = modalRoot();
    root.classList.remove("open");
    root.innerHTML = "";
    document.body.style.overflow = "";
  }
  function modalShell(title, body, foot, opts){
    opts = opts || {};
    return '<div class="modal glass-3 ' + (opts.size || "") + '" role="dialog" aria-modal="true" aria-label="' + U.esc(title) + '">' +
      '<div class="modal-head"><div class="modal-title">' + title + '</div>' +
      '<button class="icon-btn modal-x" data-close aria-label="إغلاق">' + I.get("close", 18) + '</button></div>' +
      '<div class="modal-body">' + body + '</div>' +
      (typeof foot === "string" && foot ? '<div class="modal-foot">' + foot + '</div>' : "") + '</div>';
  }
  function confirmDialog(title, body, okLabel, onOk, opts){
    opts = opts || {};
    openModal(modalShell(
      '<span style="color:var(--' + (opts.danger ? "danger-text" : "gold-2") + ')">' + I.get(opts.danger ? "trash" : "info", 18) + '</span> ' + title,
      body,
      '<button class="btn ghost" data-close>إلغاء</button>' +
      '<button class="btn ' + (opts.danger ? "danger" : "primary") + '" id="cf-ok">' + okLabel + '</button>',
      { size: opts.size || "" }
    ), { autoFocus: "#cf-ok" });
    document.getElementById("cf-ok").addEventListener("click", function(){ closeModal(); onOk && onOk(); });
    return modalRoot();
  }

  /* ── Progress ring (SVG) ── */
  function ring(radius, stroke, pct, opts){
    opts = opts || {};
    const r = radius, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
    const id = "rr" + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 ' + (r*2+stroke) + ' ' + (r*2+stroke) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#BFA06A"/><stop offset=".6" stop-color="#D6B77A"/><stop offset="1" stop-color="#E8CF98"/></linearGradient></defs>' +
      '<circle class="ring-bg" cx="' + (r+stroke/2) + '" cy="' + (r+stroke/2) + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
      '<circle class="ring-fg" cx="' + (r+stroke/2) + '" cy="' + (r+stroke/2) + '" r="' + r + '" stroke-width="' + stroke + '" stroke="url(#' + id + ')" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
      '</svg>';
  }
  function parseRingDash(el){ /* recompute ring dashoffset from data-pct */
    const circ = el.parentElement ? null : null;
    const c = 2 * Math.PI * (el.getAttribute("data-r") || 52);
    el.style.strokeDashoffset = c * (1 - (el.dataset.pct || 0) / 100);
  }

  /* ── Progress bar html ── */
  function bar(pct, opts){
    opts = opts || {};
    return '<div class="progress ' + (opts.gold ? "gold" : "") + (opts.thin ? " thin" : "") + '" role="progressbar" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100">' +
      '<i style="width:' + Math.min(100, Math.max(0, pct)) + '%"></i></div>';
  }

  /* ── Empty state ── */
  function empty(icon, title, sub, cta){
    cta = cta || "";
    return '<div class="empty-state">' +
      '<div class="es-ic">' + I.get(icon, 30) + '</div>' +
      '<h4>' + title + '</h4>' +
      '<p>' + sub + '</p>' +
      (cta ? cta : "") + '</div>';
  }

  /* ── Subject helpers ── */
  function subjChip(id, opts){
    const s = App.Data.subjectById(id);
    opts = opts || {};
    return '<span class="chip" style="color:' + s.accent + ';border-color:color-mix(in srgb,' + s.accent + ' 35%, transparent)">' +
      I.subj(s, 13) + ' ' + s.name + '</span>';
  }
  function prioTag(p){
    const map = { high: ["prio-high","عالية"], mid: ["prio-mid","متوسطة"], low: ["prio-low","منخفضة"] };
    const m = map[p] || map.mid;
    return '<span class="badge ' + m[0] + '">' + I.get("flag", 11) + m[1] + '</span>';
  }
  function statCard(icon, val, label, cls){
    return '<div class="stat-card card glass-1"><div class="st-top"><div class="st-ic ' + (cls || "") + '">' + I.get(icon, 19) + '</div></div>' +
      '<div class="st-val">' + val + '</div><div class="st-label">' + label + '</div></div>';
  }

  /* ── Achievement popup queue ── */
  let popupQueue = [];
  let popupShowing = false;
  function enqueueUnlocked(list){
    (list || []).forEach(a => popupQueue.push(a));
    pumpPopups();
  }
  function pumpPopups(){
    if (popupShowing || !popupQueue.length) return;
    popupShowing = true;
    const a = popupQueue.shift();
    const root = document.getElementById("popup-root");
    const p = U.el(
      '<div class="ach-popup glass-3" role="alert">' +
      '<div class="ach-ic">' + I.get(a.icon, 42) + '</div>' +
      '<h3>' + U.esc(a.name) + '</h3>' +
      '<p>' + U.esc(a.desc) + '</p>' +
      '<span class="ach-xp">+' + a.xp + ' XP</span>' +
      '<div style="margin-top:10px;color:var(--text-3);font-size:11px;font-weight:700">إنجاز جديد</div>' +
      '</div>');
    root.appendChild(p);
    floatXP(a.xp, a.name);
    if (App.Data && App.Store){
      const info = App.Data.levelInfo(App.Store.getState().xp);
    }
    setTimeout(() => {
      p.classList.add("out");
      setTimeout(() => { p.remove(); popupShowing = false; pumpPopups(); }, 480);
    }, 3400);
  }
  const popupHead = () => {
  };

  /* ── Session complete overlay ── */
  function sessionComplete(opts){
    const prev = document.querySelector(".finish-overlay");
    if (prev) prev.remove();
    const d = U.el(
      '<div class="finish-overlay"><div class="finish-card glass-3">' +
      '<div class="finish-ic">' + I.get("check", 38) + '</div>' +
      '<h2>أحسنت!</h2>' +
      '<div class="f-sub">' + opts.duration + ' دراسة في ' + U.esc(opts.subject) + '</div>' +
      '<div class="finish-xp">' + I.get("xp", 18) + ' +' + opts.xp + ' XP</div>' +
      '<div class="finish-stats">' +
      '<div class="finish-stat"><b>' + opts.stats.sessions + '</b><span>جلسات اليوم</span></div>' +
      '<div class="finish-stat"><b>' + opts.stats.minutes + '</b><span>دقائق اليوم</span></div>' +
      '<div class="finish-stat"><b>' + opts.stats.goalPct + '%</b><span>من الهدف</span></div>' +
      '</div>' +
      (opts.tasksDone ? '<div class="finish-done"><div class="finish-group-label">مهام أنجزتها</div>' + opts.tasksDone.map(t =>
        '<div class="fd-item">' + I.get("check", 14) + U.esc(t.title) + '</div>').join("") + '</div>' : "") +
      '<div class="modal-foot" style="justify-content:center">' +
      '<button class="btn primary" id="fc-again">جلسة أخرى</button>' +
      '<button class="btn glass" id="fc-close">العودة</button>' +
      '</div></div></div>');
    document.body.appendChild(d);
    d.querySelector("#fc-again").addEventListener("click", () => { d.remove(); App.UI.startSessionFlow(); });
    d.querySelector("#fc-close").addEventListener("click", () => {
      d.remove();
      if (!App.Timer.isRunning()) App.Router.go("dashboard");
    });
  }

  /* ── toast of next best action prompt ── */
  function notifIcon(type){
    const m = {
      achievement: "achievements", sessionDone: "sessions", taskDone: "check",
      hwDone: "check", homework: "homework", task: "tasks", taskAdded: "tasks",
      review: "errors", streak: "flame", goal: "target", reminder: "bell"
    };
    return m[type] || "bell";
  }

  /* ── level up banner ── */
  function levelBanner(level){
    const b = U.el('<div class="toast gold" role="status"><span class="t-ic">' + I.get("shield", 15) + '</span><span>ترقية! وصلت إلى المستوى ' + level + '</span></div>');
    document.getElementById("toast-root").appendChild(b);
    setTimeout(() => { b.classList.add("out"); setTimeout(() => b.remove(), 350); }, 3200);
  }

  /* ── generic confirm for ["هل أنت متأكد؟"] used by many views ── */
  function dangerConfirm(title, txt, okLabel, onOk){
    confirmDialog(title, txt, okLabel, onOk, { danger: true });
  }

  /* ── Question image lightbox (click [data-qimg] → full-image overlay) ── */
  function qImg(src){
    if (!src) return "";
    return '<figure class="q-img" data-qimg="' + U.esc(src) + '" role="button" tabindex="0" title="تكبير الصورة" aria-label="تكبير الصورة">' +
      '<img src="' + U.esc(src) + '" alt="صورة توضيحية" loading="lazy"></figure>';
  }
  function openImage(src){
    const prev = document.querySelector(".lightbox");
    if (prev) prev.remove();
    const d = U.el('<div class="lightbox" role="dialog" aria-modal="true">' +
      '<button type="button" class="lb-close" aria-label="إغلاق">' + I.get("close", 24) + '</button>' +
      '<img src="' + U.esc(src) + '" alt="صورة توضيحية"></div>');
    document.body.appendChild(d);
    document.body.style.overflow = "hidden";
    d.addEventListener("click", e => {
      if (e.target === d || (e.target.closest && e.target.closest(".lb-close"))) closeImage();
    });
  }
  function closeImage(){
    const d = document.querySelector(".lightbox");
    if (d) d.remove();
    if (!document.querySelector(".modal-root.open")) document.body.style.overflow = "";
  }
  document.addEventListener("click", e => {
    const t = e.target && e.target.closest ? e.target.closest("[data-qimg]") : null;
    if (t){ e.preventDefault(); openImage(t.getAttribute("data-qimg") || ""); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape"){ if (document.querySelector(".lightbox")) closeImage(); return; }
    if (e.key === "Enter" || e.key === " "){
      const t = e.target && e.target.closest ? e.target.closest("[data-qimg]") : null;
      if (t && (e.target === t || (t.querySelector && e.target === t.querySelector("img")))){
        e.preventDefault();
        openImage(t.getAttribute("data-qimg") || "");
      }
    }
  });

  return {
    toast, floatXP, openModal, closeModal, modalShell, confirmDialog, dangerConfirm,
    ring, bar, empty, subjChip, prioTag, statCard, enqueueUnlocked, sessionComplete,
    notifIcon, levelBanner, modalRoot, qImg, openImage, closeImage
  };
})();