// ufo.js: a small saucer for the corner of the page.
(function (G) {
'use strict';
const { Mesh } = G.BP, Y = [0, 1, 0];

G.BP.buildUFO = function (rng) {
  const m = new Mesh(), rim = 2.5 + rng() * 0.3;
  m.lathe([0, 0, 0], Y, [[-0.32, 0], [-0.32, 0.55], [-0.2, 1.2], [-0.06, rim * 0.8], [0, rim], [0.1, rim * 0.84], [0.22, 1.4], [0.3, 0.9], [0.32, 0]], 30, { name: 'disc' });
  m.lathe([0, 0, 0], Y, [[0.28, 0], [0.28, 0.95], [0.52, 0.8], [0.76, 0.5], [0.9, 0.2], [0.96, 0]], 20);
  m.lathe([0, 0, 0], Y, [[-0.32, 0], [-0.32, 0.55], [-0.5, 0.45], [-0.55, 0.3], [-0.55, 0]], 16);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.4, x = 1.4 * Math.cos(a), z = 1.4 * Math.sin(a);
    m.lathe([x, 0, z], Y, [[-0.3, 0], [-0.3, 0.14], [-0.62, 0.1], [-0.66, 0.2], [-0.72, 0.2], [-0.72, 0]], 10);
  }
  const n = 12 + ((rng() * 4) | 0) * 2;
  for (let k = 0; k < n; k++) {      // rim lights
    const a = k / n * Math.PI * 2 + 0.1;
    m.box([(rim - 0.05) * Math.cos(a), 0, (rim - 0.05) * Math.sin(a)], [0.2, 0.15, 0.2], { tone: 0.08 });
  }
  return { mesh: m.finalize() };
};
})(window);
