/* Ren's Workbench: monsters. A body plan is a skeleton with a behaviour; parts with dials draw
   onto its joints; briefs give a creature a purpose and a place. The game builds the pieces
   the same way (game/creature.gd) and plays the same motion. */

const MW = 32, MH = 48, MCX = 15.5;
const M_DEPTH = { body: 6, head: 5, eyes: 6, mouth: 6, crest: 4, arms: 3, legs: 3, tail: 3, wings: 2 };
const M_SLOTS = ['wings', 'tail', 'legs', 'body', 'arms', 'head', 'crest', 'eyes', 'mouth'];   // back to front

/* ---------- body plans ---------- */
const PLANS = {
  floater: { label: 'Floater', behaviour: 'float', note: 'drifts and turns; fires rings',
    joints: { body: ['', [0, 22, 0]], tail: ['body', [0, 13, 0]], arml: ['body', [-11, 20, 0]], armr: ['body', [11, 20, 0]] },
    face: 'body', at: { body: 'body', head: null, eyes: 'body', mouth: 'body', crest: 'body', arms: ['arml', 'armr'], legs: null, tail: 'tail', wings: 'body' } },
  blob: { label: 'Blob', behaviour: 'hop', note: 'a round body that hops and squashes',
    joints: { body: ['', [0, 0, 0]], crest: ['body', [0, 15, 0]], legl: ['body', [-4, 2, 0]], legr: ['body', [4, 2, 0]], tail: ['body', [0, 4, 0]] },
    face: 'body', at: { body: 'body', head: null, eyes: 'body', mouth: 'body', crest: 'crest', arms: null, legs: ['legl', 'legr'], tail: 'tail', wings: 'body' } },
  biped: { label: 'Biped', behaviour: 'walk', note: 'stands and walks on two legs',
    joints: { hips: ['', [0, 14, 0]], torso: ['hips', [0, 15, 0]], head: ['torso', [0, 28, 0]], arml: ['torso', [-7, 26, 0]], armr: ['torso', [7, 26, 0]],
      legl: ['hips', [-3, 14, 0]], legr: ['hips', [3, 14, 0]], tail: ['hips', [0, 13, 0]], wings: ['torso', [0, 26, 0]] },
    face: 'head', at: { body: 'torso', head: 'head', eyes: 'head', mouth: 'head', crest: 'head', arms: ['arml', 'armr'], legs: ['legl', 'legr'], tail: 'tail', wings: 'wings' } },
  gangly: { label: 'Gangly', behaviour: 'walk', note: 'long legs, long arms, a small high body',
    joints: { hips: ['', [0, 23, 0]], torso: ['hips', [0, 24, 0]], head: ['torso', [0, 35, 0]], arml: ['torso', [-6, 33, 0]], armr: ['torso', [6, 33, 0]],
      legl: ['hips', [-3, 23, 0]], legr: ['hips', [3, 23, 0]], tail: ['hips', [0, 22, 0]], wings: ['torso', [0, 33, 0]] },
    face: 'head', at: { body: 'torso', head: 'head', eyes: 'head', mouth: 'head', crest: 'head', arms: ['arml', 'armr'], legs: ['legl', 'legr'], tail: 'tail', wings: 'wings' } },
  crawler: { label: 'Crawler', behaviour: 'walk', note: 'low and wide on many legs',
    joints: { body: ['', [0, 9, 0]], head: ['body', [0, 12, 0]], legl1: ['body', [-6, 9, 0]], legl2: ['body', [-7, 7, 0]], legl3: ['body', [-6, 5, 0]],
      legr1: ['body', [6, 9, 0]], legr2: ['body', [7, 7, 0]], legr3: ['body', [6, 5, 0]], tail: ['body', [0, 8, 0]] },
    face: 'head', at: { body: 'body', head: 'head', eyes: 'head', mouth: 'head', crest: 'head', arms: null, legs: ['legl1', 'legl2', 'legl3', 'legr1', 'legr2', 'legr3'], tail: 'tail', wings: 'body' } },
  column: { label: 'Column', behaviour: 'walk', note: 'a stack that sways: a candle, a worm, a totem',
    joints: { seg1: ['', [0, 0, 0]], seg2: ['seg1', [0, 9, 0]], seg3: ['seg2', [0, 18, 0]], head: ['seg3', [0, 27, 0]], arml: ['seg3', [-6, 22, 0]], armr: ['seg3', [6, 22, 0]] },
    face: 'head', at: { body: 'seg', head: 'head', eyes: 'head', mouth: 'head', crest: 'head', arms: ['arml', 'armr'], legs: null, tail: null, wings: 'seg3' } },
};
// the bodies that suit each plan (a torso needs hips and shoulders; a gumdrop sits on the floor)
const BODY_FOR = { floater: ['mask', 'orb', 'pear', 'bell'], blob: ['jelly', 'orb', 'pear'], biped: ['trunk', 'pear', 'orb'], gangly: ['trunk', 'orb', 'pear'], crawler: ['orb', 'pear'], column: ['candle', 'pear', 'orb'] };
const mirrorJoint = j => /^(arm|leg)[lr]/.test(j) ? j.replace(/^(arm|leg)([lr])/, (m, a, s) => a + (s === 'l' ? 'r' : 'l')) : j;
const jc = (plan, j) => { const p = PLANS[plan].joints[j][1]; return [MCX + p[0] + .5, MH - p[1]]; };   // a joint in canvas pixels

/* ---------- parts ----------
   draw(x, d, c): x.on(joint) is the pen for that joint (this side); x.face is the face box the
   body or head left for the eyes and mouth; x.plan the body plan. */
const MONSTER_PARTS = {
  body: {
    orb: { label: 'orb', dials: [['w', 'Width', 6, 14, .5, 10], ['h', 'Height', 6, 16, .5, 10], ['belly', 'Belly patch', 'check', false]],
      draw(x, d, c){ const [cx, cy] = bodyCentre(x, d); x.setFace(cx, cy - d.h * .2, d.w * .65, d.h * .45, cy - d.h); const p = x.on(x.bodyJoint(cy)); p.ellipse(cx, cy, d.w, d.h, x.calm('main', 'alt'));
        if (d.belly && x.front) p.ellipse(cx, cy + d.h * .45, d.w * .5, d.h * .35, c.trim); } },
    pear: { label: 'pear', dials: [['w', 'Width', 5, 13, .5, 9], ['h', 'Height', 8, 18, 1, 13], ['taper', 'Taper', .3, .8, .05, .55]],
      draw(x, d, c){ const [cx, cy] = bodyCentre(x, d); const top = cy - d.h, bot = cy + d.h;
        for (let y = Math.floor(top); y <= bot; y++){ const t = (y - top) / (bot - top), hw = d.w * (d.taper + (1 - d.taper) * Math.sin(Math.min(1, t * 1.15) * Math.PI / 2)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t - .85) / .15, 2))); x.on(x.bodyJoint(y)).rowC(y, hw, x.fill('main', 'alt'), cx); }
        x.setFace(cx, top + d.h * .55, d.w * d.taper * 1.2, d.h * .4, top); } },
    mask: { label: 'mask face', dials: [['w', 'Width', 7, 13, .5, 10], ['h', 'Height', 8, 15, .5, 12], ['brow', 'Brow points', 0, 3, 1, 2], ['chin', 'Pointed chin', 'check', true], ['split', 'Split colour', 'check', true]],
      draw(x, d, c){ const [cx, cy] = bodyCentre(x, d), p = x.on(x.bodyJoint(cy)), top = cy - d.h, bot = cy + d.h;
        x.setFace(cx, cy - d.h * .15, d.w * .6, d.h * .45, top);
        // a domed brow, full cheeks, then the chin narrowing (to a point if asked)
        for (let y = Math.floor(top); y <= bot; y++){ const t = (y - top) / (bot - top); let hw = t < .35 ? d.w * Math.sqrt(Math.max(0, 1 - Math.pow((.35 - t) / .38, 2))) : d.w * (1 - Math.pow((t - .35) / .65, 2) * (d.chin ? .85 : .45));
          p.rowC(y, Math.max(.5, hw), d.split ? (xx => (xx < cx) !== !x.front ? c.main : c.trim) : x.calm('trim', 'alt'), cx); }
        for (let k = 0; k < d.brow; k++){ const bx = cx + (k - (d.brow - 1) / 2) * 5; for (let j = 1; j <= 3; j++) p.put(bx, top - j + 1, c.accent); } } },
    bell: { label: 'shroud', dials: [['w', 'Width', 6, 13, .5, 9], ['h', 'Height', 10, 20, 1, 15], ['hem', 'Hem', 'select', ['tatters', 'zigzag', 'scallop', 'plain']]],
      draw(x, d, c){ const [cx, cy] = bodyCentre(x, d), top = cy - d.h, bot = cy + d.h * .8;
        for (let y = Math.floor(top); y <= bot; y++){ const t = (y - top) / (bot - top), hw = d.w * Math.min(1, Math.sin(Math.min(1, t * 2.2) * Math.PI / 2) * (1 + t * .35)); x.on(x.bodyJoint(y)).rowC(y, hw, x.fill('main', 'alt'), cx); }
        const hw = d.w * 1.35, p = x.on(x.bodyJoint(bot));
        for (let xx = Math.ceil(cx - hw); xx <= cx + hw; xx++){ const k = d.hem === 'tatters' ? hash32(xx * 31) % 4 : d.hem === 'zigzag' ? xx % 2 : d.hem === 'scallop' ? (xx % 3 ? 1 : 0) : 0; for (let j = 1; j <= k; j++) p.put(xx, bot + j, c.main); }
        x.setFace(cx, top + d.h * .55, d.w * .7, d.h * .4, top); } },
    jelly: { label: 'gumdrop', dials: [['w', 'Width', 7, 14, .5, 11], ['h', 'Height', 8, 18, .5, 13], ['shine', 'Shine', 'check', true], ['drips', 'Drips', 0, 4, 1, 2]],
      draw(x, d, c){ const p = x.on(x.bodyJoint(MH - 1)), bot = MH - 1, top = bot - d.h * 2 + 1, cx = MCX + .5;
        x.setFace(cx, top + d.h * .9, d.w * .6, d.h * .45, top);
        for (let y = Math.floor(top); y <= bot; y++){ const t = (y - top) / (bot - top), hw = d.w * Math.sqrt(Math.min(1, t * 1.6)) * (1 + Math.max(0, t - .8) * .4); p.rowC(y, hw, x.calm('main', 'alt'), cx); }
        if (d.shine && x.front) for (let k = 0; k < 3; k++) p.put(cx - d.w * .45 + k * .5, top + 3 + k, c.light);
        for (let i = 0; i < d.drips; i++){ const dx = cx - d.w * .6 + i * d.w * 1.2 / Math.max(1, d.drips - 1); for (let j = 0; j < 2; j++) p.put(dx, bot - j, c.shade); } } },
    candle: { label: 'candle', dials: [['w', 'Width', 3, 7, .5, 4.5], ['h', 'Height', 14, 34, 1, 24], ['drips', 'Drips', 0, 6, 1, 3], ['dish', 'Dish', 'check', true]],
      draw(x, d, c){ const cx = MCX + .5, bot = MH - 1, top = bot - d.h;
        for (let y = top; y <= bot; y++) x.on(x.bodyJoint(y)).rowC(y, d.w, (xx, yy) => yy < top + 2 ? c.trim : c.main, cx);
        for (let i = 0; i < d.drips; i++){ const dx = Math.round(cx - d.w + (i * 7919 % 9) / 8 * d.w * 2), len = 2 + (i * 31 % 5); for (let j = 0; j < len; j++) x.on(x.bodyJoint(top + j)).put(dx, top + j, c.trim); }
        if (d.dish) x.on(x.bodyJoint(bot)).rowC(bot, d.w + 2.5, c.metal, cx);
        x.setFace(cx, top + 5, d.w * .8, 3.5, top); x.top = top; } },
    trunk: { label: 'torso', dials: [['w', 'Width', 2.5, 6, .5, 4], ['chest', 'Chest', 0, 3, .5, 1], ['belly', 'Belly', 0, 3, .5, 1]],
      draw(x, d, c){ const hip = jc(x.plan, 'hips')[1] + 1, top = jc(x.plan, 'arml')[1] - 2, p = x.on('torso'), room = Math.abs(PLANS[x.plan].joints.arml[1][0]) - 1.5;
        // never wider than the shoulders, so the arms stay outside it
        for (let y = top; y <= hip; y++){ const t = (y - top) / (hip - top); p.rowC(y, Math.min(room, d.w + d.chest * Math.sin(Math.min(1, t * 2) * Math.PI) * .6 + d.belly * Math.sin(Math.max(0, t - .3) / .7 * Math.PI) - (t < .1 ? 1 : 0)), x.fill('main', 'alt'), MCX + .5); }
        if (x.front && MOTIFS[x.motif] && x.motif === 'plain') for (let y = top + 3; y < hip; y++) p.rowC(y, d.w * .45, c.trim, MCX + .5); } },
  },
  head: {
    none: { label: 'none', dials: [], draw(){} },
    round: { label: 'round', dials: [['r', 'Size', 3.5, 8, .5, 5.5], ['squash', 'Squash', .7, 1.3, .05, 1], ['colour', 'Face', 'select', ['trim', 'main', 'alt', 'motif']], ['cheeks', 'Cheeks', 'check', false]],
      draw(x, d, c){ const [cx, cy] = jc(x.plan, 'head'), hy = cy - d.r * d.squash, p = x.on('head'); x.setFace(cx, hy, d.r * .7, d.r * d.squash * .6, hy - d.r * d.squash);
        p.ellipse(cx, hy, d.r, d.r * d.squash, d.colour === 'motif' ? x.calm('main', 'alt') : c[d.colour || 'trim']);
        if (d.cheeks && x.front){ p.put(cx - d.r * .6, hy + d.r * .3, c.accent); p.put(cx + d.r * .6, hy + d.r * .3, c.accent); } } },
    skull: { label: 'skull', dials: [['r', 'Size', 4, 7, .5, 5.5], ['jaw', 'Jaw', 2, 4, 1, 3]],
      draw(x, d, c){ const [cx, cy] = jc(x.plan, 'head'), hy = cy - d.r - 1, p = x.on('head'); p.ellipse(cx, hy, d.r, d.r * .9, c.trim); x.setFace(cx, hy - .5, d.r * .8, d.r * .5, hy - d.r * .9); for (let y = hy + d.r * .6; y < hy + d.r * .6 + d.jaw; y++) p.rowC(y, d.r * .55, c.trim, cx);
        if (x.front) for (let xx = Math.ceil(cx - d.r * .5); xx <= cx + d.r * .5; xx += 2) p.put(xx, hy + d.r * .6 + 1, c.ink); x.hollow = true; } },
    mask: { label: 'mask', dials: [['r', 'Size', 4, 8, .5, 6], ['points', 'Brow points', 0, 3, 1, 2]],
      draw(x, d, c){ const [cx, cy] = jc(x.plan, 'head'), hy = cy - d.r, p = x.on('head');
        for (let y = Math.floor(hy - d.r); y <= hy + d.r; y++){ const t = (y - hy + d.r) / (2 * d.r), hw = d.r * Math.sin(Math.min(1, (t + .1) * 1.5) * Math.PI / 2) * (t > .65 ? 1 - (t - .65) * 2 : 1); p.rowC(y, hw, xx => (xx < cx) !== !x.front ? c.trim : c.main, cx); }
        for (let k = 0; k < d.points; k++) p.put(cx + (k - (d.points - 1) / 2) * 4, hy - d.r - 1, c.accent); x.setFace(cx, hy - d.r * .1, d.r * .75, d.r * .55, hy - d.r); } },
    eyeball: { label: 'one big eye', dials: [['r', 'Size', 4, 8, .5, 6], ['veins', 'Veins', 'check', true]],
      draw(x, d, c){ const [cx, cy] = jc(x.plan, 'head'), hy = cy - d.r, p = x.on('head'); p.disc(cx, hy, d.r, c.white);
        if (x.front){ p.disc(cx, hy, d.r * .55, c.accent); p.disc(cx, hy, d.r * .25, c.ink); p.put(cx - d.r * .3, hy - d.r * .3, c.white);
          if (d.veins) for (const a of [0.4, 2.2, 3.9, 5.3]) for (let k = .65; k < .95; k += .12) p.put(cx + Math.cos(a) * d.r * k, hy + Math.sin(a) * d.r * k, c.alt); }
        else p.disc(cx, hy, d.r * .6, c.alt_d); x.setFace(cx, hy, d.r * .6, d.r * .6, hy - d.r); x.noFace = true; } },
    beak: { label: 'beaked', dials: [['r', 'Size', 3.5, 7, .5, 5], ['beak', 'Beak', 2, 6, 1, 3]],
      draw(x, d, c){ const [cx, cy] = jc(x.plan, 'head'), hy = cy - d.r, p = x.on('head'); p.disc(cx, hy, d.r, c.main);
        if (x.front) for (let k = 0; k < d.beak; k++) p.rowC(hy + d.r * .3 + k, Math.max(.5, 1.6 - k * .4), c.metal, cx); x.setFace(cx, hy - d.r * .25, d.r * .8, d.r * .4, hy - d.r); x.noMouth = true; } },
  },
  eyes: {
    none: { label: 'none', dials: [], draw(){} },
    pair: { label: 'two eyes', dials: [['size', 'Size', 1, 3, .5, 1.5], ['spread', 'Spread', .3, .9, .05, .55], ['lids', 'Heavy lids', 'check', false], ['glossy', 'Glossy', 'check', true]],
      draw(x, d, c){ if (!x.front || x.noFace) return; const f = x.face, p = x.onFace(); for (const s of [-1, 1]) eye(p, f.cx + s * f.rx * d.spread, f.cy, d.size, c, d.lids, d.glossy, x.hollow); } },
    one: { label: 'one eye', dials: [['size', 'Size', 1.5, 5, .5, 3], ['lids', 'Lid', 'check', false]],
      draw(x, d, c){ if (!x.front || x.noFace) return; const f = x.face; eye(x.onFace(), f.cx, f.cy, d.size, c, d.lids, true, x.hollow); } },
    many: { label: 'many eyes', dials: [['count', 'How many', 3, 9, 1, 5], ['size', 'Size', .8, 2, .2, 1.2], ['scatter', 'Scatter', 'check', true]],
      draw(x, d, c){ if (!x.front || x.noFace) return; const f = x.face, p = x.onFace(), rng = mulberry32(d.count * 977 + Math.round(d.size * 10));
        // spaced apart, a bigger one in the middle when they're scattered
        const spots = [], gap = d.size * 2 + 1.2;
        if (!d.scatter){
          // a ring, shrunk to fit, with one more in the middle when the count is odd
          const n = d.count - (d.count % 2), R = .72, chord = 2 * Math.min(f.rx, f.ry) * R * Math.sin(Math.PI / Math.max(2, n)), s = Math.min(1, chord / gap);
          for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2 - Math.PI / 2; spots.push([f.cx + Math.cos(a) * f.rx * R, f.cy + Math.sin(a) * f.ry * R, s]); }
          if (d.count % 2) spots.push([f.cx, f.cy, Math.min(1.5, s * 1.5)]);
        }
        for (let tries = 0; d.scatter && spots.length < d.count && tries < 400; tries++){
          const first = spots.length === 0 && d.scatter, a = d.scatter ? rng() * Math.PI * 2 : (spots.length / d.count) * Math.PI * 2, r = d.scatter ? Math.sqrt(rng()) * 1.15 : .75, s = first ? 1.6 : 1;
          const ex = first ? f.cx : f.cx + Math.cos(a) * f.rx * r, ey = first ? f.cy : f.cy + Math.sin(a) * f.ry * r;
          if (spots.every(([qx, qy, qs]) => Math.hypot(qx - ex, qy - ey) >= gap * (qs + s) / 2)) spots.push([ex, ey, s]);
        }
        for (const [ex, ey, s] of spots) eye(p, ex, ey, d.size * s, c, false, true, false); } },
    slits: { label: 'slits', dials: [['len', 'Length', 2, 5, 1, 3], ['spread', 'Spread', .3, .9, .05, .5], ['slant', 'Slant', -1, 1, .25, .5]],
      draw(x, d, c){ if (!x.front || x.noFace) return; const f = x.face, p = x.onFace(); for (const s of [-1, 1]){ const ex = f.cx + s * f.rx * d.spread; p.line(ex - d.len / 2, f.cy - s * d.slant, ex + d.len / 2, f.cy + s * d.slant, c.ink); } } },
    hollow: { label: 'hollows', dials: [['size', 'Size', 1, 3, .5, 2], ['spread', 'Spread', .3, .9, .05, .5], ['glow', 'Glowing', 'check', true]],
      draw(x, d, c){ if (!x.front || x.noFace) return; const f = x.face, p = x.onFace(); for (const s of [-1, 1]){ const ex = f.cx + s * f.rx * d.spread; p.ellipse(ex, f.cy, d.size * .8, d.size, c.ink); if (d.glow) p.put(ex, f.cy, c.accent); } } },
  },
  mouth: {
    none: { label: 'none', dials: [], draw(){} },
    smile: { label: 'smile', dials: [['w', 'Width', 1, 4, .5, 2], ['low', 'Lower', 0, 4, .5, 2]],
      draw(x, d, c){ if (!x.front || x.noFace || x.noMouth) return; const f = x.face, p = x.onFace(), y = f.cy + f.ry * .4 + d.low; for (let k = -d.w; k <= d.w; k++) p.put(f.cx + k, y + (Math.abs(k) >= d.w - .5 ? -1 : 0), c.ink); } },
    fangs: { label: 'fangs', dials: [['w', 'Width', 1.5, 4, .5, 2.5], ['fang', 'Fangs', 1, 3, 1, 2], ['low', 'Lower', 0, 4, .5, 2]],
      draw(x, d, c){ if (!x.front || x.noFace || x.noMouth) return; const f = x.face, p = x.onFace(), y = f.cy + f.ry * .4 + d.low; for (let k = -d.w; k <= d.w; k++) p.put(f.cx + k, y, c.ink); for (const s of [-1, 1]) for (let j = 1; j <= d.fang; j++) p.put(f.cx + s * (d.w - 1), y + j, c.white); } },
    stitched: { label: 'stitched', dials: [['w', 'Width', 2, 5, 1, 3], ['low', 'Lower', 0, 4, .5, 2]],
      draw(x, d, c){ if (!x.front || x.noFace || x.noMouth) return; const f = x.face, p = x.onFace(), y = f.cy + f.ry * .4 + d.low; for (let k = -d.w; k <= d.w; k++){ p.put(f.cx + k, y, c.ink); if (k % 2 === 0){ p.put(f.cx + k, y - 1, c.ink); p.put(f.cx + k, y + 1, c.ink); } } } },
    grin: { label: 'wide grin', dials: [['w', 'Width', 2, 6, .5, 4], ['teeth', 'Teeth', 'check', true], ['low', 'Lower', 0, 4, .5, 2]],
      draw(x, d, c){ if (!x.front || x.noFace || x.noMouth) return; const f = x.face, p = x.onFace(), y = f.cy + f.ry * .4 + d.low;
        for (let k = -d.w; k <= d.w; k++){ const dy = Math.round((k * k) / (d.w * d.w) * -1.5); p.put(f.cx + k, y + dy, c.ink); p.put(f.cx + k, y + dy + 1, d.teeth && Math.abs(k) < d.w - 1 && k % 2 === 0 ? c.white : c.deep); } } },
    tongue: { label: 'tongue out', dials: [['w', 'Width', 1, 3, .5, 2], ['len', 'Tongue', 1, 4, 1, 2]],
      draw(x, d, c){ if (!x.front || x.noFace || x.noMouth) return; const f = x.face, p = x.onFace(), y = f.cy + f.ry * .5; for (let k = -d.w; k <= d.w; k++) p.put(f.cx + k, y, c.ink); for (let j = 1; j <= d.len; j++) p.rowC(y + j, .8, c.accent, f.cx); } },
  },
  crest: {
    none: { label: 'none', dials: [], draw(){} },
    horns: { label: 'horns', dials: [['len', 'Length', 2, 8, 1, 4], ['curl', 'Curl', 0, 1, .1, .3], ['spread', 'Spread', .4, 1, .05, .7]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown; for (const s of [-1, 1]){ let hx = f.cx + s * x.crownW * d.spread, hy = top + 1; for (let k = 0; k < d.len * 2; k++){ const t = k / (d.len * 2), a = -Math.PI / 2 + s * (.35 + t * d.curl * 2.6); hx += Math.cos(a) * .5; hy += Math.sin(a) * .5; p.disc(hx, hy, Math.max(.5, 1.2 * (1 - t)), t > .6 ? c.trim : c.alt); } } } },
    antlers: { label: 'antlers', dials: [['len', 'Length', 3, 9, 1, 6], ['tines', 'Tines', 1, 3, 1, 2]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown; for (const s of [-1, 1]){ const bx = f.cx + s * x.crownW * .5; p.line(bx, top, bx + s * d.len * .4, top - d.len, c.trim); for (let k = 1; k <= d.tines; k++){ const ty = top - d.len * k / (d.tines + 1), tx = bx + s * d.len * .4 * k / (d.tines + 1); p.line(tx, ty, tx + s * 2, ty - 2, c.trim); } } } },
    ears: { label: 'ears', dials: [['len', 'Length', 2, 7, 1, 4], ['shape', 'Shape', 'select', ['pointed', 'round', 'floppy']], ['inner', 'Inner colour', 'check', true]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown + 1; for (const s of [-1, 1]){ const bx = f.cx + s * x.crownW * .65;
        if (d.shape === 'round') { p.disc(bx, top - d.len * .4, d.len * .5, c.main); if (d.inner && x.front) p.disc(bx, top - d.len * .4, d.len * .25, c.accent); }
        else if (d.shape === 'floppy') { p.limb(bx, top, bx + s * d.len * .8, top + d.len * .6, 1.4, 1, c.main); }
        else { for (let k = 0; k < d.len; k++) p.rowC(top - k, Math.max(.5, 1.6 * (1 - k / d.len)), c.main, bx + s * k * .25); if (d.inner && x.front) for (let k = 0; k < d.len - 1; k++) p.put(bx + s * k * .25, top - k, c.accent); } } } },
    antennae: { label: 'antennae', dials: [['len', 'Length', 3, 9, 1, 5], ['bobble', 'Bobbles', 'check', true], ['curl', 'Curl', 0, 1, .1, .4]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown; for (const s of [-1, 1]){ let ax = f.cx + s * x.crownW * .35, ay = top; for (let k = 0; k < d.len; k++){ ax += s * (.3 + k / d.len * d.curl); ay -= 1; p.put(ax, ay, c.ink); } if (d.bobble) p.disc(ax, ay - 1, 1, c.accent); } } },
    flame: { label: 'flame', dials: [['h', 'Height', 3, 7, 1, 5], ['wick', 'Wick', 'check', true]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown; if (d.wick) p.put(f.cx, top - 1, c.ink);
        for (let k = 0; k < d.h; k++){ const hw = Math.sin((k + 1) / d.h * Math.PI) * 1.4; p.rowC(top - 2 - (d.h - 1 - k), Math.max(.5, hw), k > d.h * .5 ? c.flame_d : c.flame, f.cx); } x.glows = ['flame', 'flame_d']; } },
    crown: { label: 'crown', dials: [['points', 'Points', 3, 5, 1, 3], ['h', 'Height', 2, 4, 1, 2]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown, w = x.crownW * .7; p.rowC(top, w, c.metal, f.cx); for (let i = 0; i < d.points; i++){ const px = f.cx - w + i * 2 * w / (d.points - 1); for (let k = 1; k <= d.h; k++) p.put(px, top - k, c.metal); } if (x.front) p.put(f.cx, top, c.accent); } },
    jester: { label: 'jester points', dials: [['reach', 'Reach', 3, 7, 1, 5], ['bells', 'Bells', 'check', true]],
      draw(x, d, c){ const f = x.face, p = x.on(x.crestJoint), top = x.crown; for (const s of [-1, 1]){ let tx = f.cx, ty = top; const n = d.reach + 3; for (let k = 0; k < n; k++){ const t = k / n; tx = f.cx + s * (1 + t * d.reach); ty = top - Math.sin(t * Math.PI) * 3 + t * t * 3; p.disc(tx, ty, Math.max(.6, 1.6 * (1 - t)), s < 0 ? c.main : c.alt); } if (d.bells) p.disc(tx + s, ty + 1, .9, c.metal); } } },
  },
  arms: {
    none: { label: 'none', dials: [], draw(){} },
    stubby: { label: 'stubby', dials: [['len', 'Length', 2, 6, 1, 4], ['thick', 'Thickness', 1, 2.5, .5, 1.5]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j); x.on(j).limb(ax, ay, ax + s * d.len * .6, ay + d.len, d.thick, d.thick * .9, c.main); } } },
    gangly: { label: 'long', dials: [['len', 'Length', 8, 18, 1, 12], ['thick', 'Thickness', .5, 1.5, .25, .75], ['hands', 'Hands', 'select', ['claws', 'mitts', 'none']]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), ex = ax + s * 2, ey = ay + d.len; x.on(j).limb(ax, ay, ex, ey, d.thick + .3, d.thick, c.main);
        if (d.hands === 'claws') for (const k of [-1, 0, 1]) x.on(j).line(ex, ey, ex + k * 1.2 + s * .5, ey + 2, c.trim); if (d.hands === 'mitts') x.on(j).disc(ex, ey + 1, 1.4, c.trim); } } },
    claws: { label: 'claws', dials: [['len', 'Length', 4, 10, 1, 6], ['size', 'Claw size', 1.5, 3.5, .5, 2.5]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), ex = ax + s * d.len * .4, ey = ay + d.len * .8, p = x.on(j); p.limb(ax, ay, ex, ey, 1.3, 1, c.main);
        for (const k of [-1, 1]) p.limb(ex, ey, ex + s * d.size + k * .5, ey + d.size * k * .6 - 1, .8, .5, c.trim); } } },
    tentacles: { label: 'tentacles', dials: [['len', 'Length', 6, 16, 1, 10], ['curl', 'Curl', 0, 1.5, .1, .8]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ let [ax, ay] = jc(x.plan, j); const p = x.on(j); for (let k = 0; k < d.len * 2; k++){ const t = k / (d.len * 2), a = Math.PI / 2 - s * (t * d.curl * 2); ax += Math.cos(a) * .5 * s; ay += Math.sin(a) * .5; p.disc(ax, ay, Math.max(.5, 1.4 * (1 - t * .7)), k % 4 === 0 ? c.alt : c.main); } } } },
    mitts: { label: 'floating mitts', dials: [['size', 'Size', 1.5, 3.5, .5, 2.5], ['cuff', 'Cuff', 'check', true]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), p = x.on(j); p.disc(ax, ay, d.size, c.white); p.disc(ax + s * d.size * .6, ay - d.size * .6, d.size * .45, c.white); if (d.cuff) p.rowC(ay + d.size, d.size, c.accent, ax); } } },
  },
  legs: {
    none: { label: 'none', dials: [], draw(){} },
    stubby: { label: 'stubby', dials: [['thick', 'Thickness', 1, 3, .5, 1.5], ['feet', 'Feet', 'select', ['round', 'claws', 'hooves']]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), p = x.on(j); p.limb(ax, ay, ax + s * .5, MH - 2, d.thick, d.thick, c.main); footAt(p, ax + s * .5, MH - 1, d.feet, d.thick, c, s); } } },
    long: { label: 'long', dials: [['thick', 'Thickness', .5, 2, .25, 1], ['knees', 'Knobbly knees', 'check', true], ['feet', 'Feet', 'select', ['claws', 'round', 'hooves', 'points']]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), p = x.on(j), ky = (ay + MH) / 2; p.limb(ax, ay, ax + s, ky, d.thick + .3, d.thick, c.main); p.limb(ax + s, ky, ax + s * .5, MH - 2, d.thick, d.thick * .8, x.fill('main', 'alt'));
        if (d.knees) p.disc(ax + s, ky, d.thick + .6, c.alt); footAt(p, ax + s * .5, MH - 1, d.feet, d.thick, c, s); } } },
    hocks: { label: 'backward knees', dials: [['thick', 'Thickness', .75, 2, .25, 1.25], ['feet', 'Feet', 'select', ['claws', 'hooves', 'points']]],
      draw(x, d, c){ for (const [j, s] of x.limbs()){ const [ax, ay] = jc(x.plan, j), p = x.on(j), k1 = ay + (MH - ay) * .35, k2 = ay + (MH - ay) * .7; p.limb(ax, ay, ax + s * 2, k1, d.thick + .4, d.thick, c.main); p.limb(ax + s * 2, k1, ax - s * .5, k2, d.thick, d.thick * .8, c.main); p.limb(ax - s * .5, k2, ax + s, MH - 2, d.thick * .8, d.thick * .7, c.main); footAt(p, ax + s, MH - 1, d.feet, d.thick, c, s); } } },
    spider: { label: 'spindly', dials: [['reach', 'Reach', 4, 9, .5, 6], ['thick', 'Thickness', .5, 1.5, .25, .75]],
      draw(x, d, c){ for (const [j, s, i] of x.limbs()){ const [ax, ay] = jc(x.plan, j), p = x.on(j), kx = ax + s * d.reach, ky = ay - 3 + i; p.line(ax, ay, kx, ky, c.main); p.line(kx, ky, kx + s * (1 + i * .5), MH - 1, c.main); if (d.thick > 1) p.line(ax, ay + 1, kx, ky + 1, c.shade); } } },
  },
  tail: {
    none: { label: 'none', dials: [], draw(){} },
    thin: { label: 'thin', dials: [['len', 'Length', 4, 14, 1, 8], ['tip', 'Tip', 'select', ['plain', 'spade', 'tuft', 'stinger']]],
      draw(x, d, c){ const [tx, ty] = jc(x.plan, x.at.tail), p = x.on(x.at.tail), s = x.front ? 1 : -1; let hx = tx, hy = ty; for (let k = 0; k < d.len; k++){ hx += s * .7; hy += Math.sin(k * .5) * .6 - .2; p.put(hx, hy, c.main); }
        if (d.tip === 'spade') p.disc(hx + s, hy, 1.2, c.alt); if (d.tip === 'tuft') p.disc(hx + s, hy, 1.4, c.trim); if (d.tip === 'stinger') p.line(hx, hy, hx + s * 2, hy - 1, c.ink); } },
    ribbons: { label: 'ribbons', dials: [['len', 'Length', 6, 16, 1, 10], ['count', 'How many', 2, 3, 1, 2]],
      draw(x, d, c){ const [tx, ty] = jc(x.plan, x.at.tail), p = x.on(x.at.tail); for (let i = 0; i < d.count; i++){ const bx = tx - 3 + i * 6 / Math.max(1, d.count - 1); for (let k = 0; k < d.len; k++) p.put(bx + Math.sin(k * .6 + i * 2) * 1.3, ty + k, i % 2 ? c.alt : c.accent); } } },
    fluffy: { label: 'fluffy', dials: [['size', 'Size', 2, 5, .5, 3]],
      draw(x, d, c){ const [tx, ty] = jc(x.plan, x.at.tail), p = x.on(x.at.tail); if (!x.front) p.disc(tx, ty - 1, d.size, c.trim); else p.disc(tx + d.size + 3, ty - 2, d.size * .7, c.trim); } },
    tatters: { label: 'wisp', dials: [['len', 'Length', 5, 14, 1, 9], ['w', 'Width', 2, 6, .5, 4]],
      draw(x, d, c){ const [tx, ty] = jc(x.plan, x.at.tail), p = x.on(x.at.tail); for (let k = 0; k < d.len; k++){ const hw = d.w * (1 - k / d.len); p.rowC(ty + k, hw, (xx, yy) => (hash32(xx * 13 + yy * 7) % 5) ? c.main : null, tx + Math.sin(k * .5) * 1.5); } } },
  },
  wings: {
    none: { label: 'none', dials: [], draw(){} },
    bat: { label: 'bat', dials: [['span', 'Span', 6, 15, .5, 11], ['h', 'Height', 5, 12, 1, 8]],
      draw(x, d, c){ const [wx, wy] = jc(x.plan, x.at.wings), p = x.on(x.at.wings); for (const s of [-1, 1]) for (let y = wy - 3; y <= wy - 3 + d.h; y++){ const t = (y - wy + 3) / d.h, reach = d.span * (1 - t * .55) - (Math.floor(y / 2) % 2 && t > .3 ? 1 : 0); for (let k = 2; k <= reach; k++) p.put(wx + s * k, y, k >= reach - 1 ? c.deep : c.shade); } } },
    moth: { label: 'moth', dials: [['span', 'Span', 6, 15, .5, 11], ['h', 'Height', 6, 14, 1, 10], ['spots', 'Eyespots', 'check', true]],
      draw(x, d, c){ const [wx, wy] = jc(x.plan, x.at.wings), p = x.on(x.at.wings); for (const s of [-1, 1]){ for (let y = wy - 4; y <= wy - 4 + d.h; y++){ const t = (y - wy + 4) / d.h, reach = d.span * Math.sin(Math.min(1, t + .15) * Math.PI) * (t < .55 ? 1 : .8); for (let k = 2; k <= reach; k++) p.put(wx + s * k, y, k >= reach - 1 ? c.alt_d : c.alt); }
        if (d.spots){ const sx = wx + s * d.span * .55, sy = wy - 4 + d.h * .3; p.disc(sx, sy, 1.4, c.accent); p.put(sx, sy, c.ink); } } } },
    bee: { label: 'glass', dials: [['span', 'Span', 5, 13, .5, 9], ['h', 'Height', 4, 10, 1, 7]],
      draw(x, d, c){ const [wx, wy] = jc(x.plan, x.at.wings), p = x.on(x.at.wings); for (const s of [-1, 1]) p.ellipse(wx + s * (d.span / 2 + 1), wy - 4, d.span / 2, d.h / 2, (xx, yy) => c.glass); } },
  },
};
function bodyCentre(x, d){
  const plan = x.plan, j = PLANS[plan].at.body;
  if (plan === 'blob'){ return [MCX + .5, MH - 1 - d.h]; }
  if (plan === 'crawler'){ const [cx, cy] = jc(plan, 'body'); return [cx, cy - d.h * .3]; }
  const [cx, cy] = jc(plan, j === 'seg' ? 'seg2' : j); return [cx, cy];
}
function eye(p, x, y, r, c, lids, glossy, hollow){
  if (hollow){ p.ellipse(x, y, r, r * 1.1, c.ink); p.put(x, y, c.accent); return; }
  p.disc(x, y, r, c.white); p.disc(x, y + (r > 1.4 ? .3 : 0), Math.max(.5, r * .55), c.ink);
  if (glossy && r >= 1.4) p.put(x - r * .4, y - r * .4, c.white);
  if (lids) for (let k = -Math.ceil(r); k <= r; k++) p.put(x + k, y - Math.round(r * .6), c.shade);
}
function footAt(p, x, y, kind, thick, c, s){
  if (kind === 'claws') for (const k of [-1, 0, 1]) p.put(x + k * 1.2 + s * .5, y, c.trim);
  else if (kind === 'hooves') p.rowC(y, thick + .6, c.ink, x);
  else if (kind === 'points') p.line(x, y, x + s * 2, y, c.main);
  else p.ellipse(x + s * .5, y - .5, thick + 1, 1, c.main);
}

/* ---------- briefs ---------- */
const MONSTER_BRIEFS = {
  maskghost: { label: 'Mask ghost', theme: 'crypt', plan: 'floater', rooms: ['crypt'], note: 'a living carnival mask, player-sized, ribbons streaming behind', motifs: ['harlequin', 'plain', 'checks'],
    slots: { body: [['mask', { split: [true, false] }]], eyes: [['slits', {}], ['hollow', {}], ['pair', { lids: true }]], mouth: [['stitched', {}], ['smile', {}], ['none', {}]], crest: [['jester', {}], ['crown', {}], ['none', {}]],
      arms: [['mitts', {}], ['none', {}]], tail: [['ribbons', {}], ['tatters', {}]], wings: [['none', {}]] } },
  shroud: { label: 'Shroud', theme: 'crypt', plan: 'floater', rooms: ['crypt'], prefer: { tone: 'pale' }, note: 'a burial sheet that got up: hollow eyes, a tattered hem', motifs: ['plain', 'lace', 'pinstripe'],
    slots: { body: [['bell', { hem: ['tatters', 'zigzag'] }]], eyes: [['hollow', { glow: true }]], mouth: [['none', {}], ['grin', { teeth: false }]], crest: [['none', {}], ['crown', {}]], arms: [['tentacles', { len: [6, 10] }], ['none', {}]], tail: [['tatters', {}], ['none', {}]], wings: [['none', {}]] } },
  candlewalker: { label: 'Candle walker', theme: 'crypt', plan: 'column', rooms: ['crypt'], note: 'a lit candle that toddles after you, dripping', motifs: ['plain'],
    prefer: { main: '#f4e6d4' },
    slots: { body: [['candle', { h: [18, 30] }]], head: [['none', {}]], eyes: [['pair', { size: [1, 1.5] }], ['slits', {}]], mouth: [['smile', {}], ['none', {}]], crest: [['flame', {}]], arms: [['stubby', { len: [2, 4] }], ['none', {}]] } },
  puppet: { label: 'Puppet', theme: 'crypt', plan: 'biped', rooms: ['crypt'], note: 'a stringless marionette: jester points, stitched mouth, long arms', motifs: ['harlequin', 'stripes', 'checks'],
    slots: { body: [['trunk', {}]], head: [['round', {}], ['mask', {}]], eyes: [['pair', {}], ['slits', {}]], mouth: [['stitched', {}], ['grin', {}]], crest: [['jester', {}], ['none', {}]],
      arms: [['gangly', { hands: ['mitts'], len: [8, 12] }]], legs: [['long', { feet: ['points'] }]], tail: [['none', {}]], wings: [['none', {}]] } },
  bonehound: { label: 'Bone hound', theme: 'crypt', plan: 'crawler', rooms: ['crypt'], note: 'a skull on scuttling legs, sniffing for the living', motifs: ['plain', 'pinstripe'],
    prefer: { tone: 'dark' },
    slots: { body: [['orb', { w: [7, 11], h: [4, 6] }]], head: [['skull', {}]], eyes: [['hollow', { glow: true }]], mouth: [['none', {}]], crest: [['none', {}], ['horns', { len: [2, 4] }]], legs: [['spider', {}]], tail: [['thin', { tip: ['plain'] }], ['none', {}]], wings: [['none', {}]] } },
  eyejelly: { label: 'Eye jelly', theme: 'candy', plan: 'blob', rooms: ['hatchery', 'optician'], note: 'a gumdrop with one great eye that hops', motifs: ['plain', 'spots', 'flecks'],
    slots: { body: [['jelly', {}]], eyes: [['one', { size: [3, 5] }], ['many', {}]], mouth: [['none', {}], ['tongue', {}], ['smile', {}]], crest: [['antennae', {}], ['ears', { shape: ['round'] }], ['none', {}]], legs: [['stubby', { feet: ['round'] }], ['none', {}]], tail: [['none', {}]], wings: [['none', {}]] } },
  ganglybeast: { label: 'Gangly beast', theme: 'candy', plan: 'gangly', rooms: ['sweetshop', 'hatchery'], note: 'long legs, claws, antlers, big glossy eyes, a patterned skin', motifs: ['zebra', 'checks', 'flecks', 'spots'],
    slots: { body: [['trunk', { w: [3, 5] }], ['orb', { w: [5, 8], h: [5, 7] }]], head: [['round', {}], ['beak', {}], ['eyeball', {}]], eyes: [['pair', { size: [1.5, 2.5], glossy: true }]], mouth: [['fangs', {}], ['none', {}], ['grin', {}]],
      crest: [['antlers', {}], ['horns', {}], ['ears', {}]], arms: [['claws', {}], ['gangly', { hands: ['claws'] }]], legs: [['hocks', {}], ['long', {}]], tail: [['thin', {}], ['fluffy', {}]], wings: [['none', {}], ['bat', {}]] } },
  manyeyes: { label: 'Many-eyed ball', theme: 'candy', plan: 'floater', rooms: ['optician', 'hatchery'], note: 'a floating ball covered in eyes, on glassy wings', motifs: ['plain', 'eyes', 'spots'],
    slots: { body: [['orb', { w: [8, 12], h: [8, 12] }]], eyes: [['many', { count: [5, 9] }]], mouth: [['none', {}], ['grin', {}]], crest: [['none', {}], ['antennae', {}]], arms: [['none', {}]], tail: [['none', {}], ['thin', {}]], wings: [['bee', {}], ['moth', {}], ['none', {}]] } },
  sweetmoth: { label: 'Sugar moth', theme: 'candy', plan: 'biped', rooms: ['sweetshop', 'optician'], note: 'a soft moth person with feathery antennae and eyespot wings', motifs: ['spots', 'stripes', 'eyes'],
    slots: { body: [['trunk', {}], ['pear', {}]], head: [['round', { cheeks: true }]], eyes: [['pair', { size: [2, 3], glossy: true }]], mouth: [['none', {}], ['smile', {}]], crest: [['antennae', { bobble: true }]], arms: [['stubby', {}]], legs: [['stubby', {}]], tail: [['none', {}]], wings: [['moth', { spots: true }]] } },
};
const M_SLOTS_FOR = plan => Object.keys(MONSTER_PARTS).filter(s => PLANS[plan].at[s] !== null && !(s === 'head' && PLANS[plan].face === 'body'));

/* ---------- a design ---------- */
function newMonsterDesign(o){ return { type: 'monster', id: ++workIds, brief: 'maskghost', plan: 'floater', name: '', label: '', note: '', theme: 'crypt', rooms: ['crypt'], behaviour: 'float', hp: 5,
  scheme: {}, motif: 'plain', motifScale: 2, parts: {}, seed: 0, ...o }; }
function genMonster(seed, briefKey){
  const rng = mulberry32(seed), keys = Object.keys(MONSTER_BRIEFS), bk = briefKey && MONSTER_BRIEFS[briefKey] ? briefKey : keys[ri(rng, keys.length)], b = MONSTER_BRIEFS[bk];
  const D = newMonsterDesign({ brief: bk, seed, plan: b.plan, theme: b.theme, rooms: b.rooms.slice(), behaviour: PLANS[b.plan].behaviour, motif: b.motifs[ri(rng, b.motifs.length)], motifScale: 2 + ri(rng, 2) });
  D.scheme = schemeFrom(rng, themePalette(b.theme), b.prefer || {});
  for (const slot of M_SLOTS_FOR(b.plan)) D.parts[slot] = b.slots[slot] ? rollPart('monster', slot, b, rng) : { kind: 'none', dials: {}, lock: false };
  D.label = b.label.toLowerCase(); D.name = slug(b.label + '_' + (seed % 1000));
  return D;
}

/* ---------- drawing: one pen per slot, joint and side ---------- */
function drawMonsterLayers(D){
  const pal = { keys: [], colors: [] }, c = deriveRoles(D.scheme), plan = PLANS[D.plan], layers = {};   // layers[slot][joint][side] = px
  const ctx = { plan: D.plan, at: plan.at, motif: D.motif, face: { cx: MCX + .5, cy: 20, rx: 4, ry: 3 }, faceJoint: plan.face, glows: null };
  const order = ['body', 'head', 'eyes', 'mouth', 'crest', 'arms', 'legs', 'tail', 'wings'];   // drawn in this order so the face is known
  for (const side of ['front', 'back']){
    Object.assign(ctx, { noFace: false, noMouth: false, hollow: false, face: { cx: MCX + .5, cy: 20, rx: 4, ry: 3 }, faceSlot: null, faceJoint: null });
    for (const slot of order){
      const part = D.parts[slot]; if (!part || plan.at[slot] === null || plan.at[slot] === undefined && slot !== 'body') continue;
      const x = { ...ctx, side, front: side === 'front',
        // seen from behind, the limb drawn on the left is the right one (the game mirrors back pictures)
        on: j0 => { const j = side === 'back' ? mirrorJoint(j0) : j0; const L = ((layers[slot] = layers[slot] || {})[j] = layers[slot][j] || {}); return L[side] || (L[side] = new Pen(MW, MH, MCX, pal)); },
        fill: (base, accent) => motifFill(c, D.motif, D.motifScale, base, accent, MCX + .5),
        bodyJoint: y => plan.at.body !== 'seg' ? plan.at.body : y > MH - 1 - 9 ? 'seg1' : y > MH - 1 - 18 ? 'seg2' : 'seg3',
        // the face is painted onto the picture that made it, so eyes sit on the surface, not under it
        setFace: (cx, cy, rx, ry, top) => { ctx.face = { cx, cy, rx, ry, top: top != null ? top : cy - ry * 1.6 }; ctx.faceSlot = slot; ctx.faceJoint = slot === 'body' ? x.bodyJoint(cy) : 'head'; },
        // a motif fill that leaves the face plain, so eyes and mouth read
        calm: (base, accent) => { const m = motifFill(c, D.motif, D.motifScale, base, accent, MCX + .5); return typeof m !== 'function' ? m : (xx, yy) => { const f = ctx.face, dx = (xx + .5 - f.cx) / (f.rx * 1.25 + 1), dy = (yy + .5 - f.cy) / (f.ry * 1.35 + 1); return dx * dx + dy * dy <= 1 ? c[base] : m(xx, yy); }; },
        onFace: () => { const fs = ctx.faceSlot || 'body', j = ctx.faceJoint || plan.face; const L = ((layers[fs] = layers[fs] || {})[j] = layers[fs][j] || {}); return L[side] || (L[side] = new Pen(MW, MH, MCX, pal)); },
        limbs: () => { const js = Array.isArray(plan.at[slot]) ? plan.at[slot] : []; return js.map((j, i) => [j, PLANS[D.plan].joints[j][1][0] < 0 ? -1 : 1, i % 3]); },
        get crown(){ return ctx.face.top; }, get crownW(){ return Math.max(2, ctx.face.rx * 1.2); },
        crestJoint: plan.at.crest || plan.face };
      if (part.kind === 'drawn' && part.drawn){
        for (const [j, sides] of Object.entries(part.drawn.layers || {})){ const src = sides[side]; if (!src) continue; const p = x.on(j); for (let i = 0; i < src.length; i++) if (src[i] >= 0) p.px[i] = p.idx(hex(part.drawn.colors[src[i]])); }
      } else {
        const kind = MONSTER_PARTS[slot][part.kind]; if (!kind) continue;
        kind.draw(x, part.dials, c);
      }
      for (const k of ['noFace', 'noMouth', 'hollow', 'top']) if (x[k] !== undefined) ctx[k] = x[k];
      if (x.glows) ctx.glows = x.glows;
    }
  }
  for (const s of Object.keys(layers)) for (const j of Object.keys(layers[s])) for (const side of ['front', 'back']) if (layers[s][j][side]) layers[s][j][side] = layers[s][j][side].px;
  return { pal, layers, glows: ctx.glows ? ctx.glows.map(r => c[r].slice(1)) : null };
}
async function monsterPictures(D){
  const { pal, layers, glows } = drawMonsterLayers(D), out = { layers, pal, glows };
  for (const side of ['front', 'back']){
    const px = new Int16Array(MW * MH).fill(-1), colors = [], map = new Map(), key = col => { const k = hexOf(col); if (!map.has(k)){ map.set(k, colors.length); colors.push(col); } return map.get(k); };
    // the back view runs the slots the other way, so wings and tails cover the body from behind
    for (const slot of side === 'front' ? M_SLOTS : [...M_SLOTS].reverse()){
      if (!layers[slot]) continue;
      for (const sides of Object.values(layers[slot])){ const src = sides[side]; if (src) for (let i = 0; i < src.length; i++) if (src[i] >= 0) px[i] = key(pal.colors[src[i]]); }
    }
    out[side] = { w: MW, h: MH, px, colors };
  }
  return out;
}
// the rig: for each joint, its layers (slot order) built as shells, as game/creature.gd builds them
// a slot's pictures by joint; a body spread over several joints (a column's segments) is one
// picture shared by them, each taking its own rows, so it domes as one thing and bends at the joins
function layerUnits(layers){
  const units = [];
  for (const slot of M_SLOTS){
    const L = layers[slot]; if (!L) continue;
    const js = Object.keys(L);
    if (slot === 'body' && js.length > 1){
      const merged = {};
      for (const side of ['front', 'back']){ const px = new Int16Array(MW * MH).fill(-1); let any = false; for (const j of js){ const s = L[j][side]; if (s) for (let i = 0; i < s.length; i++) if (s[i] >= 0){ px[i] = s[i]; any = true; } } if (any) merged[side] = px; }
      // each joint's rows: from its own lowest drawn row up to the next joint's
      const span = js.map(j => { let lo = MH, hi = -1; for (const side of ['front', 'back']){ const s = L[j][side]; if (s) for (let i = 0; i < s.length; i++) if (s[i] >= 0){ const r = Math.floor(i / MW); lo = Math.min(lo, r); hi = Math.max(hi, r); } } return [j, lo, hi + 1]; }).filter(x => x[2] > 0).sort((a, b) => a[1] - b[1]);
      span.forEach(([j, lo, hi], k) => units.push({ slot, joint: j, sides: merged, rows: [k === 0 ? 0 : lo, k === span.length - 1 ? MH : span[k + 1][1]], shared: true }));
    } else for (const j of js) units.push({ slot, joint: j, sides: L[j] });
  }
  return units;
}
async function monsterRig(D){
  const pics = await monsterPictures(D), { layers, pal } = pics, plan = PLANS[D.plan], cells = {};
  for (const u of layerUnits(layers)) for (const side of ['front', 'back']) if (u.sides[side]) shellCells(u.sides[side], pal, MW, MH, M_DEPTH[u.slot], side === 'back', cells[u.joint] || (cells[u.joint] = new Map()), u.rows);
  const joints = plan.joints, pieces = Object.keys(joints).map(j => ({ joint: j, V: cells[j] ? cellsToPiece(cells[j]) : null })).filter(p => p.V);
  return { joints, pieces, size: [MW, MH], animate: (st, dt, t, walk) => monsterAnimate(D.plan, st, dt, t, walk), pics };
}
// the motion for each plan; game/creature.gd plays the same
function monsterAnimate(plan, st, dt, t, walk){
  if (st.phase == null) Object.assign(st, { phase: 0, head: [0, 0], tail: [0, 0], top: [0, 0] });
  st.phase += dt * (3 + walk * 9);
  const s = Math.sin(st.phase), c = Math.cos(st.phase), pose = {};
  if (dt){ st.head = spring(st.head, s * .06 * walk, dt, 50, 8); st.tail = spring(st.tail, -s * .35 * walk + Math.sin(t * 2.4) * .2, dt, 30, 4); st.top = spring(st.top, c * .25 * walk + Math.sin(t * 1.7) * .08, dt, 40, 5); }
  if (plan === 'floater'){
    pose.body = { pos: [0, Math.sin(t * 2) * 1.5, 0], rot: [walk * .25, 0, Math.sin(t * 1.3) * .08] };
    pose.tail = { rot: [Math.sin(t * 2.6) * .15 + walk * .4, 0, st.tail[0]] };
    pose.arml = { pos: [0, Math.sin(t * 2.6) * 1.2, 0], rot: [0, 0, -.2 + Math.sin(t * 2.6) * .15] };
    pose.armr = { pos: [0, Math.sin(t * 2.6 + 1.4) * 1.2, 0], rot: [0, 0, .2 - Math.sin(t * 2.6 + 1.4) * .15] };
  } else if (plan === 'blob'){
    const hop = walk > .05 ? Math.max(0, Math.sin(st.phase * .5)) : 0, sq = walk > .05 ? (1 - hop) * .18 : Math.sin(t * 3) * .04;
    pose.body = { pos: [0, hop * 6 * walk, 0], scale: [1 + sq, 1 - sq, 1 + sq] };
    pose.crest = { rot: [0, 0, st.top[0] + (1 - hop) * .2 * walk] };
    pose.legl = { rot: [s * .5 * walk, 0, 0] }; pose.legr = { rot: [-s * .5 * walk, 0, 0] };
    pose.tail = { rot: [0, 0, st.tail[0]] };
  } else if (plan === 'crawler'){
    pose.body = { pos: [0, Math.abs(c) * .8 * walk + Math.sin(t * 2) * .3, 0], rot: [0, s * .05 * walk, 0] };
    for (const [j, k] of [['legl1', 0], ['legl2', 1], ['legl3', 2], ['legr1', 1], ['legr2', 2], ['legr3', 0]]) pose[j] = { rot: [Math.sin(st.phase + k * 2.1) * .5 * walk, 0, Math.cos(st.phase + k * 2.1) * .15 * walk * (j.startsWith('legl') ? 1 : -1)] };
    pose.head = { rot: [Math.sin(t * 1.5) * .05, st.head[0] * 2, st.head[0]] };
    pose.tail = { rot: [0, st.tail[0], 0] };
  } else if (plan === 'column'){
    pose.seg1 = { pos: [0, Math.abs(c) * 1 * walk, 0], rot: [0, 0, Math.sin(t * 2) * .03 + s * .06 * walk] };
    pose.seg2 = { rot: [0, 0, Math.sin(t * 2 - .6) * .04 + s * .07 * walk] };
    pose.seg3 = { rot: [0, 0, Math.sin(t * 2 - 1.2) * .05 + s * .08 * walk] };
    pose.head = { rot: [0, 0, st.head[0] + Math.sin(t * 2 - 1.8) * .05] };
    pose.arml = { rot: [-s * .6 * walk, 0, -.15] }; pose.armr = { rot: [s * .6 * walk, 0, .15] };
  } else {
    // biped and gangly: the witch's walk, longer strides for long legs
    const stride = plan === 'gangly' ? .6 : .85;
    pose.hips = { pos: [0, Math.abs(c) * 1.6 * walk + Math.sin(t * 2.2) * .3 * (1 - walk), 0] };
    pose.torso = { rot: [-walk * .15, s * .12 * walk, s * .04 * walk] };
    pose.legl = { rot: [s * stride * walk, 0, 0] }; pose.legr = { rot: [-s * stride * walk, 0, 0] };
    pose.arml = { rot: [-s * .7 * walk + Math.sin(t * 1.9) * .05, 0, -.1] }; pose.armr = { rot: [s * .7 * walk + Math.sin(t * 1.6) * .05, 0, .1] };
    pose.head = { rot: [walk * .1 + Math.sin(t * 1.3) * .04, 0, st.head[0]] };
    pose.tail = { rot: [0, st.tail[0], 0] };
    pose.wings = { rot: [0, Math.sin(t * (4 + walk * 6)) * .3, 0] };
  }
  return pose;
}

/* ---------- into the game: art/monsters/<name>.json and its pieces ---------- */
async function monsterFiles(D, f){
  const { layers, pal, glows } = await monsterPictures(D), files = [], pieces = {};
  const written = new Set();
  for (const u of layerUnits(layers)){
    const got = {};
    for (const side of ['front', 'back']){
      const px = u.sides[side]; if (!px || !px.some(v => v >= 0)) continue;
      const path = `art/monsters/${f.name}/${u.shared ? u.slot : u.joint}__${u.slot}_${side}.png`;
      if (!written.has(path)){ files.push([path, await canvasPNG(picCanvas(MW, MH, px, pal.colors)), 'piece']); written.add(path); }
      got[side] = path;
    }
    if (got.front || got.back) (pieces[u.joint] = pieces[u.joint] || []).push({ slot: u.slot, depth: M_DEPTH[u.slot], ...got, ...(u.rows ? { rows: u.rows } : {}) });
  }
  const plan = PLANS[D.plan], c = deriveRoles(D.scheme);
  const rig = { label: f.label, note: f.note || MONSTER_BRIEFS[D.brief]?.note || '', behaviour: D.behaviour, rooms: D.rooms, hp: D.hp, plan: D.plan, canvas: [MW, MH],
    joints: plan.joints, pieces, light: (glows && glows[0]) || c.accent.slice(1), design: designToJSON(D) };
  files.push([`art/monsters/${f.name}.json`, JSON.stringify(rig, null, 1) + '\n', 'monster']);
  return files;
}
