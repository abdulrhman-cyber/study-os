/* ═══════════════════════ STUDY OS — js/supabase.js (Google login + cloud sync) ═══════════════════════
   ─────────────────────────────────────────────────────────────────────────────
   سؤال أمني (مهم، ليس شكليًا):
   أنت بعتّ ليـن الـ anon key + Client ID بتوعك هنا في الشات. دي قيم **عامة**
   بتتصمم عشان تكون في كود العميل، فوجودها هنا وحده مش كارثة — الأمان الفعلي
   بييجي من RLS على الجداول (اللي بقدمهالك في سكربت SQL أدناه).
   لكن عادة نضافه: **بعد ما نخلص، ولّد الـ anon key من جديد** من
   Supabase → Project Settings → API keys (ورّط المفتاح القديم اللي اتشارك).
   ─────────────────────────────────────────────────────────────────────────────
   التصميم:
   • localStorage هو المصدر الأساسي دائمًا (offline-first، فوري، لا يتوقف).
   • Supabase مرآة سحابية: عند كل change من Store نرفع النسخة (debounced)،
     وعند الدخول نسحب نسخة السحابة إن كانت أحدث (last-write-wins عبر updated_at).
   • Auth: Google OAuth عبر supabase.auth + PKCE + auto-redirect.
   • الجلسة تُحفظ في localStorage (supabase يحفظها أصلاً بنفسه في
     localStorage بتاعه) فالتحديث التلقائي شغال حتى لو أقفلنا الصفحة.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";
window.App = window.App || {};
(function () {
  const U = window.App.Util;
  let sb = null;

  function cfg(){
    const c = window.App.SupabaseConfig || window.SupabaseConfig;
    if (!c || !c.supabaseUrl || !c.supabaseAnonKey) return null;
    return c;
  }

  /* ── بيئة تطبيق أندرويد (Capacitor): Google يحجب OAuth داخل WebView،
        فنفتحه في متصفح النظام ونستقبل العودة عبر رابط عميق studyos://login ── */
  const NATIVE_REDIRECT = "studyos://login";
  function nativePlugins(){
    return (window.Capacitor && window.Capacitor.Plugins) || null;
  }
  function isNative(){
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  }
  /* محمّل تلقائي لمكتبة supabase-js (الرئيسي + بدائل) لو مش متوفرة */
  const CDN_LIBRARIES = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2"
  ];
  let libLoading = null;
  function loadLibrary(){
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libLoading) return libLoading;
    libLoading = new Promise((resolve, reject) => {
      const tryNext = i => {
        if (i >= CDN_LIBRARIES.length){ reject(new Error("تعذّر تحميل مكتبة supabase-js من الشبكة — تحقق من الاتصال بالإنترنت.")); return; }
        try {
          const s = document.createElement("script");
          s.src = CDN_LIBRARIES[i];
          s.async = true;
          s.onload = () => (window.supabase && window.supabase.createClient) ? resolve() : tryNext(i + 1);
          s.onerror = () => tryNext(i + 1);
          document.head.appendChild(s);
        } catch(e){ tryNext(i + 1); }
      };
      tryNext(0);
    });
    return libLoading;
  }

  function supabaseClient(){
    if (sb) return Promise.resolve(sb);
    const c = cfg();
    if (!c) return Promise.reject(new Error("supabase-config.js مفقود أو ناقص."));
    return loadLibrary().then(() => {
      sb = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: "studyos.supabase.session"
        }
      });
      addAuthListener();
      initNativeAuth();
      return sb;
    });
  }

  async function signInNative(){
    const c = await supabaseClient();
    const res = await c.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: NATIVE_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { access_type: "offline", prompt: "select_account" },
        scopes: "openid email profile"
      }
    });
    if (res.error){
      safeEmit("sync-status", { state: "error", error: res.error.message });
      return { ok: false, error: res.error.message };
    }
    const plugins = nativePlugins();
    if (res.data && res.data.url && plugins && plugins.Browser){
      await plugins.Browser.open({ url: res.data.url, windowName: "_system" });
      return { ok: true };
    }
    return { ok: false, error: "مكوّن المتصفح غير متاح في التطبيق." };
  }

  async function handleNativeUrl(url){
    if (!url || url.indexOf("studyos://login") !== 0) return;
    let code = null, errDesc = null;
    try {
      const u = new URL(url);
      code = u.searchParams.get("code");
      errDesc = u.searchParams.get("error_description") || u.searchParams.get("error");
      if (!code && u.hash){
        const h = new URLSearchParams(u.hash.replace(/^#/, ""));
        code = h.get("code");
        errDesc = errDesc || h.get("error_description") || h.get("error");
      }
    } catch(e){}
    const plugins = nativePlugins();
    if (errDesc){
      safeEmit("sync-status", { state: "error", error: errDesc });
      try { plugins && plugins.Browser && await plugins.Browser.close(); } catch(e){}
      return;
    }
    if (!code) return;
    try {
      const c = await supabaseClient();
      const { error } = await c.auth.exchangeCodeForSession(code);
      if (error) safeEmit("sync-status", { state: "error", error: error.message });
    } catch(e){
      safeEmit("sync-status", { state: "error", error: (e && e.message) || String(e) });
    } finally {
      try { plugins && plugins.Browser && await plugins.Browser.close(); } catch(e){}
    }
  }

  function initNativeAuth(){
    if (!isNative() || initNativeAuth._done) return;
    initNativeAuth._done = true;
    try {
      const plugins = nativePlugins();
      const AppPlugin = plugins && plugins.App;
      if (AppPlugin && AppPlugin.addListener){
        AppPlugin.addListener("appUrlOpen", function (data){ handleNativeUrl(data && data.url); });
      }
      // بدء بارد: لو فُتح التطبيق مباشرة من رابط العودة بعد إغلاقه
      if (AppPlugin && AppPlugin.getLaunchUrl){
        AppPlugin.getLaunchUrl().then(function (r){ if (r && r.url) handleNativeUrl(r.url); }).catch(function(){});
      }
    } catch(e){}
  }

  function userMeta(session){
    const u = session && session.user;
    if (!u) return null;
    const md = u.user_metadata || {};
    return {
      id: u.id,
      email: u.email || "",
      name: md.name || md.full_name || u.email || "طالب",
      avatar: md.avatar_url || md.picture || "🎓",
      provider: (u.app_metadata && u.app_metadata.provider) || "google"
    };
  }

  function stateToPayload(){
    const st = App.Store.getState && App.Store.getState();
    if (!st) return null;
    return {
      v: 1,
      savedAt: U.iso ? U.iso() : new Date().toISOString(),
      // نسخة كاملة — أحدث كيان يفوز
      data: st
    };
  }
  function payloadToState(p){
    if (!p || !p.data || typeof p.data !== "object") return null;
    return p.data;
  }

  function newerWins(remote, local){
    // remote والسحابة عندها updated_at (من الجدول) — والأحدث يفوز
    const rt = (remote && (remote.updated_at || remote.savedAt)) || "";
    const lt = (local && (local.savedAt || (local.data && local.data.lastSync) || "")) || "";
    if (!rt) return "push";
    if (!lt) return "pull";
    return rt >= lt ? "pull" : "push";
  }

  function debounce(fn, ms){
    let t; return function(){ clearTimeout(t); const a = arguments, th = this; t = setTimeout(() => fn.apply(th, a), ms); };
  }
  function safeEmit(name, payload){
    try {
      if (App.UI && App.UI.emit) App.UI.emit(name, payload);
      else if (U && U.emit) U.emit(name, payload);
    } catch(e){}
  }

  /* ══ sync engine (local-first, cloud mirror) ══ */
  const DB = { table: "study_os_v1", idCol: "user_id", payloadCol: "payload", updatedCol: "updated_at" };

  function selectState(){
    try { return App.Store.getState(); } catch(e){}
    try { return App.Store.get().state; } catch(e){}
    return null;
  }

  async function uploadState(session){
    const st = selectState();
    if (!st) return { ok: false, error: "no state" };
    const payload = stateToPayload();
    if (!payload) return { ok: false, error: "payload" };
    const c = await supabaseClient();
    const uid = session && session.user && session.user.id;
    if (!uid) return { ok: false, error: "no uid" };
    const row = {};
    row[DB.idCol] = uid;
    row[DB.payloadCol] = payload;
    row[DB.updatedCol] = new Date().toISOString();
    const { error } = await c.from(DB.table).upsert(row, { onConflict: DB.idCol });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function downloadState(session){
    const c = await supabaseClient();
    const uid = session && session.user && session.user.id;
    if (!uid) return { ok: false, error: "no uid" };
    const { data, error } = await c.from(DB.table).select("*").eq(DB.idCol, uid).maybeSingle();
    if (error){
      if (error.code === "PGRST116") return { ok: true, data: null, empty: true }; // لا صف بعد
      return { ok: false, error: error.message };
    }
    return { ok: true, data: data || null, empty: !data };
  }

  /* بعد إعادة التعيين المحلية: نمنع مؤقتًا سحب نسخة السحابة القديمة */
  let pushOnly = false;

  async function syncNow(session){
    try {
      if (!session){
        const s = await getSession();
        if (!s.ok) return s;
        session = s.session;
      }
      if (!session) return { ok: false, error: "أنت غير مسجّل الدخول — اربط حساب Google أولًا." };
      let direction = "push";
      if (!pushOnly){
        // 1) نحمّل نسخة السحابة (فقط لما نبقى محتاجين المقارنة)
        const res = await downloadState(session);
        if (!res.ok) return res;
        if (res.data){
          const remotePayload = res.data[DB.payloadCol] || null;
          const localPayload = stateToPayload();
          direction = newerWins(remotePayload && remotePayload.data ? remotePayload.data : remotePayload, localPayload);
          if (direction === "pull" && remotePayload){
            const remoteState = payloadToState(remotePayload);
            if (remoteState && App.Store.importData){
              try { App.Store.importData(JSON.stringify({ data: remoteState })); }
              catch(e){ console.warn("import remote failed", e); }
            }
          }
        }
      }
      // 2) نرفع نسختنا (أو نرفع بعد السحب حتى يكون كل شيء متزامنًا)
      const up = await uploadState(session);
      if (!up.ok) return up;
      safeEmit("sync-status", { state: "synced", direction, at: U.iso ? U.iso() : new Date().toISOString() });
      return { ok: true, direction };
    } catch(e){
      safeEmit("sync-status", { state: "error", error: (e && e.message) || String(e) });
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  /* إعادة تعيين كاملة: مسح السحابة + رفع الحالة الجديدة (بدون سحب القديمة) */
  async function resetCloud(){
    try {
      const c = await supabaseClient();
      const s = await getSession();
      const uid = s.session && s.session.user && s.session.user.id;
      if (!uid) return { ok: true };
      pushOnly = true;
      const { error } = await c.from(DB.table).delete().eq(DB.idCol, uid);
      await uploadState(s.session);
      setTimeout(() => { pushOnly = false; }, 3000);
      return { ok: !error, error: error && error.message };
    } catch(e){
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  /* ══ auth ══ */
  async function signIn(){
    try {
      if (isNative()) return await signInNative();
      const c = await supabaseClient();
      const redirectTo = location.origin + location.pathname;
      const res = await c.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" },
          scopes: "openid email profile"
        }
      });
      if (res.error){
        safeEmit("sync-status", { state: "error", error: res.error.message });
        return { ok: false, error: res.error.message };
      }
      if (res.data && res.data.url && !res.data.flowId){
        window.location.href = res.data.url;
      }
      return { ok: true };
    } catch(e){
      const msg = (e && (e.message || e.error_description)) || String(e);
      safeEmit("sync-status", { state: "error", error: msg });
      return { ok: false, error: msg };
    }
  }

  async function signOut(){
    try {
      const c = await supabaseClient();
      const { error } = await c.auth.signOut();
      if (!error){
        App.Sync.user = null;
        safeEmit("sync-user", null);
        safeEmit("sync-status", { state: "signed_out", at: U.iso ? U.iso() : new Date().toISOString() });
      }
      return { ok: !error, error: error && error.message };
    } catch(e){
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  /* ══ listeners ══ */
  let ready = false;
  let syncing = null;
  function pushDebounced(){}

  function addAuthListener(){
    if (ready) return;
    ready = true;
    supabaseClient().then(c => {
      c.auth.onAuthStateChange((event, session) => {
        const meta = userMeta(session);
        App.Sync.user = meta;
        safeEmit("sync-user", meta);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED"){
          if (meta) syncNow(session);
        } else if (event === "SIGNED_OUT"){
          safeEmit("sync-status", { state: "signed_out", at: U.iso ? U.iso() : new Date().toISOString() });
        }
      });
    }).catch(() => {});
  }

  async function getSession(){
    try {
      const c = await supabaseClient();
      const { data } = await c.auth.getSession();
      return { ok: true, session: data && data.session || null };
    } catch(e){
      return { ok: false, error: (e && e.message) || String(e) };
    }
  }

  /* ══ public API ══ */
  window.App.Sync = {
    ready: false,
    user: null,
    client: supabaseClient,
    generateClient: supabaseClient,
    config: cfg,
    signIn, signOut, getSession, syncNow, resetCloud,
    async init(){
      try {
        const s = await getSession();
        if (s.ok && s.session){
          this.ready = true;
          const meta = userMeta(s.session);
          this.user = meta;
          safeEmit("sync-user", meta);
          await syncNow(s.session);
        } else {
          this.ready = true;
        }
        return { ok: true };
      } catch(e){
        this.ready = true;
        return { ok: false, error: (e && e.message) || String(e) };
      }
    },
    emitEventChanged(){
      pushDebounced();
    }
  };

  /* ══ auto-sync hook (بدون كسر المسار الحالي) ══ */
  (function hookStore(){
    try {
      if (App.Store && App.Store.changed){
        // نسجل على الـ change events (لو موجودة) — وبعدين نحاول من جديد كل ثانية
        // لغاية ما المتجر يكون جاهز
        if (window.App && App.Util && App.Util.on){
          try {
            App.Util.on("change", function(){
              App.Sync.schedule && App.Sync.schedule();
            });
          } catch(e){}
        }
      }
      // ربط عام: أي emit بالاسم change
      const bind = () => {
        if (window.App && App.Util && App.Util.on){
          try {
            App.Util.on("change", onAnyChange);
          } catch(e){}
        }
      };
      function onAnyChange(){
        schedule();
      }
      bind();
    } catch(e){}
  })();

  let scheduleTimer = null;
  function schedule(){
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      getSession().then(s => {
        if (s.ok && s.session){
          syncNow(s.session);
        }
      });
    }, 900);
  }
  App.Sync.schedule = schedule;
})();
