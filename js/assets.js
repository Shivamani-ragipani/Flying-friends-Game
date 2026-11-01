/* ==========================================================
   assets.js — Asset Loader for optional images.
   A missing file never breaks the game: images[name] is null and
   Sprites / Renderer fall back to generated art.
   ========================================================== */
(function (BD) {
  'use strict';

  var Assets = {
    images: {},

    loadImage: function (src, timeout) {
      return new Promise(function (resolve) {
        var img = new Image();
        var done = false;
        var timer = setTimeout(function () { finish(null); }, timeout || 4000);
        function finish(v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(v);
        }
        img.onload = function () { finish(img.naturalWidth > 0 ? img : null); };
        img.onerror = function () { finish(null); };
        img.src = src;
      });
    },

    load: function () {
      var self = this;
      var map = BD.CONFIG.ASSETS.images;
      return Promise.all(Object.keys(map).map(function (k) {
        return self.loadImage(map[k], 8000).then(function (img) { self.images[k] = img; });
      }));
    }
  };

  BD.Assets = Assets;
})(window.BD);
