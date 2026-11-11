// pen.js: ballpoint ink model. paper, ink density buffer, pen strokes.
// ink is stored as optical density and turned into colour on the way out
// (paper * exp(-density * absorbance)), so overlapping strokes darken the
// way real ink does and the colour goes navy-black when it piles up.
(function (G) {
'use strict';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise1(rng) {
  const tab = new Float32Array(256);
  for (let i = 0; i < 256; i++) tab[i] = rng() * 2 - 1;
  return function (x) {
    const i = Math.floor(x), f = x - i;
    const a = tab[i & 255], b = tab[(i + 1) & 255];
    return a + (b - a) * smooth(f);
  };
}

function makeNoise2(rng) {
  const N = 64, tab = new Float32Array(N * N);
  for (let i = 0; i < tab.length; i++) tab[i] = rng();
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = smooth(x - xi), fy = smooth(y - yi);
    const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = yi & 63, y1 = (yi + 1) & 63;
    const a = tab[y0 * N + x0], b = tab[y0 * N + x1], c = tab[y1 * N + x0], d = tab[y1 * N + x1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  return function (x, y, oct) {
    let s = 0, amp = 0.5, f = 1, tot = 0;
    for (let o = 0; o < (oct || 3); o++) { s += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
    return s / tot;
  };
}

function catmull(pts, closed, step) {
  const n = pts.length, out = [];
  const g = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const c = q => 0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3);
      out.push([c(0), c(1)]);
    }
  }
  out.push(closed ? out[0].slice() : pts[n - 1].slice());
  return out;
}

// absorbance per channel (r, g, b) for density 1
const INKS = { blue: [1.86, 1.36, 0.34], black: [1.95, 1.9, 1.7] };

class Pen {
  constructor(canvas, o) {
    this.W = o.W; this.H = o.H; this.S = o.S;
    this.w = Math.round(o.W * o.S); this.h = Math.round(o.H * o.S);
    canvas.width = this.w; canvas.height = this.h;
    this.ctx = canvas.getContext('2d');
    this.seed = o.seed;
    this.rng = mulberry32(o.seed);
    this.n1 = makeNoise1(this.rng);
    this.n2 = makeNoise2(this.rng);
    this.dens = new Float32Array(this.w * this.h);
    this.grain = new Uint8Array(this.w * this.h);
    this.paper = new Uint8ClampedArray(this.w * this.h * 4);
    this.img = this.ctx.createImageData(this.w, this.h);
    this.hard = new Uint8Array(this.W * this.H);   // never drawable (holes)
    this.mask = null;                              // scene occlusion, logical px
    this.jobs = []; this.ji = 0; this.si = 0; this.total = 0; this.done = 0;
    this.step_ = 0.5 * this.S;                     // stamp spacing, device px
    this.gain = 1.08;
    this.resetDirty();
    this.setInk(o.ink || 'blue');
  }

  setInk(name) {
    const a = INKS[name] || INKS.blue; this.ink = name;
    const K = 128, N = 6 * K;
    this.lutK = K;
    this.lut = [0, 1, 2].map(c => { const t = new Float32Array(N + 1); for (let i = 0; i <= N; i++) t[i] = Math.exp(-a[c] * i / K); return t; });
  }

  resetDirty() { this.dx0 = 1e9; this.dy0 = 1e9; this.dx1 = -1; this.dy1 = -1; }

  makePaper(kind) {
    const { w, h, S, W, H } = this, P = this.paper, Gr = this.grain, rng = this.rng, nz = this.n2;
    const cx = w / 2, cy = h / 2, rmax = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4;
        const fine = rng();
        const mid = nz(x / (2.4 * S), y / (2.4 * S) + 40, 2);
        const big = nz(x / (55 * S) + 9, y / (55 * S), 3);
        Gr[i] = (fine * 0.5 + mid * 0.5) * 255;
        const rr = Math.hypot(x - cx, y - cy) / rmax;
        const k = 1 - 0.055 * (fine - 0.5) - 0.05 * (mid - 0.5) - 0.07 * (big - 0.5) - 0.07 * rr * rr;
        P[o] = 247 * k; P[o + 1] = 244 * k; P[o + 2] = 233 * k; P[o + 3] = 255;
      }
    }
    const blend = (x, y, c, a) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const o = (y * w + x) * 4;
      P[o] = P[o] * (1 - a) + c[0] * a; P[o + 1] = P[o + 1] * (1 - a) + c[1] * a; P[o + 2] = P[o + 2] * (1 - a) + c[2] * a;
    };
    const hline = (yl, x0, x1, c, a, th) => {
      const yy = Math.round(yl * S - th * S / 2), n = Math.max(1, Math.round(th * S));
      for (let k = 0; k < n; k++) for (let x = Math.round(x0 * S); x < Math.round(x1 * S); x++) blend(x, yy + k, c, a * (0.72 + 0.28 * rng()));
    };
    const vline = (xl, y0, y1, c, a, th) => {
      const xx = Math.round(xl * S - th * S / 2), n = Math.max(1, Math.round(th * S));
      for (let k = 0; k < n; k++) for (let y = Math.round(y0 * S); y < Math.round(y1 * S); y++) blend(xx + k, y, c, a * (0.72 + 0.28 * rng()));
    };
    if (kind === 'lined') {
      for (let y = 128; y < H; y += 36) hline(y, 0, W, [120, 154, 204], 0.5, 1.1);
      vline(190, 0, H, [222, 108, 120], 0.62, 1.2); vline(195, 0, H, [222, 108, 120], 0.55, 1.2);
    } else if (kind === 'graph') {
      for (let i = 0, y = 20; y < H; y += 27, i++) hline(y, 0, W, [128, 186, 198], i % 5 === 0 ? 0.6 : 0.4, 1);
      for (let i = 0, x = 20; x < W; x += 27, i++) vline(x, 0, H, [128, 186, 198], i % 5 === 0 ? 0.6 : 0.4, 1);
    }
    if (kind === 'lined') {
      for (const yl of [H * 0.17, H * 0.5, H * 0.83]) this.hole(66, yl, 19, blend);
    }
    this.img.data.set(P);
  }

  hole(xl, yl, rl, blend) {
    const S = this.S, r = rl * S, cx = xl * S, cy = yl * S;
    for (let y = Math.floor(cy - r - 4); y <= cy + r + 4; y++) for (let x = Math.floor(cx - r - 4); x <= cx + r + 4; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d <= r) { const s = 0.78 + 0.3 * (dy / r) * 0.6 - 0.12 * (dx / r); blend(x, y, [58 * s, 55 * s, 64 * s], 1); }
      else if (d < r + 3.5 * S) blend(x, y, [90, 84, 78], 0.22 * (1 - (d - r) / (3.5 * S)));
    }
    for (let y = Math.floor(yl - rl - 3); y <= yl + rl + 3; y++) for (let x = Math.floor(xl - rl - 3); x <= xl + rl + 3; x++) {
      if (x >= 0 && y >= 0 && x < this.W && y < this.H && Math.hypot(x + 0.5 - xl, y + 0.5 - yl) < rl + 2) this.hard[y * this.W + x] = 1;
    }
  }

  compose(x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.w, x1); y1 = Math.min(this.h, y1);
    if (x1 <= x0 || y1 <= y0) return;
    const w = this.w, d = this.dens, P = this.paper, O = this.img.data;
    const lr = this.lut[0], lg = this.lut[1], lb = this.lut[2], K = this.lutK, N = lr.length - 1;
    for (let y = y0; y < y1; y++) {
      let i = y * w + x0, o = i * 4;
      for (let x = x0; x < x1; x++, i++, o += 4) {
        const v = d[i];
        if (v < 0.003) { O[o] = P[o]; O[o + 1] = P[o + 1]; O[o + 2] = P[o + 2]; continue; }
        let k = (v * K) | 0; if (k > N) k = N;
        O[o] = P[o] * lr[k]; O[o + 1] = P[o + 1] * lg[k]; O[o + 2] = P[o + 2] * lb[k];
      }
    }
    this.ctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  flush() {
    if (this.dx1 >= 0) this.compose(this.dx0, this.dy0, this.dx1 + 1, this.dy1 + 1);
    this.resetDirty();
  }

  stamp(x, y, p, r) {
    const w = this.w, h = this.h, dens = this.dens, gr = this.grain;
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1));
    const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(h - 1, Math.ceil(y + r + 1));
    const dep = this.step_ / (2 * r) * (0.55 + 0.45 * p) * this.gain, lim = r + 0.5;
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - y, row = yy * w;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x;
        let f = lim - Math.sqrt(dx * dx + dy * dy);
        if (f <= 0) continue;
        if (f > 1) f = 1;
        const i = row + xx;
        let c = (p + 0.38 - gr[i] * 0.00392157) * 3.2;
        if (c <= 0) continue;
        if (c > 1) c = 1;
        dens[i] += f * c * dep;
      }
    }
    if (x0 < this.dx0) this.dx0 = x0; if (y0 < this.dy0) this.dy0 = y0;
    if (x1 > this.dx1) this.dx1 = x1; if (y1 > this.dy1) this.dy1 = y1;
  }

  // draw up to `budget` samples off the queue. returns true when the queue is empty.
  advance(budget) {
    let used = 0;
    while (this.ji < this.jobs.length && used < budget) {
      const job = this.jobs[this.ji], d = job.d;
      while (this.si < job.n && used < budget) {
        const k = this.si * 4;
        this.stamp(d[k], d[k + 1], d[k + 2], d[k + 3]);
        this.tx = d[k]; this.ty = d[k + 1];
        this.si++; used++; this.done++;
      }
      if (this.si >= job.n) { this.jobs[this.ji] = null; this.ji++; this.si = 0; }
    }
    this.flush();
    return this.ji >= this.jobs.length;
  }

  // ---- strokes -------------------------------------------------------------
  // pts: [[x,y],...] logical px. o: p (pressure), speed 0..1, wob, head, tail, blob, skip, r, free
  trace(pts, o) {
    o = o || {};
    const n = pts.length; if (n < 2) return;
    const rng = this.rng, n1 = this.n1, W = this.W, H = this.H;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const L = cum[n - 1]; if (L < 0.35) return;
    const speed = o.speed == null ? 0.3 : o.speed, ds = 0.5;
    const m = Math.max(2, Math.ceil(L / ds) + 1);
    const wob = o.wob == null ? 0.6 : o.wob;
    const l1 = 55 + 45 * speed, ph1 = rng() * 200, ph2 = rng() * 200, ph3 = rng() * 200;
    const X = new Float32Array(m), Y = new Float32Array(m), OK = new Uint8Array(m);
    const mask = o.free ? null : this.mask, hard = this.hard;
    let seg = 0;
    for (let j = 0; j < m; j++) {
      const s = L * j / (m - 1);
      while (seg < n - 2 && cum[seg + 1] < s) seg++;
      const a = pts[seg], b = pts[seg + 1];
      const sl = cum[seg + 1] - cum[seg] || 1, t = (s - cum[seg]) / sl;
      const tx = (b[0] - a[0]) / sl, ty = (b[1] - a[1]) / sl;
      const off = wob * (0.8 * n1(s / l1 + ph1) + 0.3 * n1(s / 11 + ph2)) + (rng() - 0.5) * 0.12;
      const x = a[0] + (b[0] - a[0]) * t - ty * off, y = a[1] + (b[1] - a[1]) * t + tx * off;
      X[j] = x; Y[j] = y;
      OK[j] = (x >= 0 && y >= 0 && x < W && y < H && !hard[(y | 0) * W + (x | 0)] && !(mask && mask[(y | 0) * W + (x | 0)])) ? 1 : 0;
    }
    const skipRate = o.skip == null ? 0.22 * speed : o.skip;
    let j = 0;
    while (j < m) {
      if (!OK[j]) { j++; continue; }
      let e = j; while (e + 1 < m && OK[e + 1]) e++;
      if (e - j >= 2) this.emit(X, Y, j, e, ds, speed, o, skipRate, ph3);
      j = e + 1;
    }
  }

  emit(X, Y, j0, j1, ds, speed, o, skipRate, ph3) {
    const rng = this.rng, n1 = this.n1, S = this.S;
    const cnt = j1 - j0 + 1, Lr = (cnt - 1) * ds, d = new Float32Array(cnt * 4);
    const base = o.p == null ? 0.86 - 0.36 * speed : o.p;
    const head = o.head == null ? 2.5 : o.head;
    const tail = o.tail == null ? 4 + 30 * speed : o.tail;
    const r0 = o.r == null ? 0.8 : o.r;
    let g0 = -1, g1 = -1;
    if (Lr > 30 && rng() < skipRate * Lr / 100) { g0 = rng() * (Lr - 10) + 5; g1 = g0 + 1.2 + rng() * 3.5; }
    const blob = rng() < (o.blob == null ? 0.42 - 0.3 * speed : o.blob);
    for (let k = 0; k < cnt; k++) {
      const t = k * ds;
      const es = head > 0 ? 0.5 + 0.5 * smooth(Math.min(1, t / head)) : 1;
      const ee = tail > 0 ? 0.28 + 0.72 * smooth(clamp((Lr - t) / tail, 0, 1)) : 1;
      let p = base * es * ee * (1 + 0.2 * n1(t / 30 + ph3));
      if (g0 >= 0 && t > g0 - 1 && t < g1 + 1) p *= 1 - 0.94 * smooth(clamp(Math.min(t - (g0 - 1), g1 + 1 - t), 0, 1));
      let r = r0 * (0.86 + 0.3 * p);
      if (blob && t < 1.3) { p = Math.max(p, 0.95); r *= 1.55; }
      p = clamp(p, 0.08, 1);
      const q = k * 4;
      d[q] = X[j0 + k] * S; d[q + 1] = Y[j0 + k] * S; d[q + 2] = p; d[q + 3] = r * S;
    }
    this.jobs.push({ d, n: cnt });
    this.total += cnt;
  }

  dot(x, y, size, o) {
    o = o || {}; const rng = this.rng, S = this.S, n = 1 + ((size || 1) * 2 | 0);
    const bx = this.mask && !o.free ? this.mask : null;
    if (x < 0 || y < 0 || x >= this.W || y >= this.H || this.hard[(y | 0) * this.W + (x | 0)] || (bx && bx[(y | 0) * this.W + (x | 0)])) return;
    const d = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      d[k * 4] = (x + (rng() - 0.5) * 0.5 * size) * S; d[k * 4 + 1] = (y + (rng() - 0.5) * 0.5 * size) * S;
      d[k * 4 + 2] = 0.7 + rng() * 0.3; d[k * 4 + 3] = (0.7 + 0.5 * size) * S * (0.9 + rng() * 0.3);
    }
    this.jobs.push({ d, n }); this.total += n;
  }

  line(a, b, o) {
    o = o || {}; const rng = this.rng;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const ux = dx / len, uy = dy / len;
    const ov = o.over == null ? Math.min(2.5, len * 0.05) : o.over;
    const e0 = ov * (rng() * 1.4 - 0.25), e1 = ov * (rng() * 1.4 - 0.25);
    const bow = (rng() - 0.5) * len * (o.bow == null ? 0.012 : o.bow);
    const n = Math.max(2, Math.ceil(len / 6)), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = -e0 + t * (len + e0 + e1), bw = bow * 4 * t * (1 - t);
      pts.push([a[0] + ux * s - uy * bw, a[1] + uy * s + ux * bw]);
    }
    this.trace(pts, o);
  }

  poly(pts, closed, o) {
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) this.line(pts[i], pts[(i + 1) % n], o);
  }

  curve(pts, closed, o) {
    const c = catmull(pts, closed, 5);
    if (closed) { const extra = Math.min(6, c.length - 2); for (let i = 1; i <= extra; i++) c.push(c[i].slice()); }
    this.trace(c, o);
  }

  arc(cx, cy, rx, ry, rot, t0, t1, o) {
    const rng = this.rng, cr = Math.cos(rot), sr = Math.sin(rot), sweep = t1 - t0;
    const n = Math.max(6, Math.ceil(Math.max(rx, ry) * Math.abs(sweep) / 4)), drift = (rng() - 0.5) * 0.03, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + sweep * i / n, k = 1 + drift * (i / n), px = rx * k * Math.cos(t), py = ry * k * Math.sin(t);
      pts.push([cx + px * cr - py * sr, cy + px * sr + py * cr]);
    }
    this.trace(pts, o);
  }

  ellipse(cx, cy, rx, ry, rot, o) {
    const t0 = this.rng() * 6.283, over = 0.12 + this.rng() * 0.2;
    this.arc(cx, cy, rx, ry, rot, t0, t0 + 6.283 + over, o);
  }
}

G.BP = { Pen, mulberry32, makeNoise1, makeNoise2, catmull, clamp, lerp, smooth };
})(window);
