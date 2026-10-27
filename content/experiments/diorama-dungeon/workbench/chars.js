/* Ren's Workbench: designing characters. Witches and monsters share this: a batch from a brief,
   picks, a designer with every part's kind, dials and lock, hand drawing, and saving into the game. */

const CHAR = {
  witch: { label: 'Witch', briefs: () => WITCH_BRIEFS, parts: () => WITCH_PARTS, slots: () => ['hat', 'hair', 'top', 'bottom', 'legs', 'shoes', 'back', 'hand'],
    gen: genWitch, rig: witchRig, pictures: witchPictures, files: witchFiles, size: [WW, WH] },
  monster: { label: 'Monster', briefs: () => MONSTER_BRIEFS, parts: () => MONSTER_PARTS, slots: D => ['body', 'head', 'eyes', 'mouth', 'crest', 'arms', 'legs', 'tail', 'wings'].filter(s => M_SLOTS_FOR(D.plan).includes(s)),
    gen: genMonster, rig: monsterRig, pictures: monsterPictures, files: monsterFiles, size: [MW, MH] },
};
const GAME_ROOMS = ['crypt', 'hatchery', 'optician', 'sweetshop'];
const BEHAVIOURS = { float: 'floats and fires rings', hop: 'hops at you and spits a spread', walk: 'chases on foot and fires bursts', skull: 'floats after you and burns on touch' };
function CH(){ const what = M.what; if (!M.ch) M.ch = {}; return M.ch[what] || (M.ch[what] = { stage: 'generate', brief: '', seed: (Math.random() * 1e6) | 0, count: 12, batch: [], sel: null, source: null, strength: .5, drift: true, picks: loadCharPicks(what), work: null, palette: '' }); }
function loadCharPicks(what){ try { return (JSON.parse(localStorage.getItem('rens-workbench-' + what)) || []).map(designFromJSON); } catch { return []; } }
function saveCharPicks(){ try { localStorage.setItem('rens-workbench-' + M.what, JSON.stringify(CH().picks.slice(-60).map(designToJSON))); } catch {} }
const charPicked = D => CH().picks.includes(D);
function toggleCharPick(D){ const C = CH(); if (charPicked(D)) C.picks.splice(C.picks.indexOf(D), 1); else C.picks.push(D); saveCharPicks(); renderStepper(); document.querySelectorAll('#main .card').forEach(c => { if (c._work) c.classList.toggle('marked', charPicked(c._work)); }); }
const charTheme = D => D.theme === 'candy' ? 'candy' : 'crypt';

/* ---------- making a batch ---------- */
function charScheme(D, rng){
  const C = CH(), list = C.palette && S.palettes[C.palette] ? S.palettes[C.palette] : C.palette === 'harmony' ? makeColors(rng, 6, { mode: 'harmony' }) : themePalette(D.theme);
  const b = CHAR[D.type].briefs()[D.brief];
  return schemeFrom(rng, list, (b && b.prefer) || {});
}
function charRegen(){
  const C = CH(), T = CHAR[M.what];
  C.batch = Array.from({ length: C.count }, (_, i) => {
    const s = hash32((C.seed ^ hash32(i + 1)) >>> 0);
    if (C.source) return varyChar(C.source, s, C.strength, C.drift);
    const D = T.gen(s, C.brief); D.scheme = charScheme(D, mulberry32(s ^ 77)); if (D.type === 'witch') { D.wand = null; D.wand = wandFor(D); }
    return D;
  });
  C.sel = null;
}
// more like this: unlocked parts re-roll their dials (now and then their kind) inside the brief
function varyChar(src, seed, strength, drift){
  const D = cloneDesign(src), rng = mulberry32(seed), T = CHAR[D.type], b = T.briefs()[D.brief] || { slots: {} }, lib = T.parts();
  D.seed = seed; D.replace = undefined;
  for (const slot of T.slots(D)){
    const part = D.parts[slot]; if (!part || part.lock || part.kind === 'drawn') continue;
    if (rng() > strength) continue;
    const opts = (b.slots && b.slots[slot]) || [[part.kind, {}]];
    if (rng() < .3 && opts.length > 1) D.parts[slot] = rollPart(D.type, slot, b, rng);
    else { const o = opts.find(x => x[0] === part.kind); D.parts[slot] = { ...part, dials: dialsWithin(lib[slot][part.kind], rng, o ? o[1] : {}) }; }
  }
  if (drift && rng() < .5){ const k = ['alt', 'accent', 'trim'][ri(rng, 3)]; const fresh = charScheme(D, rng); D.scheme = { ...D.scheme, [k]: fresh[k] }; }
  if (D.type === 'witch'){ pairTrousers(D, rng); D.wand = wandFor({ ...D, wand: null }); }
  return D;
}

/* ---------- the views ---------- */
function renderChar(){
  const C = CH();
  if (C.stage === 'generate') renderCharGenerate();
  else if (C.stage === 'picked') renderCharPicked();
  else if (C.stage === 'edit' && C.work) renderCharDesign();
  else if (C.stage === 'finalise' && C.work) renderCharFinalise();
  else { C.stage = 'generate'; renderChar(); }
}
function charCards(list, empty){
  const C = CH();
  cardGrid(list, {
    isOn: D => C.sel === D, select: D => { C.sel = D; renderCharInspector(D); }, dbl: D => openDesign(cloneDesign(D)), isMarked: charPicked,
    name: D => D.label || D.name, title: D => (CHAR[D.type].briefs()[D.brief] || {}).note || '',
    badges: D => badge((CHAR[D.type].briefs()[D.brief] || {}).label || 'own') + (D.type === 'monster' ? badge(PLANS[D.plan].label) : '') + badge(THEME_LABEL[charTheme(D)]),
    draw: async (D, cv) => { const pics = await CHAR[D.type].pictures(D), g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); const pair = pairCanvas(pics); fitPic(g, pair, cv.width, cv.height, .95); },
    empty,
  });
  $('main').querySelectorAll('.card').forEach((c, i) => c._work = list[i]);
  $('main').tabIndex = 0;
  $('main').onkeydown = e => { if (!C.sel || e.target.tagName === 'INPUT') return; const k = e.key.toLowerCase();
    if (k === 'p'){ toggleCharPick(C.sel); renderCharInspector(C.sel); } else if (k === 'e') openDesign(cloneDesign(C.sel)); else if (k === 'm') varyCharFrom(C.sel); };
}
// front and back side by side, for cards
function pairCanvas(pics){
  const w = pics.front.w, h = pics.front.h, c = document.createElement('canvas'); c.width = w * 2 + 2; c.height = h;
  const g = c.getContext('2d'); g.drawImage(picCanvas(w, h, pics.front.px, pics.front.colors), 0, 0); g.drawImage(picCanvas(w, h, pics.back.px, pics.back.colors), w + 2, 0);
  return c;
}
function renderCharGenerate(){
  const C = CH(), T = CHAR[M.what], briefs = T.briefs();
  if (!C.batch.length) charRegen();
  const nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Brief');
  navItem(nav, 'Any brief', '', !C.source && !C.brief, () => { C.brief = ''; C.source = null; charRegen(); renderCharGenerate(); });
  for (const [k, b] of Object.entries(briefs)) navItem(nav, b.label, THEME_LABEL[b.theme] + (b.plan ? ' · ' + PLANS[b.plan].label.toLowerCase() : ''), !C.source && C.brief === k, () => { C.brief = k; C.source = null; charRegen(); renderCharGenerate(); });
  if (C.source) navItem(nav, 'Variations of ' + (C.source.label || 'this'), '', true, () => {});
  navItem(nav, 'Blank ' + T.label.toLowerCase(), '', false, () => openDesign(blankChar()));
  const f = document.createElement('div'); f.className = 'form'; nav.append(f);
  if (C.source){
    field(f, 'How much changes', numInput(C.strength, .1, 1, .05, v => { C.strength = v; charRegenSoon(); }));
    field(f, 'Colours drift', checkInput(C.drift, v => { C.drift = v; charRegenSoon(); }));
    f.append(buttons([['Back to briefs', () => { C.source = null; charRegen(); renderCharGenerate(); }]]));
    f.insertAdjacentHTML('beforeend', '<p class="hint">Locked parts stay as they are.</p>');
  }
  navHead(nav, 'Look');
  const look = document.createElement('div'); look.className = 'form'; nav.append(look);
  field(look, 'Colours from', selectInput([['', 'the brief\'s theme'], ...Object.keys(S.palettes).map(k => [k, k + ' palette']), ['harmony', 'harmony (free)']], C.palette, v => { C.palette = v; charRegenSoon(); }));
  navHead(nav, 'Batch');
  const bb = document.createElement('div'); bb.className = 'form'; nav.append(bb);
  const seed = document.createElement('input'); seed.value = C.seed; seed.onchange = () => { C.seed = seedFromText(seed.value); charRegenSoon(); };
  field(bb, 'Seed', seed);
  field(bb, 'How many', selectInput(['6', '12', '24'], String(C.count), v => { C.count = +v; charRegenSoon(); }));
  bb.append(buttons([['New batch', () => { C.seed = (Math.random() * 1e6) | 0; seed.value = C.seed; charRegen(); renderCharGenerate(); }, 'hot']]));
  bb.insertAdjacentHTML('beforeend', '<p class="hint">Click to see it move, <b>P</b> picks, <b>E</b> designs, <b>M</b> more like this.</p>');
  charCards(C.batch);
  $('counts').textContent = `${C.batch.length} in this batch · ${C.picks.length} picked`;
  renderCharInspector(C.sel);
}
let charRegenTimer = 0;
const charRegenSoon = () => { clearTimeout(charRegenTimer); charRegenTimer = setTimeout(() => { charRegen(); charCards(CH().batch); renderCharInspector(null); }, 150); };
function varyCharFrom(D){ const C = CH(); C.source = cloneDesign(D); C.seed = (Math.random() * 1e6) | 0; C.stage = 'generate'; S.mode = 'make'; charRegen(); render(); }
function blankChar(){
  if (M.what === 'witch'){ const D = newWitchDesign({ brief: '', name: 'new_witch', label: 'new witch', theme: 'crypt' }); D.scheme = schemeFrom(mulberry32(1), themePalette('crypt')); for (const s of W_SLOTS) D.parts[s] = { kind: s === 'top' ? 'bodice' : s === 'legs' ? 'stockings' : 'none', dials: dialDefaults(WITCH_PARTS[s][s === 'top' ? 'bodice' : s === 'legs' ? 'stockings' : 'none']), lock: false }; return D; }
  const D = newMonsterDesign({ brief: '', plan: 'biped', name: 'new_monster', label: 'new monster', behaviour: 'walk' }); D.scheme = schemeFrom(mulberry32(1), themePalette('crypt'));
  for (const s of M_SLOTS_FOR('biped')) D.parts[s] = { kind: s === 'body' ? 'trunk' : s === 'head' ? 'round' : s === 'eyes' ? 'pair' : s === 'legs' ? 'stubby' : 'none', dials: {}, lock: false };
  for (const [s, p] of Object.entries(D.parts)) p.dials = dialDefaults(MONSTER_PARTS[s][p.kind]);
  return D;
}

// the right panel: the character moving, and what to do with it
async function renderCharInspector(D, actions){
  const el = $('insp'); el.innerHTML = '';
  const h = document.createElement('div'); h.className = 'ihead'; h.textContent = D ? (D.label || D.name) : 'Preview'; el.append(h);
  if (!D){ el.append(section('', '<span class="muted">Click one to see it move.</span>')); return; }
  const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
  const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
  const st = new RigStage(cv); top.append(st.bar()); el.append(top);
  CHAR[D.type].rig(D).then(r => st.set(r));
  el.append(section('', '').appendChild(buttons(actions || [
    [charPicked(D) ? 'Unpick' : 'Pick', () => { toggleCharPick(D); renderCharInspector(D, actions); }, charPicked(D) ? '' : 'hot'],
    ['Design', () => openDesign(cloneDesign(D))],
    ['More like this', () => varyCharFrom(D)],
  ])).parentNode);
  const b = CHAR[D.type].briefs()[D.brief];
  if (b) el.append(section(b.label, esc(b.note)));
  const lib = CHAR[D.type].parts();
  el.append(section('Parts', `<table class="kv">${CHAR[D.type].slots(D).map(s => `<tr><td>${s}</td><td>${D.parts[s] ? (D.parts[s].kind === 'drawn' ? 'drawn by hand' : lib[s][D.parts[s].kind]?.label || D.parts[s].kind) : '—'}</td></tr>`).join('')}</table>`));
  el.append(section('Colours', KEY_ROLES.map(r => D.scheme[r] ? `<span class="sw" title="${r} ${D.scheme[r]}" style="background:${D.scheme[r]}"></span>` : '').join('') + ` <span class="muted">${MOTIFS[D.motif]?.label || D.motif}</span>`));
}
function renderCharPicked(){
  const C = CH(), nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Picked');
  const p = document.createElement('div'); p.className = 'form'; nav.append(p);
  p.insertAdjacentHTML('beforeend', `<p class="hint">Every ${CHAR[M.what].label.toLowerCase()} you picked, kept in this browser until it goes into the game.</p>`);
  if (C.picks.length) p.append(buttons([['Clear all', () => { if (confirm('Forget every pick?')){ C.picks = []; saveCharPicks(); renderChar(); } }]]));
  if (C.sel && !C.picks.includes(C.sel)) C.sel = null;
  charCards(C.picks, 'Nothing picked yet. In Generate, click one and press <b>P</b>.');
  $('counts').textContent = `${C.picks.length} picked`;
  renderCharInspector(C.sel, C.sel && [['Design', () => openDesign(cloneDesign(C.sel)), 'hot'], ['More like this', () => varyCharFrom(C.sel)], ['Remove', () => { toggleCharPick(C.sel); C.sel = null; renderCharPicked(); }]]);
}

/* ---------- the designer ---------- */
function openDesign(D){ M.what = D.type; const C = CH(); C.work = D; C.stage = 'edit'; S.mode = 'make'; render(); }
let charStage = null, designTimer = 0;
function designChanged(full){
  const D = CH().work; D.edited = true;
  if (D.type === 'witch' && D.parts.hand && D.parts.hand.kind !== 'drawn') D.wand = wandFor(D);
  clearTimeout(designTimer);
  designTimer = setTimeout(async () => {
    const T = CHAR[D.type], rig = await T.rig(D);
    if (charStage) charStage.set(rig);
    drawDesignViews(rig.pics);
    if (full) renderDesignNav();
  }, 40);
}
function renderCharDesign(){
  const D = CH().work;
  renderDesignNav();
  const main = $('main'); main.innerHTML = ''; main.className = 'designer';
  main.insertAdjacentHTML('beforeend', `<div class="views"><div><canvas id="dvFront"></canvas><span>front</span></div><div><canvas id="dvBack"></canvas><span>back</span></div></div><div class="slotgrid" id="slotGrid"></div>`);
  renderSlotGrid();
  const el = $('insp'); el.innerHTML = `<div class="ihead">${esc(D.label || D.name || 'Untitled')}</div>`;
  const top = section(''), cv = document.createElement('canvas'); cv.width = cv.height = 720;
  const box = document.createElement('div'); box.className = 'stage'; box.append(cv); top.append(box);
  charStage = new RigStage(cv); top.append(charStage.bar()); el.append(top);
  el.append(section('', '').appendChild(buttons([
    ['Finalise →', () => { CH().stage = 'finalise'; renderMake(); }, 'hot'],
    [charPicked(D) ? 'Picked' : 'Pick for later', () => { if (!charPicked(D)) toggleCharPick(D); renderCharDesign(); }],
    ['More like this', () => varyCharFrom(D)],
  ])).parentNode);
  const stats = section(D.type === 'witch' ? 'Wand' : 'In the game'); el.append(stats);
  renderStats(D, stats);
  $('counts').textContent = '';
  designChanged(false);
}
function drawDesignViews(pics){
  for (const [id, side] of [['dvFront', 'front'], ['dvBack', 'back']]){
    const cv = $(id); if (!cv) return; const p = pics[side], room = ($('main').clientWidth - 60) / 2;
    const k = Math.max(2, Math.floor(Math.min(room / p.w, 380 / p.h)));
    cv.width = p.w * k; cv.height = p.h * k; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#262626'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(picCanvas(p.w, p.h, p.px, p.colors), 0, 0, cv.width, cv.height);
  }
}
function renderDesignNav(){
  const D = CH().work, T = CHAR[D.type], nav = $('nav'); nav.innerHTML = '';
  navHead(nav, 'Brief');
  const f = document.createElement('div'); f.className = 'form'; nav.append(f);
  field(f, 'Brief', selectInput([['', 'none (own design)'], ...Object.entries(T.briefs()).map(([k, b]) => [k, b.label])], D.brief, v => { D.brief = v; renderDesignNav(); }));
  if (D.brief) f.insertAdjacentHTML('beforeend', `<p class="hint">${esc(T.briefs()[D.brief].note)}</p>`);
  if (D.type === 'monster') field(f, 'Body plan', selectInput(Object.entries(PLANS).map(([k, p]) => [k, p.label + ' · ' + p.note]), D.plan, v => changePlan(D, v)));
  f.append(buttons([['Roll unlocked parts', () => { rollUnlocked(D); renderSlotGrid(); designChanged(true); }], ['Roll colours', () => { D.scheme = { ...charScheme(D, mulberry32((Math.random() * 1e9) | 0)) }; designChanged(true); }]]));
  navHead(nav, 'Colours');
  const cf = document.createElement('div'); cf.className = 'form'; nav.append(cf);
  M.activeRole = M.activeRole || 'main';
  for (const r of KEY_ROLES){
    const row = document.createElement('div'); row.className = 'rolerow' + (M.activeRole === r ? ' on' : '');
    const ci = document.createElement('input'); ci.type = 'color'; ci.value = D.scheme[r] || '#888888';
    ci.oninput = () => { D.scheme[r] = ci.value; designChanged(false); };
    const lab = document.createElement('span'); lab.textContent = r; row.onclick = e => { if (e.target === ci) return; M.activeRole = r; renderDesignNav(); };
    row.append(ci, lab); cf.append(row);
  }
  const pal = themePalette(charTheme(D)).concat(...Object.entries(S.palettes).filter(([k]) => paletteTheme(k) !== charTheme(D)).map(([, v]) => v).slice(0, 0));
  if (pal.length){
    const strip = document.createElement('div'); strip.className = 'palette small'; cf.append(strip);
    for (const col of pal){ const s = document.createElement('button'); s.className = 'swatch'; s.style.background = hex(col); s.title = `set ${M.activeRole} to ${hex(col)}`; s.onclick = () => { D.scheme[M.activeRole] = hex(col); designChanged(true); }; strip.append(s); }
    cf.insertAdjacentHTML('beforeend', '<p class="hint">Click a role, then a colour from the theme\'s palette.</p>');
  }
  field(cf, 'Theme', selectInput([['crypt', 'Crypt'], ['candy', 'Candy grotesque']], charTheme(D), v => { D.theme = v; renderDesignNav(); }));
  navHead(nav, 'Motif');
  const mf = document.createElement('div'); mf.className = 'form'; nav.append(mf);
  field(mf, 'Runs through every part', selectInput(Object.entries(MOTIFS).map(([k, m]) => [k, m.label]), D.motif, v => { D.motif = v; designChanged(false); }));
  field(mf, 'Scale', numInput(D.motifScale, 1, 5, 1, v => { D.motifScale = v; designChanged(false); }));
}
function rollUnlocked(D){
  const T = CHAR[D.type], b = T.briefs()[D.brief] || { slots: {} }, rng = mulberry32((Math.random() * 1e9) | 0);
  for (const slot of T.slots(D)){ const p = D.parts[slot]; if (p && (p.lock || p.kind === 'drawn')) continue; D.parts[slot] = rollPart(D.type, slot, b.slots && b.slots[slot] ? b : { slots: { [slot]: Object.keys(T.parts()[slot]).map(k => [k, {}]) } }, rng); }
  if (D.type === 'witch') pairTrousers(D, rng);
}
function changePlan(D, plan){
  D.plan = plan; D.behaviour = PLANS[plan].behaviour;
  for (const s of Object.keys(D.parts)) if (!M_SLOTS_FOR(plan).includes(s)) delete D.parts[s];
  for (const s of M_SLOTS_FOR(plan)) if (!D.parts[s]){ const k = s === 'head' ? 'round' : 'none'; D.parts[s] = { kind: k, dials: dialDefaults(MONSTER_PARTS[s][k]), lock: false }; }
  if (!D.parts.body || !BODY_FOR[plan].includes(D.parts.body.kind)){ const k = BODY_FOR[plan][0]; D.parts.body = { kind: k, dials: dialDefaults(MONSTER_PARTS.body[k]), lock: false }; }
  renderCharDesign();
}
function renderSlotGrid(){
  const D = CH().work, T = CHAR[D.type], lib = T.parts(), grid = $('slotGrid'); if (!grid) return; grid.innerHTML = '';
  for (const slot of T.slots(D)){
    const part = D.parts[slot] || (D.parts[slot] = { kind: Object.keys(lib[slot])[0], dials: {}, lock: false });
    const card = document.createElement('div'); card.className = 'slotcard' + (part.lock ? ' locked' : '');
    const head = document.createElement('div'); head.className = 'slothead';
    const name = document.createElement('b'); name.textContent = slot;
    const fits = k => !(D.type === 'monster' && slot === 'body') || BODY_FOR[D.plan].includes(k);
    const kinds = [...Object.entries(lib[slot]).filter(([k]) => fits(k)).map(([k, v]) => [k, v.label]), ...(part.kind === 'drawn' ? [['drawn', 'drawn by hand']] : [])];
    const kind = selectInput(kinds, part.kind, v => { D.parts[slot] = { kind: v, dials: dialDefaults(lib[slot][v]), lock: part.lock }; if (D.type === 'witch') pairTrousers(D); renderSlotGrid(); designChanged(false); });
    const lock = document.createElement('button'); lock.className = 'mini' + (part.lock ? ' on' : ''); lock.textContent = part.lock ? 'locked' : 'lock'; lock.title = 'Locked parts stay put when you roll or vary';
    lock.onclick = () => { part.lock = !part.lock; renderSlotGrid(); };
    const roll = document.createElement('button'); roll.className = 'mini'; roll.textContent = 'roll'; roll.title = 'New dials for this kind';
    roll.onclick = () => { if (part.kind === 'drawn') return; const b = T.briefs()[D.brief], o = b && b.slots && b.slots[slot] && b.slots[slot].find(x => x[0] === part.kind); part.dials = dialsWithin(lib[slot][part.kind], mulberry32((Math.random() * 1e9) | 0), o ? o[1] : {}); renderSlotGrid(); designChanged(false); };
    const draw = document.createElement('button'); draw.className = 'mini'; draw.textContent = 'draw'; draw.title = 'Paint this part by hand';
    draw.onclick = () => drawPart(D, slot);
    head.append(name, kind, roll, lock, draw); card.append(head);
    const dials = document.createElement('div'); dials.className = 'dials';
    if (part.kind === 'drawn') dials.innerHTML = '<p class="hint">Drawn by hand. Choose a kind above to go back to dials.</p>';
    else for (const [key, label, a, b, step] of lib[slot][part.kind]?.dials || []){
      const set = v => { part.dials[key] = v; designChanged(false); };
      if (a === 'check') field(dials, label, checkInput(!!part.dials[key], set));
      else if (a === 'select') field(dials, label, selectInput(b, part.dials[key], set));
      else field(dials, label, numInput(part.dials[key] ?? a, a, b, step || 1, set));
    }
    card.append(dials); grid.append(card);
  }
}
function renderStats(D, el){
  const f = document.createElement('div'); f.className = 'form'; el.append(f);
  if (D.type === 'witch'){
    if (!D.wand){ f.innerHTML = '<span class="muted">No hand item, so no wand.</span>'; return; }
    const w = D.wand, n = document.createElement('input'); n.value = w.name; n.oninput = () => { w.name = n.value; };
    field(f, 'Name', n);
    for (const [k, label, a, b, s] of [['rate', 'Fire rate ×', .3, 3, .1], ['speed', 'Shot speed ×', .3, 3, .1], ['dmg', 'Damage', 1, 5, 1], ['shots', 'Shots', 1, 7, 1], ['spread', 'Spread °', 0, 60, 1], ['bounce', 'Bounces', 0, 4, 1], ['pierce', 'Pierces', 0, 4, 1], ['life', 'Range (s)', .5, 4, .1]])
      field(f, label, numInput(w[k], a, b, s, v => { w[k] = v; }));
    field(f, 'Shot', selectInput(['orb', 'needle', 'star'], w.shot.shape, v => { w.shot.shape = v; }));
    f.insertAdjacentHTML('beforeend', '<p class="hint">Saved as the outfit\'s "wand"; the game reads it as it is.</p>');
    // how she holds it is set per kind of item, for every outfit, on the Grips page
    const h = D.parts.hand, key = h && h.kind !== 'drawn' ? 'kinds:' + h.kind : 'styles:' + (D.replace || D.name);
    f.append(buttons([['How she holds it…', () => openGrips(key)]]));
  } else {
    field(f, 'Behaviour', selectInput(Object.entries(BEHAVIOURS).map(([k, v]) => [k, k + ': ' + v]), D.behaviour, v => { D.behaviour = v; }));
    field(f, 'Hit points', numInput(D.hp, 1, 12, 1, v => { D.hp = v; }));
    const rooms = document.createElement('div'); rooms.className = 'glowpick';
    for (const r of GAME_ROOMS){ const l = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = D.rooms.includes(r); cb.onchange = () => { D.rooms = cb.checked ? [...new Set([...D.rooms, r])] : D.rooms.filter(x => x !== r); }; l.append(cb, ' ' + r); rooms.append(l); }
    field(f, 'Turns up in', rooms);
  }
}

/* ---------- drawing a part by hand ----------
   The part opens in the pixel editor over a faded copy of the rest; done, it becomes a drawn part. */
async function drawPart(D, slot){
  const T = CHAR[D.type], pics = await T.pictures(D), [w, h] = T.size, layer = pics.layers[slot] || {};
  // the part's pictures (a monster's limbs are flattened to one picture and split again after)
  const joints = D.type === 'witch' ? [null] : Object.keys(layer);
  const flat = side => { const px = new Int16Array(w * h).fill(-1); const src = D.type === 'witch' ? [layer[side]] : joints.map(j => layer[j][side]); for (const s of src) if (s) for (let i = 0; i < s.length; i++) if (s[i] >= 0) px[i] = s[i]; return px; };
  const { colors, pics: [f, b] } = localise([{ w, h, px: localToPal(flat('front'), pics.pal) }, { w, h, px: localToPal(flat('back'), pics.pal) }]);
  const roles = deriveRoles(D.scheme);
  for (const r of ['main', 'alt', 'trim', 'accent', 'hair', 'shade', 'light', 'ink', 'white']) if (!colors.some(c => hexOf(c) === roles[r].slice(1))) colors.push(unhex(roles[r]));
  const W = newWork({ kind: 'relief', w, h, front: f.px, back: b.px, colors, label: `${D.label || D.name}: ${slot}`, made: 'hand-drawn', theme: charTheme(D), build: { depth: 4, backMode: 'picture', backDepth: 4 } });
  // what's under it: everything but this part, faded
  const others = side => { const px = new Int16Array(w * h).fill(-1), cols = []; const all = pics[side]; const mine = flat(side); for (let i = 0; i < all.px.length; i++) if (all.px[i] >= 0 && mine[i] < 0) px[i] = all.px[i]; return { px, colors: all.colors }; };
  W._under = { front: others('front'), back: others('back') };
  W._done = W2 => {
    const drawn = { colors: W2.colors.map(c => c.slice()) };
    if (D.type === 'witch'){ drawn.front = W2.front.slice(); drawn.back = W2.back ? W2.back.slice() : null; }
    else drawn.layers = splitToJoints(D, slot, joints.length ? joints : [PLANS[D.plan].at[slot]].flat().filter(Boolean), W2);
    D.parts[slot] = { kind: 'drawn', dials: {}, lock: true, drawn };
    D.edited = true; M.what = D.type; CH().work = D; CH().stage = 'edit'; render();
  };
  M.propWork = M.work; M.drawingFor = D.type; M.what = 'prop';
  openInEditor(W);
}
const localToPal = (px, pal) => { const out = new Int16Array(px.length); for (let i = 0; i < px.length; i++){ const v = px[i]; out[i] = v >= 0 ? colourOf(...pal.colors[v]) : -1; } return out; };
// each painted pixel goes to the nearest of the part's joints (mirrored for the back)
function splitToJoints(D, slot, joints, W){
  const out = {};
  for (const side of ['front', 'back']){
    const src = side === 'front' ? W.front : W.back; if (!src) continue;
    for (const j of joints) (out[j] = out[j] || {})[side] = new Int16Array(W.w * W.h).fill(-1);
    for (let i = 0; i < src.length; i++){
      if (src[i] < 0) continue;
      const x = i % W.w, y = Math.floor(i / W.w), fx = side === 'back' ? W.w - 1 - x : x;
      let best = joints[0], bd = Infinity;
      for (const j of joints){ const [jx, jy] = jc(D.plan, j), d = (jx - fx - .5) ** 2 + ((jy - y) ** 2) * .3; if (d < bd){ bd = d; best = j; } }
      out[best][side][i] = src[i];
    }
  }
  return out;
}

/* ---------- finalise ---------- */
function renderCharFinalise(){
  const D = CH().work, T = CHAR[D.type];
  const isOld = D.type === 'witch' && D.replace && !S.files.has(`art/witch/sets/${D.replace}/top_front.png`) && W_SLOTS.some(s => S.files.has(`art/witch/${s}_${D.replace}_front.png`));
  if (!M.cfin || M.cfin.id !== D.id) M.cfin = { id: D.id, name: slug(isOld ? D.replace + '_2' : D.replace || D.name) || 'new_' + D.type, label: D.label || D.name || '', note: D.note || (T.briefs()[D.brief] || {}).note || '', sure: false };
  const f = M.cfin;
  const main = $('main'); main.innerHTML = ''; main.className = 'finalview';
  const cv = document.createElement('canvas'); cv.width = cv.height = 900; const stg = document.createElement('div'); stg.className = 'stage big'; stg.append(cv); main.append(stg);
  const st = new RigStage(cv); main.append(st.bar()); st.walk = .5; T.rig(D).then(r => st.set(r));
  const nav = $('nav'); nav.innerHTML = ''; navHead(nav, 'What happens');
  const list = document.createElement('div'); list.className = 'form'; list.id = 'finList'; nav.append(list);
  const el = $('insp'); el.innerHTML = '<div class="ihead">Finalise</div>';
  const sec = section(''), form = document.createElement('div'); form.className = 'form'; sec.append(form); el.append(sec);
  const upd = () => { f.sure = false; renderCharFinList(); };
  const n = document.createElement('input'); n.value = f.name; n.oninput = () => { f.name = slug(n.value); upd(); }; n.onchange = () => { n.value = f.name; };
  field(form, D.type === 'witch' ? 'Style name' : 'File name', n);
  if (isOld) form.insertAdjacentHTML('beforeend', `<p class="hint">${esc(D.replace)} is drawn in code by tools/draw_witch.py, so this saves as a new style beside it.</p>`);
  const lab = document.createElement('input'); lab.value = f.label; lab.oninput = () => { f.label = lab.value; upd(); };
  field(form, D.type === 'witch' ? 'Name in the outfit sliders' : 'Name', lab);
  const note = document.createElement('textarea'); note.rows = 3; note.value = f.note; note.oninput = () => { f.note = note.value; upd(); };
  field(form, 'Note', note);
  renderStats(D, form);
  const act = document.createElement('div'); act.id = 'finActions'; sec.append(act);
  el.append(section('', D.type === 'witch'
    ? '<p class="hint">The game finds outfit files by itself. Pieces are cut here exactly as tools/draw_witch.py cuts them, so running it later gives the same result.</p>'
    : '<p class="hint">The game finds monster files by itself (game/creature.gd) and adds each to the rooms it turns up in.</p>'));
  renderCharFinList();
}
async function renderCharFinList(){
  const D = CH().work, f = M.cfin, list = $('finList'), act = $('finActions'); if (!list) return;
  if (!f.name){ act.innerHTML = '<p class="warn">Give it a name.</p>'; list.innerHTML = ''; return; }
  const files = await CHAR[D.type].files(D, { ...f, label: f.label || f.name });
  const mine = D.replace === f.name || (D.type === 'monster' && D.savedAs === f.name);
  const clash = files.filter(([p]) => S.files.has(p));
  const counts = {}; for (const [, , what] of files) counts[what] = (counts[what] || 0) + 1;
  list.innerHTML = Object.entries(counts).map(([what, n]) => `<div class="fileline"><span class="badge used">${n}</span> ${what}${n > 1 ? 's' : ''}</div>`).join('')
    + `<details><summary>Every file</summary>${files.map(([p]) => `<div class="path">${S.files.has(p) ? '<span class="badge miss">replaces</span> ' : ''}${p}</div>`).join('')}</details>`
    + `<details><summary>${D.type === 'witch' ? 'Outfit' : 'Monster'} file</summary><pre>${esc(files[files.length - 1][1].replace(/"design": [\s\S]*$/, '"design": { … }\n}'))}</pre></details>`;
  act.innerHTML = '';
  if (clash.length && !mine && !f.sure){
    act.innerHTML = `<p class="warn">${f.name} already exists in the game (${clash.length} files).</p>`;
    act.append(buttons([['Replace it', () => { f.sure = true; renderCharFinList(); }]]));
    return;
  }
  act.append(buttons([[canWriteFolder() ? 'Save into the game' : 'Download the files', () => saveChar(D, f, files), 'hot big']]));
}
async function saveChar(D, f, files){
  if (!canWriteFolder()){ for (const [p, data] of files) download(p.replace(/\//g, '__'), data instanceof Blob ? data : new Blob([data], { type: 'application/json' })); toast('Downloaded; each name shows its folder'); return; }
  try {
    if (!(await askWrite())){ toast('Saving needs permission to change the folder'); return; }
    status('Saving ' + files.length + ' files…');
    for (const [p, data] of files) await writeFile(p, data);
    // pictures from an earlier save that this one no longer has (a slot emptied, a limb gone) would
    // still be read by the game, so they go
    const keep = new Set(files.map(([p]) => p)), mine = D.type === 'witch'
      ? p => p.startsWith(`art/witch/sets/${f.name}/`) || W_SLOTS.some(s => new RegExp(`^art/witch/pieces/[a-z]+__${s}_${f.name}_(front|back)\\.png$`).test(p))
      : p => p.startsWith(`art/monsters/${f.name}/`);
    for (const p of [...S.files.keys()]) if (p.endsWith('.png') && mine(p) && !keep.has(p)) await removeFile(p);
    await scan();
    if (D.type === 'witch'){ D.replace = f.name; } else D.savedAs = f.name;
    if (charPicked(D)) toggleCharPick(D);
    S.mode = 'browse'; S.view = D.type === 'witch' ? 'styles' : 'monsters'; S.theme = 'all'; S.query = ''; $('search').value = '';
    S.sel = (D.type === 'witch' ? S.styles.find(s => s.key === f.name) : S.monsters.find(m => m.key === f.name)) || null;
    render(); status('Saved ' + f.name); toast(`Saved into the game: ${f.name}`);
  } catch (e) { console.error(e); toast('Could not save: ' + e.message); status('Save failed'); }
}
