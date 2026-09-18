/* ═══════════════ STUDY OS — views-meta.js (achievements, notifications, profile, settings) ═══════════════ */
"use strict";
window.App = window.App || {};
(function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI, V = App.Views;

  /* ── shared avatar helpers (emoji or uploaded image) ── */
  function avInner(a){
    a = a || "🎓";
    if (a.indexOf("data:image") === 0 || a.indexOf("http") === 0) return '<img class="av-img" src="' + a + '" alt="">';
    return '<span class="av-emoji">' + a + '</span>';
  }
  function openAvatarPicker(){
    const avatars = ["🎓","📚","🔥","🌟","🧠","⚡","🎯","💪","🌙","🍀","🚀","🦁","🦉","🐺"];
    UI.openModal(UI.modalShell(I.get("user", 18) + ' اختر صورتك الرمزية', '' +
      '<label class="btn emerald block av-upload" style="cursor:pointer;margin-bottom:16px">' + I.get("export", 16) + 'رفع صورة من جهازك' +
        '<input type="file" id="pf-av-file" accept="image/*" hidden></label>' +
      '<div class="muted small" style="margin-bottom:10px">أو اختر رمزًا تعبيريًا:</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:10px">' +
        avatars.map(a => '<button class="avatar" style="width:50px;height:50px;font-size:24px;border:2px solid var(--line)" data-av="' + a + '">' + a + '</button>').join("") +
      '</div>',
      '<button class="btn ghost" data-close>إغلاق</button>'), {});
    const m = document.getElementById("modal-root");
    const f = m.querySelector("#pf-av-file");
    if (f) f.addEventListener("change", () => {
      const file = f.files && f.files[0];
      if (!file) return;
      if (!file.type || file.type.indexOf("image/") !== 0){ UI.toast("اختر ملف صورة صالحًا.", "error", "info"); return; }
      if (file.size > 5 * 1024 * 1024){ UI.toast("الصورة كبيرة — الحد الأقصى 5 ميغابايت.", "error", "info"); f.value = ""; return; }
      const rd = new FileReader();
      rd.onload = () => {
        U.shrinkImage(String(rd.result), 256).then(url => {
          S.updateUser({ avatar: url });
          UI.closeModal();
          UI.toast("تم تحديث الصورة الرمزية.", "gold", "user");
        });
      };
      rd.readAsDataURL(file);
    });
    m.querySelectorAll("[data-av]").forEach(b => b.addEventListener("click", () => {
      S.updateUser({ avatar: b.dataset.av });
      UI.closeModal();
      UI.toast("تم تحديث الصورة الرمزية.", "gold", "user");
    }));
  }

  /* ════════════════════ ACHIEVEMENTS ════════════════════ */
  V.register("achievements", function (root){
    const st = S.getState();
    const unlockedCount = Object.keys(st.unlocked).length;
    const total = D.defs.length;
    const level = D.levelInfo(st.xp);
    const groups = D.ACH_GROUPS;

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">الإنجازات</div>' +
      '<div class="page-sub">' + unlockedCount + ' من ' + total + ' وسامًا — كل وسام يروي قصة التزام.</div></div></div>' +

      '<div class="nba-card glass-2" style="margin-bottom:20px">' +
        '<div class="nba-tag">' + I.get("shield", 13) + 'تقدمك العام</div>' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<span class="chip" style="font-size:15px;padding:8px 16px">' + I.get("xp", 15) + ' المستوى ' + level.level + '</span>' +
          '<div style="flex:1;min-width:180px">' + UI.bar(level.pct, { gold: true }) +
            '<div class="muted small" style="margin-top:4px" class="num">' + U.fmtNum(level.have) + ' / ' + U.fmtNum(level.need) + ' XP للمستوى التالي</div></div>' +
          '<span class="badge gold">' + I.get("achievements", 13) + ' ' + Math.round(unlockedCount / total * 100) + '%</span>' +
        '</div>' +
      '</div>' +

      '<div class="ach-grid">' + groups.map(g => {
        const list = D.defs.filter(d => d.group === g.id);
        const open = list.filter(d => st.unlocked[d.id]).length;
        return '' +
          '<div class="ach-group-title"><h3>' + g.name + '</h3><span class="gn num">' + open + '/' + list.length + '</span><i></i></div>' +
          list.map(d => {
            const got = st.unlocked[d.id];
            return '<div class="card glass-1 ach-card ' + (got ? "unlocked" : "locked") + '"' + (got ? ' data-tooltip="فتح في ' + U.fmtDate(got.slice(0,10), {dayName:true}) + '"' : "") + '>' +
              '<div class="a-ic">' + I.get(d.icon, 26) + '</div>' +
              '<div class="ach-title">' + U.esc(d.name) + '</div>' +
              '<div class="ach-desc">' + U.esc(d.desc) + '</div>' +
              '<div class="ach-tag">' + (got ? "مفتوح · +" + d.xp + " XP" : "مقفل · +" + d.xp + " XP") + '</div>' +
            '</div>';
          }).join("") + '';
      }).join("") + '</div>';
  }, { rerender: true, title: "الإنجازات" });

  /* ════════════════════ NOTIFICATIONS ════════════════════ */
  V.register("notifications", function (root){
    const st = S.getState();
    const list = st.notifications;
    const unread = list.filter(n => !n.read).length;
    const groups = {};
    list.forEach(n => { const d = n.ts.slice(0, 10); (groups[d] = groups[d] || []).push(n); });
    const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">التنبيهات</div>' +
      '<div class="page-sub">' + (unread ? 'لديك ' + unread + ' تنبيهات غير مقروءة.' : 'كل شيء مقروء — ذكاء اصطناعي هادئ.') + '</div></div>' +
      '<div class="head-actions">' +
        (unread ? '<button class="btn sm" data-not="all">' + I.get("checkdone", 14) + 'تحديد الكل كمقروء</button>' : '') +
        '<button class="btn sm danger" data-not="clear">' + I.get("trash", 14) + 'مسح الكل</button>' +
      '</div></div>' +

      (list.length ? days.map(d => {
        return '<div class="todo-section">' +
          '<div class="todo-sec-head"><h3>' + (d === U.todayKey() ? "اليوم" : U.relativeDay(d)) + '</h3><span class="sepline"></span></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' + groups[d].map(n => notifRow(n)).join("") + '</div></div>';
      }).join("")
      : '<div class="card glass-1">' + UI.empty("bell", "لا تنبيهات", "ستصلك تنبيهات المهام، الواجبات، الإنجازات، وسلامة السلسلة هنا.") + '</div>');

    root.querySelectorAll("[data-not='all']").forEach(b => b.addEventListener("click", () => { S.markAllRead(); UI.toast("حُدّد الكل كمقروء."); }));
    root.querySelectorAll("[data-not='clear']").forEach(b => b.addEventListener("click", () => UI.dangerConfirm("مسح التنبيهات", "سيتم حذف جميع التنبيهات نهائيًا.", "مسح", () => { S.clearNotifications(); UI.toast("تم مسح التنبيهات.", "gold", "trash"); })));
    root.querySelectorAll("[data-nread]").forEach(b => b.addEventListener("click", () => S.markRead(b.dataset.nread)));
  }, { rerender: true, title: "التنبيهات" });

  function notifRow(n){
    const t = new Date(n.ts);
    const typeMap = {
      study: ["clock", "درس", "var(--em-3)"], homework: ["homework", "واجب", "var(--gold-2)"],
      task: ["tasks", "مهمة", "var(--em-3)"], achievement: ["achievements", "إنجاز", "var(--gold-2)"],
      goal: ["target", "هدف", "var(--em-3)"], streak: ["flame", "سلسلة", "var(--gold-2)"],
      sessionDone: ["sessions", "جلسة", "var(--em-3)"], review: ["errors", "مراجعة", "var(--gold-2)"],
      taskAdded: ["tasks", "مهمة", "var(--em-3)"], taskDone: ["check", "مهمة", "var(--em-3)"],
      hwDone: ["check", "واجب", "var(--em-3)"],
      exam: ["achievements", "امتحان", "var(--gold-2)"], summary: ["analytics", "ملخص", "var(--em-3)"]
    };
    const m = typeMap[n.type] || ["bell", "تنبيه", "var(--em-3)"];
    return '<div class="notif-item ' + (n.read ? "" : "unread") + '"' + (n.read ? "" : ' data-nread="' + n.id + '" style="cursor:pointer"') + ' role="' + (n.read ? "listitem" : "button") + '">' +
      '<div class="notif-ic" style="background:color-mix(in srgb,' + m[2] + ' 14%, transparent);color:' + m[2] + '">' + I.get(m[0], 18) + '</div>' +
      '<div class="notif-body">' +
        '<div class="nt-title">' + U.esc(n.title) + ' <span class="notif-type" style="color:' + m[2] + '">' + m[1] + '</span>' + (n.read ? "" : '<span class="badge-dot" style="position:static;display:inline-flex;vertical-align:middle;margin-inline-start:6px"></span>') + '</div>' +
        '<div class="nt-desc">' + U.esc(n.body) + '</div>' +
        '<div class="nt-time num">' + U.fmtTimeHM(t) + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ════════════════════ PROFILE ════════════════════ */
  V.register("profile", function (root){
    const st = S.getState();
    const level = D.levelInfo(st.xp);
    const streak = D.streakOf(st);
    const totalM = st.blocks.reduce((a, b) => a + b.minutes, 0);
    const tasksAll = st.tasks.length;
    const tasksDone = st.tasks.filter(t => t.completed).length;
    const hwDone = st.homework.filter(h => h.completed).length;
    const unlocked = Object.keys(st.unlocked).length;
    const today = U.todayKey();
    const sp = D.subjects
      .filter(x => x.id !== "general")
      .map(s => ({ s, min: st.blocks.filter(b => b.subject === s.id).reduce((a, b) => a + b.minutes, 0) }))
      .sort((a, b) => b.min - a.min);
    const best = sp[0];

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">الملف الشخصي</div>' +
      '<div class="page-sub">أنت قصة تتطور يومًا بعد يوم.</div></div></div>' +

      '<div class="card glass-2 profile-hero">' +
        '<button class="avatar profile-avatar" id="pf-avatar" title="تغيير الصورة الرمزية" aria-label="تغيير الصورة الرمزية">' + avInner(st.user.avatar) + '</button>' +
        '<div class="profile-info">' +
          '<h2 id="pf-name">' + U.esc(st.user.name || "طالب") + '</h2>' +
          '<div class="p-grade">' + U.esc(st.user.grade || "ثانية ثانوي — بكالوريا") + '</div>' +
          '<div class="p-level-row">' +
            '<span class="chip">' + I.get("shield", 14) + ' المستوى ' + level.level + '</span>' +
            '<div style="flex:1">' + UI.bar(level.pct, { gold: true }) + '</div>' +
            '<b class="num">' + U.fmtNum(st.xp) + ' XP</b>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="btn sm" data-pf="edit">' + I.get("edit", 13) + 'تعديل الاسم</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="xp-stats" style="margin-top:16px">' +
        UI.statCard("clock", U.fmtDur(totalM), "ساعات الدراسة", "gold") +
        UI.statCard("achievements", unlocked + "/" + D.defs.length, "الإنجازات") +
        UI.statCard("flame", streak + " يوم", "السلسلة الحالية") +
        UI.statCard("tasks", (tasksAll ? Math.round(tasksDone / tasksAll * 100) : 100) + "%", "نسبة إكمال المهام") +
        UI.statCard("homework", hwDone, "واجبات منجزة") +
        UI.statCard("sessions", st.blocks.length, "جلسات دراسة") +
      '</div>' +

      '<div class="grid cols-2 pf-split">' +
        '<div class="card glass-1">' +
          '<div class="card-title">' + I.get("book", 17) + 'توزيع وقتك حسب المواد</div>' +
          (best && best.min ? sp.map(x => {
            const pct = Math.min(100, Math.round(x.min / best.min * 100));
            return '<div class="activity-item"><div class="act-ic" style="color:' + x.s.accent + '">' + I.subj(x.s, 15) + '</div>' +
              '<div class="act-txt" style="flex:2"><b>' + x.s.name + '</b><div style="margin-top:3px">' + UI.bar(Math.max(4, pct), { thin: true, gold: x === sp[0] }) + '</div></div>' +
              '<b class="num" style="color:var(--gold-2)">' + U.fmtDur(x.min) + '</b></div>';
          }).join("") : '<p class="muted small">ادرس لتظهر توزيع وقتك هنا.</p>') +
        '</div>' +
        '<div class="card glass-1">' +
          '<div class="card-title">' + I.get("achievements", 17) + 'أحدث الأوسمة</div>' +
          (unlocked ? Object.keys(st.unlocked).slice(-6).reverse().map(id => {
            const d = D.defs.find(x => x.id === id);
            if (!d) return "";
            return '<div class="activity-item"><div class="act-ic" style="color:var(--gold-2)">' + I.get(d.icon, 15) + '</div>' +
              '<div class="act-txt"><b>' + U.esc(d.name) + '</b></div>' +
              '<div class="act-time num">' + U.fmtDate(st.unlocked[id].slice(0, 10), { short: true }) + '</div></div>';
          }).join("") : '<p class="muted small">أنجز مهامك لتفتح أول وسام.</p>') +
        '</div>' +
      '</div>';

    root.querySelector("#pf-avatar").addEventListener("click", openAvatarPicker);
    root.querySelectorAll("[data-pf='edit']").forEach(b => b.addEventListener("click", () => {
      UI.openModal(UI.modalShell(I.get("edit", 18) + ' تعديل الاسم', '' +
        '<div class="field"><label>الاسم <span class="req">*</span></label><input class="input" id="pf-name-input" value="' + U.esc(st.user.name) + '"></div>',
        '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="pf-save">حفظ</button>'), { autoFocus: "#pf-name-input" });
      document.getElementById("pf-save").addEventListener("click", () => {
        const v = document.getElementById("pf-name-input").value.trim();
        if (!v){ UI.toast("اكتب اسمك أولًا.", "error", "info"); return; }
        S.updateUser({ name: v });
        UI.closeModal();
        UI.toast("تم تحديث الاسم.");
      });
    }));
  }, { rerender: true, title: "الملف الشخصي" });

  /* ════════════════════ SETTINGS ════════════════════ */
  V.register("settings", function (root){
    const st = S.getState();
    const s = st.settings;
    root.innerHTML = renderSettings(st, s);
    bindSettings(root, st, s);
    bindConn(root);
  }, { rerender: true, title: "الإعدادات" });

  let connBound = false;
  function bindConn(root){
    function apply(online){
      const badge = root.querySelector("#conn-badge");
      const txt = root.querySelector("#conn-state");
      if (!badge || !txt) return;
      badge.textContent = online ? "متصل" : "غير متصل";
      badge.className = "badge " + (online ? "emerald" : "amber");
      txt.textContent = online
        ? "تُرفع التغييرات تلقائيًا إلى السحابة عند الحفظ."
        : "أنت غير متصل — ستُزامن البيانات تلقائيًا عند عودة الإنترنت.";
    }
    apply((typeof navigator !== "undefined") ? !!navigator.onLine : true);
    if (connBound) return;
    connBound = true;
    function patch(online){
      const badge = document.getElementById("conn-badge");
      const txt = document.getElementById("conn-state");
      if (!badge || !txt) return;
      badge.textContent = online ? "متصل" : "غير متصل";
      badge.className = "badge " + (online ? "emerald" : "amber");
      txt.textContent = online
        ? "تُرفع التغييرات تلقائيًا إلى السحابة عند الحفظ."
        : "أنت غير متصل — ستُزامن البيانات تلقائيًا عند عودة الإنترنت.";
    }
    if (U.on) U.on("conn-status", p => patch(!!(p && p.online)));
  }

  function renderSettings(st, s){
    const seg = (val, opts, target) =>
      '<div class="seg">' + opts.map(o =>
        '<button class="' + (val === o.v ? "active" : "") + '" data-seg="' + target + '" data-v="' + o.v + '">' + o.t + '</button>'
      ).join("") + '</div>';
    const sw = (checked, target) =>
      '<label class="switch"><input type="checkbox" ' + (checked ? "checked" : "") + ' data-sw="' + target + '"><i></i></label>';
    const step = (id, val, unit, min, max) =>
      '<div class="step">' +
        '<button type="button" class="st-btn" data-st="' + id + '" data-d="-1" aria-label="إنقاص">−</button>' +
        '<input type="number" class="input" id="' + id + '" min="' + min + '" max="' + max + '" value="' + val + '">' +
        '<button type="button" class="st-btn" data-st="' + id + '" data-d="1" aria-label="زيادة">+</button>' +
        (unit ? '<span class="st-unit">' + unit + '</span>' : '') +
      '</div>';
    const srow = (label, desc, ctrl) =>
      '<div class="set-row"><div class="sr-txt"><b>' + label + '</b>' +
      (desc ? '<span>' + desc + '</span>' : '') + '</div>' +
      (ctrl ? '<div class="sr-ctl">' + ctrl + '</div>' : '') + '</div>';
    const card = (span, extra, icon, title, sub, body) =>
      '<section class="card glass-1 set-card ' + span + ' ' + extra + '">' +
        '<header class="sc-head"><span class="sg-ic">' + I.get(icon, 17) + '</span>' +
        '<div class="sc-title"><b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div></header>' +
        '<div class="set-body">' + body + '</div>' +
      '</section>';

    const grade = U.esc(st.user.grade || "ثانية ثانوي — بكالوريا");

    const profileBody =
      srow("الاسم", U.esc(st.user.name), '<button class="btn sm" data-set="name">تعديل</button>') +
      srow("الصورة الشخصية", "رمز تعبيري أو صورة من جهازك", '<button class="btn sm" data-set="avatar">تغيير</button>') +
      srow("الصف الدراسي", "ثابت طوال السنة الدراسية", '<span class="static-val">' + grade + '</span>');

    const studyBody =
      '<div class="study-cols">' +
        srow("الهدف اليومي", "ساعات التركيز المستهدفة", step("set-goal", s.dailyGoalMinutes / 60, "ساعة", 1, 12)) +
        srow("الهدف الأسبوعي", "ساعات الدراسة المستهدفة أسبوعيًا", step("set-week-goal", s.weeklyGoalMinutes / 60, "ساعة", 7, 84)) +
        srow("الهدف الشهري", "ساعات الدراسة المستهدفة شهريًا", step("set-month-goal", s.monthlyGoalMinutes / 60, "ساعة", 30, 360)) +
        srow("مدة البومودورو", "دقيقة دراسة لكل جولة", step("set-pomo", s.pomodoroStudy, "دقيقة", 5, 120)) +
        srow("الاستراحة القصيرة", "بعد كل جولة", step("set-break", s.pomodoroBreak, "دقيقة", 1, 30)) +
        srow("الاستراحة الطويلة", "بعد عدة جولات", step("set-long", s.pomodoroLong, "دقيقة", 5, 60)) +
        srow("جلسة التركيز", "للوضع Focus الافتراضي", step("set-focus", s.focusDuration, "دقيقة", 10, 180)) +
        srow("جلسات الدراسة", "الجولات قبل الراحة الطويلة", step("set-sess", s.pomodoroSessions, "جولة", 1, 10)) +
      '</div>' +
      '<div class="set-foot"><span class="hint">' + I.get("check", 12) + 'تُحفظ التغييرات فورًا وتنعكس على كل الصفحات</span>' +
        '<button class="btn sm ghost" data-set="apply-study">حفظ الإعدادات</button></div>';

    const appearanceBody =
      srow("الوضع", "داكن، فاتح، أو تلقائي", seg(s.theme, [{v:"light",t:"فاتح"},{v:"dark",t:"داكن"},{v:"system",t:"تلقائي"}], "theme")) +
      srow("الشريط الجانبي", "موسّع أو مصغّر", seg(s.sidebarMode, [{v:"expanded",t:"موسّع"},{v:"collapsed",t:"مصغّر"}], "sidebar")) +
      srow("الكثافة", "مساحات البطاقات والمحتوى", seg(s.density, [{v:"comfortable",t:"مريح"},{v:"compact",t:"مدمج"}], "density"));

    const pushTxt = (function(){
      const P = App.Push;
      if (!P || !P.supported()) return "غير مدعومة في هذه البيئة — تحتاج https أو localhost";
      if (!(App.Sync && App.Sync.user)) return "اربط حساب Google أولًا لتصلك الإشعارات في وقتها حتى والتطبيق مقفول";
      if (!App.SupabaseConfig || !App.SupabaseConfig.vapidPublicKey) return "مفتاح VAPID العام غير مضبوط بعد في js/supabase-config.js";
      return "تصلك تذكيرات المهام والواجبات والمراجعة في وقتها المحدد حتى لو التطبيق مقفول تمامًا";
    })();

    const notifBody =
      '<div class="notif-grid">' +
        srow("تذكير الدراسة", "", sw(s.notif.study, "n_study")) +
        srow("تذكير الواجبات", "", sw(s.notif.homework, "n_homework")) +
        srow("تذكير الهدف اليومي", "", sw(s.notif.dailyGoal, "n_dailyGoal")) +
        srow("إشعارات الإنجازات", "", sw(s.notif.achievements, "n_achievements")) +
        srow("تحذير السلسلة", "", sw(s.notif.streak, "n_streak")) +
        srow("تذكير مراجعة الأخطاء", "", sw(s.notif.review, "n_review")) +
        srow("صوت التنبيه", "", sw(s.sound, "sound")) +
        srow("إشعارات المتصفح",
          (window.App.Notify && App.Notify.supported()
            ? "تنبيهات خارج الصفحة للواجبات القريبة (مستحق اليوم/غدًا/متأخر)"
            : "غير مدعومة في هذه البيئة — فعّلها عبر localhost أو https"),
          sw(s.browserNotif, "browser")) +
        srow("إشعارات الدفع — وقت محدد", pushTxt, sw(s.pushNotif, "push")) +
      '</div>';

    const dataBody =
      srow("تصدير نسخة احتياطية", "ملف JSON يحوي كل بياناتك", '<button class="btn sm" data-set="export">' + I.get("export", 14) + 'تصدير</button>') +
      srow("استيراد نسخة احتياطية", "استعادة بياناتك من ملف JSON", '<button class="btn sm" data-set="import">' + I.get("import", 14) + 'استيراد</button>') +
      '<input type="file" id="set-file" accept="application/json,.json" hidden>' +
      srow("بيانات التطبيق", "تحميل عينة لفهم المنصة", '<button class="btn sm" data-set="sample">عينة</button>');

const syncBody =
      (function(){
        const sy = (App.Sync && App.Sync.user) || null;
        const stt = (App.Sync && App.Sync.ready) ? "" : '<span class="muted small">جارٍ الاتصال…</span>';
        if (!sy){
          return srow("الحساب السحابي", "اربط حساب Google يُبقي مهامك وجلساتك متزامنة عبر الأجهزة",
            '<button class="btn sm primary" data-set="sync-in">' + I.get("google", 16) + 'اربط حساب Google</button>') + stt;
        }
        return srow("الحساب المتصل", (sy.email ? U.esc(sy.email) + " — " : "") + U.esc(sy.name || ""),
            '<button class="btn sm danger" data-set="sync-out">قطع الاتصال</button>') +
          srow("المزامنة", "تزامن فوري بين أجهزتك",
            '<button class="btn sm ghost" data-set="sync-now">مزامنة الآن</button>') + stt;
      })() +
      srow("حالة الاتصال", '<span id="conn-state" class="muted small">تحضير…</span>',
        '<span class="badge neutral" id="conn-badge">جارٍ الفحص</span>');

    const aiBody =
      '<div class="set-row"><div class="sr-txt"><b>مفتاح Gemini API</b><span>المفتاح يُخزّن مشفّرًا في السحابة ولا يظهر لأحد — حتى المطور لا يستطيع قراءته.</span></div></div>' +
      '<div class="set-row"><div class="sr-txt"><b>الحالة</b><span id="ai-settings-status">جارٍ الفحص…</span></div>' +
        '<div class="sr-ctl"><span class="badge neutral" id="ai-settings-badge">—</span></div></div>' +
      '<div class="set-row"><div class="sr-txt"><b>المفتاح</b><span>أدخل مفتاح Gemini API الخاص بك (يبدأ بـ AIza)</span></div>' +
        '<div class="sr-ctl" style="display:flex;gap:8px;align-items:center">' +
          '<input type="password" class="input" id="ai-settings-key" placeholder="AIzaSy..." style="min-width:200px" autocomplete="off">' +
          '<button class="btn sm" id="ai-settings-toggle-vis" aria-label="إظهار/إخفاء المفتاح">' + I.get("info", 13) + '</button>' +
        '</div></div>' +
      '<div class="set-row"><div class="sr-txt"><b>النموذج</b><span>gemini-2.5-flash-lite</span></div></div>' +
      '<div class="set-foot" style="flex-wrap:wrap;gap:8px">' +
        '<button class="btn sm primary" id="ai-settings-save">حفظ المفتاح</button>' +
        '<button class="btn sm ghost" id="ai-settings-test">اختبار الاتصال</button>' +
        '<button class="btn sm danger" id="ai-settings-delete">حذف المفتاح</button>' +
      '</div>';

    const dangerBody =
      srow("إعادة ضبط التطبيق", "حذف كل المهام والجلسات والملاحظات والإحصائيات",
        '<button class="btn danger sm" data-set="reset">إعادة تعيين</button>') +
      '<p class="danger-note">سيُطلب منك التأكيد قبل حذف أي بيانات. لا يمكن التراجع عن هذه الخطوة.</p>';

    return '<div class="page-head"><div><div class="page-title">الإعدادات</div>' +
      '<div class="page-sub">تحكم في تجربتك الدراسية وحسابك وتفضيلات التطبيق</div></div></div>' +

      '<div class="settings-stack">' +
        card("", "", "user", "الحساب", "إدارة معلوماتك الشخصية", profileBody) +
        card("", "", "monitor", "المظهر", "الوضع والكثافة وترتيب الشريط", appearanceBody) +
        card("", "", "clock", "الدراسة", "تخصيص أهداف وإعدادات الدراسة", studyBody) +
        card("", "", "bell", "التنبيهات", "تحكم في طريقة تنبيهك", notifBody) +
        card("", "", "box", "البيانات", "إدارة بياناتك ونسخك الاحتياطية", dataBody) +
        card("", "", "cloud", "السحابة", "اربط حساب Google للمزامنة عبر الأجهزة", syncBody) +
        card("", "", "robot", "المساعد الذكي", "إعداد مفتاح Gemini API للمساعد الذكي", aiBody) +
        card("", "danger", "trash", "منطقة الخطر", "إجراءات لا يمكن التراجع عنها", dangerBody) +
      '</div>';
  }

  function bindSettings(root, st, s){
    const cloudBind = (name, fn) => {
      const b = root.querySelector("[data-set='" + name + "']");
      if (b) b.addEventListener("click", fn);
    };
    cloudBind("sync-in", () => {
      if (!(App.Sync && App.Sync.signIn)){ UI.toast("طبقة السحابة غير محمّلة — تحقق من js/supabase.js و js/supabase-config.js.", "error", "info"); return; }
      App.Sync.signIn().then(res => {
        if (res && res.ok === false){
          UI.toast(res.error || "تعذّر فتح تسجيل الدخول من Google.", "error", "close");
        }
      }).catch(err => {
        UI.toast(err && err.message ? err.message : "تعذّر فتح تسجيل الدخول من Google.", "error", "close");
      });
      UI.toast("جارٍ فتح تسجيل الدخول…", "gold", "google");
    });
    cloudBind("sync-out", () => {
      if (App.Sync && App.Sync.signOut){
        App.Sync.signOut().then(res => {
          if (res && res.ok){
            UI.toast("تم قطع اتصال الحساب.", "success", "check");
            App.Router && App.Router.rerender && App.Router.rerender();
          } else {
            UI.toast(res && res.error ? res.error : "تعذّر قطع الاتصال.", "error", "close");
          }
        }).catch(err => {
          UI.toast(err && err.message ? err.message : "تعذّر قطع الاتصال.", "error", "close");
        });
      } else UI.toast("السحابة غير محمّلة.", "error", "info");
    });
    cloudBind("sync-now", () => {
      if (App.Sync && App.Sync.syncNow){
        UI.toast("جارٍ المزامنة…", "gold", "refresh");
        App.Sync.syncNow().then(res => {
          if (res && res.ok) UI.toast("تمت المزامنة مع السحابة.", "success", "check");
          else UI.toast(res && res.error ? res.error : "تعذّرت المزامنة.", "error", "close");
        }).catch(err => {
          UI.toast(err && err.message ? err.message : "تعذّرت المزامنة.", "error", "close");
        });
      } else UI.toast("السحابة غير محمّلة.", "error", "info");
    });
    root.querySelectorAll("[data-seg]").forEach(b => b.addEventListener("click", () => {
      const target = b.dataset.seg, v = b.dataset.v;
      if (target === "theme"){ S.updateSettings({ theme: v }); App.Router.applyTheme(); }
      else if (target === "sidebar"){ S.updateSettings({ sidebarMode: v }); App.Router.applyLayout(); }
      else if (target === "density"){ S.updateSettings({ density: v }); App.Router.applyLayout(); }
      App.Router.rerender();
    }));
    root.querySelectorAll("[data-sw]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.sw;
      if (k === "sound"){ S.updateSettings({ sound: b.checked }); return; }
      if (k === "browser"){
        S.updateSettings({ browserNotif: b.checked });
        if (b.checked && App.Notify && App.Notify.ask){
          App.Notify.ask().then(r => {
            if (r.supported && r.granted) UI.toast("فُعّلت إشعارات المتصفح للواجبات القريبة.", "success", "check");
            else if (r.supported) {
              UI.toast("تم رفض إذن المتصفح — فعّل الإشعارات يدويًا من إعدادات المتصفح.", "error", "bell");
              if (S.getState().settings.browserNotif){ S.updateSettings({ browserNotif: false }); App.Router.rerender(); }
            } else {
              UI.toast("المتصفح لا يدعم الإشعارات هنا — جرّب عبر localhost أو https.", "gold", "bell");
              if (S.getState().settings.browserNotif){ S.updateSettings({ browserNotif: false }); App.Router.rerender(); }
            }
          });
        }
        return;
      }
      if (k === "push"){
        if (!App.Push){ UI.toast("طبقة الإشعارات غير محمّلة.", "error", "info"); return; }
        if (b.checked){
          UI.toast("جارٍ تفعيل إشعارات الدفع…", "gold", "bell");
          App.Push.enable().then(r => {
            if (r && r.ok) UI.toast("فُعّلت إشعارات الدفع — ستصلك في وقتها المحدد.", "success", "check");
            else {
              UI.toast((r && r.error) || "تعذّر تفعيل إشعارات الدفع.", "error", "bell");
              S.updateSettings({ pushNotif: false });
            }
            App.Router && App.Router.rerender && App.Router.rerender();
          }).catch(err => {
            UI.toast((err && err.message) || "تعذّر تفعيل إشعارات الدفع.", "error", "bell");
            S.updateSettings({ pushNotif: false });
            App.Router && App.Router.rerender && App.Router.rerender();
          });
        } else {
          App.Push.disable().then(() => {
            UI.toast("أُوقفت إشعارات الدفع.", "gold", "bell");
            App.Router && App.Router.rerender && App.Router.rerender();
          });
        }
        return;
      }
      const n = {}; n[k.slice(2)] = b.checked; S.updateSettings({ notif: n });
    }));
    const studySave = () => {
      const g = Math.min(12, Math.max(1, +document.getElementById("set-goal").value || 4));
      const wg = Math.min(84, Math.max(7, +document.getElementById("set-week-goal").value || 28));
      const mg = Math.min(360, Math.max(30, +document.getElementById("set-month-goal").value || 120));
      const p = Math.min(120, Math.max(5, +document.getElementById("set-pomo").value || 25));
      const br = Math.min(30, Math.max(1, +document.getElementById("set-break").value || 5));
      const lg = Math.min(60, Math.max(5, +document.getElementById("set-long").value || 20));
      const se = Math.min(10, Math.max(1, +document.getElementById("set-sess").value || 4));
      const fo = Math.min(180, Math.max(10, +document.getElementById("set-focus").value || 30));
      S.updateSettings({ dailyGoalMinutes: g * 60, weeklyGoalMinutes: wg * 60, monthlyGoalMinutes: mg * 60, pomodoroStudy: p, pomodoroBreak: br, pomodoroLong: lg, pomodoroSessions: se, focusDuration: fo });
    };
    root.querySelectorAll("[data-st]").forEach(b => b.addEventListener("click", () => {
      const inp = document.getElementById(b.dataset.st);
      if (!inp) return;
      const v = (+inp.value || 0) + (+b.dataset.d);
      inp.value = String(Math.min(+inp.max, Math.max(+inp.min, v)));
      studySave();
    }));
    ["set-goal","set-week-goal","set-month-goal","set-pomo","set-break","set-long","set-sess","set-focus"].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) inp.addEventListener("change", studySave);
    });
    root.querySelector("[data-set='apply-study']").addEventListener("click", () => {
      studySave();
      UI.toast("تم حفظ إعدادات الدراسة.", "success", "check");
      App.Router.rerender();
    });
    root.querySelectorAll("[data-set='name']").forEach(b => b.addEventListener("click", () => {
      UI.openModal(UI.modalShell(I.get("edit", 18) + ' تعديل الاسم', '<div class="field"><label>الاسم <span class="req">*</span></label><input class="input" id="set-name-i" value="' + U.esc(st.user.name) + '"></div>',
        '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="set-name-s">حفظ</button>'), { autoFocus: "#set-name-i" });
      document.getElementById("set-name-s").addEventListener("click", () => {
        const v = document.getElementById("set-name-i").value.trim();
        if (!v){ UI.toast("اكتب اسمك.", "error", "info"); return; }
        S.updateUser({ name: v }); UI.closeModal(); UI.toast("تم تحديث الاسم.");
      });
    }));
    root.querySelectorAll("[data-set='avatar']").forEach(b => b.addEventListener("click", openAvatarPicker));
    root.querySelector("[data-set='export']").addEventListener("click", () => {
      const blob = new Blob([S.exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "study-os-backup-" + U.todayKey() + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      UI.toast("تم تصدير النسخة الاحتياطية.", "gold", "export");
    });
    root.querySelector("[data-set='import']").addEventListener("click", () => document.getElementById("set-file").click());
    document.getElementById("set-file").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const v = S.validateImport(String(reader.result));
        if (!v.ok){ UI.toast(v.error, "error", "info"); return; }
        const p = v.preview;
        UI.confirmDialog("استيراد النسخة الاحتياطية",
          '<div class="muted small">ستُستبدل بياناتك الحالية بنسخة الملف. تأكد قبل المتابعة.</div>' +
          '<div class="day-summary" style="margin-top:12px">' +
            '<div class="day-sum-card"><b>' + p.tasks + '</b><span>مهام</span></div>' +
            '<div class="day-sum-card"><b>' + p.homework + '</b><span>واجبات</span></div>' +
            '<div class="day-sum-card"><b>' + p.blocks + '</b><span>جلسات</span></div>' +
            '<div class="day-sum-card"><b>' + p.mistakes + '</b><span>أخطاء</span></div>' +
            '<div class="day-sum-card"><b>' + p.notes + '</b><span>ملاحظات</span></div>' +
            '<div class="day-sum-card"><b class="num">' + p.xp + '</b><span>XP</span></div>' +
          '</div>' +
          '<div class="muted small">المستخدم: ' + U.esc(p.user) + '</div>',
          "استيراد الآن", () => {
            try {
              S.importData(String(reader.result));
              UI.toast("تم استيراد البيانات بنجاح.", "success", "check");
              App.Router.rerender();
              if (App.Sync && App.Sync.syncNow){
                App.Sync.syncNow().then(res => {
                  if (res && res.ok) UI.toast("رُفعت البيانات المستوردة إلى السحابة.", "success", "cloud");
                  else if (res && !res.ok) UI.toast(res.error || "المزامنة التلقائية غير متاحة — سيتم الرفع عند اتصالك.", "gold", "cloud");
                }).catch(() => {});
              }
            }
            catch(err){ UI.toast("تعذر استيراد البيانات. حاول مرة أخرى.", "error", "info"); }
          }, {});
      };
      reader.readAsText(file);
      e.target.value = "";
    });
    root.querySelector("[data-set='sample']").addEventListener("click", () => {
      UI.dangerConfirm("تحميل بيانات تجريبية", "سيتم إضافة بيانات عينة (مهام، جلسات، أخطاء، ملاحظات) فوق بياناتك الحالية، وقد تُكرر البيانات.", "تحميل", () => {
        S.seedDemo(); UI.toast("تم تحميل البيانات التجريبية.", "gold", "box");
      });
    });
    /* ── AI Settings bindings ── */
    (function bindAISettings(){
      const statusEl = root.querySelector("#ai-settings-status");
      const badgeEl = root.querySelector("#ai-settings-badge");
      const keyInput = root.querySelector("#ai-settings-key");
      const saveBtn = root.querySelector("#ai-settings-save");
      const testBtn = root.querySelector("#ai-settings-test");
      const deleteBtn = root.querySelector("#ai-settings-delete");
      const toggleBtn = root.querySelector("#ai-settings-toggle-vis");

      if (toggleBtn) toggleBtn.addEventListener("click", () => {
        if (!keyInput) return;
        const isPass = keyInput.type === "password";
        keyInput.type = isPass ? "text" : "password";
      });

      async function getAiToken(){
        if (!App.Sync || !App.Sync.getSession) return null;
        try {
          const s = await App.Sync.getSession();
          if (s.ok && s.session && s.session.access_token) return s.session.access_token;
        } catch(_e){}
        return null;
      }
      async function aiFetch(method, body){
        const token = await getAiToken();
        const c = App.SupabaseConfig;
        if (!token || !c || !c.supabaseUrl) return { ok: false, error: "غير مسجّل الدخول." };
        const opts = { method, headers: { "Authorization": "Bearer " + token, "apikey": c.supabaseAnonKey } };
        if (body){ opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
        const res = await fetch(c.supabaseUrl + "/functions/v1/ai-settings", opts);
        return await res.json();
      }

      async function loadStatus(){
        try {
          const data = await aiFetch("GET");
          if (data && data.ok && data.configured){
            if (statusEl) statusEl.textContent = "تم الإعداد — النموذج: " + (data.model || "gemini-2.5-flash-lite");
            if (badgeEl){ badgeEl.textContent = "مُعد"; badgeEl.className = "badge emerald"; }
          } else {
            if (statusEl) statusEl.textContent = "لم يُضف مفتاح بعد.";
            if (badgeEl){ badgeEl.textContent = "غير مُعد"; badgeEl.className = "badge amber"; }
          }
        } catch(_e){
          if (statusEl) statusEl.textContent = "تعذّر الفحص.";
          if (badgeEl){ badgeEl.textContent = "خطأ"; badgeEl.className = "badge red"; }
        }
      }
      loadStatus();

      if (saveBtn) saveBtn.addEventListener("click", async () => {
        const key = (keyInput ? keyInput.value : "").trim();
        if (!key){ UI.toast("أدخل المفتاح أولًا.", "error", "info"); return; }
        saveBtn.disabled = true;
        try {
          const data = await aiFetch("POST", { apiKey: key });
          if (data && data.ok){
            UI.toast("تم حفظ المفتاح بنجاح.", "success", "check");
            if (keyInput) keyInput.value = "";
            loadStatus();
          } else {
            UI.toast((data && data.error) || "تعذّر الحفظ.", "error", "close");
          }
        } catch(_e){
          UI.toast("خطأ في الاتصال.", "error", "close");
        }
        saveBtn.disabled = false;
      });

      if (testBtn) testBtn.addEventListener("click", async () => {
        testBtn.disabled = true;
        testBtn.textContent = "جارٍ الفحص…";
        try {
          const data = await aiFetch("POST", { action: "test" });
          if (data && data.ok){
            UI.toast("الاتصال بنجاح — المفتاح صالح.", "success", "check");
          } else {
            UI.toast((data && data.error) || "تعذّر الاتصال.", "error", "close");
          }
        } catch(_e){
          UI.toast("خطأ في الاتصال.", "error", "close");
        }
        testBtn.disabled = false;
        testBtn.textContent = "اختبار الاتصال";
      });

      if (deleteBtn) deleteBtn.addEventListener("click", () => {
        UI.dangerConfirm("حذف المفتاح", "سيتم حذف مفتاح Gemini API نهائًا. لن تتمكن من استخدام المساعد الذكي حتى تُضيف مفتاحًا جديدًا.", "حذف", async () => {
          try {
            const data = await aiFetch("DELETE");
            if (data && data.ok){
              UI.toast("تم حذف المفتاح.", "gold", "trash");
              loadStatus();
            } else {
              UI.toast((data && data.error) || "تعذّر الحذف.", "error", "close");
            }
          } catch(_e){
            UI.toast("خطأ في الاتصال.", "error", "close");
          }
        });
      });
    })();

    root.querySelector("[data-set='reset']").addEventListener("click", () => {
      UI.dangerConfirm("إعادة تعيين الكل",
        'هل أنت متأكد؟ سيتم حذف جميع المهام والجلسات والملاحظات والإحصائيات والإنجازات نهائيًا (محليًا وعلى السحابة إن كنت متصلًا). هذه الخطوة لا يمكن التراجع عنها.',
        "مسح كل شيء", () => {
          S.resetAll();
          var cloudClear = App.Sync && App.Sync.resetCloud ? App.Sync.resetCloud().catch(() => {}) : Promise.resolve();
          cloudClear.then(() => { UI.toast("تمت إعادة التعيين بالكامل.", "gold", "trash"); });
          App.Router.go("dashboard");
        }, {});
    });
  }

})();