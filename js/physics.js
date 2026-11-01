/* ==========================================================
   physics.js — player physics (Flappy-style arcade).
   Constant gravity, a velocity impulse on tap (never a teleport),
   velocity damping, and max rise / fall speed. Stepped in small
   fixed slices by the game so results are identical at any FPS.
   ========================================================== */
(function (BD) {
  'use strict';

  var P = BD.CONFIG.PLAYER, U = BD.util;
  var TILT_UP = P.tiltUp, TILT_DOWN = P.tiltDown;

  BD.Physics = {
    flap: function (p) {
      p.vy = -P.flapVel;       // set upward velocity; position integrates smoothly
    },

    // dt is a small slice (<= SUBSTEP)
    step: function (p, dt) {
      p.vy += P.gravity * dt;
      p.vy *= Math.exp(-P.drag * dt);
      if (p.vy < -P.maxUp) p.vy = -P.maxUp;
      if (p.vy > P.maxFall) p.vy = P.maxFall;
      p.y += p.vy * dt;
    },

    // Smooth tilt in degrees: +25 max (nose up) .. -75 min (nose down).
    updateTilt: function (p, dt) {
      var target;
      if (p.vy < 0) target = TILT_UP * Math.min(1, -p.vy / P.flapVel);
      else target = -TILT_DOWN * Math.min(1, p.vy / (P.maxFall * 0.85));
      var lambda = p.vy < 0 ? 22 : 9;      // snap up quickly, droop down slowly
      p.tilt = U.damp(p.tilt, target, lambda, dt);
      p.tilt = U.clamp(p.tilt, -TILT_DOWN, TILT_UP);
    }
  };
})(window.BD);
