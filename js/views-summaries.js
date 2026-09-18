/* ═══════════════ STUDY OS — views-summaries.js (ملخصات المحاضرات) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Views = App.Views || {};
(function () {
  const U = App.Util, D = App.Data, S = App.Store, I = App.Icons, UI = App.UI;
  const $ = id => document.getElementById(id);
  const BUCKET = "lecture-summaries";

  let selectedSubject = null;
  let searchQuery = "";
  let filterStatus = "all";
  let filterFav = false;
  let sortBy = "lecture_number";
  let summariesCache = [];
  let loading = false;

  const STATUS_LABELS = { unread: "لم تبدأ", reading: "قيد القراءة", read: "تمت القراءة" };
  const STATUS_ICONS = { unread: "clock", reading: "focus", read: "check" };
  const STATUS_CLS = { unread: "ls-st-unread", reading: "ls-st-reading", read: "ls-st-read" };

  function edgeBase(){
    const c = App.SupabaseConfig;
    return c && c.supabaseUrl ? c.supabaseUrl.replace(/\/$/, "") + "/functions/v1" : null;
  }
  async function getToken(){
    if (!App.Sync || !App.Sync.getSession) return null;
    try { const s = await App.Sync.getSession(); if (s.ok && s.session) return s.session.access_token; } catch(_e){}
    return null;
  }
  function isLoggedIn(){ return !!(App.Sync && App.Sync.user); }

  async function apiFetch(method, path, body){
    const token = await getToken();
    const base = edgeBase();
    if (!token || !base) return { ok: false, error: "غير مسجّل الدخول." };
    const opts = { method, headers: { "Authorization": "Bearer " + token, "apikey": App.SupabaseConfig.supabaseAnonKey } };
    if (body && !(body instanceof FormData)){ opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    else if (body instanceof FormData){ opts.body = body; }
    const res = await fetch(base + "/lecture-summaries" + path, opts);
    return await res.json();
  }

  async function loadSummaries(subjectId){
    loading = true;
    const listEl = $("ls-list");
    if (listEl) listEl.innerHTML = skeletonHTML();
    const data = await apiFetch("GET", "?subject_id=" + encodeURIComponent(subjectId));
    loading = false;
    if (data.ok) summariesCache = data.summaries || [];
    else summariesCache = [];
    return summariesCache;
  }

  function filtered(){
    let list = summariesCache.slice();
    if (searchQuery){
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.title || "").toLowerCase().includes(q) ||
        String(s.lecture_number || "").includes(q) ||
        (s.unit || "").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter(s => s.status === filterStatus);
    if (filterFav) list = list.filter(s => s.isFavorite);
    list.sort((a, b) => {
      if (sortBy === "lecture_number"){
        const an = a.lecture_number == null ? 9999 : a.lecture_number;
        const bn = b.lecture_number == null ? 9999 : b.lecture_number;
        return an - bn;
      }
      if (sortBy === "newest") return (b.createdAt || "").localeCompare(a.createdAt || "");
      if (sortBy === "oldest") return (a.createdAt || "").localeCompare(b.createdAt || "");
      if (sortBy === "name") return (a.title || "").localeCompare(b.title || "", "ar");
      return 0;
    });
    return list;
  }

  function fmtSize(bytes){
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  function stats(list){
    return {
      total: list.length,
      read: list.filter(s => s.status === "read").length,
      reading: list.filter(s => s.status === "reading").length,
      unread: list.filter(s => s.status === "unread").length,
      fav: list.filter(s => s.isFavorite).length
    };
  }

  /* ── Subject Tabs ── */
  function subjectTabsHTML(){
    const subs = D.subjects.filter(s => s.id !== "general");
    const pills = subs.map(s => {
      const active = selectedSubject === s.id;
      return '<button class="ls-subject-pill' + (active ? " active" : "") + '" data-ls-subj="' + s.id + '" style="' + (active ? "border-color:" + s.accent + ";background:" + s.accent + "18;box-shadow:0 0 0 1px " + s.accent + "40" : "") + '">' +
        '<span class="ls-pill-dot" style="background:' + s.accent + '"></span>' +
        '<span class="ls-pill-name">' + U.esc(s.name) + '</span>' +
      '</button>';
    }).join("");
    return '<div class="ls-subjects-wrap">' +
      '<div class="ls-subjects-head">' +
        '<div class="ls-subjects-label">' + I.get("book", 16) + ' <span>اختر المادة</span></div>' +
        '<button class="btn sm ghost" id="ls-subjects-settings">' + I.get("settings", 14) + ' إدارة المواد</button>' +
      '</div>' +
      '<div class="ls-subjects" id="ls-subjects">' + pills + '</div>' +
    '</div>';
  }

  /* ── Dashboard Stats ── */
  function dashboardHTML(){
    const list = filtered();
    const s = stats(list);
    return '<div class="ls-stats">' +
      '<div class="ls-stat"><div class="ls-stat-val">' + s.total + '</div><div class="ls-stat-lbl">ملخص</div></div>' +
      '<div class="ls-stat ls-stat-read"><div class="ls-stat-val">' + s.read + '</div><div class="ls-stat-lbl">مقروءة</div></div>' +
      '<div class="ls-stat ls-stat-reading"><div class="ls-stat-val">' + s.reading + '</div><div class="ls-stat-lbl">قيد القراءة</div></div>' +
      '<div class="ls-stat ls-stat-unread"><div class="ls-stat-val">' + s.unread + '</div><div class="ls-stat-lbl">لم تُقرأ</div></div>' +
      '<div class="ls-stat ls-stat-fav"><div class="ls-stat-val">' + s.fav + '</div><div class="ls-stat-lbl">مفضلة</div></div>' +
    '</div>';
  }

  /* ── Toolbar ── */
  function toolbarHTML(){
    const statuses = [["all", "الكل"], ["unread", "لم تبدأ"], ["reading", "قيد القراءة"], ["read", "تمت القراءة"]];
    const sortOptions = [
      ["lecture_number", "رقم المحاضرة"],
      ["newest", "الأحدث"],
      ["oldest", "الأقدم"],
      ["name", "الاسم"]
    ];
    const currentSort = sortOptions.find(o => o[0] === sortBy) || sortOptions[0];
    return '<div class="ls-toolbar">' +
      '<div class="ls-toolbar-left">' +
        '<div class="ls-search-wrap">' +
          '<span class="ls-search-icon">' + I.get("search", 15) + '</span>' +
          '<input class="ls-search-input" id="ls-search" placeholder="ابحث في الملخصات..." value="' + U.esc(searchQuery) + '">' +
        '</div>' +
        '<div class="ls-filter-group">' +
          statuses.map(([v, t]) => '<button class="ls-filter-chip' + (filterStatus === v ? " active" : "") + '" data-ls-filter="' + v + '">' + t + '</button>').join("") +
        '</div>' +
        '<button class="ls-filter-chip' + (filterFav ? " active" : "") + '" data-ls-fav>' + I.get("star", 12) + ' المفضلة</button>' +
      '</div>' +
      '<div class="ls-toolbar-right">' +
        '<div class="ls-sort-dropdown" id="ls-sort-dropdown">' +
          '<button class="ls-sort-btn" id="ls-sort-btn">' + I.get("sort", 14) + ' <span class="ls-sort-label">' + currentSort[1] + '</span>' + I.get("chevron-down", 12) + '</button>' +
          '<div class="ls-sort-menu" id="ls-sort-menu" hidden>' +
            sortOptions.map(([v, t]) =>
              '<button class="ls-sort-option' + (sortBy === v ? " active" : "") + '" data-ls-sort="' + v + '">' +
                (sortBy === v ? '<span class="ls-sort-check">' + I.get("check", 14) + '</span>' : '<span class="ls-sort-check"></span>') +
                t +
              '</button>'
            ).join("") +
          '</div>' +
        '</div>' +
        '<button class="btn primary sm" id="ls-add">' + I.get("plus", 13) + ' <span>إضافة ملخص</span></button>' +
      '</div>' +
    '</div>';
  }

  /* ── Skeleton Loading ── */
  function skeletonHTML(){
    let cards = "";
    for (let i = 0; i < 6; i++){
      cards += '<div class="ls-card ls-skeleton">' +
        '<div class="ls-card-top"><div class="ls-sk-icon sk-pulse"></div><div style="flex:1"><div class="sk-bar sk-w60"></div><div class="sk-bar sk-w40 sk-sm"></div></div></div>' +
        '<div class="ls-card-body"><div class="sk-bar sk-w80"></div><div class="sk-bar sk-w50 sk-sm"></div></div>' +
        '<div class="ls-card-foot"><div class="sk-bar sk-w30 sk-sm"></div><div class="sk-bar sk-w20 sk-sm"></div></div>' +
      '</div>';
    }
    return cards;
  }

  /* ── Summary Card ── */
  function summaryCard(s){
    const subj = D.subjectById(s.subjectId);
    const accent = subj.accent || "var(--gold-2)";
    const stCls = STATUS_CLS[s.status] || "ls-st-unread";
    const stIcon = STATUS_ICONS[s.status] || "clock";
    const stLabel = STATUS_LABELS[s.status] || "لم تبدأ";
    const meta = [];
    if (s.lecture_number != null) meta.push("محاضرة " + s.lecture_number);
    if (s.unit) meta.push(U.esc(s.unit));
    meta.push(fmtSize(s.file_size));

    return '<div class="ls-card" data-ls-id="' + s.id + '">' +
      '<div class="ls-card-top">' +
        '<div class="ls-card-pdf">' +
          '<span class="ls-pdf-icon">' + I.get("notes", 22) + '</span>' +
          '<span class="ls-pdf-ext">PDF</span>' +
        '</div>' +
        '<div class="ls-card-info">' +
          '<div class="ls-card-title" title="' + U.esc(s.title) + '">' + U.esc(s.title) + '</div>' +
          '<div class="ls-card-meta">' + meta.join(" · ") + '</div>' +
        '</div>' +
        (s.isFavorite ? '<button class="ls-fav-badge" data-ls-fav-toggle="' + s.id + '" title="إزالة من المفضلة">' + I.get("star", 15) + '</button>' :
          '<button class="ls-fav-badge ls-fav-inactive" data-ls-fav-toggle="' + s.id + '" title="إضافة للمفضلة">' + I.get("star", 15) + '</button>') +
      '</div>' +
      '<div class="ls-card-body">' +
        '<span class="ls-status-badge ' + stCls + '">' + I.get(stIcon, 11) + ' ' + stLabel + '</span>' +
        '<span class="ls-card-date num">' + U.fmtDate((s.createdAt || "").slice(0,10), { short: true }) + '</span>' +
      '</div>' +
      '<div class="ls-card-foot">' +
        '<button class="btn sm primary" data-ls-open="' + s.id + '">' + I.get("play", 12) + ' قراءة</button>' +
        '<button class="btn sm ghost" data-ls-dl="' + s.id + '">' + I.get("export", 12) + ' تحميل</button>' +
        '<div class="ls-menu-wrap">' +
          '<button class="btn sm ghost ls-menu-btn" data-ls-menu="' + s.id + '" title="خيارات">⋯</button>' +
          '<div class="ls-dropdown" id="ls-dd-' + s.id + '" hidden>' +
            '<button data-ls-edit="' + s.id + '">' + I.get("edit", 13) + ' تعديل البيانات</button>' +
            '<button data-ls-replace="' + s.id + '">' + I.get("refresh", 13) + ' استبدال ملف PDF</button>' +
            '<button data-ls-delete="' + s.id + '" class="danger">' + I.get("trash", 13) + ' حذف</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Empty State ── */
  function emptyHTML(){
    const subj = selectedSubject ? D.subjectById(selectedSubject) : null;
    const name = subj ? subj.name : "هذه المادة";
    return '<div class="ls-empty">' +
      '<div class="ls-empty-icon">' + I.get("notes", 48) + '</div>' +
      '<h3 class="ls-empty-title">لا توجد ملخصات لـ' + U.esc(name) + ' بعد</h3>' +
      '<p class="ls-empty-sub">ابدأ بإضافة أول ملخص محاضرة لتبدأ في تنظيم مذاكرتك.</p>' +
      '<button class="btn primary" id="ls-empty-add">' + I.get("plus", 14) + ' إضافة ملخص</button>' +
    '</div>';
  }

  function loginRequiredHTML(){
    return '<div class="ls-empty">' +
      '<div class="ls-empty-icon">' + I.get("user", 48) + '</div>' +
      '<h3 class="ls-empty-title">سجل الدخول أولاً</h3>' +
      '<p class="ls-empty-sub">سجل الدخول لحفظ ملفات المحاضرات ومزامنتها بين أجهزتك.</p>' +
      '<a class="btn primary" href="#/settings">' + I.get("user", 14) + ' تسجيل الدخول</a>' +
    '</div>';
  }

  /* ── Upload Modal ── */
  function renderUploadModal(files, subjectId){
    let rows = files.map((f, i) =>
      '<div class="ls-upload-item">' +
        '<div class="ls-upload-file">' +
          '<span class="ls-upload-pdf">' + I.get("notes", 18) + '</span>' +
          '<div><div class="ls-upload-name">' + U.esc(f.name) + '</div><div class="ls-upload-size muted small">' + fmtSize(f.size) + '</div></div>' +
        '</div>' +
        '<input class="input ls-up-title" data-idx="' + i + '" placeholder="اسم الملخص" value="' + U.esc(f.name.replace(/\.pdf$/i, "")) + '">' +
        '<input class="input ls-up-num" data-idx="' + i + '" type="number" min="1" placeholder="رقم المحاضرة">' +
      '</div>'
    ).join("");
    const m = UI.openModal(UI.modalShell(
      I.get("plus", 18) + ' رفع ملخصات',
      '<div id="ls-upload-list">' + rows + '</div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="ls-upload-btn">رفع الملفات</button>',
      { size: "narrow" }
    ));
    const btn = m.querySelector("#ls-upload-btn");
    if (btn) btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "جارٍ الرفع…";
      let ok = 0, fail = 0;
      for (let i = 0; i < files.length; i++){
        const titleInput = m.querySelector('.ls-up-title[data-idx="' + i + '"]');
        const numInput = m.querySelector('.ls-up-num[data-idx="' + i + '"]');
        const title = titleInput ? titleInput.value.trim() : files[i].name;
        const num = numInput && numInput.value ? parseInt(numInput.value) : null;
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("title", title || files[i].name);
        fd.append("subject_id", subjectId);
        if (num) fd.append("lecture_number", String(num));
        const res = await apiFetch("POST", "", fd);
        if (res.ok) ok++; else fail++;
      }
      UI.closeModal();
      if (fail) UI.toast("تم رفع " + ok + " ملف، وفشل " + fail + ".", fail === files.length ? "error" : "gold", "notes");
      else UI.toast("تم رفع " + ok + " ملف بنجاح.", "success", "check");
      if (ok) refresh();
    });
  }

  /* ── PDF Viewer ── */
  async function openPDFViewer(s){
    const token = await getToken();
    const base = edgeBase();
    if (!token || !base){ UI.toast("خطأ في الاتصال.", "error", "info"); return; }

    let signedUrl = null;
    try {
      const res = await fetch(base + "/lecture-summaries?action=signed-url&path=" + encodeURIComponent(s.file_path), {
        headers: { "Authorization": "Bearer " + token, "apikey": App.SupabaseConfig.supabaseAnonKey }
      });
      const data = await res.json();
      if (data.ok && data.url) signedUrl = data.url;
    } catch(_e){}

    if (!signedUrl){
      try {
        const c = await (App.Sync && App.Sync.client ? App.Sync.client() : null);
        if (c) {
          const { data: urlData } = await c.storage.from(BUCKET).createSignedUrl(s.file_path, 3600);
          if (urlData && urlData.signedUrl) signedUrl = urlData.signedUrl;
        }
      } catch(_e){}
    }

    if (!signedUrl){ UI.toast("تعذر فتح الملف.", "error", "info"); return; }

    if (s.status === "unread"){
      await apiFetch("PUT", "", { id: s.id, status: "reading" });
      s.status = "reading";
    }

    const subj = D.subjectById(s.subjectId);
    document.body.insertAdjacentHTML("beforeend", '<div class="ls-overlay" id="ls-overlay"></div>');
    document.body.insertAdjacentHTML("beforeend",
      '<div class="ls-viewer-wrap" id="ls-viewer-wrap">' +
        '<div class="ls-viewer">' +
          '<div class="ls-viewer-head">' +
            '<div class="ls-viewer-title">' +
              '<span class="ls-viewer-icon" style="color:' + (subj.accent || "var(--gold-2)") + '">' + I.get("notes", 18) + '</span>' +
              '<div><b>' + U.esc(s.title) + '</b>' + (s.lecture_number != null ? ' <span class="muted small">— محاضرة ' + s.lecture_number + '</span>' : '') + '</div>' +
            '</div>' +
            '<div class="ls-viewer-actions">' +
              '<a class="btn sm ghost" href="' + signedUrl + '" target="_blank" download="' + U.esc(s.file_name) + '">' + I.get("export", 13) + ' تحميل</a>' +
              '<button class="btn sm ghost" id="ls-viewer-close">' + I.get("close", 14) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="ls-viewer-body">' +
            '<iframe src="' + signedUrl + '" class="ls-viewer-frame" title="' + U.esc(s.title) + '"></iframe>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    function closeViewer(){
      const o = $("ls-overlay"), w = $("ls-viewer-wrap");
      if (o) o.remove();
      if (w) w.remove();
    }
    const closeBtn = $("ls-viewer-close");
    const overlay = $("ls-overlay");
    if (closeBtn) closeBtn.addEventListener("click", closeViewer);
    if (overlay) overlay.addEventListener("click", closeViewer);
  }

  /* ── Edit Modal ── */
  function renderEditModal(s){
    const m = UI.openModal(UI.modalShell(
      I.get("edit", 18) + ' تعديل الملخص',
      '<div class="field"><label>اسم الملخص</label><input class="input" id="ls-edit-title" value="' + U.esc(s.title) + '"></div>' +
      '<div class="field"><label>رقم المحاضرة</label><input class="input" id="ls-edit-num" type="number" min="1" value="' + (s.lecture_number || "") + '"></div>' +
      '<div class="field"><label>الفصل / الوحدة</label><input class="input" id="ls-edit-unit" value="' + U.esc(s.unit || "") + '"></div>' +
      '<div class="field"><label>حالة القراءة</label>' +
        '<select class="input" id="ls-edit-status">' +
          '<option value="unread"' + (s.status === "unread" ? " selected" : "") + '>لم تبدأ</option>' +
          '<option value="reading"' + (s.status === "reading" ? " selected" : "") + '>قيد القراءة</option>' +
          '<option value="read"' + (s.status === "read" ? " selected" : "") + '>تمت القراءة</option>' +
        '</select>' +
      '</div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="ls-edit-save">حفظ</button>',
      { size: "narrow" }
    ), { autoFocus: "#ls-edit-title" });
    const btn = m.querySelector("#ls-edit-save");
    if (btn) btn.addEventListener("click", async () => {
      const title = m.querySelector("#ls-edit-title").value.trim();
      const num = m.querySelector("#ls-edit-num").value ? parseInt(m.querySelector("#ls-edit-num").value) : null;
      const unit = m.querySelector("#ls-edit-unit").value.trim();
      const status = m.querySelector("#ls-edit-status").value;
      if (!title){ UI.toast("أدخل اسم الملخص.", "error", "info"); return; }
      btn.disabled = true;
      const res = await apiFetch("PUT", "", { id: s.id, title, lecture_number: num, unit, status });
      if (res.ok){ UI.closeModal(); UI.toast("تم تحديث الملخص.", "success", "check"); refresh(); }
      else { UI.toast(res.error || "تعذّر التحديث.", "error", "close"); btn.disabled = false; }
    });
  }

  /* ── Replace Modal ── */
  function renderReplaceModal(s){
    const m = UI.openModal(UI.modalShell(
      I.get("refresh", 18) + ' استبدال ملف PDF',
      '<p class="muted small">الملف الحالي: <b>' + U.esc(s.file_name) + '</b> (' + fmtSize(s.file_size) + ')</p>' +
      '<div class="field"><label>الملف الجديد (PDF)</label>' +
        '<label class="btn emerald block" style="cursor:pointer" id="ls-replace-label">' + I.get("export", 14) + ' اختر ملف PDF' +
          '<input type="file" id="ls-replace-file" accept=".pdf,application/pdf" hidden>' +
        '</label>' +
        '<div id="ls-replace-info" class="muted small" style="margin-top:8px"></div>' +
      '</div>',
      '<button class="btn ghost" data-close>إلغاء</button><button class="btn primary" id="ls-replace-btn" disabled>استبدال</button>',
      { size: "narrow" }
    ));
    const fi = m.querySelector("#ls-replace-file");
    const info = m.querySelector("#ls-replace-info");
    const btn = m.querySelector("#ls-replace-btn");
    if (fi) fi.addEventListener("change", () => {
      const f = fi.files[0];
      if (!f) return;
      if (f.type !== "application/pdf"){ UI.toast("يُسمح فقط بملفات PDF.", "error", "info"); fi.value = ""; return; }
      info.textContent = f.name + " — " + fmtSize(f.size);
      btn.disabled = false;
    });
    if (btn) btn.addEventListener("click", async () => {
      const f = fi.files[0];
      if (!f) return;
      btn.disabled = true;
      btn.textContent = "جارٍ الاستبدال…";
      const fd = new FormData();
      fd.append("file", f);
      fd.append("title", s.title);
      fd.append("subject_id", s.subjectId);
      if (s.lecture_number) fd.append("lecture_number", String(s.lecture_number));
      await apiFetch("DELETE", "?id=" + s.id);
      const res = await apiFetch("POST", "", fd);
      UI.closeModal();
      if (res.ok){ UI.toast("تم استبدال الملف.", "success", "check"); refresh(); }
      else UI.toast(res.error || "فشل الاستبدال.", "error", "close");
    });
  }

  /* ── Main Render ── */
  function render(root){
    if (!isLoggedIn()){
      root.innerHTML =
        '<div class="page-head"><div><div class="page-title">📚 ملخصات المحاضرات</div>' +
        '<div class="page-sub">مكتبة منظمة لملخصات المحاضرات</div></div></div>' +
        '<div class="card glass-1" style="flex:1;display:flex;flex-direction:column">' + loginRequiredHTML() + '</div>';
      return;
    }

    const subs = D.subjects.filter(s => s.id !== "general");
    if (!selectedSubject && subs.length) selectedSubject = subs[0].id;

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">📚 ملخصات المحاضرات</div>' +
      '<div class="page-sub">أدر ملخصات محاضراتك لكل مادة — ارفع ملفات PDF ونظّمها بسهولة</div></div></div>' +
      subjectTabsHTML() +
      '<div id="ls-dashboard"></div>' +
      '<div id="ls-toolbar-wrap"></div>' +
      '<div id="ls-list" class="ls-grid"></div>';

    bind(root);
    refresh();
  }

  /* ── Bind Events ── */
  function bind(root){
    root.addEventListener("click", e => {
      const subjPill = e.target.closest("[data-ls-subj]");
      if (subjPill){
        selectedSubject = subjPill.dataset.lsSubj;
        root.querySelectorAll(".ls-subject-pill").forEach(p => p.classList.remove("active"));
        subjPill.classList.add("active");
        refresh();
        return;
      }
      const openBtn = e.target.closest("[data-ls-open]");
      if (openBtn){ const s = summariesCache.find(x => x.id === openBtn.dataset.lsOpen); if (s) openPDFViewer(s); return; }
      const dlBtn = e.target.closest("[data-ls-dl]");
      if (dlBtn){ const s = summariesCache.find(x => x.id === dlBtn.dataset.lsDl); if (s) downloadFile(s); return; }
      const menuBtn = e.target.closest("[data-ls-menu]");
      if (menuBtn){
        const dd = root.querySelector("#ls-dd-" + menuBtn.dataset.lsMenu);
        if (dd) dd.hidden = !dd.hidden;
        return;
      }
      const favBtn = e.target.closest("[data-ls-fav-toggle]");
      if (favBtn){ const s = summariesCache.find(x => x.id === favBtn.dataset.lsFavToggle); if (s) toggleFav(s); return; }
      const editBtn = e.target.closest("[data-ls-edit]");
      if (editBtn){ const s = summariesCache.find(x => x.id === editBtn.dataset.lsEdit); if (s) renderEditModal(s); return; }
      const replaceBtn = e.target.closest("[data-ls-replace]");
      if (replaceBtn){ const s = summariesCache.find(x => x.id === replaceBtn.dataset.lsReplace); if (s) renderReplaceModal(s); return; }
      const deleteBtn = e.target.closest("[data-ls-delete]");
      if (deleteBtn){ const s = summariesCache.find(x => x.id === deleteBtn.dataset.lsDelete); if (s) confirmDelete(s); return; }
      const filterBtn = e.target.closest("[data-ls-filter]");
      if (filterBtn){ filterStatus = filterBtn.dataset.lsFilter; refresh(); return; }
      const favFilter = e.target.closest("[data-ls-fav]");
      if (favFilter){ filterFav = !filterFav; refresh(); return; }
      const addBtn = e.target.closest("#ls-add, #ls-empty-add");
      if (addBtn){ triggerAdd(); return; }
      const settingsBtn = e.target.closest("#ls-subjects-settings");
      if (settingsBtn){ location.hash = "#/settings"; return; }
      const sortBtn = e.target.closest("#ls-sort-btn");
      if (sortBtn){
        const menu = root.querySelector("#ls-sort-menu");
        if (menu) menu.hidden = !menu.hidden;
        return;
      }
      const sortOpt = e.target.closest("[data-ls-sort]");
      if (sortOpt){
        sortBy = sortOpt.dataset.lsSort;
        const menu = root.querySelector("#ls-sort-menu");
        if (menu) menu.hidden = true;
        refreshList();
        return;
      }
    });

    root.addEventListener("input", e => {
      if (e.target.id === "ls-search"){ searchQuery = e.target.value; refreshList(); }
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".ls-menu-wrap")) root.querySelectorAll(".ls-dropdown").forEach(d => d.hidden = true);
      if (!e.target.closest(".ls-sort-dropdown")) root.querySelectorAll(".ls-sort-menu").forEach(d => d.hidden = true);
    });
  }

  function triggerAdd(){
    if (!selectedSubject){ UI.toast("اختر مادة أولًا.", "error", "info"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.multiple = true;
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      if (files.find(f => f.type !== "application/pdf")){ UI.toast("يُسمح فقط بملفات PDF.", "error", "info"); return; }
      renderUploadModal(files, selectedSubject);
    });
    input.click();
  }

  async function downloadFile(s){
    const token = await getToken();
    const base = edgeBase();
    if (!token || !base) return;
    try {
      const res = await fetch(base + "/lecture-summaries?action=signed-url&path=" + encodeURIComponent(s.file_path), {
        headers: { "Authorization": "Bearer " + token, "apikey": App.SupabaseConfig.supabaseAnonKey }
      });
      const data = await res.json();
      if (data.ok && data.url){ const a = document.createElement("a"); a.href = data.url; a.download = s.file_name; a.click(); return; }
    } catch(_e){}
    try {
      const c = await (App.Sync && App.Sync.client ? App.Sync.client() : null);
      if (c){
        const { data: urlData } = await c.storage.from(BUCKET).createSignedUrl(s.file_path, 3600);
        if (urlData && urlData.signedUrl){ const a = document.createElement("a"); a.href = urlData.signedUrl; a.download = s.file_name; a.click(); }
      }
    } catch(_e){}
  }

  async function toggleFav(s){
    await apiFetch("PUT", "", { id: s.id, is_favorite: !s.isFavorite });
    refresh();
  }

  function confirmDelete(s){
    UI.dangerConfirm("حذف الملخص", 'هل أنت متأكد من حذف "' + U.esc(s.title) + '"؟ لن تتمكن من التراجع.', "حذف", async () => {
      const res = await apiFetch("DELETE", "?id=" + s.id);
      if (res.ok){ UI.toast("تم الحذف.", "gold", "trash"); refresh(); }
      else UI.toast(res.error || "تعذّر الحذف.", "error", "close");
    });
  }

  function refreshList(){
    const list = filtered();
    const listEl = $("ls-list");
    const dashEl = $("ls-dashboard");
    const toolEl = $("ls-toolbar-wrap");
    if (dashEl) dashEl.innerHTML = dashboardHTML();
    if (toolEl) toolEl.innerHTML = toolbarHTML();
    if (listEl) listEl.innerHTML = list.length ? list.map(summaryCard).join("") : emptyHTML();
  }

  async function refresh(){
    if (!selectedSubject) return;
    await loadSummaries(selectedSubject);
    refreshList();
  }

  App.Views.register("summaries", render, { rerender: true, title: "ملخصات المحاضرات" });
})();
