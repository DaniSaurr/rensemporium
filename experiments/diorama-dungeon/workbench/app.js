/* Ren's Workbench: the game folder, browsing what it holds, and writing back into it. */

const $ = id => document.getElementById(id);
const S = { root: null, files: new Map(), recipes: [], styles: [], sprites: [], monsters: [], keep: new Map(), joints: {}, gdTexts: [], palettes: {},
  mode: 'browse', view: 'props', theme: 'all', archive: false, keptOnly: false, query: '', sel: null };
const pics = new Map(), texts = new Map(), models = new Map();

/* ---------- themes ----------
   Where things live per theme, and where new things go. */
const THEMES = {
  crypt: { label: 'Crypt', sprites: 'art/sprites-crypt', recipes: 'art/recipes/crypt', keep: 'art/KEEP.md' },
  candy: { label: 'Candy grotesque', sprites: 'art/sprites-candy', recipes: 'art/recipes/candy', keep: 'art/KEEP-B.md' },
};
const THEME_LABEL = { crypt: 'Crypt', candy: 'Candy grotesque', witch: 'Witch', early: 'Early tests' };
function themeOf(path){
  if (/candy/.test(path)) return 'candy';
  if (/witch/.test(path)) return 'witch';
  if (/^art\/(sprites|style-tests|test3d)\//.test(path)) return 'early';
  return 'crypt';
}
const paletteTheme = name => /candy/.test(name) ? 'candy' : 'crypt';

/* ---------- reading the folder ---------- */
// only art/, game/ and the scripts at the top: the rest is Godot's and the tools'
const wanted = path => !/(^|\/)\./.test(path) && !path.endsWith('.import') && (/^(art|game)\//.test(path) || /^[^/]+\.gd$/.test(path) || path === 'project.godot');
async function walk(dir, prefix, depth = 0){
  for await (const [name, h] of dir.entries()){
    const path = prefix ? prefix + '/' + name : name;
    if (h.kind === 'directory'){ if (depth > 0 || ['art', 'game'].includes(name)) await walk(h, path, depth + 1); }
    else if (wanted(path)) S.files.set(path, h);
  }
}
function readText(path){
  if (!texts.has(path)) texts.set(path, S.files.has(path) ? S.files.get(path).getFile().then(f => f.text()) : Promise.resolve(null));
  return texts.get(path);
}
function readPic(path){
  if (!pics.has(path)) pics.set(path, (async () => {
    const h = S.files.get(path); if (!h) return null;
    const bmp = await createImageBitmap(await h.getFile());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data } = g.getImageData(0, 0, bmp.width, bmp.height), px = new Int16Array(bmp.width * bmp.height);
    for (let i = 0; i < px.length; i++) px[i] = data[i * 4 + 3] >= 128 ? colourOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) : -1;
    return { w: bmp.width, h: bmp.height, px, colors: COLORS, bmp };
  })().catch(() => null));
  return pics.get(path);
}
const parseJSON = t => { try { return JSON.parse(t); } catch { return null; } };
const forget = path => { pics.delete(path); texts.delete(path); for (const k of models.keys()) models.delete(k); };

// Chrome and Edge hand over the folder itself (and can remember it and write to it); other browsers a list of its files
async function openFolder(handle){
  S.files.clear(); S.root = handle; status('Reading ' + handle.name + '…');
  await walk(handle, '');
  if (await load(handle.name)) saveHandle(handle);
}
async function openFileList(list){
  S.files.clear(); S.root = null;
  const name = list.length ? list[0].webkitRelativePath.split('/')[0] : '';
  for (const f of list){ const path = f.webkitRelativePath.split('/').slice(1).join('/'); if (wanted(path)) S.files.set(path, { getFile: async () => f }); }
  await load(name);
}
async function load(name){
  pics.clear(); texts.clear(); models.clear(); S.sel = null; WITCH_BODY = null;
  if (!S.files.has('project.godot')){ toast('That folder has no project.godot: pick the diorama-dungeon folder'); status('Not a Godot project'); return false; }
  await scan();
  $('folderName').textContent = name;
  $('reopenBtn').hidden = true;
  render();
  status('Read ' + S.files.size + ' files from ' + name + (S.root ? '' : ' · this browser can only read: saving downloads the files instead'));
  return true;
}

async function scan(){
  const paths = [...S.files.keys()];
  // the keep lists: markdown tables whose Source column names the files
  S.keep.clear();
  for (const p of paths.filter(p => /^art\/KEEP[^/]*\.md$/.test(p))){
    const t = await readText(p);
    for (const line of t.split('\n')){
      const cols = line.split('|').map(s => s.trim());
      if (cols.length < 4 || /^-+$/.test(cols[1]) || cols[1] === 'Asset') continue;
      for (const m of cols[2].matchAll(/art\/[\w\-\/.]+\.\w+/g)) S.keep.set(m[0], { asset: cols[1], built: cols[3] || '', list: p, made: (cols[2].match(/\(([^)]*)\)/) || [])[1] || '' });
    }
  }
  // what the game names: its scripts and room files
  S.gdTexts = [];
  for (const p of paths.filter(p => p.endsWith('.gd') || /^art\/room[^/]*\.json$/.test(p))) S.gdTexts.push([p, await readText(p)]);
  const usedBy = p => { const base = '"' + p.split('/').pop() + '"'; return S.gdTexts.filter(([, t]) => t.includes(p) || t.includes(base)).map(([f]) => f); };
  // how her hand holds each item (edited on the Grips page or in Blender)
  S.grips = parseJSON(await readText('art/witch/grips.json')) || {};
  S.grips.kinds = S.grips.kinds || {}; S.grips.styles = S.grips.styles || {};
  S.joints = {};
  const wgd = await readText('game/witch.gd');
  if (wgd) for (const m of wgd.matchAll(/"(\w+)":\s*\["(\w*)",\s*Vector3\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)\]/g)) S.joints[m[1]] = { parent: m[2], at: [+m[3], +m[4], +m[5]] };
  // the palettes drawn for the themes
  S.palettes = {};
  for (const p of paths.filter(p => /^art\/palette-[^/]+\.png$/.test(p))){
    const pic = await readPic(p); if (!pic) continue;
    const seen = new Set(); for (const v of pic.px) if (v >= 0) seen.add(v);
    S.palettes[p.replace(/^art\/palette-|\.png$/g, '')] = [...seen].map(v => COLORS[v].slice());
  }

  S.recipes = [];
  const spriteUse = new Map();
  for (const p of paths.filter(p => p.startsWith('art/recipes/') && p.endsWith('.json')).sort()){
    const data = parseJSON(await readText(p));
    const parts = data && Array.isArray(data.parts) ? data.parts : [];
    const missing = [];
    for (const part of parts) for (const png of [part.png, part.back !== 'same' && part.back].filter(Boolean)){
      if (!S.files.has(png)) missing.push(png);
      if (!spriteUse.has(png)) spriteUse.set(png, []); spriteUse.get(png).push(p);
    }
    const kept = S.keep.get(p) || parts.map(x => S.keep.get(x.png)).find(Boolean) || null, used = usedBy(p);
    S.recipes.push({ type: 'recipe', path: p, name: p.split('/').pop().replace(/\.json$/, ''), theme: themeOf(p), data, parts,
      kinds: [...new Set(parts.map(x => KIND_LABEL[partKind(x)]))], missing, kept, used, live: !!kept || used.length > 0,
      text: JSON.stringify(data || {}).toLowerCase() });
  }
  const liveRecipe = new Set(S.recipes.filter(r => r.live).map(r => r.path));

  S.styles = [];
  for (const p of paths.filter(p => /^art\/witch\/sets\/[^/]+\.json$/.test(p))){
    const name = p.split('/').pop().replace(/\.json$/, ''), set = parseJSON(await readText(p)) || {};
    const slots = {};
    for (const s of WITCH_SLOTS) for (const side of ['front', 'back']){
      const own = `art/witch/sets/${name}/${s}_${side}.png`, old = `art/witch/${s}_${name}_${side}.png`;
      const f = S.files.has(own) ? own : S.files.has(old) ? old : null;
      if (f) (slots[s] = slots[s] || {})[side] = f;
    }
    const pieces = paths.filter(q => q.startsWith('art/witch/pieces/') && q.endsWith('.png') && (q.includes(`_${name}_`) || q.includes('__body_')));
    S.styles.push({ type: 'style', path: p, name: set.label || name, key: name, theme: 'witch', set, slots, pieces, order: set.order ?? 99, live: true,
      text: (name + ' ' + (set.note || '') + ' ' + JSON.stringify(set.wand || {})).toLowerCase() });
  }
  S.styles.sort((a, b) => a.order - b.order);

  S.monsters = [];
  for (const p of paths.filter(p => /^art\/monsters\/[^/]+\.json$/.test(p))){
    const rig = parseJSON(await readText(p)); if (!rig) continue;
    const key = p.split('/').pop().replace(/\.json$/, '');
    S.monsters.push({ type: 'monster', path: p, key, name: rig.label || key, rig, theme: (rig.rooms || []).includes('crypt') ? 'crypt' : 'candy', live: true, used: [],
      text: (key + ' ' + (rig.note || '') + ' ' + (rig.behaviour || '') + ' ' + (rig.plan || '')).toLowerCase() });
  }

  S.sprites = paths.filter(p => /^art\/sprites[^/]*\//.test(p) && p.endsWith('.png')).sort().map(p => {
    const recipes = spriteUse.get(p) || [], kept = S.keep.get(p) || null, used = usedBy(p);
    return { type: 'sprite', path: p, name: p.split('/').pop().replace(/\.png$/, ''), theme: themeOf(p), recipes, kept, used,
      live: !!kept || used.length > 0 || recipes.some(r => liveRecipe.has(r)), text: p.toLowerCase() };
  });
}
const WITCH_SLOTS = ['back', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'hand'];
const FRONT_ORDER = ['back', 'body', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'hand'];
const BACK_ORDER = ['body', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'back', 'hand'];

/* ---------- writing ---------- */
const canWriteFolder = () => !!(S.root && S.root.requestPermission);
async function askWrite(){
  if (!canWriteFolder()) return false;
  if ((await S.root.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await S.root.requestPermission({ mode: 'readwrite' })) === 'granted';
}
async function writeFile(path, data){
  const segs = path.split('/'), name = segs.pop();
  let dir = S.root;
  for (const s of segs) dir = await dir.getDirectoryHandle(s, { create: true });
  const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
  await w.write(data); await w.close();
  S.files.set(path, fh); forget(path);
}
async function removeFile(path){
  const segs = path.split('/'), name = segs.pop();
  let dir = S.root;
  try { for (const s of segs) dir = await dir.getDirectoryHandle(s); await dir.removeEntry(name); } catch {}
  try { await dir.removeEntry(name + '.import'); } catch {}
  S.files.delete(path); forget(path);
}
function download(name, data){
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- remembering the folder between visits ---------- */
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open('rens-workbench', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function saveHandle(h){ try { const db = await idb(); db.transaction('h', 'readwrite').objectStore('h').put(h, 'root'); } catch {} }
async function loadHandle(){ try { const db = await idb(); return await new Promise(res => { const q = db.transaction('h').objectStore('h').get('root'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch { return null; } }

/* ---------- browsing ---------- */
function source(){ return S.view === 'props' ? S.recipes : S.view === 'styles' ? S.styles : S.view === 'monsters' ? S.monsters : S.sprites; }
function items(){
  const q = S.query.trim().toLowerCase();
  let list = source();
  if (!S.archive) list = list.filter(r => r.live);
  if (S.theme !== 'all') list = list.filter(r => r.theme === S.theme);
  if (S.keptOnly) list = list.filter(r => r.kept);
  if (q) list = list.filter(r => r.path.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.text.includes(q) || (r.kept && r.kept.asset.toLowerCase().includes(q)));
  return list;
}
function navHead(nav, t){ const d = document.createElement('div'); d.className = 'navhead'; d.textContent = t; nav.append(d); }
function navItem(nav, label, n, on, fn){ const d = document.createElement('div'); d.className = 'navitem' + (on ? ' on' : ''); d.innerHTML = `<span>${label}</span><span class="n">${n}</span>`; d.onclick = fn; nav.append(d); return d; }
function navCheck(nav, label, on, fn){ const l = document.createElement('label'); l.className = 'navcheck'; const c = document.createElement('input'); c.type = 'checkbox'; c.checked = on; c.onchange = () => fn(c.checked); l.append(c, label); nav.append(l); return c; }

function renderBrowseNav(){
  const nav = $('nav'); nav.innerHTML = '';
  const live = list => list.filter(r => S.archive || r.live).length;
  navHead(nav, 'Assets');
  navItem(nav, 'Props', live(S.recipes), S.view === 'props', () => { S.view = 'props'; S.theme = 'all'; S.sel = null; render(); });
  navItem(nav, 'Witch styles', S.styles.length, S.view === 'styles', () => { S.view = 'styles'; S.theme = 'all'; S.sel = null; render(); });
  navItem(nav, 'Monsters', S.monsters.length, S.view === 'monsters', () => { S.view = 'monsters'; S.theme = 'all'; S.sel = null; render(); });
  navItem(nav, 'Sprites', live(S.sprites), S.view === 'sprites', () => { S.view = 'sprites'; S.theme = 'all'; S.sel = null; render(); });
  if (S.view !== 'styles' && S.view !== 'monsters'){
    const src = source().filter(r => S.archive || r.live), themes = Object.keys(THEME_LABEL).filter(t => src.some(r => r.theme === t));
    navHead(nav, 'Theme');
    navItem(nav, 'All', src.length, S.theme === 'all', () => { S.theme = 'all'; render(); });
    for (const t of themes) navItem(nav, THEME_LABEL[t], src.filter(r => r.theme === t).length, S.theme === t, () => { S.theme = t; render(); });
    navHead(nav, 'Show');
    const hidden = source().filter(r => !r.live).length;
    navCheck(nav, 'Kept only', S.keptOnly, on => { S.keptOnly = on; render(); });
    navCheck(nav, `Archive too (${hidden} not kept or used)`, S.archive, on => { S.archive = on; render(); });
  }
}

let thumbObserver = null;
const thumbQueue = []; let thumbBusy = false;
function queueThumb(fn){ thumbQueue.push(fn); if (!thumbBusy) pumpThumbs(); }
async function pumpThumbs(){
  thumbBusy = true;
  while (thumbQueue.length){ const fn = thumbQueue.shift(); try { await fn(); } catch (e) { console.warn(e); } await new Promise(r => setTimeout(r, 0)); }
  thumbBusy = false;
}
// a grid of cards; each card draws its picture when it scrolls into view
function cardGrid(list, opts){
  const main = $('main'); main.innerHTML = ''; main.className = 'grid'; thumbQueue.length = 0;
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting){ thumbObserver.unobserve(e.target); queueThumb(e.target._draw); } }, { root: main, rootMargin: '200px' });
  if (!list.length){ main.innerHTML = `<div class="empty">${opts.empty || 'Nothing matches.'}</div>`; return; }
  for (const r of list){
    const card = document.createElement('div'); card.className = 'card' + (opts.isOn(r) ? ' on' : '') + (opts.isMarked && opts.isMarked(r) ? ' marked' : '');
    const cv = document.createElement('canvas'); cv.width = cv.height = 200;
    card.innerHTML = `<div class="name" title="${esc(opts.title ? opts.title(r) : '')}">${esc(opts.name(r))}</div><div class="sub">${opts.badges(r)}</div>`;
    card.prepend(cv);
    card.onclick = () => { opts.select(r); main.querySelectorAll('.card.on').forEach(c => c.classList.remove('on')); card.classList.add('on'); };
    if (opts.dbl) card.ondblclick = () => opts.dbl(r);
    cv._draw = () => opts.draw(r, cv);
    thumbObserver.observe(cv);
    main.append(card);
  }
}
const badge = (t, cls = '') => `<span class="badge ${cls}">${t}</span>`;
function renderBrowseGrid(){
  const list = items();
  cardGrid(list, {
    isOn: r => S.sel === r, select: r => { S.sel = r; renderBrowseInspector(); },
    name: r => r.kept ? r.kept.asset : r.name, title: r => r.path,
    badges: r => {
      let html = '';
      if (r.type === 'recipe') html += badge(r.kinds.join(' + ') || 'empty');
      if (r.type === 'style') html += badge(Object.keys(r.slots).length + ' slots') + (r.set.design ? badge('designed') : '');
      if (r.type === 'monster') html += badge(PLANS[r.rig.plan]?.label || r.rig.plan) + badge(r.rig.behaviour);
      if (r.type === 'sprite' && r.recipes.length) html += badge(r.recipes.length + ' recipe' + (r.recipes.length > 1 ? 's' : ''));
      if (r.kept) html += badge('kept', 'kept');
      if (r.used && r.used.length) html += badge('in game', 'used');
      if (r.missing && r.missing.length) html += badge('missing png', 'miss');
      return html;
    },
    draw: drawBrowseThumb,
  });
  const src = source();
  $('counts').textContent = `${list.length} shown · ${src.filter(r => !r.live).length} in the archive`;
}
async function recipeModel(r){
  if (models.has(r.path)) return models.get(r.path);
  const list = [];
  for (const part of r.parts){
    const pic = await readPic(part.png); if (!pic) continue;
    const back = part.back === 'same' ? 'same' : part.back ? await readPic(part.back) : null;
    list.push([partCells(part, pic, back), part.at]);
  }
  const V = mergeParts(list);
  models.set(r.path, V);
  return V;
}
async function drawBrowseThumb(r, cv){
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
  if (r.type === 'recipe') drawThumbV(cv, await recipeModel(r));
  else if (r.type === 'sprite'){ const p = await readPic(r.path); if (p) fitPic(g, p.bmp, cv.width, cv.height); }
  else if (r.type === 'monster'){ if (r.rig.design) fitPic(g, pairCanvas(await monsterPictures(designFromJSON(r.rig.design))), cv.width, cv.height, .95); }
  else fitPic(g, await composeWitch(r, 'front', null), cv.width, cv.height);
}
async function composeWitch(st, side, hidden){
  const c = new OffscreenCanvas(28, 56), g = c.getContext('2d');
  for (const s of side === 'front' ? FRONT_ORDER : BACK_ORDER){
    if (hidden && hidden.has(s)) continue;
    const path = s === 'body' ? `art/witch/body_${side}.png` : st.slots[s] && st.slots[s][side];
    const p = path && await readPic(path); if (p) g.drawImage(p.bmp, 0, 0);
  }
  return c;
}

function section(title, html){ const d = document.createElement('div'); d.className = 'isec'; d.innerHTML = (title ? `<h4>${title}</h4>` : '') + (html || ''); return d; }
function picTile(pic, label, title, size = 140){
  const d = document.createElement('div'); d.className = 'pic'; d.title = title || '';
  if (pic){ const cv = document.createElement('canvas'), img = pic.bmp || pic, k = Math.max(1, Math.floor(size / Math.max(img.width, img.height))); cv.width = img.width * k; cv.height = img.height * k; fitPic(cv.getContext('2d'), img, cv.width, cv.height, 1); d.append(cv); }
  d.append(label); return d;
}
function buttons(list){ const d = document.createElement('div'); d.className = 'actions'; for (const [label, fn, cls] of list){ const b = document.createElement('button'); b.textContent = label; b.className = cls || ''; b.onclick = fn; d.append(b); } return d; }

function renderBrowseInspector(){
  const r = S.sel, el = $('insp'); el.innerHTML = '';
  const head = t => { const h = document.createElement('div'); h.className = 'ihead'; h.textContent = t; el.append(h); };
  if (!r){ head('Inspector'); el.append(section('', '<span class="muted">Pick something to see it here.</span>')); return; }
  const keptHTML = r.kept ? `<table class="kv"><tr><td>Kept as</td><td>${esc(r.kept.asset)}</td></tr><tr><td>Built from</td><td>${esc(r.kept.built)}</td></tr>${r.kept.made ? `<tr><td>Made</td><td>${esc(r.kept.made)}</td></tr>` : ''}<tr><td>Listed in</td><td class="path">${r.kept.list}</td></tr></table>` : '<span class="muted">Not in a keep list.</span>';
  const usedHTML = r.used && r.used.length ? r.used.map(f => `<div class="path">${f}</div>`).join('') : '<span class="muted">Not named by the game\'s scripts or rooms.</span>';
  head(r.kept ? r.kept.asset : r.name);

  if (r.type === 'recipe'){
    const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
    const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
    const st = new Stage(cv), bar = st.bar(); top.append(bar);
    recipeModel(r).then(V => { st.set(V); bar.querySelector('.info').textContent = vInfo(V); });
    el.append(top);
    // into the making side: this part, a copy of it, or variations of it
    const act = section('Make from this');
    let partSel = 0;
    if (r.parts.length > 1){
      const sel = document.createElement('select'); r.parts.forEach((p, i) => sel.add(new Option(`part ${i + 1}: ${p.png.split('/').pop()} (${KIND_LABEL[partKind(p)]})`, i)));
      sel.onchange = () => { partSel = +sel.value; }; act.append(sel);
    }
    act.append(buttons([
      ['Edit', async () => openInEditor(await workFromRecipe(r, partSel, false)), 'hot'],
      ['Edit a copy', async () => openInEditor(await workFromRecipe(r, partSel, true))],
      ['More like this', async () => varyFrom(await workFromRecipe(r, partSel, true))],
    ]));
    el.append(act);
    if (r.missing.length) el.append(section('Missing pictures', r.missing.map(m => `<div class="path warn">${m}</div>`).join('')));
    if (r.data && r.data.note) el.append(section('', esc(r.data.note)));
    r.parts.forEach((p, i) => {
      const rows = [['build', KIND_LABEL[partKind(p)]], ...Object.entries(p).filter(([k]) => !['png', 'back', 'glow', 'light'].includes(k)).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])];
      if (p.glow) rows.push(['glow', (p.glow.colors || []).map(c => `<span class="sw" style="background:#${c}"></span>`).join('') + ` above ${p.glow.above ?? ''}${p.glow.strength != null ? ', strength ' + p.glow.strength : ''}`]);
      if (p.light) rows.push(['light', `<span class="sw" style="background:#${p.light.color}"></span> energy ${p.light.energy}, range ${p.light.range}`]);
      const sec = section(`Part ${i + 1}`), picsBox = document.createElement('div'); picsBox.className = 'pics'; sec.append(picsBox);
      sec.insertAdjacentHTML('beforeend', `<table class="kv">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`);
      for (const [label, path] of [['front', p.png], ['back', p.back && p.back !== 'same' ? p.back : null]]) if (path) readPic(path).then(pic => picsBox.append(picTile(pic, `${label} · ${pic ? pic.w + '×' + pic.h : 'missing'}`, path)));
      el.append(sec);
    });
    el.append(section('Keep list', keptHTML), section('Used by', usedHTML),
      section('File', `<div class="path">${r.path}</div><details><summary>Recipe JSON</summary><pre>${esc(JSON.stringify(r.data, null, 1))}</pre></details>`));
  }
  else if (r.type === 'sprite'){
    const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
    const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
    const info = document.createElement('div'); info.className = 'muted'; info.style.marginTop = '6px'; top.append(info);
    el.append(top);
    readPic(r.path).then(p => {
      if (!p) return; fitPic(cv.getContext('2d'), p.bmp, cv.width, cv.height);
      const used = new Set(); for (const v of p.px) if (v >= 0) used.add(v);
      info.innerHTML = `${p.w}×${p.h} · ${used.size} colours<br>` + [...used].slice(0, 48).map(v => `<span class="sw" title="#${hexOf(COLORS[v])}" style="background:${hex(COLORS[v])}"></span>`).join('');
    });
    const act = section('Make from this');
    const kind = document.createElement('select'); for (const k of ['relief', 'slab', 'lathe', 'body']) kind.add(new Option('as a ' + KIND_LABEL[k], k));
    act.append(kind, buttons([['Start from this picture', async () => openInEditor(await workFromSprite(r, kind.value)), 'hot']]));
    el.append(act, section('In recipes', r.recipes.length ? r.recipes.map(p => `<div class="path">${p}</div>`).join('') : '<span class="muted">No recipe builds this picture.</span>'),
      section('Keep list', keptHTML), section('Used by', usedHTML), section('File', `<div class="path">${r.path}</div>`));
  }
  else if (r.type === 'monster') renderMonsterInspector(r, el);
  else renderStyleInspector(r, el);
}
function renderMonsterInspector(r, el){
  const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
  const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
  const st = new RigStage(cv); top.append(st.bar()); el.append(top);
  const D = r.rig.design ? designFromJSON(r.rig.design) : null;
  if (D){ D.savedAs = r.key; monsterRig(D).then(rig => st.set(rig)); }
  el.append(section('Make from this').appendChild(buttons([
    ['Design', () => D && openDesign(Object.assign(cloneDesign(D), { savedAs: r.key, name: r.key })), 'hot'],
    ['Design a copy', () => D && openDesign(Object.assign(cloneDesign(D), { savedAs: undefined, name: r.key + '_copy' }))],
    ['More like this', () => { if (D){ M.what = 'monster'; varyCharFrom(D); } }],
  ])).parentNode);
  el.append(section('', esc(r.rig.note || '')), section('In the game', `<table class="kv"><tr><td>behaviour</td><td>${esc(r.rig.behaviour)}: ${BEHAVIOURS[r.rig.behaviour] || ''}</td></tr><tr><td>rooms</td><td>${(r.rig.rooms || []).join(', ')}</td></tr><tr><td>hit points</td><td>${r.rig.hp}</td></tr><tr><td>plan</td><td>${r.rig.plan}</td></tr></table>`),
    section('File', `<div class="path">${r.path}</div>`));
}
function renderStyleInspector(r, el){
  const w = r.set.wand, shot = w && w.shot;
  const wandRows = w ? Object.entries(w).filter(([k]) => k !== 'shot').map(([k, v]) => [k, k === 'flash' ? `<span class="sw" style="background:#${v}"></span> ${v}` : v]) : [];
  if (shot) wandRows.push(['shot', `${shot.shape} ` + (shot.colours || []).map(c => `<span class="sw" style="background:#${c}"></span>`).join('')]);
  el.insertAdjacentHTML('beforeend', `
    <div class="isec"><div class="witchpair"><canvas id="wFront" width="224" height="448"></canvas><canvas id="wBack" width="224" height="448"></canvas></div>
      <div class="stagebar"><button id="jointBtn">Show joints</button><span class="muted">front · back</span></div></div>
    <div class="isec"><h4>Slots</h4><div class="slots" id="slotBox"></div></div>
    ${r.set.note ? `<div class="isec">${esc(r.set.note)}</div>` : ''}
    <div class="isec"><h4>Wand</h4>${w ? `<table class="kv">${wandRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>` : '<span class="muted">No hand item.</span>'}</div>
    <div class="isec"><h4>Pieces the game builds (${r.pieces.length})</h4><div class="pics" id="pieceBox"></div></div>
    <div class="isec"><h4>Files</h4><div class="path">${r.path}</div>${Object.values(r.slots).flatMap(s => Object.values(s)).map(p => `<div class="path">${p}</div>`).join('')}</div>`);
  const mk = section('Make from this'); el.querySelector('.isec').after(mk);
  mk.append(buttons([
    ['Design', async () => { const D = await witchFromStyle(r); openDesign(D); }, 'hot'],
    ['Design a copy', async () => { const D = await witchFromStyle(r); D.replace = undefined; D.name = r.key + '_copy'; openDesign(cloneDesign(D)); }],
    ['More like this', async () => { const D = await witchFromStyle(r); M.what = 'witch'; varyCharFrom(D); }],
  ]));
  if (!r.set.design) mk.insertAdjacentHTML('beforeend', '<p class="hint">Opens with every slot as a hand-drawn part; swap any of them for dialled parts.</p>');
  const hidden = new Set(); let joints = false;
  const draw = async () => {
    for (const [id, side] of [['wFront', 'front'], ['wBack', 'back']]){
      const cv = $(id); if (!cv) return; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false; g.drawImage(await composeWitch(r, side, hidden), 0, 0, cv.width, cv.height);
      if (joints) drawJoints(g, cv.width / 28, side);
    }
  };
  for (const s of FRONT_ORDER){
    if (s !== 'body' && !r.slots[s]) continue;
    const l = document.createElement('label'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = true;
    c.onchange = () => { c.checked ? hidden.delete(s) : hidden.add(s); draw(); }; l.append(c, s); $('slotBox').append(l);
  }
  $('jointBtn').onclick = e => { joints = !joints; e.target.classList.toggle('on', joints); draw(); };
  draw();
  r.pieces.filter(p => p.endsWith('_front.png')).forEach(async path => { const pic = await readPic(path); if (pic) $('pieceBox').append(picTile(pic, path.split('/').pop().split('__')[0], path, 56)); });
}
function drawJoints(g, k, side){
  const J = S.joints, sx = a => (14 + (side === 'back' ? -a[0] : a[0])) * k, sy = a => (56 - a[1]) * k;
  g.lineWidth = 2; g.strokeStyle = 'rgba(232,145,43,.9)';
  for (const j of Object.values(J)) if (j.parent && J[j.parent]){ g.beginPath(); g.moveTo(sx(J[j.parent].at), sy(J[j.parent].at)); g.lineTo(sx(j.at), sy(j.at)); g.stroke(); }
  g.font = `600 ${Math.round(k * 1.5)}px Segoe UI, sans-serif`; g.lineJoin = 'round';
  const placed = new Set();
  for (const j of Object.values(J)){
    g.fillStyle = '#e8912b'; g.beginPath(); g.arc(sx(j.at), sy(j.at), k * .6, 0, Math.PI * 2); g.fill();
    // joints that share a spot (hips and torso) share one label
    const spot = j.at.join(','), label = Object.entries(J).filter(([, o]) => o.at.join(',') === spot).map(([n]) => n).join(' / ');
    if (placed.has(spot)) continue; placed.add(spot);
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 3; g.strokeText(label, sx(j.at) + k, sy(j.at) - k * .5);
    g.fillStyle = '#fff'; g.fillText(label, sx(j.at) + k, sy(j.at) - k * .5);
    g.strokeStyle = 'rgba(232,145,43,.9)'; g.lineWidth = 2;
  }
}

/* ---------- from the game into a work item ---------- */
async function workFromRecipe(r, i, asCopy){
  const part = r.parts[i], pic = await readPic(part.png), backPic = part.back && part.back !== 'same' ? await readPic(part.back) : null;
  if (!pic){ toast('That part\'s picture is missing'); throw new Error('missing'); }
  const { colors, pics: [f, b] } = localise([pic, backPic]), kind = partKind(part);
  const theme = THEMES[r.theme] ? r.theme : 'crypt';
  const W = newWork({ kind, w: f.w, h: f.h, front: f.px, back: b ? resample(b, f.w, f.h) : null, colors, theme,
    name: r.name + (asCopy ? '_copy' : ''), label: (r.kept ? r.kept.asset : r.name) + (asCopy ? ', copy' : ''), made: r.kept && r.kept.made ? r.kept.made : 'hand-drawn',
    glow: part.glow ? { colors: [...(part.glow.colors || [])], above: part.glow.above ?? 0, strength: part.glow.strength } : null,
    light: part.light ? { ...part.light } : null,
    build: { depth: part.slab ?? part.relief ?? part.body ?? 3, depths: part.depths || {}, border: part.border || null, shell: part.shell || 0,
      backMode: part.back === 'same' ? 'same' : part.back ? 'picture' : 'none', backDepth: part.back_relief ?? 3, lid: part.lid ?? 1, dome: !!part.dome,
      bodyHex: part.body_color || '', net: part.net || DEFAULT_BUILD.net },
    origin: { recipe: r.path, data: r.data, part: i, at: part.at || [0, 0, 0], png: part.png, back: part.back && part.back !== 'same' ? part.back : null, replace: !asCopy } });
  await ensureOthers(W);
  return W;
}
// the other parts of the recipe a work item came from, built so it is seen in place
async function ensureOthers(W){
  if (!W.origin || W._others) return;
  const list = [];
  for (const [j, p] of W.origin.data.parts.entries()){
    if (j === W.origin.part) continue;
    const pic = await readPic(p.png); if (!pic) continue;
    const back = p.back === 'same' ? 'same' : p.back ? await readPic(p.back) : null;
    list.push([partCells(p, pic, back), p.at]);
  }
  W._others = list; touch(W);
}
async function workFromSprite(r, kind){
  const pic = await readPic(r.path); const { colors, pics: [f] } = localise([pic]);
  return newWork({ kind, w: f.w, h: f.h, front: f.px, colors, theme: THEMES[r.theme] ? r.theme : 'crypt', name: r.name, label: r.name, made: 'hand-drawn',
    build: { depth: kind === 'slab' ? 2 : kind === 'body' ? 6 : 4 } });
}

/* ---------- the page ---------- */
const EMPTY_HTML = `<div class="empty"><b>Open your diorama-dungeon folder</b> to browse its props, witch styles and sprites,<br />
  and to save what you make straight into it.<br /><span class="muted">Chrome and Edge can save; Firefox can read, and downloads what you make.</span></div>`;
function status(t){ $('status').textContent = t; }
let toastTimer = 0;
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3200); }
function render(){
  document.body.dataset.mode = S.mode;
  document.querySelectorAll('[data-mode-tab]').forEach(b => b.classList.toggle('on', b.dataset.modeTab === S.mode));
  if (S.mode === 'browse'){
    $('stepper').hidden = true; $('search').hidden = false;
    if (!S.files.size){
      $('main').className = 'grid'; $('main').innerHTML = EMPTY_HTML; $('nav').innerHTML = '';
      $('insp').innerHTML = '<div class="ihead">Inspector</div><div class="isec muted">Open the game folder to browse it. Make works without it.</div>';
      return;
    }
    renderBrowseNav(); renderBrowseGrid(); renderBrowseInspector();
  } else if (S.mode === 'grips') renderGrips();
  else { $('stepper').hidden = false; $('search').hidden = true; renderMake(); }
}
function wire(){
  $('openBtn').onclick = async () => {
    if (!window.showDirectoryPicker){ $('folderInput').click(); return; }
    try { await openFolder(await window.showDirectoryPicker({ id: 'diorama-dungeon', mode: 'readwrite' })); }
    catch (e) { if (e.name !== 'AbortError'){ console.error(e); toast('Could not read that folder'); } }
  };
  $('folderInput').onchange = e => { if (e.target.files.length) openFileList([...e.target.files]); };
  $('search').oninput = e => { S.query = e.target.value; renderBrowseGrid(); };
  document.querySelectorAll('[data-mode-tab]').forEach(b => b.onclick = () => { S.mode = b.dataset.modeTab; render(); });
  (async () => {
    const h = await loadHandle(); if (!h) return;
    const b = $('reopenBtn'); b.hidden = false; b.textContent = 'Reopen ' + h.name;
    b.onclick = async () => { if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') openFolder(h); else toast('Permission was not given'); };
  })();
  loadPicks();
  render();
}
