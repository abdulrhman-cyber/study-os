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
  const STATUS_COLORS = { unread: "var(--gold-2)", reading: "var(--em-3)", read: "var(--emerald)" };

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
    const total = list.length;
    const read = list.filter(s => s.status === "read").length;
    const unread = list.filter(s => s.status === "unread").length;
    const fav = list.filter(s => s.isFavorite).length;
    return { total, read, unread, fav };
  }

  function subjectSelector(){
    const subs = D.subjects.filter(s => s.id !== "general");
    return '<div class="field"><label>المادة</label>' +
      '<select class="input" id="ls-subject">' +
        subs.map(s => '<option value="' + s.id + '"' + (selectedSubject === s.id ? ' selected' : '') + '>' + U.esc(s.name) + '</option>').join("") +
      '</select></div>';
  }

  function dashboardHTML(st){
    const list = filtered();
    const s = stats(list);
    return '<div class="xp-stats">' +
      UI.statCard("notes", s.total, "ملخصات") +
      UI.statCard("check", s.read, "مقروءة", "emerald") +
      UI.statCard("clock", s.unread, "لم تُقرأ", "gold") +
      UI.statCard("star", s.fav, "مفضلة") +
    '</div>';
  }

  function filterBarHTML(){
    const statuses = [["all", "الكل"], ["unread", "لم تبدأ"], ["reading", "قيد القراءة"], ["read", "تمت القراءة"]];
    return '<div class="filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
      '<input class="input" id="ls-search" placeholder="ابحث في الملخصات..." value="' + U.esc(searchQuery) + '" style="min-width:180px;flex:1;max-width:300px">' +
      '<div class="seg" style="flex-wrap:wrap">' +
        statuses.map(([v, t]) => '<button class="' + (filterStatus === v ? "active" : "") + '" data-ls-filter="' + v + '">' + t + '</button>').join("") +
      '</div>' +
      '<button class="btn sm' + (filterFav ? " primary" : " ghost") + '" data-ls-fav>' + I.get("star", 13) + ' المفضلة</button>' +
      '<select class="input" id="ls-sort" style="min-width:120px">' +
        '<option value="lecture_number"' + (sortBy === "lecture_number" ? " selected" : "") + '>رقم المحاضرة</option>' +
        '<option value="newest"' + (sortBy === "newest" ? " selected" : "") + '>الأحدث</option>' +
        '<option value="oldest"' + (sortBy === "oldest" ? " selected" : "") + '>الأقدم</option>' +
        '<option value="name"' + (sortBy === "name" ? " selected" : "") + '>الاسم</option>' +
      '</select>' +
    '</div>';
  }

  function summaryCard(s){
    const subj = D.subjectById(s.subjectId);
    const statusIcon = STATUS_ICONS[s.status] || "clock";
    const statusColor = STATUS_COLORS[s.status] || "var(--gold-2)";
    return '<div class="card glass-1 ls-card" data-ls-id="' + s.id + '">' +
      '<div class="ls-card-head">' +
        '<div class="ls-card-icon" style="color:' + (subj.accent || "var(--gold-2)") + '">' + I.get("notes", 24) + '</div>' +
        '<div class="ls-card-meta">' +
          '<div class="ls-card-title">' + U.esc(s.title) + '</div>' +
          '<div class="ls-card-sub muted small">' +
            (s.lecture_number != null ? 'محاضرة ' + s.lecture_number + ' · ' : '') +
            (s.unit ? U.esc(s.unit) + ' · ' : '') +
            fmtSize(s.file_size) +
          '</div>' +
        '</div>' +
        (s.isFavorite ? '<span style="color:var(--gold-2)">' + I.get("star", 16) + '</span>' : '') +
      '</div>' +
      '<div class="ls-card-status">' +
        '<span class="chip" style="color:' + statusColor + ';border-color:' + statusColor + '30">' + I.get(statusIcon, 12) + ' ' + STATUS_LABELS[s.status] + '</span>' +
        '<span class="muted small num">' + U.fmtDate((s.createdAt || "").slice(0,10), { short: true }) + '</span>' +
      '</div>' +
      '<div class="ls-card-actions">' +
        '<button class="btn sm primary" data-ls-open="' + s.id + '">' + I.get("play", 13) + ' فتح</button>' +
        '<button class="btn sm ghost" data-ls-dl="' + s.id + '">' + I.get("export", 13) + ' تحميل</button>' +
        '<div class="ls-menu-wrap">' +
          '<button class="btn sm ghost ls-menu-btn" data-ls-menu="' + s.id + '">⋮</button>' +
          '<div class="ls-dropdown" id="ls-dd-' + s.id + '" hidden>' +
            '<button data-ls-fav-toggle="' + s.id + '">' + I.get("star", 13) + (s.isFavorite ? ' إزالة من المفضلة' : ' إضافة للمفضلة') + '</button>' +
            '<button data-ls-edit="' + s.id + '">' + I.get("edit", 13) + ' تعديل البيانات</button>' +
            '<button data-ls-replace="' + s.id + '">' + I.get("refresh", 13) + ' استبدال ملف PDF</button>' +
            '<button data-ls-delete="' + s.id + '" class="danger">' + I.get("trash", 13) + ' حذف</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function emptyHTML(){
    return UI.empty("notes", "لا توجد ملخصات لهذه المادة", "أضف أول ملخص محاضرة لتبدأ.", "");
  }

  function loginRequiredHTML(){
    return UI.empty("user", "سجل الدخول أولاً", "سجل الدخول لحفظ ملفات المحاضرات ومزامنتها بين أجهزتك.", '<a class="btn primary" href="#/settings">' + I.get("user", 14) + ' تسجيل الدخول</a>');
  }

  function renderUploadModal(files, subjectId){
    let rows = files.map((f, i) =>
      '<div class="ls-upload-row">' +
        '<div><b>' + U.esc(f.name) + '</b><span class="muted small"> — ' + fmtSize(f.size) + '</span></div>' +
        '<input class="input ls-up-title" data-idx="' + i + '" placeholder="اسم الملخص" value="' + U.esc(f.name.replace(/\.pdf$/i, "")) + '">' +
        '<input class="input ls-up-num" data-idx="' + i + '" type="number" min="1" placeholder="رقم المحاضرة" style="width:100px">' +
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

  async function openPDFViewer(s){
    const token = await getToken();
    const base = edgeBase();
    if (!token || !base){ UI.toast("خطأ في الاتصال.", "error", "info"); return; }
    const fileUrl = base + "/lecture-summaries?action=signed-url&path=" + encodeURIComponent(s.file_path);

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

    const viewerHTML =
      '<div class="ls-viewer">' +
        '<div class="ls-viewer-head">' +
          '<div><b>' + U.esc(s.title) + '</b>' + (s.lecture_number != null ? ' <span class="muted">— محاضرة ' + s.lecture_number + '</span>' : '') + '</div>' +
          '<div class="ls-viewer-actions">' +
            '<a class="btn sm ghost" href="' + signedUrl + '" target="_blank" download="' + U.esc(s.file_name) + '">' + I.get("export", 13) + ' تحميل</a>' +
            '<button class="btn sm ghost" id="ls-viewer-close">' + I.get("close", 14) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ls-viewer-body">' +
          '<iframe src="' + signedUrl + '" class="ls-viewer-frame" title="' + U.esc(s.title) + '"></iframe>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", '<div class="ls-overlay" id="ls-overlay"></div>');
    document.body.insertAdjacentHTML("beforeend", '<div class="ls-viewer-wrap" id="ls-viewer-wrap">' + viewerHTML + '</div>');

    const overlay = $("ls-overlay");
    const wrap = $("ls-viewer-wrap");
    const closeBtn = $("ls-viewer-close");

    function closeViewer(){
      if (overlay) overlay.remove();
      if (wrap) wrap.remove();
    }
    if (closeBtn) closeBtn.addEventListener("click", closeViewer);
    if (overlay) overlay.addEventListener("click", closeViewer);
  }

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
      if (res.ok){
        UI.closeModal();
        UI.toast("تم تحديث الملخص.", "success", "check");
        refresh();
      } else {
        UI.toast(res.error || "تعذّر التحديث.", "error", "close");
        btn.disabled = false;
      }
    });
  }

  function renderReplaceModal(s){
    const fileInput = '<input type="file" id="ls-replace-file" accept=".pdf,application/pdf" hidden>';
    const m = UI.openModal(UI.modalShell(
      I.get("refresh", 18) + ' استبدال ملف PDF',
      '<p class="muted small">الملف الحالي: <b>' + U.esc(s.file_name) + '</b> (' + fmtSize(s.file_size) + ')</p>' +
      '<div class="field"><label>الملف الجديد (PDF)</label>' +
        '<label class="btn emerald block" style="cursor:pointer" id="ls-replace-label">' + I.get("export", 14) + ' اختر ملف PDF' +
          fileInput +
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

  function render(root){
    document.body.classList.add("ai-route");
    if (!isLoggedIn()){
      root.innerHTML =
        '<div class="page-head"><div><div class="page-title">📚 ملخصات المحاضرات</div>' +
        '<div class="page-sub">مكتبة منظمة لملخصات المحاضرات</div></div></div>' +
        '<div class="card glass-1">' + loginRequiredHTML() + '</div>';
      return;
    }

    const subs = D.subjects.filter(s => s.id !== "general");
    if (!selectedSubject && subs.length) selectedSubject = subs[0].id;

    root.innerHTML =
      '<div class="page-head"><div><div class="page-title">📚 ملخصات المحاضرات</div>' +
      '<div class="page-sub">أدر ملخصات محاضراتك لكل مادة</div></div>' +
      '<div class="head-actions">' +
        '<button class="btn primary" id="ls-add">' + I.get("plus", 14) + ' إضافة ملخص</button>' +
      '</div></div>' +
      subjectSelector() +
      '<div id="ls-dashboard"></div>' +
      '<div id="ls-filters"></div>' +
      '<div id="ls-list" class="ls-grid"></div>';

    bind(root);
    refresh();
  }

  function bind(root){
    const subjSel = root.querySelector("#ls-subject");
    if (subjSel) subjSel.addEventListener("change", () => {
      selectedSubject = subjSel.value;
      refresh();
    });

    root.querySelector("#ls-add").addEventListener("click", () => {
      if (!selectedSubject){ UI.toast("اختر مادة أولًا.", "error", "info"); return; }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,application/pdf";
      input.multiple = true;
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        const invalid = files.find(f => f.type !== "application/pdf");
        if (invalid){ UI.toast("يُسمح فقط بملفات PDF.", "error", "info"); return; }
        renderUploadModal(files, selectedSubject);
      });
      input.click();
    });

    root.addEventListener("click", e => {
      const openBtn = e.target.closest("[data-ls-open]");
      if (openBtn){
        const s = summariesCache.find(x => x.id === openBtn.dataset.lsOpen);
        if (s) openPDFViewer(s);
        return;
      }
      const dlBtn = e.target.closest("[data-ls-dl]");
      if (dlBtn){
        const s = summariesCache.find(x => x.id === dlBtn.dataset.lsDl);
        if (s) downloadFile(s);
        return;
      }
      const menuBtn = e.target.closest("[data-ls-menu]");
      if (menuBtn){
        const dd = root.querySelector("#ls-dd-" + menuBtn.dataset.lsMenu);
        if (dd) dd.hidden = !dd.hidden;
        return;
      }
      const favBtn = e.target.closest("[data-ls-fav-toggle]");
      if (favBtn){
        const s = summariesCache.find(x => x.id === favBtn.dataset.lsFavToggle);
        if (s) toggleFav(s);
        return;
      }
      const editBtn = e.target.closest("[data-ls-edit]");
      if (editBtn){
        const s = summariesCache.find(x => x.id === editBtn.dataset.lsEdit);
        if (s) renderEditModal(s);
        return;
      }
      const replaceBtn = e.target.closest("[data-ls-replace]");
      if (replaceBtn){
        const s = summariesCache.find(x => x.id === replaceBtn.dataset.lsReplace);
        if (s) renderReplaceModal(s);
        return;
      }
      const deleteBtn = e.target.closest("[data-ls-delete]");
      if (deleteBtn){
        const s = summariesCache.find(x => x.id === deleteBtn.dataset.lsDelete);
        if (s) confirmDelete(s);
        return;
      }
      const filterBtn = e.target.closest("[data-ls-filter]");
      if (filterBtn){
        filterStatus = filterBtn.dataset.lsFilter;
        refresh();
        return;
      }
      const favFilter = e.target.closest("[data-ls-fav]");
      if (favFilter){
        filterFav = !filterFav;
        refresh();
        return;
      }
    });

    root.addEventListener("input", e => {
      if (e.target.id === "ls-search"){
        searchQuery = e.target.value;
        refreshList();
      }
    });
    root.addEventListener("change", e => {
      if (e.target.id === "ls-sort"){
        sortBy = e.target.value;
        refreshList();
      }
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".ls-menu-wrap")){
        root.querySelectorAll(".ls-dropdown").forEach(d => d.hidden = true);
      }
    });
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
      if (data.ok && data.url){
        const a = document.createElement("a");
        a.href = data.url;
        a.download = s.file_name;
        a.click();
        return;
      }
    } catch(_e){}
    try {
      const c = await (App.Sync && App.Sync.client ? App.Sync.client() : null);
      if (c){
        const { data: urlData } = await c.storage.from(BUCKET).createSignedUrl(s.file_path, 3600);
        if (urlData && urlData.signedUrl){
          const a = document.createElement("a");
          a.href = urlData.signedUrl;
          a.download = s.file_name;
          a.click();
        }
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
    const filtersEl = $("ls-filters");
    if (dashEl) dashEl.innerHTML = dashboardHTML();
    if (filtersEl) filtersEl.innerHTML = filterBarHTML();
    if (listEl){
      listEl.innerHTML = list.length ? list.map(summaryCard).join("") : emptyHTML();
    }
  }

  async function refresh(){
    if (!selectedSubject) return;
    await loadSummaries(selectedSubject);
    refreshList();
  }

  App.Views.register("summaries", render, { rerender: true, title: "ملخصات المحاضرات" });
})();
