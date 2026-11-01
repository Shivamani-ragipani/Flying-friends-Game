/* ==========================================================
   roasts.js — funny Game Over lines (Telugu/Hinglish roast tone,
   friendly, never offensive). A shuffle bag guarantees no message
   repeats until every line has been shown once.
   ========================================================== */
(function (BD) {
  'use strict';

  var MESSAGES = [
    'Abhey... kuch bhi khelna nahi aata terku \uD83D\uDE02',
    'Ay hero... idhe aa nee talent?',
    'Reyy... first practice chesi ra \uD83D\uDE02',
    'Nuvvu flying chesthunava... ledha padipothunava?',
    'Anna... mia kuda avoid cheyyalekapoyav.',
    'Em confidence tho start chesavo \uD83D\uDE02',
    'Idhi game kadhu ra... torture.',
    'One more try? Ledha uninstall chesthava?',
    'Ay baap re... score kanna excuses ekkuva.',
    'Legend in failing.',
    'Bro... touch cheyyadam kante padipovadam fast undhi.',
    'Mission Failed Successfully.'
  ];

  var bag = [];

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function next() {
    if (!bag.length) bag = shuffle(MESSAGES.slice());
    return bag.pop();
  }

  BD.Roasts = { next: next };
})(window.BD);
