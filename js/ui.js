/* ==========================================================
   ui.js — UI: score, best, sound/pause buttons, countdown and
   the character-select / pause / game-over overlays (DOM).
   ========================================================== */
(function (BD) {
  'use strict';

  var el = {};
  var OVERLAYS = ['loading', 'select', 'pause', 'gameover'];

  function $(id) { return document.getElementById(id); }

  function bind(btn, fn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      btn.blur();                 // Space/Enter must never re-trigger a focused button
      fn();
    });
  }

  var UI = {
    init: function (h) {
      el.stage = $('stage');
      el.score = $('score');
      el.best = $('best');
      el.menuBest = $('menuBest');
      el.soundBtn = $('soundBtn');
      el.countdown = $('countdown');
      el.finalScore = $('finalScore');
      el.finalBest = $('finalBest');
      el.newBest = $('newBest');
      el.roast = $('roast');
      el.goChar = $('goChar');
      el.cards = $('cards');
      OVERLAYS.forEach(function (n) { el[n] = $(n); });

      bind($('resumeBtn'), h.onResume);
      bind($('pauseHomeBtn'), h.onHome);
      bind($('restartBtn'), h.onRestart);
      bind($('homeBtn'), h.onHome);
      bind($('pauseBtn'), h.onPause);
      bind(el.soundBtn, h.onToggleSound);
      this.handlers = h;
    },

    // Build one animated card per character (image + name).
    buildCards: function (characters, onPick) {
      el.cards.innerHTML = '';
      characters.forEach(function (ch, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'card';
        b.dataset.id = ch.id;
        b.setAttribute('aria-label', 'Choose ' + ch.name);
        b.style.animationDelay = (0.12 + i * 0.07) + 's';

        var img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        if (ch.img) img.src = ch.img.src;
        else b.classList.add('noimg');

        var name = document.createElement('span');
        name.className = 'card-name';
        name.textContent = ch.name;

        b.appendChild(img);
        b.appendChild(name);
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          b.blur();
          b.classList.remove('picked');      // restart the tap animation
          void b.offsetWidth;
          b.classList.add('picked');
          onPick(ch);
        });
        el.cards.appendChild(b);
      });
    },

    markSelected: function (id) {
      Array.prototype.forEach.call(el.cards.children, function (card) {
        card.classList.toggle('active', card.dataset.id === id);
      });
    },

    clearSelection: function () {
      Array.prototype.forEach.call(el.cards.children, function (card) {
        card.classList.remove('active');
      });
    },

    // state drives HUD visibility in CSS
    setState: function (s) { el.stage.setAttribute('data-state', s); },

    show: function (name) {
      OVERLAYS.forEach(function (n) { el[n].classList.toggle('hidden', n !== name); });
    },

    setScore: function (n, pulse) {
      el.score.textContent = n;
      if (pulse) {
        el.score.classList.remove('pop');
        void el.score.offsetWidth;       // restart the CSS animation
        el.score.classList.add('pop');
      }
    },

    setBest: function (n) {
      el.best.textContent = 'BEST ' + n;
      el.menuBest.textContent = n;
    },

    setSound: function (on) {
      el.soundBtn.classList.toggle('off', !on);
      el.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      el.soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    },

    countdown: function (text) {
      el.countdown.textContent = text;
      el.countdown.classList.remove('show');
      void el.countdown.offsetWidth;
      el.countdown.classList.add('show');
    },

    clearCountdown: function () {
      el.countdown.classList.remove('show');
      el.countdown.textContent = '';
    },

    showGameOver: function (score, best, isNew, roast, ch) {
      el.finalScore.textContent = score;
      el.finalBest.textContent = best;
      el.newBest.classList.toggle('hidden', !isNew);
      if (el.roast) el.roast.textContent = roast || '';
      if (el.goChar) {
        if (ch && ch.img) {
          el.goChar.src = ch.img.src;
          el.goChar.classList.remove('hidden');
        } else {
          el.goChar.removeAttribute('src');
          el.goChar.classList.add('hidden');
        }
      }
      // retrigger the popup animation even on back-to-back game overs
      var panel = el.gameover.querySelector('.panel');
      if (panel) {
        panel.classList.remove('pop-in');
        void panel.offsetWidth;
        panel.classList.add('pop-in');
      }
      UI.show('gameover');
    }
  };

  BD.UI = UI;
})(window.BD);
