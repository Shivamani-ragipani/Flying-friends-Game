/* ==========================================================
   characters.js — Character Manager.
   Defines the friends, loads every image and voice clip up front,
   and owns which character is selected. A missing image or clip
   never breaks the game: the game falls back gracefully.
   ========================================================== */
(function (BD) {
  'use strict';

  // One friend per entry. intro / fail clips are per character and never shared.
  var DEFS = [
    { id: 'feroz',  name: 'Feroz',  image: 'assets/characters/feroz.png',
      intro: 'assets/audio/lavde-ho-tum.mp3',            fail: 'assets/audio/feroz-fail.mp3' },
    { id: 'pavan',  name: 'Pavan',  image: 'assets/characters/pavan.png',
      intro: 'assets/audio/abe-tu-thoda-sa-bkl-hai-kya.mp3', fail: 'assets/audio/pavan-fail.mp3' },
    { id: 'razak',  name: 'Razak',  image: 'assets/characters/Razak.png',
      intro: 'assets/audio/vasteguna-huiya.mp3', fail: 'assets/audio/razak-fail.mp3' },
    { id: 'sadist', name: 'Sadist', image: 'assets/characters/sadist.png',
      intro: 'assets/audio/modi-ji-bkl.mp3',                fail: 'assets/audio/sadist-fail.mp3' },
    { id: 'sameer', name: 'Sameer', image: 'assets/characters/sameer.png',
      intro: 'assets/audio/anime-ahh.mp3',                  fail: 'assets/audio/sameer-fail.mp3' },
    { id: 'naveen', name: 'Naveen', image: 'assets/characters/naveen.png',
      intro: 'assets/audio/anime-ahh.mp3',                fail: 'assets/audio/naveen-fail.mp3' }
  ];

  var Characters = {
    list: [],
    selected: null,

    // Loads every character image + voice clip. Resolves even if files are missing.
    load: function () {
      var defs = DEFS.slice();
      var jobs = defs.map(function (def) {
        var ch = {
          id: def.id, name: def.name,
          img: null, introClip: null, failClip: null, introDur: 2
        };
        var imgJob = BD.Assets.loadImage(def.image, 8000).then(function (img) {
          ch.img = img;
        });
        var introJob = BD.Audio.loadClip(def.intro).then(function (clip) {
          ch.introClip = clip;
          if (clip && isFinite(clip.duration) && clip.duration > 0) ch.introDur = clip.duration;
        });
        var failJob = BD.Audio.loadClip(def.fail).then(function (clip) {
          ch.failClip = clip;
        });
        return Promise.all([imgJob, introJob, failJob]).then(function () {
          Characters.list.push(ch);   // keep definition order
        });
      });
      return Promise.all(jobs);
    },

    // Returns the character (or null when the id is unknown).
    get: function (id) {
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].id === id) return this.list[i];
      }
      return null;
    },

    // Marks a character selected; returns it for chaining.
    select: function (id) {
      this.selected = this.get(id);
      return this.selected;
    },

    // Forget the selection (used when going Home).
    clear: function () { this.selected = null; },

    // The loaded image of the selected character (null = procedural fallback).
    selectedImage: function () {
      return this.selected ? this.selected.img : null;
    }
  };

  BD.Characters = Characters;
})(window.BD);
