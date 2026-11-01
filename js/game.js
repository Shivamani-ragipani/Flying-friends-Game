/* ==========================================================
   game.js — Game Logic: state machine, main loop, scoring.
   States: loading -> select -> intro -> countdown -> playing -> dying -> over
                                     ^                    \-> paused -> countdown
   Picking a friend plays their intro voice, then the run starts
   automatically. The loop is requestAnimationFrame + delta time;
   physics and collision run in fixed 1/120 s slices, so gameplay
   is identical at 30, 60 or 144 FPS.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, U = BD.util, P = C.PLAYER;
  var Physics = BD.Physics, Obstacles = BD.Obstacles, Collision = BD.Collision;
  var Particles = BD.Particles, Anim = BD.Anim, D = BD.Difficulty;

  var stage, canvas, ctx;
  var ratio = 1, lastW = 0, lastH = 0, resizePending = false;
  var state = 'loading';
  var lastTs = 0, time = 0;
  var score = 0, best = 0;
  var cd = { t: 0, idx: -1 };
  var overDelay = 0, dyingT = 0, landed = false, newBest = false;
  var bobBase = 0, bobAmp = 6;
  var runChar = null;                       // the friend flying this run
  var introTimer = 0, introToken = 0;

  var player = {
    x: 0, y: 0, vy: 0, vx: 0,
    tilt: 0, squash: 0, wing: 0, flapT: 0, dead: false
  };
  var world = { speed: C.IDLE_SPEED, clouds: 0, far: 0, near: 0, ground: 0 };
  var view = { player: player, world: world, time: 0 };

  var CD_TEXT = ['3', '2', '1', 'GO'];

  /* ---------------- sizing ---------------- */
  function resize() {
    resizePending = false;
    var vv = window.visualViewport;
    var vw = Math.max(1, document.documentElement.clientWidth || window.innerWidth);
    var vh = Math.max(1, vv ? vv.height : window.innerHeight);
    var minA = C.MIN_W / C.H, maxA = C.MAX_W / C.H;
    var a = vw / vh, w = vw, h = vh;
    if (a > maxA) w = vh * maxA;          // wide screens: centered portrait column
    else if (a < minA) h = vw / minA;     // very narrow/tall: letterbox top/bottom
    w = Math.floor(w); h = Math.floor(h);
    if (w === lastW && h === lastH && canvas.width > 0) return;
    lastW = w; lastH = h;

    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    stage.classList.toggle('framed', w < vw - 1 || h < vh - 1);
    stage.style.setProperty('--u', (h / C.H) + 'px');

    C.W = C.H * w / h;                    // height fixed, width adapts
    var dpr = Math.min(window.devicePixelRatio || 1, C.MAX_DPR);
    ratio = (h * dpr) / C.H;              // crisp: no stretched or blurry sprites
    canvas.width = Math.round(C.W * ratio);
    canvas.height = Math.round(C.H * ratio);
    rebuild();
  }

  function scheduleResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(resize);
  }

  function rebuild() {
    BD.Sprites.build(ratio);
    BD.Renderer.build(ratio);
  }

  /* ---------------- flow ---------------- */
  function resetRun() {
    Obstacles.reset();
    D.reset();
    Particles.clear();
    Anim.reset();
    score = 0; dyingT = 0; landed = false; newBest = false;
    player.x = C.W * P.xFrac;
    player.y = C.H * P.startY;
    player.vy = 0; player.vx = 0; player.tilt = 0; player.squash = 0;
    player.dead = false;
    bobBase = player.y;
    BD.UI.setScore(0, false);
  }

  function beginCountdown() {
    cd.t = 0; cd.idx = -1;
    bobBase = player.y;
    state = 'countdown';
    BD.UI.setState('countdown');
    BD.UI.show(null);
  }

  function startRun() {
    BD.Audio.unlock();
    BD.Audio.stopVoice();
    if (introTimer) { clearTimeout(introTimer); introTimer = 0; }
    runChar = BD.Characters.selected;
    resetRun();
    BD.Audio.startMusic();
    beginCountdown();
  }

  // Home = back to the character selection screen; the previous pick
  // is forgotten so another friend can be chosen.
  function toSelect() {
    BD.Audio.stopMusic();
    BD.Audio.stopVoice();
    if (introTimer) { clearTimeout(introTimer); introTimer = 0; }
    introToken++;
    BD.Characters.clear();
    resetRun();
    state = 'select';
    BD.UI.setState('select');
    BD.UI.clearCountdown();
    BD.UI.clearSelection();
    BD.UI.show('select');
  }

  // A card was tapped: remember the friend, re-skin the player, play
  // their intro voice, and start the game the moment it finishes.
  function selectCharacter(ch) {
    BD.Audio.unlock();
    if (BD.Characters.select(ch.id)) {
      rebuild();                            // player sprite becomes this friend
      BD.UI.markSelected(ch.id);
    }
    resetRun();
    state = 'intro';
    BD.UI.setState('intro');
    BD.UI.show('select');
    startIntro(ch);
  }

  function startIntro(ch) {
    var token = ++introToken;
    if (introTimer) { clearTimeout(introTimer); introTimer = 0; }

    // Muted or missing clip: no silent waiting — start almost immediately.
    var el = BD.Audio.isEnabled() ? BD.Audio.playIntro(ch) : null;
    var waitMs = 500;
    if (el && isFinite(el.duration) && el.duration > 0) waitMs = el.duration * 1000 + 250;
    else if (el && ch.introDur) waitMs = ch.introDur * 1000 + 250;

    function finish() {
      if (state !== 'intro' || token !== introToken) return;
      startRun();
    }

    introTimer = setTimeout(function () {
      introTimer = 0;
      if (el) el.removeEventListener('ended', onEnded);
      finish();
    }, waitMs);
    if (el) el.addEventListener('ended', function onEnded() {
      el.removeEventListener('ended', onEnded);
      if (introTimer) { clearTimeout(introTimer); introTimer = 0; }
      finish();
    });
  }

  function pause() {
    if (state !== 'playing' && state !== 'countdown') return;
    state = 'paused';
    BD.UI.setState('paused');
    BD.UI.clearCountdown();
    BD.UI.show('pause');
    BD.Audio.suspend();
  }

  function resume() {
    if (state !== 'paused') return;
    BD.Audio.resume();
    beginCountdown();                     // 3-2-1-GO before play continues
  }

  function onTap(source) {
    if (state === 'playing') { flap(); return; }
    if (source !== 'key') return;         // only Space/Enter drive menus; taps never skip a screen
    if (state === 'over' && overDelay <= 0) startRun();
    else if (state === 'paused') resume();
  }

  function flap() {
    Physics.flap(player);
    player.squash = 0.16;
    player.flapT = 0.25;
    Particles.tapBurst(player.x - 20, player.y + 6);
    BD.Audio.tap();
  }

  function toggleSound() {
    BD.Audio.unlock();
    BD.Audio.setEnabled(!BD.Audio.isEnabled());
    BD.UI.setSound(BD.Audio.isEnabled());
  }

  /* ---------------- update ---------------- */
  function hoverPlayer(dt, bobTarget) {
    bobAmp = U.damp(bobAmp, bobTarget, 10, dt);
    player.y = bobBase + Math.sin(time * 3) * bobAmp;
    player.vy = 0;
    player.tilt = U.damp(player.tilt, 0, 8, dt);
  }

  function updateCountdown(dt) {
    cd.t += dt;
    var step = C.COUNTDOWN.step;
    var idx = cd.t < step * 3 ? Math.floor(cd.t / step) : 3;
    if (idx !== cd.idx) {
      cd.idx = idx;
      BD.UI.countdown(CD_TEXT[idx]);
    }
    hoverPlayer(dt, idx < 3 ? 6 : 0);
    if (cd.t >= step * 3 + C.COUNTDOWN.go) {
      BD.UI.clearCountdown();
      state = 'playing';
      BD.UI.setState('playing');
    }
  }

  function updatePlaying(dt) {
    D.update(score, dt);
    var speed = D.cur.speed;
    world.speed = speed;

    // Fixed-size slices: identical results regardless of frame rate.
    var n = Math.ceil(dt / C.SUBSTEP), sub = dt / n;
    var angle = -player.tilt * Math.PI / 180;
    var gy = BD.groundY();
    var ceilY = Collision.headRadius();
    for (var i = 0; i < n; i++) {
      Physics.step(player, sub);
      if (player.y < ceilY) { player.y = ceilY; if (player.vy < 0) player.vy = 0; }
      Obstacles.move(sub, speed);
      var hit = Collision.check(player.x, player.y, angle, Obstacles.pool, gy);
      if (hit) { onHit(hit); return; }
    }
    Obstacles.spawn(D.cur);

    // score: a pair counts once its right edge is behind the head
    var pool = Obstacles.pool, half = BD.Sprites.bottleW / 2;
    for (var j = 0; j < pool.length; j++) {
      var o = pool[j];
      if (o.active && !o.scored && o.x + half < player.x) {
        o.scored = true;
        score++;
        BD.UI.setScore(score, true);
        BD.Audio.score();
        Particles.scoreSpark(player.x + 24, player.y);
      }
    }

    Physics.updateTilt(player, dt);
    player.squash = U.damp(player.squash, 0, 14, dt);
    player.flapT = Math.max(0, player.flapT - dt);
    scrollWorld(dt);
  }

  function scrollWorld(dt) {
    var s = world.speed;
    world.clouds += s * 0.12 * dt;
    world.far += s * 0.30 * dt;
    world.near += s * 0.55 * dt;
    world.ground += s * dt;                // ground matches pillar speed exactly
  }

  function onHit(kind) {
    state = 'dying';
    BD.UI.setState('dying');
    player.dead = true;
    dyingT = 0; landed = false;
    if (kind === 1) { player.vy = -180; player.vx = -90; }   // bonk off the pillar
    else { player.vy = 0; player.vx = 0; }
    Anim.hit();
    Particles.impact(player.x, player.y);
    BD.Audio.hit();
    BD.Audio.stopMusic();                  // gameplay music dies with the run

    newBest = score > best;
    if (newBest) {
      best = score;
      BD.Save.setBest(best);
      BD.UI.setBest(best);
    }
  }

  function updateDying(dt) {
    dyingT += dt;
    world.speed = U.damp(world.speed, 0, 7, dt);
    scrollWorld(dt);

    var n = Math.ceil(dt / C.SUBSTEP), sub = dt / n;
    var r = Collision.headRadius(), gy = BD.groundY();
    for (var i = 0; i < n; i++) {
      Physics.step(player, sub);
      player.x += player.vx * sub;
      if (player.y + r >= gy) {
        player.y = gy - r;
        if (!landed) { landed = true; dyingT = Math.max(dyingT, 0.2); }
        player.vy = player.vy > 160 ? -player.vy * 0.28 : 0;
        player.vx *= 0.6;
      }
    }
    player.vx = U.damp(player.vx, 0, 3, dt);
    player.tilt = U.damp(player.tilt, -P.tiltDown, 6, dt);
    player.squash = U.damp(player.squash, 0, 10, dt);

    if (state === 'dying' && ((landed && dyingT > 0.65) || dyingT > 1.6)) {
      state = 'over';
      overDelay = 0.45;
      BD.UI.setState('over');
      BD.UI.showGameOver(score, best, newBest, BD.Roasts.next(), runChar);
      BD.Audio.playFail(runChar);          // this friend's own failure audio
    }
  }

  function update(dt) {
    if (state === 'paused' || state === 'loading') return;   // frozen
    time += dt;
    Anim.update(dt);
    Particles.update(dt, world.speed);
    player.wing = Math.sin(time * (player.flapT > 0 ? 34 : 9)) * (player.flapT > 0 ? 1 : 0.35);
    if (overDelay > 0) overDelay -= dt;
    if (state !== 'dying' && state !== 'over') player.x = C.W * P.xFrac;   // stays at 30% even after a resize

    if (state === 'select' || state === 'intro') {
      world.speed = U.damp(world.speed, C.IDLE_SPEED, 4, dt);
      scrollWorld(dt);
      hoverPlayer(dt, 8);
    } else if (state === 'countdown') {
      world.speed = U.damp(world.speed, D.cur.speed * 0.7, 4, dt);
      scrollWorld(dt);
      updateCountdown(dt);
    } else if (state === 'playing') {
      updatePlaying(dt);
    } else {
      updateDying(dt);                     // dying + over keep settling visually
    }
  }

  /* ---------------- loop ---------------- */
  function loop(ts) {
    var dt = lastTs ? (ts - lastTs) / 1000 : 1 / 60;
    lastTs = ts;
    if (dt > C.MAX_DT) dt = C.MAX_DT;      // tab switches never cause a giant step
    if (dt <= 0) dt = 0.001;
    update(dt);
    view.time = time;
    if (state !== 'loading') BD.Renderer.draw(ctx, view);
    requestAnimationFrame(loop);
  }

  /* ---------------- public ---------------- */
  var Game = {
    init: function () {
      stage = document.getElementById('stage');
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d', { alpha: false });

      best = BD.Save.getBest();
      BD.UI.init({
        onPick: selectCharacter,
        onRestart: startRun, onResume: resume,
        onHome: toSelect, onPause: pause, onToggleSound: toggleSound
      });
      BD.UI.setBest(best);
      BD.UI.setSound(BD.Audio.isEnabled());
      BD.Input.attach(stage, { onTap: onTap, onPause: function () { if (state === 'paused') resume(); else pause(); } });

      resize();
      resetRun();
      window.addEventListener('resize', scheduleResize);
      window.addEventListener('orientationchange', scheduleResize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);
      document.addEventListener('visibilitychange', function () {
        lastTs = 0;
        if (document.hidden) pause();      // auto-pause when the tab/app is hidden
      });
      window.addEventListener('blur', function () { pause(); });

      requestAnimationFrame(loop);
    },

    // Called once images + audio clips have finished loading.
    ready: function () {
      rebuild();                           // pick up the real character / mia art
      resetRun();
      state = 'select';
      BD.UI.setState('select');
      BD.UI.buildCards(BD.Characters.list, selectCharacter);
      BD.UI.show('select');
    },

    _debug: {
      get state() { return state; },
      get score() { return score; },
      get best() { return best; },
      get character() { return runChar && runChar.id; },
      get player() { return player; },
      get world() { return world; },
      pause: pause, resume: resume, resize: resize, startRun: startRun, toSelect: toSelect,
      selectCharacter: selectCharacter, flap: flap, update: update
    }
  };

  BD.Game = Game;
})(window.BD);
