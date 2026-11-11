const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const hint = document.getElementById("hint");
const TAU = Math.PI * 2;
const UI_FONT = "danifont, monospace";

const soundManifest = {
  playerShoot: { src: "sounds/game%20sounds/playershoot.ogg", volume: 0.35 },
  enemyShoot: { src: "sounds/game%20sounds/enemyprojectile.ogg", volume: 0.25 },
  playerHit: { src: "sounds/game%20sounds/playerhit.ogg", volume: 0.55 },
  enemyDestroyed: { src: "sounds/game%20sounds/enemy-destroyed.ogg", volume: 0.40 },
  pickupHeart: { src: "sounds/game%20sounds/pickup-heart.ogg", volume: 0.45 },
  pickupFireRate: { src: "sounds/game%20sounds/pickup-fire-rate.ogg", volume: 0.45 },
  shieldSpawn: { src: "sounds/game%20sounds/shieldspawn.ogg", volume: 0.55 },
  shieldCollect: { src: "sounds/game%20sounds/activateshield.ogg", volume: 0.55 },
  shieldBlock: { src: "sounds/game%20sounds/shieldblock.ogg", volume: 0.38 },
  shieldClear: { src: "sounds/game%20sounds/shieldclear.ogg", volume: 0.50 },
  splitterBurst: { src: "sounds/game%20sounds/enemyrumble.ogg", volume: 0.38 },
  soundtrack: { src: "sounds/UI%20sounds/soundtrack1-crashing%20waves.ogg", volume: 0.8 },  
  gameOver: { src: "sounds/game%20sounds/gameover.ogg", volume: 0.55 }
};


const soundState = {
  enabled: true,
  unlocked: false,
  cache: {}
};
const soundPools = {};
const state = {
  debug: false,
  started: false,
  score: 0,
  highScore: Number(localStorage.getItem("cosmicCrashHighScore") || 0),
  gameOver: false,
    blueFragments: [],
  mouseDown: false,

  stars: [],
  projectiles: [],
  enemies: [],
  enemyProjectiles: [],
  fragments: [],
  seaMines: [],
  seaMineSpikes: [],
  shieldBosses: [],
  shieldBossImpacts: [],
  pickups: [],
  enemyExplosions: [],
  thrusterParticles: [],

  fireCooldownTimer: 0
};

const player = {
  z: 0,
  hp: 3,
  maxHp: 3,
  hitRadius: 36,
  shield: false,
  flashTimer: 0,
  flashDuration: 22
};

const playerWeapon = {
  fireCooldown: 12,
  startFireCooldown: 12,
  minFireCooldown: 5
};

const damagePlane = {
  enemy: 0.08,
  projectile: 0.05
};

const pickupSettings = {
  timer: 0,
  startInterval: 60 * 12,
  maxInterval: 60 * 45,
  intervalGrowth: 60 * 9,
  nextInterval: 60 * 12,
  fireRateChanceWhenHealthy: 0.30,
  shieldUnlockScore: 10000,
  shieldBurstDuration: 80
};

const triangleEnemySettings = {
  unlockScore: 5000,
  chanceAfterUnlock: 0.32,
  pinkChance: 0.50
};

const orangeEnemySettings = {
  unlockScore: 2500,
  chanceAfterUnlock: 0.28
};

const seaMineSettings = {
  unlockScore: 7500,
  previousOverlapActive: false,
  debugQueued: false,
  spawnCooldown: 0,
  cooldownDuration: 60 * 22,
  growDuration: 150,
  warningDuration: 70,
  fadeDuration: 26,
  startRadius: 8,
  maxRadiusScale: 0.25,
  spikeCount: 8
};

const shieldBossSettings = {
  unlockScore: 12000,
  spawned: false,
  growDuration: 180,
  idleDuration: 60 * 5,
  holeSweepDuration: 140,
  holeRadiusScale: 0.25,
  startRadius: 4,
  maxRadiusScale: 0.46
};

const spawnWaves = {
  frame: 0,

  timeSurvived: {
    value: 0,
    rampSpeed: 0.00045
  },

  green: {
    baseFrequency: 0.012,
    phaseOffset: 0,
    deadZone: 0.34,
    baseMagnitude: 0.018,
    frequency: 0.012,
    magnitude: 0.018,
    rate: 0,
    raw: 0,
    shaped: 0
  },

  yellow: {
    baseFrequency: 0.0045,
    phaseOffset: Math.PI * 1.1,
    deadZone: 0.42,
    baseMagnitude: 0.008,
    frequency: 0.0045,
    magnitude: 0.008,
    rate: 0,
    raw: 0,
    shaped: 0
  },

  overlapThreshold: 0.18,
  overlapActive: false
};

const GAME_OVER_TEXT = {
  title: "GAME OVER",
  restart: "Press R to restart"
};

const mouse = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2
};

const camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  zoom: 1.1,
  followSpeed: 0.04,
  maxPan: 90,
  shake: 0
};

const crosshair = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 10
};

const aimBox = {
  width: 220,
  height: 160
};

const ship = {
  nose: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    followSpeed: 0.18
  },

  hull: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    width: 95,
    height: 62,
    color: "lightpink",
    damageColor: "#ff4a4a",
    followSpeed: 0.08,
    maxDriftFromParent: 55
  },

  rear: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    followSpeed: 0.05,
    maxDriftFromParent: 45
  },

  noseSphere: {
    radiusX: 10,
    radiusY: 10,
    color: "lightgrey",
    damageColor: "#ffb0b0"
  },

  cockpit: {
    radiusX: 18,
    radiusY: 11,
    color: "purple",
    damageColor: "#ff1111"
  },

  cockpitShadow: {
    radiusX: 22,
    radiusY: 14,
    color: "dimgray",
    damageColor: "#7a0000"
  },

  thruster: {
    radiusX: 16,
    radiusY: 9,
    color: "gray",
    damageColor: "#ff7777",
    separation: 20
  }
};
function updateSoundtrack() {
  if (!soundState.enabled || !soundState.unlocked) return;

  const soundtrack = getSound("soundtrack");
  if (!soundtrack) return;

  soundtrack.loop = true;
  soundtrack.volume = soundManifest.soundtrack.volume;

  if (!soundtrack.paused && !soundtrack.ended) return;

  soundtrack.play().catch(() => {});
}

function startGame() {
  if (state.started) return;

  state.started = true;
  unlockAudio();
  updateSoundtrack();
}

function setFont(size) {
  ctx.font = `${size}px ${UI_FONT}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function getSound(name) {
  if (!soundManifest[name]) return null;

  if (!soundState.cache[name]) {
    const sound = new Audio(soundManifest[name].src);
    sound.preload = "none";
    sound.volume = soundManifest[name].volume;
    soundState.cache[name] = sound;
  }

  return soundState.cache[name];
}

function unlockAudio() {
  if (soundState.unlocked) return;

  soundState.unlocked = true;

  for (const name of Object.keys(soundManifest)) {
    getSound(name);
  }
}

function playSound(name) {
  if (!soundState.enabled || !soundState.unlocked) return;

  if (name === "playerShoot") {
    playPooledSound(name, 8);
    return;
  }

  if (name === "enemyShoot") {
    playPooledSound(name, 4);
    return;
  }

  const sound = getSound(name);
  if (!sound) return;

  sound.pause();
  sound.currentTime = 0;
  sound.volume = soundManifest[name].volume;
  sound.play().catch(() => {});
}

function playPooledSound(name, poolSize = 8) {
  if (!soundManifest[name]) return;

  if (!soundPools[name]) {
    soundPools[name] = [];

    for (let i = 0; i < poolSize; i++) {
      const sound = new Audio(soundManifest[name].src);
      sound.preload = "auto";
      sound.volume = soundManifest[name].volume;
      soundPools[name].push(sound);
    }
  }

  const pool = soundPools[name];

  let sound = pool.find(s => s.paused || s.ended);

  if (!sound) {
    sound = pool[0];
    sound.pause();
    sound.currentTime = 0;
  }

  sound.currentTime = 0;
  sound.volume = soundManifest[name].volume;
  sound.play().catch(() => {});
}

function angleBetween(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function isPlayerFlashing() {
  return player.flashTimer > 0;
}

function isShieldActive() {
  return player.shield && !state.mouseDown;
}

function shipColor(part) {
  return isPlayerFlashing() ? part.damageColor || "#ff3333" : part.color;
}

function followPoint(follower, target, speed = follower.followSpeed) {
  follower.x = lerp(follower.x, target.x, speed);
  follower.y = lerp(follower.y, target.y, speed);
}

function capDistanceFromParent(child, parent, maxDistance = child.maxDriftFromParent) {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= maxDistance) return;

  const angle = Math.atan2(dy, dx);
  child.x = parent.x + Math.cos(angle) * maxDistance;
  child.y = parent.y + Math.sin(angle) * maxDistance;
}

function beginFade(object, duration = 12) {
  if (object.fading) return;

  object.fading = true;
  object.fadeTimer = duration;
  object.fadeDuration = duration;
}

function updateFade(object) {
  if (!object.fading) return false;

  object.fadeTimer -= 1;
  return object.fadeTimer <= 0;
}

function getFadeAlpha(object) {
  if (!object.fading) return 1;
  return clamp(object.fadeTimer / object.fadeDuration, 0, 1);
}

function isInDangerPlane(z, threshold = damagePlane.enemy) {
  return z <= player.z + threshold;
}

function drawDangerGlow(drawPathFn, lineWidth = 3) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = lineWidth;
  drawPathFn();
  ctx.stroke();
  ctx.restore();
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - canvas.width / 2) / camera.zoom + canvas.width / 2 + camera.x,
    y: (screenY - canvas.height / 2) / camera.zoom + canvas.height / 2 + camera.y
  };
}

function getVisibleWorldBounds() {
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(canvas.width, canvas.height);

  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y
  };
}

function countEnemiesByType(type) {
  let count = 0;

  for (const enemy of state.enemies) {
    if (enemy.type === type) count += 1;
  }

  return count;
}

function resetPositions() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  mouse.x = centerX;
  mouse.y = centerY;

  crosshair.x = centerX;
  crosshair.y = centerY;

  ship.nose.x = centerX;
  ship.nose.y = centerY;

  ship.hull.x = centerX;
  ship.hull.y = centerY;

  ship.rear.x = centerX;
  ship.rear.y = centerY;

  camera.x = 0;
  camera.y = 0;
  camera.targetX = 0;
  camera.targetY = 0;
  camera.shake = 0;

  player.hp = player.maxHp;
  player.shield = false;
  player.flashTimer = 0;

  playerWeapon.fireCooldown = playerWeapon.startFireCooldown;

  state.score = 0;
  state.mouseDown = false;
  state.projectiles.length = 0;
  state.enemies.length = 0;
  state.enemyProjectiles.length = 0;
  state.fragments.length = 0;
  state.seaMines.length = 0;
  state.seaMineSpikes.length = 0;
  state.shieldBosses.length = 0;
  state.shieldBossImpacts.length = 0;
  state.pickups.length = 0;
  state.thrusterParticles.length = 0;
  state.enemyExplosions.length = 0;
  state.fireCooldownTimer = 0;

  pickupSettings.timer = 0;
  pickupSettings.nextInterval = pickupSettings.startInterval;

  spawnWaves.frame = 0;
  spawnWaves.timeSurvived.value = 0;

  spawnWaves.green.frequency = spawnWaves.green.baseFrequency;
  spawnWaves.yellow.frequency = spawnWaves.yellow.baseFrequency;

  spawnWaves.green.magnitude = spawnWaves.green.baseMagnitude;
  spawnWaves.yellow.magnitude = spawnWaves.yellow.baseMagnitude;

  spawnWaves.green.rate = 0;
  spawnWaves.yellow.rate = 0;
  spawnWaves.green.raw = 0;
  spawnWaves.yellow.raw = 0;
  spawnWaves.green.shaped = 0;
  spawnWaves.yellow.shaped = 0;
  spawnWaves.overlapActive = false;

  seaMineSettings.previousOverlapActive = false;
  seaMineSettings.debugQueued = false;
  seaMineSettings.spawnCooldown = 0;
  shieldBossSettings.spawned = false;
}

function createStars(count) {
  state.stars.length = 0;

  const padding = 300;

  for (let i = 0; i < count; i++) {
    state.stars.push({
      x: Math.random() * (canvas.width + padding * 2) - padding,
      y: Math.random() * (canvas.height + padding * 2) - padding,
      radius: Math.random() * 1.8 + 0.4,
      brightness: Math.floor(Math.random() * 100) + 155
    });
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  resetPositions();
  state.gameOver = false;
  createStars(180);
}

function updateDebugVisibility() {
  hint.classList.toggle("hidden", !state.debug);
}

function updateCamera() {
  const normalizedMouseX = (mouse.x - canvas.width / 2) / (canvas.width / 2);
  const normalizedMouseY = (mouse.y - canvas.height / 2) / (canvas.height / 2);

  camera.targetX = normalizedMouseX * camera.maxPan;
  camera.targetY = normalizedMouseY * camera.maxPan;

  camera.x = lerp(camera.x, camera.targetX, camera.followSpeed);
  camera.y = lerp(camera.y, camera.targetY, camera.followSpeed);
  camera.shake *= 0.82;

  if (camera.shake < 0.05) {
    camera.shake = 0;
  }
}

function updateShip() {
  followPoint(ship.nose, mouse);

  followPoint(ship.hull, ship.nose);
  capDistanceFromParent(ship.hull, ship.nose);

  followPoint(ship.rear, ship.hull);
  capDistanceFromParent(ship.rear, ship.hull);
}

function getThrusterEmitterPoints() {
  const angle = angleBetween(ship.hull, ship.rear);
  const sideAngle = angle + Math.PI / 2;

  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = Math.cos(sideAngle);
  const sideY = Math.sin(sideAngle);

  const offsets = [ship.thruster.separation, -ship.thruster.separation];

  return offsets.map((offset) => ({
    x: ship.rear.x + sideX * offset + forwardX * ship.thruster.radiusX,
    y: ship.rear.y + sideY * offset + forwardY * ship.thruster.radiusX
  }));
}

function spawnThrusterParticles() {
  for (const point of getThrusterEmitterPoints()) {
    state.thrusterParticles.push({
      x: point.x,
      y: point.y,
      radius: 2 + Math.random() * 2.5,
      life: 24,
      duration: 24
    });
  }

  if (state.thrusterParticles.length > 140) {
    state.thrusterParticles.splice(0, state.thrusterParticles.length - 140);
  }
}
function spawnEnemyExitExplosion(enemy) {
  state.enemyExplosions.push({
    x: enemy.x,
    y: enemy.y,
    radius: 0,
    maxRadius: getEnemyExitExplosionRadius(enemy),
    age: 0,
    duration: 22,
    damageDone: false,
    color: getEnemyExitExplosionColor(enemy)
  });
}

function getEnemyExitExplosionRadius(enemy) {
  if (enemy.type === "orangeOctagon") return 90;
  if (enemy.type === "yellowSpinner") return 76;
  if (enemy.type === "cyanTriangle" || enemy.type === "pinkTriangle") return 64;

  return 72;
}

function getEnemyExitExplosionColor(enemy) {
  if (enemy.type === "greenShooter") return "rgba(40, 223, 85, 0.75)";
  if (enemy.type === "yellowSpinner") return "rgba(255, 212, 59, 0.75)";
  if (enemy.type === "orangeOctagon") return "rgba(255, 140, 36, 0.75)";
  if (enemy.type === "cyanTriangle") return "rgba(56, 243, 255, 0.75)";
  if (enemy.type === "pinkTriangle") return "rgba(255, 90, 180, 0.75)";

  return "rgba(255, 120, 60, 0.75)";
}
function updateEnemyExplosions() {
  if (state.gameOver) return;

  for (let i = state.enemyExplosions.length - 1; i >= 0; i--) {
    const explosion = state.enemyExplosions[i];

    explosion.age += 1;

    const t = explosion.age / explosion.duration;
    const eased = smoothstep(t);

    explosion.radius = explosion.maxRadius * eased;

    const dx = explosion.x - ship.hull.x;
    const dy = explosion.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    const hitPlayer =
      !explosion.damageDone &&
      distanceToPlayer < player.hitRadius + explosion.radius;

    if (hitPlayer) {
      damagePlayer();
      explosion.damageDone = true;
    }

    if (explosion.age >= explosion.duration) {
      state.enemyExplosions.splice(i, 1);
    }
  }
}

function updateThrusterParticles() {
  for (let i = state.thrusterParticles.length - 1; i >= 0; i--) {
    const particle = state.thrusterParticles[i];
    particle.life -= 1;

    if (particle.life <= 0) {
      state.thrusterParticles.splice(i, 1);
    }
  }
}

function updateCrosshairFromAimBox() {
  const boxLeft = ship.hull.x - aimBox.width / 2;
  const boxTop = ship.hull.y - aimBox.height / 2;

  const localX = (mouse.x - boxLeft) / aimBox.width;
  const localY = (mouse.y - boxTop) / aimBox.height;

  const normalizedX = clamp(localX, 0, 1);
  const normalizedY = clamp(localY, 0, 1);

  crosshair.x = normalizedX * canvas.width;
  crosshair.y = normalizedY * canvas.height;
}

function damagePlayer() {
  if (state.gameOver) return;

  player.hp = Math.max(0, player.hp - 1);
  player.flashTimer = player.flashDuration;
  camera.shake = Math.max(camera.shake, 8);
  playSound("playerHit");

  if (player.hp <= 0) endGame();
}

function endGame() {
  state.gameOver = true;
  state.mouseDown = false;
  playSound("gameOver");

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("cosmicCrashHighScore", String(state.highScore));
  }
}

function restartGame() {
  resetPositions();
  state.gameOver = false;
}

function fireProjectile() {
  if (state.gameOver) return;
  if (state.fireCooldownTimer > 0) return;

  const target = screenToWorld(crosshair.x, crosshair.y);

  state.projectiles.push({
    startX: ship.hull.x,
    startY: ship.hull.y,
    targetX: target.x,
    targetY: target.y,
    progress: 0,
    speed: 0.045,
    baseRadius: ship.hull.height * 0.5,
    color: "rgba(255, 245, 255, 0.95)",
    fading: false,
    fadeTimer: 0,
    fadeDuration: 0
  });

  state.fireCooldownTimer = playerWeapon.fireCooldown;
  playSound("playerShoot");
}

function updatePlayerWeapon() {
  if (state.fireCooldownTimer > 0) {
    state.fireCooldownTimer -= 1;
  }

  if (state.mouseDown) {
    fireProjectile();
  }
}

function getProjectilePosition(projectile) {
  return {
    x: lerp(projectile.startX, projectile.targetX, projectile.progress),
    y: lerp(projectile.startY, projectile.targetY, projectile.progress)
  };
}

function getProjectileRadius(projectile) {
  return projectile.baseRadius * Math.max(0, 1 - projectile.progress);
}

function updateProjectiles() {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];

    if (projectile.fading) {
      if (updateFade(projectile)) {
        state.projectiles.splice(i, 1);
      }

      continue;
    }

    projectile.progress += projectile.speed;

    if (projectile.progress >= 1) {
      projectile.progress = 1;
      beginFade(projectile, 10);
    }
  }
}

function createEnemyBase(type) {
  const bounds = getVisibleWorldBounds();
  const padding = 80;

  const x = Math.random() * (bounds.right - bounds.left + padding * 2) + bounds.left - padding;
  const y = Math.random() * (bounds.bottom - bounds.top + padding * 2) + bounds.top - padding;

  return {
    type,
    x,
    y,
    z: 1,
    rotation: Math.random() * TAU,
    farRadius: 1.2
  };
}

function createYellowHexagonData(x, y, z, offsetAngle = 0) {
  const offsetDistance = 42;

  return {
    type: "yellowSpinner",

    x: x + Math.cos(offsetAngle) * offsetDistance,
    y: y + Math.sin(offsetAngle) * offsetDistance,
    z,

    rotation: Math.random() * TAU,
    farRadius: 1.2,

    hp: 2,
    scoreValue: 250,
    zSpeed: 0.0034,
    minFollowSpeed: 0.001,
    maxFollowSpeed: 0.042,
    nearRadius: 38,

    spin: 0.09 * (Math.random() < 0.5 ? -1 : 1),

    color: "#ffd43b",
    darkColor: "#b8860b",
    lightColor: "#fff3a3"
  };
}

function spawnGreenShooter() {
  if (state.gameOver) return;

  const enemy = {
    ...createEnemyBase("greenShooter"),

    hp: 1,
    scoreValue: 100,
    zSpeed: 0.003,
    minFollowSpeed: 0.001,
    maxFollowSpeed: 0.035,
    nearRadius: 34,

    shootTimer: 80 + Math.random() * 90,
    shootCooldownMin: 90,
    shootCooldownMax: 160,

    spin: (Math.random() - 0.5) * 0.03,

    color: "#ff3b3b",
    darkColor: "#8f1010",
    lightColor: "#ffb0b0"
  };

  state.enemies.push(enemy);
}

function spawnYellowHexagon() {
  if (state.gameOver) return;

  const base = createEnemyBase("yellowSpinner");
  const enemy = createYellowHexagonData(base.x, base.y, base.z, 0);

  enemy.x = base.x;
  enemy.y = base.y;
  enemy.rotation = base.rotation;

  state.enemies.push(enemy);
}

function spawnYellowHexagonAt(x, y, z = 0.72, offsetAngle = 0) {
  if (state.gameOver) return;
  state.enemies.push(createYellowHexagonData(x, y, z, offsetAngle));
}

function createTriangleEnemy(type, color, darkColor, lightColor) {
  return {
    ...createEnemyBase(type),

    hp: 1,
    scoreValue: 180,
    zSpeed: 0.003,
    minFollowSpeed: 0.001,
    maxFollowSpeed: 0.035,
    nearRadius: 34,

    shootTimer: 80 + Math.random() * 90,
    shootCooldownMin: 90,
    shootCooldownMax: 160,

    spin: (Math.random() - 0.5) * 0.03,

    color,
    darkColor,
    lightColor
  };
}

function spawnCyanTriangle() {
  if (state.gameOver) return;
  if (state.score < triangleEnemySettings.unlockScore) return;

  state.enemies.push(createTriangleEnemy(
    "cyanTriangle",
    "#38f3ff",
    "#087a88",
    "#c7fbff"
  ));
}

function spawnPinkTriangle() {
  if (state.gameOver) return;
  if (state.score < triangleEnemySettings.unlockScore) return;

  state.enemies.push(createTriangleEnemy(
    "pinkTriangle",
    "#ff5fc8",
    "#9a1b70",
    "#ffd1f0"
  ));
}

function spawnOrangeOctagon() {
  if (state.gameOver) return;
  if (state.score < orangeEnemySettings.unlockScore) return;

  const enemy = {
    ...createEnemyBase("orangeOctagon"),

    hp: 2,
    scoreValue: 350,
    zSpeed: 0.0032,
    minFollowSpeed: 0.001,
    maxFollowSpeed: 0.038,
    nearRadius: 42,

    spin: 0.055 * (Math.random() < 0.5 ? -1 : 1),

    color: "#ff8c24",
    darkColor: "#9a3f00",
    lightColor: "#ffd18a"
  };

  state.enemies.push(enemy);
}

function spawnTriangleTwin() {
  if (Math.random() < triangleEnemySettings.pinkChance) {
    spawnPinkTriangle();
  } else {
    spawnCyanTriangle();
  }
}

function spawnGreenOrTriangleShooter() {
  if (
    state.score >= triangleEnemySettings.unlockScore &&
    Math.random() < triangleEnemySettings.chanceAfterUnlock
  ) {
    spawnTriangleTwin();
    return;
  }

  spawnGreenShooter();
}

function spawnYellowOrOrangeEnemy() {
  if (
    state.score >= orangeEnemySettings.unlockScore &&
    Math.random() < orangeEnemySettings.chanceAfterUnlock
  ) {
    spawnOrangeOctagon();
    return;
  }

  spawnYellowHexagon();
}

function splitOrangeOctagon(enemy) {
  const angle = Math.random() * TAU;
  const z = Math.max(enemy.z, 0.35);

  playSound("splitterBurst");
  spawnYellowHexagonAt(enemy.x, enemy.y, z, angle);
  spawnYellowHexagonAt(enemy.x, enemy.y, z, angle + Math.PI);
}

function fireEnemyProjectile(enemy) {
  const isCyan = enemy.type === "cyanTriangle";
  const isPink = enemy.type === "pinkTriangle";

  state.enemyProjectiles.push({
    kind: isCyan
      ? "blueCardinalSplitter"
      : isPink
        ? "pinkDiagonalSplitter"
        : "redShot",

    x: enemy.x,
    y: enemy.y,

    targetX: ship.hull.x,
    targetY: ship.hull.y,

    z: enemy.z,
    zSpeed: 0.006,

    farRadius: 1,
    nearRadius: 18,

    color: isCyan
      ? "rgba(255, 95, 200, 0.95)"
      : isPink
        ? "rgba(75, 165, 255, 0.95)"
        : "rgba(40, 223, 85, 0.95)",

    highlightColor: isCyan
      ? "rgba(255, 225, 245, 0.7)"
      : isPink
        ? "rgba(210, 235, 255, 0.7)"
        : "rgba(185, 255, 105, 0.7)",

    fading: false,
    fadeTimer: 0,
    fadeDuration: 0
  });

  playSound("enemyShoot");
}

function spawnSplitFragments(projectile) {
  const speed = 5.2;
  const diagonal = speed / Math.sqrt(2);

  const isPink = projectile.kind === "pinkDiagonalSplitter";

  const directions = isPink
    ? [
        { vx: diagonal, vy: -diagonal },
        { vx: diagonal, vy: diagonal },
        { vx: -diagonal, vy: diagonal },
        { vx: -diagonal, vy: -diagonal }
      ]
    : [
        { vx: 0, vy: -speed },
        { vx: speed, vy: 0 },
        { vx: 0, vy: speed },
        { vx: -speed, vy: 0 }
      ];

  for (const direction of directions) {
    state.fragments.push({
      x: projectile.x,
      y: projectile.y,
      vx: direction.vx,
      vy: direction.vy,
      radius: 7,
      color: isPink
        ? "rgba(255, 95, 200, 0.95)"
        : "rgba(75, 165, 255, 0.95)",
      highlightColor: isPink
        ? "rgba(255, 225, 245, 0.75)"
        : "rgba(225, 245, 255, 0.75)",
      hitPlayer: false,
      fading: false,
      fadeTimer: 0,
      fadeDuration: 0
    });
  }

  playSound("splitterBurst");
}

function updateEnemyMovement(enemy) {
  enemy.z -= enemy.zSpeed;
  enemy.rotation += enemy.spin;

  const closeness = clamp(1 - enemy.z, 0, 1);
  const easedCloseness = smoothstep(closeness);

  const currentFollowSpeed = lerp(
    enemy.minFollowSpeed,
    enemy.maxFollowSpeed,
    easedCloseness
  );

  enemy.x = lerp(enemy.x, ship.hull.x, currentFollowSpeed);
  enemy.y = lerp(enemy.y, ship.hull.y, currentFollowSpeed);
}
    function spawnBlueFragments(projectile) {
      const speed = 5.2;

      const fragments = [
        { vx: 0, vy: -speed },
        { vx: speed, vy: 0 },
        { vx: 0, vy: speed },
        { vx: -speed, vy: 0 }
      ];

      for (const fragment of fragments) {
        state.blueFragments.push({
          x: projectile.x,
          y: projectile.y,
          vx: fragment.vx,
          vy: fragment.vy,
          radius: 7,
          color: "rgba(75, 165, 255, 0.95)",
          hitPlayer: false
        });
      }
    }

function updateShooter(enemy) {
  enemy.shootTimer -= 1;

  if (enemy.shootTimer <= 0 && enemy.z > player.z + 0.18) {
    fireEnemyProjectile(enemy);

    enemy.shootTimer =
      enemy.shootCooldownMin +
      Math.random() * (enemy.shootCooldownMax - enemy.shootCooldownMin);
  }
}

function shapedSineWave(frame, wave) {
  const raw = (Math.sin(frame * wave.frequency + wave.phaseOffset) + 1) / 2;
  const lifted = clamp((raw - wave.deadZone) / (1 - wave.deadZone), 0, 1);
  const shaped = smoothstep(lifted);

  return { raw, shaped };
}

function hasActiveSeaMine() {
  return state.seaMines.length > 0;
}

function hasActiveShieldBoss() {
  return state.shieldBosses.length > 0;
}

function maybeSpawnSeaMine() {
  const debugQueued = seaMineSettings.debugQueued;

  if (hasActiveShieldBoss()) return;
  if (!debugQueued && state.score < seaMineSettings.unlockScore) return;
  if (!spawnWaves.overlapActive || seaMineSettings.previousOverlapActive) return;
  if ((!debugQueued && seaMineSettings.spawnCooldown > 0) || hasActiveSeaMine()) return;

  spawnSeaMine();
  seaMineSettings.debugQueued = false;
  seaMineSettings.spawnCooldown = seaMineSettings.cooldownDuration;
}

function maybeSpawnShieldBoss() {
  if (shieldBossSettings.spawned) return;
  if (state.score < shieldBossSettings.unlockScore) return;

  spawnShieldBoss();
  shieldBossSettings.spawned = true;
}

function updateSpawnWaves() {
  if (state.gameOver) return;

  spawnWaves.frame += 1;
  spawnWaves.timeSurvived.value += spawnWaves.timeSurvived.rampSpeed;

  if (seaMineSettings.spawnCooldown > 0) {
    seaMineSettings.spawnCooldown -= 1;
  }

  const timeSurvived = spawnWaves.timeSurvived.value;

  spawnWaves.green.frequency =
    spawnWaves.green.baseFrequency +
    timeSurvived * 0.018;

  spawnWaves.yellow.frequency =
    spawnWaves.yellow.baseFrequency +
    timeSurvived * 0.009;

  spawnWaves.green.magnitude =
    spawnWaves.green.baseMagnitude +
    Math.sqrt(timeSurvived) * 0.030;

  spawnWaves.yellow.magnitude =
    spawnWaves.yellow.baseMagnitude +
    Math.sqrt(timeSurvived) * 0.018;

  const greenWave = shapedSineWave(spawnWaves.frame, spawnWaves.green);
  const yellowWave = shapedSineWave(spawnWaves.frame, spawnWaves.yellow);

  spawnWaves.green.raw = greenWave.raw;
  spawnWaves.yellow.raw = yellowWave.raw;
  spawnWaves.green.shaped = greenWave.shaped;
  spawnWaves.yellow.shaped = yellowWave.shaped;

  let greenRate = greenWave.shaped * spawnWaves.green.magnitude;
  let yellowRate = yellowWave.shaped * spawnWaves.yellow.magnitude;

  const greenIsActive = greenWave.shaped > spawnWaves.overlapThreshold;
  const yellowIsActive = yellowWave.shaped > spawnWaves.overlapThreshold;

  spawnWaves.overlapActive = greenIsActive && yellowIsActive;
  maybeSpawnSeaMine();
  maybeSpawnShieldBoss();

  if (spawnWaves.overlapActive || hasActiveSeaMine() || hasActiveShieldBoss()) {
    greenRate = 0;
    yellowRate = 0;
  }

  spawnWaves.green.rate = greenRate;
  spawnWaves.yellow.rate = yellowRate;

  if (Math.random() < greenRate) spawnGreenOrTriangleShooter();
  if (Math.random() < yellowRate) spawnYellowOrOrangeEnemy();

  seaMineSettings.previousOverlapActive = spawnWaves.overlapActive;
}

function spawnSeaMine() {
  const center = screenToWorld(canvas.width / 2, canvas.height / 2);

  state.seaMines.push({
    x: center.x,
    y: center.y,
    age: 0,
    growDuration: seaMineSettings.growDuration,
    warningDuration: seaMineSettings.warningDuration,
    startRadius: seaMineSettings.startRadius,
    maxRadiusScale: seaMineSettings.maxRadiusScale,
    spikeCount: seaMineSettings.spikeCount,
    exploded: false,
    fading: false,
    fadeTimer: 0,
    fadeDuration: 0
  });
}

function getSeaMinePhase(mine) {
  if (mine.fading) return "fade";
  if (mine.age < mine.growDuration) return "grow";
  if (mine.age < mine.growDuration + mine.warningDuration) return "warn";
  return "explode";
}

function getSeaMineRadius(mine) {
  const bounds = getVisibleWorldBounds();
  const visibleWidth = bounds.right - bounds.left;
  const visibleHeight = bounds.bottom - bounds.top;
  const maxRadius = Math.min(visibleWidth, visibleHeight) * mine.maxRadiusScale;
  const t = smoothstep(mine.age / mine.growDuration);

  return lerp(mine.startRadius, maxRadius, t);
}

function explodeSeaMine(mine) {
  if (mine.exploded) return;

  mine.exploded = true;

  const radius = getSeaMineRadius(mine);
  const bounds = getVisibleWorldBounds();
  const speed = Math.min(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.009;
  const size = radius * 0.16;

  for (let i = 0; i < mine.spikeCount; i++) {
    const angle = (TAU / mine.spikeCount) * i - Math.PI / 2;

    state.seaMineSpikes.push({
      x: mine.x + Math.cos(angle) * radius * 1.04,
      y: mine.y + Math.sin(angle) * radius * 1.04,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      size,
      hitPlayer: false,
      fading: false,
      fadeTimer: 0,
      fadeDuration: 0
    });
  }

  beginFade(mine, seaMineSettings.fadeDuration);
}

function updateSeaMines() {
  if (state.gameOver) return;

  for (let i = state.seaMines.length - 1; i >= 0; i--) {
    const mine = state.seaMines[i];

    if (mine.fading) {
      if (updateFade(mine)) {
        state.seaMines.splice(i, 1);
      }

      continue;
    }

    mine.age += 1;

    if (getSeaMinePhase(mine) === "explode") {
      explodeSeaMine(mine);
    }
  }
}

function updateSeaMineSpikes() {
  if (state.gameOver) return;

  const bounds = getVisibleWorldBounds();
  const margin = 100;

  for (let i = state.seaMineSpikes.length - 1; i >= 0; i--) {
    const spike = state.seaMineSpikes[i];

    if (spike.fading) {
      if (updateFade(spike)) {
        state.seaMineSpikes.splice(i, 1);
      }

      continue;
    }

    spike.x += spike.vx;
    spike.y += spike.vy;

    const dx = spike.x - ship.hull.x;
    const dy = spike.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
    const hitRadius = Math.max(6, spike.size * 0.55);

    if (hitsActiveShield(distanceToPlayer, hitRadius)) {
      spike.hitPlayer = true;
      beginFade(spike, 10);
      playSound("shieldBlock");
      continue;
    }

    if (!spike.hitPlayer && distanceToPlayer < player.hitRadius + hitRadius) {
      damagePlayer();
      spike.hitPlayer = true;
      beginFade(spike, 10);
      continue;
    }

    const offscreen =
      spike.x < bounds.left - margin ||
      spike.x > bounds.right + margin ||
      spike.y < bounds.top - margin ||
      spike.y > bounds.bottom + margin;

    if (offscreen) {
      beginFade(spike, 10);
    }
  }
}

function spawnShieldBoss() {
  const center = screenToWorld(canvas.width / 2, canvas.height / 2);

  state.shieldBosses.push({
    x: center.x,
    y: center.y,
    age: 0,
    growDuration: shieldBossSettings.growDuration,
    startRadius: shieldBossSettings.startRadius,
    maxRadiusScale: shieldBossSettings.maxRadiusScale
  });
}

function getShieldBossRadius(boss) {
  const bounds = getVisibleWorldBounds();
  const visibleWidth = bounds.right - bounds.left;
  const visibleHeight = bounds.bottom - bounds.top;
  const maxRadius = Math.min(visibleWidth, visibleHeight) * boss.maxRadiusScale;
  const t = smoothstep(boss.age / boss.growDuration);

  return lerp(boss.startRadius, maxRadius, t);
}

function isShieldBossFullyGrown(boss) {
  return boss.age >= boss.growDuration;
}

function updateShieldBosses() {
  if (state.gameOver) return;

  for (const boss of state.shieldBosses) {
    boss.age += 1;
    maybeFireShieldBossCenterBurst(boss);
  }
}

function maybeFireShieldBossCenterBurst(boss) {
  const activeAge = boss.age - boss.growDuration - shieldBossSettings.idleDuration;

  if (activeAge < 0) return;

  const sweepDuration = shieldBossSettings.holeSweepDuration;
  const cycleAge = activeAge % (sweepDuration * 4);
  const sweepIndex = Math.floor(cycleAge / sweepDuration);
  const sweepFrame = cycleAge % sweepDuration;
  const centerFrame = Math.floor(sweepDuration / 2);
  const burstKey = `${Math.floor(activeAge / (sweepDuration * 4))}:${sweepIndex}`;

  if (sweepFrame !== centerFrame || boss.lastCenterBurstKey === burstKey) return;

  boss.lastCenterBurstKey = burstKey;
  spawnShieldBossCenterBurst(boss);
}

function spawnShieldBossCenterBurst(boss) {
  const bounds = getVisibleWorldBounds();
  const speed = Math.min(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.0065;

  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (TAU / 8) * i;

    state.fragments.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 6,
      color: "rgba(255, 255, 255, 0.95)",
      highlightColor: "rgba(255, 255, 255, 0.65)",
      hitPlayer: false,
      fading: false,
      fadeTimer: 0,
      fadeDuration: 0
    });
  }
}

function spawnShieldBossImpact(x, y) {
  state.shieldBossImpacts.push({
    x,
    y,
    radius: 4,
    maxRadius: 28,
    age: 0,
    duration: 20
  });
}

function updateShieldBossImpacts() {
  for (let i = state.shieldBossImpacts.length - 1; i >= 0; i--) {
    const impact = state.shieldBossImpacts[i];
    impact.age += 1;

    if (impact.age >= impact.duration) {
      state.shieldBossImpacts.splice(i, 1);
    }
  }
}

function checkProjectileShieldBossCollisions() {
  if (state.gameOver || !hasActiveShieldBoss()) return;

  for (let p = state.projectiles.length - 1; p >= 0; p--) {
    const projectile = state.projectiles[p];

    if (projectile.fading) continue;

    const projectilePosition = getProjectilePosition(projectile);
    const projectileRadius = getProjectileRadius(projectile);

    for (const boss of state.shieldBosses) {
      const bossRadius = getShieldBossRadius(boss);
      const dx = projectilePosition.x - boss.x;
      const dy = projectilePosition.y - boss.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bossRadius + projectileRadius) {
        spawnShieldBossImpact(projectilePosition.x, projectilePosition.y);
        beginFade(projectile, 8);
        break;
      }
    }
  }
}

function choosePickupType() {
  const shieldUnlocked = state.score >= pickupSettings.shieldUnlockScore;
  const shieldAlreadyWaiting = state.pickups.some((pickup) => pickup.type === "shield");

  if (shieldUnlocked && !player.shield && !shieldAlreadyWaiting) {
    return "shield";
  }

  if (player.hp < player.maxHp) {
    return "heart";
  }

  if (Math.random() < pickupSettings.fireRateChanceWhenHealthy) {
    return "fireRate";
  }

  return "nothing";
}

function updatePickupSpawner() {
  if (state.gameOver) return;

  pickupSettings.timer += 1;

  const timeSurvived = spawnWaves.timeSurvived.value;

  const interval = clamp(
    pickupSettings.startInterval + timeSurvived * pickupSettings.intervalGrowth,
    pickupSettings.startInterval,
    pickupSettings.maxInterval
  );

  pickupSettings.nextInterval = interval;

  if (pickupSettings.timer >= interval) {
    const pickupType = choosePickupType();

    if (pickupType !== "nothing") {
      spawnPickup(pickupType);
    }

    pickupSettings.timer = 0;
  }
}

function spawnPickup(type) {
  if (state.gameOver) return;

  const center = screenToWorld(canvas.width / 2, canvas.height / 2);

  state.pickups.push({
    type,
    x: center.x,
    y: center.y,
    z: 0.72,
    zSpeed: 0.0045,

    farRadius: 4,
    nearRadius: 24,

    age: 0,
    revealAge: 42,
    shieldBurstAge: type === "shield" ? 0 : pickupSettings.shieldBurstDuration,
    shieldBurstDuration: pickupSettings.shieldBurstDuration,

    fading: false,
    fadeTimer: 0,
    fadeDuration: 0
  });

  if (type === "shield") {
    playSound("shieldSpawn");
  }
}

function updatePickups() {
  if (state.gameOver) return;

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];

    if (pickup.fading) {
      if (updateFade(pickup)) {
        state.pickups.splice(i, 1);
      }

      continue;
    }

    pickup.age += 1;
    pickup.z -= pickup.zSpeed;

    if (pickup.type === "shield") {
      updateShieldBurst(pickup);
    }

    const radius = getPickupRadius(pickup);

    const dx = pickup.x - ship.hull.x;
    const dy = pickup.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    const closeEnoughInDepth = pickup.z <= player.z + 0.18;
    const touchingPlayer = distanceToPlayer < player.hitRadius + radius;

    if (closeEnoughInDepth && touchingPlayer && isPickupCollectable(pickup)) {
      collectPickup(pickup);
      beginFade(pickup, 10);
      continue;
    }

    if (pickup.type === "shield" && pickup.z <= player.z) {
      pickup.z = player.z;
      pickup.zSpeed = 0;
      continue;
    }

    if (pickup.z <= player.z - 0.08) {
      beginFade(pickup, 10);
    }
  }
}

function isPickupCollectable(pickup) {
  return pickup.type !== "shield" || pickup.shieldBurstAge >= pickup.shieldBurstDuration;
}

function collectPickup(pickup) {
  if (pickup.type === "heart") {
    player.hp = Math.min(player.hp + 1, player.maxHp);
    playSound("pickupHeart");
  }

  if (pickup.type === "fireRate") {
    playerWeapon.fireCooldown = Math.max(
      playerWeapon.minFireCooldown,
      playerWeapon.fireCooldown - 1
    );
    playSound("pickupFireRate");
  }

  if (pickup.type === "shield") {
    player.shield = true;
    playSound("shieldCollect");
  }
}

function getPickupRadius(pickup) {
  const closeness = clamp(1 - pickup.z, 0, 1);
  const eased = smoothstep(closeness);

  return lerp(pickup.farRadius, pickup.nearRadius, eased);
}

function getShieldBurstMaxRadius(pickup) {
  const bounds = getVisibleWorldBounds();
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ];

  let maxRadius = 0;

  for (const corner of corners) {
    const dx = corner.x - pickup.x;
    const dy = corner.y - pickup.y;
    maxRadius = Math.max(maxRadius, Math.sqrt(dx * dx + dy * dy));
  }

  return maxRadius + 80;
}

function getShieldPickupRadius(pickup) {
  const baseRadius = getPickupRadius(pickup);

  if (pickup.shieldBurstAge >= pickup.shieldBurstDuration) {
    return baseRadius;
  }

  const progress = clamp(pickup.shieldBurstAge / pickup.shieldBurstDuration, 0, 1);
  const maxRadius = getShieldBurstMaxRadius(pickup);

  if (progress < 0.5) {
    return lerp(baseRadius, maxRadius, smoothstep(progress * 2));
  }

  return lerp(maxRadius, baseRadius, smoothstep((progress - 0.5) * 2));
}

function clearProjectilesInShieldBurst(pickup, radius) {
  let cleared = false;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const dx = enemy.x - pickup.x;
    const dy = enemy.y - pickup.y;
    const enemyRadius = getEnemyRadius(enemy);

    if (Math.sqrt(dx * dx + dy * dy) <= radius + enemyRadius) {
      state.score += enemy.scoreValue;
      state.enemies.splice(i, 1);
      cleared = true;
    }
  }

  for (const projectile of state.enemyProjectiles) {
    if (projectile.fading) continue;

    const dx = projectile.x - pickup.x;
    const dy = projectile.y - pickup.y;
    const projectileRadius = getEnemyProjectileRadius(projectile);

    if (Math.sqrt(dx * dx + dy * dy) <= radius + projectileRadius) {
      beginFade(projectile, 8);
      cleared = true;
    }
  }

  for (const fragment of state.fragments) {
    if (fragment.fading) continue;

    const dx = fragment.x - pickup.x;
    const dy = fragment.y - pickup.y;

    if (Math.sqrt(dx * dx + dy * dy) <= radius + fragment.radius) {
      fragment.hitPlayer = true;
      beginFade(fragment, 10);
      cleared = true;
    }
  }

  for (const spike of state.seaMineSpikes) {
    if (spike.fading) continue;

    const dx = spike.x - pickup.x;
    const dy = spike.y - pickup.y;
    const spikeRadius = Math.max(6, spike.size * 0.55);

    if (Math.sqrt(dx * dx + dy * dy) <= radius + spikeRadius) {
      spike.hitPlayer = true;
      beginFade(spike, 10);
      cleared = true;
    }
  }

  if (cleared) {
    playSound("shieldClear");
  }
}

function updateShieldBurst(pickup) {
  if (pickup.shieldBurstAge >= pickup.shieldBurstDuration) return;

  pickup.shieldBurstAge += 1;
  clearProjectilesInShieldBurst(pickup, getShieldPickupRadius(pickup));
}

function updateEnemies() {
  if (state.gameOver) return;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];

    updateEnemyMovement(enemy);

    if (
      enemy.type === "greenShooter" ||
      enemy.type === "cyanTriangle" ||
      enemy.type === "pinkTriangle"
    ) {
      updateShooter(enemy);
    }

    const inDamagePlane = enemy.z <= player.z + damagePlane.enemy;

    const dx = enemy.x - ship.hull.x;
    const dy = enemy.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    const enemyRadius = getEnemyRadius(enemy);
    const hitPlayer = distanceToPlayer < player.hitRadius + enemyRadius * 0.45;

    if (inDamagePlane && hitPlayer) {
      damagePlayer();
      state.enemies.splice(i, 1);
      continue;
    }

    if (enemy.z <= player.z - 0.05) {
  spawnEnemyExitExplosion(enemy);
  state.enemies.splice(i, 1);
  continue;
}
  }
}

function getEnemyRadius(enemy) {
  const closeness = clamp(1 - enemy.z, 0, 1);
  const eased = smoothstep(closeness);

  return lerp(enemy.farRadius, enemy.nearRadius, eased);
}

function getEnemyProjectileRadius(projectile) {
  const closeness = clamp(1 - projectile.z, 0, 1);
  const eased = smoothstep(closeness);

  return lerp(projectile.farRadius, projectile.nearRadius, eased);
}

function hitsActiveShield(distance, radius) {
  return isShieldActive() && distance < player.hitRadius + 12 + radius;
}

function updateEnemyProjectiles() {
  if (state.gameOver) return;

  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const projectile = state.enemyProjectiles[i];

    if (projectile.fading) {
      if (updateFade(projectile)) {
        state.enemyProjectiles.splice(i, 1);
      }

      continue;
    }

    projectile.z -= projectile.zSpeed;

    const closeness = clamp(1 - projectile.z, 0, 1);
    const easedCloseness = smoothstep(closeness);

    const currentFollowSpeed = lerp(0.002, 0.045, easedCloseness);

    projectile.x = lerp(projectile.x, projectile.targetX, currentFollowSpeed);
    projectile.y = lerp(projectile.y, projectile.targetY, currentFollowSpeed);

    const inDamagePlane = projectile.z <= player.z + damagePlane.projectile;

    const dx = projectile.x - ship.hull.x;
    const dy = projectile.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    const projectileRadius = getEnemyProjectileRadius(projectile);
    const hitShield = hitsActiveShield(distanceToPlayer, projectileRadius);
    const hitPlayer = distanceToPlayer < player.hitRadius + projectileRadius;

    if (inDamagePlane) {
      if (hitShield) {
        beginFade(projectile, 8);
        playSound("shieldBlock");
        continue;
      }

      if (
        projectile.kind === "blueCardinalSplitter" ||
        projectile.kind === "pinkDiagonalSplitter"
      ) {
        if (hitPlayer) damagePlayer();

        spawnSplitFragments(projectile);
        beginFade(projectile, 8);
        continue;
      }

      if (hitPlayer) {
        damagePlayer();
        beginFade(projectile, 8);
        continue;
      }
    }

    if (projectile.z <= player.z - 0.05) {
      beginFade(projectile, 8);
    }
  }
}

function updateFragments() {
  if (state.gameOver) return;

  const bounds = getVisibleWorldBounds();
  const margin = 80;

  for (let i = state.fragments.length - 1; i >= 0; i--) {
    const fragment = state.fragments[i];

    if (fragment.fading) {
      if (updateFade(fragment)) {
        state.fragments.splice(i, 1);
      }

      continue;
    }

    fragment.x += fragment.vx;
    fragment.y += fragment.vy;

    const dx = fragment.x - ship.hull.x;
    const dy = fragment.y - ship.hull.y;
    const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    if (hitsActiveShield(distanceToPlayer, fragment.radius)) {
      fragment.hitPlayer = true;
      beginFade(fragment, 10);
      playSound("shieldBlock");
      continue;
    }

    if (!fragment.hitPlayer && distanceToPlayer < player.hitRadius + fragment.radius) {
      damagePlayer();
      fragment.hitPlayer = true;
      beginFade(fragment, 10);
      continue;
    }

    const offscreen =
      fragment.x < bounds.left - margin ||
      fragment.x > bounds.right + margin ||
      fragment.y < bounds.top - margin ||
      fragment.y > bounds.bottom + margin;

    if (offscreen) {
      beginFade(fragment, 10);
    }
  }
}

function checkProjectileEnemyCollisions() {
  if (state.gameOver) return;

  for (let p = state.projectiles.length - 1; p >= 0; p--) {
    const projectile = state.projectiles[p];

    if (projectile.fading) continue;

    const projectilePosition = getProjectilePosition(projectile);
    const projectileRadius = getProjectileRadius(projectile);

    for (let e = state.enemies.length - 1; e >= 0; e--) {
      const enemy = state.enemies[e];
      const enemyRadius = getEnemyRadius(enemy);

      const dx = projectilePosition.x - enemy.x;
      const dy = projectilePosition.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < projectileRadius + enemyRadius) {
        enemy.hp -= 1;
        beginFade(projectile, 8);

        if (enemy.hp <= 0) {
          state.score += enemy.scoreValue;
          playSound("enemyDestroyed");

          if (enemy.type === "orangeOctagon") {
            splitOrangeOctagon(enemy);
          }

          state.enemies.splice(e, 1);
        }

        break;
      }
    }
  }
}

function updatePlayerFlash() {
  if (player.flashTimer > 0) {
    player.flashTimer -= 1;
  }
}

function update() {
  if (!state.started) return;

  if (!state.gameOver) {
    updateSoundtrack();
  }

  if (state.gameOver) {
    updatePlayerFlash();
    return;
  }

  updateCamera();
  updateEnemyExplosions();
  updateShip();
  spawnThrusterParticles();
  updateThrusterParticles();
  updateCrosshairFromAimBox();

  updatePlayerWeapon();
  updateSpawnWaves();
  updateSeaMines();
  updateShieldBosses();
  updatePickupSpawner();

  updateProjectiles();
  updateEnemies();
  updateEnemyProjectiles();
  updateFragments();
  updateSeaMineSpikes();
  updateShieldBossImpacts();
  updatePickups();

  checkProjectileShieldBossCollisions();
  checkProjectileEnemyCollisions();
  updatePlayerFlash();
}
function drawEllipse(x, y, radiusX, radiusY, color, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, rotation, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawPointedOval(x, y, radiusX, radiusY, color, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  ctx.moveTo(-radiusX, 0);
  ctx.quadraticCurveTo(0, -radiusY, radiusX, 0);
  ctx.quadraticCurveTo(0, radiusY, -radiusX, 0);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}
function drawEnemyExplosions() {
  for (const explosion of state.enemyExplosions) {
    const t = explosion.age / explosion.duration;
    const alpha = 1 - t;

    ctx.save();

    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, TAU);
    ctx.fillStyle = withAlpha(explosion.color, 0.16 * alpha);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, TAU);
    ctx.strokeStyle = withAlpha(explosion.color, 0.85 * alpha);
    ctx.lineWidth = Math.max(2, explosion.radius * 0.06);
    ctx.stroke();

    ctx.restore();
  }
}

function withAlpha(rgbaString, alpha) {
  return rgbaString.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${alpha})`);
}
function drawStars() {
  for (const star of state.stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, TAU);
    ctx.fillStyle = `rgb(${star.brightness}, ${star.brightness}, ${star.brightness})`;
    ctx.fill();
  }
}

function drawOneProjectile(projectile) {
  const position = getProjectilePosition(projectile);
  const radius = getProjectileRadius(projectile);
  const alpha = getFadeAlpha(projectile);

  if (radius <= 0.1 || alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, TAU);
  ctx.fillStyle = projectile.color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    position.x - radius * 0.25,
    position.y - radius * 0.25,
    Math.max(1, radius * 0.25),
    0,
    TAU
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fill();

  drawDangerGlow(() => {
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, TAU);
  });

  ctx.restore();
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    drawOneProjectile(projectile);
  }
}

function drawEnemySquare(enemy) {
  const size = getEnemyRadius(enemy) * 2;
  const inDanger = isInDangerPlane(enemy.z);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  ctx.fillStyle = enemy.color;
  ctx.fillRect(-size / 2, -size / 2, size, size);

  ctx.strokeStyle = enemy.lightColor;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.strokeRect(-size / 2, -size / 2, size, size);

  ctx.fillStyle = enemy.darkColor;
  ctx.fillRect(-size * 0.32, -size * 0.32, size * 0.22, size * 0.22);
  ctx.fillRect(size * 0.10, -size * 0.30, size * 0.32, size * 0.16);
  ctx.fillRect(-size * 0.42, size * 0.12, size * 0.28, size * 0.18);
  ctx.fillRect(size * 0.08, size * 0.10, size * 0.22, size * 0.28);

  ctx.strokeStyle = "rgba(185, 255, 105, 0.95)";
  ctx.lineWidth = Math.max(1, size * 0.035);

  ctx.beginPath();
  ctx.moveTo(-size * 0.45, 0);
  ctx.lineTo(size * 0.45, 0);
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(0, size * 0.45);
  ctx.moveTo(-size * 0.38, -size * 0.38);
  ctx.lineTo(size * 0.38, size * 0.38);
  ctx.moveTo(size * 0.38, -size * 0.38);
  ctx.lineTo(-size * 0.38, size * 0.38);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-size * 0.2, -size * 0.2, Math.max(1, size * 0.08), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fill();

  if (inDanger) {
    drawDangerGlow(() => ctx.rect(-size / 2, -size / 2, size, size));
  }

  ctx.restore();
}

function drawEnemyTriangle(enemy) {
  const radius = getEnemyRadius(enemy);
  const detailColor = enemy.type === "cyanTriangle" ? "#ff5fc8" : "#38f3ff";
  const inDanger = isInDangerPlane(enemy.z);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + (TAU / 3) * i;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = enemy.color;
  ctx.fill();

  ctx.strokeStyle = enemy.lightColor;
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.stroke();

  ctx.fillStyle = detailColor;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, radius * 0.25), 0, TAU);
  ctx.fill();

  ctx.strokeStyle = detailColor;
  ctx.lineWidth = Math.max(1, radius * 0.05);

  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.62);
  ctx.lineTo(0, radius * 0.55);
  ctx.moveTo(-radius * 0.48, radius * 0.25);
  ctx.lineTo(radius * 0.48, radius * 0.25);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-radius * 0.22, -radius * 0.28, Math.max(1, radius * 0.08), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fill();

  if (inDanger) {
    drawDangerGlow(() => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (TAU / 3) * i;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    });
  }

  ctx.restore();
}

function drawEnemyHexagon(enemy) {
  const radius = getEnemyRadius(enemy);
  const inDanger = isInDangerPlane(enemy.z);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  ctx.beginPath();

  for (let i = 0; i < 6; i++) {
    const angle = (TAU / 6) * i;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();

  ctx.fillStyle = enemy.color;
  ctx.fill();

  ctx.strokeStyle = enemy.lightColor;
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, radius * 0.26), 0, TAU);
  ctx.fillStyle = enemy.darkColor;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(1, radius * 0.05);

  ctx.beginPath();
  ctx.moveTo(-radius * 0.65, 0);
  ctx.lineTo(radius * 0.65, 0);
  ctx.moveTo(0, -radius * 0.65);
  ctx.lineTo(0, radius * 0.65);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-radius * 0.22, -radius * 0.22, Math.max(1, radius * 0.08), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fill();

  if (inDanger) {
    drawDangerGlow(() => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (TAU / 6) * i;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    });
  }

  ctx.restore();
}

function drawEnemyOctagon(enemy) {
  const radius = getEnemyRadius(enemy);
  const inDanger = isInDangerPlane(enemy.z);

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.rotation);

  ctx.beginPath();

  for (let i = 0; i < 8; i++) {
    const angle = (TAU / 8) * i;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();

  ctx.fillStyle = enemy.color;
  ctx.fill();

  ctx.strokeStyle = enemy.lightColor;
  ctx.lineWidth = Math.max(1, radius * 0.11);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, radius * 0.24), 0, TAU);
  ctx.fillStyle = enemy.darkColor;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 245, 210, 0.65)";
  ctx.lineWidth = Math.max(1, radius * 0.045);

  ctx.beginPath();
  ctx.moveTo(-radius * 0.65, 0);
  ctx.lineTo(radius * 0.65, 0);
  ctx.moveTo(0, -radius * 0.65);
  ctx.lineTo(0, radius * 0.65);
  ctx.moveTo(-radius * 0.46, -radius * 0.46);
  ctx.lineTo(radius * 0.46, radius * 0.46);
  ctx.moveTo(radius * 0.46, -radius * 0.46);
  ctx.lineTo(-radius * 0.46, radius * 0.46);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-radius * 0.22, -radius * 0.22, Math.max(1, radius * 0.08), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fill();

  if (inDanger) {
    drawDangerGlow(() => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (TAU / 8) * i;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    });
  }

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (enemy.type === "greenShooter") drawEnemySquare(enemy);
    if (enemy.type === "cyanTriangle") drawEnemyTriangle(enemy);
    if (enemy.type === "pinkTriangle") drawEnemyTriangle(enemy);
    if (enemy.type === "yellowSpinner") drawEnemyHexagon(enemy);
    if (enemy.type === "orangeOctagon") drawEnemyOctagon(enemy);
  }
}

function drawEnemyProjectiles() {
  for (const projectile of state.enemyProjectiles) {
    const radius = getEnemyProjectileRadius(projectile);
    const alpha = getFadeAlpha(projectile);
    const inDanger = isInDangerPlane(projectile.z, damagePlane.projectile);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    const glow = ctx.createRadialGradient(
      projectile.x,
      projectile.y,
      radius * 0.1,
      projectile.x,
      projectile.y,
      radius * 1.9
    );

    glow.addColorStop(0, projectile.color);
    glow.addColorStop(0.55, projectile.color);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, radius * 1.9, 0, TAU);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = radius * 0.9;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, radius, 0, TAU);
    ctx.fillStyle = projectile.color;
    ctx.fill();

    if (inDanger) {
      drawDangerGlow(() => {
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, radius, 0, TAU);
      });
    }

    ctx.restore();
  }
}

function drawSeaMineBody(mine, radius) {
  ctx.beginPath();
  ctx.arc(mine.x, mine.y, radius, 0, TAU);
  ctx.fillStyle = "#4b2f1d";
  ctx.fill();
  ctx.strokeStyle = "#6a4630";
  ctx.lineWidth = Math.max(2, radius * 0.04);
  ctx.stroke();
}

function drawSeaMineCentreDesign(mine, radius) {
  ctx.save();
  ctx.translate(mine.x, mine.y);

  const dark = "#424242";
  const darker = "#2d2d2d";
  const lineW = Math.max(2, radius * 0.05);
  const thinW = Math.max(1, radius * 0.03);

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.54, 0, TAU);
  ctx.strokeStyle = dark;
  ctx.lineWidth = thinW;
  ctx.stroke();

  ctx.strokeStyle = dark;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.42, 0);
  ctx.lineTo(radius * 0.42, 0);
  ctx.moveTo(0, -radius * 0.42);
  ctx.lineTo(0, radius * 0.42);
  ctx.stroke();

  ctx.lineWidth = thinW;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.26, -radius * 0.26);
  ctx.lineTo(radius * 0.26, radius * 0.26);
  ctx.moveTo(radius * 0.26, -radius * 0.26);
  ctx.lineTo(-radius * 0.26, radius * 0.26);
  ctx.stroke();

  const nodeRadius = Math.max(2, radius * 0.06);
  const nodeDistance = radius * 0.42;

  for (let i = 0; i < 8; i++) {
    const angle = (TAU / 8) * i;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * nodeDistance,
      Math.sin(angle) * nodeDistance,
      nodeRadius,
      0,
      TAU
    );
    ctx.fillStyle = dark;
    ctx.fill();
  }

  ctx.save();
  ctx.rotate(Math.PI / 4);
  const d = radius * 0.16;
  ctx.beginPath();
  ctx.rect(-d, -d, d * 2, d * 2);
  ctx.fillStyle = darker;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(3, radius * 0.12), 0, TAU);
  ctx.fillStyle = "#1f1f1f";
  ctx.fill();

  const blockSize = radius * 0.08;
  const blockOffset = radius * 0.24;
  const blocks = [
    [-blockOffset, -blockOffset],
    [blockOffset, -blockOffset],
    [blockOffset, blockOffset],
    [-blockOffset, blockOffset]
  ];

  for (const [x, y] of blocks) {
    ctx.fillStyle = darker;
    ctx.fillRect(x - blockSize / 2, y - blockSize / 2, blockSize, blockSize);
  }

  ctx.restore();
}

function drawSeaMineBodySpike(mine, angle, radius, color) {
  const tipRadius = radius * 1.28;
  const halfWidth = radius * 0.12;

  const tipX = mine.x + Math.cos(angle) * tipRadius;
  const tipY = mine.y + Math.sin(angle) * tipRadius;
  const baseX = mine.x + Math.cos(angle) * radius;
  const baseY = mine.y + Math.sin(angle) * radius;
  const sideAngle = angle + Math.PI / 2;

  ctx.beginPath();
  ctx.moveTo(
    baseX + Math.cos(sideAngle) * halfWidth,
    baseY + Math.sin(sideAngle) * halfWidth
  );
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(
    baseX - Math.cos(sideAngle) * halfWidth,
    baseY - Math.sin(sideAngle) * halfWidth
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSeaMines() {
  for (const mine of state.seaMines) {
    const radius = getSeaMineRadius(mine);
    const phase = getSeaMinePhase(mine);
    const alpha = getFadeAlpha(mine);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    const flash = phase === "warn" && Math.floor(mine.age / 6) % 2 === 0;
    const spikeColor = flash ? "white" : "#4a4a4a";

    for (let i = 0; i < mine.spikeCount; i++) {
      const angle = (TAU / mine.spikeCount) * i - Math.PI / 2;
      drawSeaMineBodySpike(mine, angle, radius, spikeColor);
    }

    drawSeaMineBody(mine, radius);
    drawSeaMineCentreDesign(mine, radius);

    if (phase === "warn") {
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, radius * 1.1, 0, TAU);
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawSeaMineSpikes() {
  for (const spike of state.seaMineSpikes) {
    const alpha = getFadeAlpha(spike);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(spike.x, spike.y);
    ctx.rotate(spike.angle);

    ctx.beginPath();
    ctx.moveTo(spike.size, 0);
    ctx.lineTo(-spike.size * 0.45, spike.size * 0.34);
    ctx.lineTo(-spike.size * 0.45, -spike.size * 0.34);
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

function drawShieldBossMandala(boss, radius) {
  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.clip();

  ctx.strokeStyle = "rgba(105, 20, 115, 0.75)";
  ctx.lineWidth = Math.max(8, radius * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.88, 0, TAU);
  ctx.stroke();

  const lobeCenters = [
    [-0.32, -0.32],
    [0.32, -0.30],
    [0.32, 0.32],
    [-0.32, 0.34]
  ];

  for (const [x, y] of lobeCenters) {
    ctx.save();
    ctx.translate(x * radius, y * radius);
    ctx.rotate(Math.atan2(y, x) * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.24, radius * 0.28, 0, 0, TAU);
    ctx.fillStyle = "rgba(18, 18, 18, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = Math.max(2, radius * 0.018);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = Math.max(2, radius * 0.02);

  for (const [x, y] of lobeCenters) {
    ctx.beginPath();
    ctx.arc(x * radius, y * radius, radius * 0.14, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x * radius, y * radius, radius * 0.08, 0, TAU);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, 0, Math.max(5, radius * 0.07), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fill();

  ctx.restore();
}

function getShieldBossHole(boss, radius) {
  const activeAge = boss.age - boss.growDuration - shieldBossSettings.idleDuration;

  if (activeAge < 0) return null;

  const sweepDuration = shieldBossSettings.holeSweepDuration;
  const cycleDuration = sweepDuration * 4;
  const cycleAge = activeAge % cycleDuration;
  const sweepIndex = Math.floor(cycleAge / sweepDuration);
  const sweepT = smoothstep((cycleAge % sweepDuration) / sweepDuration);
  const travel = radius * 0.74;

  if (sweepIndex < 2) {
    return {
      x: boss.x + lerp(-travel, travel, sweepT),
      y: boss.y,
      radius: radius * shieldBossSettings.holeRadiusScale
    };
  }

  return {
    x: boss.x,
    y: boss.y + lerp(-travel, travel, sweepT),
    radius: radius * shieldBossSettings.holeRadiusScale
  };
}

function drawShieldBossHole(boss, radius) {
  const hole = getShieldBossHole(boss, radius);

  if (!hole) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, radius, 0, TAU);
  ctx.clip();

  ctx.beginPath();
  ctx.arc(hole.x, hole.y, hole.radius, 0, TAU);
  ctx.fillStyle = "rgba(48, 48, 48, 0.96)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    hole.x - hole.radius * 0.18,
    hole.y - hole.radius * 0.20,
    hole.radius * 0.82,
    0,
    TAU
  );
  ctx.strokeStyle = "rgba(10, 10, 10, 0.28)";
  ctx.lineWidth = Math.max(2, hole.radius * 0.08);
  ctx.stroke();

  ctx.restore();
}

function drawShieldBosses() {
  for (const boss of state.shieldBosses) {
    const radius = getShieldBossRadius(boss);

    ctx.save();

    ctx.beginPath();
    ctx.arc(boss.x, boss.y, radius, 0, TAU);
    ctx.fillStyle = "#777";
    ctx.fill();
    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = Math.max(2, radius * 0.012);
    ctx.stroke();

    if (isShieldBossFullyGrown(boss)) {
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, radius, 0, TAU);
      ctx.fillStyle = "rgba(150, 70, 230, 0.32)";
      ctx.fill();

      drawShieldBossMandala(boss, radius);
      drawShieldBossHole(boss, radius);

      ctx.beginPath();
      ctx.arc(boss.x, boss.y, radius, 0, TAU);
      ctx.strokeStyle = "rgba(210, 160, 255, 0.62)";
      ctx.lineWidth = Math.max(3, radius * 0.018);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawShieldBossImpacts() {
  for (const impact of state.shieldBossImpacts) {
    const t = clamp(impact.age / impact.duration, 0, 1);
    const radius = lerp(impact.radius, impact.maxRadius, smoothstep(t));
    const alpha = 1 - t;

    ctx.save();
    ctx.beginPath();
    ctx.arc(impact.x, impact.y, radius, 0, TAU);
    ctx.fillStyle = `rgba(170, 80, 255, ${0.18 * alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(220, 180, 255, ${0.7 * alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawFragments() {
  for (const fragment of state.fragments) {
    const alpha = getFadeAlpha(fragment);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(fragment.x, fragment.y, fragment.radius, 0, TAU);
    ctx.fillStyle = fragment.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      fragment.x - fragment.radius * 0.25,
      fragment.y - fragment.radius * 0.25,
      Math.max(1, fragment.radius * 0.22),
      0,
      TAU
    );
    ctx.fillStyle = fragment.highlightColor;
    ctx.fill();

    drawDangerGlow(() => {
      ctx.beginPath();
      ctx.arc(fragment.x, fragment.y, fragment.radius, 0, TAU);
    });

    ctx.restore();
  }
}

function drawPickups() {
  for (const pickup of state.pickups) {
    const radius = getPickupRadius(pickup);
    const reveal = smoothstep(pickup.age / pickup.revealAge);
    const alpha = getFadeAlpha(pickup);

    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (pickup.type === "shield") {
      drawShieldRing(pickup.x, pickup.y, getShieldPickupRadius(pickup), 0.35 + reveal * 0.15);
      ctx.restore();
      continue;
    }

    const orbColor = pickup.type === "heart"
      ? `rgba(255, 70, 70, ${1 - reveal * 0.78})`
      : `rgba(80, 255, 180, ${1 - reveal * 0.72})`;

    const shineColor = pickup.type === "heart"
      ? `rgba(255, 220, 220, ${0.75 - reveal * 0.55})`
      : `rgba(220, 255, 245, ${0.75 - reveal * 0.50})`;

    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, radius, 0, TAU);
    ctx.fillStyle = orbColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      pickup.x - radius * 0.25,
      pickup.y - radius * 0.25,
      Math.max(1, radius * 0.18),
      0,
      TAU
    );
    ctx.fillStyle = shineColor;
    ctx.fill();

    ctx.globalAlpha = alpha * reveal;

    if (pickup.type === "heart") {
      drawPickupHeartShape(pickup.x, pickup.y, radius * 0.95);
    }

    if (pickup.type === "fireRate") {
      drawPickupFireRateShape(pickup.x, pickup.y, radius * 0.95);
    }

    ctx.restore();
  }
}

function drawShieldRing(x, y, radius, alpha = 0.5) {
  ctx.save();
  ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
    function drawBlueFragments() {
      for (const fragment of state.blueFragments) {
        ctx.beginPath();
        ctx.arc(fragment.x, fragment.y, fragment.radius, 0, TAU);
        ctx.fillStyle = fragment.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          fragment.x - fragment.radius * 0.25,
          fragment.y - fragment.radius * 0.25,
          Math.max(1, fragment.radius * 0.22),
          0,
          TAU
        );
        ctx.fillStyle = "rgba(225, 245, 255, 0.75)";
        ctx.fill();
      }
    }
function drawPickupHeartShape(x, y, size) {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(0, size * 0.35);

  ctx.bezierCurveTo(
    -size * 0.95, -size * 0.25,
    -size * 0.55, -size * 1.05,
    0, -size * 0.55
  );

  ctx.bezierCurveTo(
    size * 0.55, -size * 1.05,
    size * 0.95, -size * 0.25,
    0, size * 0.35
  );

  ctx.closePath();

  ctx.fillStyle = "#ff2b5f";
  ctx.strokeStyle = "#ffd1dc";
  ctx.lineWidth = Math.max(1, size * 0.10);

  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-size * 0.22, -size * 0.34, Math.max(1, size * 0.13), 0, TAU);
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.fill();

  ctx.restore();
}

function drawPickupFireRateShape(x, y, size) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "#5dffb7";
  ctx.strokeStyle = "#eafff7";
  ctx.lineWidth = Math.max(1, size * 0.09);

  function drawChevron(offsetX) {
    ctx.beginPath();
    ctx.moveTo(offsetX - size * 0.32, -size * 0.48);
    ctx.lineTo(offsetX + size * 0.18, 0);
    ctx.lineTo(offsetX - size * 0.32, size * 0.48);
    ctx.lineTo(offsetX - size * 0.05, size * 0.48);
    ctx.lineTo(offsetX + size * 0.46, 0);
    ctx.lineTo(offsetX - size * 0.05, -size * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawChevron(-size * 0.16);
  drawChevron(size * 0.18);

  ctx.restore();
}

function drawTriangleHull() {
  const angle = angleBetween(ship.hull, ship.nose);

  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);

  const sideX = Math.cos(angle + Math.PI / 2);
  const sideY = Math.sin(angle + Math.PI / 2);

  const noseX = ship.nose.x - forwardX * 8;
  const noseY = ship.nose.y - forwardY * 8;

  const rearX = ship.rear.x;
  const rearY = ship.rear.y;

  const halfHeight = ship.hull.height / 2;

  const rearLeftX = rearX + sideX * halfHeight;
  const rearLeftY = rearY + sideY * halfHeight;

  const rearRightX = rearX - sideX * halfHeight;
  const rearRightY = rearY - sideY * halfHeight;

  ctx.beginPath();
  ctx.moveTo(noseX, noseY);
  ctx.lineTo(rearLeftX, rearLeftY);
  ctx.lineTo(rearRightX, rearRightY);
  ctx.closePath();

  ctx.fillStyle = shipColor(ship.hull);
  ctx.fill();

  ctx.strokeStyle = isPlayerFlashing() ? "#ffdddd" : "#8f7898";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawDangerGlow(() => {
    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.lineTo(rearLeftX, rearLeftY);
    ctx.lineTo(rearRightX, rearRightY);
    ctx.closePath();
  });
}

function drawCockpit() {
  const angle = angleBetween(ship.rear, ship.nose);

  const x = ship.hull.x + (ship.nose.x - ship.hull.x) * 0.25;
  const y = ship.hull.y + (ship.nose.y - ship.hull.y) * 0.25;

  drawEllipse(
    x,
    y,
    ship.cockpitShadow.radiusX,
    ship.cockpitShadow.radiusY,
    shipColor(ship.cockpitShadow),
    angle
  );

  drawEllipse(
    x + Math.cos(angle) * 3,
    y + Math.sin(angle) * 3,
    ship.cockpit.radiusX,
    ship.cockpit.radiusY,
    shipColor(ship.cockpit),
    angle
  );
}

function drawWhitePanels() {
  const angle = angleBetween(ship.rear, ship.nose);

  const sideAngle = angle + Math.PI / 2;
  const sideX = Math.cos(sideAngle);
  const sideY = Math.sin(sideAngle);

  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);

  function drawPanel(offsetSide, offsetForward) {
    const cx = ship.hull.x + sideX * offsetSide + forwardX * offsetForward;
    const cy = ship.hull.y + sideY * offsetSide + forwardY * offsetForward;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(14, -8);
    ctx.lineTo(20, 4);
    ctx.lineTo(-8, 10);
    ctx.closePath();

    ctx.fillStyle = isPlayerFlashing() ? "#ffd5d5" : "white";
    ctx.fill();

    ctx.restore();
  }

  drawPanel(-17, -6);
  drawPanel(17, 7);
}

function drawThrusterParticles() {
  for (const particle of state.thrusterParticles) {
    const alpha = clamp(particle.life / particle.duration, 0, 1);

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    ctx.fillStyle = `rgba(255, 225, 140, ${alpha * 0.75})`;
    ctx.fill();
  }
}

function drawThrusters() {
  const angle = angleBetween(ship.hull, ship.rear);
  const sideAngle = angle + Math.PI / 2;

  const sideX = Math.cos(sideAngle);
  const sideY = Math.sin(sideAngle);

  const x1 = ship.rear.x + sideX * ship.thruster.separation;
  const y1 = ship.rear.y + sideY * ship.thruster.separation;

  const x2 = ship.rear.x - sideX * ship.thruster.separation;
  const y2 = ship.rear.y - sideY * ship.thruster.separation;

  drawPointedOval(
    x1,
    y1,
    ship.thruster.radiusX,
    ship.thruster.radiusY,
    shipColor(ship.thruster),
    angle
  );

  drawPointedOval(
    x2,
    y2,
    ship.thruster.radiusX,
    ship.thruster.radiusY,
    shipColor(ship.thruster),
    angle
  );
}

function drawNoseSphere() {
  drawEllipse(
    ship.nose.x,
    ship.nose.y,
    ship.noseSphere.radiusX,
    ship.noseSphere.radiusY,
    shipColor(ship.noseSphere)
  );

  drawEllipse(
    ship.nose.x - 3,
    ship.nose.y - 3,
    3,
    3,
    "white"
  );
}

function drawNoseCone() {
  const angle = angleBetween(ship.hull, ship.nose);

  const baseX = ship.hull.x + (ship.nose.x - ship.hull.x) * 0.72;
  const baseY = ship.hull.y + (ship.nose.y - ship.hull.y) * 0.72;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(28, 0);
  ctx.lineTo(0, 7);
  ctx.closePath();

  ctx.fillStyle = isPlayerFlashing() ? "#ffaaaa" : "#aaa";
  ctx.fill();

  ctx.restore();
}

function drawShip() {
  drawNoseSphere();
  drawNoseCone();
  drawTriangleHull();
  drawWhitePanels();
  drawCockpit();
  drawThrusters();

  if (isShieldActive()) {
    drawShieldRing(ship.hull.x, ship.hull.y, player.hitRadius + 12, 0.5);
  }
}

function drawHeart(x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(0, size * 0.35);

  ctx.bezierCurveTo(
    -size * 0.95, -size * 0.25,
    -size * 0.55, -size * 1.05,
    0, -size * 0.55
  );

  ctx.bezierCurveTo(
    size * 0.55, -size * 1.05,
    size * 0.95, -size * 0.25,
    0, size * 0.35
  );

  ctx.closePath();

  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.strokeStyle = "#ff6a8a";
  ctx.fillStyle = "#ff2b5f";

  if (fill) {
    ctx.fill();
  }

  ctx.stroke();

  ctx.restore();
}

function drawHearts() {
  for (let i = 0; i < player.maxHp; i++) {
    drawHeart(24 + i * 30, 24, 12, i < player.hp);
  }
}

function drawScore() {
  ctx.save();

  setFont(18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.textAlign = "right";

  ctx.fillText(`SCORE ${state.score}`, canvas.width - 18, 30);

  setFont(13);
  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
  ctx.fillText(`HIGH ${state.highScore}`, canvas.width - 18, 52);
  ctx.fillText(`FIRE ${playerWeapon.fireCooldown}`, canvas.width - 18, 72);

  ctx.restore();
}

function drawEndScreen() {
  if (!state.gameOver) return;

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  setFont(48);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText(GAME_OVER_TEXT.title, canvas.width / 2, canvas.height / 2 - 70);

  setFont(22);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "rgba(255, 220, 120, 0.95)";
  ctx.fillText(`High Score: ${state.highScore}`, canvas.width / 2, canvas.height / 2 + 14);

  setFont(16);
  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
  ctx.fillText(GAME_OVER_TEXT.restart, canvas.width / 2, canvas.height / 2 + 62);

  ctx.restore();
}

function drawStartScreen() {
  if (state.started) return;

  ctx.save();
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  setFont(Math.max(28, Math.min(58, canvas.width * 0.055)));
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText("CLICK TO START COSMIC CRASH", canvas.width / 2, canvas.height / 2 - 18);

  setFont(16);
  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.fillText("move mouse to steer · hold click to fire", canvas.width / 2, canvas.height / 2 + 36);

  ctx.restore();
}

function drawAimDebugBox() {
  if (!state.debug) return;

  const centerX = ship.hull.x;
  const centerY = ship.hull.y;

  ctx.save();

  ctx.strokeStyle = "rgba(0, 255, 255, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    centerX - aimBox.width / 2,
    centerY - aimBox.height / 2,
    aimBox.width,
    aimBox.height
  );

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - aimBox.height / 2);
  ctx.lineTo(centerX, centerY + aimBox.height / 2);
  ctx.moveTo(centerX - aimBox.width / 2, centerY);
  ctx.lineTo(centerX + aimBox.width / 2, centerY);
  ctx.strokeStyle = "rgba(0, 255, 255, 0.18)";
  ctx.stroke();

  const boxLeft = centerX - aimBox.width / 2;
  const boxTop = centerY - aimBox.height / 2;

  const localX = clamp((mouse.x - boxLeft) / aimBox.width, 0, 1);
  const localY = clamp((mouse.y - boxTop) / aimBox.height, 0, 1);

  const indicatorX = boxLeft + localX * aimBox.width;
  const indicatorY = boxTop + localY * aimBox.height;

  ctx.beginPath();
  ctx.arc(indicatorX, indicatorY, 4, 0, TAU);
  ctx.fillStyle = "rgba(0, 255, 255, 0.75)";
  ctx.fill();

  ctx.restore();
}

function drawCrosshair() {
  if (!state.debug) return;

  ctx.save();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(crosshair.x - 12, crosshair.y);
  ctx.lineTo(crosshair.x - 4, crosshair.y);

  ctx.moveTo(crosshair.x + 4, crosshair.y);
  ctx.lineTo(crosshair.x + 12, crosshair.y);

  ctx.moveTo(crosshair.x, crosshair.y - 12);
  ctx.lineTo(crosshair.x, crosshair.y - 4);

  ctx.moveTo(crosshair.x, crosshair.y + 4);
  ctx.lineTo(crosshair.x, crosshair.y + 12);

  ctx.stroke();

  ctx.beginPath();
  ctx.arc(crosshair.x, crosshair.y, crosshair.radius, 0, TAU);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.stroke();

  ctx.restore();
}

function drawDebugPanel() {
  if (!state.debug) return;

  const greenCount = countEnemiesByType("greenShooter");
  const cyanCount = countEnemiesByType("cyanTriangle");
  const pinkCount = countEnemiesByType("pinkTriangle");
  const yellowCount = countEnemiesByType("yellowSpinner");
  const orangeCount = countEnemiesByType("orangeOctagon");

  const triangleUnlocked = state.score >= triangleEnemySettings.unlockScore;
  const orangeUnlocked = state.score >= orangeEnemySettings.unlockScore;

  const panelX = 12;
  const panelY = 76;
  const panelWidth = 450;
  const panelHeight = 250;

  const graphX = panelX + 12;
  const graphY = panelY + 30;
  const graphWidth = panelWidth - 24;
  const graphHeight = 72;

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  setFont(12);
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("debug", panelX + 12, panelY + 18);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.moveTo(graphX, graphY + graphHeight);
  ctx.lineTo(graphX + graphWidth, graphY + graphHeight);
  ctx.moveTo(graphX, graphY + graphHeight * 0.5);
  ctx.lineTo(graphX + graphWidth, graphY + graphHeight * 0.5);
  ctx.stroke();

  function drawOneWave(wave, color) {
    ctx.beginPath();

    for (let x = 0; x <= graphWidth; x++) {
      const lookback = graphWidth - x;
      const frame = spawnWaves.frame - lookback;
      const shaped = shapedSineWave(frame, wave).shaped;

      const px = graphX + x;
      const py = graphY + graphHeight - shaped * graphHeight;

      if (x === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawOneWave(spawnWaves.green, "rgba(40, 223, 85, 0.95)");
  drawOneWave(spawnWaves.yellow, "rgba(255, 212, 59, 0.95)");

  const nowX = graphX + graphWidth - 1;
  ctx.strokeStyle = spawnWaves.overlapActive
    ? "rgba(255, 80, 80, 0.95)"
    : "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.moveTo(nowX, graphY);
  ctx.lineTo(nowX, graphY + graphHeight);
  ctx.stroke();

  setFont(12);

  ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
  ctx.fillText(
    `time ${spawnWaves.timeSurvived.value.toFixed(2)} | overlap ${spawnWaves.overlapActive ? "YES" : "no"} | fire ${playerWeapon.fireCooldown}`,
    panelX + 12,
    panelY + 120
  );

  ctx.fillStyle = "rgba(40, 223, 85, 0.9)";
  ctx.fillText(
    `green ${greenCount} | rate ${spawnWaves.green.rate.toFixed(3)}`,
    panelX + 12,
    panelY + 142
  );

  ctx.fillStyle = "rgba(56, 243, 255, 0.92)";
  ctx.fillText(
    `cyan ${cyanCount} pink ${pinkCount} | ${triangleUnlocked ? "on" : "off"} | ${state.score}/${triangleEnemySettings.unlockScore}`,
    panelX + 218,
    panelY + 142
  );

  ctx.fillStyle = "rgba(255, 212, 59, 0.92)";
  ctx.fillText(
    `yellow ${yellowCount} | rate ${spawnWaves.yellow.rate.toFixed(3)}`,
    panelX + 12,
    panelY + 164
  );

  ctx.fillStyle = "rgba(255, 140, 36, 0.92)";
  ctx.fillText(
    `orange ${orangeCount} | ${orangeUnlocked ? "on" : "off"} | ${state.score}/${orangeEnemySettings.unlockScore}`,
    panelX + 218,
    panelY + 164
  );

  ctx.fillStyle = "rgba(255, 80, 150, 0.92)";
  ctx.fillText(
    `pickup ${Math.floor(pickupSettings.timer)}/${Math.floor(pickupSettings.nextInterval)} | live ${state.pickups.length}`,
    panelX + 12,
    panelY + 186
  );

  ctx.fillStyle = "rgba(90, 255, 180, 0.92)";
  ctx.fillText(
    `healthy fire-rate roll ${pickupSettings.fireRateChanceWhenHealthy} | min cooldown ${playerWeapon.minFireCooldown}`,
    panelX + 218,
    panelY + 186
  );

  ctx.fillStyle = "rgba(75, 165, 255, 0.92)";
  ctx.fillText(
    `shots ${state.enemyProjectiles.length} | fragments ${state.fragments.length} | player shots ${state.projectiles.length}`,
    panelX + 12,
    panelY + 208
  );

  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.fillText(
    `enemies ${state.enemies.length} | mouse ${state.mouseDown ? "down" : "up"} | cooldown timer ${state.fireCooldownTimer}`,
    panelX + 12,
    panelY + 230
  );

  ctx.restore();
}

function applyCameraTransform() {
  const shakeX = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake ? (Math.random() - 0.5) * camera.shake : 0;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(
    -canvas.width / 2 - camera.x + shakeX,
    -canvas.height / 2 - camera.y + shakeY
  );
}

function drawWorld() {
  drawStars();

  drawShieldBosses();
  drawEnemies();
  drawSeaMines();
  drawEnemyProjectiles();
  drawEnemyExplosions();
  drawBlueFragments();
  drawFragments();
  drawSeaMineSpikes();
  drawShieldBossImpacts();
  drawPickups();

  drawProjectiles();
  drawThrusterParticles();

  drawShip();

  drawAimDebugBox();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  applyCameraTransform();
  drawWorld();
  ctx.restore();

  drawCrosshair();
  drawHearts();
  drawScore();
  drawDebugPanel();
  drawEndScreen();
  drawStartScreen();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("mousemove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

window.addEventListener("mousedown", () => {
  const wasStarted = state.started;
  startGame();

  if (!wasStarted) return;

  state.mouseDown = true;
  fireProjectile();
});

window.addEventListener("mouseup", () => {
  state.mouseDown = false;
});

window.addEventListener("mouseleave", () => {
  state.mouseDown = false;
});

window.addEventListener("keydown", (event) => {
  startGame();
  const key = event.key.toLowerCase();

  if (key === "r" && state.gameOver) {
    restartGame();
    return;
  }

  if (key === "d") {
    state.debug = !state.debug;
    updateDebugVisibility();
  }

  if (key === "m") {
    seaMineSettings.debugQueued = true;
  }
});

window.addEventListener("resize", resizeCanvas);

document.fonts.ready.then(() => {
  resizeCanvas();
  updateDebugVisibility();
  loop();
});
