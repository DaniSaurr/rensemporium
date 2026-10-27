/* Ren's Workbench: the Grips page. How her hand holds each kind of item: where it sits from the
   hand joint, how the hand turns it at rest and when she casts, and whether it stays level as her arm
   swings. Saved as art/witch/grips.json; the same table goes to and from Blender (tools/grips_blend.py). */

const G = { key: null, stage: null, rig: null, timer: 0, base: {}, legacy: {}, updateOutfits: true };
const GRIP_HAND_Y = 34.5, GRIP_HAND_X = 20;   // the hand joint, in the item picture's pixels

function gripEntries(){
  const kinds = Object.keys(WITCH_PARTS.hand).filter(k => k !== 'none').map(k => ({ key: 'kinds:' + k, section: 'kinds', name: k, label: WITCH_PARTS.hand[k].label }));
  const styles = S.styles.filter(st => st.slots.hand).map(st => ({ key: 'styles:' + st.key, section: 'styles', name: st.key, label: st.name }));
  return { kinds, styles };
}
function openGrips(key){ S.mode = 'grips'; if (key) G.key = key; render(); }
const gripEntry = key => { const [section, name] = key.split(':'); return { section, name }; };
function currentGrip(key){
  const { section, name } = gripEntry(key);
  // an outfit of the game's with no grip yet starts from the way it is held today
  return section === 'kinds' ? gripOfKind(name) : (gripOfStyle(name) || copyGrip(G.legacy[key]) || { grip: [0, 0, 0], rest: [0, 0, 0], aim: [180, 0, 0], plumb: false });
}
function setGrip(key, g){ const { section, name } = gripEntry(key); S.grips[section][name] = copyGrip(g); G.dirty = true; renderGripNav(); }
// the witch who holds things here: a plain one for the items made here, the outfit itself for the game's own
async function gripWitch(key){
  if (G.base[key]) return G.base[key];
  const { section, name } = gripEntry(key);
  let D;
  if (section === 'kinds'){
    D = genWitch(7, 'embalmer'); D.parts.back = { kind: 'none', dials: {}, lock: false };
    D.parts.hand = { kind: name, dials: dialDefaults(WITCH_PARTS.hand[name]), lock: false }; D.wand = null; D.wand = wandFor(D);
  } else {
    const st = S.styles.find(s => s.key === name); D = await witchFromStyle(st); D.replace = name;
  }
  return (G.base[key] = D);
}

function renderGrips(){
  $('stepper').hidden = true; $('search').hidden = true;
  if (!S.files.size){
    $('main').className = 'grid'; $('main').innerHTML = EMPTY_HTML; $('nav').innerHTML = ''; $('insp').innerHTML = '<div class="ihead">Grips</div><div class="isec muted">Open the game folder first: grips are saved into it.</div>';
    return;
  }
  if (!G.key) G.key = gripEntries().kinds[0].key;
  renderGripNav();

  const main = $('main'); main.innerHTML = ''; main.className = 'gripview';
  const left = document.createElement('div'); left.className = 'gripstage';
  const cv = document.createElement('canvas'); cv.width = cv.height = 720; const box = document.createElement('div'); box.className = 'stage'; box.append(cv); left.append(box);
  G.stage = new RigStage(cv); G.stage.yaw = -Math.PI / 2 + .35; G.stage.pitch = -.15; left.append(G.stage.bar());
  // with Aim on, clicking the picture sets where she grips it while aiming
  G.stage.onaim = () => drawGripPic();
  const pic = document.createElement('div'); pic.className = 'grippic';
  pic.innerHTML = '<canvas id="gripPic"></canvas><p class="hint" id="gripPicHint"></p>';
  main.append(left, pic);
  renderGripPanel();
  rebuildGrip();
  $('counts').textContent = '';
}
function renderGripNav(){
  const { kinds, styles } = gripEntries(), nav = $('nav'), top = nav.scrollTop; nav.innerHTML = '';
  const row = e => { const edited = e.section === 'kinds' ? !!S.grips.kinds[e.name] : !!S.grips.styles[e.name];
    navItem(nav, e.label, edited ? '●' : '', G.key === e.key, () => { G.key = e.key; renderGrips(); }).title = edited ? 'set here or in grips.json' : 'the default'; };
  navHead(nav, 'Items made here'); kinds.forEach(row);
  navHead(nav, 'The game\'s outfits'); styles.forEach(row);
  nav.insertAdjacentHTML('beforeend', '<p class="hint pad">● set here or in grips.json. An outfit of the game\'s with no grip keeps its old way of holding things.</p>');
  nav.scrollTop = top;
}
function rebuildGrip(){
  clearTimeout(G.timer);
  G.timer = setTimeout(async () => {
    const D = await gripWitch(G.key);
    G.rig = await witchRig(D); if (G.stage) G.stage.set(G.rig);
    if (!G.legacy[G.key] && gripEntry(G.key).section === 'styles' && !gripOfStyle(gripEntry(G.key).name)){ G.legacy[G.key] = G.rig.legacy; renderGripPanel(); }
    drawGripPic();
  }, 40);
}
// the item's front picture, big, with the hand joint marked where it lands
function drawGripPic(){
  const cv = $('gripPic'); if (!cv || !G.rig) return;
  const { layers, pal } = G.rig.pics, px = layers.hand && layers.hand.front; if (!px) return;
  const k = 9; cv.width = WW * k; cv.height = WH * k;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++){ g.fillStyle = (x + y) % 2 ? '#2b2b2b' : '#323232'; g.fillRect(x * k, y * k, k, k); }
  // her arm, faded, for where the hand is
  const body = G.rig.pics.front; for (let i = 0; i < body.px.length; i++){ const v = body.px[i]; if (v >= 0 && px[i] < 0){ g.fillStyle = hex(mix(body.colors[v], [38, 38, 38], .75)); g.fillRect((i % WW) * k, Math.floor(i / WW) * k, k, k); } }
  g.drawImage(picCanvas(WW, WH, px, pal.colors), 0, 0, cv.width, cv.height);
  const aiming = !!(G.stage && G.stage.aim), which = aiming ? 'aim_grip' : 'grip';
  const hint = $('gripPicHint'); if (hint) hint.textContent = aiming ? 'Aiming: click where her hand holds it while she aims.' : 'Click the item where her hand should hold it. Turn Aim on to set where she holds it while aiming.';
  const gr = currentGrip(G.key), mx = (GRIP_HAND_X - gr[which][0] + .5) * k, my = (GRIP_HAND_Y + gr[which][1]) * k + k / 2;
  g.strokeStyle = aiming ? '#5ee8f0' : '#ff4fb0'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, k * .9, 0, Math.PI * 2); g.moveTo(mx - k * 1.6, my); g.lineTo(mx + k * 1.6, my); g.moveTo(mx, my - k * 1.6); g.lineTo(mx, my + k * 1.6); g.stroke();
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * WW), y = Math.floor((e.clientY - r.top) / r.height * WH);
    const g2 = currentGrip(G.key); g2[which][0] = GRIP_HAND_X - x; g2[which][1] = y - GRIP_HAND_Y; setGrip(G.key, g2); renderGripPanel(); rebuildGrip();
  };
}
function renderGripPanel(){
  const el = $('insp'), e = [...gripEntries().kinds, ...gripEntries().styles].find(x => x.key === G.key);
  el.innerHTML = `<div class="ihead">${esc(e ? e.label : G.key)}</div>`;
  const gr = currentGrip(G.key), change = fn => v => { const g = currentGrip(G.key); fn(g, v); setGrip(G.key, g); rebuildGrip(); };
  const sec = (title, hint) => { const s = section(title, hint ? `<p class="hint">${hint}</p>` : ''), f = document.createElement('div'); f.className = 'form'; s.append(f); el.append(s); return f; };
  const f1 = sec('Grip at rest', 'Where the item sits from her hand, in voxels: x out to her side, y up, z forward.');
  ['x', 'y', 'z'].forEach((a, i) => field(f1, a, numInput(gr.grip[i], -16, 16, .5, change((g, v) => { g.grip[i] = v; drawGripPic(); }))));
  const f2 = sec('At rest', 'How her hand turns it the rest of the time, in degrees. x tips it forward (70 holds a wand out in front), y turns it about her arm, z leans it out or in.');
  ['x', 'y', 'z'].forEach((a, i) => field(f2, a, numInput(gr.rest[i], -180, 180, 1, change((g, v) => { g.rest[i] = v; }))));
  field(f2, 'Stays level as her arm swings', checkInput(gr.plumb, change((g, v) => { g.plumb = v; })));
  const fa = sec('Arms at rest', 'How her arms hang while she holds this, in degrees at the shoulder: x swings the arm forward (minus) or back, y twists it, z lifts it out to her side (the wand arm) or in. Her wand arm still rises the same way to aim.');
  ['x', 'y', 'z'].forEach((a, i) => field(fa, 'wand arm ' + a, numInput(gr.arm[i], -180, 180, 1, change((g, v) => { g.arm[i] = v; }))));
  ['x', 'y', 'z'].forEach((a, i) => field(fa, 'other arm ' + a, numInput(gr.arml[i], -180, 180, 1, change((g, v) => { g.arml[i] = v; }))));
  const f3 = sec('Aiming', 'Where it sits and how her hand turns it when she casts. Her arm rises 83 degrees, so x 83 keeps a thing upright, 180 points it at the target, 108 angles a staff up. Press Aim under the view to see it, and click the picture to set the aim grip.');
  ['x', 'y', 'z'].forEach((a, i) => field(f3, 'grip ' + a, numInput(gr.aim_grip[i], -16, 16, .5, change((g, v) => { g.aim_grip[i] = v; drawGripPic(); }))));
  ['x', 'y', 'z'].forEach((a, i) => field(f3, 'turn ' + a, numInput(gr.aim[i], -180, 180, 1, change((g, v) => { g.aim[i] = v; }))));
  el.append(section('', '').appendChild(buttons([
    ['Back to the default', () => { const { section: s2, name } = gripEntry(G.key); delete S.grips[s2][name]; G.dirty = true; renderGrips(); }],
    ['Copy rest to aim', () => { const g = currentGrip(G.key); g.aim = g.rest.slice(); g.aim_grip = g.grip.slice(); setGrip(G.key, g); renderGripPanel(); rebuildGrip(); }],
  ])).parentNode);
  const save = sec('Save');
  field(save, 'Also update outfits saved from here that hold these items', checkInput(G.updateOutfits, v => { G.updateOutfits = v; }));
  save.append(buttons([[canWriteFolder() ? 'Save grips.json' : 'Download grips.json', saveGrips, G.dirty ? 'hot' : '']]));
  const bl = sec('Blender', 'Pose them with Blender\'s gizmos instead. <b>Export for Blender</b> writes the witch and every item into art/witch/grips_blender/. Then double-click <span class="path">tools/grips.bat</span> in the game folder to make grips.blend there, and open it (<span class="path">tools/grips.bat open</span>). Rotate an item\'s |rest or |aim empty, move the item in the rest row to change the grip, and press <b>Write grips.json</b> in the Grips tab of the sidebar (N), or run <span class="path">tools/grips.bat write</span>. Then <b>Read grips.json again</b> here.');
  bl.append(buttons([['Export for Blender', exportGripsForBlender], ['Read grips.json again', async () => { forget('art/witch/grips.json'); S.grips = parseJSON(await readText('art/witch/grips.json')) || {}; S.grips.kinds = S.grips.kinds || {}; S.grips.styles = S.grips.styles || {}; G.dirty = false; renderGrips(); toast('Read grips.json'); }]]));
}
async function saveGrips(){
  const json = JSON.stringify({ note: 'How her hand holds each item: grip (voxels from the hand joint), rest and aim (degrees, x y z). Made in Ren\'s Workbench or Blender.', kinds: S.grips.kinds, styles: S.grips.styles }, null, 1) + '\n';
  if (!canWriteFolder()){ download('grips.json', new Blob([json], { type: 'application/json' })); return; }
  if (!(await askWrite())){ toast('Saving needs permission to change the folder'); return; }
  await writeFile('art/witch/grips.json', json);
  let n = 0;
  if (G.updateOutfits) for (const st of S.styles){
    // outfits saved from here carry their grip; bring them up to the table
    const d = st.set.design; if (!d || !st.set.wand || !d.parts || !d.parts.hand) continue;
    const kind = d.parts.hand.kind, g = kind === 'drawn' ? gripOfStyle(st.key) : gripOfKind(kind);
    if (!g || JSON.stringify(g) === JSON.stringify(st.set.wand.grip)) continue;
    const set = { ...st.set, wand: { ...st.set.wand, grip: g } };
    await writeFile(st.path, JSON.stringify(set, null, 1) + '\n'); n++;
  }
  await scan(); G.dirty = false; renderGrips();
  toast('Saved grips.json' + (n ? `, and ${n} outfit${n > 1 ? 's' : ''}` : ''));
}

/* ---------- to Blender: the witch at rest, her wand arm, and every item, as coloured meshes ---------- */
// visible faces of a set of voxels as an ASCII PLY, in voxels, less a shift (a joint)
function plyOf(cellsList, shift = [0, 0, 0]){
  const V = cellsToV(cellsList); let x0 = Infinity, y0 = Infinity, z0 = Infinity;
  for (const [x, y, z] of cellsList){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); }
  const verts = [], faces = [];
  for (const [x, y, z, fi, v] of visibleFaces(V)){
    const col = COLORS[v], base = verts.length;
    for (const q of FACES[fi].q) verts.push(`${x + q[0] + x0 - shift[0]} ${y + q[1] + y0 - shift[1]} ${z + q[2] + z0 - shift[2]} ${col[0]} ${col[1]} ${col[2]}`);
    faces.push(`4 ${base} ${base + 1} ${base + 2} ${base + 3}`);
  }
  return `ply\nformat ascii 1.0\nelement vertex ${verts.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${faces.length}\nproperty list uchar int vertex_indices\nend_header\n${verts.join('\n')}\n${faces.join('\n')}\n`;
}
async function exportGripsForBlender(){
  if (!canWriteFolder()){ toast('Exporting for Blender needs Chrome or Edge, to write into the game folder'); return; }
  if (!(await askWrite())){ toast('Exporting needs permission to change the folder'); return; }
  status('Exporting for Blender…');
  const dir = 'art/witch/grips_blender', files = [], { kinds, styles } = gripEntries();
  // the folder is left out of Godot's import, so the .blend and meshes don't become game assets
  files.push([dir + '/.gdignore', '']);
  const base = await witchRig(await gripWitch(kinds[0].key)), cells = base.cells, J = base.joints;
  const body = []; for (const [p, m] of Object.entries(cells)) if (p !== 'hand' && p !== 'armr') body.push(...m.values());
  files.push([dir + '/body.ply', plyOf(body)]);
  files.push([dir + '/armr.ply', plyOf([...cells.armr.values()], J.armr[1])]);
  const entries = [];
  for (const e of [...kinds, ...styles]){
    const r = await witchRig(await gripWitch(e.key)), item = [...r.cells.hand.values()];
    if (e.section === 'styles' && !G.legacy[e.key]) G.legacy[e.key] = r.legacy;
    if (!item.length) continue;
    const file = `items/${e.section}_${e.name}.ply`;
    files.push([dir + '/' + file, plyOf(item, J.hand[1])]);
    entries.push({ key: e.key, section: e.section, name: e.name, label: e.label, file, grip: currentGrip(e.key) });
  }
  files.push([dir + '/manifest.json', JSON.stringify({ note: 'Written by Ren\'s Workbench for tools/grips_blend.py', voxel: 1 / 32,
    joints: { armr: J.armr[1], hand: J.hand[1] }, arm_rest: [0, 0, .12], arm_aim: [-1.45, 0, 0], entries }, null, 1) + '\n']);
  for (const [p, data] of files) await writeFile(p, data);
  status(`Exported ${entries.length} items for Blender`); toast('Exported for Blender: now run tools/grips_blend.py -- build');
}
