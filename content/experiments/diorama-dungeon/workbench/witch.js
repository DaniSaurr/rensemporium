/* Ren's Workbench: the witch. Parts with dials for each slot of the game's shared body,
   briefs that give an outfit a purpose, the cutter that matches tools/draw_witch.py, and
   her walk as game/witch.gd plays it. */

const WW = 28, WH = 56, WCX = 13.5, HEAD_TOP = 13, CHIN = 24, SHOULDER = 26, WAIST = 34, HIP = 37, KNEE = 45, ANKLE = 52;
// shoes sit over the ends of the legs (the game's first styles have theirs drawn into the legs)
const W_SLOTS = ['back', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'hand'];
const W_DEPTH = { body: 3, legs: 4, shoes: 5, top: 4, bottom: 5, back: 6, hair: 5, hat: 6, hand: 2 };
const W_JOINTS = {
  hips: ['', [0, 18, 0]], torso: ['hips', [0, 18, 0]], skirt: ['torso', [0, 22, 0]], head: ['torso', [0, 31, 0]], hat: ['head', [0, 42, 0]],
  arml: ['torso', [-5, 30, 0]], armr: ['torso', [5, 30, 0]], hand: ['armr', [6.5, 21, 0]], legl: ['hips', [-1.5, 18, 0]], legr: ['hips', [1.5, 18, 0]],
};
const W_PIECES = ['head', 'hat', 'torso', 'skirt', 'arml', 'armr', 'hand', 'legl', 'legr'];
const SKIN = '#f6dcc8', SKIN_D = '#e0b8a4';
const heldX = side => side === 'front' ? WCX + 7 : WCX - 7;
const HAND_Y = WH - 21;     // the hand joint, in canvas rows

/* ---------- the parts ---------- */
const WITCH_PARTS = {
  hat: {
    none: { label: 'none', dials: [], draw(){} },
    pointed: { label: 'pointed hat', dials: [['brim', 'Brim', 6, 11, .5, 8.5], ['tall', 'Height', 5, 16, 1, 11], ['lean', 'Lean', -.4, .4, .05, 0], ['droop', 'Drooping tip', 'check', false],
        ['patterned', 'In the motif', 'check', false], ['ornament', 'Ornament', 'select', ['none', 'buckle', 'star', 'moon', 'feather', 'eye']]],
      draw(p, d, c, x){
        p.rowC(HEAD_TOP + 1, d.brim, c.main); p.rowC(HEAD_TOP + 2, d.brim + .5, c.shade);
        const cone = d.patterned ? x.fill('main', 'alt') : c.main;
        for (let k = 0; k < d.tall; k++){ const y = HEAD_TOP - k, hw = Math.max(.6, 4.5 - k * 3.9 / d.tall), x0 = WCX - hw + k * d.lean; p.span(y, pyRound(x0 + .5), pyRound(x0 + 2 * hw + .5), cone); }
        p.rowC(HEAD_TOP - 1, 4.2, c.accent);
        const tx = WCX + (d.tall - 1) * d.lean, ty = HEAD_TOP - d.tall + 1;
        if (d.droop) for (let k = 1; k <= 3; k++) p.put(tx + (d.lean >= 0 ? 1 : -1) * k, ty + k - 1, c.main);
        if (x.front){
          if (d.ornament === 'buckle'){ for (const dx of [-1, 0, 1]) p.put(WCX + dx, HEAD_TOP - 1, c.trim); p.put(WCX, HEAD_TOP - 1, c.metal); }
          if (d.ornament === 'star') for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) p.put(WCX + dx, HEAD_TOP - 4 + dy, c.flame);
          if (d.ornament === 'moon') for (const [dx, dy] of [[0, -1], [-1, 0], [-1, 1], [0, 2]]) p.put(WCX + dx, HEAD_TOP - 4 + dy, c.white);
          if (d.ornament === 'eye'){ p.put(WCX - 1, HEAD_TOP - 4, c.white); p.put(WCX, HEAD_TOP - 4, c.ink); p.put(WCX + 1, HEAD_TOP - 4, c.white); }
        }
        if (d.ornament === 'feather') for (let k = 0; k < 5; k++) p.put(WCX + 4 + (k > 2 ? 1 : 0), HEAD_TOP - 1 - k, k % 2 ? c.accent_l : c.accent);
      } },
    wide: { label: 'wide brim', dials: [['brim', 'Brim', 8, 13.5, .5, 11], ['crown', 'Crown', 2, 7, 1, 4], ['bow', 'Bow', 'check', true], ['veil', 'Veil', 'check', false], ['flowers', 'Flowers', 'check', false]],
      draw(p, d, c, x){
        for (let k = 0; k < d.crown; k++) p.rowC(HEAD_TOP - k, k === d.crown - 1 ? 3.6 : 4.4, c.main);
        p.rowC(HEAD_TOP, 4.6, c.accent);
        p.rowC(HEAD_TOP + 1, d.brim, c.main); p.rowC(HEAD_TOP + 2, d.brim - 1, c.shade);
        if (d.bow){ const bx = x.front ? WCX + 3 : WCX - 4; p.disc(bx - 1, HEAD_TOP - 1, 1.2, c.alt); p.disc(bx + 2, HEAD_TOP - 1, 1.2, c.alt); p.put(bx, HEAD_TOP - 1, c.alt_d); p.put(bx + 1, HEAD_TOP - 1, c.alt_d); }
        if (d.flowers) for (const fx of [-3, 0, 3]) { p.put(WCX + fx, HEAD_TOP - 1, c.trim); p.put(WCX + fx, HEAD_TOP - 2, c.accent); }
        // a net veil: sparse enough that the face still shows through
        if (d.veil && x.front) for (let y = HEAD_TOP + 3; y < CHIN - 1; y++) for (let xx = Math.ceil(WCX - 5); xx <= WCX + 5; xx++) if ((xx + y) % 3 === 0 && (y % 2 === 0 || Math.abs(xx - WCX) > 4)) p.put(xx, y, c.deep);
        if (d.veil && !x.front) for (let y = HEAD_TOP + 3; y < SHOULDER + 2; y++) p.rowC(y, 5.5 - (y - HEAD_TOP) * .05, (xx => c.deep));
      } },
    tophat: { label: 'top hat', dials: [['height', 'Height', 4, 11, 1, 7], ['brim', 'Brim', 6, 9.5, .5, 7.5], ['tilt', 'Tilt', -.3, .3, .05, 0], ['ornament', 'Ornament', 'select', ['none', 'feather', 'flower', 'card', 'buckle']]],
      draw(p, d, c, x){
        p.rowC(HEAD_TOP + 1, d.brim, c.main);
        for (let k = 0; k < d.height; k++){ const y = HEAD_TOP - k, hw = k === d.height - 1 ? 4.4 : 3.9; p.rowC(y, hw, c.main, WCX + k * d.tilt); }
        p.rowC(HEAD_TOP - 1, 4, c.accent, WCX + d.tilt);
        const ox = WCX + 3 + d.tilt * 2;
        if (d.ornament === 'feather') for (let k = 0; k < 6; k++) p.put(ox + (k > 3 ? 1 : 0), HEAD_TOP - 2 - k, k % 2 ? c.accent_l : c.alt);
        if (d.ornament === 'flower' && x.front){ p.disc(ox - 1, HEAD_TOP - 2, 1.1, c.alt); p.put(ox - 1, HEAD_TOP - 2, c.trim); }
        if (d.ornament === 'card' && x.front){ for (let y = HEAD_TOP - 5; y < HEAD_TOP - 1; y++){ p.put(ox, y, c.white); p.put(ox + 1, y, c.white); } p.put(ox, HEAD_TOP - 3, c.alt); }
        if (d.ornament === 'buckle' && x.front) for (const dx of [-1, 0, 1]) p.put(WCX + d.tilt + dx, HEAD_TOP - 1, c.metal);
      } },
    hood: { label: 'hood', dials: [['peak', 'Peak', 0, 6, 1, 2], ['drape', 'Over the shoulders', 0, 8, 1, 3], ['edge', 'Edge', 'select', ['plain', 'jagged', 'frill', 'trim']], ['shell', 'Eggshell', 'check', false]],
      draw(p, d, c, x){
        const col = d.shell ? c.trim : c.main, edgeC = d.shell ? c.trim_d : c.accent;
        for (let y = HEAD_TOP - 2 - d.peak; y <= CHIN + 2 + d.drape; y++){
          const top = HEAD_TOP - 2 - d.peak, t = (y - top) / Math.max(1, HEAD_TOP + 2 - top);
          let hw = y < HEAD_TOP + 2 ? Math.max(.6, 6.4 * Math.sin(Math.min(1, t) * Math.PI / 2)) : y <= CHIN + 1 ? 6.4 : 6.4 + (y - CHIN - 1) * .45;
          for (let xx = pyRound(WCX - hw + .5); xx < pyRound(WCX + hw + .5); xx++){
            const inFace = x.front && y >= HEAD_TOP + 2 && y <= CHIN + 1 && Math.abs(xx - WCX) < 4.6 - (y > CHIN - 2 ? (y - CHIN + 2) * .7 : 0);
            const inBody = x.front && y > CHIN + 1 && Math.abs(xx - WCX) < 4.4;
            if (inFace || inBody) continue;
            p.put(xx, y, col);
          }
        }
        // the edge round the face and along the hem
        if (x.front) for (let y = HEAD_TOP + 2; y <= CHIN + 1; y++){
          const hw = 4.6 - (y > CHIN - 2 ? (y - CHIN + 2) * .7 : 0);
          if (d.edge === 'trim' || d.edge === 'frill'){ p.put(WCX - hw - .5, y, edgeC); p.put(WCX + hw + .5, y, edgeC); }
          if (d.edge === 'jagged' && y % 2){ p.put(WCX - hw + .5, y, col); p.put(WCX + hw - .5, y, col); }
        }
        const hem = CHIN + 2 + d.drape, hwh = 6.4 + (hem - CHIN - 1) * .45;
        for (let xx = pyRound(WCX - hwh + .5); xx < pyRound(WCX + hwh + .5); xx++){
          if (d.edge === 'jagged' && xx % 2) p.put(xx, hem + 1, col);
          if (d.edge === 'frill') p.put(xx, hem + 1, xx % 2 ? edgeC : col);
          if (d.edge === 'trim') p.put(xx, hem, edgeC);
        }
        if (d.shell) for (const [dx, dy] of [[-3, -1], [2, 0], [-1, 2], [4, 3]]) p.put(WCX + dx, HEAD_TOP + dy - d.peak, c.trim_d);
      } },
    jester: { label: 'jester cap', dials: [['points', 'Points', 2, 3, 1, 2], ['reach', 'Reach', 3, 8, 1, 6], ['droop', 'Droop', 0, 6, 1, 4], ['bells', 'Bells', 'check', true]],
      draw(p, d, c, x){
        p.rowC(HEAD_TOP, 5, c.accent); p.rowC(HEAD_TOP + 1, 5.2, c.accent);
        for (let y = HEAD_TOP - 3; y < HEAD_TOP; y++) p.rowC(y, 4.6 - (HEAD_TOP - 1 - y) * .4, (xx, yy) => xx < WCX ? c.main : c.alt);
        const tips = d.points === 3 ? [-1, 0, 1] : [-1, 1];
        for (const s of tips){
          const col = s < 0 ? c.main : s > 0 ? c.alt : c.trim, n = d.reach + 3;
          let tx = WCX, ty = HEAD_TOP - 3;
          for (let k = 0; k < n; k++){
            const t = k / n; tx = WCX + s * (2 + t * d.reach) * (s === 0 ? 0 : 1); ty = HEAD_TOP - 3 - (s === 0 ? t * 6 : Math.sin(t * Math.PI) * 4) + t * t * d.droop;
            p.disc(tx, ty, Math.max(.6, 1.8 * (1 - t)), col);
          }
          if (d.bells) p.disc(tx + s, ty + 1, 1, c.metal);
        }
      } },
    crown: { label: 'crown', dials: [['points', 'Points', 3, 5, 1, 3], ['height', 'Height', 2, 5, 1, 3], ['gem', 'Gem', 'check', true]],
      draw(p, d, c, x){
        p.rowC(HEAD_TOP - 1, 4, c.metal); p.rowC(HEAD_TOP, 4, c.metal_d);
        for (let i = 0; i < d.points; i++){ const px = WCX - 3.5 + i * 7 / (d.points - 1); for (let k = 1; k <= d.height; k++) p.put(Math.round(px), HEAD_TOP - 1 - k, c.metal); }
        if (d.gem && x.front) p.put(WCX, HEAD_TOP - 1, c.accent);
      } },
    bow: { label: 'big bow', dials: [['size', 'Size', 2, 4, .5, 3], ['tails', 'Tails', 0, 8, 1, 4]],
      draw(p, d, c, x){
        p.ellipse(WCX - d.size - .5, HEAD_TOP - 1, d.size, d.size * .7, c.alt); p.ellipse(WCX + d.size + .5, HEAD_TOP - 1, d.size, d.size * .7, c.alt);
        p.disc(WCX, HEAD_TOP - 1, 1, c.alt_d);
        for (let k = 1; k <= d.tails; k++){ p.put(WCX - 1 - k * .4, HEAD_TOP - 1 + k, c.alt); p.put(WCX + 1 + k * .4, HEAD_TOP - 1 + k, c.alt); }
      } },
    horns: { label: 'horns', dials: [['length', 'Length', 3, 9, 1, 5], ['curl', 'Curl', 0, 1, .1, .4], ['spread', 'Spread', 2, 5, .5, 3.5]],
      draw(p, d, c, x){
        p.both(s => { let hx = WCX + s * d.spread, hy = HEAD_TOP + 1; for (let k = 0; k < d.length * 2; k++){ const t = k / (d.length * 2), a = -Math.PI / 2 + s * (.5 + t * d.curl * 2.5); hx += Math.cos(a) * .5 * s * s; hy += Math.sin(a) * .5; p.disc(hx, hy, Math.max(.5, 1.3 * (1 - t)), t > .7 ? c.trim : c.alt); } });
      } },
    bonnet: { label: 'bonnet', dials: [['frame', 'Frame', 1, 3, 1, 2], ['ribbon', 'Ribbon tie', 'check', true], ['frill', 'Frill', 'check', true]],
      draw(p, d, c, x){
        for (let y = HEAD_TOP - 2; y <= CHIN - 2; y++){
          const t = (y - HEAD_TOP + 2) / (CHIN - HEAD_TOP), hw = 6.2 + Math.sin(t * Math.PI) * .6;
          for (let xx = pyRound(WCX - hw + .5); xx < pyRound(WCX + hw + .5); xx++){
            const inner = Math.abs(xx - WCX) < hw - d.frame && y > HEAD_TOP - 2 + d.frame;
            if (x.front && inner) continue;
            p.put(xx, y, inner ? c.main : (d.frill && x.front && (xx + y) % 2 ? c.trim : c.main));
          }
        }
        if (d.ribbon && x.front){ for (let y = CHIN - 1; y <= CHIN + 2; y++){ p.put(WCX - 4 + (y - CHIN), y, c.alt); p.put(WCX + 4 - (y - CHIN), y, c.alt); } p.disc(WCX, CHIN + 2, 1, c.alt); }
      } },
  },
  hair: {
    none: { label: 'none', dials: [], draw(){} },
    long: { label: 'long', dials: [['length', 'Length', CHIN, HIP + 2, 1, WAIST], ['volume', 'Volume', 1.6, 3.4, .2, 2.6], ['fringe', 'Fringe', 'check', true], ['wave', 'Waves', 'check', false]], draw: (p, d, c, x) => drawHair(p, d, c, x, {}) },
    bob: { label: 'bob', dials: [['length', 'Length', CHIN - 2, CHIN + 3, 1, CHIN + 1], ['volume', 'Volume', 1.6, 3.2, .2, 2.4], ['fringe', 'Fringe', 'check', true]], draw: (p, d, c, x) => drawHair(p, d, c, x, { bob: true }) },
    buns: { label: 'buns', dials: [['length', 'Length', CHIN - 2, WAIST, 1, CHIN], ['volume', 'Volume', 1.6, 3, .2, 2.2], ['bun', 'Bun size', 1.5, 3, .5, 2], ['fringe', 'Fringe', 'check', true]], draw: (p, d, c, x) => drawHair(p, d, c, x, { buns: true }) },
    twintails: { label: 'twin tails', dials: [['length', 'Length', CHIN, HIP + 4, 1, WAIST + 2], ['volume', 'Volume', 1.6, 3, .2, 2.2], ['ribbons', 'Ribbons', 'check', true], ['fringe', 'Fringe', 'check', true]], draw: (p, d, c, x) => drawHair(p, d, c, x, { tails: true }) },
    braid: { label: 'one braid', dials: [['length', 'Length', WAIST, KNEE, 1, HIP + 2], ['volume', 'Volume', 1.6, 3, .2, 2], ['fringe', 'Fringe', 'check', false]], draw: (p, d, c, x) => drawHair(p, d, c, x, { braid: true }) },
    crop: { label: 'cropped', dials: [['volume', 'Volume', 1, 2.4, .2, 1.6], ['fringe', 'Fringe', 'check', true]], draw: (p, d, c, x) => drawHair(p, { ...d, length: CHIN - 4 }, c, x, { crop: true }) },
  },
  top: {
    bodice: { label: 'bodice', dials: [['sleeve', 'Sleeves', 'select', ['puff', 'long', 'bell', 'short', 'none']], ['collar', 'Collar', 'select', ['none', 'ruff', 'sailor', 'lace', 'high', 'bow']],
        ['waist', 'Waist', 'select', ['none', 'belt', 'sash', 'laces']], ['buttons', 'Buttons', 'check', false], ['patterned', 'In the motif', 'check', true], ['bib', 'Apron bib', 'check', false]],
      draw(p, d, c, x){
        const body = d.patterned ? x.fill('main', 'alt') : c.main, sleeve = d.patterned ? c.alt : c.main;
        for (let y = SHOULDER; y <= WAIST; y++) for (let xx = pyRound(WCX - 3.2); xx < pyRound(WCX + 4.2); xx++) p.put(xx, y, body);
        drawSleeves(p, d.sleeve, sleeve, c);
        if (d.bib && x.front) for (let y = SHOULDER + 2; y <= WAIST; y++) p.rowC(y, 2, c.trim);
        if (d.buttons && x.front) for (let y = SHOULDER + 2; y < WAIST; y += 2) p.put(WCX, y, c.metal);
        if (d.waist === 'belt'){ p.rowC(WAIST, 3.7, c.ink); if (x.front) p.put(WCX, WAIST, c.metal); }
        if (d.waist === 'sash'){ p.rowC(WAIST, 3.7, c.accent); p.rowC(WAIST - 1, 3.7, c.accent); if (!x.front){ p.disc(WCX, WAIST - 1, 1.3, c.accent); } }
        if (d.waist === 'laces' && x.front) for (let y = WAIST - 5; y <= WAIST; y++) p.put(WCX + (y % 2 ? -.5 : .5), y, c.trim);
        drawCollar(p, d.collar, c, x);
      } },
    robe: { label: 'robe', dials: [['sleeve', 'Sleeves', 'select', ['bell', 'long', 'puff']], ['opening', 'Open front', 'check', true], ['collar', 'Collar', 'select', ['none', 'high', 'ruff', 'lace']], ['patterned', 'In the motif', 'check', false]],
      draw(p, d, c, x){
        const body = d.patterned ? x.fill('main', 'alt') : c.main;
        for (let y = SHOULDER; y <= WAIST + 2; y++) p.rowC(y, 3.8 + Math.max(0, y - WAIST) * .5, body);
        drawSleeves(p, d.sleeve, c.main, c);
        if (d.opening && x.front) for (let y = SHOULDER + 1; y <= WAIST + 2; y++){ p.put(WCX - .5, y, c.trim); p.put(WCX + .5, y, c.trim); }
        drawCollar(p, d.collar, c, x);
      } },
    pinafore: { label: 'pinafore', dials: [['sleeve', 'Sleeves', 'select', ['puff', 'short', 'long']], ['pocket', 'Pocket', 'check', true], ['collar', 'Collar', 'select', ['none', 'lace', 'sailor', 'bow']]],
      draw(p, d, c, x){
        for (let y = SHOULDER; y <= WAIST; y++) for (let xx = pyRound(WCX - 3.2); xx < pyRound(WCX + 4.2); xx++) p.put(xx, y, c.alt);
        drawSleeves(p, d.sleeve, c.alt, c);
        if (x.front){ for (let y = SHOULDER + 1; y <= WAIST; y++) p.rowC(y, 2.5, x.fill('trim', 'accent')); p.put(WCX - 2.5, SHOULDER, c.trim); p.put(WCX + 2.5, SHOULDER, c.trim); if (d.pocket){ p.rowC(WAIST - 2, 1.2, c.trim_d); } }
        else { p.put(WCX - 2, SHOULDER + 2, c.trim); p.put(WCX + 2, SHOULDER + 2, c.trim); p.line(WCX - 2, SHOULDER + 2, WCX + 2, WAIST - 1, c.trim); p.line(WCX + 2, SHOULDER + 2, WCX - 2, WAIST - 1, c.trim); }
        drawCollar(p, d.collar, c, x);
      } },
  },
  bottom: {
    none: { label: 'none', dials: [], draw(){} },
    skirt: { label: 'skirt', dials: [['length', 'Length', HIP, KNEE + 3, 1, HIP + 4], ['flare', 'Flare', .3, 1.1, .05, .7], ['tiers', 'Tiers', 1, 3, 1, 1], ['hem', 'Hem', 'select', ['plain', 'lace', 'scallop', 'zigzag', 'trim']],
        ['patterned', 'In the motif', 'check', true], ['apron', 'Apron', 'check', false]],
      draw(p, d, c, x){
        const n = d.length - WAIST + 1, fill = d.patterned ? x.fill('main', 'alt') : c.main;
        for (let y = WAIST; y <= d.length; y++){
          const hw = 3.8 + (y - WAIST) * d.flare, tier = Math.min(d.tiers - 1, Math.floor((y - WAIST) / n * d.tiers));
          const col = d.tiers > 1 && tier % 2 ? c.alt : fill;
          for (let xx = pyRound(WCX - hw + .5); xx < pyRound(WCX + hw + .5); xx++) p.put(xx, y, col);
          if (d.tiers > 1 && y > WAIST && Math.floor((y - WAIST) / n * d.tiers) !== Math.floor((y - 1 - WAIST) / n * d.tiers)) p.rowC(y, hw, c.trim);
        }
        drawHem(p, d.hem, d.length, 3.8 + (d.length - WAIST) * d.flare, c);
        if (d.apron && x.front) for (let y = WAIST + 1; y < d.length; y++) p.rowC(y, 2.2 + (y - WAIST) * .15, c.trim);
      } },
    bell: { label: 'layered bell', dials: [['layers', 'Layers', 2, 4, 1, 3], ['length', 'Length', HIP + 2, KNEE + 2, 1, KNEE], ['puff', 'Puff', .6, 1.4, .1, 1], ['hem', 'Hem', 'select', ['lace', 'trim', 'scallop', 'plain']]],
      draw(p, d, c, x){
        const n = d.length - WAIST;
        for (let y = WAIST; y <= d.length; y++){
          const t = (y - WAIST) / n, layer = Math.min(d.layers - 1, Math.floor(t * d.layers)), lt = t * d.layers - layer;
          const hw = 4 + layer * 1.6 * d.puff + Math.sin(lt * Math.PI * .8) * 1.4 * d.puff;
          p.rowC(y, hw, layer % 2 ? c.alt : x.fill('main', 'alt'));
          if (lt > .85) p.rowC(y, hw, c.trim);
        }
        drawHem(p, d.hem, d.length, 4 + (d.layers - 1) * 1.6 * d.puff + 1.2, c);
      } },
    // the bottom slot hangs from the hips and doesn't walk, so it stops short of the legs
    bloomers: { label: 'bloomers', dials: [['length', 'Length', HIP, HIP + 3, 1, HIP + 2], ['frill', 'Frill', 'check', true]],
      draw(p, d, c, x){
        for (let y = WAIST; y <= d.length; y++){ const hw = 4 + Math.sin((y - WAIST) / (d.length - WAIST) * Math.PI) * 1.5; p.rowC(y, hw, y > HIP ? (xx => Math.abs(xx - WCX) < 1 ? null : c.main) : c.main); }
        if (d.frill) for (let xx = Math.ceil(WCX - 5); xx <= WCX + 5; xx++) if (Math.abs(xx - WCX) > 1) p.put(xx, d.length + 1, xx % 2 ? c.trim : c.white);
      } },
    // just the seat: the trouser legs are a legs part, so they walk with her
    trousers: { label: 'trousers (seat)', dials: [['patterned', 'In the motif', 'check', false], ['belt', 'Belt', 'check', false]],
      draw(p, d, c, x){
        const col = d.patterned ? x.fill('main', 'alt') : c.main;
        for (let y = WAIST; y <= HIP; y++) p.rowC(y, 3.8, col);
        if (d.belt){ p.rowC(WAIST, 3.8, c.ink); if (x.front) p.put(WCX, WAIST, c.metal); }
      } },
  },
  // drawn over the ends of the legs, on both feet, each foot three pixels wide. Seen from the front a
  // shoe's toe comes straight at you, so nothing sticks out sideways: the toe is built forward in 3D
  // by forward(d) — how far the sole rows reach out in front, whether it narrows to a point, how much
  // it curls up at the tip — the same way here and in game/witch.gd ("shoe" in the outfit file).
  shoes: {
    none: { label: 'none', dials: [], draw(){} },
    ankleboots: { label: 'ankle boots', dials: [['height', 'Height', 2, 6, 1, 3], ['colour', 'Colour', 'select', ['shoe', 'main', 'alt', 'accent', 'ink']], ['laces', 'Laces', 'check', true], ['cuff', 'Cuff', 'check', false], ['toe', 'Toe length', 1, 4, 1, 2]],
      forward: d => ({ toe: d.toe, rows: 2 }),
      draw(p, d, c, x){ feet((x0, x1) => {
        for (let y = WH - d.height; y < WH - 1; y++) p.span(y, x0, x1, c[d.colour]);
        if (d.cuff) p.span(WH - d.height, x0, x1, c.trim);
        if (d.laces && x.front) for (let y = WH - d.height + 1; y < WH - 1; y += 2) p.put(x0 + 1, y, c.trim);
        p.span(WH - 1, x0, x1, c.ink); }); } },
    maryjanes: { label: 'Mary Janes', dials: [['colour', 'Colour', 'select', ['shoe', 'alt', 'accent', 'main', 'ink']], ['strap', 'Strap', 'check', true], ['bow', 'Bow', 'check', false], ['socks', 'Frilled socks', 'check', false], ['toe', 'Toe length', 1, 3, 1, 2]],
      forward: d => ({ toe: d.toe, rows: 2 }),
      draw(p, d, c, x){ feet((x0, x1) => {
        if (d.socks) for (let y = WH - 4; y < WH - 2; y++) p.span(y, x0, x1, y === WH - 4 ? c.white : c.trim);
        for (let y = WH - 2; y < WH; y++) p.span(y, x0, x1, c[d.colour]);
        if (d.strap && x.front) p.span(WH - 3, x0, x1, c[d.colour]);
        // the bow sits on top of the foot, at the front
        if (d.bow && x.front){ p.put(x0, WH - 3, c.accent); p.put(x0 + 2, WH - 3, c.accent); p.put(x0 + 1, WH - 2, c.accent); } }); } },
    pointed: { label: 'curled points', dials: [['colour', 'Colour', 'select', ['alt', 'main', 'shoe', 'accent', 'ink']], ['toe', 'Toe length', 2, 6, 1, 4], ['curl', 'Curl', 0, 4, 1, 2], ['bells', 'Bells', 'check', true], ['height', 'Height', 1, 3, 1, 2]],
      forward: (d, c) => ({ toe: d.toe, rows: Math.min(2, d.height), taper: true, curl: d.curl, tip: d.bells ? c.metal : null }),
      draw(p, d, c, x){ feet((x0, x1) => {
        for (let y = WH - d.height; y < WH; y++) p.span(y, x0, x1, c[d.colour]);
        // seen from the front, the curled tip rises over the middle of the toe
        if (x.front) for (let k = 1; k <= Math.min(d.curl, 2); k++) p.put(x0 + 1, WH - d.height - k, c[d.colour]);
        if (x.front && d.bells && d.curl > 0) p.put(x0 + 1, WH - d.height - Math.min(d.curl, 2) - 1, c.metal); }); } },
    platforms: { label: 'platforms', dials: [['sole', 'Sole', 1, 4, 1, 2], ['colour', 'Colour', 'select', ['shoe', 'accent', 'alt', 'main', 'ink']], ['sole_colour', 'Sole colour', 'select', ['ink', 'trim', 'white', 'accent']], ['bow', 'Bow', 'check', false], ['toe', 'Toe length', 1, 3, 1, 2]],
      forward: d => ({ toe: d.toe, rows: d.sole + 1 }),
      draw(p, d, c, x){ feet((x0, x1) => {
        const top = WH - d.sole - 2;
        for (let y = top; y < WH - d.sole; y++) p.span(y, x0, x1, c[d.colour]);
        for (let y = WH - d.sole; y < WH; y++) p.span(y, x0, x1, c[d.sole_colour]);
        if (d.bow && x.front){ p.put(x0 + 1, top - 1, c.accent); p.put(x0, top, c.accent); p.put(x0 + 2, top, c.accent); } }); } },
    clogs: { label: 'clogs', dials: [['colour', 'Colour', 'select', ['trim_d', 'shoe', 'alt', 'main']], ['painted', 'Painted band', 'check', true], ['toe', 'Toe length', 2, 4, 1, 3]],
      forward: d => ({ toe: d.toe, rows: 3 }),
      draw(p, d, c, x){ feet((x0, x1) => {
        for (let y = WH - 3; y < WH; y++) p.span(y, x0, x1, c[d.colour]);
        if (d.painted && x.front) p.span(WH - 2, x0, x1, c.accent); }); } },
    slippers: { label: 'slippers', dials: [['colour', 'Colour', 'select', ['alt', 'trim', 'accent', 'main']], ['pom', 'Pom-poms', 'check', true], ['toe', 'Toe length', 1, 3, 1, 2]],
      forward: d => ({ toe: d.toe, rows: 2 }),
      draw(p, d, c, x){ feet((x0, x1) => {
        for (let y = WH - 2; y < WH; y++) p.span(y, x0, x1, c[d.colour]);
        if (d.pom && x.front) p.put(x0 + 1, WH - 3, c.white); }); } },
  },
  legs: {
    trousers: { label: 'trouser legs', dials: [['colour', 'Colour', 'select', ['main', 'alt', 'motif', 'ink']], ['cuff', 'Cuffs', 'check', true], ['flare', 'Flared', 'check', false], ['boot', 'Shoe height', 1, 3, 1, 1]],
      draw(p, d, c, x){
        const col = d.colour === 'motif' ? x.fill('main', 'alt') : c[d.colour] || c.main;
        const hem = x.shoes ? WH - 1 : ANKLE - d.boot;
        for (let y = HIP + 1; y < hem; y++){ const f = d.flare && y > KNEE ? .5 : 0; p.span(y, WCX - 3.5 - f, WCX - .5, col); p.span(y, WCX + 1.5, WCX + 4.5 + f, col); }
        if (d.cuff){ const f = d.flare ? .5 : 0; p.span(hem - 1, WCX - 3.5 - f, WCX - .5, c.trim); p.span(hem - 1, WCX + 1.5, WCX + 4.5 + f, c.trim); }
        if (!x.shoes) drawShoes(p, d.boot, c, false, false);
      } },
    stockings: { label: 'stockings', dials: [['pattern', 'Pattern', 'select', ['stripes', 'plain', 'motif', 'diamonds']], ['colour', 'Colour', 'select', ['alt', 'main', 'trim', 'ink', 'accent']],
        ['boot', 'Boot height', 1, 7, 1, 2], ['toe', 'Curled toes', 'check', false], ['heel', 'Platform', 'check', false], ['garter', 'Frill at the top', 'check', false]],
      draw(p, d, c, x){
        const base = c[d.colour] || c.alt, other = d.colour === 'trim' ? c.alt : c.trim;
        // a plain motif is just a colour, not a function
        const mf = x.fill(d.colour, d.colour === 'alt' ? 'trim' : 'alt'), motifAt = (xx, y) => typeof mf === 'function' ? mf(xx, y) : mf;
        const at = (xx, y) => d.pattern === 'stripes' ? (y % 2 ? base : other) : d.pattern === 'motif' ? motifAt(xx, y) : d.pattern === 'diamonds' ? ((xx + y) % 3 === 0 ? other : base) : base;
        for (let y = HIP + 2; y < ANKLE; y++){ p.span(y, WCX - 3, WCX - .5, at); p.span(y, WCX + 1.5, WCX + 4, at); }
        // under a shoes part they cover the feet too, which are a pixel wider than the legs
        if (x.shoes) for (let y = ANKLE; y < WH; y++) feet((x0, x1) => p.span(y, x0, x1, at));
        if (d.garter) for (const xx of [WCX - 3, WCX - 2, WCX - 1, WCX + 2, WCX + 3, WCX + 4]) p.put(xx, HIP + 2, (xx % 2) ? c.white : other);
        if (!x.shoes) drawShoes(p, d.boot, c, d.toe, d.heel);
      } },
    bare: { label: 'bare legs, shoes', dials: [['boot', 'Shoe height', 1, 3, 1, 1], ['socks', 'Socks', 'check', true], ['strap', 'Strap', 'check', true]],
      draw(p, d, c, x){
        if (d.socks) for (let y = ANKLE - 3; y < ANKLE; y++){ p.span(y, WCX - 3, WCX - .5, c.white); p.span(y, WCX + 1.5, WCX + 4, c.white); }
        if (!x.shoes) drawShoes(p, d.boot, c, false, false);
        if (d.strap && x.front){ p.span(ANKLE, WCX - 3, WCX - .5, c.ink); p.span(ANKLE, WCX + 1.5, WCX + 4, c.ink); }
      } },
    boots: { label: 'tall boots', dials: [['height', 'Height', 4, 12, 1, 8], ['laces', 'Laces', 'check', true], ['cuff', 'Cuff', 'check', false]],
      draw(p, d, c, x){
        for (let y = ANKLE - d.height; y < WH; y++){ const w = y >= ANKLE ? .5 : 0; p.span(y, WCX - 3 - w, WCX - .5, c.shoe); p.span(y, WCX + 1.5, WCX + 4 + w, c.shoe); }
        if (d.laces && x.front) for (let y = ANKLE - d.height + 1; y < ANKLE; y += 2){ p.put(WCX - 2, y, c.trim); p.put(WCX + 2, y, c.trim); }
        if (d.cuff){ p.span(ANKLE - d.height, WCX - 3.5, WCX - .5, c.trim); p.span(ANKLE - d.height, WCX + 1.5, WCX + 4.5, c.trim); }
      } },
  },
  back: {
    none: { label: 'none', dials: [], draw(){} },
    cape: { label: 'cape', dials: [['length', 'Length', WAIST, ANKLE - 1, 1, KNEE], ['flare', 'Flare', .1, .5, .05, .25], ['collar', 'High collar', 'check', false], ['lining', 'Lining in the motif', 'check', true], ['hem', 'Hem', 'select', ['plain', 'zigzag', 'scallop', 'tatters']]],
      draw(p, d, c, x){
        const fill = !x.front || !d.lining ? c.main : x.fill('alt', 'trim');
        for (let y = SHOULDER - 1; y <= d.length; y++){ const hw = 5.4 + (y - SHOULDER) * d.flare; p.rowC(y, hw, x.front ? fill : c.main); }
        if (d.collar) for (let y = CHIN - 3; y < SHOULDER; y++) p.rowC(y, 6.5 - (y - CHIN + 3) * .3, x.front ? c.alt : c.main);
        const hw = 5.4 + (d.length - SHOULDER) * d.flare;
        if (d.hem === 'zigzag') for (let xx = Math.ceil(WCX - hw); xx <= WCX + hw; xx++) if (xx % 2) p.put(xx, d.length + 1, c.main);
        if (d.hem === 'scallop') for (let xx = Math.ceil(WCX - hw); xx <= WCX + hw; xx++) if (xx % 3) p.put(xx, d.length + 1, c.main);
        if (d.hem === 'tatters') for (let xx = Math.ceil(WCX - hw); xx <= WCX + hw; xx++){ const k = hash32(xx * 7) % 4; for (let j = 0; j < k; j++) p.put(xx, d.length + 1 + j, c.main); }
      } },
    wings: { label: 'wings', dials: [['shape', 'Shape', 'select', ['bat', 'moth', 'bee', 'feather']], ['span', 'Span', 8, 13.5, .5, 12], ['height', 'Height', 8, 18, 1, 12], ['spots', 'Eyespots', 'check', true]],
      draw(p, d, c, x){
        const top = SHOULDER - 3, bot = top + d.height;
        p.both(s => {
          for (let y = top; y <= bot; y++){
            const t = (y - top) / (bot - top);
            let reach = d.shape === 'bat' ? d.span * (1 - t * .55) - (Math.floor(y / 3) % 2 ? 1 : 0) * (t > .2 ? 1 : 0)
              : d.shape === 'moth' ? d.span * Math.sin(Math.min(1, (t + .15)) * Math.PI) * (t < .55 ? 1 : .8)
              : d.shape === 'bee' ? d.span * Math.sin(t * Math.PI) * .85
              : d.span * (1 - t) + 1;
            for (let k = 2; k <= reach; k++){
              const xx = WCX + s * k;
              const col = d.shape === 'bee' ? (k === Math.floor(reach) || y === top ? c.trim : c.glass) : d.shape === 'feather' ? ((k + y) % 3 ? c.white : c.trim) : (k >= reach - 1 ? c.deep : c.main);
              p.put(xx, y, col);
            }
          }
          if (d.spots && (d.shape === 'moth' || d.shape === 'bat')){ const sy = top + Math.round(d.height * .35), sx = WCX + s * d.span * .55; p.disc(sx, sy, 1.4, c.accent); p.put(sx, sy, c.ink); }
        });
      } },
    bow: { label: 'big bow', dials: [['size', 'Size', 2.5, 5, .5, 3.5], ['tails', 'Tails', 4, 14, 1, 8]],
      draw(p, d, c, x){
        const y = WAIST - 1;
        p.ellipse(WCX - d.size - 1, y, d.size, d.size * .7, c.alt); p.ellipse(WCX + d.size + 1, y, d.size, d.size * .7, c.alt); p.disc(WCX, y, 1.2, c.alt_d);
        for (let k = 1; k <= d.tails; k++){ p.put(WCX - 1 - k * .3, y + k, c.alt); p.put(WCX + 1 + k * .3, y + k, c.alt); }
      } },
    ribbons: { label: 'ribbons', dials: [['length', 'Length', KNEE - 6, ANKLE, 1, KNEE], ['count', 'How many', 2, 4, 1, 2]],
      draw(p, d, c, x){ for (let i = 0; i < d.count; i++){ const bx = WCX - 3 + i * 6 / Math.max(1, d.count - 1); for (let y = SHOULDER; y < d.length; y++) p.put(bx + Math.sin(y * .5 + i) * 1.2, y, i % 2 ? c.alt : c.accent); } } },
  },
  // Everything in her hand is gripped at the hand joint, at the end of her arm, and drawn standing up.
  // Things that hang (a lantern by its bail, a hand bell under its handle) hang below the grip; things
  // that stand rise from it. How the hand turns it at rest and when she aims is in HAND_SHOTS.
  hand: {
    none: { label: 'none', dials: [], draw(){} },
    staff: { label: 'staff', dials: [['length', 'Length', 16, 34, 1, 26], ['orb', 'Orb', 1, 3.5, .5, 2], ['cradle', 'Cradle', 'check', true]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 6 - d.length; p.line(hx, HAND_Y + 6, hx, top + d.orb, c.trim_d); if (d.cradle){ p.put(hx - 1, top + d.orb * 1.5, c.metal); p.put(hx + 1, top + d.orb * 1.5, c.metal); } p.disc(hx, top, d.orb, c.accent); p.put(hx - .5, top - .5, c.accent_l); } },
    wand: { label: 'wand', dials: [['length', 'Length', 5, 11, 1, 8], ['tip', 'Tip', 'select', ['star', 'heart', 'moon', 'gem', 'plain']]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 1 - d.length; p.line(hx, HAND_Y + 1, hx, top + 1, c.ink);
        if (d.tip === 'star') for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) p.put(hx + dx, top + dy, c.flame);
        if (d.tip === 'heart') for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) p.put(hx + dx, top + dy, c.accent);
        if (d.tip === 'moon') for (const [dx, dy] of [[0, -1], [-1, 0], [-1, 1], [0, 2]]) p.put(hx + dx, top + dy - 1, c.white);
        if (d.tip === 'gem') p.disc(hx, top, 1, c.glass); } },
    // hangs from her hand by its bail; on a pole, it hangs from a crook at the top, out from the pole
    lantern: { label: 'lantern', dials: [['size', 'Size', 2, 4, 1, 3], ['pole', 'Pole', 0, 14, 1, 0]],
      draw(p, d, c, x){
        const hx = heldX(x.side), out = x.front ? 1 : -1;
        let bx = hx, by = HAND_Y + 1;
        if (d.pole){ const top = HAND_Y - d.pole; p.line(hx, HAND_Y + 3, hx, top, c.trim_d); p.line(hx, top, hx + out * 2, top, c.trim_d); bx = hx + out * 2; by = top + 1; }
        p.put(bx, by, c.ink); p.put(bx, by + 1, c.ink);
        lanternBox(p, bx, by + 2, d.size, c); } },
    candle: { label: 'candle', dials: [['height', 'Height', 3, 9, 1, 5], ['dish', 'Dish', 'check', true]],
      draw(p, d, c, x){ const hx = heldX(x.side); if (d.dish) p.rowC(HAND_Y - 1, 2, c.metal, hx); for (let y = HAND_Y - 1 - d.height; y < HAND_Y - 1; y++) p.put(hx, y, c.white); p.put(hx, HAND_Y - d.height - 2, c.ink); p.put(hx, HAND_Y - d.height - 3, c.flame_d); p.put(hx, HAND_Y - d.height - 4, c.flame); } },
    dropper: { label: 'dropper', dials: [['length', 'Length', 5, 10, 1, 7], ['bulb', 'Bulb', 1, 2, .5, 1.5]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 2 - d.length; for (let y = top + 1; y < HAND_Y + 2; y++) p.put(hx, y, y > HAND_Y - 2 ? c.accent : c.glass); p.disc(hx, top, d.bulb, c.alt); } },
    parasol: { label: 'parasol', dials: [['size', 'Canopy', 4, 8, 1, 6], ['shaft', 'Shaft', 8, 18, 1, 12], ['frill', 'Frill', 'check', true]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 2 - d.shaft; p.line(hx, HAND_Y + 3, hx, top, c.ink);
        for (let k = 0; k < Math.ceil(d.size * .6); k++) p.rowC(top + k, d.size * Math.sin((k + 1) / Math.ceil(d.size * .6) * Math.PI / 2) * .55, x.fill('alt', 'trim'), hx);
        if (d.frill) for (let xx = Math.ceil(hx - d.size * .55); xx <= hx + d.size * .55; xx++) if (xx % 2) p.put(xx, top + Math.ceil(d.size * .6), c.trim); } },
    scythe: { label: 'scythe', dials: [['length', 'Length', 18, 32, 1, 26], ['blade', 'Blade', 3, 8, 1, 5]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 6 - d.length, dir = x.front ? -1 : 1; p.line(hx, HAND_Y + 6, hx, top, c.trim_d); for (let k = 0; k <= d.blade; k++) p.put(hx + dir * k, top + Math.round(k * k / d.blade * .6), c.white); } },
    lolly: { label: 'lollipop', dials: [['size', 'Size', 2, 4, .5, 3], ['stick', 'Stick', 6, 16, 1, 10]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 2 - d.stick; p.line(hx, HAND_Y + 2, hx, top, c.white); p.disc(hx, top, d.size, (xx, yy) => (Math.round(Math.atan2(yy - top, xx - hx) * 2 + Math.hypot(xx - hx, yy - top)) % 2) ? c.accent : c.trim); } },
    lens: { label: 'magnifying lens', dials: [['size', 'Lens', 2, 4, .5, 3], ['handle', 'Handle', 3, 8, 1, 5]],
      draw(p, d, c, x){ const hx = heldX(x.side), cy = HAND_Y - d.handle - d.size; p.line(hx, HAND_Y + 1, hx, cy + d.size, c.ink); p.disc(hx, cy, d.size + .6, c.metal); p.disc(hx, cy, d.size - .4, c.glass); } },
    // a hand bell: the handle in her hand, the bell hanging below it
    bell: { label: 'hand bell', dials: [['size', 'Size', 2, 4, .5, 3]],
      draw(p, d, c, x){ const hx = heldX(x.side); p.line(hx, HAND_Y - 1, hx, HAND_Y + 2, c.trim_d); for (let k = 0; k < d.size * 2; k++) p.rowC(HAND_Y + 2 + k, Math.max(.6, .6 + k * .35), c.metal, hx); p.put(hx, HAND_Y + 2 + d.size * 2, c.metal_d); } },
    // carried by its spine, hanging at her side
    book: { label: 'grimoire', dials: [['size', 'Size', 3, 5, 1, 4], ['clasp', 'Clasp', 'check', true]],
      draw(p, d, c, x){ const hx = heldX(x.side), out = x.front ? 1 : -1;
        for (let y = HAND_Y; y <= HAND_Y + d.size + 1; y++) for (let k = 0; k < d.size; k++) p.put(hx + out * k, y, k === 0 ? c.trim : c.alt_d);
        if (d.clasp) p.put(hx + out * (d.size - 1), HAND_Y + Math.ceil(d.size / 2), c.metal); } },
    bone: { label: 'bone club', dials: [['length', 'Length', 6, 14, 1, 9]],
      draw(p, d, c, x){ const hx = heldX(x.side), top = HAND_Y + 2 - d.length; p.line(hx, HAND_Y + 2, hx, top, c.white); p.disc(hx - 1, top, 1, c.white); p.disc(hx + 1, top, 1, c.white); } },
  },
};
function lanternBox(p, cx, y0, size, c){
  const hw = size * .7, h = size * 2;
  p.rowC(y0, hw, c.metal_d, cx);
  for (let y = y0 + 1; y < y0 + h; y++) p.rowC(y, hw, (xx) => Math.abs(xx + .5 - cx - .5) < hw - .6 ? c.flame : c.metal_d, cx);
  p.rowC(y0 + h, hw, c.metal_d, cx);
}
// what she holds -> how it shoots, as the outfit file's "wand". The last two numbers are how the hand
// turns the item (degrees, forward from upright), as game/witch.gd reads them:
//   "hold", when she aims: her arm rises 83 degrees, so 83 keeps a thing upright (a lantern still
//   hangs, a candle still stands), 180 points it at the target like a wand, 108 holds a long staff
//   angled up with its head forward;
//   "rest", the rest of the time: 0 carries it upright at her side, 70 holds a wand out in front of
//   her, pointing forward and a little up.
const HAND_SHOTS = { staff: ['orb', 'staff', .8, 1, 2.5, 108, 0], wand: ['star', 'wand', 1.2, 1.1, 1.8, 180, 70], lantern: ['orb', 'lantern', 1, .9, 2.2, 83, 0], candle: ['orb', 'candle', 1.1, 1, 2, 83, 0],
  dropper: ['needle', 'dropper', 1.4, 1.2, 1.8, 180, 70], parasol: ['orb', 'parasol', .9, 1, 2.4, 83, 0], scythe: ['needle', 'scythe', .7, 1.3, 1.5, 108, 0], lolly: ['star', 'lollipop', 1.2, 1, 2, 180, 0],
  lens: ['needle', 'lens', 1, 1.4, 2.6, 83, 0], bell: ['orb', 'bell', .8, .8, 2, 83, 0], book: ['star', 'grimoire', 1, 1, 2.2, 83, 0], bone: ['orb', 'bone', .9, 1, 2, 180, 0] };

/* ---------- grips: how her hand holds each item ----------
   grip: where the item sits from the hand joint (voxels, x y z); rest and aim: how the hand turns
   (degrees, x y z, as Godot's Node3D.rotation) the rest of the time and when she casts; plumb: keep it
   level as her arm swings. The table is art/witch/grips.json: "kinds" for the items made here, "styles"
   for the game's outfits by name. Edited on the Grips page or in Blender; game/witch.gd reads the
   outfit's own copy (saved with it) or the table's "styles". */
const GRIP_DEFAULTS = Object.fromEntries(Object.entries(HAND_SHOTS).map(([k, v]) => [k, { grip: [0, 0, 0], aim_grip: [0, 0, 0], rest: [v[6], 0, 0], aim: [v[5], 0, 0], plumb: v[5] === 83 }]));
// aim_grip: where the item sits while she aims; a grip without one keeps its rest place
// arm and arml: how her wand arm and her other arm hang at rest (degrees); the defaults are how they always have
const ARM_REST = [0, 0, 6.9], ARML_REST = [0, 0, -6.9];
const copyGrip = g => g && { grip: [...(g.grip || [0, 0, 0])], aim_grip: [...(g.aim_grip || g.grip || [0, 0, 0])], rest: [...(g.rest || [0, 0, 0])], aim: [...(g.aim || [180, 0, 0])], plumb: !!g.plumb,
  arm: [...(g.arm || ARM_REST)], arml: [...(g.arml || ARML_REST)] };
function gripOfKind(kind){ return copyGrip((S.grips && S.grips.kinds && S.grips.kinds[kind]) || GRIP_DEFAULTS[kind]); }
function gripOfStyle(name){ return copyGrip(S.grips && S.grips.styles && S.grips.styles[name]); }
function gripFor(D){
  const h = D.parts.hand; if (!h || h.kind === 'none') return null;
  if (h.kind !== 'drawn') return gripOfKind(h.kind);
  // a hand drawn by hand: its outfit's entry in the table, else the grip it was saved with
  return gripOfStyle(D.replace || D.name) || copyGrip(D.wand && D.wand.grip) || null;
}

function drawSleeves(p, kind, col, c){
  const arms = [WCX - 5, WCX + 5];
  if (kind === 'none') return;
  const to = kind === 'short' ? SHOULDER + 3 : kind === 'puff' ? SHOULDER + 5 : WAIST + 2;
  for (let y = SHOULDER; y < to; y++) for (const ax of arms){
    p.put(ax, y, col);
    if (kind === 'puff' && y < SHOULDER + 3) p.put(ax + (ax < WCX ? -1 : 1), y, col);
    if (kind === 'bell' && y > WAIST - 2) p.put(ax + (ax < WCX ? -1 : 1), y, col);
  }
  if (kind === 'bell' || kind === 'long') for (const ax of arms) p.put(ax, to - 1, c.trim);
}
function drawCollar(p, kind, c, x){
  if (kind === 'ruff') for (let y = SHOULDER - 1; y <= SHOULDER + 1; y++) for (let xx = Math.ceil(WCX - 5); xx <= WCX + 5; xx++) if ((xx + y) % 2 === 0 || y === SHOULDER) p.put(xx, y, c.white);
  if (kind === 'lace') for (let xx = Math.ceil(WCX - 4); xx <= WCX + 4; xx++) p.put(xx, SHOULDER, xx % 2 ? c.white : c.trim);
  if (kind === 'high') for (let y = CHIN + 1; y < SHOULDER; y++) p.rowC(y, 2, c.main);
  if (kind === 'bow' && x.front){ p.put(WCX - 1, SHOULDER, c.accent); p.put(WCX + 1, SHOULDER, c.accent); p.put(WCX, SHOULDER, c.accent); p.put(WCX - 1, SHOULDER + 1, c.accent); p.put(WCX + 1, SHOULDER + 1, c.accent); }
  if (kind === 'sailor'){
    if (x.front) for (let k = 0; k < 5; k++){ p.put(WCX - 3 + k * .6, SHOULDER + k, c.trim); p.put(WCX + 3 - k * .6, SHOULDER + k, c.trim); }
    else for (let y = SHOULDER; y < SHOULDER + 5; y++) p.rowC(y, 3.5, y === SHOULDER + 4 ? c.trim : c.alt);
  }
}
function drawHem(p, kind, y, hw, c){
  for (let xx = pyRound(WCX - hw + .5); xx < pyRound(WCX + hw + .5); xx++){
    if (kind === 'lace'){ p.put(xx, y + 1, xx % 2 ? c.white : c.trim); }
    if (kind === 'trim') p.put(xx, y, c.trim);
    if (kind === 'scallop' && (xx % 3)) p.put(xx, y + 1, c.trim);
    if (kind === 'zigzag' && xx % 2) p.put(xx, y + 1, c.main);
  }
}
// each foot, as a span x0 to x1 (exclusive) and its side: -1 the left of the picture, 1 the right
function feet(fn){ fn(WCX - 3.5, WCX - .5, -1); fn(WCX + 1.5, WCX + 4.5, 1); }
function drawShoes(p, boot, c, toe, heel){
  for (let y = ANKLE - boot; y < WH; y++){ p.span(y, WCX - 3.5, WCX - .5, c.shoe); p.span(y, WCX + 1.5, WCX + 4.5, c.shoe); }
  if (toe){ p.put(WCX - 4, WH - 2, c.shoe); p.put(WCX + 5, WH - 2, c.shoe); p.put(WCX - 5, WH - 3, c.shoe); p.put(WCX + 6, WH - 3, c.shoe); }
  if (heel){ p.span(WH - 1, WCX - 3.5, WCX - .5, c.ink); p.span(WH - 1, WCX + 1.5, WCX + 4.5, c.ink); }
}
// hair, as the game's styles draw it: a crown wider than the skull, locks framing the face, the full fall behind
function drawHair(p, d, c, x, o){
  const col = c.hair, dark = c.hair_d, light = c.hair_l, v = d.volume;
  for (let y = HEAD_TOP - 2; y < HEAD_TOP + 6; y++){ const t = (y - (HEAD_TOP - 2)) / 8; p.rowC(y, 4 + v * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2), col); p.put(WCX - 2 + (((y % 3) + 3) % 3), y, y < HEAD_TOP + 2 ? light : col); }
  const length = o.bob || o.crop ? d.length : o.buns || o.tails || o.braid ? Math.min(d.length, CHIN + 1) : d.length;
  for (let y = HEAD_TOP + 6; y <= length; y++){
    const hw = 4 + v - Math.max(0, y - CHIN - 2) * .15 + (d.wave ? Math.sin(y * .7) * .5 : 0);
    for (let xx = pyRound(WCX - hw + .5); xx < pyRound(WCX + hw + .5); xx++){
      if (!x.front) p.put(xx, y, (xx + y * 2) % 7 === 0 ? dark : col);
      else if ((Math.abs(xx - WCX) >= 4.6 || y >= CHIN + 2) && (Math.abs(xx - WCX) >= 3.6 || y < CHIN + 2)) p.put(xx, y, Math.abs(xx - WCX) < hw - 1 ? col : dark);
    }
  }
  if (x.front && d.fringe) for (let xx = Math.trunc(WCX - 5); xx < Math.trunc(WCX + 6); xx++) for (let y = HEAD_TOP + 5; y < HEAD_TOP + 7 + (xx % 3 === 0 ? 1 : 0); y++) p.put(xx, y, col);
  if (o.buns) for (const bx of [WCX - 6, WCX + 6]){ p.disc(bx, HEAD_TOP - 2, d.bun, col); p.put(bx, HEAD_TOP - 3, light); }
  if (o.tails) for (const bx of [WCX - 6.5, WCX + 6.5]){ for (let y = HEAD_TOP + 2; y < d.length; y++) p.disc(bx + (bx > WCX ? 1 : -1) * Math.min(1, (y - HEAD_TOP) / 10), y, y > d.length - 3 ? .6 : 1, y % 4 ? col : dark); if (d.ribbons){ p.put(bx - 1, HEAD_TOP + 2, c.accent); p.put(bx + 1, HEAD_TOP + 2, c.accent); p.put(bx, HEAD_TOP + 2, c.accent); } }
  if (o.braid && !x.front) for (let y = CHIN; y < d.length; y++){ p.put(WCX - .5 + (y % 2 ? 1 : 0), y, col); p.put(WCX + .5 - (y % 2 ? 1 : 0), y, dark); }
  if (o.braid && !x.front) p.put(WCX, d.length, c.accent);
}

/* ---------- briefs: an outfit with a purpose ----------
   Each slot lists the kinds that suit, with the dial ranges that keep it in character. */
const WITCH_BRIEFS = {
  mourner: { label: 'Mourner', theme: 'crypt', note: 'widow\'s weeds for a crypt wake: veil, high collar, a long cape', motifs: ['plain', 'lace', 'pinstripe'],
    prefer: { tone: 'dark' },
    slots: { hat: [['wide', { veil: true, bow: [true, false], crown: [3, 5] }], ['hood', { edge: ['frill', 'trim'], drape: [2, 5] }]], hair: [['long', { length: [WAIST, HIP + 2] }], ['braid', {}]],
      top: [['bodice', { collar: ['high', 'ruff', 'lace'], sleeve: ['long', 'bell'], patterned: false }], ['robe', { collar: ['high', 'lace'] }]],
      bottom: [['bell', { hem: ['lace', 'trim'] }], ['skirt', { length: [KNEE, KNEE + 3], hem: ['lace', 'scallop'] }]], legs: [['boots', {}], ['stockings', { pattern: ['plain'], colour: ['ink', 'main'] }]],
      back: [['cape', { length: [KNEE, ANKLE - 1], hem: ['tatters', 'plain'] }], ['none', {}]], hand: [['candle', {}], ['lantern', {}], ['scythe', {}]] } },
  ringmaster: { label: 'Ringmaster', theme: 'crypt', prefer: { tone: 'bright' }, note: 'a showman for the dead: top hat, harlequin coat, a cane that sparks', motifs: ['harlequin', 'stripes', 'checks'],
    slots: { hat: [['tophat', { height: [6, 10], ornament: ['feather', 'card'] }], ['jester', { bells: true }]], hair: [['bob', {}], ['crop', {}], ['twintails', {}]],
      top: [['robe', { collar: ['ruff'], patterned: true }], ['bodice', { collar: ['ruff'], waist: ['belt', 'sash'], patterned: true, buttons: true }]],
      bottom: [['trousers', { patterned: [true, false] }], ['skirt', { tiers: [2, 3], hem: ['zigzag', 'trim'] }], ['bloomers', {}]],
      legs: [['stockings', { pattern: ['stripes', 'diamonds'], toe: true }], ['boots', { cuff: true }]], back: [['cape', { lining: true, collar: true, length: [WAIST + 4, KNEE] }], ['none', {}]], hand: [['wand', { tip: ['star'] }], ['staff', { orb: [1.5, 2.5] }]] } },
  lamplighter: { label: 'Lamplighter', theme: 'crypt', note: 'keeps the crypt\'s candles lit: hood, apron, a long pole lantern', motifs: ['plain', 'pinstripe', 'checks'],
    slots: { hat: [['hood', { edge: ['plain', 'trim'], peak: [2, 5] }], ['pointed', { droop: true, ornament: ['buckle', 'star'] }]], hair: [['crop', {}], ['bob', {}], ['braid', {}]],
      top: [['pinafore', { sleeve: ['long'] }], ['bodice', { sleeve: ['long'], bib: true, patterned: false }]], bottom: [['skirt', { length: [HIP + 4, KNEE + 1], apron: true }], ['trousers', {}]],
      legs: [['boots', { height: [6, 10] }]], back: [['none', {}], ['cape', { length: [WAIST + 2, HIP + 4] }]], hand: [['lantern', { pole: [8, 14] }], ['candle', {}]] } },
  embalmer: { label: 'Embalmer', theme: 'crypt', prefer: { tone: 'pale' }, note: 'works the back room: long gloves, a stained apron, a dropper of something', motifs: ['plain', 'pinstripe'],
    slots: { hat: [['bonnet', { frill: false }], ['hood', { edge: ['plain'] }], ['none', {}]], hair: [['buns', {}], ['braid', {}]],
      top: [['pinafore', { sleeve: ['long'], collar: ['none'] }], ['robe', { opening: false, sleeve: ['long'] }]], bottom: [['skirt', { length: [KNEE, KNEE + 3], apron: true, patterned: false }]],
      legs: [['boots', {}], ['stockings', { pattern: ['plain'], colour: ['ink'] }]], back: [['none', {}], ['ribbons', {}]], hand: [['dropper', {}], ['bone', {}]] } },
  puppeteer: { label: 'Puppeteer', theme: 'crypt', note: 'strings and a painted face: jester points, a ruff, striped legs', motifs: ['harlequin', 'stripes', 'spots'],
    slots: { hat: [['jester', {}], ['bow', {}]], hair: [['twintails', { ribbons: true }], ['bob', {}]], top: [['bodice', { collar: ['ruff'], sleeve: ['puff'], patterned: true }]],
      bottom: [['bell', {}], ['skirt', { tiers: [2, 3] }], ['bloomers', {}]], legs: [['stockings', { pattern: ['stripes', 'diamonds'], toe: [true, false] }]], back: [['bow', {}], ['ribbons', {}], ['none', {}]], hand: [['wand', {}], ['bell', {}]] } },
  bellringer: { label: 'Bellringer', theme: 'crypt', prefer: { tone: 'dark' }, note: 'from the bell tower: a hood against the cold, rope-coloured cape, a hand bell', motifs: ['plain', 'checks'],
    slots: { hat: [['hood', { drape: [3, 8] }]], hair: [['crop', {}], ['bob', {}]], top: [['robe', { sleeve: ['bell', 'long'] }]], bottom: [['skirt', { length: [KNEE, KNEE + 3] }], ['trousers', {}]],
      legs: [['boots', {}]], back: [['cape', { length: [HIP, KNEE] }]], hand: [['bell', {}]] } },
  beekeeper: { label: 'Beekeeper', theme: 'candy', note: 'a hatchery keeper: eggshell hood, honeycomb, glassy bee wings', motifs: ['honeycomb', 'stripes'],
    slots: { hat: [['hood', { shell: true, edge: ['jagged'] }], ['wide', { veil: true }]], hair: [['buns', {}], ['bob', {}]], top: [['pinafore', {}], ['bodice', { patterned: true }]],
      bottom: [['skirt', { patterned: true, hem: ['scallop', 'zigzag'] }], ['bloomers', {}]], legs: [['stockings', { pattern: ['stripes'] }], ['boots', {}]], back: [['wings', { shape: ['bee'] }], ['cape', { lining: true }]], hand: [['dropper', {}], ['staff', { cradle: true }]] } },
  optician: { label: 'Optician', theme: 'candy', note: 'from the eye rooms: a lens, eyes on everything, lavender and glass', motifs: ['eyes', 'checks', 'spots'],
    slots: { hat: [['tophat', { ornament: ['buckle', 'none'] }], ['bonnet', {}], ['pointed', { ornament: ['eye'] }]], hair: [['bob', {}], ['long', {}], ['buns', {}]],
      top: [['bodice', { collar: ['lace', 'high'], patterned: true }], ['robe', {}]], bottom: [['skirt', { patterned: true }], ['bell', {}]], legs: [['stockings', { pattern: ['motif', 'plain'] }]],
      back: [['wings', { shape: ['moth'], spots: true }], ['none', {}]], hand: [['lens', {}], ['wand', { tip: ['gem'] }]] } },
  confectioner: { label: 'Confectioner', theme: 'candy', prefer: { tone: 'bright' }, note: 'behind the sweet shop counter: frills, a big bow, a lollipop', motifs: ['spots', 'stripes', 'checks'],
    slots: { hat: [['bow', {}], ['bonnet', { ribbon: true }], ['crown', {}]], hair: [['twintails', { ribbons: true }], ['buns', {}]], top: [['pinafore', { collar: ['bow', 'lace'] }], ['bodice', { sleeve: ['puff'], collar: ['sailor', 'bow'] }]],
      bottom: [['bell', { hem: ['lace', 'scallop'] }], ['skirt', { tiers: [2, 3], apron: [true, false] }]], legs: [['stockings', { pattern: ['stripes'] }], ['bare', {}]], back: [['bow', {}], ['none', {}]], hand: [['lolly', {}], ['wand', { tip: ['heart', 'star'] }]] } },
  mothkeeper: { label: 'Mothkeeper', theme: 'candy', note: 'keeps the night things: soft hood, moth wings with eyespots, a lantern', motifs: ['eyes', 'spots', 'plain'],
    slots: { hat: [['hood', { edge: ['frill'] }], ['horns', { curl: [.5, 1] }]], hair: [['long', { wave: true }], ['buns', {}]], top: [['robe', {}], ['bodice', { collar: ['ruff'] }]],
      bottom: [['bell', {}], ['skirt', { hem: ['scallop'] }]], legs: [['stockings', {}], ['bare', {}]], back: [['wings', { shape: ['moth'], spots: true }]], hand: [['lantern', {}], ['staff', {}]] } },
};

// the shoes each brief reaches for
const BRIEF_SHOES = {
  mourner: [['ankleboots', { colour: ['ink', 'shoe'], laces: true }], ['maryjanes', { colour: ['ink'] }]],
  ringmaster: [['pointed', { bells: true, curl: [2, 4] }], ['ankleboots', { cuff: true }]],
  lamplighter: [['clogs', {}], ['ankleboots', { height: [3, 5] }]],
  embalmer: [['clogs', { painted: false }], ['maryjanes', { strap: true }]],
  puppeteer: [['pointed', { curl: [2, 4], bells: true }], ['slippers', { pom: true }]],
  bellringer: [['ankleboots', { height: [4, 6] }], ['clogs', {}]],
  beekeeper: [['ankleboots', { colour: ['alt', 'shoe'] }], ['clogs', {}]],
  optician: [['maryjanes', { socks: [true, false] }], ['platforms', { sole: [1, 2] }]],
  confectioner: [['platforms', { bow: true, sole_colour: ['white', 'accent'] }], ['maryjanes', { bow: true, socks: true }]],
  mothkeeper: [['slippers', {}], ['maryjanes', {}]],
};
for (const [k, v] of Object.entries(BRIEF_SHOES)) if (WITCH_BRIEFS[k]) WITCH_BRIEFS[k].slots.shoes = v;

/* ---------- a design ---------- */
function newWitchDesign(o){ return { type: 'witch', id: ++workIds, brief: 'mourner', name: '', label: '', note: '', theme: 'crypt', palette: '', scheme: {}, motif: 'plain', motifScale: 2, parts: {}, wand: null, seed: 0, ...o }; }
function cloneDesign(D){ const c = JSON.parse(JSON.stringify(D, (k, v) => v instanceof Int16Array ? { __px: [...v] } : (k.startsWith('_') ? undefined : v)), (k, v) => v && v.__px ? Int16Array.from(v.__px) : v); c.id = ++workIds; return c; }
function themePalette(theme){
  const names = Object.keys(S.palettes).filter(k => paletteTheme(k) === theme);
  return names.length ? S.palettes[names[0]] : [];
}
function genWitch(seed, briefKey){
  const rng = mulberry32(seed), keys = Object.keys(WITCH_BRIEFS), bk = briefKey && WITCH_BRIEFS[briefKey] ? briefKey : keys[ri(rng, keys.length)], b = WITCH_BRIEFS[bk];
  const D = newWitchDesign({ brief: bk, seed, theme: b.theme, motif: b.motifs[ri(rng, b.motifs.length)], motifScale: 2 + ri(rng, 2) });
  D.scheme = schemeFrom(rng, themePalette(b.theme), b.prefer || {});
  for (const slot of W_SLOTS) D.parts[slot] = rollPart('witch', slot, b, rng);
  pairTrousers(D, rng);
  D.label = b.label.toLowerCase(); D.name = slug(b.label + '_' + (seed % 1000));
  D.wand = wandFor(D);
  return D;
}
// a trouser seat wants trouser legs below it (the seat hangs from the hips; the legs walk)
function pairTrousers(D, rng){
  const b = D.parts.bottom, l = D.parts.legs;
  if (!b || b.kind !== 'trousers' || (l && (l.kind === 'trousers' || l.lock || l.kind === 'drawn'))) return;
  D.parts.legs = { kind: 'trousers', dials: dialsWithin(WITCH_PARTS.legs.trousers, rng || mulberry32(D.seed || 1), { colour: ['main', 'motif'] }), lock: false };
}
function rollPart(type, slot, brief, rng, keepKind){
  const lib = type === 'witch' ? WITCH_PARTS[slot] : MONSTER_PARTS[slot];
  const opts = (brief.slots && brief.slots[slot]) || [[Object.keys(lib)[0], {}]];
  let [kind, ranges] = opts[ri(rng, opts.length)];
  if (keepKind){ const o = opts.find(x => x[0] === keepKind); kind = keepKind; ranges = o ? o[1] : {}; }
  return { kind, dials: dialsWithin(lib[kind], rng, ranges), lock: false };
}
// how the hand item shoots; kept as it is while the item stays the same kind, so hand tuning survives
const WAND_WORDS = ['bone', 'sugar', 'glass', 'moth', 'wax', 'thorn', 'pearl', 'soot', 'honey', 'brass', 'grave', 'lace'];
function wandFor(D){
  const h = D.parts.hand; if (!h || h.kind === 'none') return null;
  if (D.wand && D.wand._kind === (h.kind === 'drawn' ? D.wand._kind : h.kind)){
    if (D.wand.hold == null && HAND_SHOTS[D.wand._kind]) D.wand.hold = HAND_SHOTS[D.wand._kind][5];
    if (D.wand.rest == null && HAND_SHOTS[D.wand._kind]) D.wand.rest = HAND_SHOTS[D.wand._kind][6];
    return D.wand;
  }
  const [shape, noun, rate, speed, life, hold, rest] = HAND_SHOTS[h.kind] || ['orb', 'wand', 1, 1, 2, 180, 0], c = deriveRoles(D.scheme);
  return { _kind: h.kind, name: WAND_WORDS[(D.seed >>> 0) % WAND_WORDS.length] + ' ' + noun, rate, speed, dmg: 1, bounce: 0, pierce: 0, shots: 1, spread: 0, life,
    flash: c.accent.slice(1), shot: { shape, colours: [c.accent.slice(1), c.accent_l.slice(1)] }, hold, rest };
}

/* ---------- drawing a design ---------- */
let WITCH_BODY = null;   // the game's own body pictures, read once a folder is open
async function loadWitchBody(){
  if (WITCH_BODY) return WITCH_BODY;
  const pal = { keys: [], colors: [] }, out = {};
  for (const side of ['front', 'back']){
    const pic = S.files.size ? await readPic(`art/witch/body_${side}.png`) : null;
    const p = new Pen(WW, WH, WCX, pal);
    if (pic) for (let i = 0; i < pic.px.length; i++){ if (pic.px[i] >= 0) p.px[i] = p.idx(hex(COLORS[pic.px[i]])); }
    else drawFallbackBody(p, side);
    out[side] = p.px;
  }
  return (WITCH_BODY = { pal, ...out });
}
function drawFallbackBody(p, side){
  for (let y = HEAD_TOP; y <= CHIN; y++){ const t = (y - HEAD_TOP) / (CHIN - HEAD_TOP); p.rowC(y, 4.5 + .6 * Math.sin(t * Math.PI) - (t > .75 ? 1.4 * (t - .75) / .25 : 0), SKIN); }
  p.rowC(CHIN + 1, 1, SKIN_D);
  for (let y = SHOULDER; y <= HIP; y++) p.rowC(y, y < WAIST ? 3.5 : 3.0 + (y - WAIST) * .35, SKIN);
  for (let y = SHOULDER; y < WAIST + 2; y++){ p.put(WCX - 5, y, SKIN); p.put(WCX + 5, y, SKIN_D); }
  for (let y = HIP + 1; y < ANKLE; y++){ p.span(y, WCX - 3, WCX - .5, SKIN); p.span(y, WCX + 1.5, WCX + 4, SKIN_D); }
  for (let y = ANKLE; y < WH; y++){ p.span(y, WCX - 3.5, WCX - .5, SKIN_D); p.span(y, WCX + 1.5, WCX + 4.5, SKIN_D); }
  if (side === 'front'){ for (const ex of [WCX - 2.5, WCX + 1.5]){ p.put(ex, 19, '#1a0f1f'); p.put(ex + 1, 19, '#1a0f1f'); p.put(ex, 20, '#1a0f1f'); p.put(ex + 1, 20, '#fff6fb'); } p.put(WCX, 22, '#c05070'); }
}
// every slot's picture, front and back, on one shared palette
function drawWitchLayers(D){
  const pal = { keys: [], colors: [] }, c = deriveRoles(D.scheme), layers = {};
  // with a shoes part, the legs leave the feet to it
  const hasShoes = !!(D.parts.shoes && D.parts.shoes.kind !== 'none');
  for (const slot of W_SLOTS){
    const part = D.parts[slot]; if (!part) continue;
    layers[slot] = {};
    for (const side of ['front', 'back']){
      const p = new Pen(WW, WH, WCX, pal);
      if (part.kind === 'drawn' && part.drawn){
        const src = part.drawn[side]; if (src) for (let i = 0; i < src.length; i++) if (src[i] >= 0) p.px[i] = p.idx(hex(part.drawn.colors[src[i]]));
      } else {
        const kind = WITCH_PARTS[slot][part.kind]; if (!kind) continue;
        kind.draw(p, part.dials, c, { side, front: side === 'front', shoes: hasShoes, fill: (base, accent) => motifFill(c, D.motif, D.motifScale, base, accent, WCX) });
      }
      layers[slot][side] = p.px;
    }
  }
  return { pal, layers };
}
const W_FRONT_ORDER = ['back', 'body', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'hand'];
const W_BACK_ORDER = ['body', 'legs', 'shoes', 'bottom', 'top', 'hair', 'hat', 'back', 'hand'];
async function witchPictures(D){
  const body = await loadWitchBody(), { pal, layers } = drawWitchLayers(D), out = {};
  for (const side of ['front', 'back']){
    const px = new Int16Array(WW * WH).fill(-1), colors = [], map = new Map();
    const key = c => { const k = hexOf(c); if (!map.has(k)){ map.set(k, colors.length); colors.push(c); } return map.get(k); };
    for (const s of side === 'front' ? W_FRONT_ORDER : W_BACK_ORDER){
      const src = s === 'body' ? body[side] : layers[s] && layers[s][side], sp = s === 'body' ? body.pal : pal;
      if (src) for (let i = 0; i < src.length; i++) if (src[i] >= 0) px[i] = key(sp.colors[src[i]]);
    }
    out[side] = { w: WW, h: WH, px, colors };
  }
  return { ...out, layers, pal, body };
}

/* ---------- the cutter, as tools/draw_witch.py write_pieces ---------- */
const PIECE_OF_SLOT = { hair: 'head', hat: 'hat', hand: 'hand', top: 'torso', bottom: 'skirt', back: 'torso', legs: 'legs', shoes: 'legs' };
function cutPx(px, rows, cols){
  const out = new Int16Array(WW * WH).fill(-1);
  for (let y = 0; y < WH; y++){ if (rows && !(rows[0] <= y && y < rows[1])) continue; for (let x = 0; x < WW; x++){ if (cols && !(cols[0] <= x && x < cols[1])) continue; out[y * WW + x] = px[y * WW + x]; } }
  return out;
}
const ARM_ROWS = [SHOULDER, WAIST + 3], ARM_A = [0, Math.trunc(WCX - 4)], ARM_B = [Math.trunc(WCX + 5), WW], LEFT = [0, Math.trunc(WCX) + 1], RIGHT = [Math.trunc(WCX) + 1, WW];
const sideCols = (side, which) => which === 'armr' ? (side === 'front' ? ARM_B : ARM_A) : (side === 'front' ? ARM_A : ARM_B);
function minusArms(px, side){ const out = cutPx(px); for (const which of ['arml', 'armr']){ const [c0, c1] = sideCols(side, which); for (let y = ARM_ROWS[0]; y < ARM_ROWS[1]; y++) for (let x = c0; x < c1; x++) out[y * WW + x] = -1; } return out; }
// one slot picture -> { piece: px }
function cutSlot(slot, px, side){
  const piece = PIECE_OF_SLOT[slot], out = {};
  if (piece === 'legs'){ out.legl = cutPx(px, null, side === 'front' ? LEFT : RIGHT); out.legr = cutPx(px, null, side === 'front' ? RIGHT : LEFT); }
  else if (slot === 'top'){ out.torso = minusArms(px, side); for (const which of ['arml', 'armr']) out[which] = cutPx(px, ARM_ROWS, sideCols(side, which)); }
  else out[piece] = px;
  for (const k of Object.keys(out)) if (!out[k].some(v => v >= 0)) delete out[k];
  return out;
}
function cutBody(px, side){
  const out = { head: cutPx(px, [0, CHIN + 2]), torso: minusArms(cutPx(px, [CHIN + 2, HIP + 1]), side) };
  for (const which of ['arml', 'armr']) out[which] = cutPx(px, ARM_ROWS, sideCols(side, which));
  out.legl = cutPx(px, [HIP + 1, WH], side === 'front' ? LEFT : RIGHT); out.legr = cutPx(px, [HIP + 1, WH], side === 'front' ? RIGHT : LEFT);
  return out;
}

/* ---------- shoes point forward ----------
   The pictures are flat, so a toe is made in 3D: the shoe's lowest rows reach out in front by "toe"
   voxels (a pointed toe narrows to its middle column), and a curl rises at the tip, with a bell on it if
   asked. game/witch.gd does exactly this from the outfit file's "shoe". */
function shoeForward(D){
  const part = D.parts.shoes; if (!part || part.kind === 'none') return null;
  if (part.kind === 'drawn') return D.shoe || { toe: 2, rows: 2 };
  const kind = WITCH_PARTS.shoes[part.kind];
  return kind && kind.forward ? kind.forward(part.dials, deriveRoles(D.scheme)) : null;
}
function pointForward(cells, f){
  if (!f || !(f.toe > 0) || !cells.size) return;
  let ground = Infinity; for (const v of cells.values()) ground = Math.min(ground, v[1]);
  const rows = f.rows || 2, adds = [];
  for (let y = ground; y < ground + rows; y++){
    // the front of each column on this row: where the toe starts, and its colour
    const front = new Map();
    for (const [x, yy, z, c] of cells.values()) if (yy === y && z >= 0 && (!front.has(x) || z > front.get(x)[0])) front.set(x, [z, c]);
    const xs = [...front.keys()].sort((a, b) => a - b);
    for (let i = 0; i < xs.length;){
      let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
      const mid = (xs[i] + xs[j]) / 2, xm = Math.floor(mid);
      for (let k = i; k <= j; k++){
        const x = xs[k], [z0, c] = front.get(x), n = f.taper ? Math.max(1, f.toe - 2 * Math.abs(x - mid)) : f.toe;
        for (let d = 1; d <= n; d++) adds.push([x, y, z0 + d, c]);
      }
      // the curl rises at the tip of the middle column, from the top of the toe
      if (y === ground + rows - 1 && (f.curl > 0 || f.tip)){
        const [z0, c] = front.get(xm) || front.get(xs[i]), tipZ = z0 + f.toe;
        for (let k = 1; k <= (f.curl || 0); k++) adds.push([xm, y + k, tipZ, c]);
        if (f.tip){ const t = unhex(f.tip); adds.push([xm, y + (f.curl || 0) + 1, tipZ, colourOf(t[0], t[1], t[2])]); }
      }
      i = j + 1;
    }
  }
  for (const v of adds) cells.set(v[0] + ',' + v[1] + ',' + v[2], v);
}

/* ---------- the rig: pieces built as witch.gd builds them, and her walk ---------- */
async function witchRig(D){
  const pics = await witchPictures(D), { layers, pal, body } = pics;
  const cells = Object.fromEntries(W_PIECES.map(p => [p, new Map()]));
  for (const side of ['front', 'back']){
    const bc = cutBody(body[side], side);
    for (const [piece, px] of Object.entries(bc)) shellCells(px, body.pal, WW, WH, W_DEPTH.body, side === 'back', cells[piece]);
  }
  const shoe = shoeForward(D);
  for (const slot of W_SLOTS){
    if (!layers[slot]) continue;
    // shoes are built on their own first, so their toes can be stretched forward before they join the legs
    const into = slot === 'shoes' ? Object.fromEntries(W_PIECES.map(p => [p, new Map()])) : cells;
    for (const side of ['front', 'back']){
      if (!layers[slot][side]) continue;
      for (const [piece, px] of Object.entries(cutSlot(slot, layers[slot][side], side))) shellCells(px, pal, WW, WH, W_DEPTH[slot], side === 'back', into[piece]);
    }
    if (slot === 'shoes') for (const [piece, m] of Object.entries(into)){ pointForward(m, shoe); for (const [k, v] of m) cells[piece].set(k, v); }
  }
  const joints = Object.keys(S.joints).length ? Object.fromEntries(Object.entries(S.joints).map(([k, j]) => [k, [j.parent, j.at]])) : W_JOINTS;
  const pieces = W_PIECES.map(p => ({ joint: p, V: cellsToPiece(cells[p]) })).filter(p => p.V);
  // the item sits where her hand grips it
  // the item sits where her hand grips it: placed each frame, as it slides between rest and aim
  const grip = gripFor(D);
  // without a grip: how the hand turns the item when she aims is the outfit's "hold", else the game's own rule
  // (the item's highest voxel near the hand: a short wand points, a long staff angles up)
  let top = null; for (const v of cells.hand.values()) if (!top || v[1] > top[1]) top = v;
  const tip = top ? Math.hypot(top[0] - W_JOINTS.hand[1][0], top[1] - W_JOINTS.hand[1][1]) / 32 : 0;
  const hold = D.wand && D.wand.hold != null ? D.wand.hold * Math.PI / 180 : tip < .5 ? Math.PI : Math.PI * .6;
  const rest = D.wand && D.wand.rest ? D.wand.rest * Math.PI / 180 : 0;
  // the older way, as a grip: what an outfit with no grip of its own does today
  const legacy = { grip: [0, 0, 0], rest: [Math.round(rest * 180 / Math.PI), 0, 0], aim: [Math.round(hold * 180 / Math.PI), 0, 0], plumb: Math.abs(hold - 83 * Math.PI / 180) < .05 };
  return { joints, pieces, size: [WW, WH], animate: (st, dt, t, walk, aim) => witchAnimate(st, dt, t, walk, aim, hold, rest, grip), pics, aims: true, grip, cells, legacy };
}
// game/witch.gd animate(), with walk standing in for her speed
function witchAnimate(st, dt, t, walk, aiming = false, hold = Math.PI, rest = 0, grip = null){
  if (st.phase == null) Object.assign(st, { phase: 0, squash: 0, head: [0, 0], hat: [0, 0] });
  const speed = walk * 4.5, prev = st.phase;
  st.phase += dt * (3 + speed * 2.6);
  const s = Math.sin(st.phase), c = Math.cos(st.phase), V = 32;
  if (Math.floor(prev / Math.PI) !== Math.floor(st.phase / Math.PI) && walk > .2) st.squash = 1;
  st.squash = Math.max(0, st.squash - dt * 6);
  const sq = st.squash * .07 * walk, pose = {};
  pose.hips = { pos: [0, (Math.abs(c) * .06 * walk + Math.sin(t * 2.2) * .01 * (1 - walk)) * V, 0], scale: [1 + sq, 1 - sq, 1 + sq] };
  pose.torso = { rot: [-walk * .2, s * .12 * walk, s * .04 * walk] };
  pose.legl = { rot: [s * .85 * walk, 0, 0] }; pose.legr = { rot: [-s * .85 * walk, 0, 0] };
  pose.skirt = { rot: [walk * .15, 0, c * .14 * walk] };
  // the arms at rest: the grip's angles, else as they always have hung (game/witch.gd does the same)
  const d2r = Math.PI / 180, armRest = grip ? grip.arm.map(v => v * d2r) : [0, 0, .12], armlRest = grip ? grip.arml.map(v => v * d2r) : [0, 0, -.12];
  pose.arml = { rot: [armlRest[0] - s * .7 * walk + Math.sin(t * 1.9) * .04, armlRest[1], armlRest[2] - walk * .1] };
  // the wand arm: swings with the walk, or rises to point where she aims, and the hand turns the item by its hold
  st.aim = Math.max(0, Math.min(1, (st.aim || 0) + (aiming ? 1 : -1) * dt * 8));
  const swing = s * .7 * walk + Math.sin(t * 1.6) * .05;
  pose.armr = { rot: [lerp(swing + armRest[0], -1.45, st.aim), lerp(armRest[1], 0, st.aim), lerp(armRest[2], 0, st.aim)] };
  // an item held upright or hanging (hold 83) stays plumb as the arm swings, keeping a little of the sway
  const plumb = Math.abs(hold - 83 * Math.PI / 180) < .05;
  if (grip){
    // a grip: from its rest turn to its aim turn; a plumb item keeps level as the arm swings (as game/witch.gd)
    const d = Math.PI / 180, r = grip.rest.map(v => v * d), a = grip.aim.map(v => v * d);
    // a plumb item undoes the arm's forward tip too, so it hangs level however the arm is held
    r[0] += Math.sin(t * 1.4) * .06 - (grip.plumb ? swing * .9 + armRest[0] : 0);
    if (grip.plumb) r[2] -= armRest[2];     // and the arm's lift out to the side
    // the short way from rest to aim, whatever angles they were written as (as game/witch.gd)
    pose.hand = { mat: matOfQuat(slerp(quatYXZ(r), quatYXZ(a), st.aim)), off: grip.grip.map((v, i) => lerp(v, grip.aim_grip[i], st.aim)) };
  } else pose.hand = { rot: [lerp(rest + Math.sin(t * 1.4) * .06 - (plumb ? swing * .9 : 0), hold, st.aim), 0, 0] };
  st.head = dt ? spring(st.head, s * .05 * walk, dt, 60, 9) : st.head;
  pose.head = { rot: [walk * .12 + Math.sin(t * 1.3) * .03, 0, st.head[0]] };
  st.hat = dt ? spring(st.hat, -walk * .25 + c * .08 * walk, dt, 40, 5) : st.hat;
  pose.hat = { rot: [walk * .18 + st.hat[0] * .4, 0, st.hat[0]] };
  return pose;
}

/* ---------- into the game: art/witch/sets/<name>/, the outfit file, and the pieces ---------- */
async function witchFiles(D, f){
  const pics = await witchPictures(D), { layers, pal } = pics, files = [];
  const pngOf = px => canvasPNG(picCanvas(WW, WH, px, pal.colors));
  for (const slot of W_SLOTS){
    if (!layers[slot]) continue;
    for (const side of ['front', 'back']){
      const px = layers[slot][side]; if (!px || !px.some(v => v >= 0)) continue;
      files.push([`art/witch/sets/${f.name}/${slot}_${side}.png`, await pngOf(px), 'slot picture']);
      for (const [piece, cut] of Object.entries(cutSlot(slot, px, side))) files.push([`art/witch/pieces/${piece}__${slot}_${f.name}_${side}.png`, await pngOf(cut), 'piece']);
    }
  }
  // a style saved over itself keeps its place in the outfit sliders
  const same = S.styles.find(s => s.key === f.name);
  const order = f.order != null ? f.order : same && same.set.order != null ? same.set.order : Math.max(0, ...S.styles.map(s => s.order || 0)) + 1;
  const wand = D.wand ? Object.fromEntries(Object.entries(D.wand).filter(([k]) => !k.startsWith('_'))) : undefined;
  // the grip goes with the outfit, as it stands in the table now
  if (wand){ const g = gripFor(D); if (g) wand.grip = g; }
  const shoe = shoeForward(D);
  const set = { order, label: f.label, note: f.note || WITCH_BRIEFS[D.brief]?.note || '', ...(wand ? { wand } : {}), ...(shoe ? { shoe } : {}), design: designToJSON(D) };
  files.push([`art/witch/sets/${f.name}.json`, JSON.stringify(set, null, 1) + '\n', 'outfit']);
  return files;
}
// a design kept inside the file the game reads, so it can be opened and changed later
const designToJSON = D => JSON.parse(JSON.stringify(D, (k, v) => v instanceof Int16Array ? [...v] : k.startsWith('_') ? undefined : v));
function designFromJSON(o){
  const D = JSON.parse(JSON.stringify(o)); D.id = ++workIds;
  for (const part of Object.values(D.parts || {})) if (part.drawn) for (const side of ['front', 'back']) if (part.drawn[side]) part.drawn[side] = Int16Array.from(part.drawn[side]);
  // designs kept from before trousers were split into a seat and legs
  if (D.type === 'witch') pairTrousers(D);
  return D;
}
// an outfit already in the game, as hand-drawn parts, so it can be changed here
async function witchFromStyle(st){
  if (st.set.design) return designFromJSON(st.set.design);
  const D = newWitchDesign({ brief: '', name: st.key, label: st.set.label || st.key, note: st.set.note || '', theme: /candy|hatch|optic|confect|brood|keeper|oculist/.test(st.key) ? 'candy' : 'crypt', wand: st.set.wand ? { ...st.set.wand } : null });
  D.scheme = schemeFrom(mulberry32(1), themePalette(D.theme));
  for (const slot of W_SLOTS){
    const files = st.slots[slot]; if (!files) continue;
    const front = files.front && await readPic(files.front), back = files.back && await readPic(files.back);
    const { colors, pics: [f, b] } = localise([front, back]);
    D.parts[slot] = { kind: 'drawn', dials: {}, lock: false, drawn: { colors, front: f ? f.px : null, back: b ? b.px : null } };
  }
  D.replace = st.key;
  return D;
}
