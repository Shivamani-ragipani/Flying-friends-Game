/* ==========================================================
   audio.js — audio management for Flying Friends.
   - One gameplay music track (kute-ki-muat.mp3) loops seamlessly
     and only ever exists as a single element.
   - Every character has their own intro + failure voice clip; only
     one voice plays at a time, and gameplay music stops on Game Over.
   - Tap / score / hit SFX are synthesized with WebAudio (no files
     needed). Mute preference is remembered and respected everywhere.
   ========================================================== */
(function (BD) {
  'use strict';

  var CONFIG = BD.CONFIG;
  var ctx = null, master = null;
  var enabled = BD.Save.isSoundOn();
  var music = null, musicWanted = false;
  var voice = null;                          // the single intro/fail clip playing
  var MUSIC_VOL = 0.4, VOICE_VOL = 0.95;
  var SFX_VOL = { tap: 0.45, score: 0.55, hit: 0.7 };

  /* ---------- file loading ---------- */
  function tryAudio(src, timeout) {
    return new Promise(function (resolve) {
      var a = new Audio(), done = false, failed = false;
      function finish(v) { if (done) return; done = true; clearTimeout(t); resolve(v); }
      var t = setTimeout(function () { finish(failed ? null : a); }, timeout || 4000);
      a.preload = 'auto';
      a.addEventListener('canplaythrough', function () { finish(a); }, { once: true });
      a.addEventListener('loadeddata', function () { finish(a); }, { once: true });
      a.addEventListener('error', function () { failed = true; finish(null); }, { once: true });
      a.src = src;
      try { a.load(); } catch (e) { finish(null); }
    });
  }

  // Used by the Character Manager to preload per-character voice clips.
  function loadClip(src) { return tryAudio(src, 8000); }

  function load() {
    return loadClip(CONFIG.ASSETS.audio.music).then(function (a) {
      music = a;
      if (music) {
        music.loop = true;                    // seamless looping gameplay track
        music.volume = MUSIC_VOL;
      }
    });
  }

  /* ---------- WebAudio (synth SFX) ---------- */
  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone(freq, endFreq, dur, vol, type, when) {
    if (!ctx) return;
    var t0 = when || ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, fStart, fEnd) {
    if (!ctx) return;
    var t0 = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(fStart, t0);
    f.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  function sfx(name, synth) {
    if (!enabled) return;
    if (!ensureCtx()) return;
    synth();
  }

  function tap() {
    sfx('tap', function () {
      tone(330, 700, 0.09, 0.08, 'sine');
      tone(660, 1100, 0.06, 0.025, 'triangle');
    });
  }
  function score() {
    sfx('score', function () {
      var t = ctx.currentTime;
      tone(880, 0, 0.1, 0.08, 'sine', t);
      tone(1320, 0, 0.16, 0.07, 'sine', t + 0.08);
    });
  }
  function hit() {
    sfx('hit', function () {
      noise(0.4, 0.38, 5000, 260);
      tone(170, 42, 0.3, 0.36, 'sine');
      var t = ctx.currentTime;
      tone(2400, 1800, 0.16, 0.035, 'triangle', t + 0.02);
      tone(3000, 2100, 0.14, 0.028, 'triangle', t + 0.07);
    });
  }
  // Synth fallback: only used when a character has no failure clip.
  function gameover() {
    sfx('gameover', function () {
      var t = ctx.currentTime, n = [440, 392, 330, 262];
      for (var i = 0; i < n.length; i++) tone(n[i], n[i] * 0.97, 0.22, 0.07, 'triangle', t + i * 0.15);
    });
  }

  /* ---------- gameplay music (kute-ki-muat.mp3) ---------- */
  function startMusic() {
    musicWanted = true;
    if (!enabled || !music) return;
    music.volume = MUSIC_VOL;
    try { var p = music.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }

  function stopMusic() {
    musicWanted = false;
    if (!music) return;
    try { music.pause(); music.currentTime = 0; } catch (e) { /* ignore */ }
  }

  // Pause screen: music pauses in place, resumes exactly where it was.
  function suspend() {
    if (music && !music.paused) { try { music.pause(); } catch (e) { /* ignore */ } }
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (musicWanted && enabled && music) {
      try { var p = music.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- character voice clips (intro / failure) ---------- */
  function stopVoice() {
    if (!voice) return;
    try { voice.pause(); voice.currentTime = 0; } catch (e) { /* ignore */ }
    voice = null;
  }

  // Plays one clip as THE voice channel: never overlaps anything else.
  function playClip(clip) {
    stopVoice();
    if (!clip || !enabled) return null;
    voice = clip;
    try { clip.currentTime = 0; } catch (e) { /* ignore */ }
    clip.volume = VOICE_VOL;
    try { var p = clip.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    return clip;
  }

  function playIntro(ch) { return playClip(ch.introClip); }

  function playFail(ch) {
    var played = playClip(ch && ch.failClip);
    if (!played) gameover();                 // graceful synth fallback
    return played;
  }

  function setEnabled(on) {
    enabled = !!on;
    BD.Save.setSound(enabled);
    if (master) {
      master.gain.cancelScheduledValues(0);
      master.gain.setValueAtTime(enabled ? 0.8 : 0, ctx.currentTime);
    }
    if (!enabled) {
      // Mute mid-intro: silence the voice but keep it "playing" so the
      // ended event still fires and the flow continues.
      if (voice) voice.volume = 0;
      if (music) { try { music.pause(); } catch (e) { /* ignore */ } }
    } else {
      if (voice) voice.volume = VOICE_VOL;
      if (musicWanted && music) {
        try { var p = music.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
      }
    }
  }

  BD.Audio = {
    load: load, loadClip: loadClip, unlock: unlock,
    tap: tap, score: score, hit: hit,
    playIntro: playIntro, playFail: playFail, stopVoice: stopVoice,
    gameover: gameover,
    startMusic: startMusic, stopMusic: stopMusic, suspend: suspend, resume: resume,
    setEnabled: setEnabled, isEnabled: function () { return enabled; },
    _debug: {
      get musicPlaying() { return !!(music && !music.paused && music.currentTime > 0); },
      get musicSrc() { return music ? (music.currentSrc || music.src || '') : ''; },
      get voiceSrc() { return voice ? (voice.currentSrc || voice.src || '') : ''; },
      get muted() { return !enabled; }
    }
  };
})(window.BD);
