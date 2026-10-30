/* Ren's Workbench: what witches and monsters share.
   Pens that draw parts in colour roles, motifs that run across every part of a design,
   pieces built on joints the way the game builds them, and a posed, animated preview. */

const pyRound = v => { const f = Math.floor(v), d = v - f; return d > .5 + 1e-9 ? f + 1 : d < .5 - 1e-9 ? f : (f % 2 === 0 ? f : f + 1); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- a pen on one layer ----------
   A colour is a hex string or a function (x, y) -> hex | null, so a motif fills a shape. */
class Pen {
  constructor(w, h, cx, pal){ this.w = w; this.h = h; this.cx = cx; this.pal = pal; this.px = new Int16Array(w * h).fill(-1); }
  idx(c){ const k = c.toLowerCase(); let i = this.pal.keys.indexOf(k); if (i < 0){ this.pal.keys.push(k); this.pal.colors.push(unhex(k)); i = this.pal.keys.length - 1; } return i; }
  put(x, y, c){
    x = Math.trunc(x); y = Math.trunc(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const col = typeof c === 'function' ? c(x, y) : c; if (!col) return;
    this.px[y * this.w + x] = this.idx(col);
  }
  erase(x, y){ x = Math.trunc(x); y = Math.trunc(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = -1; }
  has(x, y){ return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[y * this.w + x] >= 0; }
  span(y, x0, x1, c){ for (let x = Math.trunc(x0); x < Math.trunc(x1); x++) this.put(x, y, c); }
  // a row centred on the middle line, hw either side
  rowC(y, hw, c, at = this.cx){ this.span(y, pyRound(at - hw + .5), pyRound(at + hw + .5), c); }
  disc(cx, cy, r, c){ const R = Math.ceil(r); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r + .3) this.put(cx + dx, cy + dy, c); }
  ellipse(cx, cy, rx, ry, c){
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++){
      const dx = (x + .5 - cx - .5) / Math.max(.5, rx), dy = (y + .5 - cy - .5) / Math.max(.5, ry);
      if (dx * dx + dy * dy <= 1.02) this.put(x, y, c);
    }
  }
  line(x0, y0, x1, y1, c){ const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.put(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); }
  // a tapered limb: discs along a line, radius r0 to r1
  limb(x0, y0, x1, y1, r0, r1, c){ const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let i = 0; i <= n; i++){ const t = i / n; this.disc(lerp(x0, x1, t), lerp(y0, y1, t), lerp(r0, r1, t), c); } }
  // a filled polygon, by scanline
  poly(pts, c){
    const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++){
      const xs = [], yc = y + .5;
      for (let i = 0; i < pts.length; i++){ const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this.span(y, Math.round(xs[i]), Math.round(xs[i + 1]), c);
    }
  }
  // both sides of the middle line: fn(sign) draws one
  both(fn){ fn(1); fn(-1); }
  mx(s, d){ return s > 0 ? this.cx + d : this.cx - d; }
  // a dark rim round whatever is drawn: the outline that makes small things read
  outline(c, onlyOuter = true){
    const out = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++){
      if (!this.has(x, y)) continue;
      if (!this.has(x - 1, y) || !this.has(x + 1, y) || !this.has(x, y - 1) || !this.has(x, y + 1)) out.push([x, y]);
    }
    if (onlyOuter) for (const [x, y] of out) this.put(x, y, c);
  }
}

/* ---------- motifs ----------
   One motif runs through a whole design: the hat band, the bodice, the hem and the stockings
   all take it, so the parts read as one outfit or one animal. */
const MOTIFS = {
  plain:     { label: 'plain' },
  stripes:   { label: 'stripes across', at: (x, y, k) => Math.floor(y / k) % 2 },
  pinstripe: { label: 'stripes down', at: (x, y, k, cx) => Math.floor(Math.abs(x - cx) / k) % 2 },
  harlequin: { label: 'harlequin', at: (x, y, k, cx) => (Math.floor((Math.abs(x - cx) + y) / k) + Math.floor((y - Math.abs(x - cx)) / k)) % 2 === 0 ? 1 : 0 },
  checks:    { label: 'checks', at: (x, y, k, cx) => (Math.floor(Math.abs(x - cx + .5) / k) + Math.floor(y / k)) % 2 },
  spots:     { label: 'spots', at: (x, y, k, cx) => { const P = k * 3, a = Math.abs(x - cx) + .5, col = Math.floor(a / P), u = (a % P) - P / 2, v = ((y + .5 + (col % 2) * P / 2) % P) - P / 2; return u * u + v * v <= k * k * .7 ? 1 : 0; } },
  honeycomb: { label: 'honeycomb', at: (x, y, k, cx) => { const a = Math.abs(x - cx), row = Math.floor(y / k), o = row % 2 ? k : 0; return (y % k === 0 || (a + o) % (k * 2) === 0) ? 1 : 0; } },
  lace:      { label: 'lace hems', hem: true, at: (x, y, k, cx) => (Math.abs(x - cx) + y) % 3 === 0 ? 1 : 0 },
  stars:     { label: 'stars', at: (x, y, k, cx) => { const a = Math.round(Math.abs(x - cx)), u = a % (k * 2), v = (y + (Math.floor(a / (k * 2)) % 2) * k) % (k * 2); return (u === k && Math.abs(v - k) <= 1) || (v === k && Math.abs(u - k) <= 1) ? 1 : 0; } },
  flecks:    { label: 'flecks', at: (x, y) => (hash32(Math.round(Math.abs(x)) * 73856093 ^ y * 19349663) % 11) === 0 ? 1 : 0 },
  zebra:     { label: 'zebra', at: (x, y, k, cx) => Math.floor((y + Math.sin(Math.abs(x - cx) * .9) * 1.5) / k) % 2 },
  eyes:      { label: 'eyes', eyes: true, at: (x, y, k, cx) => { const a = Math.abs(x - cx), u = a % (k * 3), v = (y + (Math.floor(a / (k * 3)) % 2) * k) % (k * 3); return u >= k && u <= k + 1 && v === k ? 2 : (Math.abs(u - k - .5) <= 1.5 && Math.abs(v - k) <= 1 ? 1 : 0); } },
};
// a fill in a motif: base role, the motif's marks in the accent (a third role for eyes' pupils)
function motifFill(c, motif, scale, base = 'main', accent = 'alt', cx = 13.5, third = 'ink'){
  const m = MOTIFS[motif];
  if (!m || !m.at || motif === 'plain') return c[base];
  return (x, y) => { const v = m.at(x, y, scale, cx); return v === 2 ? c[third] : v ? c[accent] : c[base]; };
}

/* ---------- colour roles ----------
   Parts never name a colour: they name a role. A scheme sets the few key roles and the rest follow. */
const KEY_ROLES = ['main', 'alt', 'trim', 'hair', 'accent'];
function deriveRoles(k){
  const m = unhex(k.main), a = unhex(k.alt), t = unhex(k.trim), h = unhex(k.hair || k.alt), x = unhex(k.accent || k.trim);
  return { ...k,
    shade: hex(mul(m, .62)), light: hex(mix(m, [255, 255, 255], .45)), deep: hex(mul(m, .4)),
    alt_d: hex(mul(a, .65)), trim_d: hex(mul(t, .8)), hair_d: hex(mul(h, .6)), hair_l: hex(mix(h, [255, 255, 255], .45)),
    accent_l: hex(mix(x, [255, 255, 255], .5)), shoe: hex(mul(m, .45)), metal: '#f2b23a', metal_d: '#b07a2a', glass: '#9be8ff',
    ink: '#1a0f1f', white: '#fff6fb', flame: '#ffe08a', flame_d: '#f2b23a' };
}
const lum = c => c[0] * .3 + c[1] * .59 + c[2] * .11;
const chroma = c => Math.max(...c) - Math.min(...c);
// a scheme from a palette: a mid-dark main, a contrasting alt, a light trim, the most vivid colour as accent
function schemeFrom(rng, list, prefer = {}){
  const L = list.length ? list : [[107, 45, 92], [176, 40, 122], [244, 230, 212], [242, 178, 58], [26, 15, 31]];
  const pick = (score, not = []) => { const opts = L.filter(c => !not.some(n => n && hexOf(n) === hexOf(c))).map(c => [score(c) + rng() * 30, c]).sort((p, q) => q[0] - p[0]); return (opts[0] || [0, L[0]])[1]; };
  // a tone steers the whole outfit: dark keeps main and alt low, bright puts the vivid colours first, pale lifts them
  const tone = prefer.tone || 'any';
  const mainScore = tone === 'dark' ? c => -lum(c) + chroma(c) * .15 : tone === 'bright' ? c => chroma(c) - Math.abs(lum(c) - 130) * .3 : tone === 'pale' ? c => lum(c) * .6 + chroma(c) * .3 - (lum(c) > 235 ? 80 : 0) : c => -Math.abs(lum(c) - 90) + chroma(c) * .3;
  const altScore = tone === 'dark' ? c => -Math.abs(lum(c) - lum(main) - 35) + chroma(c) * .25 : c => Math.abs(lum(c) - lum(main)) * .6 + chroma(c) * .4;
  const main = prefer.main ? unhex(prefer.main) : pick(mainScore);
  const alt = prefer.alt ? unhex(prefer.alt) : pick(altScore, [main]);
  const trim = prefer.trim ? unhex(prefer.trim) : pick(c => lum(c), [main, alt]);
  const accent = prefer.accent ? unhex(prefer.accent) : pick(c => chroma(c) + lum(c) * .2, [main, alt, trim]);
  const hair = prefer.hair ? unhex(prefer.hair) : rng() < .4 ? [[34, 26, 30], [92, 58, 40], [150, 96, 52], [228, 196, 120], [196, 84, 48], [232, 228, 222]][ri(rng, 6)] : pick(c => chroma(c) - Math.abs(lum(c) - 110) * .2, [main, trim]);
  return { main: hex(main), alt: hex(alt), trim: hex(trim), accent: hex(accent), hair: hex(hair) };
}

/* ---------- parts with dials ----------
   A part kind: { label, dials: [[key, label, min, max, step]], draw(pen, d, c, ctx) }.
   ctx carries the side ('front' or 'back'), the motif, its scale and anything a slot shares. */
function dialDefaults(kind, rng){
  const d = {};
  for (const [key, , a, b, step = 1, def] of kind.dials || []){
    if (a === 'check') d[key] = def != null ? def : rng ? rng() < .5 : false;
    else if (a === 'select') d[key] = def != null ? def : rng ? b[ri(rng, b.length)] : b[0];
    else d[key] = def != null && !rng ? def : rng ? Math.round((a + rng() * (b - a)) / step) * step : (a + b) / 2;
  }
  return d;
}
// a dial range a brief narrows: [lo, hi] or a fixed value
function dialsWithin(kind, rng, ranges = {}){
  const d = dialDefaults(kind, rng);
  for (const [key, r] of Object.entries(ranges)){
    const def = (kind.dials || []).find(x => x[0] === key); if (!def) continue;
    if (Array.isArray(r) && typeof r[0] === 'number' && def[2] !== 'select' && def[2] !== 'check'){ const step = def[4] || 1; d[key] = Math.round((r[0] + rng() * (r[1] - r[0])) / step) * step; }
    else if (Array.isArray(r)) d[key] = r[ri(rng, r.length)];
    else d[key] = r;
  }
  return d;
}

/* ---------- pieces: shells on joints, as witch.gd and creature.gd build them ---------- */
// one layer picture (w x h with its palette) as relief cells in canvas space; a back picture mirrors and domes backward
// rows: only the cells on these canvas rows [from, to), when one picture is shared by several joints
function shellCells(px, pal, w, h, depth, back, out, rows){
  const pic = { w, h, px, colors: pal.colors };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x] >= 0){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return out;
  const rw = x1 - x0 + 1, rh = y1 - y0 + 1, sx = x0 + Math.floor(rw / 2) - Math.floor(w / 2), sy = h - y0 - rh;
  for (const [x, y, z, c] of reliefCells(pic, depth)){
    if (c < 0) continue;
    let q = [x + sx, y + sy, z];
    if (rows && !(h - 1 - q[1] >= rows[0] && h - 1 - q[1] < rows[1])) continue;
    if (back) q = [-1 - q[0], q[1], -1 - q[2]];
    const col = pal.colors[c];
    out.set(q.join(','), [q[0], q[1], q[2], colourOf(col[0], col[1], col[2])]);
  }
  return out;
}
// cells to a grid that remembers where it sits
function cellsToPiece(map){
  const list = [...map.values()];
  if (!list.length) return null;
  const V = cellsToV(list);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity; for (const [x, y, z] of list){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); }
  V.origin = [x0, y0, z0];
  return V;
}

/* ---------- a skeleton posed ----------
   joints: { name: [parent, [x, y, z]] } in canvas voxels from the feet (y) and the middle (x).
   pose: { name: { rot: [x, y, z], pos: [x, y, z] (added), scale: [x, y, z] } }; rotations in Godot's YXZ order. */
function eulerYXZ([x, y, z]){
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  // Ry * Rx * Rz
  return [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
  ];
}
// quaternions, for turning from one pose to another the short way: [w, x, y, z]
function quatYXZ([x, y, z]){
  const q = (a, ax) => { const s = Math.sin(a / 2), c = Math.cos(a / 2); return [c, ax === 0 ? s : 0, ax === 1 ? s : 0, ax === 2 ? s : 0]; };
  return qmul(qmul(q(y, 1), q(x, 0)), q(z, 2));
}
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
function slerp(a, b, t){
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0){ b = b.map(v => -v); d = -d; }
  if (d > .9995){ const r = a.map((v, i) => v + (b[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); }
  const th = Math.acos(d), s = Math.sin(th), k0 = Math.sin((1 - t) * th) / s, k1 = Math.sin(t * th) / s;
  return a.map((v, i) => v * k0 + b[i] * k1);
}
const matOfQuat = ([w, x, y, z]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]];
function poseWorld(joints, pose){
  const world = {};
  const solve = name => {
    if (world[name]) return world[name];
    const [parent, here] = joints[name], p = pose[name] || {};
    let R = p.mat || eulerYXZ(p.rot || [0, 0, 0]);
    if (p.scale) R = mm(R, [[p.scale[0], 0, 0], [0, p.scale[1], 0], [0, 0, p.scale[2]]]);
    const off = p.pos || [0, 0, 0];
    // off: what hangs from this joint sits moved by this much, in the joint's own turned space
    if (!parent || !joints[parent]) return (world[name] = { R, t: [here[0] + off[0], here[1] + off[1], here[2] + off[2]], here, off: p.off });
    const P = solve(parent), ph = joints[parent][1], rel = mv(P.R, [here[0] - ph[0] + off[0], here[1] - ph[1] + off[1], here[2] - ph[2] + off[2]]);
    return (world[name] = { R: mm(P.R, R), t: [P.t[0] + rel[0], P.t[1] + rel[1], P.t[2] + rel[2]], here, off: p.off });
  };
  for (const name in joints) solve(name);
  return world;
}
// When pieces overlap in space (a hat brim over hair, a skirt over legs) whole faces can't be sorted
// back to front, so this draws per pixel with a depth buffer, as the game does. Exact ties go to the
// piece that should show: the hand over the hat over the head, the skirt over the legs.
const PIECE_RANK = ['hand', 'hat', 'head', 'crest', 'arml', 'armr', 'torso', 'body', 'seg3', 'seg2', 'seg1', 'skirt', 'legl', 'legr', 'legl1', 'legr1', 'legl2', 'legr2', 'legl3', 'legr3', 'tail', 'wings', 'hips'];
const rankOf = j => { const i = PIECE_RANK.indexOf(j); return i < 0 ? 50 : i; };
const ZB = { w: 0, h: 0, z: null, px: null, im: null, cv: null };
function drawRig(ctx, pieces, world, yaw, pitch, cx, cy, s, centre, turn = 0){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (ZB.w !== W || ZB.h !== H){
    Object.assign(ZB, { w: W, h: H, z: new Float32Array(W * H), cv: document.createElement('canvas') });
    ZB.cv.width = W; ZB.cv.height = H; ZB.im = ZB.cv.getContext('2d').createImageData(W, H); ZB.px = new Uint32Array(ZB.im.data.buffer);
  }
  const zb = ZB.z, px = ZB.px; zb.fill(Infinity); px.fill(0);
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), ct = Math.cos(turn), st = Math.sin(turn);
  // turn: the whole figure about its own up axis (the way it faces), before the camera
  const cam = (x, y, z) => { const tx = x * ct + z * st, tz = -x * st + z * ct; z = -tz; x = tx; const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
  const L = [-.45, .8, -.4], ll = Math.hypot(...L);
  // one triangle into the buffer; nearer is smaller z, and a tie keeps what is already there
  const tri = (a, b, c, col) => {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(area) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    // edge functions as planes in x and y, stepped along each row
    const k = 1 / area, e = -.02;
    const A0 = (b[1] - c[1]) * k, B0 = (c[0] - b[0]) * k, C0 = (b[0] * c[1] - c[0] * b[1]) * k;
    const A1 = (c[1] - a[1]) * k, B1 = (a[0] - c[0]) * k, C1 = (c[0] * a[1] - a[0] * c[1]) * k;
    const Az = A0 * a[2] + A1 * b[2] + (-A0 - A1) * c[2], Bz = B0 * a[2] + B1 * b[2] + (-B0 - B1) * c[2], Cz = C0 * a[2] + C1 * b[2] + (1 - C0 - C1) * c[2];
    for (let y = y0; y <= y1; y++){
      const py = y + .5, qx = x0 + .5;
      let w0 = A0 * qx + B0 * py + C0, w1 = A1 * qx + B1 * py + C1, z = Az * qx + Bz * py + Cz, i = y * W + x0;
      for (let x = x0; x <= x1; x++, w0 += A0, w1 += A1, z += Az, i++){
        if (w0 < e || w1 < e || 1 - w0 - w1 < e) continue;
        if (z < zb[i] - .01){ zb[i] = z; px[i] = col; }
      }
    }
  };
  const ordered = pieces.filter(pc => pc.V && world[pc.joint]).sort((a, b) => rankOf(a.joint) - rankOf(b.joint));
  for (const pc of ordered){
    const V = pc.V, Wj = world[pc.joint];
    const faces = V._faces || (V._faces = visibleFaces(V));
    const [ox, oy, oz] = V.origin, h = Wj.here;
    const so = Wj.off || [0, 0, 0];
    const toS = (x, y, z) => { const p = mv(Wj.R, [x + ox + so[0] - h[0], y + oy + so[1] - h[1], z + oz + so[2] - h[2]]); const q = cam(p[0] + Wj.t[0] - centre[0], p[1] + Wj.t[1] - centre[1], p[2] + Wj.t[2] - centre[2]); return [cx + q[0] * s, cy - q[1] * s, q[2]]; };
    const nrm = FACES.map(f => { const n = mv(Wj.R, f.n), q = cam(n[0], n[1], n[2]), l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l]; });
    const shade = nrm.map(n => .52 + .48 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll));
    const cache = new Map();
    for (const [x, y, z, fi, v] of faces){
      if (nrm[fi][2] >= -1e-6) continue;
      const key = v * 8 + fi;
      let col = cache.get(key);
      if (col === undefined){ const [r, g, b] = mul(COLORS[v], shade[fi]); col = (255 << 24 | b << 16 | g << 8 | r) >>> 0; cache.set(key, col); }
      const [q0, q1, q2, q3] = FACES[fi].q.map(q => toS(x + q[0], y + q[1], z + q[2]));
      tri(q0, q1, q2, col); tri(q0, q2, q3, col);
    }
  }
  ZB.cv.getContext('2d').putImageData(ZB.im, 0, 0);
  ctx.drawImage(ZB.cv, 0, 0);
}
const spring = (st, target, dt, k, damp) => { const v = st[1] + (target - st[0]) * k * dt - st[1] * damp * dt; return [st[0] + v * dt, v]; };

/* ---------- a stage that plays a rig ----------
   rig: { joints, pieces: [{ joint, V }], size: [w, h], animate(state, dt, t) -> pose } */
class RigStage {
  constructor(cv){
    this.cv = cv; this.g = cv.getContext('2d'); this.yaw = .5; this.pitch = -.28; this.spin = false; this.rig = null;
    this.walk = 0; this.play = true; this.aim = false; this.state = {}; this.t = 0; this.onspin = null;
    let last = performance.now();
    const tick = now => {
      if (!cv.isConnected && this._seen) return;
      if (cv.isConnected) this._seen = true;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (this.rig){
        if (this.spin) this.yaw += dt * .8;
        if (this.play) this.t += dt;
        const pose = this.rig.animate ? this.rig.animate(this.state, this.play ? dt : 0, this.t, this.walk, this.aim) : {};
        const world = poseWorld(this.rig.joints, pose), [w, h] = this.rig.size;
        const s = this.cv.width / (Math.hypot(w, h) * 1.2);
        this.g.clearRect(0, 0, cv.width, cv.height);
        // a floor line where the feet stand
        this.g.fillStyle = 'rgba(255,255,255,.05)'; this.g.beginPath(); this.g.ellipse(cv.width / 2, cv.height / 2 + h * .5 * s * Math.cos(this.pitch) + 4, w * .55 * s, w * .2 * s, 0, 0, Math.PI * 2); this.g.fill();
        drawRig(this.g, this.rig.pieces, world, this.yaw, this.pitch, cv.width / 2, cv.height / 2, s, [0, h / 2, 0], this.rig.turn || 0);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    cv.onpointerdown = e => {
      this.setSpin(false); cv.setPointerCapture(e.pointerId); let px = e.clientX, py = e.clientY;
      cv.onpointermove = m => { this.yaw += (m.clientX - px) * .01; this.pitch = clamp(this.pitch - (m.clientY - py) * .01, -1.5, 1.5); px = m.clientX; py = m.clientY; };
      cv.onpointerup = () => { cv.onpointermove = null; };
    };
  }
  set(rig){ this.rig = rig; if (this._aimBtn) this._aimBtn.hidden = !rig.aims; }
  setSpin(on){ this.spin = on; if (this.onspin) this.onspin(on); }
  bar(){
    const el = document.createElement('div'); el.className = 'stagebar';
    const add = (label, fn, on) => { const b = document.createElement('button'); b.textContent = label; if (on) b.classList.add('on'); b.onclick = () => fn(b); el.append(b); return b; };
    const spin = add('Spin', () => this.setSpin(!this.spin), this.spin); this.onspin = on => spin.classList.toggle('on', on);
    for (const [label, yaw] of [['Front', 0], ['Side', Math.PI / 2], ['Back', Math.PI]]) add(label, () => { this.setSpin(false); this.yaw = yaw; this.pitch = -.15; });
    const play = add('Move', b => { this.play = !this.play; b.classList.toggle('on', this.play); }, this.play);
    // a witch raises her wand arm, as when she casts in the game
    const aim = add('Aim', b => { this.aim = !this.aim; b.classList.toggle('on', this.aim); if (this.onaim) this.onaim(this.aim); }, this.aim); aim.title = 'Raise the wand arm, as when she casts';
    this._aimBtn = aim; aim.hidden = !(this.rig && this.rig.aims);
    const w = document.createElement('label'); w.className = 'walkdial'; w.innerHTML = '<span>walk</span>';
    const r = document.createElement('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = .05; r.value = this.walk; r.oninput = () => { this.walk = +r.value; };
    w.append(r); el.append(w);
    return el;
  }
}
