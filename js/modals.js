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
  function openPalette(){
    if (UI.closePalette) return; // already open
    const st = S.getState();
    const m = UI.openModal(
      '<div id="palette" class="palette open" role="dialog" aria-modal="true" aria-label="بحث سريع">' +
        '<div class="palette-box">' +
          '<div class="palette-input">' +
            '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input id="palette-input" class="palette-search" placeholder="ابحث عن صفحة، مهمة، واجب، ملاحظة، خطأ…" autocomplete="off"></div>' +
          '<div class="palette-list" id="palette-list"></div>' +
          '<div class="palette-hint">↑↓ للتحريك · Enter للفتح · Esc للإغلاق</div>' +
        '</div>' +
      '</div>', {});
    UI.closePalette = () => { UI.closeModal(); UI.closePalette = null; };
    const input = document.getElementById("palette-input");
    const list = document.getElementById("palette-list");
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown"){ e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); }
      else if (e.key === "Enter"){ e.preventDefault(); const a = list.querySelector(".sel"); if (a) a.click(); }
      else if (e.key === "Escape"){ UI.closePalette(); }
    });
    let cursor = -1;
    function move(d){
      const items = list.querySelectorAll(".pl-item");
      if (!items.length) return;
      items.forEach(i => i.classList.remove("sel"));
      cursor = (cursor + d + items.length) % items.length;
      items[cursor].classList.add("sel");
      items[cursor].scrollIntoView({ block: "nearest" });
    }
    function items(filter){
      filter = (filter || "").toLowerCase();
      const groups = [];
      const add = (label, arr) => { if (arr.length) groups.push({ label: label, items: arr }); };
      const pg = [];
      D.navPages.concat(D.extraPages).forEach(p => {
        if (!filter || (p.name + " " + p.en).toLowerCase().indexOf(filter) >= 0) pg.push({ ic: p.icon, title: p.name, sub: "صفحة", route: p.route });
      });
      add("الصفحات", pg);
      const ac = [];
      ["task","homework","note","mistake","session"].forEach(a => {
        if (!filter || a.indexOf(filter) >= 0) ac.push({ ic: "plus", title: a === "task" ? "إضافة مهمة" : a === "homework" ? "إضافة واجب" : a === "note" ? "إضافة ملاحظة" : a === "mistake" ? "تسجيل خطأ" : "بدء جلسة", sub: "إجراء سريع", act: a });
      });
      add("إجراءات سريعة", ac);
      const tk = [];
      st.tasks.slice(0, 50).forEach(t => { if (!filter || (t.title + " " + (t.desc || "") + " " + (t.lesson || "") + " " + D.subjName(t.subject)).toLowerCase().indexOf(filter) >= 0) tk.push({ ic: "tasks", kind: "task", id: t.id, title: t.title, sub: "مهمة · " + D.subjName(t.subject), route: "todo" }); });
      add("المهام", tk);
      const hw = [];
      st.homework.slice(0, 50).forEach(h => { if (!filter || (h.title + " " + (h.lesson || "") + " " + (h.desc || "") + " " + D.subjName(h.subject) + " " + (h.priority || "")).toLowerCase().indexOf(filter) >= 0) hw.push({ ic: "homework", kind: "homework", id: h.id, title: h.title, sub: "واجب · " + D.subjName(h.subject), route: "homework" }); });
      add("الواجبات", hw);
      const nt = [];
      st.notes.slice(0, 50).forEach(n => { if (!filter || (n.title + " " + n.content + " " + n.tags.join(" ")).toLowerCase().indexOf(filter) >= 0) nt.push({ ic: "notes", kind: "note", id: n.id, title: n.title.length > 60 ? n.title.slice(0, 60) + "…" : n.title, sub: "ملاحظة · " + D.subjName(n.subject), route: "notes" }); });
      add("الملاحظات", nt);
      const mi = [];
      st.mistakes.slice(0, 50).forEach(x => { if (!filter || (x.question + " " + (x.notes || "") + " " + D.subjName(x.subject)).toLowerCase().indexOf(filter) >= 0) mi.push({ ic: "errors", kind: "mistake", id: x.id, title: x.question.length > 60 ? x.question.slice(0, 60) + "…" : x.question, sub: "خطأ · " + D.subjName(x.subject), route: "errors" }); });
      add("الأخطاء", mi);
      const ss = [];
      st.blocks.slice(0, 50).forEach(b => { if (!filter || (b.title + " " + D.subjName(b.subject)).toLowerCase().indexOf(filter) >= 0) ss.push({ ic: "clock", title: b.title || D.subjName(b.subject), sub: "جلسة · " + U.fmtDate(b.date, { short: true }) + " · " + U.fmtDur(b.minutes), route: "timer" }); });
      add("الجلسات", ss);
      const flat = [];
      groups.forEach(g => flat.push.apply(flat, g.items));
      return { groups: groups, flat: flat };
    }
    function render(filter){
      cursor = -1;
      const got = items(filter);
      if (!got.flat.length){ list.innerHTML = '<div class="pl-empty">لا توجد نتائج مطابقة.</div>'; return; }
      let html = "", i = 0;
      got.groups.forEach(g => {
        html += '<div class="pl-group">' + U.esc(g.label) + '</div>';
        g.items.forEach(r => {
          html += '<button class="pl-item' + (i === 0 ? " sel" : "") + '" data-i="' + i + '" role="option">' +
            '<span class="pl-badge"></span>' +
            '<span class="pl-ic">' + I.get(r.ic, 16) + '</span>' +
            '<span class="pl-txt"><div class="pl-title">' + U.esc(r.title) + '</div><div class="pl-sub">' + U.esc(r.sub) + '</div></span>' +
          '</button>';
          i++;
        });
      });
      list.innerHTML = html;
      list.querySelectorAll(".pl-item").forEach(b => b.addEventListener("click", () => {
        const r = got.flat[+b.dataset.i];
        UI.closePalette();
        if (r && r.id){
          if (r.kind === "task") App.Modals.openTaskModal(r.id);
          else if (r.kind === "homework") App.Modals.openHwModal(r.id);
          else if (r.kind === "note") App.Modals.openNoteModal(r.id);
          else if (r.kind === "mistake") App.Modals.openMistakeModal(r.id);
          else if (r.route) App.Router.go(r.route);
          return;
        }
        if (r.route) App.Router.go(r.route);
        else if (r.act === "task") App.Modals.openTaskModal();
        else if (r.act === "homework") App.Modals.openHwModal();
        else if (r.act === "note") App.Modals.openNoteModal();
        else if (r.act === "mistake") App.Modals.openMistakeModal();
        else if (r.act === "session") UI.startSessionFlow();
      }));
    }
    input.addEventListener("input", () => render(input.value));
    render("");
    setTimeout(() => input.focus(), 60);
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