/* ═══════════════ STUDY OS — modals.js (create/edit modals, session flow, command palette) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Modals = (function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;

  /* ── shared bits ── */
  function subjChips(selected){
    return '<div class="chip-row" data-subjrow>' + D.subjects.map(s =>
      '<button type="button" class="chip' + (s.id === selected ? " active" : "") + '" data-subj="' + s.id + '" style="color:' + s.accent + ';border-color:color-mix(in srgb,' + s.accent + ' 40%, transparent)">' +
      I.subj(s, 12) + ' ' + s.name + '</button>').join("") + '</div>';
  }
  function bindSubj(root){ // returns reader fn
    root.querySelectorAll("[data-subjrow] [data-subj]").forEach(c => c.addEventListener("click", () => {
      root.querySelectorAll("[data-subjrow] [data-subj]").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
    }));
    return () => (root.querySelector("[data-subjrow] .active") || {}).dataset.subj || D.defSubject();
  }
  const prioSeg = '<div class="seg">' +
    '<button class="active" data-p="high">عالية</button><button data-p="mid">متوسطة</button><button data-p="low">منخفضة</button></div>';
  function bindPrio(root){
    root.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => {
      root.querySelectorAll("[data-p]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    }));
    return () => (root.querySelector("[data-p].active") || {}).dataset.p || "mid";
  }
  const v = n => document.getElementById(n).value;
  const vv = n => { const e = document.getElementById(n); return e ? e.value.trim() : ""; };
  const val = n => { const e = document.getElementById(n); return e ? e.value : ""; };

  /* ══════════════ TASK MODAL ══════════════ */
  function openTaskModal(id, date){
    const st = S.getState();
    const t = id ? S.findTask(id) : null;
    const selDate = t ? t.date : (date || U.todayKey());
    const m = UI.openModal(UI.modalShell(
      I.get("tasks", 18) + ' ' + (t ? "تعديل المهمة" : "إضافة مهمة"),
      '<div class="field"><label>عنوان المهمة <span class="req">*</span></label>' +
        '<input class="input" id="m-task-title" placeholder="مثل: حل تمارين التفاضل ص 45" value="' + U.esc(t ? t.title : "") + '"></div>' +
      '<div class="field"><label>المادة</label>' + subjChips(t ? t.subject : D.defSubject()) + '</div>' +
      '<div class="grid cols-2"><div class="field"><label>التاريخ</label><input type="date" class="input" id="m-task-date" value="' + selDate + '"></div>' +
        '<div class="field"><label>الوقت (اختياري)</label><input type="time" class="input" id="m-task-time" value="' + U.esc(t && t.time ? t.time : "") + '"></div></div>' +
      '<div class="field"><label>الأولوية</label>' + prioSeg + '</div>' +
      '<div class="field"><label>ملاحظات (اختياري)</label><textarea class="input" id="m-task-desc" rows="2" placeholder="تفاصيل إضافية…">' + U.esc(t ? t.desc : "") + '</textarea></div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="m-task-save">' + I.get("check", 15) + 'حفظ</button>',
      { size: "narrow" }
    ), { autoFocus: "#m-task-title" });
    const getSubj = bindSubj(m), getPrio = bindPrio(m);
    document.getElementById("m-task-save").addEventListener("click", () => {
      const title = vv("m-task-title");
      if (!title){ UI.toast("اكتب عنوان المهمة أولًا.", "error", "info"); return; }
      const data = { title, subject: getSubj(), date: val("m-task-date") || U.todayKey(), time: val("m-task-time"), priority: getPrio(), desc: vv("m-task-desc") };
      if (t){ S.updateTask(t.id, data); UI.toast("تم تحديث المهمة.", "success", "check"); }
      else { S.addTask(data); UI.toast("أُضيفت المهمة.", "gold", "tasks"); }
      UI.closeModal();
    });
  }

  /* ══════════════ HOMEWORK MODAL ══════════════ */
  function openHwModal(id){
    const st = S.getState();
    const h = id ? S.findHw(id) : null;
    const m = UI.openModal(UI.modalShell(
      I.get("homework", 18) + ' ' + (h ? "تعديل الواجب" : "إضافة واجب"),
      '<div class="field"><label>عنوان الواجب <span class="req">*</span></label>' +
        '<input class="input" id="m-hw-title" placeholder="مثل: السلسلة رقم 3 — الرياضيات" value="' + U.esc(h ? h.title : "") + '"></div>' +
      '<div class="field"><label>المادة</label>' + subjChips(h ? h.subject : D.defSubject()) + '</div>' +
      '<div class="grid cols-2"><div class="field"><label>الدرس</label><input class="input" id="m-hw-lesson" value="' + U.esc(h ? h.lesson : "") + '"></div>' +
        '<div class="field"><label>عدد التمارين</label><input type="number" min="0" class="input" id="m-hw-ex" value="' + (h ? h.exercises : 0) + '"></div></div>' +
      '<div class="grid cols-2"><div class="field"><label>تاريخ الاستحقاق</label><input type="date" class="input" id="m-hw-date" value="' + (h ? h.deadline : U.addDaysKey(U.todayKey(), 2)) + '"></div>' +
        '<div class="field"><label>الأولوية</label>' + prioSeg + '</div></div>' +
      '<div class="field"><label>وصف (اختياري)</label><textarea class="input" id="m-hw-desc" rows="2">' + U.esc(h ? h.desc : "") + '</textarea></div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="m-hw-save">' + I.get("check", 15) + 'حفظ</button>',
      { size: "narrow" }
    ), { autoFocus: "#m-hw-title" });
    const getSubj = bindSubj(m), getPrio = bindPrio(m);
    document.getElementById("m-hw-save").addEventListener("click", () => {
      const title = vv("m-hw-title");
      if (!title){ UI.toast("اكتب عنوان الواجب.", "error", "info"); return; }
      const data = { title, subject: getSubj(), lesson: vv("m-hw-lesson"), exercises: +val("m-hw-ex") || 0, deadline: val("m-hw-date"), priority: getPrio(), desc: vv("m-hw-desc") };
      if (h){ S.updateHw(h.id, data); UI.toast("تم تحديث الواجب.", "success", "check"); }
      else { S.addHomework(data); UI.toast("أُضيف الواجب.", "gold", "homework"); }
      UI.closeModal();
    });
  }

  /* ══════════════ NOTE MODAL ══════════════ */
  function openNoteModal(id){
    const st = S.getState();
    const n = id ? S.findNote(id) : null;
    const m = UI.openModal(UI.modalShell(
      I.get("notes", 18) + ' ' + (n ? "تعديل الملاحظة" : "إضافة ملاحظة"),
      '<div class="field"><label>العنوان <span class="req">*</span></label>' +
        '<input class="input" id="m-note-title" placeholder="مثل: قاعدة المفعول المطلق" value="' + U.esc(n ? n.title : "") + '"></div>' +
      '<div class="field"><label>المادة</label>' + subjChips(n ? n.subject : D.defSubject()) + '</div>' +
      '<div class="field"><label>المحتوى</label><textarea class="input" id="m-note-content" rows="8" placeholder="اكتب ملاحظتك…" style="min-height:160px">' + U.esc(n ? n.content : "") + '</textarea></div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="m-note-save">' + I.get("check", 15) + 'حفظ</button>',
      { size: "narrow" }
    ), { autoFocus: "#m-note-title" });
    const getSubj = bindSubj(m);
    document.getElementById("m-note-save").addEventListener("click", () => {
      const title = vv("m-note-title");
      const content = vv("m-note-content");
      if (!title){ UI.toast("اكتب عنوانًا للملاحظة.", "error", "info"); return; }
      const data = { title, content: content || "", subject: getSubj() };
      if (n){ S.updateNote(n.id, data); UI.toast("تم تحديث الملاحظة.", "success", "check"); }
      else { S.addNote(data); S.grantXP(2, "ملاحظة"); UI.toast("أُضيفت الملاحظة.", "gold", "notes"); }
      UI.closeModal();
    });
  }

  /* ══════════════ MISTAKE MODAL ══════════════ */
  function openMistakeModal(id){
    const st = S.getState();
    const m0 = id ? S.findMistake(id) : null;
    const isMcq = m0 ? m0.type === "mcq" : true;
    const optRow = o => '<div class="opt-row"><button type="button" class="orb" title="حدد الإجابة الصحيحة">' + I.get("check", 13) + '</button>' +
      '<input type="text" class="input"' + (o && o.val ? ' value="' + U.esc(o.val) + '"' : ' placeholder="' + U.esc((o && o.ph) || "بديل") + '"') + '>' +
      '<button type="button" class="icon-btn opt-del">' + I.get("close", 13) + '</button></div>';
    const m = UI.openModal(UI.modalShell(
      I.get("errors", 18) + ' ' + (m0 ? "تعديل الخطأ" : "تسجيل خطأ جديد"),
      '<div class="seg" id="m-mistype">' +
        '<button class="' + (isMcq ? "active" : "") + '" data-ty="mcq">سؤال اختياري</button>' +
        '<button class="' + (isMcq ? "" : "active") + '" data-ty="essay">سؤال مقالي</button>' +
      '</div>' +
      '<div class="field"><label>المادة</label>' + subjChips(m0 ? m0.subject : D.defSubject()) + '</div>' +
      '<div class="field"><label>السؤال <span class="req">*</span></label><textarea class="input" id="m-mis-q" rows="2">' + U.esc(m0 ? m0.question : "") + '</textarea></div>' +
      '<div class="field mis-img"><label>صورة توضيحية <span class="muted small" style="font-weight:600">(اختياري)</span></label><div id="m-mis-imgbox"></div></div>' +
      '<div class="grid cols-2"><div class="field"><label>إجابتي</label><textarea class="input" id="m-mis-std" rows="2">' + U.esc(m0 ? m0.studentAnswer : "") + '</textarea></div>' +
        '<div class="field"><label>' + (isMcq ? 'الإجابة الصحيحة <span class="req">*</span>' : "النموذج الصحيح") + '</label><textarea class="input" id="m-mis-mdl" rows="2" placeholder="' + (isMcq ? "اكتب نص الإجابة الصحيحة بالضبط" : "الإجابة النموذجية") + '">' + U.esc(m0 ? (isMcq ? m0.correctAnswer : m0.modelAnswer) : "") + '</textarea></div></div>' +
      '<div class="muted small" style="margin:-4px 0 12px' + (isMcq ? "" : ";display:none") + '" id="m-mis-hint">اضغط زر ' + I.get("check", 13) + ' بجانب البديل الصحيح لاختياره تلقائيًا.</div>' +
      '<div class="field mis-opts" id="m-mis-opts" ' + (isMcq ? "" : "hidden") + '>' +
        '<label>البدائل (الإجابة الصحيحة ضمنها)</label>' +
        (m0 && m0.options && m0.options.length
          ? m0.options.map(o => optRow({ val: o })).join("")
          : optRow({ ph: "بديل 1" }) + optRow({ ph: "بديل 2" }) + optRow({ ph: "بديل 3" }) + optRow({ ph: "بديل 4" })) +
        '<button type="button" class="btn sm ghost" id="m-mis-addopt">' + I.get("plus", 13) + 'بديل إضافي</button>' +
      '</div>' +
      '<div class="field"><label>سبب الخطأ (اختياري)</label><input class="input" id="m-mis-why" value="' + U.esc(m0 ? m0.reason : "") + '"></div>' +
      '<div class="field"><label>شرح الحل (اختياري)</label><textarea class="input" id="m-mis-exp" rows="2">' + U.esc(m0 ? m0.explanation : "") + '</textarea></div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="m-mis-save">' + I.get("check", 15) + 'حفظ</button>',
      { size: "wide" }
    ), { autoFocus: "#m-mis-q" });
    const getSubj = bindSubj(m);
    let mcqMode = isMcq;
    m.querySelectorAll("#m-mistype [data-ty]").forEach(b => b.addEventListener("click", () => {
      m.querySelectorAll("#m-mistype [data-ty]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      mcqMode = b.dataset.ty === "mcq";
      m.querySelector("#m-mis-opts").hidden = !mcqMode;
      const hint = m.querySelector("#m-mis-hint");
      if (hint) hint.style.display = mcqMode ? "" : "none";
    }));
    const pickOpt = b => {
      const row = b.closest(".opt-row");
      document.getElementById("m-mis-mdl").value = (row.querySelector("input").value || "").trim();
      m.querySelectorAll("#m-mis-opts .opt-row").forEach(r => r.classList.toggle("picked", r === row));
    };
    m.querySelectorAll(".orb").forEach(b => b.addEventListener("click", () => pickOpt(b)));
    m.querySelector("#m-mis-addopt").addEventListener("click", () => {
      const wrap = m.querySelector("#m-mis-opts");
      const row = U.el(optRow({ ph: "بديل " + (wrap.querySelectorAll(".opt-row").length + 1) }));
      wrap.insertBefore(row, wrap.querySelector("#m-mis-addopt"));
      row.querySelector(".opt-del").addEventListener("click", () => row.remove());
      row.querySelector(".orb").addEventListener("click", () => pickOpt(row.querySelector(".orb")));
    });
    m.querySelectorAll(".opt-del").forEach(b => b.addEventListener("click", () => b.closest(".opt-row").remove()));

    /* ── optional question image (dropzone → preview → delete/change) ── */
    let misImg = (m0 && m0.imageUrl) || "";
    const mImgFile = U.el('<input type="file" id="m-mis-file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden>');
    m.querySelector(".mis-img").appendChild(mImgFile);
    function renderMisImg(){
      const box = m.querySelector("#m-mis-imgbox");
      box.innerHTML = misImg
        ? '<div class="img-preview"><img src="' + U.esc(misImg) + '" alt="صورة توضيحية"></div>' +
          '<div class="ip-actions">' +
            '<button type="button" class="btn sm ghost" id="m-mis-imgchange">' + I.get("image", 13) + 'تغيير الصورة</button>' +
            '<button type="button" class="btn sm danger" id="m-mis-imgdel">' + I.get("trash", 13) + 'حذف</button>' +
          '</div>'
        : '<div class="img-drop" id="m-mis-drop" role="button" tabindex="0">' +
            '<span class="id-ic">' + I.get("image", 18) + '</span>' +
            '<div style="font-size:12.5px;font-weight:800">إضافة صورة توضيحية</div>' +
            '<small>اختياري — أضف صورة مرتبطة بالسؤال إذا كانت تساعد على فهمه، أو الصقها مباشرة بـ Ctrl+V</small>' +
          '</div>';
      const drop = m.querySelector("#m-mis-drop");
      if (drop){
        drop.addEventListener("click", e => { e.preventDefault(); mImgFile.click(); });
        drop.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ")){ e.preventDefault(); mImgFile.click(); } });
        ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("drag"); }));
        ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("drag"); }));
        drop.addEventListener("drop", e => {
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) readMisImg(f);
        });
      } else {
        const chg = m.querySelector("#m-mis-imgchange");
        const del = m.querySelector("#m-mis-imgdel");
        if (chg) chg.addEventListener("click", () => mImgFile.click());
        if (del) del.addEventListener("click", () => { misImg = ""; renderMisImg(); UI.toast("حُذفت الصورة.", "gold", "trash"); });
      }
    }
    function readMisImg(file){
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")){
        UI.toast("صيغة غير مدعومة — استخدم JPG أو PNG أو WEBP.", "error", "info"); return;
      }
      if (file.size > 5 * 1024 * 1024){
        UI.toast("الصورة كبيرة جدًا — الحد الأقصى 5MB.", "error", "info"); return;
      }
      const fr = new FileReader();
      fr.onload = () => {
        U.shrinkImage(fr.result, 1400).then(small => { misImg = small; renderMisImg(); });
      };
      fr.readAsDataURL(file);
    }
    mImgFile.addEventListener("change", () => { readMisImg(mImgFile.files[0]); mImgFile.value = ""; });
    m.addEventListener("paste", e => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++){
        const it = items[i];
        if (it && it.type && it.type.indexOf("image/") === 0 && it.getAsFile){
          const f = it.getAsFile();
          if (f){ e.preventDefault(); UI.toast("تم لصق الصورة.", "gold", "image"); readMisImg(f); break; }
        }
      }
    });
    renderMisImg();

    document.getElementById("m-mis-save").addEventListener("click", () => {
      const q = document.getElementById("m-mis-q").value.trim();
      if (!q){ UI.toast("اكتب نص السؤال.", "error", "info"); return; }
      const studentAnswer = document.getElementById("m-mis-std").value.trim();
      const modelAnswer = document.getElementById("m-mis-mdl").value.trim();
      const options = mcqMode
        ? Array.from(m.querySelectorAll("#m-mis-opts .opt-row input")).map(i => i.value.trim()).filter(v => v)
        : [];
      const data = { subject: getSubj(), question: q, studentAnswer, explanation: document.getElementById("m-mis-exp").value.trim(), reason: document.getElementById("m-mis-why").value.trim(), imageUrl: misImg };
      if (mcqMode){
        data.type = "mcq"; data.options = options; data.correctAnswer = modelAnswer;
        data.correctAnswerId = U.optId(modelAnswer, options);
        if (!data.correctAnswer || options.indexOf(data.correctAnswer) < 0){
          UI.toast("حدد الإجابة الصحيحة — اضغط زر ✓ بجانب البديل الصحيح.", "error", "info"); return;
        }
      } else {
        data.type = "essay"; data.modelAnswer = modelAnswer;
        data.correctAnswer = ""; data.options = [];
      }
      if (m0){ S.updateMistake(m0.id, data); UI.toast("تم تحديث الخطأ.", "success", "check"); }
      else { S.addMistake(data); UI.toast("سُجّل الخطأ في البنك.", "gold", "errors"); }
      UI.closeModal();
    });
  }

  /* ══════════════ SESSION MODAL (startSessionFlow) ══════════════ */
  function openSessionModal(){
    if (App.Timer.active()){
      UI.confirmDialog("يوجد مؤقت قيد التشغيل", "أنهي الجلسة الحالية أولًا قبل بدء أخرى، أو انتقل إلى صفحة المؤقت.", "انتقال إلى المؤقت", () => App.Router.go("timer"), {});
      return;
    }
    const st = S.getState();
    const s = st.settings;
    const m = UI.openModal(UI.modalShell(
      I.get("play", 18) + ' بدء جلسة دراسة',
      '<div class="field"><label>الوضع</label>' +
        '<div class="seg" id="m-ses-mode">' +
          '<button class="active" data-mode="pomodoro">بومودورو</button>' +
          '<button data-mode="custom">مؤقت مخصص</button>' +
          '<button data-mode="focus">Focus</button>' +
        '</div></div>' +
      '<div class="field"><label>المادة</label>' + subjChips(D.defSubject()) + '</div>' +
      '<div class="field" id="m-ses-dur"><label>المدة (دقيقة)</label>' +
        '<div class="chip-row"><button type="button" class="chip active" data-dur="25">25 د</button><button type="button" class="chip" data-dur="45">45 د</button><button type="button" class="chip" data-dur="60">60 د</button><button type="button" class="chip" data-dur="90">90 د</button></div>' +
        '<input type="number" min="1" max="480" class="input" id="m-ses-minutes" value="25" style="margin-top:8px"></div>' +
      '<div class="field"><label>العنوان (اختياري)</label><input class="input" id="m-ses-title" placeholder="مثل: مراجعة الوحدة 3"></div>' +
      '<div class="field"><label>ملاحظة (اختياري)</label><input class="input" id="m-ses-notes" placeholder="ما ستنجزه في هذه الجلسة…"></div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="m-ses-start">' + I.get("play", 15) + 'ابدأ الآن</button>',
      { size: "narrow" }
    ), { autoFocus: "#m-ses-title" });
    const getSubj = bindSubj(m);
    let mode = "pomodoro";
    m.querySelectorAll("#m-ses-mode [data-mode]").forEach(b => b.addEventListener("click", () => {
      m.querySelectorAll("#m-ses-mode [data-mode]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      mode = b.dataset.mode;
      document.getElementById("m-ses-dur").style.display = mode === "pomodoro" ? "none" : "";
      if (mode === "focus") document.getElementById("m-ses-minutes").value = s.focusDuration;
    }));
    document.getElementById("m-ses-dur").style.display = "none";
    m.querySelectorAll("[data-dur]").forEach(c => c.addEventListener("click", () => {
      m.querySelectorAll("[data-dur]").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      document.getElementById("m-ses-minutes").value = c.dataset.dur;
    }));
    document.getElementById("m-ses-start").addEventListener("click", () => {
      const subject = getSubj();
      const title = vv("m-ses-title");
      const notes = vv("m-ses-notes");
      const minutes = Math.max(1, +val("m-ses-minutes") || 25);
      UI.closeModal();
      if (mode === "pomodoro"){
        App.Timer.launch({ type: "pomodoro", subject, title: title || "", notes,
          studyMin: s.pomodoroStudy, breakMin: s.pomodoroBreak, longMin: s.pomodoroLong, sessions: s.pomodoroSessions, context: "page" });
        UI.toast("بومودورو " + s.pomodoroStudy + " دقيقة — ركّز!", "gold", "play");
      } else if (mode === "focus"){
        App.Timer.launch({ type: "focus", minutes, subject, title: title || "", notes, context: "page" });
        UI.toast("بدأت جلسة Focus — باشر الآن.", "gold", "focus");
        App.Router.enterTheatre();
      } else {
        App.Timer.launch({ type: "custom", clock: "countdown", minutes, subject, title: title || "", notes, context: "page" });
        UI.toast("بدأ مؤقت مخصص " + minutes + " دقيقة.", "gold", "timer");
      }
      App.Router.go("timer");
    });
  }

  /* ══════════════ COMMAND PALETTE ══════════════ */
  let palLastFocused = null;

  /* ── Search helpers ── */
  function _normAr(s){ return String(s||"").toLowerCase().replace(/[ً-ٰٟ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/\s+/g," ").trim(); }
  function _fuzzyHit(hay, ndl){
    hay = String(hay).replace(/\s/g,""); ndl = String(ndl).replace(/\s/g,"");
    if (ndl.length < 3 || !ndl) return false;
    var j = 0;
    for (var ci = 0; ci < ndl.length; ci++){ j = hay.indexOf(ndl[ci], j); if (j < 0) return false; j++; }
    return true;
  }
  function _rankHit(fields, nq){
    nq = _normAr(nq); var best = 0;
    for (var fi = 0; fi < fields.length; fi++){
      var h = _normAr(fields[fi].v); var w = fields[fi].w || 1;
      if (!h || !nq) continue;
      var s = 0;
      if (h === nq) s = 100;
      else if (h.startsWith(nq)) s = 80 * w;
      else if (h.indexOf(nq) >= 0) s = 60 * w;
      else if (nq.length >= 3 && _fuzzyHit(h, nq)) s = 30 * w;
      if (s > best) best = s;
    }
    return best;
  }
  var _xScript = [["english","إنجليز"],["arabic","عربي"],["history","تاريخ"],["programming","برمج"],["math","رياضيات"],["physics","فيزياء"],["chemistry","كيمياء"],["code","برمج"],["bio","أحياء"]];
  function _xMatch(q, name){
    var n = _normAr(name);
    for (var xi = 0; xi < _xScript.length; xi++){
      var a = _normAr(_xScript[xi][0]), b = _normAr(_xScript[xi][1]);
      if ((q.indexOf(a) >= 0 && n.indexOf(b) >= 0) || (q.indexOf(b) >= 0 && n.indexOf(a) >= 0)) return true;
    }
    return false;
  }
  function _hiMark(text, q){
    var t = U.esc(text); var qq = String(q||"").trim();
    if (!qq) return t;
    var cands = [U.esc(qq)].concat(qq.split(/\s+/).filter(function(w){return w.length > 1}).map(function(w){return U.esc(w)}));
    var low = t.toLowerCase();
    for (var hi = 0; hi < cands.length; hi++){
      var e = cands[hi]; if (!e) continue;
      var idx = low.indexOf(e.toLowerCase());
      if (idx >= 0) return t.slice(0, idx) + '<mark class="pl-hl">' + t.slice(idx, idx + e.length) + '</mark>' + t.slice(idx + e.length);
    }
    return t;
  }
  function _recentSearches(){ try { var r = JSON.parse(localStorage.getItem("studyos.recent") || "[]"); return Array.isArray(r) ? r : []; } catch(e){ return []; } }
  function _pushRecent(q){
    q = String(q||"").trim(); if (q.length < 2) return;
    try { var r = _recentSearches().filter(function(x){return x !== q}); r.unshift(q); localStorage.setItem("studyos.recent", JSON.stringify(r.slice(0, 6))); } catch(e){}
  }
  function _clearRecent(){ try { localStorage.removeItem("studyos.recent"); } catch(e){} }

  function openPalette(){
    if (UI.closePalette) return;
    palLastFocused = document.activeElement;
    var st = S.getState();
    var m = UI.openModal(
      '<div id="palette" class="palette open" role="dialog" aria-modal="true" aria-label="بحث سريع" aria-combobox="list" aria-expanded="true">' +
        '<div class="palette-box glass-3">' +
          '<div class="palette-header">' +
            '<span class="pl-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>' +
            '<input id="palette-input" class="palette-input" placeholder="اكتب أمرًا أو ابحث..." autocomplete="off" aria-label="بحث" role="combobox" aria-controls="palette-list" aria-activedescendant="">' +
            '<span class="pl-shortcut"><kbd>ESC</kbd></span>' +
          '</div>' +
          '<div class="palette-body" id="palette-list" role="listbox" aria-label="نتائج البحث"></div>' +
          '<div class="palette-footer">' +
            '<div class="footer-left">' +
              '<span class="pl-hint"><kbd>↑↓</kbd> للتنقل</span>' +
              '<span class="pl-hint"><kbd>↵</kbd> تنفيذ</span>' +
              '<span class="pl-hint"><kbd>Esc</kbd> إغلاق</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>', {});
    UI.closePalette = function(){ UI.closeModal(); UI.closePalette = null; if (palLastFocused && palLastFocused.focus) try{palLastFocused.focus();}catch(e){} };
    var input = document.getElementById("palette-input");
    var list = document.getElementById("palette-list");
    var cursor = -1;
    var flat = [];

    function collectResults(nq){
      var out = [];
      var order = ["⚡ أوامر سريعة","📚 المواد","✓ المهام","📖 الواجبات","📝 الملاحظات","❌ الأخطاء","⏱ الجلسات"];
      function R(g,icon,title,sub,detail,kind,kindLabel,fn,actions,score){
        if (score > 0 && out.length < 70) out.push({g:g,icon:icon,title:title,sub:sub,detail:detail||"",kind:kind,kindLabel:kindLabel,fn:fn,actions:actions||[],score:score});
      }
      var quick = [
        {ic:"plus",title:"إضافة مهمة",sub:"إجراء سريع",fn:function(){UI.closePalette();App.Modals.openTaskModal()}},
        {ic:"plus",title:"إضافة واجب",sub:"إجراء سريع",fn:function(){UI.closePalette();App.Modals.openHwModal()}},
        {ic:"plus",title:"إضافة ملاحظة",sub:"إجراء سريع",fn:function(){UI.closePalette();App.Modals.openNoteModal()}},
        {ic:"plus",title:"تسجيل خطأ",sub:"إجراء سريع",fn:function(){UI.closePalette();App.Modals.openMistakeModal()}},
        {ic:"plus",title:"بدء جلسة",sub:"إجراء سريع",fn:function(){UI.closePalette();UI.startSessionFlow()}}
      ];
      quick.forEach(function(a){
        var sc = 0;
        if (!nq) sc = 55;
        else { var hl = _normAr(a.title); if (hl.indexOf(nq) >= 0) sc = 70; else if (_fuzzyHit(hl, nq)) sc = 35; }
        if (sc > 0) R("⚡ أوامر سريعة", a.ic, a.title, a.sub, "", "action", "إجراء", a.fn, [], sc);
      });

      (st.subjects || []).slice(0, 20).forEach(function(s){
        var open = st.tasks.filter(function(t){return t.subject === s.id && !t.done}).length;
        var sc = nq ? _rankHit([{v:s.name,w:1}], nq) : 60;
        if (nq && _xMatch(nq, s.name)) sc = Math.max(sc, 55);
        R("📚 المواد", "📘", s.name, (s.progress || 0) + "% · " + open + " مهام مفتوحة", "", "subject", "مادة",
          function(){UI.closePalette();App.Router.go("subjects")}, [{label:"بدء جلسة",fn:function(){UI.closePalette();UI.startSessionFlow()}}], nq ? sc : 55);
      });

      (st.tasks || []).slice(0, 80).forEach(function(t){
        var sc = nq ? _rankHit([{v:t.title,w:1},{v:D.subjName(t.subject),w:.75},{v:(t.tags||[]).join(" "),w:.7}], nq) : 0;
        if (sc > 0) R("✓ المهام", "☑", t.title, D.subjName(t.subject), t.done ? "مهمة مكتملة" : "مهمة مفتوحة", "task", "مهمة",
          function(){UI.closePalette();App.Modals.openTaskModal(t.id)}, [{label:t.done?"إعادة فتح":"إنجاز",fn:function(){UI.closePalette();App.Modals.openTaskModal(t.id)}}], sc);
      });

      (st.homework || []).slice(0, 40).forEach(function(h){
        var sc = nq ? _rankHit([{v:h.title,w:1},{v:h.desc||"",w:.5},{v:D.subjName(h.subject),w:.7}], nq) : 0;
        if (sc > 0) R("📖 الواجبات", "📝", h.title, D.subjName(h.subject) + (h.done ? " · منجز" : ""), h.desc || "", "homework", "واجب",
          function(){UI.closePalette();App.Modals.openHwModal(h.id)}, [{label:h.done?"إعادة فتح":"إنجاز",fn:function(){UI.closePalette();App.Modals.openHwModal(h.id)}}], sc);
      });

      (st.notes || []).slice(0, 80).forEach(function(n){
        var sc = nq ? _rankHit([{v:n.title,w:1},{v:n.content||"",w:.5},{v:(n.tags||[]).join(" "),w:.7},{v:D.subjName(n.subject),w:.6}], nq) : 0;
        if (sc > 0) R("📝 الملاحظات", "✎", n.title, D.subjName(n.subject) + ((n.tags||[]).length ? " · #" + n.tags.slice(0,2).join(" #") : ""), (n.content||"").slice(0,80), "note", "ملاحظة",
          function(){UI.closePalette();App.Modals.openNoteModal(n.id)}, [{label:"تعديل",fn:function(){UI.closePalette();App.Modals.openNoteModal(n.id)}}], sc);
      });

      (st.mistakes || []).slice(0, 50).forEach(function(x){
        var sc = nq ? _rankHit([{v:x.question,w:1},{v:x.notes||"",w:.5},{v:D.subjName(x.subject),w:.6}], nq) : 0;
        if (sc > 0) R("❌ الأخطاء", "❌", x.question, D.subjName(x.subject), x.notes || "", "mistake", "خطأ",
          function(){UI.closePalette();App.Modals.openMistakeModal(x.id)}, [], sc);
      });

      (st.blocks || []).slice(0, 50).forEach(function(b){
        var sc = nq ? _rankHit([{v:D.subjName(b.subject),w:1},{v:b.title||"",w:.6}], nq) : 0;
        if (sc > 0) R("⏱ الجلسات", "📚", (b.title || D.subjName(b.subject)), U.fmtDate(b.date, {short:true}) + " · " + U.fmtDur(b.minutes), "", "session", "جلسة",
          function(){UI.closePalette();App.Router.go("timer")}, [], sc);
      });

      out.sort(function(a,b){
        var ai = order.indexOf(a.g), bi = order.indexOf(b.g);
        ai = ai < 0 ? 99 : ai; bi = bi < 0 ? 99 : bi;
        return (ai - bi) || (b.score - a.score);
      });
      return out.slice(0, 60);
    }

    function paint(q){
      cursor = -1;
      flat = [];
      input.setAttribute("aria-activedescendant", "");
      var nq = _normAr(q);

      if (!nq){
        collectResults("").forEach(function(r){ if (r.kind === "action") flat.push(r); });
        var rs = _recentSearches();
        if (rs.length){
          flat.push({g:"🕘 عمليات البحث الأخيرة",icon:"🗑",title:"مسح سجل البحث",sub:"",kind:"clear",kindLabel:"",fn:function(){_clearRecent();paint(q)},actions:[],score:1});
          rs.forEach(function(r){
            flat.push({g:"🕘 عمليات البحث الأخيرة",icon:"🕘",title:r,sub:"بحث مجددًا",kind:"recent",kindLabel:"بحث",fn:function(){input.value=r;paint(r)},actions:[],score:50});
          });
        }
        flat.push({g:"✨ اقتراحات",icon:"💡",title:"ماذا تبحث عنه؟",sub:"آخر المهام والملاحظات والمواد",kind:"hint",kindLabel:"",fn:function(){},actions:[],score:5});
        (st.tasks||[]).slice(-2).reverse().forEach(function(t){
          flat.push({g:"✨ اقتراحات",icon:"☑",title:t.title,sub:D.subjName(t.subject),kind:"task",kindLabel:"مهمة",fn:function(){UI.closePalette();App.Modals.openTaskModal(t.id)},actions:[],score:40});
        });
        (st.notes||[]).slice(-2).reverse().forEach(function(n){
          flat.push({g:"✨ اقتراحات",icon:"✎",title:n.title,sub:D.subjName(n.subject),kind:"note",kindLabel:"ملاحظة",fn:function(){UI.closePalette();App.Modals.openNoteModal(n.id)},actions:[],score:40});
        });
        (st.subjects||[]).slice(0,4).forEach(function(s){
          flat.push({g:"✨ اقتراحات",icon:"📘",title:s.name,sub:(s.progress||0)+"%",kind:"subject",kindLabel:"مادة",fn:function(){UI.closePalette();App.Router.go("subjects")},actions:[],score:40});
        });
      } else {
        collectResults(nq).forEach(function(r){ flat.push(r); });
      }

      draw();
    }

    function draw(){
      var box = list;
      if (!box) return;
      if (!flat.length){
        box.innerHTML = '<div class="pl-empty" role="option" aria-selected="false"><div class="pl-empty-ic">🔍</div><b>لم نجد ما تبحث عنه</b><p>جرّب كلمة أخرى أو ابحث في جميع أقسام Study OS.</p></div>';
        return;
      }
      var q = input.value || "";
      var h = "", lastG = "";
      flat.forEach(function(c, i){
        if (c.g !== lastG){
          h += '<div class="pl-group" role="presentation">' + U.esc(c.g) + '</div>';
          lastG = c.g;
        }
        if (c.kind === "clear"){
          h += '<button class="pl-item pl-clear" data-i="' + i + '"><span class="pl-ic">🗑</span><span class="pl-txt"><span class="pl-title">مسح سجل البحث</span></span></button>';
          return;
        }
        var sel = i === cursor;
        h += '<button class="pl-item' + (sel ? " sel" : "") + '" data-i="' + i + '" role="option" aria-selected="' + sel + '" id="pl-active-' + i + '">' +
          '<span class="pl-ic">' + (c.icon.length <= 2 ? c.icon : I.get(c.icon, 18)) + '</span>' +
          '<span class="pl-txt"><span class="pl-title">' + _hiMark(c.title, q) + '</span>' + (c.sub ? '<span class="pl-sub">' + _hiMark(c.sub, q) + '</span>' : '') + '</span>' +
          (c.kindLabel ? '<span class="pl-kind">' + U.esc(c.kindLabel) + '</span>' : '') +
          (sel ? '<span class="pl-kbd">↵</span>' : '') +
        '</button>';
        if (sel && (c.detail || (c.actions && c.actions.length))){
          h += '<div class="pl-preview" role="note">';
          if (c.detail) h += '<div class="pl-detail">' + U.esc(c.detail) + '</div>';
          (c.actions || []).forEach(function(a, ai){
            h += '<button class="pl-act" data-i="' + i + '" data-a="' + ai + '">' + U.esc(a.label) + '</button>';
          });
          h += '</div>';
        }
      });
      box.innerHTML = h;
      var selEl = box.querySelector(".pl-item.sel");
      if (selEl) try{ selEl.scrollIntoView({block:"nearest"}); }catch(e){}
      box.querySelectorAll(".pl-item").forEach(function(b){
        b.addEventListener("mouseenter", function(){
          var idx = +b.dataset.i;
          if (idx !== cursor){ cursor = idx; draw(); }
        });
        b.addEventListener("click", function(){
          var ci = +b.dataset.i;
          var act = b.closest(".pl-act");
          if (act){
            var ai = +act.dataset.a;
            var item = flat[ci];
            if (item && item.actions && item.actions[ai]) try{ item.actions[ai].fn(); }catch(e){}
            return;
          }
          var item = flat[ci];
          if (!item) return;
          if (item.kind === "clear"){ _clearRecent(); paint(q); return; }
          _pushRecent(input.value || "");
          UI.closePalette();
          try{ item.fn(); }catch(e){}
        });
      });
    }

    function move(d){
      if (!flat.length) return;
      cursor = (cursor + d + flat.length) % flat.length;
      input.setAttribute("aria-activedescendant", "pl-active-" + cursor);
      draw();
    }

    input.addEventListener("keydown", function(e){
      if (e.key === "ArrowDown"){ e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); }
      else if (e.key === "Enter"){
        e.preventDefault();
        if (cursor >= 0 && flat[cursor]){
          var item = flat[cursor];
          if (item.kind === "clear"){ _clearRecent(); paint(input.value); return; }
          _pushRecent(input.value || "");
          UI.closePalette();
          try{ item.fn(); }catch(e){}
        }
      }
      else if (e.key === "Escape"){ UI.closePalette(); }
      else if (e.key === "Tab"){ e.preventDefault(); move(e.shiftKey ? -1 : 1); }
    });

    var _palDebounce = null;
    input.addEventListener("input", function(){
      clearTimeout(_palDebounce);
      _palDebounce = setTimeout(function(){ paint(input.value); }, 100);
    });
    var overlay = document.getElementById("palette");
    if (overlay) overlay.addEventListener("click", function(e){
      if (e.target === overlay) UI.closePalette();
    });
    paint("");
    setTimeout(function(){ input.focus(); }, 60);
  }

  /* ══════════════ FAB quick-add ══════════════ */
  let inited = false;
  function init(){
    if (inited) return;
    inited = true;
    App.UI.startSessionFlow = openSessionModal;
    const fab = document.getElementById("fab-btn");
    const menu = document.getElementById("fab-menu");
    if (fab) fab.addEventListener("click", () => {
      if (menu.hasAttribute("hidden")){ menu.removeAttribute("hidden"); fab.classList.add("open"); }
      else { menu.setAttribute("hidden", ""); fab.classList.remove("open"); }
    });
    document.querySelectorAll(".fab-item").forEach(b => b.addEventListener("click", () => {
      menu.setAttribute("hidden", ""); fab.classList.remove("open");
      const a = b.dataset.fab;
      if (a === "task") App.Modals.openTaskModal();
      else if (a === "homework") App.Modals.openHwModal();
      else if (a === "note") App.Modals.openNoteModal();
      else if (a === "session") App.UI.startSessionFlow();
    }));
    document.addEventListener("keydown", e => {
      const tag = (document.activeElement || {}).tagName;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
        e.preventDefault(); openPalette();
      } else if (e.key === "Escape" && UI.closePalette){
        UI.closePalette();
      }
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !e.ctrlKey && !e.metaKey && !e.altKey){
        if (e.key.toLowerCase() === "t"){ e.preventDefault(); App.Router.go("todo"); }
        else if (e.key.toLowerCase() === "g"){ e.preventDefault(); App.Router.go("timer"); }
        else if (e.key.toLowerCase() === "d"){ e.preventDefault(); App.Router.go("dashboard"); }
      }
    });
  }

  return {
    init, openPalette, openTaskModal, openHwModal, openNoteModal, openMistakeModal, openSessionModal,
    i: { subjChips, bindSubj, prioSeg, bindPrio } // helpers for reuse
  };
})();

/* wire up immediately if the DOM is ready */
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.Modals.init());
else App.Modals.init();