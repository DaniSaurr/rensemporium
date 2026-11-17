// planet.js: shaded spheres and a ringed planet with correct front/back ring occlusion.
(function (G) {
'use strict';
const BP = G.BP, clamp = BP.clamp, smooth = BP.smooth;

BP.Mask.prototype.or = function (o) { const a = this.a, b = o.a; for (let i = 0; i < a.length; i++) if (b[i]) a[i] = 1; return this; };

const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// light is in screen space: x right, y down, z toward the viewer
BP.drawSphere = function (pen, cx, cy, R, o) {
  o = o || {};
  const rng = pen.rng, L = norm3(o.light || [-0.55, -0.55, 0.63]);
  const tone = (x, y) => {
    const nx = (x - cx) / R, ny = (y - cy) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    let t = 1 - (0.06 + 0.94 * Math.pow(lam, 0.9)) + 0.1 * Math.pow(1 - nz, 2.2);
    if (o.extra) t += o.extra(x, y, nx, ny, nz);
    return clamp(t, 0, 1);
  };
  if (o.outline !== false) {
    pen.ellipse(cx, cy, R, R, 0, { p: 0.9, speed: 0.22, wob: 0.5 });
    if (rng() < 0.55) pen.ellipse(cx, cy, R, R, 0, { p: 0.5, speed: 0.3, wob: 0.8, tail: 14 });
  }
  const ml = 20 + R * 0.12;
  pen.shade({ box: [cx - R, cy - R, cx + R, cy + R], inside: (x, y) => (x - cx) * (x - cx) + (y - cy) * (y - cy) < R * R, tone, angle: o.angle == null ? -58 : o.angle, gap: o.gap || 3.4, depth: o.depth || 3, maxLen: ml, minLen: ml * 0.45 });
};

// P: cx, cy, R, tilt, incl, rIn, rOut (multiples of R), moons [{x,y,r}]. occl: Mask of nearer things.
BP.drawPlanet = function (pen, P, occl) {
  const rng = pen.rng, W = pen.W, H = pen.H, n2 = pen.n2;
  const cs = Math.cos(P.tilt), sn = Math.sin(P.tilt), sI = Math.sin(P.incl), cI = Math.cos(P.incl);
  const rIn = P.rIn * P.R, rOut = P.rOut * P.R, PI = Math.PI;
  const loc = (x, y) => { const dx = x - P.cx, dy = y - P.cy; return [dx * cs + dy * sn, -dx * sn + dy * cs]; };
  const ringR = (x, y) => { const l = loc(x, y); return Math.hypot(l[0], l[1] / sI); };
  const inDisc = (x, y) => (x - P.cx) * (x - P.cx) + (y - P.cy) * (y - P.cy) < P.R * P.R;
  const inBand = (x, y) => { const r = ringR(x, y); return r >= rIn && r <= rOut; };
  const front = (x, y) => loc(x, y)[1] > 0;
  const bbox = [P.cx - rOut - 4, P.cy - rOut - 4, P.cx + rOut + 4, P.cy + rOut + 4];
  const M = new BP.Mask(W, H), gap = 0.5 + rng() * 0.25, sF = 26 + rng() * 22, sP = rng() * 6;
  P.region = (x, y) => inDisc(x, y) || inBand(x, y);

  // 1. the ball, with the near half of the ring hiding it
  M.clear().or(occl).fillFn(bbox, (x, y) => inBand(x, y) && front(x, y));
  pen.mask = M.a;
  const bandsTone = (x, y, nx, ny, nz) => 0.12 * Math.sin(loc(x, y)[1] / P.R * 11 + 2 * n2(x * 0.02, y * 0.02, 2)) + 0.08 * (n2(x * 0.06, y * 0.06, 2) - 0.5);
  BP.drawSphere(pen, P.cx, P.cy, P.R, { extra: bandsTone, light: [-0.6, -0.5, 0.62], gap: 3.5 });
  for (let ph = -1.15; ph <= 1.15; ph += 0.19 + rng() * 0.09) {
    const rr = P.R * Math.cos(ph), off = -P.R * Math.sin(ph) * cI;
    pen.arc(P.cx - off * sn, P.cy + off * cs, rr, rr * sI, P.tilt, 0.04 + rng() * 0.25, PI - 0.04 - rng() * 0.25, { p: 0.5 + rng() * 0.25, speed: 0.5, wob: 1.1, skip: 0.6 });
  }
  if (rng() < 0.7) {                     // storm
    const l = [-0.32 * P.R + rng() * 0.2 * P.R, 0.28 * P.R], sx = P.cx + l[0] * cs - l[1] * sn, sy = P.cy + l[0] * sn + l[1] * cs;
    for (let k = 0; k < 3; k++) pen.ellipse(sx, sy, P.R * (0.2 - k * 0.055), P.R * (0.1 - k * 0.028), P.tilt, { p: 0.7, speed: 0.4, wob: 0.5 });
  }

  // 2. ring, far half (the ball hides it)
  const ringTone = (x, y) => {
    const w = (ringR(x, y) - rIn) / (rOut - rIn);
    if (w < 0 || w > 1 || Math.abs(w - gap) < 0.04) return 0;
    let t = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(w * sF + sP)) + 0.2 * n2(x * 0.05, y * 0.05, 2);
    return clamp(t + 0.24 * smooth(clamp(((x - P.cx) / rOut + 0.3) / 1.3, 0, 1)), 0, 1);
  };
  const ringLines = (t0, t1) => {
    const rs = [[rIn, 0.85], [rOut, 0.9], [rIn + (rOut - rIn) * (gap - 0.04), 0.7], [rIn + (rOut - rIn) * (gap + 0.04), 0.7], [rIn + (rOut - rIn) * (0.2 + rng() * 0.2), 0.4], [rIn + (rOut - rIn) * (0.82 + rng() * 0.1), 0.4]];
    for (const r of rs) pen.arc(P.cx, P.cy, r[0], r[0] * sI, P.tilt, t0 + (rng() - 0.5) * 0.04, t1 + (rng() - 0.5) * 0.04, { p: r[1], speed: 0.3, wob: 0.8 });
  };
  M.clear().or(occl).fillFn(bbox, inDisc);
  pen.mask = M.a;
  ringLines(PI, 2 * PI);
  pen.shade({ box: bbox, inside: (x, y) => inBand(x, y) && !front(x, y), tone: ringTone, angle: P.tilt * 57.3 - 78, gap: 3.1, depth: 2, toneScale: 1.05 });

  // 3. ring, near half
  M.clear().or(occl);
  pen.mask = M.a;
  ringLines(0, PI);
  pen.shade({ box: bbox, inside: (x, y) => inBand(x, y) && front(x, y), tone: ringTone, angle: P.tilt * 57.3 - 78, gap: 3.1, depth: 2, toneScale: 0.95 });

  for (const m of P.moons || []) {
    M.clear().or(occl).fillFn(bbox, (x, y) => inBand(x, y) && front(x, y) || inDisc(x, y));
    pen.mask = M.a;
    BP.drawSphere(pen, m.x, m.y, m.r, { gap: 3 });
  }
  pen.mask = null;
};
})(window);
