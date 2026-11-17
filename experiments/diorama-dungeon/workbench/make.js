/* Ren's Workbench: making. Generate a batch, pick the good ones, edit one by hand, finalise it into the game. */

const M = { stage: 'generate', kind: 'lathe', params: JSON.parse(JSON.stringify(GEN_DEFAULTS)), look: { palette: '', n: 3, roles: true, eyes: true },
  seed: (Math.random() * 1e6) | 0, count: 24, batch: [], sel: null, source: null, strength: 4, drift: true, picks: [], work: null };
const STAGES = [['generate', 'Generate'], ['picked', 'Picked'], ['edit', 'Edit'], ['finalise', 'Finalise']];

/* ---------- picks are kept between visits, in this browser ---------- */
function loadPicks(){ try { M.picks = (JSON.parse(localStorage.getItem('rens-workbench-picks')) || []).map(workFromJSON); } catch { M.picks = []; } }
function savePicks(){ try { localStorage.setItem('rens-workbench-picks', JSON.stringify(M.picks.slice(-80).map(workToJSON))); } catch {} }
const isPicked = W => M.picks.includes(W);
function togglePick(W){
  if (isPicked(W)) M.picks.splice(M.picks.indexOf(W), 1); else M.picks.push(W);
  savePicks(); renderStepper();
  document.querySelectorAll('#main .card').forEach(c => { if (c._work) c.classList.toggle('marked', isPicked(c._work)); });
}

/* ---------- the stepper ---------- */
function renderStepper(){
  const el = $('stepper'); el.innerHTML = '';
  // what is being made: props, witches or monsters, each with its own stages and picks
  const what = document.createElement('div'); what.className = 'modetabs what';
  for (const [k, label] of [['prop', 'Prop'], ['witch', 'Witch'], ['monster', 'Monster']]){
    const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', (M.drawingFor || M.what) === k);
    b.onclick = () => { if (M.drawingFor) return; M.what = k; renderMake(); }; what.append(b);
  }
  el.append(what);
  const ch = M.what !== 'prop' ? CH() : null, stage = ch ? ch.stage : M.stage, work = ch ? ch.work : M.work, picks = ch ? ch.picks : M.picks;
  STAGES.forEach(([key, label], i) => {
    const b = document.createElement('button'); b.className = 'step' + (stage === key ? ' on' : '');
    if (key === 'edit' && ch) label = 'Design';
    b.innerHTML = `<b>${i + 1}</b> <span class="lbl">${label}</span>${key === 'picked' && picks.length ? ` <span class="n">${picks.length}</span>` : ''}`;
    b.disabled = ((key === 'edit' || key === 'finalise') && !work) || !!M.drawingFor;
    b.onclick = () => { if (ch) ch.stage = key; else M.stage = key; renderMake(); };
    el.append(b);
  });
}
function renderMake(){
  if (!M.what) M.what = 'prop';
  renderStepper();
  $('main').onkeydown = null;
  if (M.what !== 'prop' && !M.drawingFor){ renderChar(); return; }
  if (M.stage === 'generate') renderGenerate();
  else if (M.stage === 'picked') renderPicked();
  else if (M.stage === 'edit' && M.work) renderEditor();
  else if (M.stage === 'finalise' && M.work) renderFinalise();
  else { M.stage = 'generate'; renderMake(); }
}

/* ---------- 1. generate ---------- */
function lookPal(){
  const name = M.look.palette;
  if (S.palettes[name]) return { mode: 'list', list: S.palettes[name] };
  return { mode: name === 'random' ? 'random' : 'harmony' };
}
const lookTheme = () => S.palettes[M.look.palette] ? paletteTheme(M.look.palette) : 'crypt';
function regen(){
  if (!M.look.palette) M.look.palette = Object.keys(S.palettes).find(p => /crypt/.test(p)) || 'harmony';
  const look = { ...M.look, pal: lookPal() };
  M.batch = Array.from({ length: M.count }, (_, i) => {
    const s = hash32((M.seed ^ hash32(i + 1)) >>> 0);
    const W = M.source ? mutateWork(M.source, s, M.strength, M.drift) : generate(M.kind, s, M.params[M.kind], look);
    if (!W.theme) W.theme = M.source ? M.source.theme : lookTheme();
    return W;
  });
  M.sel = null;
}
function field(parent, label, input){ const l = document.createElement('label'); l.className = 'field'; const t = document.createElement('span'); t.textContent = label; l.append(t, input); parent.append(l); return input; }
function numInput(value, min, max, step, on){
  const wrap = document.createElement('span'); wrap.className = 'num';
  const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step || 1; r.value = value;
  const n = document.createElement('input'); n.type = 'number'; n.min = min; n.max = max; n.step = step || 1; n.value = value;
  r.oninput = () => { n.value = r.value; on(+r.value); }; n.onchange = () => { r.value = n.value; on(+n.value); };
  wrap.append(r, n); return wrap;
}
function selectInput(options, value, on){ const s = document.createElement('select'); for (const o of options){ const [v, l] = Array.isArray(o) ? o : [o, o]; s.add(new Option(l, v)); } s.value = value; s.onchange = () => on(s.value); return s; }
function checkInput(value, on){ const c = document.createElement('input'); c.type = 'checkbox'; c.checked = value; c.onchange = () => on(c.checked); return c; }
let regenTimer = 0;
const regenSoon = () => { clearTimeout(regenTimer); regenTimer = setTimeout(() => { regen(); renderGenerateGrid(); renderWorkInspector(null); }, 120); };

function renderGenerate(){
  if (!M.batch.length) regen();
  const nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Make');
  for (const [k, g] of Object.entries(GEN_KINDS)) navItem(nav, g.label, '', !M.source && M.kind === k, () => { M.kind = k; M.source = null; regen(); renderGenerate(); });
  if (M.source) navItem(nav, 'Variations of ' + (M.source.label || 'this'), '', true, () => {});
  navItem(nav, 'Blank canvas', '', false, () => openInEditor(newWork({ kind: 'relief', w: 16, h: 24, colors: (lookPal().list || [[230, 230, 230], [120, 110, 130]]).slice(0, 6).map(c => c.slice()), theme: lookTheme(), made: 'hand-drawn', label: 'new', name: '' })));
  const box = document.createElement('div'); box.className = 'form'; nav.append(box);
  if (M.source){
    const prev = document.createElement('canvas'); prev.width = prev.height = 160; prev.className = 'srcthumb'; drawThumbV(prev, workVox(M.source)); box.append(prev);
    field(box, 'How far', numInput(M.strength, 1, 16, 1, v => { M.strength = v; regenSoon(); }));
    field(box, 'Colours drift', checkInput(M.drift, v => { M.drift = v; regenSoon(); }));
    box.append(buttons([['Back to generators', () => { M.source = null; regen(); renderGenerate(); }]]));
  } else {
    const p = M.params[M.kind];
    if (GEN_KINDS[M.kind].styles.length) field(box, 'Style', selectInput(['any', ...GEN_KINDS[M.kind].styles], p.style, v => { p.style = v; regenSoon(); }));
    for (const [key, label, a, b, c] of GEN_FIELDS[M.kind]){
      if (a === 'check') field(box, label, checkInput(p[key], v => { p[key] = v; regenSoon(); }));
      else if (a === 'select') field(box, label, selectInput(b, p[key], v => { p[key] = v; regenSoon(); }));
      else field(box, label, numInput(p[key], a, b, c, v => { p[key] = v; regenSoon(); }));
    }
    navHead(nav, 'Look');
    const look = document.createElement('div'); look.className = 'form'; nav.append(look);
    const pals = [...Object.keys(S.palettes).map(k => [k, k + ' palette']), ['harmony', 'harmony (free)'], ['random', 'random (free)']];
    field(look, 'Colours from', selectInput(pals, M.look.palette, v => { M.look.palette = v; regenSoon(); renderPaletteStrip(look); }));
    renderPaletteStrip(look);
    field(look, 'How many colours', numInput(M.look.n, 2, 6, 1, v => { M.look.n = v; regenSoon(); }));
    field(look, 'Colour roles', checkInput(M.look.roles, v => { M.look.roles = v; regenSoon(); }));
    field(look, 'Eyes', checkInput(M.look.eyes, v => { M.look.eyes = v; regenSoon(); }));
  }
  navHead(nav, 'Batch');
  const bb = document.createElement('div'); bb.className = 'form'; nav.append(bb);
  const seed = document.createElement('input'); seed.value = M.seed; seed.onchange = () => { M.seed = seedFromText(seed.value); regenSoon(); };
  field(bb, 'Seed', seed);
  field(bb, 'How many', selectInput(['12', '24', '48'], String(M.count), v => { M.count = +v; regenSoon(); }));
  bb.append(buttons([['New batch', () => { M.seed = (Math.random() * 1e6) | 0; seed.value = M.seed; regen(); renderGenerateGrid(); renderWorkInspector(null); }, 'hot']]));
  bb.insertAdjacentHTML('beforeend', '<p class="hint">Click to look, <b>P</b> picks, <b>E</b> edits, <b>M</b> more like this.</p>');
  renderGenerateGrid();
  renderWorkInspector(M.sel);
}
function renderPaletteStrip(parent){
  let strip = parent.querySelector('.palstrip'); if (!strip){ strip = document.createElement('div'); strip.className = 'palstrip'; parent.append(strip); }
  const list = lookPal().list || [];
  strip.innerHTML = list.map(c => `<span class="sw" style="background:${hex(c)}"></span>`).join('') || '<span class="muted">made up each time</span>';
}
function workCards(list, opts){
  cardGrid(list, {
    isOn: W => M.sel === W, select: W => { M.sel = W; renderWorkInspector(W); }, dbl: W => openInEditor(cloneIfBatch(W)),
    isMarked: isPicked,
    name: W => W.label || KIND_LABEL[W.kind], title: W => 'seed ' + W.seed,
    badges: W => badge(KIND_LABEL[W.kind]) + (W.theme ? badge(THEME_LABEL[W.theme] || W.theme) : '') + (isPicked(W) ? badge('picked', 'kept') : ''),
    draw: (W, cv) => drawThumbV(cv, workVox(W)), empty: opts && opts.empty,
  });
  $('main').querySelectorAll('.card').forEach((c, i) => c._work = list[i]);
  $('main').tabIndex = 0;
  $('main').onkeydown = e => {
    if (!M.sel || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'p'){ togglePick(M.sel); renderWorkInspector(M.sel); }
    else if (k === 'e') openInEditor(cloneIfBatch(M.sel));
    else if (k === 'm') varyFrom(M.sel);
  };
}
// a batch item is copied before editing, so the batch and picks stay as they were
const cloneIfBatch = W => { const c = cloneWork(W); c._others = W._others; return c; };
function renderGenerateGrid(){
  workCards(M.batch);
  $('counts').textContent = `${M.batch.length} in this batch · ${M.picks.length} picked`;
}
function varyFrom(W){
  M.source = cloneIfBatch(W); M.source.origin = null; M.source._others = undefined; M.seed = (Math.random() * 1e6) | 0;
  S.mode = 'make'; M.stage = 'generate'; regen(); render();
}
// the right-hand panel for a work item: turntable, pictures and what to do with it
function renderWorkInspector(W, extra){
  const el = $('insp'); el.innerHTML = '';
  const h = document.createElement('div'); h.className = 'ihead'; h.textContent = W ? (W.label || KIND_LABEL[W.kind]) : 'Preview'; el.append(h);
  if (!W){ el.append(section('', '<span class="muted">Click one to look at it from all sides.</span>')); return; }
  const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
  const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
  const st = new Stage(cv), V = workVox(W); st.set(V); top.append(st.bar(vInfo(V)));
  el.append(top);
  el.append(section('', '').appendChild(buttons(extra || [
    [isPicked(W) ? 'Unpick' : 'Pick', () => { togglePick(W); renderWorkInspector(W, extra); }, isPicked(W) ? '' : 'hot'],
    ['Edit', () => openInEditor(cloneIfBatch(W))],
    ['More like this', () => varyFrom(W)],
  ])).parentNode);
  const picsSec = section('Pictures'), pb = document.createElement('div'); pb.className = 'pics'; picsSec.append(pb);
  pb.append(picTile(picCanvas(W.w, W.h, W.front, W.colors), `${W.kind === 'net' ? 'net' : 'front'} · ${W.w}×${W.h}`));
  if (W.back) pb.append(picTile(picCanvas(W.w, W.h, W.back, W.colors), 'back'));
  el.append(picsSec);
  const part = workPart(W, 'picture.png', 'picture_back.png');
  el.append(section('Builds as', `<pre>${esc(JSON.stringify(part, null, 1))}</pre>`));
  el.append(section('Palette', W.colors.map(c => `<span class="sw" title="#${hexOf(c)}" style="background:${hex(c)}"></span>`).join('')));
}

/* ---------- 2. picked ---------- */
function renderPicked(){
  const nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Picked');
  const p = document.createElement('div'); p.className = 'form'; nav.append(p);
  p.insertAdjacentHTML('beforeend', `<p class="hint">Everything picked from batches, kept in this browser until it goes into the game. Pick the best one and edit it.</p>`);
  if (M.picks.length) p.append(buttons([['Clear all', () => { if (confirm('Forget every pick?')){ M.picks = []; savePicks(); renderMake(); } }]]));
  if (M.sel && !M.picks.includes(M.sel)) M.sel = null;
  workCards(M.picks, { empty: 'Nothing picked yet. In Generate, click one and press <b>P</b>.' });
  $('counts').textContent = `${M.picks.length} picked`;
  renderWorkInspector(M.sel, M.sel && [
    ['Edit', () => openInEditor(cloneIfBatch(M.sel)), 'hot'],
    ['More like this', () => varyFrom(M.sel)],
    ['Remove', () => { togglePick(M.sel); M.sel = null; renderPicked(); }],
  ]);
}

/* ---------- 3. edit ---------- */
const E = { tool: 'pencil', colour: 0, side: 'front', mirror: false, undo: [], redo: [], stage: null, down: false, last: null, hover: null };
async function openInEditor(W){
  if (W.origin) await ensureOthers(W);
  if (!W.theme) W.theme = 'crypt';
  M.work = W; S.mode = 'make'; M.stage = 'edit';
  Object.assign(E, { tool: 'pencil', colour: W.colors.length ? 0 : -1, side: 'front', mirror: W.kind !== 'net' && isMirrored(W.front, W.w, W.h), undo: [], redo: [] });
  render();
}
const edPx = () => E.side === 'back' && M.work.back ? M.work.back : M.work.front;
const snapshot = W => JSON.stringify({ w: W.w, h: W.h, front: [...W.front], back: W.back && [...W.back], colors: W.colors, build: W.build, kind: W.kind, glow: W.glow, light: W.light });
function restore(W, s){ const o = JSON.parse(s); Object.assign(W, { ...o, front: Int16Array.from(o.front), back: o.back && Int16Array.from(o.back) }); touch(W); }
function edPush(){ E.undo.push(snapshot(M.work)); if (E.undo.length > 80) E.undo.shift(); E.redo = []; }
function edUndo(){ if (!E.undo.length) return; E.redo.push(snapshot(M.work)); restore(M.work, E.undo.pop()); edChanged(true); }
function edRedo(){ if (!E.redo.length) return; E.undo.push(snapshot(M.work)); restore(M.work, E.redo.pop()); edChanged(true); }
// after any change: the picture, the model, and (for build changes) the panels
let previewRaf = 0;
function edChanged(panels){
  const W = M.work; W.edited = true; touch(W);
  drawEditCanvas();
  cancelAnimationFrame(previewRaf);
  previewRaf = requestAnimationFrame(() => { if (E.stage){ const V = workVox(W); E.stage.set(V, !panels); const i = $('insp').querySelector('.info'); if (i) i.textContent = vInfo(V); } });
  if (panels){ renderEditNav(); renderBuildPanel(); }
}

function renderEditor(){
  renderEditNav();
  const main = $('main'); main.innerHTML = ''; main.className = 'editor';
  const cv = document.createElement('canvas'); cv.id = 'edCanvas'; main.append(cv);
  const hint = document.createElement('div'); hint.className = 'edhint'; hint.id = 'edHint'; main.append(hint);
  wireEditCanvas(cv);
  drawEditCanvas();
  renderEditInspector();
  $('counts').textContent = '';
}
function renderEditNav(){
  const W = M.work, nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Tools');
  const tools = document.createElement('div'); tools.className = 'tools'; nav.append(tools);
  for (const [t, label, key] of [['pencil', 'Pencil', 'B'], ['eraser', 'Eraser', 'E'], ['fill', 'Fill', 'G'], ['picker', 'Pick colour', 'I']]){
    const b = document.createElement('button'); b.className = E.tool === t ? 'on' : ''; b.innerHTML = `${label} <kbd>${key}</kbd>`;
    b.onclick = () => { E.tool = t; renderEditNav(); }; tools.append(b);
  }
  const f = document.createElement('div'); f.className = 'form'; nav.append(f);
  if (W.kind !== 'net') field(f, 'Mirror left / right (M)', checkInput(E.mirror, v => { E.mirror = v; drawEditCanvas(); }));
  f.append(buttons([['Undo', edUndo], ['Redo', edRedo]]));
  if (W.kind === 'relief' || W.back){
    navHead(nav, 'Side');
    const sides = document.createElement('div'); sides.className = 'tools'; nav.append(sides);
    for (const s of ['front', 'back']){
      const b = document.createElement('button'); b.className = E.side === s ? 'on' : ''; b.textContent = s === 'front' ? 'Front' : 'Back';
      b.onclick = () => { if (s === 'back' && !W.back) addBack(W); E.side = s; renderEditNav(); drawEditCanvas(); renderBuildPanel(); };
      sides.append(b);
    }
    if (E.side === 'back') nav.insertAdjacentHTML('beforeend', '<p class="hint pad">The back is drawn as seen from behind.</p>');
  }
  if (W.kind !== 'net'){
    navHead(nav, 'Size');
    const sz = document.createElement('div'); sz.className = 'form'; nav.append(sz);
    const wi = document.createElement('input'), hi = document.createElement('input');
    for (const [inp, v] of [[wi, W.w], [hi, W.h]]){ inp.type = 'number'; inp.min = 1; inp.max = 96; inp.value = v; }
    const row = document.createElement('div'); row.className = 'row'; row.append(wi, '×', hi); sz.append(row);
    sz.append(buttons([['Resize', () => { edPush(); resizeWork(W, Math.max(1, +wi.value), Math.max(1, +hi.value)); edChanged(true); }]]));
    sz.insertAdjacentHTML('beforeend', '<p class="hint">Grows and trims round the bottom middle, where it stands.</p>');
  }
  navHead(nav, 'Palette');
  const pal = document.createElement('div'); pal.className = 'palette'; nav.append(pal);
  W.colors.forEach((c, i) => {
    const s = document.createElement('button'); s.className = 'swatch' + (E.colour === i ? ' on' : ''); s.style.background = hex(c); s.title = '#' + hexOf(c);
    s.onclick = () => { E.colour = i; if (E.tool === 'eraser' || E.tool === 'picker') E.tool = 'pencil'; renderEditNav(); };
    pal.append(s);
  });
  const pf = document.createElement('div'); pf.className = 'form'; nav.append(pf);
  if (E.colour >= 0 && W.colors[E.colour]){
    const ci = document.createElement('input'); ci.type = 'color'; ci.value = hex(W.colors[E.colour]);
    // one undo step for the whole drag through the colour picker
    ci.onclick = () => edPush();
    ci.oninput = () => { recolour(W, E.colour, unhex(ci.value)); edChanged(false); };
    ci.onchange = () => { renderEditNav(); renderBuildPanel(); };
    field(pf, 'This colour', ci);
  }
  pf.append(buttons([
    ['Add colour', () => { edPush(); W.colors.push(W.colors[E.colour] ? mix(W.colors[E.colour], [255, 255, 255], .3) : [200, 200, 200]); E.colour = W.colors.length - 1; edChanged(true); }],
    ['Drop unused', () => { edPush(); dropUnused(W); E.colour = Math.min(E.colour, W.colors.length - 1); edChanged(true); }],
  ]));
  const themePal = S.palettes[Object.keys(S.palettes).find(k => paletteTheme(k) === W.theme)] || [];
  if (themePal.length){
    navHead(nav, THEME_LABEL[W.theme] + ' palette');
    const tp = document.createElement('div'); tp.className = 'palette small'; nav.append(tp);
    for (const c of themePal){
      const s = document.createElement('button'); s.className = 'swatch'; s.style.background = hex(c); s.title = 'add #' + hexOf(c);
      s.onclick = () => { let i = W.colors.findIndex(x => hexOf(x) === hexOf(c)); if (i < 0){ edPush(); W.colors.push(c.slice()); i = W.colors.length - 1; } E.colour = i; E.tool = 'pencil'; edChanged(true); };
      tp.append(s);
    }
  }
}
function addBack(W){
  edPush();
  // start the back as the front seen from behind: mirrored, so painting it is a matter of changing what differs
  W.back = new Int16Array(W.w * W.h);
  for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) W.back[y * W.w + x] = W.front[y * W.w + (W.w - 1 - x)];
  if (W.kind === 'relief') W.build.backMode = 'picture';
  touch(W);
}
function dropUnused(W){
  const used = new Set([...W.front, ...(W.back || [])].filter(v => v >= 0)), map = new Map(), colors = [];
  W.colors.forEach((c, i) => { if (used.has(i)){ map.set(i, colors.length); colors.push(c); } });
  for (const px of [W.front, W.back]) if (px) for (let i = 0; i < px.length; i++) if (px[i] >= 0) px[i] = map.get(px[i]);
  W.colors = colors; touch(W);
}
function resizeWork(W, nw, nh){
  const ox = Math.floor((nw - W.w) / 2), oy = nh - W.h, move = px => {
    const out = new Int16Array(nw * nh).fill(-1);
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++){ const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < nw && Y < nh) out[Y * nw + X] = px[y * W.w + x]; }
    return out;
  };
  W.front = move(W.front); if (W.back) W.back = move(W.back); W.w = nw; W.h = nh; touch(W);
}
// a box's faces, each moved into the new layout round its own middle
function reNet(W, n){
  const [ow, oh, od] = W.build.net, [NW, NH] = netSize(n), oldF = netFaces(ow, oh, od), newF = netFaces(...n), out = new Int16Array(NW * NH).fill(-1);
  newF.forEach(([fx, fy, fw, fh], i) => {
    const [gx, gy, gw, gh] = oldF[i], dx = Math.floor((fw - gw) / 2), dy = Math.floor((fh - gh) / 2);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++){ const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0 && sx < gw && sy < gh) out[(fy + y) * NW + fx + x] = W.front[(gy + sy) * W.w + gx + sx]; }
  });
  W.front = out; W.w = NW; W.h = NH; W.build.net = n.slice(); touch(W);
}
function setKind(W, kind){
  if (kind === W.kind) return;
  edPush();
  if (kind === 'net'){
    // the picture becomes the front of a box; the other faces start in its commonest colour, ready to paint
    const d = Math.max(2, Math.round(Math.min(W.w, W.h) / 2)), n = [W.w, W.h, d], [NW, NH] = netSize(n), out = new Int16Array(NW * NH).fill(-1);
    const counts = new Map(); for (const v of W.front) if (v >= 0) counts.set(v, (counts.get(v) || 0) + 1);
    const common = [...counts].sort((a, b) => b[1] - a[1])[0], plain = common ? common[0] : 0;
    netFaces(...n).forEach(([fx, fy, fw, fh]) => { for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) out[(fy + y) * NW + fx + x] = plain; });
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) out[(d + y) * NW + d + x] = W.front[y * W.w + x];
    Object.assign(W, { front: out, w: NW, h: NH, back: null }); W.build.net = n; E.side = 'front';
  } else if (W.kind === 'net'){
    // and back: the front face is the picture
    const [w, h, d] = W.build.net, out = new Int16Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = W.front[(d + y) * W.w + d + x];
    Object.assign(W, { front: out, w, h });
  }
  W.kind = kind; touch(W);
}

function wireEditCanvas(cv){
  const cellAt = e => { const r = cv.getBoundingClientRect(), z = E.zoom; return [Math.floor((e.clientX - r.left) / z), Math.floor((e.clientY - r.top) / z)]; };
  cv.onpointerdown = e => {
    const [x, y] = cellAt(e); if (x < 0 || y < 0 || x >= M.work.w || y >= M.work.h) return;
    cv.setPointerCapture(e.pointerId);
    if (e.button === 2 || E.tool === 'picker'){ const v = edPx()[y * M.work.w + x]; if (v >= 0){ E.colour = v; E.tool = 'pencil'; renderEditNav(); } return; }
    edPush();
    if (E.tool === 'fill'){ floodFill(x, y); edChanged(false); return; }
    E.down = true; E.last = [x, y]; paintAt(x, y); edChanged(false);
  };
  cv.onpointermove = e => {
    const [x, y] = cellAt(e); E.hover = [x, y];
    if (E.down && E.last){
      // a line from the last cell, so a fast stroke has no gaps
      const [x0, y0] = E.last, n = Math.max(Math.abs(x - x0), Math.abs(y - y0), 1);
      for (let i = 1; i <= n; i++) paintAt(Math.round(x0 + (x - x0) * i / n), Math.round(y0 + (y - y0) * i / n));
      E.last = [x, y]; edChanged(false);
    } else drawEditCanvas();
  };
  cv.onpointerup = () => { E.down = false; E.last = null; };
  cv.onpointerleave = () => { E.hover = null; drawEditCanvas(); };
  cv.oncontextmenu = e => e.preventDefault();
}
function paintAt(x, y){
  const W = M.work, px = edPx(); if (x < 0 || y < 0 || x >= W.w || y >= W.h) return;
  const v = E.tool === 'eraser' ? -1 : E.colour;
  px[y * W.w + x] = v;
  if (E.mirror && W.kind !== 'net') px[y * W.w + (W.w - 1 - x)] = v;
}
function floodFill(x, y){
  const W = M.work, px = edPx(), v = E.colour, fill = (sx, sy) => {
    const from = px[sy * W.w + sx]; if (from === v) return;
    const stack = [[sx, sy]];
    while (stack.length){
      const [a, b] = stack.pop(); if (a < 0 || b < 0 || a >= W.w || b >= W.h || px[b * W.w + a] !== from) continue;
      px[b * W.w + a] = v; stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  };
  fill(x, y); if (E.mirror && W.kind !== 'net') fill(W.w - 1 - x, y);
}
function drawEditCanvas(){
  const cv = $('edCanvas'), W = M.work; if (!cv || !W) return;
  const main = $('main'), z = Math.max(2, Math.min(40, Math.floor(Math.min((main.clientWidth - 48) / W.w, (main.clientHeight - 64) / W.h))));
  E.zoom = z;
  if (cv.width !== W.w * z || cv.height !== W.h * z){ cv.width = W.w * z; cv.height = W.h * z; }
  const g = cv.getContext('2d'), px = edPx(), under = W._under && W._under[E.side === 'back' ? 'back' : 'front'];
  for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++){
    const v = px[y * W.w + x], u = under && under.px[y * W.w + x];
    g.fillStyle = v >= 0 && W.colors[v] ? hex(W.colors[v]) : under && u >= 0 ? hex(mix(under.colors[u] || [80, 80, 80], [40, 40, 40], .7)) : ((x + y) % 2 ? '#2b2b2b' : '#333');
    g.fillRect(x * z, y * z, z, z);
  }
  if (z >= 6){
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath();
    for (let x = 1; x < W.w; x++){ g.moveTo(x * z + .5, 0); g.lineTo(x * z + .5, W.h * z); }
    for (let y = 1; y < W.h; y++){ g.moveTo(0, y * z + .5); g.lineTo(W.w * z, y * z + .5); }
    g.stroke();
  }
  if (W.kind === 'net'){
    g.lineWidth = 2; g.font = `600 ${Math.max(10, Math.min(14, z * 1.2))}px Segoe UI, sans-serif`;
    netFaces(...W.build.net).forEach(([fx, fy, fw, fh], i) => {
      g.strokeStyle = i === 2 ? 'rgba(232,145,43,.9)' : 'rgba(91,136,204,.8)'; g.strokeRect(fx * z + 1, fy * z + 1, fw * z - 2, fh * z - 2);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(NET_FACE_NAMES[i], fx * z + 4, fy * z + 14);
    });
  } else if (E.mirror){
    g.strokeStyle = 'rgba(232,145,43,.6)'; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(W.w * z / 2, 0); g.lineTo(W.w * z / 2, W.h * z); g.stroke(); g.setLineDash([]);
  }
  if (E.hover){ const [x, y] = E.hover; if (x >= 0 && y >= 0 && x < W.w && y < W.h){ g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(x * z + .5, y * z + .5, z - 1, z - 1); } }
  const hint = $('edHint');
  if (hint) hint.textContent = `${E.side === 'back' ? 'Back' : W.kind === 'net' ? 'Net' : 'Front'} · ${W.w}×${W.h}${E.hover ? ` · ${E.hover[0]}, ${E.hover[1]}` : ''} · right-click picks a colour · Ctrl+Z undoes`;
}

function renderEditInspector(){
  const W = M.work, el = $('insp'); el.innerHTML = '';
  const h = document.createElement('div'); h.className = 'ihead'; h.textContent = W.label || 'Untitled'; el.append(h);
  const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
  const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
  E.stage = new Stage(cv); const V = workVox(W); E.stage.set(V); top.append(E.stage.bar(vInfo(V)));
  el.append(top);
  el.append(section('', '').appendChild(buttons(W._done ? [
    // drawing one part of a witch or monster: back to its design
    ['Done: back to the design', () => { const done = W._done, back = M.drawingFor; M.drawingFor = null; M.what = back; M.work = M.propWork; done(W); }, 'hot'],
    ['Cancel', () => { const back = M.drawingFor; M.drawingFor = null; M.what = back; M.work = M.propWork; render(); }],
  ] : [
    ['Finalise →', () => { M.stage = 'finalise'; renderMake(); }, 'hot'],
    [isPicked(W) ? 'Picked' : 'Pick for later', () => { if (!isPicked(W)) togglePick(W); renderEditInspector(); }],
    ['More like this', () => varyFrom(W)],
  ])).parentNode);
  if (W._done){ el.append(section('', '<p class="hint">The rest of the character shows faded underneath. The 3D view here is just this part.</p>')); return; }
  const bp = document.createElement('div'); bp.id = 'buildPanel'; el.append(bp);
  renderBuildPanel();
}
function renderBuildPanel(){
  const W = M.work, bp = $('buildPanel'); if (!bp) return; bp.innerHTML = '';
  const b = W.build, sec = section('Build'), f = document.createElement('div'); f.className = 'form'; sec.append(f); bp.append(sec);
  const change = (fn, panels = false) => v => { edPush(); fn(v); edChanged(panels); };
  field(f, 'Builder', selectInput(Object.entries(KIND_LABEL), W.kind, v => { setKind(W, v); E.mirror = W.kind !== 'net' && isMirrored(W.front, W.w, W.h); edChanged(true); }));
  if (W.kind === 'lathe') f.insertAdjacentHTML('beforeend', '<p class="hint">Spun round its middle column: draw half the outline wide and it turns into a round thing.</p>');
  if (W.kind === 'slab'){
    field(f, 'Depth', numInput(b.depth, 1, 24, 1, change(v => b.depth = v)));
    field(f, 'Border width', numInput(b.border ? b.border[0] : 0, 0, 8, 1, change(v => b.border = v > 0 ? [v, b.border ? b.border[1] : b.depth + 1] : null, true)));
    if (b.border) field(f, 'Border depth', numInput(b.border[1], 1, 24, 1, change(v => b.border[1] = v)));
    const dsec = section('Depth by colour'), list = document.createElement('div'); list.className = 'depths'; dsec.append(list);
    W.colors.forEach(c => {
      const k = hexOf(c), row = document.createElement('label'), n = document.createElement('input');
      n.type = 'number'; n.min = 1; n.max = 32; n.placeholder = b.depth; n.value = b.depths[k] ?? '';
      n.onchange = () => { edPush(); if (n.value === '') delete b.depths[k]; else b.depths[k] = +n.value; edChanged(false); };
      row.innerHTML = `<span class="sw" style="background:${hex(c)}"></span>`; row.append(n); list.append(row);
    });
    bp.append(dsec);
  }
  if (W.kind === 'relief'){
    field(f, 'Front depth', numInput(b.depth, 1, 16, 1, change(v => b.depth = v)));
    field(f, 'Shell (0 solid)', numInput(b.shell, 0, 8, 1, change(v => b.shell = v)));
    field(f, 'Back', selectInput([['none', 'flat'], ['same', 'domed, same picture'], ['picture', 'domed, its own picture']], b.backMode, change(v => { b.backMode = v; if (v === 'picture' && !W.back) addBack(W); }, true)));
    if (b.backMode !== 'none') field(f, 'Back depth', numInput(b.backDepth, 1, 16, 1, change(v => b.backDepth = v)));
  }
  if (W.kind === 'body'){
    field(f, 'Body depth', numInput(b.depth, 1, 32, 1, change(v => b.depth = v)));
    field(f, 'Lid', numInput(b.lid, 0, 8, 1, change(v => b.lid = v)));
    field(f, 'Domed lid', checkInput(b.dome, change(v => b.dome = v)));
    field(f, 'Body colour', selectInput([['', 'the outline\'s'], ...W.colors.map(c => [hexOf(c), '#' + hexOf(c)])], b.bodyHex, change(v => b.bodyHex = v)));
  }
  if (W.kind === 'net'){
    const [w, h, d] = b.net;
    field(f, 'Box width', numInput(w, 2, 32, 1, change(v => reNet(W, [v, b.net[1], b.net[2]]), true)));
    field(f, 'Box height', numInput(h, 2, 32, 1, change(v => reNet(W, [b.net[0], v, b.net[2]]), true)));
    field(f, 'Box depth', numInput(d, 2, 32, 1, change(v => reNet(W, [b.net[0], b.net[1], v]), true)));
    f.insertAdjacentHTML('beforeend', '<p class="hint">Six faces in a cross, folded into a box. The orange one is the front.</p>');
  }
  // glow and light, as the game reads them
  const gs = section('Glow'), gf = document.createElement('div'); gf.className = 'form'; gs.append(gf); bp.append(gs);
  field(gf, 'Glows', checkInput(!!W.glow, change(v => W.glow = v ? { colors: [], above: 0 } : null, true)));
  if (W.glow){
    const pick = document.createElement('div'); pick.className = 'glowpick';
    W.colors.forEach(c => {
      const k = hexOf(c), l = document.createElement('label'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = W.glow.colors.includes(k);
      cb.onchange = () => { edPush(); W.glow.colors = cb.checked ? [...W.glow.colors, k] : W.glow.colors.filter(x => x !== k); edChanged(false); };
      l.append(cb); l.insertAdjacentHTML('beforeend', `<span class="sw" style="background:${hex(c)}"></span>`); pick.append(l);
    });
    gf.append(pick);
    field(gf, 'Above (0 to 1)', numInput(W.glow.above ?? 0, 0, 1, .1, change(v => W.glow.above = v)));
    field(gf, 'Strength', numInput(W.glow.strength ?? 1, 0, 1, .05, change(v => W.glow.strength = v)));
  }
  const ls = section('Light'), lf = document.createElement('div'); lf.className = 'form'; ls.append(lf); bp.append(ls);
  field(lf, 'Gives light', checkInput(!!W.light, change(v => W.light = v ? { color: 'ff9a4a', energy: 1.4, range: 70 } : null, true)));
  if (W.light){
    const ci = document.createElement('input'); ci.type = 'color'; ci.value = '#' + W.light.color; ci.onchange = () => { edPush(); W.light.color = ci.value.slice(1); edChanged(false); };
    field(lf, 'Colour', ci);
    field(lf, 'Energy', numInput(W.light.energy, 0, 4, .1, change(v => W.light.energy = v)));
    field(lf, 'Range', numInput(W.light.range, 10, 200, 5, change(v => W.light.range = v)));
  }
}
document.addEventListener('keydown', e => {
  if (S.mode !== 'make' || M.stage !== 'edit' || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z'){ e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y'){ e.preventDefault(); edRedo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tool = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker' }[k];
  if (tool){ E.tool = tool; renderEditNav(); }
  else if (k === 'm' && M.work.kind !== 'net'){ E.mirror = !E.mirror; renderEditNav(); drawEditCanvas(); }
});
window.addEventListener('resize', () => { if (S.mode === 'make' && M.stage === 'edit') drawEditCanvas(); });

/* ---------- 4. finalise ---------- */
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function builtText(W){
  const b = W.build, k = W.kind;
  let t = k === 'lathe' ? 'lathe'
    : k === 'slab' ? `slab ${b.depth}${Object.keys(b.depths).length ? ', per-colour depth' : ''}${b.border ? `, border [${b.border}]` : ''}`
    : k === 'relief' ? `relief ${b.depth}${b.shell ? `, shell ${b.shell}` : ''}${b.backMode === 'same' ? `, back relief ${b.backDepth}` : b.backMode === 'picture' ? `, relief ${b.backDepth} back from its _back.png` : ''}`
    : k === 'body' ? `body ${b.depth}, lid ${b.lid}${b.dome ? ' domed' : ''}`
    : `box net ${b.net.join('x')}`;
  if (W.glow && W.glow.colors.length) t += ', glow'; if (W.light) t += ', light';
  return t;
}
function madeText(W){
  const base = W.made || 'hand-drawn';
  return (W.edited && !/edited/.test(base) ? base + ', hand-edited' : base) + ' in the workbench';
}
function targets(W, f){
  const replace = W.origin && W.origin.replace && f.where === 'replace';
  const theme = THEMES[f.theme] || THEMES.crypt, hasBack = W.kind === 'relief' && W.build.backMode === 'picture' && W.back;
  if (replace){
    const png = W.origin.png, back = hasBack ? (W.origin.back || png.replace(/\.png$/, '_back.png')) : null, kept = S.keep.get(W.origin.recipe);
    return { replace, recipe: W.origin.recipe, png, back, keep: kept ? kept.list : theme.keep };
  }
  return { replace, recipe: `${theme.recipes}/${f.name}.json`, png: `${theme.sprites}/${f.name}.png`, back: hasBack ? `${theme.sprites}/${f.name}_back.png` : null, keep: theme.keep };
}
function recipeFor(W, t, note){
  let data;
  if (W.origin){
    data = JSON.parse(JSON.stringify(W.origin.data));
    data.parts[W.origin.part] = workPart(W, t.png, t.back, W.origin.at);
  } else data = { parts: [workPart(W, t.png, t.back)] };
  delete data.note;
  return note ? { note, ...data } : data;
}
function keepRow(f, t, W){ return `| ${f.label.replace(/\|/g, '/')} | ${t.recipe} (${madeText(W)}) | ${builtText(W)} |`; }
function withKeepRow(text, row, recipe){
  const lines = (text || '').split('\n'), at = lines.findIndex(l => l.startsWith('|') && l.includes(recipe));
  if (at >= 0){ lines[at] = row; return lines.join('\n'); }
  let last = -1; lines.forEach((l, i) => { if (l.startsWith('|')) last = i; });
  if (last < 0) return (text ? text.replace(/\n*$/, '\n\n') : '# Approved assets\n\n') + '| Asset | Source | Built from |\n|---|---|---|\n' + row + '\n';
  lines.splice(last + 1, 0, row); return lines.join('\n');
}

function renderFinalise(){
  const W = M.work;
  if (!M.fin || M.fin.id !== W.id) M.fin = { id: W.id, name: slug(W.name) || slug((W.label || W.kind) + '_' + (W.seed % 100000)), label: W.label || W.name || '', theme: THEMES[W.theme] ? W.theme : 'crypt',
    where: W.origin && W.origin.replace ? 'replace' : 'new', note: W.origin ? (W.origin.data.note || '') : '', keep: true, sure: false };
  const f = M.fin;
  // the middle: the thing itself, big
  const main = $('main'); main.innerHTML = ''; main.className = 'finalview';
  const cv = document.createElement('canvas'); cv.width = cv.height = 900; const stg = document.createElement('div'); stg.className = 'stage big'; stg.append(cv); main.append(stg);
  const st = new Stage(cv), V = workVox(W); st.set(V); main.append(st.bar(vInfo(V)));
  const pics = document.createElement('div'); pics.className = 'pics'; main.append(pics);
  pics.append(picTile(picCanvas(W.w, W.h, W.front, W.colors), W.kind === 'net' ? 'net' : 'front', '', 160));
  if (W.back && W.kind === 'relief' && W.build.backMode === 'picture') pics.append(picTile(picCanvas(W.w, W.h, W.back, W.colors), 'back', '', 160));
  // the left: a checklist of what happens
  const nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'What happens');
  const list = document.createElement('div'); list.className = 'form'; list.id = 'finList'; nav.append(list);
  // the right: the form
  const el = $('insp'); el.innerHTML = '<div class="ihead">Finalise</div>';
  const sec = section(''), form = document.createElement('div'); form.className = 'form'; sec.append(form); el.append(sec);
  const upd = () => { f.sure = false; renderFinList(); };
  if (W.origin && W.origin.replace) field(form, 'Where', selectInput([['replace', 'Replace ' + W.origin.recipe.split('/').pop()], ['new', 'Save as a new asset']], f.where, v => { f.where = v; renderFinalise(); }));
  if (f.where === 'new' || !W.origin || !W.origin.replace){
    const n = document.createElement('input'); n.value = f.name; n.oninput = () => { f.name = slug(n.value); upd(); }; n.onchange = () => { n.value = f.name; };
    field(form, 'File name', n);
    field(form, 'Theme', selectInput(Object.entries(THEMES).map(([k, t]) => [k, t.label]), f.theme, v => { f.theme = v; upd(); }));
  }
  const lab = document.createElement('input'); lab.value = f.label; lab.oninput = () => { f.label = lab.value; upd(); };
  field(form, 'Name in the keep list', lab);
  field(form, 'Add to the keep list', checkInput(f.keep, v => { f.keep = v; upd(); }));
  const note = document.createElement('textarea'); note.rows = 3; note.value = f.note; note.placeholder = 'what it is, for later'; note.oninput = () => { f.note = note.value; upd(); };
  field(form, 'Note in the recipe', note);
  const act = document.createElement('div'); act.id = 'finActions'; sec.append(act);
  el.append(section('', `<p class="hint">New pictures are imported by Godot the next time the editor opens. A new prop shows up in rooms once a theme in <span class="path">game/themes.gd</span> names its recipe.</p>`));
  renderFinList();
}
function renderFinList(){
  const W = M.work, f = M.fin, t = targets(W, f), list = $('finList'), act = $('finActions'); if (!list) return;
  const bad = !f.name && !t.replace ? 'Give it a file name.' : !f.label.trim() && f.keep ? 'Give it a name for the keep list.' : '';
  const files = [[t.png, 'picture'], ...(t.back ? [[t.back, 'back picture']] : []), [t.recipe, 'recipe'], ...(f.keep ? [[t.keep, 'keep list row']] : [])];
  const clash = files.filter(([p, what]) => what !== 'keep list row' && S.files.has(p) && !t.replace);
  list.innerHTML = files.map(([p, what]) => `<div class="fileline"><span class="badge ${what === 'keep list row' ? 'kept' : S.files.has(p) ? 'miss' : 'used'}">${what === 'keep list row' ? 'adds a row' : S.files.has(p) ? 'replaces' : 'new'}</span> <span>${what}</span><div class="path">${p}</div></div>`).join('')
    + (f.keep ? `<pre class="keeprow">${esc(keepRow(f, t, W))}</pre>` : '')
    + `<details><summary>Recipe JSON</summary><pre>${esc(JSON.stringify(recipeFor(W, t, f.note.trim()), null, 1))}</pre></details>`;
  act.innerHTML = '';
  if (bad){ act.innerHTML = `<p class="warn">${bad}</p>`; return; }
  if (clash.length && !f.sure){
    act.innerHTML = `<p class="warn">${clash.map(c => c[0].split('/').pop()).join(', ')} already exist${clash.length > 1 ? '' : 's'}.</p>`;
    act.append(buttons([['Replace them', () => { f.sure = true; renderFinList(); }]]));
    return;
  }
  act.append(buttons([[canWriteFolder() ? 'Save into the game' : 'Download the files', () => finalise(W, f, t), 'hot big']]));
  if (!canWriteFolder()) act.insertAdjacentHTML('beforeend', '<p class="hint">This browser can only read the folder, so the files download and you move them in. Chrome or Edge can save straight into the game.</p>');
}
async function finalise(W, f, t){
  const data = recipeFor(W, t, f.note.trim()), json = JSON.stringify(data, null, 1) + '\n';
  const front = await canvasPNG(picCanvas(W.w, W.h, W.front, W.colors)), back = t.back ? await canvasPNG(picCanvas(W.w, W.h, W.back, W.colors)) : null;
  const row = keepRow(f, t, W);
  if (!canWriteFolder()){
    download(t.png.split('/').pop(), front); if (back) download(t.back.split('/').pop(), back);
    download(t.recipe.split('/').pop(), new Blob([json], { type: 'application/json' }));
    if (f.keep){ try { await navigator.clipboard.writeText(row); toast('Downloaded; the keep list row is copied'); } catch { toast('Downloaded'); } }
    return;
  }
  try {
    if (!(await askWrite())){ toast('Saving needs permission to change the folder'); return; }
    status('Saving…');
    await writeFile(t.png, front); if (back) await writeFile(t.back, back);
    await writeFile(t.recipe, json);
    if (f.keep) await writeFile(t.keep, withKeepRow(await readText(t.keep), row, t.recipe));
    await scan();
    W.origin = { recipe: t.recipe, data, part: W.origin ? W.origin.part : 0, at: W.origin ? W.origin.at : [0, 0, 0], png: t.png, back: t.back, replace: true };
    W.edited = false; if (isPicked(W)) togglePick(W);
    S.mode = 'browse'; S.view = 'props'; S.theme = 'all'; S.archive = false; S.keptOnly = false; S.query = ''; $('search').value = '';
    S.sel = S.recipes.find(r => r.path === t.recipe) || null;
    render();
    status('Saved ' + t.recipe);
    toast('Saved into the game: ' + t.recipe.split('/').pop());
  } catch (e) { console.error(e); toast('Could not save: ' + e.message); status('Save failed'); }
}
