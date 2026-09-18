/* ═══════════════════ STUDY OS — sw.js (Service Worker) ═══════════════════
   - يستقبل Web Push في الخلفية ويعرض الإشعار بنفسه (بدون أي tab مفتوح).
   - يفتح التطبيق على الرابط عند الضغط على الإشعار.
   - يعالج pushsubscriptionchange: يعيد الاشتراك ويحفظه في IndexedDB،
     ويحاول حفظه في Supabase في الخلفية، مع fallback يخبر الصفحة عند عودتها.
   - لا يعترض أي طلبات fetch — لا يكسر المزامنة أو تحميل الملفات.
   النطاق: جذر التطبيق (يتحكم في الصفحات تحت هذا المجلد فقط).
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";

const SW_LOG = "[StudyOS SW]";
const IDB_NAME = "studyos-push";
const IDB_STORE = "kv";
const SW_BUILD = "2026-push-12";
/* اسم الكاش مرتبط بإصدار الـ SW: أي رفع جديد يغيّر الملف → يتحدّث الـ SW →
   يُحذف الكاش القديم تلقائيًا. زد SW_BUILD عند كل نشرة. */
const CACHE_STATIC = "studyos-static-" + SW_BUILD;

/* ── نطاق النشر: يدعم GitHub Pages تحت مسار فرعي مثل /repo/ دون كسر الروابط ── */
function scopeBase(){
  try { if (self.registration && self.registration.scope) return self.registration.scope; } catch(e){}
  return new URL("./", self.location.href).href;
}
function resolveAppUrl(raw){
  const base = scopeBase();
  if (!raw) return base;
  if (/^https?:\/\//i.test(raw)) return raw;            // رابط خارجي كما هو
  if (String(raw).charAt(0) === "#") return base + raw; // #/route
  return new URL(String(raw).replace(/^\/+/, ""), base).href; // /#/route أو ./#/route
}

/* ── IndexedDB (Service Worker لا يملك localStorage) ── */
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

/* ── lifecycle ── */
self.addEventListener("install", function (event){
  console.log(SW_LOG, "installing", SW_BUILD);
  self.skipWaiting();
});

self.addEventListener("activate", function (event){
  console.log(SW_LOG, "activating", SW_BUILD);
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(k => k.indexOf("studyos-static-") === 0 && k !== CACHE_STATIC)
        .map(k => caches.delete(k)));
    } catch(e){}
    try { await self.clients.claim(); } catch(e){}
  })());
});

/* ── تسريع التحميل: تخزين الملفات الثابتة (نفس الأصل فقط) ──────────────
   - التنقّل (HTML): الشبكة أولًا ثم الكاش عند انقطاع الشبكة.
   - الأصول الثابتة (JS/CSS/صور/خطوط): من الكاش فورًا + تحديث بالخلفية.
   - لا نتدخّل في أي طلب خارجي (Supabase / Google Fonts) ولا في sw.js. */
self.addEventListener("fetch", function (event){
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch(e){ return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.slice(-6) === "/sw.js" || url.pathname === "/sw.js") return;

  if (req.mode === "navigate"){
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === "basic"){
          const c = await caches.open(CACHE_STATIC);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch(e){
        const cached = await caches.match(req);
        if (cached) return cached;
        const home = await caches.match("index.html");
        return home || Response.error();
      }
    })());
    return;
  }

  const dest = req.destination;
  const isStatic = dest === "script" || dest === "style" || dest === "image" ||
                   dest === "font" || dest === "manifest" ||
                   /\.(?:js|css|png|webp|jpg|jpeg|svg|ico|woff2?|ttf)(?:\?|$)/i.test(url.pathname);
  if (!isStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_STATIC);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached){
      event.waitUntil(network);
      return cached;
    }
    const res = await network;
    return res || Response.error();
  })());
});

/* ── استقبال Push (يعمل بدون أي tab مفتوح) ── */
self.addEventListener("push", function (event){
  console.log(SW_LOG, "push received");
  let payload = {};
  try {
    if (event.data){
      const txt = event.data.text();
      try { payload = JSON.parse(txt) || {}; }
      catch(e){ payload = { body: txt }; }
    }
  } catch(e){ payload = {}; }

  const title = payload.title || "Study OS";
  const body = payload.body || "";
  const icon = payload.icon || "img/logo.png";
  const url = resolveAppUrl(payload.url);
  const tag = payload.tag || ("studyos-" + Date.now());

  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(title, {
        body: body,
        icon: icon,
        badge: "img/logo.png",
        tag: tag,
        renotify: false,
        data: { url: url }
      });
      console.log(SW_LOG, "notification displayed", tag);
    } catch(e){
      console.error(SW_LOG, "showNotification failed", e);
    }
  })());
});

/* ── النقر على الإشعار ── */
self.addEventListener("notificationclick", function (event){
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "";
  let target;
  try { target = resolveAppUrl(raw); } catch(e){ target = scopeBase(); }
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list){
      if (c.url && "focus" in c){
        try { await c.focus(); } catch(e){}
        try { if (target && c.navigate) await c.navigate(target); } catch(e){}
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

/* ── تغيّر الاشتراك: إعادة اشتراك + حفظ في الخلفية (بدون صفحة مفتوحة) ── */
self.addEventListener("pushsubscriptionchange", function (event){
  console.log(SW_LOG, "pushsubscriptionchange");
  event.waitUntil(handleSubscriptionChange(event));
});

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function trySaveSubscriptionInBackground(json){
  try {
    const auth = await idbGet("pushAuth");
    if (!auth || !auth.url || !auth.anonKey || !auth.accessToken || !auth.userId) return false;
    const base = String(auth.url).replace(/\/+$/, "");
    const res = await fetch(base + "/rest/v1/push_subscriptions?on_conflict=user_id,endpoint", {
      method: "POST",
      headers: {
        "apikey": auth.anonKey,
        "Authorization": "Bearer " + auth.accessToken,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify([{
        user_id: auth.userId,
        endpoint: json.endpoint,
        p256dh: (json.keys && json.keys.p256dh) || "",
        auth: (json.keys && json.keys.auth) || "",
        user_agent: "service-worker",
        updated_at: new Date().toISOString()
      }])
    });
    if (res.ok){ console.log(SW_LOG, "subscription re-saved from SW"); return true; }
    console.warn(SW_LOG, "background save rejected", res.status);
    return false;
  } catch(e){
    console.warn(SW_LOG, "background save failed", e);
    return false;
  }
}

async function handleSubscriptionChange(event){
  let sub = event.newSubscription || null;
  if (!sub){
    const storedKey = await idbGet("vapidPublicKey");
    if (storedKey){
      try {
        sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(storedKey)
        });
        console.log(SW_LOG, "resubscribed from SW");
      } catch(e){ console.warn(SW_LOG, "resubscribe failed", e); }
    }
  }
  const json = (sub && sub.toJSON) ? sub.toJSON() : null;
  if (json){
    await idbSet("pendingSubscription", json);
    const saved = await trySaveSubscriptionInBackground(json);
    if (saved) await idbDel("pendingSubscription");
  }
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const type = json ? "push-subscription-changed" : "push-resubscribe-needed";
  list.forEach(c => { try { c.postMessage({ type }); } catch(e){} });
}

/* ── رسائل من الصفحة ── */
self.addEventListener("message", function (event){
  const d = (event && event.data) || {};
  if (!d.type) return;
  if (d.type === "show-notification"){
    event.waitUntil(self.registration.showNotification(d.title || "Study OS", {
      body: d.body || "",
      icon: d.icon || "img/logo.png",
      tag: d.tag || "studyos-" + Date.now(),
      data: { url: resolveAppUrl(d.url) }
    }));
    return;
  }
  if (d.type === "store-push-context"){
    event.waitUntil((async () => {
      if (d.vapidPublicKey) await idbSet("vapidPublicKey", d.vapidPublicKey);
      if (d.auth) await idbSet("pushAuth", d.auth);
      await idbSet("swBuild", SW_BUILD);
    })());
    return;
  }
  if (d.type === "clear-push-context"){
    event.waitUntil((async () => {
      await idbDel("pushAuth");
      await idbDel("pendingSubscription");
    })());
  }
});
