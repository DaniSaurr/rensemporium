// render3d.js: rasterise a Mesh into id/tone buffers, then let the pen draw it:
// feature edges with hidden lines removed, and hatching driven by the tone buffer.
(function (G) {
'use strict';
const { V, mv, rotMat, Pen, clamp } = G.BP;

function makeCam(o) {
  const cam = { R: rotMat(o.yaw || 0, o.pitch || 0, o.roll || 0), t: o.t || [0, 0, 0], F: o.F, D: o.D, cx: o.cx, cy: o.cy };
  cam.project = p => {
    const q = mv(cam.R, p), x = q[0] + cam.t[0], y = q[1] + cam.t[1], z = q[2] + cam.t[2], d = cam.D - z;
    return [cam.cx + cam.F * x / d, cam.cy - cam.F * y / d, 1 / d];
  };
  return cam;
}

class View {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.zb = new Float32Array(W * H); this.hg = new Uint16Array(W * H); this.tb = new Uint8Array(W * H);
    this.hgAngle = new Map();
  }

  render(mesh, cam, light) {
    const { W, H, zb, hg, tb } = this, R = cam.R, t = cam.t, F = cam.F, D = cam.D, cx = cam.cx, cy = cam.cy;
    const nv = mesh.v.length, nf = mesh.faces.length;
    const wx = new Float32Array(nv), wy = new Float32Array(nv), wz = new Float32Array(nv);
    const sx = new Float32Array(nv), sy = new Float32Array(nv), iz = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const p = mv(R, mesh.v[i]);
      wx[i] = p[0] + t[0]; wy[i] = p[1] + t[1]; wz[i] = p[2] + t[2];
      const d = D - wz[i];
      sx[i] = cx + F * wx[i] / d; sy[i] = cy - F * wy[i] / d; iz[i] = 1 / d;
    }
    const front = new Uint8Array(nf), nW = new Array(nf);
    for (let i = 0; i < nf; i++) {
      const f = mesh.faces[i], n = mv(R, f.n);
      nW[i] = n;
      let ax = 0, ay = 0, az = 0;
      for (const v of f.idx) { ax += wx[v]; ay += wy[v]; az += wz[v]; }
      const k = 1 / f.idx.length;
      front[i] = (n[0] * -ax * k + n[1] * -ay * k + n[2] * (D - az * k)) > 0 ? 1 : 0;
    }
    const L = V.norm(light || [-0.55, 0.7, 0.55]), L2 = V.norm([0.6, -0.5, -0.3]);
    const toneOf = n => {
      const lam = Math.max(0, V.dot(n, L)), rim = Math.max(0, V.dot(n, L2)) * 0.16;
      return clamp(1 - (0.08 + 0.92 * Math.pow(lam, 0.85)) - rim, 0, 1);
    };
    zb.fill(0); hg.fill(0); tb.fill(0); this.hgAngle.clear();
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let fi = 0; fi < nf; fi++) {
      if (!front[fi]) continue;
      const f = mesh.faces[fi], idx = f.idx, n = idx.length, ct = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        if (f.tone != null) { ct[k] = f.tone; continue; }
        let sxn = 0, syn = 0, szn = 0;
        for (const g of mesh.vf[idx[k]]) {
          const m = nW[g];
          if (m[0] * nW[fi][0] + m[1] * nW[fi][1] + m[2] * nW[fi][2] > 0.78) { sxn += m[0]; syn += m[1]; szn += m[2]; }
        }
        ct[k] = toneOf(V.norm([sxn, syn, szn]));
      }
      const id = f.smooth ? 1 + f.part : 1000 + fi;
      if (!this.hgAngle.has(id)) {
        const q = nW[fi], pick = ((Math.abs(q[0]) * 2.3 + Math.abs(q[1]) * 3.7) | 0) % 4;
        this.hgAngle.set(id, f.smooth ? -58 : [-58, -80, -36, -14][pick]);
      }
      for (let k = 1; k < n - 1; k++) {
        const a = idx[0], b = idx[k], c = idx[k + 1];
        const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[c], y2 = sy[c];
        const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
        if (Math.abs(den) < 1e-9) continue;
        const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
        for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5, py = y + 0.5;
          const l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den, l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den, l2 = 1 - l0 - l1;
          if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
          const z = l0 * iz[a] + l1 * iz[b] + l2 * iz[c], i = y * W + x;
          if (z > zb[i]) { zb[i] = z; hg[i] = id; tb[i] = (l0 * ct[0] + l1 * ct[k] + l2 * ct[k + 1]) * 255; }
        }
        if (minx < bx0) bx0 = minx; if (miny < by0) by0 = miny; if (maxx > bx1) bx1 = maxx; if (maxy > by1) by1 = maxy;
      }
    }
    this.bbox = [bx0, by0, bx1, by1];
    this.info = { mesh, cam, wx, wy, wz, sx, sy, iz, front, nW };
    return this;
  }

  // mask of everything the mesh covers
  silhouette(mask) {
    const hg = this.hg, a = mask.a;
    for (let i = 0; i < hg.length; i++) if (hg[i]) a[i] = 1;
    return mask;
  }

  visible(x, y, z) {
    const W = this.W, H = this.H, zb = this.zb, xi = x | 0, yi = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const T = 1 - 0.02;
    if (z >= zb[yi * W + xi] * T) return true;
    if (xi > 0 && z >= zb[yi * W + xi - 1] * T) return true;
    if (xi < W - 1 && z >= zb[yi * W + xi + 1] * T) return true;
    if (yi > 0 && z >= zb[(yi - 1) * W + xi] * T) return true;
    if (yi < H - 1 && z >= zb[(yi + 1) * W + xi] * T) return true;
    return false;
  }

  drawEdges(pen, o) {
    o = o || {};
    const { mesh, cam, wx, wy, wz, sx, sy, front, nW } = this.info, rng = pen.rng;
    const cosC = Math.cos((o.crease || 38) * Math.PI / 180), list = [];
    for (const e of mesh.edges) {
      let kind = 0;
      if (e.f.length === 1) { if (front[e.f[0]]) kind = 3; }
      else {
        const f1 = e.f[0], f2 = e.f[1];
        if (front[f1] !== front[f2]) kind = 1;
        else if (front[f1] && V.dot(nW[f1], nW[f2]) < cosC) kind = 2;
      }
      if (kind) list.push({ a: e.a, b: e.b, kind });
    }
    const adj = new Map();
    list.forEach((e, i) => { for (const v of [e.a, e.b]) { if (!adj.has(v)) adj.set(v, []); adj.get(v).push(i); } });
    const used = new Uint8Array(list.length), chains = [];
    const extend = (ch, atEnd) => {
      for (;;) {
        const v = atEnd ? ch[ch.length - 1] : ch[0], pv = atEnd ? ch[ch.length - 2] : ch[1];
        const d0x = sx[v] - sx[pv], d0y = sy[v] - sy[pv], l0 = Math.hypot(d0x, d0y) || 1;
        let best = -1, bc = 0.75, bv = -1;
        for (const ei of adj.get(v) || []) {
          if (used[ei]) continue;
          const w = list[ei].a === v ? list[ei].b : list[ei].a, d1x = sx[w] - sx[v], d1y = sy[w] - sy[v];
          const c = (d0x * d1x + d0y * d1y) / (l0 * (Math.hypot(d1x, d1y) || 1));
          if (c > bc) { bc = c; best = ei; bv = w; }
        }
        if (best < 0) break;
        used[best] = 1;
        if (atEnd) ch.push(bv); else ch.unshift(bv);
      }
    };
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const ch = [list[i].a, list[i].b]; extend(ch, true); extend(ch, false);
      chains.push({ v: ch, kind: list[i].kind });
    }
    for (const c of chains) {
      const ch = c.v, pts = [];
      for (let k = 0; k < ch.length - 1; k++) {
        const a = ch[k], b = ch[k + 1], n = Math.max(1, Math.ceil(Math.hypot(sx[b] - sx[a], sy[b] - sy[a]) / 1.5));
        for (let s = k === 0 ? 0 : 1; s <= n; s++) {
          const t = s / n, X = wx[a] + (wx[b] - wx[a]) * t, Y = wy[a] + (wy[b] - wy[a]) * t, Z = wz[a] + (wz[b] - wz[a]) * t, d = cam.D - Z;
          const px = cam.cx + cam.F * X / d, py = cam.cy - cam.F * Y / d;
          pts.push([px, py, this.visible(px, py, 1 / d)]);
        }
      }
      const sil = c.kind === 1, st = { p: sil ? 0.95 : 0.86, speed: 0.22, wob: sil ? 0.55 : 0.5, tail: 5, head: 2.5 };
      let i = 0;
      while (i < pts.length) {
        if (!pts[i][2]) { i++; continue; }
        let e = i; while (e + 1 < pts.length && pts[e + 1][2]) e++;
        if (e - i >= 3) {
          const run = pts.slice(i, e + 1).map(p => [p[0], p[1]]);
          const ext = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, k = rng() * 2.2; return [a[0] + dx / l * k, a[1] + dy / l * k]; };
          if (i === 0) run.unshift(ext(run[0], run[1]));
          if (e === pts.length - 1) run.push(ext(run[run.length - 1], run[run.length - 2]));
          pen.trace(run, st);
          if (sil && rng() < (o.redo == null ? 0.45 : o.redo)) pen.trace(run, { p: 0.55, speed: 0.3, wob: 0.8, tail: 12, head: 4, blob: 0 });
        }
        i = e + 1;
      }
    }
  }

  hatchAll(pen, o) {
    o = o || {};
    const { W, hg, tb } = this, N = 65536;
    const mnx = new Int32Array(N).fill(1e6), mny = new Int32Array(N).fill(1e6), mxx = new Int32Array(N).fill(-1), mxy = new Int32Array(N).fill(-1), cnt = new Int32Array(N);
    const b = this.bbox;
    for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) {
      const g = hg[y * W + x]; if (!g) continue;
      cnt[g]++; if (x < mnx[g]) mnx[g] = x; if (x > mxx[g]) mxx[g] = x; if (y < mny[g]) mny[g] = y; if (y > mxy[g]) mxy[g] = y;
    }
    const ts = o.toneScale == null ? 1 : o.toneScale;
    for (let g = 1; g < N; g++) {
      if (cnt[g] < 18) continue;
      pen.shade({
        box: [mnx[g], mny[g], mxx[g] + 1, mxy[g] + 1],
        inside: (x, y) => hg[(y | 0) * W + (x | 0)] === g,
        tone: (x, y) => tb[(y | 0) * W + (x | 0)] * 0.00392157 * ts,
        angle: (this.hgAngle.get(g) || -58) + (o.angle || 0), gap: o.gap || 3.4, depth: o.depth || 3, free: true,
      });
    }
  }
}

G.BP.makeCam = makeCam; G.BP.View = View;
})(window);
