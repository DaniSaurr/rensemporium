// ship.js: a spine, a wheel, a rear drive block. nose is +x.
(function (G) {
'use strict';
const { V, Mesh } = G.BP;

// square-section bar between two points
function bar(m, a, b, w1, w2, o) {
  const d = V.norm(V.sub(b, a)), h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = V.mul(V.norm(V.cross(d, h)), w1), v = V.mul(V.norm(V.cross(d, V.norm(V.cross(d, h)))), w2), c = [];
  for (const p of [a, b]) for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.push(V.add(p, V.add(V.mul(u, s[0]), V.mul(v, s[1]))));
  return m.hexa(c, o);
}

G.BP.buildShip = function (rng) {
  const m = new Mesh(), A = {};
  const R = 1.35 + rng() * 0.5, L0 = -2.5 - rng() * 0.6, L1 = 2.1 + rng() * 0.6, xr = -0.1 + rng() * 0.6;
  const ring2 = rng() < 0.3, ntank = rng() < 0.25 ? 0 : (rng() < 0.5 ? 1 : 2);
  const noz = [[[0, 0]], [[0, 0.27], [0.234, -0.135], [-0.234, -0.135]], [[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]]][rng() < 0.3 ? 0 : (rng() < 0.55 ? 1 : 2)];
  const X = [1, 0, 0];

  m.lathe([0, 0, 0], X, [[L0, 0], [L0, 0.2], [L1, 0.2], [L1, 0]], 16, { name: 'spine' });
  for (let x = L0 + 0.5; x < L1 - 0.4; x += 0.75 + rng() * 0.5) m.lathe([0, 0, 0], X, [[x, 0], [x, 0.28], [x + 0.14, 0.28], [x + 0.14, 0]], 16);

  // drive block and nozzles
  const e0 = L0 - 0.9, e1 = L0 + 0.3;
  m.lathe([0, 0, 0], X, [[e0, 0], [e0, 0.42], [e0 + 0.2, 0.58], [e1 - 0.3, 0.58], [e1, 0.4], [e1, 0]], 18, { name: 'drive' });
  A.nozzles = [];
  for (const q of noz) {
    const o = [0, q[0], q[1]], br = noz.length === 1 ? 1.4 : 1;
    m.lathe(o, X, [[e0 + 0.02, 0], [e0 + 0.02, 0.13 * br], [e0 - 0.22, 0.21 * br], [e0 - 0.27, 0.2 * br]], 14);
    m.lathe(o, X, [[e0 - 0.03, 0], [e0 - 0.03, 0.17 * br]], 14, { tone: 0.97, outward: () => [-1, 0, 0] });
    A.nozzles.push([e0 - 0.3, q[0], q[1]]);
  }
  for (let k = 0; k < 3; k++) {          // fins on the drive block
    const ph = k / 3 * Math.PI * 2 + 0.5, d = [0, Math.cos(ph), Math.sin(ph)], t = V.mul([0, -Math.sin(ph), Math.cos(ph)], 0.03);
    const P = (x, r, s) => V.add(V.add([x, 0, 0], V.mul(d, r)), V.mul(t, s));
    m.hexa([P(e0 + 0.15, 0.55, -1), P(e1 - 0.15, 0.55, -1), P(e0 + 0.05, 1.2, -1), P(e0 - 0.35, 1.2, -1), P(e0 + 0.15, 0.55, 1), P(e1 - 0.15, 0.55, 1), P(e0 + 0.05, 1.2, 1), P(e0 - 0.35, 1.2, 1)]);
  }

  // wheel(s)
  const wheel = (x, r) => {
    m.torus([x, 0, 0], X, r, 0.11, 40, 8, { name: 'ring' });
    m.lathe([0, 0, 0], X, [[x - 0.3, 0], [x - 0.3, 0.34], [x + 0.3, 0.34], [x + 0.3, 0]], 16);
    for (let k = 0; k < 6; k++) {
      const ph = k / 6 * Math.PI * 2, d = [0, Math.cos(ph), Math.sin(ph)];
      bar(m, V.add([x, 0, 0], V.mul(d, 0.3)), V.add([x, 0, 0], V.mul(d, r - 0.05)), 0.035, 0.035);
    }
  };
  wheel(xr, R);
  A.ring = [xr, R * Math.cos(0.9), R * Math.sin(0.9)];
  if (ring2) wheel(xr - 1.5, R * 0.68);

  // tanks
  A.tank = null;
  for (let i = 0; i < ntank; i++) {
    const a = i * Math.PI + 0.7, y = 0.52 * Math.cos(a), z = 0.52 * Math.sin(a), t0 = L1 - 2.4, t1 = t0 + 1.6;
    m.lathe([0, y, z], X, [[t0, 0], [t0 + 0.12, 0.16], [t0 + 0.3, 0.2], [t1 - 0.3, 0.2], [t1 - 0.12, 0.16], [t1, 0]], 14, { name: 'tank' });
    for (const x of [t0 + 0.45, t1 - 0.45]) bar(m, [x, y * 0.45, z * 0.45], [x, y * 0.85, z * 0.85], 0.03, 0.03);
    if (!A.tank) A.tank = [t0 + 0.8, y * 1.4, z * 1.4];
  }

  // nose and mast
  m.lathe([0, 0, 0], X, [[L1, 0], [L1, 0.3], [L1 + 0.5, 0.26], [L1 + 1.3, 0.05], [L1 + 1.3, 0]], 6, { name: 'nose' });
  A.nose = [L1 + 1.3, 0, 0];
  const mx = L1 - 0.7 - rng() * 0.6;
  bar(m, [mx, 0.2, 0], [mx, 1.0, 0], 0.025, 0.025);
  bar(m, [mx - 0.25, 0.85, 0], [mx + 0.25, 0.85, 0], 0.02, 0.02);
  bar(m, [mx - 0.15, 0.68, 0], [mx + 0.15, 0.68, 0], 0.02, 0.02);
  A.mast = [mx, 1.0, 0];

  // greebles
  for (let i = 0; i < 16; i++) {
    const x = L0 + 0.5 + rng() * (L1 - L0 - 1), a = rng() * Math.PI * 2;
    m.box([x, 0.21 * Math.cos(a), 0.21 * Math.sin(a)], [0.14 + rng() * 0.32, 0.07 + rng() * 0.08, 0.09 + rng() * 0.12]);
  }
  A.drive = [e0 + 0.5, 0.58, 0];
  A.spine = [L1 - 0.2, 0.2, 0];
  A.R = R;
  return { mesh: m.finalize(), A, L0, L1, e0 };
};
})(window);
