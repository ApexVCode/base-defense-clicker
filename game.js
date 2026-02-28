const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const coinsEl = document.getElementById('coins');
const waveEl = document.getElementById('wave');
const baseHpEl = document.getElementById('baseHp');
const buildingsEl = document.getElementById('buildings');
const statusEl = document.getElementById('status');
const buyBtn = document.getElementById('buyBuilding');

const MAX_BASE_HP = 20;

const state = {
  coins: 0,
  wave: 1,
  baseHp: MAX_BASE_HP,
  autoClickers: [],
  arrows: [],
  enemies: [],
  gameOver: false,
  waveSpawned: 0,
  waveTarget: 0,
  spawnTimer: 0,
  nextWaveDelay: 1500,
  normalTravelSeconds: 8,
};

const base = { x: 110, y: canvas.height / 2, radius: 38 };

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function buildPathData(points) {
  const segments = [];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: totalLength });
    totalLength += len;
  }

  return { points, segments, totalLength };
}

function generateWavePath() {
  const points = [
    { x: canvas.width + 12, y: randomRange(80, 420) },
    { x: randomRange(730, 800), y: randomRange(70, 430) },
    { x: randomRange(610, 700), y: randomRange(70, 430) },
    { x: randomRange(470, 560), y: randomRange(70, 430) },
    { x: randomRange(340, 430), y: randomRange(70, 430) },
    { x: randomRange(220, 300), y: randomRange(90, 410) },
    { x: base.x + base.radius + 10, y: base.y },
  ];

  return buildPathData(points);
}

state.currentPath = generateWavePath();

function pointOnPath(distance) {
  const path = state.currentPath;
  if (distance <= 0) return { ...path.points[0] };
  if (distance >= path.totalLength) return { ...path.points[path.points.length - 1] };

  for (const seg of path.segments) {
    if (distance <= seg.start + seg.len) {
      const t = (distance - seg.start) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
      };
    }
  }

  return { ...path.points[path.points.length - 1] };
}

function updateHud() {
  coinsEl.textContent = state.coins;
  waveEl.textContent = state.wave;
  baseHpEl.textContent = state.baseHp;
  buildingsEl.textContent = state.autoClickers.length;
  buyBtn.disabled = state.coins < 10 || state.gameOver;
}

function waveConfig(w) {
  return {
    count: (6 + Math.floor(w * 2.2)) * 2,
    spawnEveryMs: Math.max(180, 760 - w * 34),
    speed: 1 + w * 0.04,
  };
}

function startWave() {
  const cfg = waveConfig(state.wave);
  state.waveTarget = cfg.count;
  state.waveSpawned = 0;
  state.spawnTimer = 0;
  state.currentPath = generateWavePath();
  state.normalTravelSeconds = randomRange(7, 9);
  statusEl.textContent = `Wave ${state.wave} started!`;
}

function pickEnemyType(wave) {
  const fastChance = Math.min(0.35, 0.12 + wave * 0.015);
  const tankChance = Math.min(0.25, 0.06 + wave * 0.01);
  const roll = Math.random();

  if (roll < tankChance) {
    return { type: 'tank', hp: 3, maxHp: 3, speedMult: 0.7, r: 20, color: '#8ca3ff' };
  }
  if (roll < tankChance + fastChance) {
    return { type: 'fast', hp: 1, maxHp: 1, speedMult: 1.55, r: 11, color: '#ffd166' };
  }
  return { type: 'normal', hp: 1, maxHp: 1, speedMult: 1, r: 15, color: '#ff5b7f' };
}

function spawnEnemy() {
  const cfg = waveConfig(state.wave);
  const kind = pickEnemyType(state.wave);

  // Each wave picks a random normal travel time in the 7-9s range.
  const basePathSpeed = state.currentPath.totalLength / state.normalTravelSeconds;
  const pathSpeed = basePathSpeed * cfg.speed * kind.speedMult * (0.92 + Math.random() * 0.16);

  const start = pointOnPath(0);
  state.enemies.push({
    x: start.x,
    y: start.y,
    pathDist: 0,
    r: kind.r,
    type: kind.type,
    hp: kind.hp,
    maxHp: kind.maxHp,
    color: kind.color,
    speed: pathSpeed,
  });
  state.waveSpawned++;
}

function coinDropChanceByType(type) {
  if (type === 'tank') return 1.0;
  if (type === 'fast') return 0.5;
  return 0.2; // normal
}

function damageEnemy(index, damage = 1) {
  if (index < 0 || index >= state.enemies.length) return;
  const enemy = state.enemies[index];
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    state.enemies.splice(index, 1);

    const dropChance = coinDropChanceByType(enemy.type);
    if (Math.random() < dropChance) {
      state.coins += 1;
    }

    updateHud();
  }
}

function distToBase(e) {
  return Math.hypot(e.x - base.x, e.y - base.y);
}

function towerPos(slot, total) {
  const angle = (-Math.PI / 2) + (slot * (Math.PI * 2 / Math.max(1, total)));
  const radius = 92;
  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + Math.sin(angle) * radius,
  };
}

function spawnArrow(fromX, fromY, toX, toY) {
  state.arrows.push({
    fromX,
    fromY,
    toX,
    toY,
    life: 140,
    maxLife: 140,
  });
}

canvas.addEventListener('click', (ev) => {
  if (state.gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (ev.clientX - rect.left) * scaleX;
  const my = (ev.clientY - rect.top) * scaleY;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const d = Math.hypot(mx - e.x, my - e.y);
    if (d <= e.r + 2) {
      damageEnemy(i, 1);
      return;
    }
  }
});

buyBtn.addEventListener('click', () => {
  if (state.coins < 10 || state.gameOver) return;
  state.coins -= 10;
  state.autoClickers.push({ nextShotAt: performance.now() + 2000, slot: state.autoClickers.length });
  statusEl.textContent = `Built tower #${state.autoClickers.length}`;
  updateHud();
});

function fireAutoClickers(now) {
  if (state.gameOver || state.autoClickers.length === 0 || state.enemies.length === 0) return;

  for (const clicker of state.autoClickers) {
    if (now < clicker.nextShotAt) continue;

    let idx = -1;
    let best = Infinity;
    for (let i = 0; i < state.enemies.length; i++) {
      const d = distToBase(state.enemies[i]);
      if (d < best) {
        best = d;
        idx = i;
      }
    }

    if (idx !== -1) {
      const target = state.enemies[idx];
      const total = state.autoClickers.length;
      const tp = towerPos(clicker.slot ?? 0, total);
      spawnArrow(tp.x, tp.y, target.x, target.y);
      damageEnemy(idx, 1);
    }
    clicker.nextShotAt = now + 2000;

    if (state.enemies.length === 0) break;
  }
}

let last = performance.now();
function loop(now) {
  const dt = now - last;
  last = now;

  update(dt, now);
  draw();

  requestAnimationFrame(loop);
}

function update(dt, now) {
  if (state.gameOver) return;

  const cfg = waveConfig(state.wave);
  if (state.waveSpawned < state.waveTarget) {
    state.spawnTimer += dt;
    if (state.spawnTimer >= cfg.spawnEveryMs) {
      state.spawnTimer = 0;
      spawnEnemy();
    }
  }

  fireAutoClickers(now);

  for (let i = state.arrows.length - 1; i >= 0; i--) {
    state.arrows[i].life -= dt;
    if (state.arrows[i].life <= 0) state.arrows.splice(i, 1);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];

    e.pathDist += e.speed * (dt / 1000);
    const p = pointOnPath(e.pathDist);
    e.x = p.x;
    e.y = p.y;

    if (e.pathDist >= state.currentPath.totalLength) {
      state.enemies.splice(i, 1);
      state.baseHp -= 1;
      if (state.baseHp <= 0) {
        state.baseHp = 0;
        state.gameOver = true;
        statusEl.textContent = `Game Over at wave ${state.wave}. Refresh to restart.`;
      }
      updateHud();
    }
  }

  if (!state.gameOver && state.waveSpawned >= state.waveTarget && state.enemies.length === 0) {
    state.nextWaveDelay -= dt;
    if (state.nextWaveDelay <= 0) {
      state.wave += 1;
      state.nextWaveDelay = 1500;
      startWave();
      updateHud();
    }
  } else {
    state.nextWaveDelay = 1500;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // enemy pathway
  const pathPoints = state.currentPath.points;
  ctx.strokeStyle = '#2f3a66';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#445393';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.stroke();

  // base glow
  const glow = ctx.createRadialGradient(base.x, base.y, 10, base.x, base.y, 90);
  glow.addColorStop(0, '#6de0ff55');
  glow.addColorStop(1, '#6de0ff00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(base.x, base.y, 90, 0, Math.PI * 2);
  ctx.fill();

  // castle base
  const castleX = base.x - 42;
  const castleY = base.y - 36;
  const castleW = 84;
  const castleH = 72;
  const hpPct = state.baseHp / MAX_BASE_HP;
  const damagePct = 1 - hpPct;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(castleX + 4, castleY + 6, castleW, castleH);

  // main keep (darkens as damaged)
  ctx.fillStyle = damagePct > 0.66 ? '#6e7b8d' : damagePct > 0.33 ? '#78a6cc' : '#7fc4ff';
  ctx.fillRect(castleX, castleY, castleW, castleH);

  // side towers
  ctx.fillStyle = damagePct > 0.66 ? '#7c8996' : damagePct > 0.33 ? '#86b5dc' : '#94d2ff';
  ctx.fillRect(castleX - 12, castleY + 10, 18, 62);
  ctx.fillRect(castleX + castleW - 6, castleY + 10, 18, 62);

  // battlements
  ctx.fillStyle = damagePct > 0.5 ? '#8fa0b0' : '#b5e3ff';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(castleX + 6 + i * 16, castleY - 8, 10, 8);
  }
  ctx.fillRect(castleX - 10, castleY + 2, 8, 8);
  ctx.fillRect(castleX + castleW + 2, castleY + 2, 8, 8);

  // gate
  ctx.fillStyle = '#20374a';
  ctx.beginPath();
  ctx.moveTo(base.x - 12, castleY + castleH);
  ctx.lineTo(base.x - 12, castleY + castleH - 18);
  ctx.quadraticCurveTo(base.x, castleY + castleH - 34, base.x + 12, castleY + castleH - 18);
  ctx.lineTo(base.x + 12, castleY + castleH);
  ctx.closePath();
  ctx.fill();

  // windows
  ctx.fillStyle = '#163042';
  ctx.fillRect(castleX + 18, castleY + 22, 8, 12);
  ctx.fillRect(castleX + castleW - 26, castleY + 22, 8, 12);
  ctx.fillRect(base.x - 4, castleY + 18, 8, 10);

  // damage cracks
  if (damagePct > 0.2) {
    ctx.strokeStyle = '#2f3b46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(castleX + 18, castleY + 8);
    ctx.lineTo(castleX + 24, castleY + 24);
    ctx.lineTo(castleX + 14, castleY + 38);
    ctx.stroke();
  }
  if (damagePct > 0.45) {
    ctx.beginPath();
    ctx.moveTo(castleX + 58, castleY + 14);
    ctx.lineTo(castleX + 64, castleY + 26);
    ctx.lineTo(castleX + 54, castleY + 46);
    ctx.stroke();
  }
  if (damagePct > 0.7) {
    ctx.beginPath();
    ctx.moveTo(castleX + 38, castleY + 30);
    ctx.lineTo(castleX + 46, castleY + 46);
    ctx.lineTo(castleX + 32, castleY + 62);
    ctx.stroke();

    // fire glow when heavily damaged
    ctx.fillStyle = 'rgba(255,120,64,0.35)';
    ctx.beginPath();
    ctx.arc(castleX + 60, castleY + 52, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // flag (torn when heavily damaged)
  ctx.strokeStyle = '#dff2ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(base.x, castleY - 8);
  ctx.lineTo(base.x, castleY - 24);
  ctx.stroke();
  ctx.fillStyle = damagePct > 0.66 ? '#b05050' : '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(base.x, castleY - 24);
  ctx.lineTo(base.x + 14, castleY - 20);
  if (damagePct > 0.66) {
    ctx.lineTo(base.x + 8, castleY - 18);
  }
  ctx.lineTo(base.x, castleY - 15);
  ctx.closePath();
  ctx.fill();

  // tower buildings around the castle
  const totalTowers = state.autoClickers.length;
  for (let i = 0; i < totalTowers; i++) {
    const p = towerPos(i, totalTowers);

    ctx.fillStyle = '#6c728d';
    ctx.fillRect(p.x - 8, p.y - 10, 16, 20);

    ctx.fillStyle = '#8e95b3';
    ctx.fillRect(p.x - 10, p.y - 16, 20, 8);
    ctx.fillStyle = '#c6cbe0';
    ctx.fillRect(p.x - 8, p.y - 24, 4, 8);
    ctx.fillRect(p.x - 2, p.y - 24, 4, 8);
    ctx.fillRect(p.x + 4, p.y - 24, 4, 8);
  }

  // arrow shots from towers
  for (const a of state.arrows) {
    const t = 1 - (a.life / a.maxLife);
    const x = a.fromX + (a.toX - a.fromX) * t;
    const y = a.fromY + (a.toY - a.fromY) * t;

    const dx = a.toX - a.fromX;
    const dy = a.toY - a.fromY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const arrowLen = 10;
    ctx.strokeStyle = '#f6e7b0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - ux * arrowLen, y - uy * arrowLen);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - ux * 5 - uy * 3, y - uy * 5 + ux * 3);
    ctx.lineTo(x - ux * 5 + uy * 3, y - uy * 5 - ux * 3);
    ctx.closePath();
    ctx.fill();
  }

  // enemies
  for (const e of state.enemies) {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    if (e.maxHp > 1) {
      const w = e.r * 2;
      const h = 4;
      const x = e.x - e.r;
      const y = e.y - e.r - 9;
      ctx.fillStyle = '#1e2238';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#9dff91';
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), h);
    }
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  }
}

updateHud();
startWave();
requestAnimationFrame(loop);
