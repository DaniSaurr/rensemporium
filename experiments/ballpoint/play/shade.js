// shade.js: occlusion masks and tone-driven hatching for the pen.
(function (G) {
'use strict';
const { Pen } = G.BP;

class Mask {
  constructor(W, H) { this.W = W; this.H = H; this.a = new Uint8Array(W * H); }
  clear() { this.a.fill(0); return this; }
  copy(o) { this.a.set(o.a); return this; }
  fillFn(box, fn) {
    const W = this.W, H = this.H, a = this.a;
    const x0 = Math.max(0, box[0] | 0), y0 = Math.max(0, box[1] | 0), x1 = Math.min(W - 1, Math.ceil(box[2])), y1 = Math.min(H - 1, Math.ceil(box[3]));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fn(x + 0.5, y + 0.5)) a[y * W + x] = 1;
    return this;
  }
  fillPoly(pts) {
    const W = this.W, H = this.H, a = this.a, n = pts.length;
    let y0 = 1e9, y1 = -1e9;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) xs.push(p[0] + (yc - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(W - 1, Math.round(xs[k + 1]));
        for (let x = xa; x <= xb; x++) a[y * W + x] = 1;
      }
    }
    return this;
  }
  dilate(r) {
    const W = this.W, H = this.H, a = this.a, tmp = new Uint8Array(W * H), pre = new Int32Array(Math.max(W, H) + 1);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) pre[x + 1] = pre[x] + (a[row + x] ? 1 : 0);
      for (let x = 0; x < W; x++) tmp[row + x] = pre[Math.min(W, x + r + 1)] - pre[Math.max(0, x - r)] > 0 ? 1 : 0;
    }
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) pre[y + 1] = pre[y] + tmp[y * W + x];
      for (let y = 0; y < H; y++) a[y * W + x] = pre[Math.min(H, y + r + 1)] - pre[Math.max(0, y - r)] > 0 ? 1 : 0;
    }
    return this;
  }
}

// one hatching pass. lines run at `angle` deg, `gap` px apart. a line is drawn wherever
// tone(x,y) beats that line's own random threshold in [lo,hi], so density follows tone.
Pen.prototype.hatch = function (o) {
  const rng = this.rng, box = o.box;
  const a = (o.angle == null ? -60 : o.angle) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const gap = o.gap || 3.2, inside = o.inside, tone = o.tone || (() => 1);
  const lo = o.lo == null ? 0.05 : o.lo, hi = o.hi == null ? 0.8 : o.hi;
  let nmin = 1e9, nmax = -1e9, umin = 1e9, umax = -1e9;
  for (const c of [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]) {
    const t = c[0] * nx + c[1] * ny, u = c[0] * dx + c[1] * dy;
    if (t < nmin) nmin = t; if (t > nmax) nmax = t; if (u < umin) umin = u; if (u > umax) umax = u;
  }
  const speed = o.speed == null ? 0.85 : o.speed;
  const lo2 = { speed, p: o.p, wob: o.wob == null ? 0.4 : o.wob, bow: o.bow == null ? 0.02 : o.bow, over: o.over == null ? 0.3 : o.over, free: o.free, tail: o.tail, head: o.head };
  let chain = null, flip = false;
  const flushChain = () => { if (chain && chain.length > 1) this.trace(chain, lo2); chain = null; };
  for (let t = nmin + rng() * gap; t < nmax; t += gap * (0.85 + 0.3 * rng())) {
    const thr = lo + (hi - lo) * Math.pow(rng(), o.bias || 1);
    const segs = []; let s0 = null, s1 = null;
    for (let u = umin; u <= umax; u += 2) {
      const x = nx * t + dx * u, y = ny * t + dy * u;
      const ok = x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inside(x, y) && tone(x, y) > thr;
      if (ok) { if (!s0) s0 = [x, y]; s1 = [x, y]; } else if (s0) { segs.push([s0, s1]); s0 = null; }
    }
    if (s0) segs.push([s0, s1]);
    for (const sg of segs) {
      const q0 = sg[0], q1 = sg[1], qlen = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
      if (qlen < 2.5) continue;
      // long runs are cut into short staggered strokes, the way a hand hatches
      const pieces = [];
      if (o.maxLen && qlen > o.maxLen) {
        const ux = (q1[0] - q0[0]) / qlen, uy = (q1[1] - q0[1]) / qlen, mn = o.minLen || o.maxLen * 0.4;
        for (let s = -rng() * mn * 0.7; s < qlen;) {
          const l = mn + rng() * (o.maxLen - mn), a = Math.max(0, s), b = Math.min(qlen, s + l);
          if (b - a > 2.5) pieces.push([[q0[0] + ux * a, q0[1] + uy * a], [q0[0] + ux * b, q0[1] + uy * b]]);
          s += l + (rng() - 0.35) * 4;
        }
      } else pieces.push([q0, q1]);
      for (const pc of pieces) {
        const p0 = pc[0], p1 = pc[1], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (len < 2.5) continue;
        if (o.zig) {
          const cs = flip ? p1 : p0, ce = flip ? p0 : p1;
          if (chain && Math.hypot(chain[chain.length - 1][0] - cs[0], chain[chain.length - 1][1] - cs[1]) < gap * 3.2) { chain.push(cs, ce); flip = !flip; }
          else { flushChain(); chain = [p0, p1]; flip = true; }
        } else {
          const ta = rng() * 1.2, tb = rng() * 2.2;
          let ux = (p1[0] - p0[0]) / len, uy = (p1[1] - p0[1]) / len;
          if (len - ta - tb < 2) continue;
          let a0 = [p0[0] + ux * ta, p0[1] + uy * ta], a1 = [p1[0] - ux * tb, p1[1] - uy * tb];
          if (o.jit) {   // loose hand: swing each stroke a little about its middle
            const j = (rng() - 0.5) * 2 * o.jit * Math.PI / 180, c = Math.cos(j), s = Math.sin(j), mx = (a0[0] + a1[0]) / 2, my = (a0[1] + a1[1]) / 2;
            const rot = q => [mx + (q[0] - mx) * c - (q[1] - my) * s, my + (q[0] - mx) * s + (q[1] - my) * c];
            a0 = rot(a0); a1 = rot(a1);
          }
          this.line(a0, a1, lo2);
        }
      }
    }
  }
  flushChain();
};

// layered shading: base hatch, cross hatch, then the darkest pass.
// o: box, inside, tone, angle, gap, depth (1..3), zig
Pen.prototype.shade = function (o) {
  const A = o.angle == null ? -58 : o.angle, g = o.gap || 3.3, d = o.depth || 3, ts = o.toneScale == null ? 1 : o.toneScale;
  const tone = ts === 1 ? o.tone : (x, y) => o.tone(x, y) * ts;
  const base = { box: o.box, inside: o.inside, tone, free: o.free, speed: o.speed, wob: o.wob, p: o.p, maxLen: o.maxLen, minLen: o.minLen, jit: o.jit };
  this.hatch(Object.assign({}, base, { angle: A + (this.rng() - 0.5) * 4, gap: g, lo: 0.06, hi: 0.72 }));
  if (d > 1) this.hatch(Object.assign({}, base, { angle: A + 48 + (this.rng() - 0.5) * 8, gap: g * 1.1, lo: 0.46, hi: 0.94 }));
  if (d > 2) this.hatch(Object.assign({}, base, { angle: A - 32 + (this.rng() - 0.5) * 8, gap: g * 0.95, lo: 0.74, hi: 1.02, zig: o.zig }));
};

G.BP.Mask = Mask;
})(window);
