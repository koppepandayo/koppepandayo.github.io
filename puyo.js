(function () {
  "use strict";

  const CELL = 48;
  const COLORS = PuyoEngine.COLORS;
  const API = "https://tetris-scores.koppepandayo07.workers.dev";
  const ACCOUNT_KEY = "koppepandayo-tetris-account";
  const DEVICE_KEY = "koppepandayo-tetris-device-id";
  const HIGH_KEY = "koppepandayo-puyo-high-score";

  const board = document.getElementById("puyo-board-canvas");
  const ctx = board.getContext("2d");
  const next = document.getElementById("puyo-next-canvas");
  const nextCtx = next.getContext("2d");
  const scoreEl = document.getElementById("score");
  const chainEl = document.getElementById("chain");
  const maxChainEl = document.getElementById("max-chain");
  const highEl = document.getElementById("high-score");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const overlayScore = document.getElementById("overlay-score");
  const startBtn = document.getElementById("start-btn");
  const toast = document.getElementById("clear-toast");
  const loading = document.getElementById("ranking-loading");
  const list = document.getElementById("solo-ranking-list");

  let highScore = Number(localStorage.getItem(HIGH_KEY)) || 0;
  let lastTime = performance.now();
  let toastTimer = null;
  highEl.textContent = highScore.toLocaleString();

  function account() {
    try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || {}; } catch (_) { return {}; }
  }

  function deviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function drawPuyo(target, x, y, color, size) {
    const r = size * .4;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const grad = target.createRadialGradient(cx - r * .4, cy - r * .45, r * .08, cx, cy, r);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(.18, COLORS[color]);
    grad.addColorStop(1, shade(COLORS[color], -.32));
    target.beginPath(); target.arc(cx, cy, r, 0, Math.PI * 2); target.fillStyle = grad; target.fill();
    target.beginPath(); target.arc(cx - r * .2, cy - r * .12, r * .1, 0, Math.PI * 2); target.fillStyle = "rgba(255,255,255,.75)"; target.fill();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = amount < 0 ? 0 : 255;
    const p = Math.abs(amount);
    const r = n >> 16, g = n >> 8 & 255, b = n & 255;
    return `rgb(${Math.round((f-r)*p+r)},${Math.round((f-g)*p+g)},${Math.round((f-b)*p+b)})`;
  }

  function render(self) {
    ctx.clearRect(0, 0, board.width, board.height);
    ctx.fillStyle = "#090d18"; ctx.fillRect(0, 0, board.width, board.height);
    ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1;
    for (let x = 1; x < 6; x++) { ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, board.height); ctx.stroke(); }
    for (let y = 1; y < 12; y++) { ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(board.width, y*CELL); ctx.stroke(); }
    for (let y = 0; y < 12; y++) for (let x = 0; x < 6; x++) if (self.grid[y][x]) {
      const erasing = self.erasingCells && self.erasingCells.has(`${x},${y}`);
      if (!erasing || Math.floor(self.resolveElapsed / 80) % 2 === 0) drawPuyo(ctx, x*CELL, y*CELL, self.grid[y][x], CELL);
    }
    if (self.current && !self.gameOver) for (const cell of self.cellsOf()) if (cell.y >= 0) drawPuyo(ctx, cell.x*CELL, cell.y*CELL, cell.color, CELL);

    scoreEl.textContent = self.score.toLocaleString();
    chainEl.textContent = self.chainCount;
    maxChainEl.textContent = self.maxChain;
    drawNext(self.nextQueue);
  }

  function drawNext(queue) {
    nextCtx.clearRect(0, 0, next.width, next.height);
    queue.slice(0, 2).forEach((pair, i) => {
      drawPuyo(nextCtx, 24, 10 + i*98, pair[1], 48);
      drawPuyo(nextCtx, 24, 50 + i*98, pair[0], 48);
    });
  }

  function showToast(text) {
    toast.textContent = text; toast.classList.add("show"); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1000);
  }

  function submit(self) {
    const a = account();
    if (!a.discord) return;
    fetch(`${API}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      game: "puyo", name: a.discord.username, avatar: a.discord.avatar, score: self.score,
      lines: self.maxChain, level: 1, deviceId: deviceId(), discordId: a.discord.id,
    }) }).then(loadRanking).catch(function () {});
  }

  function avatar(url) {
    const img = document.createElement("img"); img.className = "player-avatar"; img.src = url || "assets/koppecat.jpg"; img.alt = ""; return img;
  }

  function loadRanking() {
    loading.classList.remove("hidden"); loading.textContent = "読み込み中..."; list.innerHTML = "";
    fetch(`${API}/top?game=puyo&limit=20`).then(r => r.json()).then(data => {
      (data.scores || []).forEach((s, i) => {
        const li = document.createElement("li");
        const num = document.createElement("span"); num.className = "rank-num"; num.textContent = `#${i+1}`;
        const info = document.createElement("div"); info.className = "rank-info";
        const name = document.createElement("span"); name.className = "rank-name"; name.textContent = s.name;
        const score = document.createElement("span"); score.className = "rank-score"; score.textContent = `${Number(s.score).toLocaleString()} pts / 最大 ${s.lines || 0}連鎖`;
        info.append(name, score); li.append(num, avatar(s.avatar), info); list.append(li);
      });
      loading.textContent = data.scores && data.scores.length ? "" : "まだ記録がありません";
    }).catch(() => { loading.textContent = "ランキングを読み込めませんでした"; });
  }

  const engine = new PuyoEngine({
    onChange: render,
    onLock: function (self, result) {
      if (result.chainCount) {
        showToast(result.allClear ? "全消し！ +3600" : result.chainCount > 1 ? `${result.chainCount}連鎖！` : `${result.erasedCount}個消し`);
        TetrisAudio.playSFX(result.chainCount >= 4 ? "tetris" : result.chainCount >= 2 ? "line3" : "line1");
      } else TetrisAudio.playSFX("lock");
    },
    onGameOver: function (self) {
      TetrisAudio.stopMusic(); TetrisAudio.playSFX("gameover");
      if (self.score > highScore) { highScore = self.score; localStorage.setItem(HIGH_KEY, highScore); highEl.textContent = highScore.toLocaleString(); }
      submit(self); overlayText.textContent = "GAME OVER"; overlayScore.textContent = `SCORE ${self.score.toLocaleString()}`; startBtn.textContent = "もう一度"; startBtn.classList.remove("hidden"); overlay.classList.remove("hidden");
    },
  });

  function start() {
    TetrisAudio.resume(); TetrisAudio.startMusic(); overlay.classList.add("hidden"); engine.start(); lastTime = performance.now();
  }
  startBtn.addEventListener("click", start);

  const keyMap = { ArrowUp:"rotate", KeyX:"rotate", KeyZ:"rotate-ccw", Space:"drop" };
  document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space"].includes(e.code)) e.preventDefault();
    if (e.repeat && !["ArrowLeft","ArrowRight","ArrowDown"].includes(e.code)) return;
    if (e.code === "ArrowLeft" && !e.repeat) engine.startDas("left");
    else if (e.code === "ArrowRight" && !e.repeat) engine.startDas("right");
    else if (e.code === "ArrowDown") { engine.softDropHeld = true; if (!e.repeat) engine.handleAction("down"); }
    else if (e.code === "KeyP") { engine.togglePause(); overlayText.textContent="PAUSED"; overlayScore.textContent=""; startBtn.classList.add("hidden"); overlay.classList.toggle("hidden", !engine.paused); }
    else if (keyMap[e.code]) engine.handleAction(keyMap[e.code]);
  });
  document.addEventListener("keyup", e => {
    if (e.code === "ArrowLeft") engine.stopDas("left");
    if (e.code === "ArrowRight") engine.stopDas("right");
    if (e.code === "ArrowDown") { engine.softDropHeld=false; engine.softDropElapsed=0; }
  });

  document.querySelectorAll(".puyo-touch button").forEach(btn => {
    const action = btn.dataset.action;
    const begin = e => { e.preventDefault(); TetrisAudio.resume(); if (action === "left" || action === "right") engine.startDas(action); else if (action === "down") { engine.softDropHeld=true; engine.handleAction("down"); } else engine.handleAction(action); };
    const end = e => { e.preventDefault(); if (action === "left" || action === "right") engine.stopDas(action); if (action === "down") { engine.softDropHeld=false; engine.softDropElapsed=0; } };
    btn.addEventListener("pointerdown", begin); btn.addEventListener("pointerup", end); btn.addEventListener("pointercancel", end); btn.addEventListener("pointerleave", end);
  });

  function frame(now) { const dt = Math.min(50, now-lastTime); lastTime=now; engine.update(dt); render(engine); requestAnimationFrame(frame); }
  render(engine); loadRanking(); requestAnimationFrame(frame);
})();
