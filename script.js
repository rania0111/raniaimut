const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = 360;
const H = 560;
const WALL = 8;
const FLOOR = H - 10;

const fruits = [
  { e: "🍒", r: 14, c: "#ffb4c5", p: 2 },
  { e: "🍓", r: 18, c: "#ffadbd", p: 4 },
  { e: "🍇", r: 22, c: "#cbb6ef", p: 8 },
  { e: "🍊", r: 26, c: "#ffd29a", p: 16 },
  { e: "🍎", r: 30, c: "#ffa5b2", p: 32 },
  { e: "🍐", r: 34, c: "#d3e9a5", p: 64 },
  { e: "🍌", r: 38, c: "#ffe16c", p: 128 },
  { e: "🍑", r: 42, c: "#ffc1a7", p: 256 },
  { e: "🍍", r: 46, c: "#f7dc84", p: 512 },
  { e: "🥥", r: 50, c: "#d0ad91", p: 1024 },
  { e: "🍈", r: 54, c: "#b8e2a1", p: 2048 },
  { e: "🍉", r: 59, c: "#91d8a0", p: 4096 }
];

let balls = [];
let effects = [];
let score = 0;
let best = 0;
let current = 0;
let next = 1;
let lastFruit = -1;
let running = false;
let dropX = W / 2;
let lastDrop = 0;
let lastTime = 0;

try {
  best = Number(localStorage.getItem("melonMarketBest")) || 0;
} catch (_) {}

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const nextEl = document.getElementById("next");
const overlay = document.getElementById("overlay");

function randomFruit() {
  let fruit;

  do {
    fruit = Math.floor(Math.random() * 5);
  } while (fruit === lastFruit);

  lastFruit = fruit;
  return fruit;
}

function updateUI() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  nextEl.textContent = fruits[next].e;
}

function startGame() {
  balls = [];
  effects = [];
  score = 0;
  lastFruit = -1;
  current = randomFruit();
  next = randomFruit();
  dropX = W / 2;
  lastDrop = 0;
  running = true;

  overlay.classList.add("hidden");
  updateUI();
}

function gameOver() {
  if (!running) return;

  running = false;

  document.getElementById("title").textContent =
    "Market closed! 🍉";

  document.getElementById("message").textContent =
    "Skor kamu " + score +
    "! Coba lagi dan susun buah lebih strategis.";

  document.getElementById("play").textContent = "PLAY AGAIN";
  overlay.classList.remove("hidden");
}

function addBall(x, y, type) {
  const fruit = fruits[type];

  balls.push({
    x,
    y,
    vx: 0,
    vy: 0,
    r: fruit.r,
    type,
    age: 0
  });
}

function dropFruit() {
  if (!running || performance.now() - lastDrop < 400) return;

  const fruit = fruits[current];

  const x = Math.max(
    WALL + fruit.r,
    Math.min(W - WALL - fruit.r, dropX)
  );

  if (balls.some(ball =>
    Math.abs(ball.x - x) < ball.r + fruit.r - 4 &&
    ball.y < 65
  )) return;

  addBall(x, 30, current);

  current = next;
  next = randomFruit();
  lastDrop = performance.now();

  updateUI();
}

function mergeBalls(a, b) {
  if (a.type !== b.type ||
      a.type >= fruits.length - 1) {
    return false;
  }

  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const type = a.type + 1;

  balls = balls.filter(ball =>
    ball !== a && ball !== b
  );

  addBall(x, y, type);

  const created = balls[balls.length - 1];
  created.vy = -0.7;

  score += fruits[type].p;

  if (score > best) {
    best = score;

    try {
      localStorage.setItem("melonMarketBest", best);
    } catch (_) {}
  }

  effects.push({ x, y, life: 24 });
  updateUI();

  return true;
}

function physics(dt) {
  const step = Math.min(dt / 16.67, 1.8);
  const gravity = 0.24 * step;

  for (const b of balls) {
    b.age += dt;
    b.vy = Math.min(b.vy + gravity, 7);

    b.x += b.vx * step;
    b.y += b.vy * step;

    b.vx *= Math.pow(0.992, step);

    if (b.x - b.r < WALL) {
      b.x = WALL + b.r;
      b.vx = Math.abs(b.vx) * 0.12;
    }

    if (b.x + b.r > W - WALL) {
      b.x = W - WALL - b.r;
      b.vx = -Math.abs(b.vx) * 0.12;
    }

    if (b.y + b.r > FLOOR) {
      b.y = FLOOR - b.r;
      if (b.vy > 0.8) {
        b.vy *= -0.06;
      } else {
        b.vy = 0;
      }
      b.vx *= 0.88;
    }
  }

  let merged = false;

  for (let pass = 0; pass < 3 && !merged; pass++) {
    for (let i = 0; i < balls.length && !merged; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist >= a.r + b.r) continue;

        if (dist < 0.001) {
          dx = 0.01;
          dist = 0.01;
        }

        if (a.type === b.type &&
            a.type < fruits.length - 1) {
          merged = mergeBalls(a, b);
          break;
        }

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = a.r + b.r - dist;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const rel =
          (b.vx - a.vx) * nx +
          (b.vy - a.vy) * ny;

        if (rel < 0) {
          a.vx += nx * rel * 0.20;
          a.vy += ny * rel * 0.20;
          b.vx -= nx * rel * 0.20;
          b.vy -= ny * rel * 0.20;
        }

        a.vx *= 0.98;
        b.vx *= 0.98;
      }
    }
  }

  effects.forEach(effect => effect.life -= step);
  effects = effects.filter(effect => effect.life > 0);

  // Tumpukan mencapai batas atas terlalu lama.
  if (balls.some(b =>
    b.y - b.r < 45 && b.age > 1800
  )) {
    gameOver();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#fffafd");
  gradient.addColorStop(1, "#fff0f5");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#f5dce5";

  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    ctx.arc(
      (i * 71 + 20) % W,
      (i * 93 + 20) % H,
      2, 0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#e9a2ba";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WALL, 45);
  ctx.lineTo(W - WALL, 45);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#e9abc1";
  ctx.fillRect(0, 0, WALL, H);
  ctx.fillRect(W - WALL, 0, WALL, H);
  ctx.fillRect(0, FLOOR, W, H - FLOOR);

  if (running) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "#e5a2b9";
    ctx.beginPath();
    ctx.moveTo(dropX, 18);
    ctx.lineTo(dropX, 80);
    ctx.stroke();
    ctx.restore();

    ctx.font = `${fruits[current].r * 1.4}px serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      fruits[current].e,
      dropX,
      31 + fruits[current].r / 2
    );
  }

  for (const b of balls) {
    const fruit = fruits[b.type];

    ctx.save();
    ctx.shadowColor = "#b47a9028";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = fruit.c;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#ffffffcc";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `${b.r * 1.35}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fruit.e, b.x, b.y + 1);

    ctx.restore();
  }

  for (const effect of effects) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, effect.life / 12);
    ctx.fillStyle = "#d96890";
    ctx.font = "900 17px Nunito";
    ctx.textAlign = "center";
    ctx.fillText(
      "MERGE!",
      effect.x,
      effect.y - (24 - effect.life) * 1.2
    );
    ctx.restore();
  }
}

function loop(now) {
  const dt = lastTime
    ? Math.min(now - lastTime, 35)
    : 16;

  lastTime = now;

  if (running) physics(dt);

  draw();
  requestAnimationFrame(loop);
}

function setPosition(event) {
  const rect = canvas.getBoundingClientRect();

  dropX = (event.clientX - rect.left) * W / rect.width;
  dropX = Math.max(25, Math.min(W - 25, dropX));
}

canvas.addEventListener("pointermove", setPosition);

canvas.addEventListener("pointerdown", event => {
  if (!running) return;
  setPosition(event);
  dropFruit();
});

document.getElementById("drop")
  .addEventListener("click", dropFruit);

document.getElementById("play")
  .addEventListener("click", startGame);

document.getElementById("restart")
  .addEventListener("click", () => {
    if (running && !confirm("Yakin mau mulai ulang?")) return;
    startGame();
  });

updateUI();
requestAnimationFrame(loop);