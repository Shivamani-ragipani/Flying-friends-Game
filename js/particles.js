/* ==========================================================
   particles.js — tap puffs, collision impact, floating ambient motes.
   Fixed-size typed-array pools: nothing is allocated while playing,
   so there are no garbage-collection hiccups.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, U = BD.util;

  var N = 320;
  var X = new Float32Array(N), Y = new Float32Array(N);
  var VX = new Float32Array(N), VY = new Float32Array(N);
  var LIFE = new Float32Array(N), MAXL = new Float32Array(N);
  var SIZE = new Float32Array(N), ROT = new Float32Array(N), VR = new Float32Array(N);
  var G = new Float32Array(N), DRAG = new Float32Array(N);
  var KIND = new Uint8Array(N), COL = new Uint8Array(N);
  var cursor = 0;

  var PALETTE = ['#ffffff', '#ffd166', '#ff6f91', '#6fe3ff', '#8cff9e', '#b28cff', '#ff9f5a', '#cfe0ff'];
  var KIND_DOT = 0, KIND_RECT = 1, KIND_SHARD = 2, KIND_SPARK = 3;

  function emit(kind, x, y, vx, vy, life, size, g, drag, col) {
    var i = cursor;
    cursor = (cursor + 1) % N;       // ring buffer: oldest particle gets reused
    X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;
    LIFE[i] = MAXL[i] = life; SIZE[i] = size;
    ROT[i] = Math.random() * 6.28; VR[i] = (Math.random() - 0.5) * 24;
    G[i] = g; DRAG[i] = drag; KIND[i] = kind; COL[i] = col;
  }

  // ---- ambient floating motes (fixed set, wrap around) ----
  var AN = 34;
  var AX = new Float32Array(AN), AY = new Float32Array(AN), AS = new Float32Array(AN);
  var AA = new Float32Array(AN), AP = new Float32Array(AN), AV = new Float32Array(AN);
  var aTime = 0;

  function initAmbient() {
    for (var i = 0; i < AN; i++) {
      AX[i] = Math.random() * C.W;
      AY[i] = Math.random() * BD.groundY();
      AS[i] = U.rand(2, 5.5);
      AA[i] = U.rand(0.12, 0.4);
      AP[i] = U.rand(0, 6.28);
      AV[i] = U.rand(0.25, 0.8);     // parallax factor vs. world speed
    }
  }

  var Particles = {
    initAmbient: initAmbient,

    // Small puff behind the head on every tap.
    tapBurst: function (x, y) {
      for (var i = 0; i < 7; i++) {
        emit(KIND_DOT, x + U.rand(-4, 4), y + U.rand(-4, 8),
          -U.rand(50, 170), U.rand(-30, 130), U.rand(0.3, 0.55), U.rand(2.5, 5.5), 0, 3.2,
          i % 3 === 0 ? 3 : 0);
      }
    },

    // Big burst on collision.
    impact: function (x, y, glass) {
      var i, a, s;
      for (i = 0; i < 44; i++) {
        a = Math.random() * 6.283; s = U.rand(0.3, 1) * 470;
        emit(KIND_RECT, x, y, Math.cos(a) * s, Math.sin(a) * s - 80, U.rand(0.8, 1.5),
          U.rand(4, 8.5), 820, 1.6, 1 + ((Math.random() * (PALETTE.length - 1)) | 0));
      }
      for (i = 0; i < 14; i++) {
        a = Math.random() * 6.283; s = U.rand(130, 400);
        emit(KIND_SHARD, x, y, Math.cos(a) * s, Math.sin(a) * s - 60, U.rand(0.6, 1.1),
          U.rand(3, 7), 1300, 0.6, 4);
      }
      for (i = 0; i < 8; i++) {
        a = Math.random() * 6.283; s = U.rand(0.2, 1) * 260;
        emit(KIND_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.25, 0.55),
          U.rand(7, 15), 0, 4, 0);
      }
    },

    // Tiny glow when a bottle is passed.
    scoreSpark: function (x, y) {
      for (var i = 0; i < 4; i++) {
        var a = Math.random() * 6.283, s = U.rand(40, 120);
        emit(KIND_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.25, 0.45), U.rand(6, 11), 0, 4, 0);
      }
    },

    update: function (dt, worldSpeed) {
      for (var i = 0; i < N; i++) {
        if (LIFE[i] <= 0) continue;
        LIFE[i] -= dt;
        var k = Math.exp(-DRAG[i] * dt);
        VX[i] *= k;
        VY[i] = (VY[i] + G[i] * dt) * k;
        X[i] += VX[i] * dt;
        Y[i] += VY[i] * dt;
        ROT[i] += VR[i] * dt;
      }
      aTime += dt;
      var W = C.W;
      for (var j = 0; j < AN; j++) {
        AX[j] -= worldSpeed * AV[j] * 0.5 * dt;
        if (AX[j] < -10) { AX[j] = W + 10; AY[j] = Math.random() * BD.groundY(); }
      }
    },

    clear: function () { for (var i = 0; i < N; i++) LIFE[i] = 0; },

    drawAmbient: function (ctx) {
      var glow = BD.Sprites.glow;
      if (!glow) return;
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < AN; i++) {
        var y = AY[i] + Math.sin(aTime * AV[i] * 2 + AP[i]) * 6;
        ctx.globalAlpha = AA[i];
        ctx.drawImage(glow, AX[i] - AS[i], y - AS[i], AS[i] * 2, AS[i] * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },

    draw: function (ctx) {
      var glow = BD.Sprites.glow;
      for (var i = 0; i < N; i++) {
        var life = LIFE[i];
        if (life <= 0) continue;
        var alpha = Math.min(1, life / (MAXL[i] * 0.4));
        var kind = KIND[i], s = SIZE[i];

        if (kind === KIND_SPARK) {
          if (!glow) continue;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * 0.9;
          ctx.drawImage(glow, X[i] - s, Y[i] - s, s * 2, s * 2);
          ctx.globalCompositeOperation = 'source-over';
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = PALETTE[COL[i]];
        if (kind === KIND_DOT) {
          ctx.beginPath();
          ctx.arc(X[i], Y[i], s * (0.5 + 0.5 * alpha), 0, 6.2832);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(X[i], Y[i]);
          ctx.rotate(ROT[i]);
          if (kind === KIND_RECT) {
            ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
          } else {
            ctx.beginPath();
            ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s, 0); ctx.lineTo(-s * 0.3, s * 0.7);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
  };

  BD.Particles = Particles;
})(window.BD);
