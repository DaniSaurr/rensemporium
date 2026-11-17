/* Ren's Workbench: work items and the generators that make them.
   A work item is one picture (and maybe a back picture) with its own small palette and the
   settings of the one builder that turns it into voxels: exactly one part of a dungeon recipe. */

const DEFAULT_BUILD = { depth: 3, depths: {}, border: null, shell: 0, backMode: 'none', backDepth: 3, lid: 1, dome: false, bodyHex: '', net: [8, 6, 5] };
let workIds = 0;
function newWork(o){
  return { id: ++workIds, kind: 'relief', w: 16, h: 16, front: new Int16Array(256).fill(-1), back: null, colors: [], glow: null, light: null,
    name: '', label: '', theme: '', made: 'generated', seed: 0, origin: null, ...o, build: { ...DEFAULT_BUILD, ...(o && o.build), depths: { ...((o && o.build && o.build.depths) || {}) } } };
}
function cloneWork(W){
  return { ...W, id: ++workIds, front: W.front.slice(), back: W.back && W.back.slice(), colors: W.colors.map(c => c.slice()),
    build: { ...W.build, depths: { ...W.build.depths }, net: W.build.net.slice(), border: W.build.border && W.build.border.slice() },
    glow: W.glow && { ...W.glow, colors: W.glow.colors.slice() }, light: W.light && { ...W.light }, _V: undefined };
}
// for keeping between visits
const workToJSON = W => ({ ...W, front: [...W.front], back: W.back && [...W.back], _V: undefined, _others: undefined });
const workFromJSON = o => newWork({ ...o, id: undefined, front: Int16Array.from(o.front), back: o.back && Int16Array.from(o.back) });

// the recipe part this work item saves as (and previews as: the preview reads the same part)
function workPart(W, png = '', backPng = '', at = [0, 0, 0]){
  const b = W.build, part = { png };
  if (W.kind === 'net') part.net = b.net.slice();
  else if (W.kind === 'slab'){
    part.slab = b.depth;
    const depths = Object.fromEntries(Object.entries(b.depths).filter(([k, v]) => v !== '' && v != null && +v !== b.depth && W.colors.some(c => hexOf(c) === k)));
    if (Object.keys(depths).length) part.depths = depths;
    if (b.border && b.border[0] > 0) part.border = b.border.slice();
  } else if (W.kind === 'relief'){
    part.relief = b.depth;
    if (b.shell > 0) part.shell = b.shell;
    if (b.backMode === 'same' || (b.backMode === 'picture' && W.back)){ part.back = b.backMode === 'same' ? 'same' : backPng; part.back_relief = b.backDepth; }
  } else if (W.kind === 'body'){
    part.body = b.depth; part.lid = b.lid;
    if (b.dome) part.dome = true;
    if (b.bodyHex) part.body_color = b.bodyHex;
  }
  part.at = at.slice();
  if (W.glow && W.glow.colors.length){ part.glow = { colors: W.glow.colors.slice(), above: W.glow.above }; if (W.glow.strength != null && W.glow.strength !== '') part.glow.strength = W.glow.strength; }
  if (W.light) part.light = { ...W.light };
  return part;
}
function localToGlobal(W, px){
  const map = W.colors.map(c => colourOf(c[0], c[1], c[2])), out = new Int16Array(px.length);
  for (let i = 0; i < px.length; i++) out[i] = px[i] >= 0 && px[i] < map.length ? map[px[i]] : -1;
  return out;
}
const netSize = n => [2 * n[2] + 2 * n[0], 2 * n[2] + n[1]];
function workVox(W){
  if (W._V) return W._V;
  const part = workPart(W, 'front', 'back');
  const pic = { w: W.w, h: W.h, px: localToGlobal(W, W.front), colors: COLORS };
  const back = part.back === 'same' ? 'same' : part.back ? { w: W.w, h: W.h, px: localToGlobal(W, W.back), colors: COLORS } : null;
  // the rest of a recipe this part came from, so it is seen in place
  const others = W._others || [];
  return (W._V = mergeParts([...others.slice(0, W.origin ? W.origin.part : 0), [partCells(part, pic, back), W.origin ? W.origin.at : [0, 0, 0]], ...others.slice(W.origin ? W.origin.part : 0)]));
}
const touch = W => { W._V = undefined; };
// a picture read from the game (shared palette) as a work item's own palette
function localise(picList){
  const used = [], map = new Map();
  const out = picList.map(pic => {
    if (!pic) return null;
    const px = new Int16Array(pic.w * pic.h).fill(-1);
    for (let i = 0; i < px.length; i++){ const v = pic.px[i]; if (v < 0) continue; if (!map.has(v)){ map.set(v, used.length); used.push(COLORS[v].slice()); } px[i] = map.get(v); }
    return { w: pic.w, h: pic.h, px };
  });
  return { colors: used, pics: out };
}
// nearest-neighbour onto a new size, for a back drawn at a different size than the front
function resample(p, w, h){
  if (p.w === w && p.h === h) return p.px;
  const out = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = p.px[Math.min(p.h - 1, Math.floor(y * p.h / h)) * p.w + Math.min(p.w - 1, Math.floor(x * p.w / w))];
  return out;
}
const isMirrored = (px, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) if (px[y * w + x] !== px[y * w + w - 1 - x]) return false; return true; };
// a colour changed: depths and glow follow it
function recolour(W, i, rgb){
  const was = hexOf(W.colors[i]), now = hexOf(rgb);
  W.colors[i] = rgb;
  if (W.build.depths[was] != null){ W.build.depths[now] = W.build.depths[was]; delete W.build.depths[was]; }
  if (W.glow) W.glow.colors = W.glow.colors.map(c => c === was ? now : c);
  if (W.build.bodyHex === was) W.build.bodyHex = now;
  touch(W);
}

/* ---------- palettes ---------- */
// pal: { mode: 'harmony' | 'random' | 'list', list: [[r,g,b]] }
function makeColors(rng, n, pal){
  if (pal.mode === 'random') return Array.from({ length: n }, () => [0, 0, 0].map(() => 50 + ri(rng, 166)));
  if (pal.mode === 'harmony'){
    const h0 = rng() * 360, step = rng() < .5 ? 25 + rng() * 20 : 137.5;
    return Array.from({ length: n }, (_, i) => hsl(h0 + i * step, .45 + rng() * .35, .35 + rng() * .35));
  }
  const src = pal.list && pal.list.length ? pal.list : [[230, 230, 230]], bag = src.slice(), out = [];
  for (let i = 0; i < n; i++){ if (!bag.length) bag.push(...src); out.push(bag.splice(ri(rng, bag.length), 1)[0].slice()); }
  return out;
}
// in a fixed palette, extra colours snap to the nearest palette colour so the theme holds
function snapper(pal){
  if (pal.mode !== 'list' || !pal.list.length) return c => c;
  return c => { let best = pal.list[0], bd = Infinity; for (const p of pal.list){ const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd){ bd = d; best = p; } } return best.slice(); };
}

/* ---------- patterns ---------- */
function keepLargest(c, n, neighbours, mirrors){
  const seen = new Uint8Array(n); let best = null;
  for (let i = 0; i < n; i++){
    if (c[i] < 0 || seen[i]) continue;
    const comp = [i], stack = [i]; seen[i] = 1;
    while (stack.length){ const j = stack.pop(); for (const k of neighbours(j)) if (k >= 0 && c[k] >= 0 && !seen[k]){ seen[k] = 1; stack.push(k); comp.push(k); } }
    if (!best || comp.length > best.length) best = comp;
  }
  if (!best) return;
  const keep = new Uint8Array(n); for (const i of best){ keep[i] = 1; if (mirrors) for (const j of mirrors(i)) keep[j] = 1; }
  for (let i = 0; i < n; i++) if (!keep[i]) c[i] = -1;
}
const around2D = (w, h) => i => { const x = i % w; return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w < w * h ? i + w : -1]; };
function mirrors2D(w, h, mx, my){
  return i => { const x = i % w, y = Math.floor(i / w), out = [];
    if (mx) out.push(y * w + (w - 1 - x)); if (my) out.push((h - 1 - y) * w + x); if (mx && my) out.push((h - 1 - y) * w + (w - 1 - x));
    return out; };
}
function genPattern(rng, w, h, o){
  const c = new Int16Array(w * h).fill(-1);
  const hw = o.mirrorX ? Math.ceil(w / 2) : w, hh = o.mirrorY ? Math.ceil(h / 2) : h;
  const k = o.core / 100, cx = (w - 1) / 2, cy = (h - 1) / 2;
  let band = ri(rng, o.n);
  const set = (x, y, v) => {
    c[y * w + x] = v;
    if (o.mirrorX) c[y * w + (w - 1 - x)] = v;
    if (o.mirrorY) c[(h - 1 - y) * w + x] = v;
    if (o.mirrorX && o.mirrorY) c[(h - 1 - y) * w + (w - 1 - x)] = v;
  };
  for (let y = 0; y < hh; y++){
    if (o.bands && (y === 0 || rng() < .45)) band = ri(rng, o.n);
    for (let x = 0; x < hw; x++){
      const dx = (x - cx) / Math.max(1, w / 2), dy = (y - cy) / Math.max(1, h / 2);
      const r = Math.min(1, Math.hypot(dx, dy) / 1.414);
      const pf = o.density / 100 * ((1 - k) + k * 1.9 * (1 - r));
      const roll = rng(), pick = ri(rng, o.n);
      if (roll < pf) set(x, y, o.bands ? band : pick);
    }
  }
  if (o.cleanup) keepLargest(c, w * h, around2D(w, h), mirrors2D(w, h, o.mirrorX, o.mirrorY));
  return c;
}
// colour roles: one body colour, then each accent claims cells by a symmetric rule
const ROLE_RULES = ['band', 'top', 'bottom', 'core', 'edge'];
const eyeColour = body => body[0] * .3 + body[1] * .59 + body[2] * .11 > 140 ? [24, 20, 28] : [245, 242, 230];
function applyRoles2D(c, w, h, rng, n){
  for (let i = 0; i < c.length; i++) if (c[i] >= 0) c[i] = 0;
  const rules = ROLE_RULES.slice(), filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && c[y * w + x] >= 0;
  const body = c.reduce((t, v) => t + (v >= 0), 0), mid = (w - 1) / 2;
  let budget = Math.floor(body * .4);
  for (let a = 1; a < n && rules.length; a++){
    while (rules.length){
      const rule = rules.splice(ri(rng, rules.length), 1)[0], rows = new Set();
      if (rule === 'band'){ const ys = [...new Set(Array.from(c.keys()).filter(i => c[i] >= 0).map(i => Math.floor(i / w)))]; for (let k = 0; k < 1 + ri(rng, 2) && ys.length; k++) rows.add(ys.splice(ri(rng, ys.length), 1)[0]); }
      const hits = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
        if (c[y * w + x] !== 0) continue;
        const hit = rule === 'band' ? rows.has(y) : rule === 'top' ? !filled(x, y - 1) : rule === 'bottom' ? !filled(x, y + 1)
          : rule === 'core' ? Math.abs(x - mid) < 1 : !filled(x - 1, y) || !filled(x + 1, y);
        if (hit) hits.push(y * w + x);
      }
      if (!hits.length || hits.length > budget) continue;
      for (const i of hits) c[i] = a;
      budget -= hits.length;
      break;
    }
  }
}
// eyes: two enclosed holes in the upper half light up, or failing that two cells inside the body
function applyEyes2D(c, w, h, rng, eye, mirror){
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && c[y * w + x] >= 0;
  const holes = [], inner = [];
  for (let y = 1; y < Math.ceil(h * .6); y++) for (let x = 1; x < (mirror ? Math.floor(w / 2) : w - 1); x++){
    if (mirror && w % 2 && x === (w - 1) / 2) continue;
    const ring = filled(x - 1, y) && filled(x + 1, y) && filled(x, y - 1) && filled(x, y + 1);
    if (!ring) continue;
    (filled(x, y) ? inner : holes).push([x, y]);
  }
  const pool = holes.length ? holes : inner;
  if (!pool.length) return false;
  const [x, y] = pool[ri(rng, pool.length)];
  c[y * w + x] = eye; if (mirror) c[y * w + (w - 1 - x)] = eye;
  return true;
}
// enclosed holes become body: a hole in a toy only makes a pit with its own dome round it
function fillHoles(c, w, h, v){
  const outside = new Uint8Array(w * h), stack = [];
  const seed = i => { if (c[i] < 0 && !outside[i]){ outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++){ seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++){ seed(y * w); seed(y * w + w - 1); }
  while (stack.length){
    const i = stack.pop(), x = i % w, y = Math.floor(i / w);
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]){
      if (a < 0 || b < 0 || a >= w || b >= h) continue;
      const j = b * w + a; if (c[j] < 0 && !outside[j]){ outside[j] = 1; stack.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) if (c[i] < 0 && !outside[i]) c[i] = v;
}

/* ---------- the generators ---------- */
const GEN_KINDS = {
  lathe:  { label: 'Vessel (lathe)', styles: ['candle', 'urn', 'pillar', 'bottle', 'egg', 'stack'] },
  slab:   { label: 'Panel (slab)', styles: ['door', 'window', 'portrait', 'curtain', 'banner'] },
  relief: { label: 'Creature (relief)', styles: [] },
  net:    { label: 'Box (box net)', styles: [] },
};
const GEN_FIELDS = {
  lathe:  [['w', 'Width', 3, 31], ['h', 'Height', 4, 48], ['detail', 'Detail %', 0, 100], ['stripes', 'Stripes round it', 'check']],
  slab:   [['w', 'Width', 4, 48], ['h', 'Height', 4, 64], ['depth', 'Depth', 1, 12], ['frame', 'Frame', 0, 6], ['detail', 'Detail %', 0, 100]],
  relief: [['w', 'Width', 4, 32], ['h', 'Height', 4, 32], ['density', 'Fill %', 0, 100], ['core', 'Pull to middle %', 0, 100],
           ['front', 'Front depth', 1, 12], ['back', 'Back depth', 0, 12], ['backStyle', 'Back', 'select', ['plain', 'spots', 'stripe', 'same']]],
  net:    [['w', 'Width', 2, 32], ['h', 'Height', 2, 32], ['d', 'Depth', 2, 32], ['density', 'Fill %', 0, 100], ['core', 'Pull to middle %', 0, 100],
           ['front', 'A front face', 'check'], ['wrap', 'Bands round the sides', 'check'], ['matched', 'Matched sides', 'check'], ['rim', 'Rim', 'check']],
};
const GEN_DEFAULTS = {
  lathe: { style: 'any', w: 13, h: 22, detail: 50, stripes: false },
  slab: { style: 'any', w: 16, h: 28, depth: 2, frame: 2, detail: 50 },
  relief: { w: 12, h: 12, density: 55, core: 40, front: 4, back: 3, backStyle: 'plain' },
  net: { w: 10, h: 8, d: 6, density: 45, core: 20, front: true, wrap: true, matched: true, rim: true },
};
function generate(kind, seed, p, look){
  const rng = mulberry32(seed), W = kind === 'lathe' ? genLathe(rng, p, look) : kind === 'slab' ? genSlab(rng, p, look) : kind === 'net' ? genNet(rng, p, look) : genRelief(rng, p, look);
  W.seed = seed; W.made = 'generated';
  return W;
}
// a profile of radii, top to bottom, each row with a colour role; the lathe spins it
function genLathe(rng, p, look){
  const colors = makeColors(rng, Math.max(3, look.n), look.pal), snap = snapper(look.pal);
  const R0 = Math.max(2, Math.floor(p.w / 2)), W = 2 * R0 + 1, H = p.h;
  const style = p.style === 'any' ? GEN_KINDS.lathe.styles[ri(rng, 6)] : p.style;
  const r = new Float32Array(H).fill(-1), role = new Int8Array(H);
  const body = 0, accent = 1, trim = 2;
  const extra = c => { colors.push(snap(c)); return colors.length - 1; };
  const run = (y0, y1, f, ro) => { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++){ const t = (y - y0) / Math.max(1, y1 - y0 - 1); r[y] = f(t); role[y] = ro; } };
  const rows = k => Math.max(1, Math.round(H * k));
  if (style === 'candle'){
    const flame = Math.max(3, rows(.18)), rc = Math.max(1, Math.round(R0 * (.35 + rng() * .25))), dish = rng() < .5 ? 2 : 0;
    const hot = extra([255, 224, 138]), warm = extra([242, 178, 58]), wick = extra([40, 30, 34]);
    const rf = Math.max(.5, rc * .45);
    run(0, flame, t => t < .5 ? rf * t * 2 : rf * Math.sqrt(Math.max(0, 1 - Math.pow((t - .5) * 2, 2)) * .8 + .2), 0);
    for (let y = 0; y < flame; y++) role[y] = y < flame * .55 ? hot : warm;
    run(flame, flame + 1, () => 0, wick);
    run(flame + 1, H - dish, () => rc, body);
    run(H - dish, H, () => R0, trim);
  } else if (style === 'pillar'){
    const base = Math.max(2, rows(.08)), shaft = Math.max(1, Math.round(R0 * (.45 + rng() * .2)));
    run(0, base, () => R0, trim); run(base, base + 1, () => R0 - 1, accent);
    run(base + 1, H - base - 1, () => shaft, body);
    run(H - base - 1, H - base, () => R0 - 1, accent); run(H - base, H, () => R0, trim);
  } else if (style === 'urn'){
    const lip = 1, neck = rows(.12), belly = rows(.55);
    run(0, lip, () => R0 * .65, trim); run(lip, lip + neck, () => R0 * .4, body);
    run(lip + neck, lip + neck + belly, t => R0 * .4 + R0 * .6 * Math.sin(Math.PI * t), body);
    run(lip + neck + belly, H - 1, t => R0 * (.45 - .1 * t), body); run(H - 1, H, () => R0 * .65, trim);
  } else if (style === 'bottle'){
    const cork = 2, neck = rows(.2), shoulder = rows(.12), corkC = extra([176, 132, 84]);
    run(0, cork, () => .8, corkC); run(cork, cork + neck, () => 1, body);
    run(cork + neck, cork + neck + shoulder, t => 1 + (R0 * .85 - 1) * Math.sin(Math.PI / 2 * t), body);
    run(cork + neck + shoulder, H - 1, () => R0 * .85, body); run(H - 1, H, () => R0 * .85, trim);
  } else if (style === 'egg'){
    const c = H * .55;
    run(0, H, t => { const y = t * (H - 1), u = (y - c) / (H / 2); return R0 * Math.sqrt(Math.max(0, 1 - u * u)) * (y < c ? 1 - .18 * (c - y) / c : 1); }, body);
  } else {
    let y = 0; const k = 2 + ri(rng, 4);
    for (let i = 0; i < k; i++){
      const hseg = i === k - 1 ? H - y : Math.max(2, Math.round((H - y) / (k - i) * (.6 + rng() * .8))), rad = R0 * (.3 + rng() * .7), kind = ri(rng, 3);
      run(y, y + hseg, t => kind === 0 ? rad : kind === 1 ? rad * (.4 + .6 * Math.sin(Math.PI * t)) : rad * (.3 + .7 * t), i % 2 ? accent : body);
      y += hseg;
    }
  }
  for (let y = 0; y < H; y++) if (role[y] === body && rng() < p.detail / 100 * .22) role[y] = accent;
  const px = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++){
    if (r[y] < 0) continue;
    const half = Math.round(r[y]);
    for (let x = 0; x < W; x++){
      const dx = Math.abs(x - R0); if (dx > half) continue;
      px[y * W + x] = p.stripes && role[y] === body && dx % 2 === 1 ? accent : role[y];
    }
  }
  const glow = style === 'candle' ? { colors: [hexOf(colors[colors.length - 3]), hexOf(colors[colors.length - 2])], above: .8 } : null;
  const light = style === 'candle' ? { color: 'ff9a4a', energy: 1.4, range: 70 } : null;
  return newWork({ kind: 'lathe', w: W, h: H, front: px, colors, style, label: style, glow, light });
}
// a framed panel, mirrored, with a colour per material so each can stand out its own depth
function genSlab(rng, p, look){
  const colors = makeColors(rng, Math.max(3, look.n), look.pal), snap = snapper(look.pal);
  const W = p.w, H = p.h, cx = (W - 1) / 2, style = p.style === 'any' ? GEN_KINDS.slab.styles[ri(rng, 5)] : p.style;
  const extra = c => { colors.push(snap(c)); return colors.length - 1; };
  const arch = style === 'door' || style === 'window' ? (rng() < .5 ? 'round' : 'lancet') : 'none';
  const archH = Math.round(Math.min(H * .4, W * .6)), notch = style === 'banner' ? Math.max(2, Math.round(H * .15)) : 0;
  const inside = (x, y) => {
    if (arch !== 'none' && y < archH){
      if (arch === 'round'){ const dx = (x - cx) / (W / 2), dy = (archH - y - .5) / archH; return dx * dx + dy * dy <= 1; }
      return Math.abs(x - cx) <= (W / 2) * Math.pow((y + .5) / archH, .6);
    }
    if (notch && y >= H - notch) return Math.abs(x - cx) >= (y - (H - notch) + 1) * (W / 2) / notch;
    return true;
  };
  const px = new Int16Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) px[y * W + x] = 0;
  const dist = edgeDistance({ w: W, h: H, px });
  const d = p.depth, depthOf = {};
  const frameC = extra(mul(colors[2], .8));
  const paint = fn => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ const i = y * W + x; if (px[i] < 0) continue; const v = fn(x, y, i); if (v !== undefined) px[i] = v; } };
  let glow = null, light = null;
  if (style === 'door'){
    const wood2 = extra(mul(colors[0], .82)), seam = extra(mul(colors[0], .45)), iron = extra([74, 66, 80]), gold = extra([242, 178, 58]);
    const pw = 2 + ri(rng, 2), straps = [Math.round(H * .3), Math.round(H * .75)];
    paint((x, y) => {
      const k = Math.floor(Math.abs(x - cx) / pw);
      if (straps.some(s => y >= s && y < s + 2)) return iron;
      if (Math.abs(x - cx) % pw === pw - 1 && Math.abs(x - cx) > 0) return seam;
      return k % 2 ? wood2 : 0;
    });
    const hy = Math.round(H * .55), hx = Math.round(cx + W / 4); if (px[hy * W + hx] >= 0) px[hy * W + hx] = gold;
    Object.assign(depthOf, { [iron]: d + 1, [gold]: d + 1, [seam]: Math.max(1, d - 1) });
  } else if (style === 'window'){
    const lead = extra([58, 52, 64]), k = 3 + ri(rng, 2), glass = [0, 1, extra(mul(colors[1], 1.25))], pick = new Map();
    paint((x, y) => {
      const mx = Math.min(x, W - 1 - x);
      if (mx % k === 0 || y % k === 0) return lead;
      const key = Math.floor(mx / k) + ',' + Math.floor(y / k);
      if (!pick.has(key)) pick.set(key, glass[ri(rng, glass.length)]);
      return pick.get(key);
    });
    Object.assign(depthOf, { [lead]: d + 1 });
    glow = { colors: glass.map(i => hexOf(colors[i])), above: 0, strength: .3 };
    light = { color: hexOf(colors[glass[0]]), energy: 1.5, range: 80 };
  } else if (style === 'portrait'){
    const ground = extra(mul(colors[1], .35)), f = p.frame + 1;
    paint(() => ground);
    const iw = Math.max(3, W - 2 * f - 2), ih = Math.max(3, H - 2 * f - 2);
    const face = genPattern(rng, iw, ih, { density: 60, core: 50, mirrorX: true, mirrorY: false, n: 2, bands: false, cleanup: true });
    if (look.roles) applyRoles2D(face, iw, ih, rng, 2);
    if (look.eyes){ const e = colors.length; if (applyEyes2D(face, iw, ih, rng, e, true)) colors.push(snap(eyeColour(colors[0]))); }
    const ox = Math.floor((W - iw) / 2), oy = Math.floor((H - ih) / 2);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++){ const v = face[y * iw + x]; if (v >= 0) px[(oy + y) * W + ox + x] = v; }
  } else if (style === 'curtain'){
    const ridge = extra(mul(colors[0], 1.3)), valley = extra(mul(colors[0], .55)), rod = extra([242, 178, 58]), fw = 3 + ri(rng, 3);
    paint((x, y) => {
      if (y === 0) return rod;
      const ph = (Math.min(x, W - 1 - x) % fw) / fw;
      return ph < .25 ? ridge : ph < .5 ? 0 : ph < .75 ? valley : 0;
    });
    Object.assign(depthOf, { [ridge]: d + 4, [valley]: d, [rod]: d + 4 }); depthOf[0] = d + 2;
  } else {
    const rod = extra([242, 178, 58]), iw = Math.max(3, Math.round(W * .6)), ih = Math.max(3, Math.round(H * .4));
    paint((x, y) => y === 0 ? rod : (Math.min(x, W - 1 - x) === 1 ? 1 : 0));
    const em = genPattern(rng, iw, ih, { density: 55, core: 60, mirrorX: true, mirrorY: false, n: 2, bands: false, cleanup: true });
    const ox = Math.floor((W - iw) / 2), oy = Math.round(H * .18);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++){ const v = em[y * iw + x]; if (v >= 0 && oy + y < H && px[(oy + y) * W + ox + x] >= 0) px[(oy + y) * W + ox + x] = v + 1; }
    Object.assign(depthOf, { [rod]: d + 1 });
  }
  if (p.frame > 0) for (let i = 0; i < W * H; i++) if (dist[i] && dist[i] <= p.frame) px[i] = frameC;
  depthOf[frameC] = d + (style === 'portrait' ? 3 : 2);
  if (p.detail > 60 && p.frame > 0){ const stud = extra(mul(colors[2], 1.35)); for (let i = 0; i < W * H; i++) if (px[i] === frameC && (i % W + Math.floor(i / W)) % 4 === 0) px[i] = stud; depthOf[stud] = d + 3; }
  const depths = {};
  for (const [idx, n] of Object.entries(depthOf)) if (n !== d) depths[hexOf(colors[idx])] = n;
  return newWork({ kind: 'slab', w: W, h: H, front: px, colors, style, label: style, glow, light, build: { depth: d, depths } });
}
// a front picture and a back picture, domed both ways
function genRelief(rng, p, look){
  const n = Math.max(2, look.n), colors = makeColors(rng, n, look.pal), snap = snapper(look.pal), w = p.w, h = p.h;
  const front = genPattern(rng, w, h, { density: p.density, core: p.core, mirrorX: true, mirrorY: false, n, bands: false, cleanup: true });
  if (look.roles) applyRoles2D(front, w, h, rng, n);
  if (look.eyes){ const e = colors.length; if (applyEyes2D(front, w, h, rng, e, true)) colors.push(snap(eyeColour(colors[0]))); }
  fillHoles(front, w, h, 0);
  let back = null;
  const sided = p.back > 0 && p.backStyle !== 'same';
  if (sided){
    back = new Int16Array(w * h).fill(-1); const accent = Math.min(1, colors.length - 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < Math.ceil(w / 2); x++){
      if (front[y * w + (w - 1 - x)] < 0) continue;
      const v = p.backStyle === 'spots' && rng() < .16 ? accent : p.backStyle === 'stripe' && Math.abs(x - (w - 1) / 2) < 1 ? accent : 0;
      back[y * w + x] = v; back[y * w + (w - 1 - x)] = v;
    }
  }
  return newWork({ kind: 'relief', w, h, front, back, colors, label: 'creature',
    build: { depth: p.front, backMode: p.back <= 0 ? 'none' : sided ? 'picture' : 'same', backDepth: Math.max(1, p.back) } });
}
// six faces in a cross, folded by boxnet.gd
function genNet(rng, p, look){
  const n = Math.max(2, look.n), colors = makeColors(rng, n, look.pal), snap = snapper(look.pal);
  const rimIdx = colors.length; colors.push(snap(mul(colors[0], .55)));
  const { w, h, d } = p, W = 2 * d + 2 * w, H = 2 * d + h;
  const px = new Int16Array(W * H).fill(-1);
  const quiet = p.front ? .45 : 1;
  const face = (fw, fh, k = quiet) => genPattern(rng, fw, fh, { density: p.density * k, core: p.core, mirrorX: true, mirrorY: false, n: n - 1, bands: false, cleanup: false });
  let front;
  if (p.front){
    front = genPattern(rng, w, h, { density: Math.min(95, p.density * 1.3), core: Math.max(p.core, 70), mirrorX: true, mirrorY: false, n: n - 1, bands: false, cleanup: true });
    if (look.eyes){ const e = colors.length; if (applyEyes2D(front, w, h, rng, e - 1, true)) colors.push(snap(eyeColour(colors[1] || colors[0]))); }
  } else front = face(w, h, 1);
  const left = face(d, h), top = face(w, d);
  const back = p.matched && !p.front ? front : face(w, h), right = p.matched ? left : face(d, h), bottom = p.matched ? top : face(w, d);
  const paste = (pat, ox, oy, fw, fh) => {
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++){
      const v = pat[y * fw + x];
      let out = v >= 0 ? v + 1 : 0;
      if (p.rim && (x === 0 || y === 0 || x === fw - 1 || y === fh - 1)) out = rimIdx;
      px[(oy + y) * W + ox + x] = out;
    }
  };
  paste(top, d, 0, w, d);
  paste(left, 0, d, d, h); paste(front, d, d, w, h); paste(right, d + w, d, d, h); paste(back, 2 * d + w, d, w, h);
  paste(bottom, d, d + h, w, d);
  if (p.wrap && h > 2){
    const rows = new Set(), colour = 1 + ri(rng, n - 1);
    for (let k = 0; k < 1 + ri(rng, 2); k++) rows.add(1 + ri(rng, h - 2));
    for (const y of rows) for (let x = 0; x < W; x++){ const i = (d + y) * W + x; if (px[i] === 0) px[i] = colour; }
  }
  return newWork({ kind: 'net', w: W, h: H, front: px, colors, label: 'box', build: { net: [w, h, d] } });
}

/* ---------- more like this: the same thing, nudged ---------- */
function nudgeColour(W, rng){ const j = ri(rng, W.colors.length); recolour(W, j, W.colors[j].map(v => clamp255(v + ri(rng, 71) - 35))); }
function countPieces(c, n, neighbours){
  const seen = new Uint8Array(n); let count = 0;
  for (let i = 0; i < n; i++){
    if (c[i] < 0 || seen[i]) continue;
    count++; const stack = [i]; seen[i] = 1;
    while (stack.length){ const j = stack.pop(); for (const k of neighbours(j)) if (k >= 0 && k < n && c[k] >= 0 && !seen[k]){ seen[k] = 1; stack.push(k); } }
  }
  return count;
}
// grow from the body, shave an edge, borrow a neighbour's colour, or drift a colour
function mutateWork(src, seed, strength, drift){
  const W = cloneWork(src), rng = mulberry32(seed), edits = Math.max(1, Math.round(strength * (.6 + rng() * .8)));
  W.seed = seed; W.made = src.made === 'hand-drawn' ? 'hand-drawn, varied' : src.made; W.origin = null; W._others = undefined;
  const { w, h } = W, f = W.front;
  if (W.kind === 'net'){
    const [nw, nh, nd] = W.build.net, faces = netFaces(nw, nh, nd);
    for (let e = 0; e < edits; e++){
      if (drift && rng() < .15){ nudgeColour(W, rng); continue; }
      const [fx, fy, fw, fh] = faces[ri(rng, 6)];
      if (fw < 3 || fh < 3) continue;
      const x = 1 + ri(rng, fw - 2), y = 1 + ri(rng, fh - 2), v = ri(rng, W.colors.length);
      f[(fy + y) * w + fx + x] = v; f[(fy + y) * w + fx + (fw - 1 - x)] = v;
    }
    return W;
  }
  const mirror = isMirrored(f, w, h);
  const set = (x, y, v) => { f[y * w + x] = v; if (mirror) f[y * w + (w - 1 - x)] = v; };
  const get = (x, y) => f[y * w + x];
  const pieces = () => countPieces(f, w * h, around2D(w, h));
  for (let done = 0, tries = 0; done < edits && tries < edits * 8; tries++){
    const r = rng(), cells = []; f.forEach((v, i) => { if (v >= 0) cells.push([i % w, Math.floor(i / w)]); });
    if (!cells.length) break;
    const [x, y] = cells[ri(rng, cells.length)], nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h);
    if (r < .38){ const empty = nb.filter(([a, b]) => get(a, b) < 0); if (empty.length){ const [a, b] = empty[ri(rng, empty.length)]; set(a, b, get(x, y)); done++; } }
    else if (r < .72){
      if (cells.length > 2 && (nb.length < 4 || nb.some(([a, b]) => get(a, b) < 0))){
        const before = pieces(), old = get(x, y); set(x, y, -1);
        if (pieces() > before) set(x, y, old); else done++;
      }
    }
    else if (r < .9 || !drift){ const full = nb.filter(([a, b]) => get(a, b) >= 0 && get(a, b) !== get(x, y)); if (full.length){ const [a, b] = full[ri(rng, full.length)]; set(x, y, get(a, b)); done++; } }
    else { nudgeColour(W, rng); done++; }
  }
  touch(W);
  return W;
}
