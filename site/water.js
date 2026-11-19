/* liveog · water poured into a link preview's picture, drawn in characters.
 *
 * Physics. A particle fluid (Clavet, Beaudoin and Poulin's double density relaxation, the
 * method behind most "water in a box" toys): every step each particle measures how crowded it is
 * within a small radius and pushes its neighbours apart or pulls them in toward a rest density,
 * with a near-density term that keeps particles from clumping and gives the surface its tension.
 * A little viscosity smooths the flow. Water arrives as a thin stream from above the top edge;
 * the stream's drops do not push anything while they fall, so it stays thin. Where a drop meets
 * the settled surface it plunges in a little and takes on the motion of the water there (an
 * inelastic merge): the water piles and dips under the stream, waves run to the walls, reflect
 * and die away. One drop in six arriving fast is thrown back up in an arc instead, the crown.
 *
 * Drawing (as limn draws its sand plate). Particles are counted into a 2 x 3 sub-grid inside each
 * character cell. Cells on the surface take the glyph whose ink over those six regions is nearest
 * to the surface line there (shape vectors, after Alex Harri's "ASCII characters are not pixels",
 * with the same contrast lift), bright. Falling water and spray take upright and dotted glyphs
 * matched the same way. The body below is quiet: dots that dim with depth, with dashes and tildes
 * where it is moving, and speckles of foam (now and then a bubble) where the stream goes in.
 * The surface itself is read as a height per half character, so its line is always whole.
 * A cell that changes glyph rolls through the ink ramp on the way, like a split-flap board.
 *
 * Cycle. Pour until full, settle to stillness, resolve cell by cell into the liveog mark
 * ('#' on '.'), hold, turn back into water, drain through the floor, rest, pour again.
 */
(function () {
  'use strict';
  const CHARS = " .,'`-_:;~^\"=+*o<>/\\|()!#";
  // Which glyphs may draw what: the surface only flat and sloping strokes, falling water only
  // dots and upright strokes; a turning cell rolls only through the soft glyphs of the ramp.
  const SURFACE = " -_~/\\", FALL = " .,'`:;|!", FLAP = " .,'`-_:;~=+*|!#";
  const NOOP = { resize() {}, recolor() {}, stop() {} };

  window.startWater = function (canvas, opts) {
    try { return make(canvas, opts || {}); } catch (e) { return NOOP; }
  };

  function make(canvas, opts) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return NOOP;
    const cellCSS = opts.cell || [7, 14], font = opts.font || 'JetBrains Mono, monospace';
    let ink = opts.ink || '#bdbdbd', quiet = opts.quiet || '#7a7a7a';
    const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    // --- glyphs: each one's ink over six regions, the ink ramp, and a tinted atlas ------------
    let shapes = [], rank = [], ramp = [], atlas = null, GW = 7, GH = 14, dpr = 1;
    const LUTS = [new Uint8Array(1 << 18), new Uint8Array(1 << 18)];
    const G = (ch) => CHARS.indexOf(ch);
    const DOT = G('.'), HASH = G('#'), TILDE = G('~'), DASH = G('-'), COLON = G(':'), OH = G('o');
    function buildGlyphs() {
      const S = 4, w = cellCSS[0] * S, h = cellCSS[1] * S;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.font = `${(cellCSS[0] / 0.6) * S}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      shapes = [...CHARS].map((ch) => {
        x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillText(ch, w / 2, h / 2 + S * 0.5);
        const d = x.getImageData(0, 0, w, h).data, v = new Float32Array(6);
        for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) v[((px * 2 / w) | 0) + 2 * ((py * 3 / h) | 0)] += d[(py * w + px) * 4] / 255;
        for (let k = 0; k < 6; k++) v[k] /= (w / 2) * (h / 3);
        return v;
      });
      const mx = new Float32Array(6);
      for (const v of shapes) for (let k = 0; k < 6; k++) mx[k] = Math.max(mx[k], v[k]);
      for (const v of shapes) for (let k = 0; k < 6; k++) v[k] /= mx[k] || 1;
      ramp = shapes.map((v, i) => [i, v.reduce((a, b) => a + b, 0)]).sort((a, b) => a[1] - b[1]).map((e) => e[0]).filter((g) => FLAP.includes(CHARS[g]));
      rank = [...CHARS].map((_, g) => ramp.indexOf(g));
      for (const L of LUTS) L.fill(255);
      buildAtlas();
    }
    // two rows of glyphs drawn white, then tinted: row 0 in ink, row 1 in quiet ink
    function buildAtlas() {
      atlas = document.createElement('canvas'); atlas.width = GW * CHARS.length; atlas.height = GH * 2;
      const a = atlas.getContext('2d');
      a.font = `${GW / 0.6}px ${font}`; a.textAlign = 'center'; a.textBaseline = 'middle';
      [ink, quiet].forEach((col, row) => {
        a.globalCompositeOperation = 'source-over'; a.fillStyle = '#fff';
        for (let i = 0; i < CHARS.length; i++) a.fillText(CHARS[i], i * GW + GW / 2, row * GH + GH / 2 + dpr * 0.5);
        a.globalCompositeOperation = 'source-atop'; a.fillStyle = col; a.fillRect(0, row * GH, atlas.width, GH);
      });
    }
    // key: six 3-bit levels, one per region. Set 0 matches the surface glyphs, set 1 the falling ones.
    function glyphFor(key, set) {
      const LUT = LUTS[set], allowed = set ? FALL : SURFACE;
      if (LUT[key] !== 255) return LUT[key];
      let best = 0, bd = 1e9;
      for (let i = 0; i < shapes.length; i++) {
        if (!allowed.includes(CHARS[i])) continue;
        let d = 0;
        for (let k = 0; k < 6; k++) { const q = ((key >> (3 * k)) & 7) / 7 - shapes[i][k]; d += q * q; }
        if (d < bd) { bd = d; best = i; }
      }
      return (LUT[key] = best);
    }

    // --- sizes -------------------------------------------------------------------------------
    let cols = 0, rows = 0, offX = 0, offY = 0, CW = 7, CH = 14, W = 0, H = 0, SX = 0, SY = 0;
    let boxW = 0, boxH = 0, S = 6, Hr = 12, NMAX = 0, gw = 0, gh = 0, head, next;
    let px, py, ox, oy, vx, vy, fall, foam, dens, lid, n = 0;
    let occ, drop, line, level, fizz, flow, shown, alpha, tone, mark, turn;
    function size() {
      const r = canvas.getBoundingClientRect();
      boxW = Math.round(r.width); boxH = Math.round(r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      GW = Math.max(1, Math.round(cellCSS[0] * dpr)); GH = Math.max(1, Math.round(cellCSS[1] * dpr));
      CW = GW / dpr; CH = GH / dpr;
      cols = Math.max(4, Math.floor(canvas.width / GW)); rows = Math.max(3, Math.floor(canvas.height / GH));
      offX = Math.floor((canvas.width - cols * GW) / 2); offY = Math.floor((canvas.height - rows * GH) / 2);
      W = cols * CW; H = rows * CH; SX = cols * 2; SY = rows * 3;
      // particle spacing: as fine as a phone can afford, at most 2000 particles to fill the picture
      S = Math.sqrt((W * H) / (0.87 * Math.min(2000, Math.max(900, (W * H) / 30)))); Hr = 2 * S;
      NMAX = Math.ceil((W * H) / (0.87 * S * S) * 1.08) + 50;
      gw = Math.ceil(W / Hr) + 1; gh = Math.ceil(H / Hr) + 4;
      head = new Int32Array(gw * gh); next = new Int32Array(NMAX);
      px = new Float32Array(NMAX); py = new Float32Array(NMAX); ox = new Float32Array(NMAX); oy = new Float32Array(NMAX);
      vx = new Float32Array(NMAX); vy = new Float32Array(NMAX); fall = new Uint8Array(NMAX); foam = new Float32Array(NMAX); dens = new Float32Array(NMAX); lid = new Float32Array(Math.ceil(W / S) + 1);
      occ = new Float32Array(SX * SY); drop = new Float32Array(SX * SY); line = new Float32Array(SX * SY); level = new Float32Array(SX).fill(SY + 1); fizz = new Float32Array(SX * SY); flow = new Float32Array(SX * SY);
      shown = new Uint8Array(cols * rows); alpha = new Float32Array(cols * rows); tone = new Uint8Array(cols * rows);
      buildMark(); buildGlyphs();
    }

    // The mark in a 50 x 28 box: one rounded outline and two filled eyes. A cell is outline when
    // the line passes close enough (within the cell's half-extent across the line), so the
    // stroke is one character thick on every side.
    function buildMark() {
      mark = new Uint8Array(cols * rows); turn = new Float32Array(cols * rows);
      const s = Math.min((W * 0.84) / 50, (H * 0.8) / 28), mx = (W - 50 * s) / 2, my = (H - 28 * s) / 2;
      const box = (x, y) => {
        const qx = Math.abs(x - 25) - 16.5, qy = Math.abs(y - 14) - 5.5;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 7;
      };
      // the eyes, centred on a corner between cells so each is symmetric, and never thinner than a
      // row or it reads as a dash
      const er = Math.max(3.1, (CH * 0.95) / s), eyes = [30.5, 39.5].map((ex) => [Math.round((mx + ex * s) / CW), Math.round((my + 10.5 * s) / CH)]);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) * CW - mx) / s, y = ((r + 0.5) * CH - my) / s, e = 0.01, i = r * cols + c;
        const nx = (box(x + e, y) - box(x - e, y)) / (2 * e), ny = (box(x, y + e) - box(x, y - e)) / (2 * e);
        const reach = (0.5 * (nx * nx * CW + ny * ny * CH)) / s;
        const inEye = eyes.some(([ec, er0]) => ((c + 0.5 - ec) * CW) ** 2 + ((r + 0.5 - er0) * CH) ** 2 <= (er * s) ** 2 * 1.05);
        const d = box(x, y);
        mark[i] = (d >= -reach - 1e-6 && d < reach - 1e-6) || inEye ? 1 : 0;   // half-open, so exactly one cell when the line runs along a cell edge
        // cells turn in a loose wave out from the middle, each a little early or late
        turn[i] = 0.5 * Math.min(1, Math.hypot((c + 0.5) / cols - 0.5, ((r + 0.5) / rows - 0.5) * 0.6) * 1.7) + 0.5 * Math.random();
      }
    }

    // --- the fluid (lengths in px, one step = 1/180 s) -------------------------------------
    const GRAV = 0.04, REST = 1.9, STIFF = 0.035, NEAR = 0.12, VISC = 0.03, STEPS = 3;
    let phase = 'pour', pt = 0, t = 0, due = 0, closed = 0, calm = 0;
    let seed = (Math.random() * 1e9) | 0;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const FILL = 9;                                       // seconds of pouring
    function restart() { n = 0; closed = 0; due = 0; lid.fill(H); phase = 'pour'; pt = 0; calm = 0; }
    // where the stream comes in: a slow wander, never near the walls, with a small wobble
    const streamX = () => W * (0.5 + 0.2 * Math.sin(t * 0.21 + 1.3) + 0.07 * Math.sin(t * 0.57)) + Math.sin(t * 9) * 0.6;

    function cellOf(i) {
      const gx = Math.min(gw - 1, Math.max(0, (px[i] / Hr) | 0)), gy = Math.min(gh - 1, Math.max(0, ((py[i] + 3 * Hr) / Hr) | 0));
      return gy * gw + gx;
    }
    function step() {
      const pour = phase === 'pour', drain = phase === 'drain';
      // the stream: drops enter above the top edge already moving, a step or two apart
      if (pour) {
        // it opens over half a second and closes as the water nears the brim
        let top = 0; for (let c = 0; c < lid.length; c++) top += lid[c]; top /= lid.length;
        const left = (top - CH * 2.2) / H;
        if (left <= 0 && !closed) closed = pt;
        due += (NMAX / (FILL * 60 * STEPS)) * Math.min(1, pt / 0.6) * (closed ? 0 : Math.min(1, 0.25 + left * 6));
        for (; due >= 1 && n < NMAX; due--) {
          const i = n++;
          px[i] = streamX() + (rnd() - 0.5) * 1.5; py[i] = -2 - rnd() * 3;
          vx[i] = (rnd() - 0.5) * 0.03; vy[i] = 1.6; fall[i] = 1; foam[i] = 0;
        }
      }
      // gravity, then move
      for (let i = 0; i < n; i++) { vy[i] += GRAV; ox[i] = px[i]; oy[i] = py[i]; px[i] += vx[i]; py[i] += vy[i]; }
      head.fill(-1);
      for (let i = 0; i < n; i++) { const c = cellOf(i); next[i] = head[c]; head[c] = i; }
      // where the settled water's surface is, column by column: a falling drop lands when it gets
      // there (water that only just landed does not count, or the stream would catch on itself)
      lid.fill(H);
      for (let i = 0; i < n; i++) if (!fall[i] && foam[i] < 0.7 && dens[i] > 0.9) { const c = Math.min(lid.length - 1, Math.max(0, (px[i] / S) | 0)); if (py[i] < lid[c]) lid[c] = py[i]; }
      const h2 = Hr * Hr, k = phase === 'pour' ? 1 : 1 + calm;          // after the pour, more viscosity to settle
      for (let i = 0; i < n; i++) {
        const gx = Math.min(gw - 1, Math.max(0, (px[i] / Hr) | 0)), gy = Math.min(gh - 1, Math.max(0, ((py[i] + 3 * Hr) / Hr) | 0));
        let rho = 0, near = 0, mvx = 0, mvy = 0, mw = 0;
        // first pass: how crowded, and the neighbours' mean motion (for viscosity)
        for (let y = Math.max(0, gy - 1); y <= Math.min(gh - 1, gy + 1); y++) for (let x = Math.max(0, gx - 1); x <= Math.min(gw - 1, gx + 1); x++) {
          for (let j = head[y * gw + x]; j >= 0; j = next[j]) {
            if (j === i || fall[j]) continue;          // nothing feels a falling drop until it lands
            const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
            if (d2 >= h2) continue;
            const q = 1 - Math.sqrt(d2) / Hr;
            rho += q * q; near += q * q * q; mvx += q * vx[j]; mvy += q * vy[j]; mw += q;
          }
        }
        // a falling drop joins the body once it reaches it; arriving fast, it may be thrown back up
        dens[i] = rho;
        if (fall[i] && vy[i] > 0 && py[i] >= lid[Math.min(lid.length - 1, Math.max(0, (px[i] / S) | 0))] - S * 0.3) {
          fall[i] = 0; foam[i] = 1;
          if (vy[i] > 2 && rnd() < 0.16) { const side = rnd() < 0.5 ? -1 : 1; vx[i] = side * (0.25 + rnd() * 0.75); vy[i] = -(0.9 + rnd() * 1.1); fall[i] = 1; px[i] = ox[i]; py[i] = oy[i] - 1; continue; }
          // it plunges in a little way and takes on the motion of the water it lands in (an
          // inelastic merge), so the stream above is not left standing on it
          py[i] += S * 0.5; px[i] += (rnd() - 0.5) * S; vx[i] = (mw ? mvx / mw : 0) + vx[i] * 0.2; vy[i] = Math.max(0, mw ? mvy / mw : 0) + 0.8;
          ox[i] = px[i] - vx[i]; oy[i] = py[i] - vy[i];
        }
        if (fall[i] || !mw) continue;
        // viscosity: drift toward the neighbours' motion
        const vk = VISC * k; px[i] += (mvx / mw - vx[i]) * vk; py[i] += (mvy / mw - vy[i]) * vk;
        // second pass: push apart (or pull together) toward the rest density
        const P = STIFF * (rho - REST), PN = NEAR * near;
        for (let y = Math.max(0, gy - 1); y <= Math.min(gh - 1, gy + 1); y++) for (let x = Math.max(0, gx - 1); x <= Math.min(gw - 1, gx + 1); x++) {
          for (let j = head[y * gw + x]; j >= 0; j = next[j]) {
            if (j === i || fall[j]) continue;
            const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
            if (d2 >= h2 || d2 < 1e-6) continue;
            const d = Math.sqrt(d2), q = 1 - d / Hr, D = (P * q + PN * q * q) * Hr * 0.5 / d;
            px[j] += dx * D; py[j] += dy * D; px[i] -= dx * D; py[i] -= dy * D;
          }
        }
      }
      // walls and floor (in the drain the floor lets water out through the middle)
      const m = S * 0.35;
      for (let i = 0; i < n; i++) {
        if (px[i] < m) px[i] = m + rnd() * 0.01; else if (px[i] > W - m) px[i] = W - m - rnd() * 0.01;
        if (py[i] > H - m && !(drain && Math.abs(px[i] - W / 2) < W * 0.09 * Math.min(1, pt / 1.5))) { py[i] = H - m - rnd() * 0.01; if (fall[i]) { fall[i] = 0; foam[i] = 1; vy[i] *= 0.3; } }
        vx[i] = px[i] - ox[i]; vy[i] = py[i] - oy[i];
        if (!fall[i]) { const v = Math.hypot(vx[i], vy[i]), cap = S * 0.18; if (v > cap) { vx[i] *= cap / v; vy[i] *= cap / v; } }
        if (phase !== 'pour') { vx[i] *= 1 - 0.012 * calm; vy[i] *= 1 - 0.012 * calm; }
        foam[i] *= 0.975;
      }
      if (drain) {        // what has left through the floor is gone
        let w = 0;
        for (let i = 0; i < n; i++) if (py[i] < H + S * 2) { px[w] = px[i]; py[w] = py[i]; vx[w] = vx[i]; vy[w] = vy[i]; ox[w] = ox[i]; oy[w] = oy[i]; fall[w] = fall[i]; foam[w] = foam[i]; dens[w] = dens[i]; w++; }
        n = w;
      }
    }

    function update(dt) {
      t += dt; pt += dt;
      if (phase === 'pour' && closed && pt > closed + 1) { phase = 'settle'; pt = 0; }
      else if (phase === 'settle') { calm = Math.min(1, pt / 3); if (pt > 4.2) { phase = 'mark'; pt = 0; } }
      else if (phase === 'mark' && pt > 2 + 3) { phase = 'unmark'; pt = 0; }
      else if (phase === 'unmark' && pt > 1.4) { phase = 'drain'; pt = 0; calm = 0.3; }
      else if (phase === 'drain' && (n < 20 || pt > 9)) { phase = 'rest'; pt = 0; n = 0; }
      else if (phase === 'rest' && pt > 0.8) restart();
      if (phase === 'mark' || phase === 'unmark' || phase === 'rest') return;   // the water is still; no need to move it
      for (let k = 0; k < STEPS; k++) step();
    }

    // --- drawing -----------------------------------------------------------------------------
    // Each particle is spread over the sub-cells near it with a small tent, so the field is smooth.
    function field() {
      const sw = CW / 2, sh = CH / 3, full = (sw * sh) / (0.87 * S * S), R = S * 0.9;
      const nOcc = new Float32Array(SX * SY), nDrop = new Float32Array(SX * SY), nFizz = new Float32Array(SX * SY), nFlow = new Float32Array(SX * SY);
      for (let i = 0; i < n; i++) {
        // a falling drop is drawn small, so the stream stays one character wide
        const x = px[i] / sw - 0.5, y = py[i] / sh - 0.5, rx = fall[i] ? 0.6 : R / sw, ry = fall[i] ? 0.9 : R / sh;
        const x0 = Math.max(0, Math.ceil(x - rx)), x1 = Math.min(SX - 1, Math.floor(x + rx)), y0 = Math.max(0, Math.ceil(y - ry)), y1 = Math.min(SY - 1, Math.floor(y + ry));
        if (x0 > x1 || y0 > y1) continue;
        let tw = 0;
        for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) tw += (1 - Math.abs(a - x) / (rx + 0.5)) * (1 - Math.abs(b - y) / (ry + 0.5));
        const sp = Math.hypot(vx[i], vy[i]), into = fall[i] ? nDrop : nOcc;   // the body and the drops apart
        for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) {
          const w = (1 - Math.abs(a - x) / (rx + 0.5)) * (1 - Math.abs(b - y) / (ry + 0.5)) / tw, j = b * SX + a;
          into[j] += w / full; nFizz[j] += (w * foam[i]) / full; nFlow[j] += w * sp;
        }
      }
      // keep a little of the last frame, so a cell does not flicker as particles jostle (more of it
      // as the water comes to rest, so still water draws a still line)
      const keep = 0.45 + 0.4 * calm;
      for (let j = 0; j < occ.length; j++) {
        occ[j] = occ[j] * keep + Math.min(1.2, nOcc[j]) * (1 - keep); drop[j] = drop[j] * 0.3 + Math.min(1.5, nDrop[j] * 1.6) * 0.7;
        fizz[j] = fizz[j] * 0.6 + nFizz[j] * 0.4; flow[j] = flow[j] * 0.7 + nFlow[j] * 0.3;
      }
      // The surface, sub-column by sub-column: the first place from the top where the water
      // (read through a small sideways blur) is at least half full and stays so below. Kept as a
      // height, smoothed in time, so the line drawn from it is whole and moves softly.
      const o = (j, a) => 0.2 * occ[j - (a > 1) * 2] + 0.2 * occ[j - (a > 0)] + 0.2 * occ[j] + 0.2 * occ[j + (a < SX - 1)] + 0.2 * occ[j + (a < SX - 2) * 2];
      for (let a = 0; a < SX; a++) {
        let y = SY + 1, prev = 0;
        for (let b = 0; b < SY; b++) {
          const v = o(b * SX + a, a);
          if (v >= 0.5 && (b === SY - 1 || o((b + 1) * SX + a, a) >= 0.5)) { y = b + 0.5 - (v - 0.5) / Math.max(0.05, v - prev); y = Math.max(b - 0.5, y); break; }
          prev = v;
        }
        level[a] = Math.abs(y - level[a]) > 3 ? y : level[a] * keep + y * (1 - keep);
      }
      level[0] = level[1]; level[SX - 1] = level[SX - 2];       // the walls hold fewer particles; read past them
      // the line itself, one sub-row thick, joined to its neighbours so steep parts stay whole
      line.fill(0);
      for (let a = 0; a < SX; a++) {
        const y = level[a], yl = (y + level[a > 0 ? a - 1 : a]) / 2, yr = (y + level[a < SX - 1 ? a + 1 : a]) / 2;
        const lo = Math.min(y, yl, yr) - 0.5, hi = Math.max(y, yl, yr) + 0.5;
        for (let b = Math.max(0, Math.floor(lo)); b < Math.min(SY, Math.ceil(hi)); b++) line[b * SX + a] = Math.min(b + 1, hi) - Math.max(b, lo);
      }
    }
    // six regions as one key, with Harri's contrast lift: each region relative to the cell's
    // strongest, raised to a power, so a stroke stays crisp instead of smearing into its neighbours
    function keyOf(f, b, scale) {
      let mx = 0;
      for (let k = 0; k < 6; k++) mx = Math.max(mx, f[b + (k >> 1) * SX + (k & 1)]);
      let key = 0;
      for (let k = 0; k < 6; k++) {
        const v = mx ? Math.pow(f[b + (k >> 1) * SX + (k & 1)] / mx, 1.8) * Math.min(1, mx * scale) : 0;
        key |= Math.min(7, Math.round(v * 7)) << (3 * k);
      }
      return key;
    }
    const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const sum6 = (f, b) => f[b] + f[b + 1] + f[b + SX] + f[b + SX + 1] + f[b + 2 * SX] + f[b + 2 * SX + 1];
    const min6 = (f, b) => Math.min(f[b], f[b + 1], f[b + SX], f[b + SX + 1], f[b + 2 * SX], f[b + 2 * SX + 1]);

    function draw(still) {
      if (!still) field();
      const marking = phase === 'mark' ? ease(pt / 2) : phase === 'unmark' ? 1 - ease(pt / 1.4) : 0;
      const turning = phase === 'mark' || phase === 'unmark';
      // Which cell draws each column's surface: the one holding the middle of the line, except that
      // a line just over the bottom edge of a cell is still drawn in it, as '_'.
      const surf = new Int16Array(cols).fill(rows);
      if (!still) for (let c = 0; c < cols; c++) surf[c] = Math.floor(((level[2 * c] + level[2 * c + 1]) / 2 - 0.5) / 3);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, b = r * 3 * SX + c * 2;
        let g = 0, col = 1, a = 0, flap = turning;
        if (still || marking > turn[i]) {
          g = mark[i] ? HASH : DOT; col = mark[i] ? 0 : 1; a = mark[i] ? 1 : 0.34;
        } else {
          const o = sum6(occ, b) / 6, ln = sum6(line, b), od = sum6(drop, b) / 6, fz = sum6(fizz, b) + od * 3, fl = sum6(flow, b) / Math.max(0.3, sum6(occ, b));
          if (r === surf[c] && ln > 0.2) {
            // the surface: bright, its glyph matched to the line through the cell. Matched at more
            // weight where the water moves, so a moving surface draws '~' and still water '-' and '_'
            g = glyphFor(keyOf(line, b, 0.4 + 0.7 * Math.min(1, fl / 1.5)), 0) || glyphFor(keyOf(line, b, 1.3), 0) || DASH; col = 0; a = 0.62 + 0.2 * Math.min(1, ln / 1.6) + 0.18 * Math.min(1, fl / 1.5);
          } else if (r > surf[c] && o > 0.3) {
            // the body: dim with depth; moving water shows dashes and tildes, fresh foam light speckles
            const depth = Math.min(1, (r - surf[c]) / Math.max(4, rows * 0.6));
            g = DOT; col = 1; a = 0.42 - 0.2 * depth; flap = true;
            if (fl > 1.1) { g = fl > 1.9 ? TILDE : DASH; a += 0.12; }
            // foam: speckles that come and go, thicker (and now and then a bubble) where it is fresh
            const froth = (fz / 6) * Math.max(0, 1 - (r - surf[c]) / 6), speck = hash(c, r, (t * 7) | 0);
            if (froth > 0.25 + 0.7 * speck) { g = froth > 0.5 && speck < 0.12 ? OH : froth > 0.35 ? COLON : DOT; col = 0; a = 0.35 + Math.min(0.45, froth * 0.6); }
          } else if (od > 0.04) {
            // falling water and spray
            g = glyphFor(keyOf(drop, b, 1.1), 1); col = 0; a = 0.45 + 0.55 * Math.min(1, od * 2.5);
          }
        }
        // split-flap: roll through the ramp a step at a time (two in the body) toward the new glyph
        const was = shown[i];
        if (was !== g && !still) {
          const ra = rank[was], rb = rank[g];
          if (flap && ra >= 0 && rb >= 0) g = ramp[ra + Math.sign(rb - ra) * Math.min(Math.abs(rb - ra), turning ? 1 : 2)];
          else if (!g && alpha[i] > 0.25) { g = was; a = alpha[i] * 0.55; col = tone[i]; }   // a drop leaves a short fading trail
        }
        shown[i] = g; alpha[i] = a; tone[i] = col;
        if (!g || a < 0.03) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(atlas, g * GW, col * GH, GW, GH, offX + c * GW, offY + r * GH, GW, GH);
      }
      ctx.globalAlpha = 1;
    }

    // --- life cycle ----------------------------------------------------------------------------
    let raf = 0, last = 0, acc = 0, running = false, visible = true, stopped = false;
    const STEP = 1 / 60;
    const safe = (f) => { try { f(); } catch (e) { /* never throw */ } };
    function frame(now) {
      raf = 0;
      if (!running) return;
      safe(() => {
        acc += last ? Math.min(0.1, (now - last) / 1000) : STEP; last = now;
        // a slow device skips simulation time rather than falling further behind
        for (let k = 0; acc >= STEP && k < 2; k++) { update(STEP); acc -= STEP; }
        if (acc > STEP) acc = 0;
        draw(false);
      });
      raf = requestAnimationFrame(frame);
    }
    function play() {
      const want = !stopped && visible && !document.hidden && !reduce.matches;
      if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
      if (reduce.matches && !stopped) safe(() => draw(true));
    }
    const onVis = () => play();
    document.addEventListener('visibilitychange', onVis);
    if (reduce.addEventListener) reduce.addEventListener('change', onVis);
    let io = null;
    if (window.IntersectionObserver) { io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); play(); }); io.observe(canvas); }

    size(); restart();
    // for checking a moment by eye: run ahead this many seconds before the first frame
    for (let k = 0, m = Math.round((opts.skip || 0) / STEP); k < m; k++) { update(STEP); if (m - k < 20) draw(false); }
    draw(reduce.matches);
    // glyph shapes depend on the font, so measure them again once it has loaded
    if (document.fonts && document.fonts.load) document.fonts.load(`${CW / 0.6}px ${font}`).then(() => safe(() => { buildGlyphs(); draw(reduce.matches); }), () => {});
    play();

    return {
      // a resize that leaves the box as it was (a phone's toolbar sliding away) changes nothing
      resize() { safe(() => { const r = canvas.getBoundingClientRect(); if (Math.round(r.width) === boxW && Math.round(r.height) === boxH && Math.min(2, window.devicePixelRatio || 1) === dpr) return; size(); restart(); draw(reduce.matches); }); },
      recolor(i, q) { safe(() => { if (i) ink = i; if (q) quiet = q; buildAtlas(); draw(reduce.matches); }); },
      stop() { safe(() => { stopped = true; play(); document.removeEventListener('visibilitychange', onVis); if (io) io.disconnect(); if (reduce.removeEventListener) reduce.removeEventListener('change', onVis); }); },
    };
  }
})();
