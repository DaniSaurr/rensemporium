// extras.js: stars, sky scribble, the grey head, labels and speed lines.
(function (G) {
'use strict';
const BP = G.BP, clamp = BP.clamp, smooth = BP.smooth;

BP.drawStars = function (pen, n) {
  const rng = pen.rng, W = pen.W, H = pen.H, mk = pen.mask;
  const free = (x, y, r) => !mk || !(mk[(y | 0) * W + (x | 0)] || mk[(Math.max(0, y - r) | 0) * W + (x | 0)] || mk[(Math.min(H - 1, y + r) | 0) * W + (x | 0)] || mk[(y | 0) * W + (Math.max(0, x - r) | 0)] || mk[(y | 0) * W + (Math.min(W - 1, x + r) | 0)]);
  const st = { speed: 0.2, over: 0, wob: 0.1, p: 0.8, blob: 0.2, tail: 3, head: 1 }, out = [];
  for (let i = 0; i < n; i++) {
    const x = 30 + rng() * (W - 60), y = 30 + rng() * (H - 60), t = rng();
    if (t < 0.5) { if (free(x, y, 1)) { pen.dot(x, y, 0.5 + rng() * 0.9); out.push([x, y, 2]); } }
    else if (t < 0.76) { const s = 2 + rng() * 3; if (free(x, y, s)) { pen.line([x - s, y], [x + s, y], st); pen.line([x, y - s], [x, y + s], st); out.push([x, y, s + 1]); } }
    else if (t < 0.9) { const a = 1.6 + rng() * 1.8; if (free(x, y, a + 2)) { pen.ellipse(x, y, a, a * (0.8 + rng() * 0.3), 0, st); out.push([x, y, a + 1]); } }
    else {
      const s = 7 + rng() * 11;
      if (free(x, y, s * 1.3)) {
        out.push([x, y, s * 1.1]);
        pen.line([x - s, y], [x + s, y], Object.assign({}, st, { over: 0.6, p: 0.9 }));
        pen.line([x, y - s * 1.25], [x, y + s * 1.25], Object.assign({}, st, { over: 0.6, p: 0.9 }));
        pen.line([x - s * 0.4, y - s * 0.4], [x + s * 0.4, y + s * 0.4], st);
        pen.line([x - s * 0.4, y + s * 0.4], [x + s * 0.4, y - s * 0.4], st);
        pen.dot(x, y, 0.8);
      }
    }
  }
  return out;
};

// dark scribble sky. `keep` is a Mask of everything that must stay paper.
BP.drawSky = function (pen, keep, tone) {
  const W = pen.W, H = pen.H, a = keep.a;
  pen.mask = a;
  pen.shade({ box: [0, 0, W, H], inside: (x, y) => !a[(y | 0) * W + (x | 0)], tone, angle: -56, gap: 3.7, depth: 3, speed: 0.95, wob: 0.5, maxLen: 80, minLen: 26, jit: 7 });
  pen.mask = null;
};

BP.drawAlien = function (pen, cx, cy, s, rot) {
  const rng = pen.rng, W = pen.W, H = pen.H, cr = Math.cos(rot), sr = Math.sin(rot);
  const T = (x, y) => [cx + (x * cr - y * sr) * s, cy + (x * sr + y * cr) * s];
  const TP = pts => pts.map(p => T(p[0], p[1]));
  const loc = (x, y) => [((x - cx) * cr + (y - cy) * sr) / s, (-(x - cx) * sr + (y - cy) * cr) / s];
  const head = [[0, -1.0], [0.42, -0.94], [0.74, -0.66], [0.82, -0.28], [0.7, 0.1], [0.5, 0.46], [0.26, 0.78], [0, 0.92], [-0.27, 0.78], [-0.5, 0.46], [-0.72, 0.1], [-0.84, -0.27], [-0.76, -0.65], [-0.43, -0.94]];
  const eyeL = [[-0.1, 0.0], [-0.3, -0.18], [-0.6, -0.2], [-0.72, 0.0], [-0.52, 0.2], [-0.25, 0.13]];
  const eyeR = eyeL.map(p => [-p[0] * 0.96 + 0.02, p[1] + 0.01]);
  const poly = pts => BP.catmull(pts, true, 3);
  const headM = new BP.Mask(W, H).fillPoly(TP(poly(head))), eyes = new BP.Mask(W, H);
  eyes.fillPoly(TP(poly(eyeL))); eyes.fillPoly(TP(poly(eyeR)));
  const bb = [cx - s, cy - s * 1.05, cx + s, cy + s * 1.35];
  // neck and shoulders first, they sit behind the head
  pen.curve(TP([[-0.22, 0.74], [-0.25, 1.05], [-0.4, 1.28], [-0.9, 1.4]]), false, { p: 0.85, speed: 0.3, wob: 0.6 });
  pen.curve(TP([[0.22, 0.74], [0.25, 1.05], [0.4, 1.28], [0.95, 1.36]]), false, { p: 0.85, speed: 0.3, wob: 0.6 });
  // skull shading
  pen.mask = null;
  const tone = (x, y) => {
    const q = loc(x, y), u = q[0], v = q[1];
    let t = 0.08 + 0.5 * smooth(clamp((u + 0.7) / 1.5, 0, 1)) + 0.2 * clamp((v + 0.2) / 1.2, 0, 1) + 0.3 * Math.exp(-Math.pow((v + 0.34) / 0.1, 2)) + 0.2 * Math.exp(-Math.pow((v - 0.5 - Math.abs(u) * 0.3) / 0.1, 2));
    return clamp(t, 0, 0.95);
  };
  pen.shade({ box: bb, inside: (x, y) => headM.a[(y | 0) * W + (x | 0)] && !eyes.a[(y | 0) * W + (x | 0)], tone, angle: -58, gap: 3.2, depth: 2 });
  pen.curve(TP(head), true, { p: 0.95, speed: 0.22, wob: 0.55 });
  pen.curve(TP(head), true, { p: 0.55, speed: 0.3, wob: 0.9, tail: 20, blob: 0 });
  // eyes: outline, then black fill leaving a glint
  for (const e of [eyeL, eyeR]) pen.curve(TP(e), true, { p: 0.95, speed: 0.25, wob: 0.35 });
  const gl = [T(-0.44, -0.08), T(0.5, -0.08)];
  const hl = (x, y) => gl.some(g => Math.hypot((x - g[0]) / (s * 0.09), (y - g[1]) / (s * 0.045)) < 1);
  pen.shade({ box: bb, inside: (x, y) => eyes.a[(y | 0) * W + (x | 0)] && !hl(x, y), tone: () => 1, angle: -48, gap: 2.1, depth: 3, speed: 0.6 });
  // nose, mouth, brow
  pen.dot(T(-0.05, 0.38)[0], T(-0.05, 0.38)[1], 0.7); pen.dot(T(0.05, 0.38)[0], T(0.05, 0.38)[1], 0.7);
  pen.curve(TP([[-0.15, 0.58], [0, 0.615], [0.15, 0.58]]), false, { p: 0.85, speed: 0.25, wob: 0.3 });
  pen.curve(TP([[-0.36, -0.55], [-0.1, -0.62], [0.2, -0.6]]), false, { p: 0.5, speed: 0.4, wob: 0.6 });
};

// text on a leader: anchor point, then the text sitting on an underline
BP.drawLabel = function (pen, ax, ay, tx, ty, str, size, align) {
  const w = pen.textWidth(str, size), x0 = align === 'r' ? tx - w : tx;
  pen.text(str, x0, ty, size, { slant: 0.12 });
  const uy = ty + size * 1.3;
  pen.line([x0 - 3, uy], [x0 + w + 3, uy], { speed: 0.4, p: 0.8, wob: 0.3 });
  const ex = align === 'r' ? x0 + w + 3 : x0 - 3;
  pen.line([ex, uy], [ax, ay], { speed: 0.45, p: 0.8, wob: 0.5, over: 0 });
  pen.ellipse(ax, ay, 3.2, 3.2, 0, { speed: 0.2, p: 0.9, wob: 0.1 });
};

// n parallel streaks trailing behind (x,y) along direction (dx,dy)
BP.speedLines = function (pen, x, y, dx, dy, n, len, spread) {
  const rng = pen.rng, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  for (let i = 0; i < n; i++) {
    const off = (rng() - 0.5) * 2 * spread, st = 10 + rng() * 40, ln = len * (0.35 + 0.65 * rng());
    pen.line([x + ux * st + nx * off, y + uy * st + ny * off], [x + ux * (st + ln) + nx * off * 1.15, y + uy * (st + ln) + ny * off * 1.15], { speed: 1, p: 0.62, wob: 0.5, over: 0, tail: 40, head: 6 });
  }
};
})(window);
