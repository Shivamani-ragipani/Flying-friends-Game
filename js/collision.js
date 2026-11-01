/* ==========================================================
   collision.js — Collision System.

   Bottles: each sprite row stores the left/right edge of its opaque
   pixels (a silhouette profile), so a narrow neck is really narrow.
   Head: a ring of points on the head's actual outline (plus an inner
   ring and the centre), rotated with the head, each tested against the
   bottle silhouette. The outline sits slightly INSIDE the art, so there
   are no invisible or oversized hitboxes.

   If the browser refuses to read pixels (images opened from file://
   taint the canvas) we fall back to a tight approximation. Serve the
   folder over http for exact pixel masks with your own art.
   ========================================================== */
(function (BD) {
  'use strict';

  var C = BD.CONFIG, P = C.PLAYER;
  var ALPHA = 60;

  // ----- bottle silhouette profile -----
  var rows = 0, bottleW = 0;
  var rowL = null, rowR = null;
  var exact = false;

  // ----- head outline points (offsets from head centre, unrotated) -----
  var MAX_PTS = 64;
  var hx = new Float32Array(MAX_PTS), hy = new Float32Array(MAX_PTS);
  var hCount = 0;
  var headRadius = 30;
  var headExact = false;

  function setBottleProfile(canvas, w, h) {
    rows = h | 0;
    bottleW = w;
    rowL = new Float32Array(rows);
    rowR = new Float32Array(rows);
    exact = false;

    if (canvas) {
      try {
        var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        var cw = canvas.width, inset = C.OBSTACLE.edgeInset;
        for (var y = 0; y < rows; y++) {
          var l = -1, r = -1;
          for (var x = 0; x < cw; x++) {
            if (d[(y * cw + x) * 4 + 3] > ALPHA) { if (l < 0) l = x; r = x + 1; }
          }
          if (l < 0 || r - l <= inset * 2) { rowL[y] = 1e9; rowR[y] = -1e9; }
          else { rowL[y] = l + inset; rowR[y] = r - inset; }
        }
        exact = true;
        return;
      } catch (e) { /* tainted canvas: use approximation below */ }
    }
    // Approximation: slim neck, wider body.
    for (var j = 0; j < rows; j++) {
      var f = j / rows;
      var inner = f < 0.3 ? 0.30 : (f < 0.42 ? 0.30 - (f - 0.3) / 0.12 * 0.18 : 0.12);
      rowL[j] = w * inner;
      rowR[j] = w * (1 - inner);
    }
  }

  // Build outline points from an alpha mask of the head (centered in canvas).
  function setHeadShape(canvas) {
    hCount = 0;
    headExact = false;
    var cx = 0, cy = 0, maxR = P.drawHeight * 0.42;

    if (canvas) {
      try {
        var cw = canvas.width, ch = canvas.height;
        var d = canvas.getContext('2d').getImageData(0, 0, cw, ch).data;
        cx = cw / 2; cy = ch / 2;
        var rays = 32, minR = 1e9;
        var radii = [];
        for (var i = 0; i < rays; i++) {
          var a = i / rays * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          var found = 0;
          for (var r = Math.max(cw, ch) / 2; r > 0; r -= 0.5) {
            var px = Math.round(cx + ca * r), py = Math.round(cy + sa * r);
            if (px < 0 || py < 0 || px >= cw || py >= ch) continue;
            if (d[(py * cw + px) * 4 + 3] > 100) { found = r; break; }
          }
          radii.push(found);
          if (found > 0 && found < minR) minR = found;
        }
        for (var k = 0; k < rays; k++) {
          var ang = k / rays * Math.PI * 2, rr = radii[k] * P.hitInset;
          hx[hCount] = Math.cos(ang) * rr; hy[hCount] = Math.sin(ang) * rr; hCount++;
        }
        var inner = Math.max(6, minR * 0.5);
        for (var m = 0; m < 16; m++) {
          var an = m / 16 * Math.PI * 2;
          hx[hCount] = Math.cos(an) * inner; hy[hCount] = Math.sin(an) * inner; hCount++;
        }
        hx[hCount] = 0; hy[hCount] = 0; hCount++;
        headRadius = Math.max.apply(null, radii) || maxR;
        headExact = true;
        return;
      } catch (e) { /* tainted */ }
    }
    // Fallback: circle outline + inner ring + centre
    for (var q = 0; q < 32; q++) {
      var aq = q / 32 * Math.PI * 2;
      hx[hCount] = Math.cos(aq) * maxR; hy[hCount] = Math.sin(aq) * maxR; hCount++;
    }
    for (var n = 0; n < 16; n++) {
      var an2 = n / 16 * Math.PI * 2;
      hx[hCount] = Math.cos(an2) * maxR * 0.5; hy[hCount] = Math.sin(an2) * maxR * 0.5; hCount++;
    }
    hx[hCount] = 0; hy[hCount] = 0; hCount++;
    headRadius = maxR;
  }

  function inBottle(o, px, py) {
    var dx = px - (o.x - bottleW / 2);
    if (dx < 0 || dx > bottleW) return false;
    var ly;
    if (py >= o.gapB) ly = py - o.gapB;          // standing bottle: tip at gapB
    else if (py <= o.gapT) ly = o.gapT - py;     // hanging bottle: tip at gapT
    else return false;
    var row = ly | 0;
    if (row < 0 || row >= rows) return false;
    return dx >= rowL[row] && dx <= rowR[row];
  }

  // Returns 0 = clear, 1 = hit a bottle, 2 = hit the ground.
  // angleRad is the head's rotation on screen (clockwise positive).
  function check(px, py, angleRad, pool, groundY) {
    var ca = Math.cos(angleRad), sa = Math.sin(angleRad);
    var reach = bottleW / 2 + headRadius;
    var hitGround = false, hitBottle = false;

    for (var i = 0; i < hCount; i++) {
      var wx = px + hx[i] * ca - hy[i] * sa;
      var wy = py + hx[i] * sa + hy[i] * ca;
      if (wy >= groundY) hitGround = true;
      if (hitBottle) continue;
      for (var j = 0; j < pool.length; j++) {
        var o = pool[j];
        if (!o.active || Math.abs(o.x - px) > reach) continue;
        if (inBottle(o, wx, wy)) { hitBottle = true; break; }
      }
    }
    return hitBottle ? 1 : (hitGround ? 2 : 0);
  }

  BD.Collision = {
    setBottleProfile: setBottleProfile,
    setHeadShape: setHeadShape,
    check: check,
    headRadius: function () { return headRadius; },
    isExact: function () { return { bottle: exact, head: headExact }; }
  };
})(window.BD);
