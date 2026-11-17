// scene.js: the page. order of drawing is the order the pen moves.
(function (G) {
'use strict';
const BP = G.BP, clamp = BP.clamp;

const NAMES = ['MERIDIAN', 'HALCYON', 'KESTREL', 'ORPHEUS', 'VANGUARD', 'TALLIS', 'ODYSSEY', 'CORVUS', 'LANTERN'];

// scale a mesh to fit maxW x maxH, centre it on `at`, leave the view rendered
function fitCam(view, mesh, ang, light, maxW, maxH, at) {
  const mk = (F, cx, cy) => BP.makeCam(Object.assign({ F, D: 14, cx, cy }, ang));
  let cam = mk(1500, 800, 600); view.render(mesh, cam, light);
  let b = view.bbox;
  const F = 1500 * Math.min(maxW / (b[2] - b[0]), maxH / (b[3] - b[1]));
  cam = mk(F, 800, 600); view.render(mesh, cam, light); b = view.bbox;
  cam = mk(F, 800 + at[0] - (b[0] + b[2]) / 2, 600 + at[1] - (b[1] + b[3]) / 2);
  view.render(mesh, cam, light);
  return cam;
}

BP.compose = function (pen, opts) {
  const W = pen.W, H = pen.H, rng = pen.rng, R = (a, b) => a + (b - a) * rng();
  const view = new BP.View(W, H), light = [-0.55, 0.7, 0.55];
  const ship = BP.buildShip(rng), A = ship.A;

  const ang = { yaw: R(0.35, 0.85), pitch: R(0.2, 0.45), roll: R(0.12, 0.34) };
  const cam = fitCam(view, ship.mesh, ang, light, 900, 610, [R(640, 720), R(640, 680)]);
  const b = view.bbox;

  const P = a => cam.project(a), shipM = view.silhouette(new BP.Mask(W, H));

  // 1. the ship: contours, then tone
  pen.mask = null;
  view.drawEdges(pen);
  view.hatchAll(pen, { gap: 3.4 });

  // exhaust streaks behind the drive
  const tail = P(A.nozzles[0]), noseP = P(A.nose), rear = P([A.drive[0] - 0.5, 0, 0]);
  let ax = rear[0] - noseP[0], ay = rear[1] - noseP[1]; const al = Math.hypot(ax, ay); ax /= al; ay /= al;
  pen.mask = null;
  BP.speedLines(pen, tail[0], tail[1], ax, ay, 9, 190, 20);

  // 2. planet with rings, and a moon
  const Rp = R(150, 185), px = R(1190, 1290), py = R(250, 330), occl = new BP.Mask(W, H).copy(shipM).dilate(3);
  const ax0 = R(1385, 1420), ay0 = R(905, 925), as = R(118, 134);
  let mo = { x: px + Rp * 1.6, y: py + Rp * 2.5, r: 18 };          // fallback
  for (let i = 0; i < 40; i++) {                                    // first spot that isn't behind the ship
    const a = R(0, 6.283), d = Rp * R(2.4, 3.1), m = { x: px + Math.cos(a) * d, y: py + Math.sin(a) * d * 0.8, r: R(15, 24) };
    if (m.x < 260 || m.x > W - 80 || m.y < 90 || m.y > H - 280 || Math.hypot(m.x - ax0, m.y - ay0) < as * 1.9) continue;
    let hit = false;
    for (let k = 0; k < 8; k++) if (occl.a[((m.y + Math.sin(k) * (m.r + 6)) | 0) * W + ((m.x + Math.cos(k) * (m.r + 6)) | 0)]) hit = true;
    if (!hit) { mo = m; break; }
  }
  const planet = { cx: px, cy: py, R: Rp, tilt: -R(0.22, 0.4), incl: R(0.2, 0.3), rIn: 1.3, rOut: R(1.85, 2.0), moons: [mo] };
  BP.drawPlanet(pen, planet, occl);

  // 3. the grey head, bottom right
  pen.mask = null;
  BP.drawAlien(pen, ax0, ay0, as, -R(0.06, 0.16));

  // the saucer, top left
  const ufoV = new BP.View(W, H), ufo = BP.buildUFO(rng);
  fitCam(ufoV, ufo.mesh, { yaw: R(0.2, 0.5), pitch: R(0.28, 0.4), roll: -R(0.05, 0.2) }, light, R(230, 270), 200, [R(400, 520), R(170, 210)]);
  const ufoM = ufoV.silhouette(new BP.Mask(W, H));
  pen.mask = null;
  ufoV.drawEdges(pen);
  ufoV.hatchAll(pen, { gap: 3.2 });

  // 4. labels and title
  const cxs = (b[0] + b[2]) / 2, cys = (b[1] + b[3]) / 2;
  const free = (x, y) => x > 230 && x < W - 60 && y > 70 && y < H - 130 && !shipM.a[(y | 0) * W + (x | 0)] && !ufoM.a[(y | 0) * W + (x | 0)] && Math.hypot(x - px, y - py) > Rp * 2.15 && Math.hypot(x - ax0, y - ay0) > as * 1.5;
  const items = [[A.ring, 'WHEEL'], [A.drive, 'DRIVE'], [A.mast, 'MAST'], [A.tank, 'TANK'], [A.nose, 'NOSE']].filter(i => i[0]);
  for (const it of items) {
    const p = P(it[0]);
    let dx = p[0] - cxs, dy = p[1] - cys; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const dist = R(120, 170), tx = p[0] + dx * dist, ty = p[1] + dy * dist, size = 17;
    const right = dx < 0, w = pen.textWidth(it[1], size);
    if (!free(tx, ty) || !free(right ? tx - w : tx + w, ty)) continue;
    BP.drawLabel(pen, p[0], p[1], tx, ty, it[1], size, right ? 'r' : 'l');
  }
  // dimension line under the ship, it passes behind the title block
  {
    pen.mask = new BP.Mask(W, H).fillFn([215, 938, 660, 1046], () => true).a;
    const p0 = P(A.nozzles[0]), p1 = noseP;
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
    let nx = -dy, ny = dx; if (ny < 0) { nx = -nx; ny = -ny; }
    const off = Math.max(90, (b[3] - b[1]) * 0.42), q0 = [p0[0] + nx * off, p0[1] + ny * off], q1 = [p1[0] + nx * off, p1[1] + ny * off];
    if (Math.min(q0[1], q1[1]) < H - 140 && Math.min(q0[0], q1[0]) > 215) {
      pen.line(q0, q1, { speed: 0.35, p: 0.8, wob: 0.5 });
      for (const q of [q0, q1]) pen.line([q[0] - nx * 9, q[1] - ny * 9], [q[0] + nx * 9, q[1] + ny * 9], { speed: 0.3, p: 0.85, wob: 0.2, over: 0 });
      const str = String(200 + (rng() * 400 | 0)) + ' M', w = pen.textWidth(str, 15), mid = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2];
      pen.text(str, mid[0] - dx * w / 2 - nx * 22, mid[1] - dy * w / 2 - ny * 22, 15, { rot: Math.atan2(dy, dx), slant: 0.1 });
    }
  }
  pen.mask = null;
  const name = NAMES[(rng() * NAMES.length) | 0];
  pen.text(name + ' CLASS', 232, 962, 30, { slant: 0.16, spacing: 1.15, p: 0.9 });
  pen.line([228, 1004], [228 + pen.textWidth(name + ' CLASS', 30, 1.15) + 8, 1002], { speed: 0.4, p: 0.85, wob: 0.6 });
  pen.text('SURVEY CRUISER  MK.' + ['I', 'II', 'III', 'IV'][(rng() * 4) | 0], 232, 1024, 17, { slant: 0.12 });

  // 5. everything that must stay paper: ship, planet, moon, head, title
  const keep = new BP.Mask(W, H).copy(shipM).or(ufoM).dilate(7);
  keep.fillFn([px - Rp * 2.2, py - Rp * 2.2, px + Rp * 2.2, py + Rp * 2.2], (x, y) => planet.region(x, y) || Math.hypot(x - mo.x, y - mo.y) < mo.r + 8);
  keep.fillFn([ax0 - as * 1.1, ay0 - as * 1.15, ax0 + as * 1.15, ay0 + as * 1.6], (x, y) => Math.hypot((x - ax0) / (as * 1.05), (y - ay0) / (as * 1.2)) < 1);
  keep.fillFn([215, 938, 660, 1046], () => true);
  // the scribble thins out toward anything it goes around
  const s1 = new BP.Mask(W, H).copy(keep).dilate(14), s2 = new BP.Mask(W, H).copy(s1).dilate(16), s3 = new BP.Mask(W, H).copy(s2).dilate(22);

  // stars, each one keeps a clear patch in the scribble
  pen.mask = keep.a;
  const stars = BP.drawStars(pen, 170), starKeep = new BP.Mask(W, H);
  for (const s of stars) starKeep.fillFn([s[0] - s[2] - 3, s[1] - s[2] - 3, s[0] + s[2] + 3, s[1] + s[2] + 3], (x, y) => Math.hypot(x - s[0], y - s[1]) < s[2] + 3);
  keep.or(starKeep);

  // 6. sky scribble around everything
  const n2 = pen.n2;
  BP.drawSky(pen, keep, (x, y) => {
    const d = Math.hypot((x / W - 0.5) * 1.25, (y / H - 0.52) * 1.5), i = (y | 0) * W + (x | 0);
    const soft = s1.a[i] ? 0.35 : s2.a[i] ? 0.62 : s3.a[i] ? 0.85 : 1;
    return clamp(1.15 * Math.pow(d, 1.7) + 1.1 * (n2(x * 0.0045 + 5, y * 0.0045 + 2, 4) - 0.5) - 0.2, 0, 1) * soft;
  });
  pen.mask = null;
};
})(window);
