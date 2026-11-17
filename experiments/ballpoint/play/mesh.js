// mesh.js: just enough 3D to build ships and stations for the pen to draw.
(function (G) {
'use strict';

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// rotation: yaw about Y, then pitch about X, then roll about Z. row-major 3x3.
function rotMat(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy], Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const mm = (A, B) => { const R = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return R; };
  return mm(Rz, mm(Rx, Ry));
}
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

const BOXF = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];

class Mesh {
  constructor() { this.v = []; this.faces = []; this.parts = 0; this.names = {}; }

  addPart(verts, faces, o) {
    o = o || {};
    const base = this.v.length, part = this.parts++;
    let cx = 0, cy = 0, cz = 0;
    for (const p of verts) { this.v.push(p); cx += p[0]; cy += p[1]; cz += p[2]; }
    const c = [cx / verts.length, cy / verts.length, cz / verts.length];
    for (const f of faces) {
      let idx = f.map(i => i + base);
      const p0 = this.v[idx[0]], p1 = this.v[idx[1]];
      let n = [0, 0, 0];
      for (let k = 1; k < idx.length - 1; k++) n = V.add(n, V.cross(V.sub(this.v[idx[k]], p0), V.sub(this.v[idx[k + 1]], p0)));
      const ln = Math.hypot(n[0], n[1], n[2]);
      if (ln < 1e-9) continue;
      n = V.mul(n, 1 / ln);
      let fc = [0, 0, 0]; for (const i of idx) fc = V.add(fc, this.v[i]); fc = V.mul(fc, 1 / idx.length);
      const out = o.outward ? o.outward(fc) : V.sub(fc, c);
      if (V.dot(n, out) < 0) { idx = idx.slice().reverse(); n = V.mul(n, -1); }
      this.faces.push({ idx, n, part, smooth: !!o.smooth, tone: o.tone == null ? null : o.tone, name: o.name || null });
    }
    if (o.name) (this.names[o.name] = this.names[o.name] || []).push(part);
    return part;
  }

  lathe(origin, axis, profile, seg, o) {
    const a = V.norm(axis), helper = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = V.norm(V.cross(a, helper)), w = V.cross(a, u), verts = [], rings = [];
    for (const pr of profile) {
      const h = pr[0], r = pr[1], ring = [], ctr = V.add(origin, V.mul(a, h));
      if (r < 1e-6) { ring.push(verts.length); verts.push(ctr); }
      else for (let j = 0; j < seg; j++) {
        const t = j / seg * 2 * Math.PI;
        ring.push(verts.length); verts.push(V.add(ctr, V.add(V.mul(u, r * Math.cos(t)), V.mul(w, r * Math.sin(t)))));
      }
      rings.push(ring);
    }
    const faces = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let j = 0; j < seg; j++) {
        const q = [A[j % A.length], A[(j + 1) % A.length], B[(j + 1) % B.length], B[j % B.length]];
        const f = q.filter((v, k) => v !== q[(k + 3) % 4]);
        if (f.length >= 3) faces.push(f);
      }
    }
    return this.addPart(verts, faces, Object.assign({ smooth: true }, o));
  }

  // box from centre and size, optionally rotated by matrix o.rot and shifted after
  box(c, sz, o) {
    o = o || {};
    const hx = sz[0] / 2, hy = sz[1] / 2, hz = sz[2] / 2, k = [];
    for (const y of [-hy, hy]) for (const p of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) {
      let q = [p[0], y, p[1]];
      if (o.rot) q = mv(o.rot, q);
      k.push(V.add(c, q));
    }
    return this.addPart(k, BOXF, o);
  }

  // convex hexahedron from 8 corners (bottom quad 0-3, top quad 4-7)
  hexa(c8, o) { return this.addPart(c8, BOXF, o); }

  torus(origin, axis, R, r, sR, sr, o) {
    const a = V.norm(axis), helper = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = V.norm(V.cross(a, helper)), w = V.cross(a, u), verts = [], faces = [];
    for (let i = 0; i < sR; i++) for (let j = 0; j < sr; j++) {
      const ph = i / sR * 2 * Math.PI, th = j / sr * 2 * Math.PI, rad = R + r * Math.cos(th);
      verts.push(V.add(origin, V.add(V.add(V.mul(u, rad * Math.cos(ph)), V.mul(w, rad * Math.sin(ph))), V.mul(a, r * Math.sin(th)))));
    }
    for (let i = 0; i < sR; i++) for (let j = 0; j < sr; j++) {
      const i1 = (i + 1) % sR, j1 = (j + 1) % sr;
      faces.push([i * sr + j, i1 * sr + j, i1 * sr + j1, i * sr + j1]);
    }
    const outward = fc => {
      const d = V.sub(fc, origin), al = V.dot(d, a), p = V.sub(d, V.mul(a, al));
      return V.sub(d, V.mul(V.norm(p), R));
    };
    return this.addPart(verts, faces, Object.assign({ smooth: true, outward }, o));
  }

  // adjacency and edge tables. call once after the last part is added.
  finalize() {
    this.vf = this.v.map(() => []);
    this.faces.forEach((f, i) => { for (const v of f.idx) this.vf[v].push(i); });
    const em = new Map();
    this.faces.forEach((f, fi) => {
      const n = f.idx.length;
      for (let k = 0; k < n; k++) {
        const a = f.idx[k], b = f.idx[(k + 1) % n], key = a < b ? a * 100000 + b : b * 100000 + a;
        let e = em.get(key);
        if (!e) { e = { a: Math.min(a, b), b: Math.max(a, b), f: [] }; em.set(key, e); }
        e.f.push(fi);
      }
    });
    this.edges = Array.from(em.values());
    return this;
  }
}

G.BP.V = V; G.BP.rotMat = rotMat; G.BP.mv = mv; G.BP.Mesh = Mesh;
})(window);
