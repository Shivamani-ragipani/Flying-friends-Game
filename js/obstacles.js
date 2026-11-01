/* ==========================================================
   obstacles.js — pooled mia-pillar pairs (one hangs from the top,
   one stands on the ground, with a gap between).
   Objects are created once and reused: no garbage while playing.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, K = C.COURSE, U = BD.util;
  var POOL_SIZE = 8;
  var pool = [];
  var last = null;       // most recently spawned pair
  var prevCenter = 0;
  var hasPrev = false;   // false until the first pair of a run is placed

  for (var i = 0; i < POOL_SIZE; i++) {
    pool.push({ active: false, x: 0, gapC: 0, gapT: 0, gapB: 0, scored: false, variant: 0 });
  }

  function bw() { return BD.Sprites.bottleW || C.OBSTACLE.w; }

  function acquire() {
    for (var i = 0; i < POOL_SIZE; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  function pickCenter(D) {
    var gy = BD.groundY();
    var minC = K.topMargin + D.gap / 2;
    var maxC = gy - K.bottomMargin - D.gap / 2;
    if (!hasPrev) return U.clamp(gy * 0.45, minC, maxC);

    // Never ask for a climb/drop a skilled player couldn't make in the time given.
    var up = U.clamp(K.climbRate * K.climbFactor * D.interval, 110, 260);
    var lo = Math.max(minC, prevCenter - up);
    var hi = Math.min(maxC, prevCenter + K.maxDown);
    if (hi < lo) { var m = (lo + hi) / 2; lo = hi = m; }
    return U.rand(lo, hi);
  }

  BD.Obstacles = {
    pool: pool,

    reset: function () {
      for (var i = 0; i < POOL_SIZE; i++) pool[i].active = false;
      last = null;
      hasPrev = false;
    },

    // Move every active pair left; recycle those that left the screen.
    move: function (dt, speed) {
      var half = bw() / 2;
      for (var i = 0; i < POOL_SIZE; i++) {
        var o = pool[i];
        if (!o.active) continue;
        o.x -= speed * dt;
        if (o.x + half < -4) { o.active = false; if (last === o) last = null; }
      }
    },

    // Spawn a new pair just off the right edge when enough distance has passed.
    spawn: function (D) {
      var spawnX = C.W + bw() / 2 + 8;
      var spacing = D.speed * D.interval;
      if (last && last.x > spawnX - spacing) return;
      var o = acquire();
      if (!o) return;
      var gap = D.gap;
      var c = pickCenter(D);
      o.active = true;
      o.scored = false;
      o.x = spawnX;
      o.gapC = c;
      o.gapT = c - gap / 2;
      o.gapB = c + gap / 2;
      o.variant = (Math.random() * C.OBSTACLE.colors.length) | 0;
      prevCenter = c;
      hasPrev = true;
      last = o;
    }
  };
})(window.BD);
