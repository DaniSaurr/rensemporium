// game-core.js — HFFC game layer: state, save, scene manager, UI helpers.
// The world layer (rooms + creatures) is roomRender.js; this file never draws
// creatures, it drives them through window.roomRenderAPI.

window.G = (function () {
  const overlay = document.getElementById("overlayCanvas");
  const ctx = overlay.getContext("2d");
  const W = overlay.width;
  const H = overlay.height;

  // ---------------------------------------------------------------- rng
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function deriveSeed(baseSeed, label) {
    return ((baseSeed >>> 0) ^ hashString(String(label))) >>> 0;
  }

  function createRng(seed) {
    let state = seed >>> 0;
    return {
      next() {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      },
      int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
      pick(array) { return array[this.int(0, array.length - 1)]; },
      chance(p) { return this.next() < p; }
    };
  }

  // ---------------------------------------------------------------- state
  const SAVE_KEY = "hffc_save_v1";

  function freshState() {
    return {
      night: 0,                 // nights slept; kainoCount === night
      startedDay: false,        // has the player been checked in yet
      playerModel: { probe: 0, empathy: 0, control: 0, force: 0, neutral: 0, engagement: 0, compliance: 0, resistance: 0 },
      choicesLog: [],           // last stances chosen, for pattern frames
      pureNeutralQuiz: false,
      controlAffinity: 0,
      unlockedToggles: [],      // control-player hollow toggles
      toggleState: {},
      currentFloor: 0,          // 0 = lobby
      greetedToday: 0,
      greetedTotal: 0,
      lockedRooms: {},          // roomNumber -> day locked
      emptyRooms: {},           // roomNumber -> day vacated by neutral
      roomHistory: [],          // visited room numbers, for the Hound
      thresholdChurn: 0,
      pendingThreshold: false,
      elevatorRides: 0,
      pellets: 0,
      pelletsTaken: {},         // "room:day" -> true, once collected
      pet: { stage: "gift", feedings: 0, lastInteractDay: 0, name: null },
      creatureMemory: {},       // identity -> {dependency, stage}
      quests: [],               // {from, fromName, targetRoomAtIssue, topic, state}
      questsDone: 0,
      frames: {},               // frameId -> {state, encounters}
      vovEncounters: 0,
      houndEncounters: 0,
      sleptWithHound: 0,
      ended: null,
      seenIntro: false,
      dayEventShown: {}
    };
  }

  let S = freshState();

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      S = Object.assign(freshState(), data);
      S.playerModel = Object.assign(freshState().playerModel, data.playerModel || {});
      return true;
    } catch (e) { return false; }
  }

  function wipe() {
    S = freshState();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  function day() { return S.night + 1; }

  const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  function weekday() { return WEEKDAYS[(S.night) % 7]; } // arrival night = midnight sat->sun

  // ------------------------------------------------------- player model
  function applyEffects(effects) {
    if (!effects) return;
    for (const key in effects) {
      S.playerModel[key] = (S.playerModel[key] || 0) + effects[key];
    }
    save();
  }

  function logChoice(stance) {
    S.choicesLog.push(stance);
    if (S.choicesLog.length > 24) S.choicesLog.shift();
  }

  function interpretationBias() {
    const m = S.playerModel;
    return m.probe + m.empathy + m.control + m.force - m.neutral;
  }

  function dominantStyle() {
    const m = S.playerModel;
    const pairs = [["probe", m.probe], ["empathy", m.empathy], ["control", m.control], ["force", m.force], ["neutral", m.neutral]]
      .sort((a, b) => b[1] - a[1]);
    return { primary: pairs[0][0], secondary: pairs[1][0], primaryScore: pairs[0][1], total: Math.max(1, pairs.reduce((s, p) => s + p[1], 0)) };
  }

  function neutralUnlocked() {
    const m = S.playerModel;
    if (S.pureNeutralQuiz) return true;
    return m.neutral >= 4 && m.neutral >= m.probe && m.neutral >= m.control && m.neutral >= m.force;
  }

  // drift level 0..1 — how far the UI has slid from convention
  function driftLevel() {
    const d = Math.min(1, (day() - 1) / 8);
    const bias = Math.max(0, Math.min(1, interpretationBias() / 30));
    const calm = Math.max(0, Math.min(1, S.playerModel.neutral / 12));
    return Math.max(0, Math.min(1, d * 0.5 + bias * 0.6 - calm * 0.7));
  }

  // ---------------------------------------------------------------- audio
  let audioCtx = null;
  let humNodes = null;

  function ac() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return audioCtx;
  }

  function clickSound(good) {
    const a = ac(); if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = good ? 660 : 320;
    o.type = "square";
    g.gain.setValueAtTime(0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.09);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.1);
  }

  function startHum(intensity) {
    const a = ac(); if (!a) return;
    stopHum();
    const o = a.createOscillator();
    const o2 = a.createOscillator();
    const g = a.createGain();
    o.type = "sawtooth"; o.frequency.value = 46;
    o2.type = "sine"; o2.frequency.value = 58 + intensity * 22;
    g.gain.value = 0.015 + intensity * 0.05;
    o.connect(g); o2.connect(g); g.connect(a.destination);
    o.start(); o2.start();
    humNodes = { o, o2, g };
  }

  function stopHum() {
    if (humNodes) {
      try { humNodes.o.stop(); humNodes.o2.stop(); } catch (e) {}
      humNodes = null;
    }
  }

  function tannoyChime() {
    const a = ac(); if (!a) return;
    [523, 659, 784].forEach((f, i) => {
      const o = a.createOscillator(); const g = a.createGain();
      o.frequency.value = f; o.type = "sine";
      const t = a.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + 0.45);
    });
  }

  // ------------------------------------------------------------ scenes
  const scenes = {};
  let current = null;
  let currentName = "";
  let sceneTime = 0;
  let fade = { alpha: 0, dir: 0, cb: null, speed: 1.6 };
  let mouse = { x: -1, y: -1 };
  let hotspots = [];   // rebuilt every frame: {x,y,w,h, cb, cursor, id}

  function registerScene(name, scene) { scenes[name] = scene; }

  function go(name, params) {
    fade.dir = 1;
    fade.cb = () => {
      const prev = currentName;
      current = scenes[name];
      currentName = name;
      sceneTime = 0;
      hotspots = [];
      if (current && current.enter) current.enter(params || {}, prev);
      fade.dir = -1;
    };
  }

  function hardGo(name, params) {
    const prev = currentName;
    current = scenes[name];
    currentName = name;
    sceneTime = 0;
    hotspots = [];
    fade.alpha = 1; fade.dir = -1; fade.cb = null;
    if (current && current.enter) current.enter(params || {}, prev);
  }

  function hotspot(x, y, w, h, cb, opts) {
    hotspots.push(Object.assign({ x, y, w, h, cb, cursor: "pointer" }, opts || {}));
  }

  function hitHotspot(px, py) {
    for (let i = hotspots.length - 1; i >= 0; i--) {
      const s = hotspots[i];
      if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return s;
    }
    return null;
  }

  overlay.addEventListener("mousemove", (e) => {
    const r = overlay.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (W / r.width);
    mouse.y = (e.clientY - r.top) * (H / r.height);
    overlay.style.cursor = hitHotspot(mouse.x, mouse.y) ? "pointer" : "default";
  });

  overlay.addEventListener("click", (e) => {
    const r = overlay.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width);
    const py = (e.clientY - r.top) * (H / r.height);
    if (fade.dir !== 0 || fade.alpha > 0.35) return;
    const s = hitHotspot(px, py);
    if (s) { clickSound(true); s.cb(); }
    else if (current && current.click) current.click(px, py);
  });

  // ------------------------------------------------------------ drawing
  function clear(colour) {
    ctx.clearRect(0, 0, W, H);
    if (colour) { ctx.fillStyle = colour; ctx.fillRect(0, 0, W, H); }
  }

  function text(str, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = (opts.size || 22) + "px " + (opts.font || "Georgia, serif");
    ctx.fillStyle = opts.colour || "#e8e4da";
    ctx.textAlign = opts.align || "left";
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function wrapText(str, x, y, maxWidth, lineHeight, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = (opts.size || 22) + "px " + (opts.font || "Georgia, serif");
    ctx.fillStyle = opts.colour || "#e8e4da";
    ctx.textAlign = opts.align || "left";
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
    const words = String(str).split(" ");
    let line = "";
    let yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
    return yy + lineHeight;
  }

  function panel(x, y, w, h, opts) {
    opts = opts || {};
    ctx.save();
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 0.92;
    ctx.fillStyle = opts.fill || "#17151d";
    ctx.strokeStyle = opts.stroke || "#8b8474";
    ctx.lineWidth = opts.lineWidth != null ? opts.lineWidth : 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, opts.radius != null ? opts.radius : 10);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    if (ctx.lineWidth > 0) ctx.stroke();
    ctx.restore();
  }

  // Option buttons with UI-drift applied: spacing widens, hover can invert,
  // options fade in one at a time at high drift.
  function optionButtons(options, baseX, baseY, width, opts) {
    opts = opts || {};
    const d = opts.noDrift ? 0 : driftLevel();
    const rng = createRng(deriveSeed(hashString(currentName + options.length), "optdrift" + day()));
    let y = baseY;
    options.forEach((opt, i) => {
      const revealed = opts.noDrift || d < 0.55 || sceneTime > 0.3 + i * 0.35;
      if (!revealed) return;
      const jx = d > 0.25 ? (rng.next() - 0.5) * d * 160 : 0;
      const gap = 58 + d * 26;
      const bx = baseX + jx;
      const by = y;
      const bw = width;
      const bh = 46;
      const hover = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + bh;
      const invert = d > 0.75; // hover inversion late game
      const lit = invert ? !hover : hover;
      panel(bx, by, bw, bh, {
        fill: lit ? "#2b2837" : "#1a1822",
        stroke: opt.dull ? "#4b4741" : (lit ? "#c9c0a8" : "#6b6557"),
        alpha: opt.dull ? 0.8 : 0.95,
        radius: 8
      });
      text(opt.text, bx + 18, by + 30, { size: 20, colour: opt.dull ? "#8d887c" : "#e8e4da" });
      hotspot(bx, by, bw, bh, opt.cb);
      y += gap;
    });
    return y;
  }

  function simpleButton(label, x, y, w, cb, opts) {
    opts = opts || {};
    const bh = opts.h || 46;
    const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + bh;
    panel(x, y, w, bh, { fill: hover ? "#2b2837" : "#1a1822", stroke: hover ? "#c9c0a8" : "#6b6557", radius: 8 });
    text(label, x + w / 2, y + bh / 2 + 7, { size: 20, align: "center" });
    hotspot(x, y, w, bh, cb);
  }

  // ---------------------------------------------------- world visibility
  function showWorld(roomNumber, creatureSeed, worldOpts) {
    overlayOpaque = false;
    window.roomRenderAPI.showCreature(roomNumber, creatureSeed, worldOpts || {});
  }

  function hideWorld() {
    overlayOpaque = true;
    window.roomRenderAPI.setPaused(true);
  }

  let overlayOpaque = true;

  // ------------------------------------------------------------- loop
  let lastT = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    sceneTime += dt;
    hotspots = [];
    ctx.clearRect(0, 0, W, H);
    if (overlayOpaque) { ctx.fillStyle = "#101018"; ctx.fillRect(0, 0, W, H); }
    if (current && current.draw) current.draw(ctx, dt);

    // fade layer
    if (fade.dir !== 0) {
      fade.alpha += fade.dir * fade.speed * dt;
      if (fade.dir > 0 && fade.alpha >= 1) {
        fade.alpha = 1; fade.dir = 0;
        if (fade.cb) { const cb = fade.cb; fade.cb = null; cb(); }
      }
      if (fade.dir < 0 && fade.alpha <= 0) { fade.alpha = 0; fade.dir = 0; }
    }
    if (fade.alpha > 0) {
      ctx.fillStyle = "rgba(5,5,8," + fade.alpha + ")";
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((t) => { lastT = t; requestAnimationFrame(frame); });

  // ------------------------------------------------------- hilbert bank
  const HILBERT_AXIOMS = [
    "in order for something to be done, you must do it",
    "every room is occupied by the one who is in it",
    "a space becomes available when it is made so",
    "movement is the process of becoming elsewhere",
    "if you have not arrived, you are still on your way",
    "there is always another place to stand",
    "what changes position remains the same in number",
    "a door is open when it is not closed",
    "nothing is lost when it is relocated",
    "you are where you are until you are not",
    "the room you left is still occupied",
    "everything has been accounted for",
    "you may proceed when you proceed",
    "nothing resolves without involvement",
    "that which is unattended remains",
    "you do not need to continue",
    "the door has not moved",
    "you may leave when you leave",
    "there is no requirement to proceed"
  ];

  const FALSE_TRUTHS = [
    ["tasks conclude when completed", "once you do it, it's done."],
    ["assistance reduces future need", "helping now makes things easier later."],
    ["the elevator operates consistently", "it's a bit fiddly, but it works the same way."],
    ["totals reflect completion", "you'll know when you're done."],
    ["progress is linear", "you just go step by step."],
    ["departure typically follows completion", "people usually leave once they've finished everything."],
    ["patterns become clearer over time", "it starts making more sense the longer you stay."],
    ["most guests prefer to be understood", "yeah, people just want to be heard."]
  ];

  return {
    ctx, W, H,
    hashString, deriveSeed, createRng,
    get S() { return S; },
    save, load, wipe, freshState,
    day, weekday, WEEKDAYS,
    applyEffects, logChoice, interpretationBias, dominantStyle, neutralUnlocked, driftLevel,
    clickSound, startHum, stopHum, tannoyChime,
    registerScene, go, hardGo, hotspot, optionButtons, simpleButton,
    clear, text, wrapText, panel,
    showWorld, hideWorld,
    get sceneTime() { return sceneTime; },
    get mouse() { return mouse; },
    get currentName() { return currentName; },
    HILBERT_AXIOMS, FALSE_TRUTHS
  };
})();
