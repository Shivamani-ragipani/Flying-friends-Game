/* ==========================================================
   sprites.js — pre-renders mia pillar / character / cloud art once
   per resize (never per frame) and feeds the collision masks.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, U = BD.util;

  var Sprites = {
    bottles: [],      // [{ up, down }] pillar canvases: standing / hanging
    bottleW: C.OBSTACLE.w,   // kept for obstacles/renderer/collision compat
    bottleH: C.OBSTACLE.h,
    head: null,       // { img, w, h }
    cloud: null,      // { img, w, h }
    glow: null,
    headIsAsset: false
  };

  function makeCanvas(w, h, ratio) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * ratio));
    c.height = Math.max(1, Math.ceil(h * ratio));
    var g = c.getContext('2d');
    g.scale(c.width / w, c.height / h);
    return { c: c, g: g };
  }

  /* ---------------- mia pillar (built from assets/images/mia.png) ---------------- */
  var PILLAR_R = 16;        // corner rounding
  var CAP_H = 18;           // solid tip bar facing the gap

  function drawPillarPanel(g, w, h, color) {
    var gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, color.dark);
    gr.addColorStop(0.3, color.base);
    gr.addColorStop(0.7, color.base);
    gr.addColorStop(1, color.dark);
    U.roundRect(g, 0, 0, w, h, PILLAR_R);
    g.fillStyle = gr;
    g.fill();
    // inner glass shading
    g.save();
    U.roundRect(g, 0, 0, w, h, PILLAR_R);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(6, 0, 7, h);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(w - 16, 0, 10, h);
    g.restore();
    U.roundRect(g, 1, 1, w - 2, h - 2, PILLAR_R);
    g.strokeStyle = 'rgba(255,255,255,0.32)';
    g.lineWidth = 2;
    g.stroke();
  }

  function drawMiaTiles(g, w, h, img) {
    var pad = 10, pw = w - pad * 2;
    var zones = 3, zone = h / zones;
    for (var i = 0; i < zones; i++) {
      var s = Math.min(pw / img.naturalWidth, (zone - 10) / img.naturalHeight);
      var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      g.save();
      g.translate(pad + pw / 2, i * zone + zone / 2);
      if (i % 2 === 1) g.scale(-1, 1);       // playful mirror variety
      g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      g.restore();
    }
  }

  // capAtTop: standing pillar (tip up); otherwise the cap sits at the bottom.
  function drawPillar(g, w, h, color, img, capAtTop) {
    drawPillarPanel(g, w, h, color);
    if (img) drawMiaTiles(g, w, h, img);
    else {
      // graceful fallback when mia.png is missing: patterned pillar
      g.save();
      U.roundRect(g, 0, 0, w, h, PILLAR_R);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (var y = 20; y < h; y += 48) {
        g.beginPath(); g.arc(w / 2, y, 16, 0, 6.2832); g.fill();
      }
      g.restore();
    }
    g.fillStyle = color.dark;
    U.roundRect(g, 0, capAtTop ? 0 : h - CAP_H, w, CAP_H, 7);
    g.fill();
    g.fillStyle = color.accent;
    g.fillRect(6, capAtTop ? CAP_H - 5 : h - CAP_H + 2, w - 12, 3);
  }

  function buildPillars(ratio) {
    var img = BD.Assets.images.mia;
    var h = C.OBSTACLE.h, w = C.OBSTACLE.w;

    Sprites.bottleW = w;
    Sprites.bottleH = h;

    Sprites.bottles = [];
    var colors = C.OBSTACLE.colors;
    for (var i = 0; i < colors.length; i++) {
      var up = makeCanvas(w, h, ratio);
      drawPillar(up.g, w, h, colors[i], img, true);

      var down = makeCanvas(w, h, ratio);
      drawPillar(down.g, w, h, colors[i], img, false);
      Sprites.bottles.push({ up: up.c, down: down.c });
    }

    // Collision mask: 1 canvas pixel = 1 logical unit.
    var m = makeCanvas(w, h, 1);
    drawPillar(m.g, w, h, colors[0], img, true);
    BD.Collision.setBottleProfile(m.c, w, h);
  }

  /* ---------------- character (player) ---------------- */
  var HEAD_BOX = 72;

  function drawHead(g) {
    var cx = HEAD_BOX / 2, cy = HEAD_BOX / 2 + 2;

    // ear
    g.fillStyle = '#e9a068';
    g.beginPath(); g.ellipse(cx - 27, cy + 2, 5, 7, 0, 0, 6.2832); g.fill();

    // face
    var fg = g.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, 32);
    fg.addColorStop(0, '#ffd2a2');
    fg.addColorStop(1, '#eba46c');
    g.fillStyle = fg;
    g.beginPath(); g.arc(cx, cy, 28, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(120,60,20,0.35)';
    g.lineWidth = 1.5;
    g.stroke();

    // hair
    g.fillStyle = '#2a1b17';
    g.beginPath();
    g.moveTo(cx - 28, cy - 4);
    g.bezierCurveTo(cx - 34, cy - 30, cx - 10, cy - 38, cx + 4, cy - 33);
    g.bezierCurveTo(cx + 22, cy - 36, cx + 34, cy - 20, cx + 27, cy - 6);
    g.bezierCurveTo(cx + 20, cy - 18, cx + 4, cy - 20, cx - 10, cy - 16);
    g.bezierCurveTo(cx - 20, cy - 14, cx - 26, cy - 10, cx - 28, cy - 4);
    g.closePath();
    g.fill();

    // eyes
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(cx - 9, cy - 2, 6.5, 7.5, 0, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(cx + 11, cy - 2, 6.5, 7.5, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#24140c';
    g.beginPath(); g.arc(cx - 7, cy - 1, 3.3, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(cx + 13, cy - 1, 3.3, 0, 6.2832); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx - 8, cy - 2.4, 1.1, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(cx + 12, cy - 2.4, 1.1, 0, 6.2832); g.fill();

    // brows
    g.strokeStyle = '#24140c';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 15, cy - 13); g.lineTo(cx - 4, cy - 11); g.stroke();
    g.beginPath(); g.moveTo(cx + 5, cy - 11); g.lineTo(cx + 17, cy - 13); g.stroke();

    // cheeks, nose, grin
    g.fillStyle = 'rgba(255,100,110,0.4)';
    g.beginPath(); g.ellipse(cx - 17, cy + 9, 5, 3.4, 0, 0, 6.2832); g.fill();
    g.beginPath(); g.ellipse(cx + 19, cy + 9, 5, 3.4, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#d98a55';
    g.beginPath(); g.ellipse(cx + 2, cy + 6, 3.4, 2.6, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#5a1f1a';
    g.beginPath();
    g.moveTo(cx - 10, cy + 13);
    g.quadraticCurveTo(cx + 2, cy + 27, cx + 14, cy + 13);
    g.quadraticCurveTo(cx + 2, cy + 16, cx - 10, cy + 13);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(cx - 6, cy + 14.5, 12, 3);
  }

  function buildHead(ratio) {
    var img = BD.Characters ? BD.Characters.selectedImage() : null;
    Sprites.headIsAsset = !!img;
    var w, h;
    if (img) {
      h = C.PLAYER.drawHeight;
      w = h * (img.naturalWidth / img.naturalHeight);
    } else {
      w = h = HEAD_BOX;
    }

    var s = makeCanvas(w, h, ratio);
    if (img) s.g.drawImage(img, 0, 0, w, h); else drawHead(s.g);
    Sprites.head = { img: s.c, w: w, h: h };

    var m = makeCanvas(w, h, 1);
    if (img) m.g.drawImage(img, 0, 0, w, h); else drawHead(m.g);
    BD.Collision.setHeadShape(m.c);
  }

  /* ---------------- cloud + glow ---------------- */
  function buildCloud(ratio) {
    var w = 240, h = 100;
    var c = makeCanvas(w, h, ratio);
    var blobs = [[62, 62, 34], [102, 46, 42], [148, 54, 38], [188, 66, 30], [112, 70, 36], [76, 72, 26]];
    blobs.forEach(function (b) {
      var gr = c.g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
      gr.addColorStop(0, 'rgba(196,214,255,0.5)');
      gr.addColorStop(0.6, 'rgba(176,198,250,0.22)');
      gr.addColorStop(1, 'rgba(176,198,250,0)');
      c.g.fillStyle = gr;
      c.g.beginPath(); c.g.arc(b[0], b[1], b[2], 0, 6.2832); c.g.fill();
    });
    Sprites.cloud = { img: c.c, w: w, h: h };
  }

  function buildGlow() {
    if (Sprites.glow) return;
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    Sprites.glow = c;
  }

  Sprites.build = function (ratio) {
    buildPillars(ratio);
    buildHead(ratio);
    buildCloud(ratio);
    buildGlow();
  };

  BD.Sprites = Sprites;
})(window.BD);
