/* ═══════════════ STUDY OS — push.js (Web Push حقيقي: اشتراك + جدولة إشعارات) ═══════════════
   الفكرة:
   • المتصفح يشترك في خدمة Push عبر VAPID، ونحفظ الاشتراك في جدول push_subscriptions.
   • نحسب الإشعارات القادمة من بياناتك المحلية ونرفعها إلى push_schedule بأوقاتها.
   • Edge Function (send-due-push) + cron يرسل الإشعار في وقته حتى لو التطبيق مقفول.
   ملاحظة: يحتاج https أو localhost، وربط حساب Google (لأن الاشتراك مرتبط بـ auth.uid).
   ═══════════════════════════════════════════════════════════════════════════════════ */
"use strict";
window.App = window.App || {};
App.Push = (function () {
  const U = App.Util;
  const TABLE_SUBS = "push_subscriptions";
  const TABLE_SCHED = "push_schedule";
  const SW_URL = "sw.js";
  const ICON = "img/logo.png";
  const SW_BUILD = "2026-push-2";
  const IDB_NAME = "studyos-push";
  const IDB_STORE = "kv";
  const DEBUG = true;

  let reg = null;
  let busy = false;

  function dbg(){
    if (!DEBUG) return;
    try { console.log.apply(console, ["[StudyOS Push]"].concat(Array.prototype.slice.call(arguments))); } catch(e){}
  }

  /* ── IndexedDB (مشترك مع Service Worker لنفس الأصل) ── */
  function idbOpen(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGet(key){
    return idbOpen().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result == null ? null : r.result);
      r.onerror = () => reject(r.error);
    })).catch(() => null);
  }
  function idbSet(key, val){
    return idbOpen().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    })).catch(() => false);
  }
  function idbDel(key){
    return idbOpen().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    })).catch(() => false);
  }

  function cfg(){ return window.App.SupabaseConfig || window.App.AuthConfig || {}; }
  function vapidKey(){ return cfg().vapidPublicKey || ""; }

  function supported(){
    return !!(window.isSecureContext !== false &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window);
  }
  function permission(){
    return (window.Notification && Notification.permission) || "default";
  }
  function signedIn(){
    return !!(App.Sync && App.Sync.user && App.Sync.user.id);
  }
  function isEnabled(){
    const st = App.Store && App.Store.getState && App.Store.getState();
    return !!(st && st.settings && st.settings.pushNotif);
  }
  function canPush(){ return isEnabled() && supported() && permission() === "granted"; }

  function setFlag(v){
    const st = App.Store.getState();
    if (st.settings.pushNotif !== v) App.Store.updateSettings({ pushNotif: v });
  }

  /* ── التسجيل: نضمن الجذر والنطاق الصحيحين ونحدّث الملف ── */
  function swReady(){
    if (reg) return Promise.resolve(reg);
    if (!("serviceWorker" in navigator)) return Promise.reject(new Error("المتصفح لا يدعم Service Worker."));
    dbg("registering SW", SW_URL);
    return navigator.serviceWorker.register(SW_URL, { scope: "./", updateViaCache: "none" })
      .then(r => r.update().catch(() => {}).then(() => navigator.serviceWorker.ready))
      .then(r => {
        reg = r;
        dbg("SW ready", (r.active && r.active.scriptURL) || r.scope);
        warnConflicts(r);
        return r;
      })
      .catch(() => navigator.serviceWorker.ready.then(r => { reg = r; return r; }));
  }
  function warnConflicts(current){
    try {
      navigator.serviceWorker.getRegistrations().then(list => {
        list.forEach(r => {
          if (r === current) return;
          const sameScope = r.scope === current.scope;
          if (sameScope) console.warn("[StudyOS Push] يوجد تسجيل Service Worker آخر بنفس النطاق:", r.active && r.active.scriptURL);
        });
      });
    } catch(e){}
  }

  function urlBase64ToUint8Array(base64String){
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function bufToBase64Url(buf){
    if (!buf) return "";
    try {
      const bytes = new Uint8Array(buf);
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch(e){ return ""; }
  }
  function subKeyMatches(sub){
    try {
      const raw = sub && sub.options && sub.options.applicationServerKey;
      if (!raw) return true;
      const b64 = (typeof raw === "string") ? raw : bufToBase64Url(raw);
      return b64.replace(/=+$/, "") === String(vapidKey()).replace(/=+$/, "") && b64.length > 0;
    } catch(e){ return true; }
  }

  function askPermission(){
    if (!("Notification" in window)) return Promise.resolve("denied");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return Promise.resolve(Notification.requestPermission()).then(p => p || Notification.permission);
  }

  async function currentSubscription(){
    if (!supported()) return null;
    try {
      const r = await swReady();
      return await r.pushManager.getSubscription();
    } catch(e){ return null; }
  }

  /* نتحقق أن الاشتراك الحالي يخص نفس مفتاح VAPID.
     اشتراك قديم بمفتاح مختلف = سبب شائع لعدم وصول Push مع إغلاق الصفحة. */
  async function getOrCreateSubscription(force){
    const r = await swReady();
    let sub = await r.pushManager.getSubscription();
    if (sub && (force || !subKeyMatches(sub))){
      dbg("existing subscription key mismatch — resubscribing", { match: subKeyMatches(sub) });
      try { await sub.unsubscribe(); } catch(e){}
      sub = null;
    }
    if (!sub){
      sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey())
      });
      dbg("push subscription obtained");
    } else {
      dbg("reusing existing push subscription (key ok)");
    }
    return sub;
  }

  async function saveSubObject(j){
    if (!signedIn()) return { ok: false, error: "no-auth" };
    if (!j || !j.endpoint) return { ok: false, error: "no-endpoint" };
    const c = await App.Sync.client();
    const uid = App.Sync.user.id;
    const row = {
      user_id: uid,
      endpoint: j.endpoint,
      p256dh: (j.keys && j.keys.p256dh) || "",
      auth: (j.keys && j.keys.auth) || "",
      user_agent: String(navigator.userAgent || "").slice(0, 300),
      updated_at: new Date().toISOString()
    };
    const { error } = await c.from(TABLE_SUBS).upsert(row, { onConflict: "user_id,endpoint" });
    if (error) return { ok: false, error: error.message };
    // قراءة تحقق: نتأكد أن الصف محفوظ فعلًا قبل إعلان النجاح
    let verified = false;
    try {
      const { data } = await c.from(TABLE_SUBS).select("id")
        .eq("user_id", uid).eq("endpoint", j.endpoint).maybeSingle();
      verified = !!(data && data.id);
    } catch(e){}
    dbg("push subscription saved", { verified });
    return { ok: true, verified };
  }
  async function saveSub(sub){
    const j = (sub && sub.toJSON) ? sub.toJSON() : {};
    return saveSubObject(j);
  }

  async function deleteSub(endpoint){
    if (!signedIn()) return { ok: false };
    try {
      const c = await App.Sync.client();
      const q = c.from(TABLE_SUBS).delete().eq("user_id", App.Sync.user.id);
      await (endpoint ? q.eq("endpoint", endpoint) : q);
      return { ok: true };
    } catch(e){ return { ok: false, error: e.message || String(e) }; }
  }

  /* نخزّن في Service Worker: مفتاح VAPID + سياق Auth (يستخدمه لإعادة الحفظ بالخلفية) */
  async function storeSwContext(){
    try {
      const r = await swReady();
      const target = r.active || navigator.serviceWorker.controller;
      if (!target) return;
      let auth = null;
      try {
        if (App.Sync && App.Sync.getSession){
          const s = await App.Sync.getSession();
          const session = s && s.session;
          if (session && session.access_token && App.Sync.user){
            auth = {
              url: cfg().supabaseUrl,
              anonKey: cfg().supabaseAnonKey,
              accessToken: session.access_token,
              userId: (session.user && session.user.id) || App.Sync.user.id,
              expiresAt: session.expires_at || null
            };
          }
        }
      } catch(e){}
      target.postMessage({ type: "store-push-context", vapidPublicKey: vapidKey(), auth: auth, version: SW_BUILD });
      dbg("SW context stored", { hasAuth: !!auth });
    } catch(e){ dbg("storeSwContext failed", e); }
  }

  async function clearSwContext(){
    try {
      const r = await swReady();
      const target = r.active || navigator.serviceWorker.controller;
      if (target) target.postMessage({ type: "clear-push-context" });
    } catch(e){}
  }

  /* اشتراك أنشأه SW في الخلفية ولم ينجح حفظه (انتهى التوكن) — نحفظه الآن */
  async function consumePendingSubscription(){
    const pending = await idbGet("pendingSubscription");
    if (!pending || !pending.endpoint) return;
    dbg("consuming pending subscription from SW");
    const saved = await saveSubObject(pending);
    if (saved.ok) await idbDel("pendingSubscription");
  }

  /* ══ بناء جدول الإشعارات المستقبلية ══ */
  function buildSchedule(){
    const st = App.Store.getState();
    const now = new Date();
    const cutoff = new Date(now.getTime() + 7 * 86400000);
    const D = App.Data;
    const items = [];
    const s = (st.settings && st.settings.notif) || {};

    function add(dedupe, fire, title, body, url){
      if (!fire || isNaN(fire.getTime())) return;
      if (fire.getTime() <= now.getTime() + 20000) return;
      if (fire.getTime() > cutoff.getTime()) return;
      items.push({
        dedupe_key: dedupe, fire_at: fire.toISOString(),
        title: title, body: body || "", icon: ICON, url: url || "/"
      });
    }
    function at(key, h, m){
      const d = U.fromKey(key); d.setHours(h, m || 0, 0, 0); return d;
    }

    const today = U.todayKey();
    const tomorrow = U.addDaysKey(today, 1);

    if (s.study !== false){
      st.tasks.filter(t => !t.completed).forEach(t => {
        if (!t.time || !/^\d{1,2}:\d{2}$/.test(t.time)) return;
        if (t.date < today) return;
        const p = t.time.split(":");
        const fire = at(t.date, +p[0], +p[1]);
        add("task_due_" + t.id + "_" + t.date + "_" + t.time, fire,
          "حان وقت المهمة",
          "مهمة «" + t.title + "»" + (t.subject && t.subject !== "general" ? " — " + D.subjName(t.subject) : ""),
          "./#/todo");
      });
    }

    if (s.homework !== false){
      st.homework.filter(h => !h.completed).forEach(h => {
        add("hw_due_" + h.id + "_" + h.deadline, at(h.deadline, 9, 0),
          "واجب مستحق اليوم",
          "واجب «" + h.title + "» في " + D.subjName(h.subject) + " مستحق اليوم.",
          "./#/homework");
        const before = U.fromKey(h.deadline); before.setDate(before.getDate() - 1); before.setHours(20, 0, 0, 0);
        add("hw_soon_" + h.id + "_" + h.deadline, before,
          "واجب مستحق غدًا",
          "لا تنسَ واجب «" + h.title + "» غدًا في " + D.subjName(h.subject) + ".",
          "./#/homework");
      });
    }

    const due = App.Store.reviewQueue().length;
    if (due && s.review !== false){
      add("review_" + today, at(today, 18, 0),
        "بنك الأخطاء",
        "لديك " + due + " أخطاء بانتظار مراجعة اليوم — جرعة قصيرة تكفي.",
        "./#/errors");
    }

    [today, tomorrow].forEach((k, i) => {
      const d = st.daily[k] || {};
      const active = (d.studyMin || 0) > 0 || (d.tasksCompleted || 0) > 0 || (d.homeworkCompleted || 0) > 0;
      if (s.dailyGoal !== false && !active){
        add("goal_" + k, at(k, 20, 0),
          "أكمل هدف اليوم",
          "لم تسجّل دراسة اليوم بعد — جلسة واحدة تقرّبك من هدفك.",
          "./#/timer");
      }
      if (s.streak !== false && i === 0 && !active && D.longestStreakOf(st) >= 3){
        add("streak_" + k, at(k, 21, 0),
          "حافظ على سلسلتك",
          "سلسلتك في خطر — ادرس اليوم ولو 10 دقائق.",
          "./#/dashboard");
      }
      if (s.dailyGoal !== false){
        add("summary_" + k, at(k, 21, 30),
          "ملخص يومك",
          i === 0 ? "خذ دقيقة لترى ما أنجزته اليوم." : "خطّط لغدك ونظّم مهامك.",
          "./#/analytics");
      }
    });

    return items.slice(0, 40);
  }

  async function syncSchedule(){
    if (busy || !canPush() || !signedIn()) return { ok: false, error: "not-ready" };
    busy = true;
    try {
      const items = buildSchedule();
      const c = await App.Sync.client();
      const uid = App.Sync.user.id;
      if (items.length){
        const rows = items.map(x => Object.assign({}, x, { user_id: uid }));
        const { error } = await c.from(TABLE_SCHED).upsert(rows, { onConflict: "user_id,dedupe_key" });
        if (error) return { ok: false, error: error.message };
      }
      const keys = {}; items.forEach(x => { keys[x.dedupe_key] = 1; });
      // ↓ الأهم: لا نحذف إشعارًا فات وقته ولم يُرسل — نتركه للخادم.
      //   نحذف فقط الصفوف المستقبلية التي أُلغيت فعلًا (مهمة/واجب محذوف مثلًا).
      const { data: pending } = await c.from(TABLE_SCHED)
        .select("id,dedupe_key,fire_at").eq("user_id", uid).is("sent_at", null);
      if (pending && pending.length){
        const now = Date.now();
        const stale = pending
          .filter(r => !keys[r.dedupe_key] && new Date(r.fire_at).getTime() > now)
          .map(r => r.id);
        if (stale.length) await c.from(TABLE_SCHED).delete().in("id", stale);
      }
      dbg("schedule uploaded", { count: items.length });
      return { ok: true, count: items.length };
    } catch(e){
      return { ok: false, error: (e && e.message) || String(e) };
    } finally { busy = false; }
  }

  /* ══ إعادة مزامنة كاملة ومتحقَّقة: اشتراك + حفظ + جدول ══ */
  async function reSync(opts){
    opts = opts || {};
    const steps = {};
    if (!supported()) return { ok: false, error: "unsupported", steps };
    if (!signedIn()) return { ok: false, error: "no-auth", steps };
    if (!vapidKey()) return { ok: false, error: "no-vapid", steps };
    if (permission() !== "granted") return { ok: false, error: "permission", steps };
    try {
      await storeSwContext();
      const sub = await getOrCreateSubscription(opts.forceSubscription);
      steps.subscription = !!sub;
      const saved = await saveSub(sub);
      steps.saved = saved.ok;
      steps.verified = !!saved.verified;
      if (!saved.ok) return { ok: false, error: saved.error, steps };
      await consumePendingSubscription();
      const sch = await syncSchedule();
      steps.schedule = sch.ok ? (sch.count || 0) : false;
      if (!sch.ok) dbg("schedule sync failed", sch.error);
      await storeSwContext();
      dbg("reSync done", steps);
      return { ok: saved.ok && sch.ok, steps };
    } catch(e){
      return { ok: false, error: (e && e.message) || String(e), steps };
    }
  }

  async function enable(){
    if (!supported()) return { ok: false, error: "لا يدعم متصفحك الإشعارات في الخلفية — جرّب عبر https أو localhost." };
    if (!signedIn()) return { ok: false, error: "اربط حساب Google أولًا حتى تصلك الإشعارات على أجهزتك." };
    if (!vapidKey()) return { ok: false, error: "مفتاح VAPID العام غير مضبوط في supabase-config.js." };
    const p = await askPermission();
    if (p !== "granted") return { ok: false, error: "تم رفض إذن الإشعارات من المتصفح." };
    setFlag(true);
    const r = await reSync({ forceSubscription: false });
    if (!r.ok) return { ok: false, error: r.error || "تعذّر إتمام تفعيل الإشعارات.", steps: r.steps };
    return r;
  }

  async function disable(){
    setFlag(false);
    const sub = await currentSubscription();
    try {
      if (sub){
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await deleteSub(ep);
      }
      if (signedIn()){
        const c = await App.Sync.client();
        await c.from(TABLE_SCHED).delete().eq("user_id", App.Sync.user.id).is("sent_at", null);
      }
      await clearSwContext();
    } catch(e){ /* تجاهل */ }
    return { ok: true };
  }

  async function status(){
    return {
      supported: supported(),
      permission: permission(),
      enabled: isEnabled(),
      signedIn: signedIn(),
      hasKey: !!vapidKey(),
      subscribed: !!(await currentSubscription())
    };
  }

  /* ══ أدوات تشخيص (بدون أي أسرار — للـ console فقط) ══ */
  async function diagnose(){
    const out = {
      swBuild: await idbGet("swBuild"),
      supported: supported(), permission: permission(), enabled: isEnabled(),
      signedIn: signedIn(), hasVapid: !!vapidKey(),
      subscription: null, subKeyMatch: null, dbSubscription: null,
      pendingSchedule: [], errors: []
    };
    try {
      const sub = await currentSubscription();
      if (sub){
        out.subKeyMatch = subKeyMatches(sub);
        out.subscription = { endpointHost: (function(){ try { return new URL(sub.endpoint).host; } catch(e){ return "?"; } })(), keyMatch: out.subKeyMatch };
      }
      if (signedIn()){
        const c = await App.Sync.client();
        const uid = App.Sync.user.id;
        if (sub){
          const { data } = await c.from(TABLE_SUBS).select("id")
            .eq("user_id", uid).eq("endpoint", sub.endpoint).maybeSingle();
          out.dbSubscription = !!(data && data.id);
        }
        const { data: pend } = await c.from(TABLE_SCHED).select("dedupe_key,fire_at")
          .eq("user_id", uid).is("sent_at", null).order("fire_at", { ascending: true }).limit(50);
        out.pendingSchedule = (pend || []).map(r => ({ k: r.dedupe_key, at: r.fire_at }));
      }
    } catch(e){ out.errors.push((e && e.message) || String(e)); }
    try { console.log("[StudyOS Push] diagnose", out); } catch(e){}
    return out;
  }

  /* إدراج إشعار اختبار بعد ثوانٍ — أغلق التاب بعده ولا تفتحه حتى يصل */
  async function testIn(sec){
    if (!signedIn()) return { ok: false, error: "no-auth" };
    sec = Math.max(30, Math.min(3600, +sec || 120));
    const c = await App.Sync.client();
    const fire_at = new Date(Date.now() + sec * 1000).toISOString();
    const dedupe_key = "test_" + Date.now();
    const { error } = await c.from(TABLE_SCHED).upsert([{
      user_id: App.Sync.user.id, dedupe_key, fire_at,
      title: "اختبار Web Push", body: "إن وصلك هذا والتاب مغلق فالنظام يعمل.", icon: ICON, url: "./#/dashboard"
    }], { onConflict: "user_id,dedupe_key" });
    if (error) return { ok: false, error: error.message };
    dbg("test scheduled", { at: fire_at });
    return { ok: true, at: fire_at, note: "أغلق كل تبويبات الموقع الآن ولا تفتحها حتى يصل الإشعار." };
  }

  function init(){
    U.on("sync-user", () => {
      if (isEnabled()){
        if (App.Sync.user) reSync();
        else clearSwContext();
      }
    });
    // مزامنة الجدول فقط أثناء فتح الموقع — الإرسال الحقيقي من pg_cron → send-due-push
    U.on("change", U.debounce(() => { if (canPush()) syncSchedule(); }, 5000));

    if ("serviceWorker" in navigator){
      navigator.serviceWorker.addEventListener("message", function (ev){
        const t = ev && ev.data && ev.data.type;
        if ((t === "push-subscription-changed" || t === "push-resubscribe-needed") && isEnabled()) reSync({ forceSubscription: t === "push-resubscribe-needed" });
      });
    }
    window.addEventListener("online", () => { if (isEnabled()) reSync(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && isEnabled()) reSync(); });
    window.addEventListener("focus", () => { if (isEnabled()) reSync(); });

    if (isEnabled() && permission() === "granted") reSync();
    dbg("init", { build: SW_BUILD, enabled: isEnabled() });
  }

  return {
    supported, permission, isEnabled,
    isSubscribed: async () => !!(await currentSubscription()),
    enable, disable, reSync, syncSchedule, buildSchedule, status, diagnose, testIn, init,
    _debug: { getOrCreateSubscription, subKeyMatches, idbGet, idbSet, idbDel }
  };
})();

(function () {
  try { if (App.Push && App.Push.init) App.Push.init(); } catch(e){}
})();
