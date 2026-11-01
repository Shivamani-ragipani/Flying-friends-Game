/* ==========================================================
   animation.js — Animation System: screen shake, camera zoom
   and white impact flash. Plain numbers, zero allocation.
   (Score pop and UI animations are CSS-driven in ui.js.)
   ========================================================== */
(function (BD) {
  'use strict';

  var U = BD.util;

  var Anim = {
    shake: 0,
    zoom: 1,
    zoomTarget: 1,
    flash: 0,

    reset: function () { this.shake = 0; this.zoom = 1; this.zoomTarget = 1; this.flash = 0; },

    // Collision: shake, quick flash, slow camera push-in for the Game Over.
    hit: function () { this.shake = 14; this.flash = 1; this.zoomTarget = 1.08; },

    update: function (dt) {
      this.shake *= Math.exp(-dt * 6);
      if (this.shake < 0.15) this.shake = 0;
      this.zoom = U.damp(this.zoom, this.zoomTarget, 3.2, dt);
      if (Math.abs(this.zoom - this.zoomTarget) < 0.0005) this.zoom = this.zoomTarget;
      this.flash = Math.max(0, this.flash - dt * 3.5);
    }
  };

  BD.Anim = Anim;
})(window.BD);
