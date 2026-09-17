/* ═══════════════ STUDY OS — icons.js (SVG icon set) ═══════════════ */
"use strict";
window.App = window.App || {};
App.Icons = (function () {
  const S = (inner, tw) => '<svg viewBox="0 0 24 24" width="' + (tw || 20) + '" height="' + (tw || 20) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  const map = {
    dashboard: S('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
    tasks: S('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    timer: S('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>'),
    book: S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    analytics: S('<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>'),
    errors: S('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'),
    sessions: S('<path d="M5 3l14 9-14 9Z"/>'),
    homework: S('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h2"/>'),
    calendar: S('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    notes: S('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'),
    achievements: S('<path d="m12 2 3.1 6.3 7 1-5.1 5 1.2 6.9L12 17.8 5.8 21.2 7 14.3l-5-5 7-1Z"/>'),
    bell: S('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    user: S('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
    search: S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    close: S('<path d="M18 6 6 18M6 6l12 12"/>'),
    check: S('<path d="M20 6 9 17l-5-5"/>'),
    checkdone: S('<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
    play: S('<path d="M5 3l14 9-14 9Z"/>'),
    pause: S('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
    reset: S('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: S('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'),
    monitor: S('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    export: S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
    import: S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5"/><path d="M12 3v12"/>'),
    trash: S('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>'),
    edit: S('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    pin: S('<path d="M12 17v5"/><path d="M9 3h6l-1 8 3 3H7l3-3Z"/>'),
    archive: S('<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
    target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    flame: S('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    star: S('<path d="m12 2 3.1 6.3 7 1-5.1 5 1.2 6.9L12 17.8 5.8 21.2 7 14.3l-5-5 7-1Z"/>'),
    xp: S('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>'),
    shield: S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    focus: S('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
    arabic: S('<path d="M4 4h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h10"/>'),
    english: S('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M4 6l4 6-4 6"/>'),
    history: S('<path d="M4 19.5V6a3 3 0 0 1 3-3h13v15H7a3 3 0 0 0-3 3z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M9 7h7M9 11h7M9 14.5h5"/>'),
    code: S('<path d="m8 17-5-5 5-5M16 17l5-5-5-5"/><path d="m13 5-2 14"/>'),
    sunburst: S('<circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    flag: S('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
    chevron_left: S('<path d="m15 18-6-6 6-6"/>'),
    chevron_right: S('<path d="m9 18 6-6-6-6"/>'),
    calendar2: S('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 15h2M14 15h2M8 19h2"/>'),
    info: S('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    zap: S('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>'),
    refresh: S('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'),
    box: S('<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'),
    image: S('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>')
  };
  function get(name, size){
    return map[name] || map.star;
  }
  function subj(s, size){
    if (s && s.iconImg) return '<img class="subj-img" src="' + s.iconImg + '" width="' + size + '" height="' + size + '" alt="" loading="lazy" decoding="async">';
    return get(s ? s.icon : "book", size);
  }
  /* subject icons mapped via subject def already */
  return { get: get, subj: subj, map: map };
})();