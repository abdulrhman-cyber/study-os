/* ═══════════════ STUDY OS — notify.js (Web Notification API bridging) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Notify = (function () {
  const S = App.Store;
  const ICON = "img/logo.png";
  const API = typeof window !== "undefined" ? window.Notification : null;

  function supported(){
    return !!API && window.isSecureContext !== false;
  }
  function isEnabled(){
    return !!S.getState().settings.browserNotif && supported() && API.permission === "granted";
  }
  function ask(){
    if (!supported()) return Promise.resolve({ granted: false, supported: false });
    if (API.permission !== "default")
      return Promise.resolve({ granted: API.permission === "granted", supported: true });
    return new Promise(res => {
      let done = false;
      const finish = p => {
        if (done) return; done = true;
        const granted = p === "granted" || API.permission === "granted";
        res({ granted, supported: true });
      };
      try {
        const r = API.requestPermission();
        if (r && typeof r.then === "function") r.then(finish, () => finish("denied"));
        else { r && finish(r); }
      } catch(e){
        try { API.requestPermission(finish); } catch(e2){ finish("denied"); }
      }
    });
  }
  function push(n){
    if (!isEnabled() || !n) return;
    try {
      new API(n.title || "StudyOS", {
        body: n.body || "",
        tag: "studyos-" + (n.key || n.type || "notif"),
        icon: ICON
      });
    } catch(e){ /* ignore */ }
  }
  return { supported, isEnabled, ask, push };
})();

(function () {
  const U = App.Util;
  const N = App.Notify;
  if (!U || !U.on || !N) return;
  U.on("notif", function (n){
    if (!n || !N.push) return;
    if (n.type === "homework" || n.type === "task") {
      // تذكيرات الواجبات والمهام المجدولة (بما فيها المهمة في وقتها المحدد)
      N.push(n);
    }
  });
})();