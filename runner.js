(function () {
  "use strict";

  const canvas = document.getElementById("runner-canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("runner-score");
  const highEl = document.getElementById("runner-high");
  const overlay = document.getElementById("runner-overlay");
  const messageEl = document.getElementById("runner-message");
  const resultEl = document.getElementById("runner-result");
  const startBtn = document.getElementById("runner-start");
  const statusEl = document.getElementById("image-status");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = 258;
  const HIGH_KEY = "koppepandayo-runner-high-score";
  const DB_NAME = "koppepandayo-runner-assets";
  const STORE_NAME = "images";
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  const assets = { player: null, obstacle: null, background: null };
  const objectUrls = { player: null, obstacle: null, background: null };
  const player = { x: 104, y: GROUND_Y - 64, w: 64, h: 64, vy: 0, grounded: true, ducking: false };
  let obstacles = [];
  let running = false;
  let paused = false;
  let gameOver = false;
  let score = 0;
  let highScore = Number(localStorage.getItem(HIGH_KEY)) || 0;
  let speed = 360;
  let spawnTimer = 1.2;
  let groundOffset = 0;
  let lastTime = performance.now();
  let dbPromise = null;

  highEl.textContent = formatScore(highScore);

  function formatScore(value) {
    return String(Math.floor(value)).padStart(5, "0");
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  }

  async function dbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  function previewElement(kind) {
    return document.getElementById(`${kind}-preview`);
  }

  function updatePreview(kind, url) {
    const preview = previewElement(kind);
    if (kind === "player" || kind === "background") {
      if (url) preview.src = url;
      else if (kind === "player") preview.src = "assets/koppecat.jpg";
      else preview.removeAttribute("src");
    } else {
      preview.textContent = url ? "" : "▲";
      preview.style.backgroundImage = url ? `url("${url}")` : "none";
      preview.style.backgroundSize = "contain";
      preview.style.backgroundPosition = "center";
      preview.style.backgroundRepeat = "no-repeat";
    }
  }

  async function applyBlob(kind, blob) {
    if (objectUrls[kind]) URL.revokeObjectURL(objectUrls[kind]);
    objectUrls[kind] = blob ? URL.createObjectURL(blob) : null;
    const url = objectUrls[kind] || (kind === "player" ? "assets/koppecat.jpg" : null);
    assets[kind] = url ? await loadImage(url) : null;
    updatePreview(kind, url);
  }

  async function restoreImages() {
    try {
      await Promise.all(["player", "obstacle", "background"].map(async (kind) => {
        await applyBlob(kind, await dbGet(kind));
      }));
    } catch (_) {
      assets.player = await loadImage("assets/koppecat.jpg").catch(() => null);
      statusEl.textContent = "保存画像を読み込めなかったため、初期画像を使います。";
    }
  }

  async function selectImage(kind, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      statusEl.textContent = "画像ファイルを選んでください。";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      statusEl.textContent = "画像は10MB以下にしてください。";
      return;
    }
    try {
      await dbPut(kind, file);
      await applyBlob(kind, file);
      statusEl.textContent = `${kind === "player" ? "プレイヤー" : kind === "obstacle" ? "障害物" : "背景"}画像を保存しました。`;
    } catch (_) {
      statusEl.textContent = "画像を保存できませんでした。別の画像を試してください。";
    }
  }

  ["player", "obstacle", "background"].forEach((kind) => {
    document.getElementById(`${kind}-image-input`).addEventListener("change", (event) => {
      selectImage(kind, event.target.files[0]);
      event.target.value = "";
    });
  });

  document.getElementById("reset-images").addEventListener("click", async () => {
    try {
      await Promise.all(["player", "obstacle", "background"].map(dbDelete));
      await Promise.all(["player", "obstacle", "background"].map((kind) => applyBlob(kind, null)));
      statusEl.textContent = "画像を初期状態に戻しました。";
    } catch (_) {
      statusEl.textContent = "画像を初期状態に戻せませんでした。";
    }
  });

  function resetGame() {
    score = 0;
    speed = 360;
    spawnTimer = 1.1;
    groundOffset = 0;
    obstacles = [];
    Object.assign(player, { y: GROUND_Y - 64, w: 64, h: 64, vy: 0, grounded: true, ducking: false });
    scoreEl.textContent = "00000";
    running = true;
    paused = false;
    gameOver = false;
    lastTime = performance.now();
    overlay.classList.add("hidden");
    TetrisAudio.resume();
    TetrisAudio.startMusic();
  }

  function resumeGame() {
    paused = false;
    lastTime = performance.now();
    overlay.classList.add("hidden");
    TetrisAudio.startMusic();
  }

  function pauseGame() {
    if (!running || gameOver) return;
    paused = true;
    messageEl.textContent = "PAUSED";
    resultEl.textContent = "Pまたはボタンで再開";
    startBtn.textContent = "再開";
    overlay.classList.remove("hidden");
    TetrisAudio.stopMusic();
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > highScore) {
      highScore = Math.floor(score);
      localStorage.setItem(HIGH_KEY, String(highScore));
      highEl.textContent = formatScore(highScore);
    }
    messageEl.textContent = "GAME OVER";
    resultEl.textContent = `SCORE ${formatScore(score)}`;
    startBtn.textContent = "もう一度";
    overlay.classList.remove("hidden");
    TetrisAudio.stopMusic();
    TetrisAudio.playSFX("gameover");
  }

  function jump() {
    if (!running || paused || gameOver || !player.grounded) return;
    setDuck(false);
    player.vy = -720;
    player.grounded = false;
    TetrisAudio.playSFX("rotate");
  }

  function setDuck(value) {
    player.ducking = value;
    if (!player.grounded) {
      if (value && player.vy < 520) player.vy += 260;
      return;
    }
    player.h = value ? 40 : 64;
    player.w = value ? 72 : 64;
    player.y = GROUND_Y - player.h;
  }

  function spawnObstacle() {
    const height = 42 + Math.random() * 24;
    let width = height * .72;
    if (assets.obstacle && assets.obstacle.naturalHeight) {
      width = height * assets.obstacle.naturalWidth / assets.obstacle.naturalHeight;
      width = Math.max(30, Math.min(86, width));
    }
    obstacles.push({ x: WIDTH + 20, y: GROUND_Y - height, w: width, h: height, passed: false });
    const speedScale = Math.max(.55, 360 / speed);
    spawnTimer = (.92 + Math.random() * .78) * speedScale;
  }

  function overlaps(a, b) {
    const ap = { x: a.x + 11, y: a.y + 8, w: a.w - 21, h: a.h - 12 };
    const bp = { x: b.x + 6, y: b.y + 5, w: b.w - 12, h: b.h - 7 };
    return ap.x < bp.x + bp.w && ap.x + ap.w > bp.x && ap.y < bp.y + bp.h && ap.y + ap.h > bp.y;
  }

  function update(dt) {
    if (!running || paused) return;
    score += dt * 12;
    speed = Math.min(680, 360 + score * .13);
    scoreEl.textContent = formatScore(score);
    groundOffset = (groundOffset + speed * dt) % 56;

    player.vy += 1900 * dt;
    player.y += player.vy * dt;
    const groundTop = GROUND_Y - player.h;
    if (player.y >= groundTop) {
      player.y = groundTop;
      player.vy = 0;
      player.grounded = true;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) spawnObstacle();
    for (const obstacle of obstacles) {
      obstacle.x -= speed * dt;
      if (!obstacle.passed && obstacle.x + obstacle.w < player.x) {
        obstacle.passed = true;
        TetrisAudio.playSFX("move");
      }
      if (overlaps(player, obstacle)) {
        endGame();
        return;
      }
    }
    obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.w > -20);
  }

  function drawImageContain(image, x, y, w, h) {
    if (!image || !image.naturalWidth) return false;
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - dw) / 2, y + h - dh, dw, dh);
    return true;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (assets.background) {
      const image = assets.background;
      const scale = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
      const sw = WIDTH / scale;
      const sh = HEIGHT / scale;
      ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, 0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "rgba(7,8,14,.28)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, "#15182b");
      gradient.addColorStop(1, "#090a11");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "rgba(255,255,255,.06)";
      for (let i = 0; i < 22; i++) {
        const x = (i * 137 + 31) % WIDTH;
        const y = (i * 59 + 26) % 170;
        ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
    }
  }

  function drawGround() {
    ctx.strokeStyle = "rgba(255,178,71,.72)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 1); ctx.lineTo(WIDTH, GROUND_Y + 1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.09)";
    ctx.lineWidth = 1;
    for (let x = -groundOffset; x < WIDTH; x += 56) {
      ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 12); ctx.lineTo(x + 28, GROUND_Y + 12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 35, GROUND_Y + 25); ctx.lineTo(x + 47, GROUND_Y + 25); ctx.stroke();
    }
  }

  function drawPlayer() {
    if (drawImageContain(assets.player, player.x, player.y, player.w, player.h)) return;
    ctx.fillStyle = "#ffb247";
    ctx.fillRect(player.x + 6, player.y + 8, player.w - 12, player.h - 8);
  }

  function drawObstacle(obstacle) {
    if (drawImageContain(assets.obstacle, obstacle.x, obstacle.y, obstacle.w, obstacle.h)) return;
    ctx.fillStyle = "#33e0c9";
    ctx.beginPath();
    ctx.moveTo(obstacle.x + obstacle.w / 2, obstacle.y);
    ctx.lineTo(obstacle.x + obstacle.w, obstacle.y + obstacle.h);
    ctx.lineTo(obstacle.x, obstacle.y + obstacle.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.moveTo(obstacle.x + obstacle.w / 2, obstacle.y + 5); ctx.lineTo(obstacle.x + obstacle.w * .65, obstacle.y + obstacle.h * .76); ctx.lineTo(obstacle.x + obstacle.w * .42, obstacle.y + obstacle.h * .65); ctx.closePath(); ctx.fill();
  }

  function render() {
    drawBackground();
    drawGround();
    for (const obstacle of obstacles) drawObstacle(obstacle);
    drawPlayer();
  }

  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  startBtn.addEventListener("click", () => paused ? resumeGame() : resetGame());
  canvas.addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });
  document.getElementById("runner-jump").addEventListener("pointerdown", (event) => { event.preventDefault(); jump(); });
  const duckBtn = document.getElementById("runner-duck");
  duckBtn.addEventListener("pointerdown", (event) => { event.preventDefault(); setDuck(true); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => duckBtn.addEventListener(name, () => setDuck(false)));

  document.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
    if (event.code === "ArrowDown") setDuck(true);
    if (event.code === "KeyP" && !event.repeat) paused ? resumeGame() : pauseGame();
  });
  document.addEventListener("keyup", (event) => { if (event.code === "ArrowDown") setDuck(false); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && running && !paused) pauseGame(); });

  restoreImages().finally(() => render());
  render();
  requestAnimationFrame(frame);
})();
