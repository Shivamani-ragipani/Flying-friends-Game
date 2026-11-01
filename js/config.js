/* ==========================================================
   config.js — every tunable number lives here.
   Plain <script> files share the global BD namespace so the game
   works by double-clicking index.html (no server, no build step).
   ========================================================== */
window.BD = window.BD || {};

(function (BD) {
  'use strict';

  var CONFIG = {
    // The world is always 800 logical units tall, so vertical gameplay
    // (gravity, gaps, flap height) is IDENTICAL on every device.
    // Only the width adapts a little (370..450) to fill tall phones.
    H: 800,
    W: 450,
    MIN_W: 370,
    MAX_W: 450,
    GROUND_H: 96,
    MAX_DPR: 2,               // cap pixel ratio to keep 60 FPS on phones
    SUBSTEP: 1 / 120,         // physics/collision step: results don't depend on FPS
    MAX_DT: 0.05,

    PLAYER: {
      xFrac: 0.30,            // fixed at 30% of screen width
      startY: 0.42,           // fraction of H
      gravity: 1650,          // units / s^2
      flapVel: 490,           // upward velocity set on tap (velocity, never a teleport)
      drag: 0.35,             // velocity damping per second
      maxUp: 560,
      maxFall: 820,
      tiltUp: 25,             // degrees, nose up while rising
      tiltDown: 75,           // degrees, nose down while falling
      drawHeight: 112,        // character image draw height (full-body cutouts)
      hitInset: 0.92          // collision outline is 8% inside the art: no oversized hitbox
    },

    // Obstacle pillars are built from assets/images/mia.png: each pillar is a
    // photo-frame column with the mia cutout tiled down its length.
    OBSTACLE: {
      w: 132,
      h: 560,                 // long enough to always reach the ground / ceiling
      maxW: 150,
      edgeInset: 2,           // px trimmed from the silhouette for fair collisions
      colors: [
        { base: '#37c47a', dark: '#16764a', accent: '#ff7a59' },
        { base: '#e0993a', dark: '#8c5214', accent: '#3a78e0' },
        { base: '#4b9bff', dark: '#1f4fa8', accent: '#ffd166' }
      ]
    },

    // Gap placement rules (what a skilled player can always reach).
    COURSE: {
      topMargin: 90,
      bottomMargin: 70,
      climbRate: 220,         // units/s a player can sustainably climb with taps
      climbFactor: 0.55,      // we only ask for 55% of that
      maxDown: 330
    },

    // Difficulty keyframes by score; everything is interpolated smoothly,
    // so nothing ever jumps. 0-10 easy, 10-30 normal, 30-60 hard, 60+ very hard.
    DIFF: [
      { score: 0,   speed: 170, gap: 215, interval: 1.95 },
      { score: 10,  speed: 185, gap: 205, interval: 1.85 },
      { score: 30,  speed: 215, gap: 190, interval: 1.70 },
      { score: 60,  speed: 255, gap: 172, interval: 1.55 },
      { score: 100, speed: 290, gap: 160, interval: 1.45 }
    ],

    COUNTDOWN: { step: 0.75, go: 0.5 },
    IDLE_SPEED: 80,           // world scroll speed on the select screen

    ASSETS: {
      // mia.png is the obstacle art. Optional scene art (background.png,
      // clouds.png, buildings.png, ground.png) can be dropped into
      // assets/images/ and added to this map to replace the generated art.
      images: {
        mia: 'assets/images/mia.png'
      },
      // The one looping gameplay track (required by the design).
      audio: { music: 'assets/audio/kute-ki-muat.mp3' }
    },

    STORAGE: {
      best: 'flyingFriends.best', legacyBest: 'flyingHead.best',
      sound: 'flyingFriends.sound', legacySound: 'flyingHead.sound'
    }
  };

  var util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    // Frame-rate independent exponential smoothing.
    damp: function (cur, target, lambda, dt) {
      return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
    },
    seeded: function (seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    roundRect: function (g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
  };

  BD.CONFIG = CONFIG;
  BD.util = util;
  BD.groundY = function () { return CONFIG.H - CONFIG.GROUND_H; };
})(window.BD);
