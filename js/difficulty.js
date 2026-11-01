/* ==========================================================
   difficulty.js — Difficulty Manager.
   Interpolates speed, gap size and spawn interval between score
   keyframes, then smooths the result over time, so difficulty
   can never jump suddenly.
   ========================================================== */
(function (BD) {
  'use strict';

  var KEYS = BD.CONFIG.DIFF, U = BD.util;
  var cur = { speed: KEYS[0].speed, gap: KEYS[0].gap, interval: KEYS[0].interval };
  var tgt = { speed: 0, gap: 0, interval: 0 };

  function target(score) {
    var n = KEYS.length, i = 0;
    if (score >= KEYS[n - 1].score) {
      tgt.speed = KEYS[n - 1].speed; tgt.gap = KEYS[n - 1].gap; tgt.interval = KEYS[n - 1].interval;
      return;
    }
    while (i < n - 2 && score >= KEYS[i + 1].score) i++;
    var a = KEYS[i], b = KEYS[i + 1];
    var t = (score - a.score) / (b.score - a.score);
    tgt.speed = U.lerp(a.speed, b.speed, t);
    tgt.gap = U.lerp(a.gap, b.gap, t);
    tgt.interval = U.lerp(a.interval, b.interval, t);
  }

  BD.Difficulty = {
    cur: cur,
    reset: function () {
      cur.speed = KEYS[0].speed; cur.gap = KEYS[0].gap; cur.interval = KEYS[0].interval;
    },
    update: function (score, dt) {
      target(score);
      cur.speed = U.damp(cur.speed, tgt.speed, 1.4, dt);
      cur.gap = U.damp(cur.gap, tgt.gap, 1.4, dt);
      cur.interval = U.damp(cur.interval, tgt.interval, 1.4, dt);
    },
    tier: function (score) {
      return score < 10 ? 'easy' : score < 30 ? 'normal' : score < 60 ? 'hard' : 'very hard';
    }
  };
})(window.BD);
