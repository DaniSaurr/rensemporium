/* Ren's Workbench: the shared pieces. Colours, the dungeon's voxel builders and the renderer. */

/* ---------- numbers and colours ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash32(n){n=Math.imul(n^n>>>16,0x45d9f3b);n=Math.imul(n^n>>>16,0x45d9f3b);return(n^n>>>16)>>>0;}
function seedFromText(s){const n=Number(s);if(Number.isInteger(n)&&n>=0)return n>>>0;let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const ri = (rng, n) => Math.floor(rng() * n);
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const hexOf = c => hex(c).slice(1);
const unhex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
const mul = (c, k) => c.map(v => clamp255(v * k));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const gdRound = v => Math.sign(v) * Math.round(Math.abs(v));
function hsl(h, s, l){h=((h%360)+360)%360/360;const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return[f(0),f(8),f(4)];}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// every picture read from the game shares one palette, so parts from different pictures merge without remapping
const COLORS = [], colourIndex = new Map();
function colourOf(r, g, b){ const k = (r << 16) | (g << 8) | b; let i = colourIndex.get(k); if (i === undefined){ i = COLORS.length; COLORS.push([r, g, b]); colourIndex.set(k, i); } return i; }

/* ---------- the dungeon's builders (lathe.gd, boxnet.gd, voxels.gd), as in the hatcher ---------- */
function cropPic(pic){
  let x0 = pic.w, y0 = pic.h, x1 = -1, y1 = -1;
  for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) if (pic.px[y * pic.w + x] >= 0){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return { w: 0, h: 0, px: new Int16Array(0), colors: pic.colors };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = pic.px[(y0 + y) * pic.w + x0 + x];
  return { w, h, px, colors: pic.colors };
}
// lathe: each row a disc as wide as the row, coloured from the column it lines up with
function latheCells(pic){
  const im = cropPic(pic), { w, h, px } = im, cx = (w - 1) * .5, out = [];
  for (let y = 0; y < h; y++){
    let left = -1, right = -1;
    for (let x = 0; x < w; x++) if (px[y * w + x] >= 0){ if (left < 0) left = x; right = x; }
    if (left < 0) continue;
    const r = Math.max(cx - left, right - cx) + .5, rr = Math.ceil(r);
    for (let vx = -rr; vx <= rr; vx++) for (let vz = -rr; vz <= rr; vz++){
      if (vx * vx + vz * vz > r * r) continue;
      const k = Math.abs(vx) >= Math.abs(vz) ? vz : vx;
      const at = Math.max(left, Math.min(right, gdRound(cx + k)));
      let c = px[y * w + at];
      if (c < 0){
        c = -1;
        for (let d = 1; d <= right - left && c < 0; d++) for (const s2 of [at - d, at + d]) if (s2 >= left && s2 <= right && px[y * w + s2] >= 0){ c = px[y * w + s2]; break; }
      }
      out.push([vx, h - 1 - y, vz, c]);
    }
  }
  return out;
}
// slab: flat at the back, each pixel pushed forward its colour's depth; a border can override
function slabCells(pic, depth, depths = {}, border = []){
  const im = cropPic(pic), { w, h, px, colors } = im, out = [], hw = Math.floor(w / 2);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++){
    const c = px[y * w + x]; if (c < 0) continue;
    let n = depths[hexOf(colors[c])] ?? depth;
    if (border.length === 2 && Math.min(x, y, w - 1 - x, h - 1 - y) < border[0]) n = border[1];
    for (let z = 0; z < n; z++) out.push([x - hw, h - 1 - y, z, c]);
  }
  return out;
}
function edgeDistance(im){
  const { w, h, px } = im, dist = new Int16Array(w * h), solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[y * w + x] >= 0;
  let frontier = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
    if (solid(x, y) && (!solid(x + 1, y) || !solid(x - 1, y) || !solid(x, y + 1) || !solid(x, y - 1))){ dist[y * w + x] = 1; frontier.push([x, y]); }
  while (frontier.length){
    const next = [];
    for (const [x, y] of frontier) for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
      if (solid(a, b) && !dist[b * w + a]){ dist[b * w + a] = dist[y * w + x] + 1; next.push([a, b]); }
    frontier = next;
  }
  return dist;
}
// relief: a dome over a flat back; a shell hollows the back; a back picture domes backward too
function reliefCells(pic, maxDepth, shell = 0, back = null, backDepth = 0){
  const im = cropPic(pic), { w, h, px } = im, dist = edgeDistance(im), out = [], hw = Math.floor(w / 2);
  const bk = back && back !== 'same' ? cropPic(back) : null;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++){
    const d = dist[y * w + x]; if (!d) continue;
    const c = px[y * w + x], front = Math.min(d, maxDepth), b0 = shell <= 0 ? 0 : Math.max(0, front - shell);
    for (let z = b0; z < front; z++) out.push([x - hw, h - 1 - y, z, c]);
    if (backDepth > 0){
      let bc = c;
      if (bk && bk.w){   // the back is drawn as seen from behind, so x runs the other way
        const bx = gdRound((1 - x / Math.max(1, w - 1)) * (bk.w - 1)), by = gdRound(y / Math.max(1, h - 1) * (bk.h - 1));
        const v = bk.px[by * bk.w + bx]; if (v >= 0) bc = v;
      }
      for (let z = 1; z <= Math.min(d, backDepth); z++) out.push([x - hw, h - 1 - y, -z, bc]);
    }
  }
  return out;
}
// body: a deep body in the commonest outline colour, the picture on top as a lid (domed if asked)
function bodyCells(pic, depth, bodyHex, lid, dome){
  const im = cropPic(pic), { w, h, px } = im, hw = Math.floor(w / 2), solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[y * w + x] >= 0;
  let body;
  if (bodyHex){ const c = unhex(bodyHex); body = colourOf(c[0], c[1], c[2]); }
  else {
    const counts = new Map();
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
      if (solid(x, y) && !(solid(x + 1, y) && solid(x - 1, y) && solid(x, y + 1) && solid(x, y - 1))){ const k = px[y * w + x]; counts.set(k, (counts.get(k) || 0) + 1); }
    let best = -1; for (const [k, n] of counts) if (best < 0 || n > counts.get(best)) best = k;
    body = best;
  }
  const swell = dome ? new Set(reliefCells(pic, lid).map(c => c[0] + ',' + c[1] + ',' + c[2])) : null, out = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++){
    if (!solid(x, y)) continue;
    const X = x - hw, Y = h - 1 - y;
    for (let z = 0; z < depth; z++) out.push([X, Y, z, body]);
    let k = lid;
    if (dome){ k = 0; while (swell.has(X + ',' + Y + ',' + k)) k++; }
    for (let z = 0; z < k; z++) out.push([X, Y, depth + z, px[y * w + x]]);
  }
  return out;
}
// box net: a cross-shaped net folded into a box, only the shell filled
const netFaces = (w, h, d) => [[d, 0, w, d], [0, d, d, h], [d, d, w, h], [d + w, d, d, h], [2 * d + w, d, w, h], [d, d + h, w, d]];
const NET_FACE_NAMES = ['top', 'left', 'front', 'right', 'back', 'bottom'];
function netCells(pic, w, h, d){
  const out = [], at = (x, y) => (x < pic.w && y < pic.h) ? pic.px[y * pic.w + x] : -1, hw = Math.floor(w / 2);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++){
    if (x > 0 && x < w - 1 && y > 0 && y < h - 1 && z > 0 && z < d - 1) continue;
    const v = h - 1 - y; let c;
    if (z === d - 1) c = at(d + x, d + v);
    else if (z === 0) c = at(2 * d + w + (w - 1 - x), d + v);
    else if (y === h - 1) c = at(d + x, z);
    else if (y === 0) c = at(d + x, d + h + (d - 1 - z));
    else if (x === w - 1) c = at(d + w + (d - 1 - z), d + v);
    else c = at(z, d + v);
    out.push([x - hw, y, z, c]);
  }
  return out;
}
const partKind = p => p.net ? 'net' : p.slab != null ? 'slab' : p.relief != null ? 'relief' : p.body != null ? 'body' : 'lathe';
const KIND_LABEL = { lathe: 'lathe', slab: 'slab', relief: 'relief', body: 'body', net: 'box net' };
// one recipe part, read the way the game reads it
function partCells(part, pic, backPic){
  const k = partKind(part);
  if (k === 'net') return netCells(pic, ...part.net);
  if (k === 'slab') return slabCells(pic, part.slab, part.depths || {}, part.border || []);
  if (k === 'relief') return reliefCells(pic, part.relief, part.shell || 0, backPic, part.back_relief || 0);
  if (k === 'body') return bodyCells(pic, part.body, part.body_color, part.lid || 0, part.dome);
  return latheCells(pic);
}
function cellsToV(list){
  if (!list.length) return { w: 1, h: 1, d: 1, cells: Int16Array.of(-1), colors: COLORS };
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const [x, y, z] of list){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = z1 - z0 + 1, cells = new Int16Array(w * h * d).fill(-1);
  for (const [x, y, z, c] of list) cells[(x - x0) + w * ((y - y0) + h * (z - z0))] = c;
  return { w, h, d, cells, colors: COLORS };
}
// parts merged on one grid, later parts overwriting earlier ones, as the game does
function mergeParts(list){
  const cells = new Map();
  for (const [cellsOf, at] of list){
    const [ax, ay, az] = at || [0, 0, 0];
    for (const [x, y, z, c] of cellsOf) if (c >= 0) cells.set((x + ax) + ',' + (y + ay) + ',' + (z + az), [x + ax, y + ay, z + az, c]);
  }
  return cellsToV([...cells.values()]);
}

/* ---------- voxel renderer (orthographic, painter's sort) ---------- */
const FACES = [
  { n: [1, 0, 0],  q: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], q: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
  { n: [0, 1, 0],  q: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
  { n: [0, -1, 0], q: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1],  q: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { n: [0, 0, -1], q: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
function visibleFaces(V){
  const { w, h, d, cells } = V, out = [];
  const filled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < w && y < h && z < d && cells[x + w * (y + h * z)] >= 0;
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const v = cells[x + w * (y + h * z)]; if (v < 0) continue;
    FACES.forEach((f, fi) => { if (!filled(x + f.n[0], y + f.n[1], z + f.n[2])) out.push([x, y, z, fi, v]); });
  }
  return out;
}
function drawVox(ctx, V, yaw, pitch, cx, cy, s){
  const faces = V._faces || (V._faces = visibleFaces(V));
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // the camera sits on +z looking back, so +z is the front, as in Godot and boxnet.gd
  const rot = (x, y, z) => { z = -z; const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
  const ox = V.w / 2, oy = V.h / 2, oz = V.d / 2;
  const L = [-.45, .8, -.4], ll = Math.hypot(...L);
  const rn = FACES.map(f => rot(...f.n));
  const shade = rn.map(n => .52 + .48 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll));
  const list = [];
  for (const [x, y, z, fi, v] of faces){
    if (rn[fi][2] >= -1e-6) continue;
    const pts = FACES[fi].q.map(q => rot(x + q[0] - ox, y + q[1] - oy, z + q[2] - oz));
    list.push([pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2], pts, fi, v]);
  }
  list.sort((a, b) => b[0] - a[0]);
  const cache = {};
  for (const [, pts, fi, v] of list){
    const key = v + ':' + fi;
    const col = cache[key] || (cache[key] = 'rgb(' + mul(V.colors[v], shade[fi]).join(',') + ')');
    ctx.fillStyle = ctx.strokeStyle = col;
    ctx.beginPath();
    pts.forEach((p, i) => { const sx = cx + p[0] * s, sy = cy - p[1] * s; i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.closePath(); ctx.fill(); ctx.lineWidth = .7; ctx.stroke();
  }
}
const voxScale = (V, size) => size / (Math.hypot(V.w, V.h, V.d) * 1.05);
const VIEW_YAW = 0.38, VIEW_PITCH = -0.34;
function drawThumbV(cv, V){
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
  drawVox(g, V, VIEW_YAW, VIEW_PITCH, cv.width / 2, cv.height / 2, voxScale(V, cv.width));
}

// a turntable: spins until dragged; stops itself when its canvas leaves the page
class Stage {
  constructor(cv){
    this.cv = cv; this.g = cv.getContext('2d'); this.yaw = VIEW_YAW; this.pitch = VIEW_PITCH; this.spin = true; this.V = null; this.dirty = true; this.onspin = null;
    let last = performance.now();
    const tick = t => {
      if (!cv.isConnected && this._seen) return;
      if (cv.isConnected) this._seen = true;
      if (this.spin && this.V){ this.yaw += (t - last) * .0008; this.dirty = true; }
      last = t;
      if (this.dirty && this.V){ this.g.clearRect(0, 0, cv.width, cv.height); drawVox(this.g, this.V, this.yaw, this.pitch, cv.width / 2, cv.height / 2, this.s); this.dirty = false; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    cv.onpointerdown = e => {
      this.setSpin(false); cv.setPointerCapture(e.pointerId); let px = e.clientX, py = e.clientY;
      cv.onpointermove = m => { this.yaw += (m.clientX - px) * .01; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - (m.clientY - py) * .01)); px = m.clientX; py = m.clientY; this.dirty = true; };
      cv.onpointerup = () => { cv.onpointermove = null; };
    };
  }
  set(V, keepScale){ this.V = V; if (!keepScale || !this.s) this.s = voxScale(V, this.cv.width); this.dirty = true; }
  setSpin(on){ this.spin = on; if (this.onspin) this.onspin(on); }
  look(yaw){ this.setSpin(false); this.yaw = yaw; this.pitch = VIEW_PITCH; this.dirty = true; }
  // the bar under a stage: spin and the three views
  bar(info = ''){
    const el = document.createElement('div'); el.className = 'stagebar';
    const spin = document.createElement('button'); spin.textContent = 'Spin'; spin.classList.toggle('on', this.spin);
    spin.onclick = () => this.setSpin(!this.spin); this.onspin = on => spin.classList.toggle('on', on);
    el.append(spin);
    for (const [label, yaw] of [['Front', 0], ['Side', Math.PI / 2], ['Back', Math.PI]]){ const b = document.createElement('button'); b.textContent = label; b.onclick = () => this.look(yaw); el.append(b); }
    const i = document.createElement('span'); i.className = 'muted info'; i.textContent = info; el.append(i);
    return el;
  }
}
const vInfo = V => `${V.w}×${V.h}×${V.d} voxels`;

/* ---------- pictures ---------- */
function fitPic(g, img, W, H, pad = .9){
  const k = Math.max(1, Math.floor(Math.min(W / img.width, H / img.height) * pad));
  g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round((W - img.width * k) / 2), Math.round((H - img.height * k) / 2), img.width * k, img.height * k);
}
// a picture with its own small palette onto a canvas
function picCanvas(w, h, px, colors){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), im = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++){ const v = px[i]; if (v >= 0 && colors[v]){ im.data.set(colors[v], i * 4); im.data[i * 4 + 3] = 255; } }
  g.putImageData(im, 0, 0);
  return c;
}
const canvasPNG = c => new Promise(res => c.toBlob(res, 'image/png'));
