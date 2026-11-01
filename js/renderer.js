/* ==========================================================
   renderer.js — draws the whole scene.
   Parallax: clouds slowest, buildings medium, ground fastest
   (ground moves exactly as fast as the bottles).
   Static layers are pre-rendered; nothing is allocated per frame.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, U = BD.util;
  var ratio = 1;
  var sky = null, farTile = null, nearTile = null, groundTile = null;
  var FAR_W = 480, FAR_H = 190, NEAR_W = 420, NEAR_H = 120, GROUND_W = 120;
  var STAR_N = 70, stars = new Float32Array(STAR_N * 4);
  var CLOUD_N = 7, cloudX = new Float32Array(CLOUD_N), cloudY = new Float32Array(CLOUD_N);
  var cloudS = new Float32Array(CLOUD_N), cloudA = new Float32Array(CLOUD_N), cloudP = new Float32Array(CLOUD_N);
  var t = 0;

  function mk(w, h, r) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * r); c.height = Math.ceil(h * r);
    var g = c.getContext('2d');
    g.scale(c.width / w, c.height / h);
    return { c: c, g: g };
  }

  /* ---------------- procedural layers ---------------- */
  function buildSky(g) {
    var W = C.W, H = C.H;
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#050920');
    gr.addColorStop(0.5, '#0d1b45');
    gr.addColorStop(1, '#1d2d68');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    var mx = W * 0.8, my = 130;
    var halo = g.createRadialGradient(mx, my, 6, mx, my, 74);
    halo.addColorStop(0, 'rgba(210,225,255,0.3)');
    halo.addColorStop(1, 'rgba(210,225,255,0)');
    g.fillStyle = halo;
    g.fillRect(mx - 80, my - 80, 160, 160);
    g.fillStyle = '#e9efff';
    g.beginPath(); g.arc(mx, my, 17, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(160,178,225,0.35)';
    g.beginPath(); g.arc(mx - 5, my - 3, 4, 0, 6.2832); g.fill();
    g.beginPath(); g.arc(mx + 6, my + 5, 3, 0, 6.2832); g.fill();
  }

  // Seamless skyline strip: buildings fill exactly tw, so tiling has no seam.
  function buildStrip(tw, h, o, seed) {
    var m = mk(tw, h, ratio), g = m.g, rnd = U.seeded(seed);
    var x = 0;
    while (x < tw - 0.5) {
      var w = o.minW + rnd() * (o.maxW - o.minW);
      if (tw - x - w < o.minW) w = tw - x;
      var bh = o.minH + rnd() * (o.maxH - o.minH);
      g.fillStyle = o.color;
      g.fillRect(x, h - bh, w, bh);
      var r = rnd();
      if (r < 0.25) g.fillRect(x + w * 0.4, h - bh - 12, 2, 12);
      else if (r < 0.45) g.fillRect(x + 4, h - bh - 6, w - 8, 6);
      for (var wy = h - bh + 8; wy < h - 10; wy += 12) {
        for (var wx = x + 5; wx < x + w - 7; wx += 9) {
          if (rnd() < o.lit) { g.fillStyle = o.win; g.fillRect(wx, wy, 4, 6); }
        }
      }
      x += w;
    }
    return m.c;
  }

  function buildGroundTile() {
    var h = C.GROUND_H, m = mk(GROUND_W, h, ratio), g = m.g, rnd = U.seeded(5);
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#142046');
    gr.addColorStop(1, '#070c1c');
    g.fillStyle = gr;
    g.fillRect(0, 0, GROUND_W, h);
    g.fillStyle = '#2b3b72';                      // sidewalk / curb
    g.fillRect(0, 0, GROUND_W, 12);
    g.fillStyle = 'rgba(150,185,255,0.5)';
    g.fillRect(0, 0, GROUND_W, 2);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 12, GROUND_W, 3);
    g.fillStyle = 'rgba(241,226,168,0.8)';        // lane dash
    g.fillRect(20, 54, 62, 6);
    for (var i = 0; i < 26; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.03 + rnd() * 0.05) + ')';
      g.fillRect(rnd() * GROUND_W, 18 + rnd() * (h - 20), 2, 2);
    }
    return m.c;
  }

  function initStars() {
    var rnd = U.seeded(99), maxY = BD.groundY() * 0.7;
    for (var i = 0; i < STAR_N; i++) {
      stars[i * 4] = rnd() * C.W; stars[i * 4 + 1] = rnd() * maxY;
      stars[i * 4 + 2] = 0.8 + rnd() * 1.3;            // size
      stars[i * 4 + 3] = rnd() * 6.28;                 // phase
    }
  }

  function initClouds() {
    for (var i = 0; i < CLOUD_N; i++) {
      cloudX[i] = U.rand(0, C.W + 400);
      cloudY[i] = U.rand(0.06, 0.52) * C.H;
      cloudS[i] = U.rand(0.6, 1.25);
      cloudA[i] = U.rand(0.35, 0.8);
      cloudP[i] = U.rand(0.8, 1.2);                    // parallax variation
    }
  }

  /* ---------------- image (user art) layers ---------------- */
  function tileImage(ctx, img, off, y, h) {
    var tw = h * (img.naturalWidth / img.naturalHeight);
    var x = -(off % tw);
    if (x > 0) x -= tw;
    for (; x < C.W; x += tw) ctx.drawImage(img, x, y, tw + 1, h);
  }

  function tileCanvas(ctx, tile, tw, off, y, h) {
    var x = -(off % tw);
    if (x > 0) x -= tw;
    for (; x < C.W; x += tw) ctx.drawImage(tile, x, y, tw + 1, h);
  }

  /* ---------------- public ---------------- */
  var Renderer = {
    build: function (r) {
      ratio = r;
      var s = mk(C.W, C.H, r);
      buildSky(s.g);
      sky = s.c;
      farTile = buildStrip(FAR_W, FAR_H, { color: '#15264f', win: 'rgba(255,214,120,0.3)', lit: 0.16, minW: 28, maxW: 56, minH: 60, maxH: 170 }, 11);
      nearTile = buildStrip(NEAR_W, NEAR_H, { color: '#0a1431', win: 'rgba(255,226,150,0.75)', lit: 0.22, minW: 26, maxW: 50, minH: 36, maxH: 112 }, 23);
      groundTile = buildGroundTile();
      initStars();
      initClouds();
      BD.Particles.initAmbient();
    },

    drawBackground: function (ctx, world, time) {
      var W = C.W, H = C.H, gy = BD.groundY(), img = BD.Assets.images, i;
      t = time;

      if (img.background) {
        var s = Math.max(W / img.background.naturalWidth, H / img.background.naturalHeight);
        var dw = img.background.naturalWidth * s, dh = img.background.naturalHeight * s;
        ctx.drawImage(img.background, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        ctx.drawImage(sky, 0, 0, W, H);
        ctx.fillStyle = '#dfe8ff';
        for (i = 0; i < STAR_N; i++) {
          ctx.globalAlpha = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + stars[i * 4 + 3]));
          ctx.fillRect(stars[i * 4], stars[i * 4 + 1], stars[i * 4 + 2], stars[i * 4 + 2]);
        }
        ctx.globalAlpha = 1;
      }

      // clouds (slowest layer)
      if (img.clouds) {
        tileImage(ctx, img.clouds, world.clouds, H * 0.05, 240);
      } else {
        var cs = BD.Sprites.cloud, span = W + 480;
        for (i = 0; i < CLOUD_N; i++) {
          var x = (((cloudX[i] - world.clouds * cloudP[i]) % span) + span) % span - 240;
          ctx.globalAlpha = cloudA[i];
          ctx.drawImage(cs.img, x, cloudY[i], cs.w * cloudS[i], cs.h * cloudS[i]);
        }
        ctx.globalAlpha = 1;
      }

      // buildings (medium speed)
      if (img.buildings) {
        tileImage(ctx, img.buildings, world.far, gy - 230, 230);
      } else {
        tileCanvas(ctx, farTile, FAR_W, world.far, gy - FAR_H, FAR_H);
        tileCanvas(ctx, nearTile, NEAR_W, world.near, gy - NEAR_H, NEAR_H);
      }
    },

    drawBottles: function (ctx, pool) {
      var S = BD.Sprites, bw = S.bottleW, bh = S.bottleH;
      for (var i = 0; i < pool.length; i++) {
        var o = pool[i];
        if (!o.active) continue;
        var sp = S.bottles[o.variant % S.bottles.length];
        var x = o.x - bw / 2;
        ctx.drawImage(sp.down, x, o.gapT - bh, bw, bh);   // hanging, tip down
        ctx.drawImage(sp.up, x, o.gapB, bw, bh);          // standing, tip up
      }
    },

    drawGround: function (ctx, world) {
      var gy = BD.groundY(), img = BD.Assets.images.ground;
      if (img) tileImage(ctx, img, world.ground, gy, C.GROUND_H);
      else tileCanvas(ctx, groundTile, GROUND_W, world.ground, gy, C.GROUND_H);
    },

    drawPlayer: function (ctx, p, time) {
      var hd = BD.Sprites.head;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-p.tilt * Math.PI / 180);             // +tilt = nose up
      ctx.scale(1 + p.squash, 1 - p.squash);

      if (!BD.Sprites.headIsAsset) {                    // little wings on the generated head
        var flap = p.wing;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = 'rgba(150,170,220,0.9)';
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(-20, -2);
        ctx.rotate(-0.5 + flap * 1.1);
        ctx.beginPath(); ctx.ellipse(-14, 0, 17, 7, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.drawImage(hd.img, -hd.w / 2, -hd.h / 2, hd.w, hd.h);
      ctx.restore();
    },

    draw: function (ctx, v) {
      var W = C.W, H = C.H, A = BD.Anim;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#0b1636';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (A.shake > 0 || A.zoom !== 1) {
        var sx = A.shake > 0 ? (Math.random() * 2 - 1) * A.shake : 0;
        var sy = A.shake > 0 ? (Math.random() * 2 - 1) * A.shake : 0;
        ctx.translate(W / 2 + sx, H / 2 + sy);
        ctx.scale(A.zoom, A.zoom);
        ctx.translate(-W / 2, -H / 2);
      }
      Renderer.drawBackground(ctx, v.world, v.time);
      Renderer.drawBottles(ctx, BD.Obstacles.pool);
      Renderer.drawGround(ctx, v.world);
      BD.Particles.drawAmbient(ctx);
      Renderer.drawPlayer(ctx, v.player, v.time);
      BD.Particles.draw(ctx);
      ctx.restore();

      if (A.flash > 0) {
        ctx.globalAlpha = A.flash * 0.35;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
  };

  BD.Renderer = Renderer;
})(window.BD);
