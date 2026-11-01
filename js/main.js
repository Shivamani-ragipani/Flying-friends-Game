/* ==========================================================
   main.js — boot: build the scene, load all assets (scene images,
   gameplay music, every character + their voice clips), then show
   the character selection screen. The game is fully playable even
   if individual assets fail to load.
   ========================================================== */
(function (BD) {
  'use strict';

  function boot() {
    BD.Game.init();
    Promise.all([BD.Assets.load(), BD.Audio.load(), BD.Characters.load()])
      .catch(function () { /* missing assets are fine */ })
      .then(function () { BD.Game.ready(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.BD);
