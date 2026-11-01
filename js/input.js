/* ==========================================================
   input.js — Input Manager.
   One action only: tap / click / Space. No swipe, no drag.
   Uses pointerdown (not click) so a flap fires the instant the
   finger touches the screen, with zero click delay.
   ========================================================== */
(function (BD) {
  'use strict';

  var stageEl = null, handlers = null;

  function onKeyDown(e) {
    var k = e.key;
    if (k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      if (!e.repeat) { BD.Audio.unlock(); handlers.onTap('key'); }
    } else if (k === 'Enter') {
      e.preventDefault();
      if (!e.repeat) { BD.Audio.unlock(); handlers.onTap('key'); }
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      if (!e.repeat) handlers.onPause();
    }
  }

  function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    BD.Audio.unlock();
    handlers.onTap('pointer');
  }

  BD.Input = {
    attach: function (stage, h) {
      stageEl = stage;
      handlers = h;
      window.addEventListener('keydown', onKeyDown);
      stage.addEventListener('pointerdown', onPointerDown);
      stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      // Stop iOS rubber-banding / double-tap zoom while playing.
      document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    }
  };
})(window.BD);
