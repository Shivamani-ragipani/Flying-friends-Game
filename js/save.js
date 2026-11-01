/* ==========================================================
   save.js — SaveManager: best score + sound preference
   (localStorage, safe in private mode). Old Flying Head saves
   are migrated so nobody loses their best score.
   ========================================================== */
(function (BD) {
  'use strict';

  var S = BD.CONFIG.STORAGE;

  function get(k, def) {
    try { var v = window.localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; }
  }
  function set(k, v) {
    try { window.localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ }
  }

  BD.Save = {
    getBest: function () {
      var v = parseInt(get(S.best, ''), 10);
      if (isNaN(v)) v = parseInt(get(S.legacyBest, '0'), 10) || 0;
      return v;
    },
    setBest: function (n) { set(S.best, n); },
    isSoundOn: function () {
      var v = get(S.sound, '');
      if (v === '') v = get(S.legacySound, '1');
      return v !== '0';
    },
    setSound: function (on) { set(S.sound, on ? '1' : '0'); }
  };
})(window.BD);
