(function () {
  "use strict";

  const CELL = 30;
  const COLORS = TetrisEngine.COLORS;
  const SHAPES = TetrisEngine.SHAPES;

  const boardCanvas = document.getElementById("board-canvas");
  const boardCtx = boardCanvas.getContext("2d");
  const nextCanvas = document.getElementById("next-canvas");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold-canvas");
  const holdCtx = holdCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const linesEl = document.getElementById("lines");
  const highScoreEl = document.getElementById("high-score");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlay-text");
  const overlayScore = document.getElementById("overlay-score");
  const startBtn = document.getElementById("start-btn");
  const toastEl = document.getElementById("clear-toast");

  const rankingLoading = document.getElementById("ranking-loading");
  const soloRankingList = document.getElementById("solo-ranking-list");

  const SCORES_API = "https://tetris-scores.koppepandayo07.workers.dev";
  const DEVICE_ID_KEY = "koppepandayo-tetris-device-id";

  const HIGH_SCORE_KEY = "koppepandayo-tetris-high-score";
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  highScoreEl.textContent = highScore;

  function getAccount() {
    try {
      return JSON.parse(localStorage.getItem("koppepandayo-tetris-account")) || {};
    } catch (e) {
      return {};
    }
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function submitScore(self) {
    const account = getAccount();
    const name = (account.discord && account.discord.username) || account.username || "ゲスト";
    const avatar = account.discord ? account.discord.avatar : null;
    const discordId = account.discord ? account.discord.id : null;
    fetch(`${SCORES_API}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar, score: self.score, lines: self.lines, level: self.level, deviceId: getDeviceId(), discordId }),
    })
      .then(() => loadRanking())
      .catch(() => {});
  }

  function makeAvatarImg(url) {
    const img = document.createElement("img");
    img.className = "player-avatar";
    img.src = url || "assets/koppecat.jpg";
    img.alt = "";
    return img;
  }

  function loadRanking() {
    rankingLoading.classList.remove("hidden");
    rankingLoading.textContent = "読み込み中...";
    soloRankingList.innerHTML = "";
    fetch(`${SCORES_API}/top?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        soloRankingList.innerHTML = "";
        (data.scores || []).forEach((s, i) => {
          const li = document.createElement("li");
          const num = document.createElement("span");
          num.className = "rank-num";
          num.textContent = `#${i + 1}`;
          const nameWrap = document.createElement("span");
          nameWrap.textContent = `${s.name} - ${s.score}`;
          li.appendChild(num);
          li.appendChild(makeAvatarImg(s.avatar));
          li.appendChild(nameWrap);
          soloRankingList.appendChild(li);
        });
        if ((data.scores || []).length === 0) {
          rankingLoading.textContent = "まだ記録がありません";
        } else {
          rankingLoading.classList.add("hidden");
        }
      })
      .catch(() => {
        rankingLoading.textContent = "読み込みに失敗しました";
      });
  }

  loadRanking();

  let toastTimer;
  let lastTime;

  const engine = new TetrisEngine({
    onLock(self, info) {
      if (info.label) showToast(info.label);
    },
    onGameOver(self) {
      endGame(self);
    },
    onChange(self) {
      scoreEl.textContent = self.score;
      levelEl.textContent = self.level;
      linesEl.textContent = self.lines;
    },
  });

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1200);
  }

  function endGame(self) {
    if (self.score > highScore) {
      highScore = self.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      highScoreEl.textContent = highScore;
    }
    if (self.score > 0) submitScore(self);
    overlayText.textContent = "GAME OVER";
    overlayScore.textContent = `スコア: ${self.score}`;
    startBtn.textContent = "もう一度";
    overlay.classList.remove("hidden");
  }

  function drawCell(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 3);
  }

  function drawBoard() {
    boardCtx.fillStyle = "#0b0b10";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    for (let y = 0; y < TetrisEngine.ROWS; y++) {
      for (let x = 0; x < TetrisEngine.COLS; x++) {
        if (engine.grid[y][x]) drawCell(boardCtx, x, y, CELL, COLORS[engine.grid[y][x]] || "#666");
      }
    }

    if (engine.current) {
      const ghost = engine.ghostPiece();
      boardCtx.globalAlpha = 0.25;
      for (const [x, y] of engine.cells(ghost)) {
        if (y >= 0) drawCell(boardCtx, x, y, CELL, COLORS[engine.current.name]);
      }
      boardCtx.globalAlpha = 1;

      for (const [x, y] of engine.cells(engine.current)) {
        if (y >= 0) drawCell(boardCtx, x, y, CELL, COLORS[engine.current.name]);
      }
    }
  }

  function drawPieceInBox(ctx, name, boxX, boxY, boxW, boxH) {
    if (!name) return;
    const size = Math.floor(Math.min(boxW / 4, boxH));
    const shape = SHAPES[name][0];
    const xs = shape.map((c) => c[0]);
    const ys = shape.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const offX = boxX / size + (boxW / size - (maxX - minX + 1)) / 2 - minX;
    const offY = boxY / size + (boxH / size - (maxY - minY + 1)) / 2 - minY;
    for (const [x, y] of shape) {
      drawCell(ctx, x + offX, y + offY, size, COLORS[name]);
    }
  }

  function drawNext() {
    nextCtx.fillStyle = "#0b0b10";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const slotH = nextCanvas.height / 5;
    engine.nextQueue.slice(0, 5).forEach((name, i) => {
      drawPieceInBox(nextCtx, name, 0, i * slotH, nextCanvas.width, slotH);
    });
  }

  function drawHold() {
    holdCtx.fillStyle = "#0b0b10";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    drawPieceInBox(holdCtx, engine.holdPiece, 0, 0, holdCanvas.width, holdCanvas.height);
  }

  function render() {
    drawBoard();
    drawNext();
    drawHold();
  }

  function startGame() {
    engine.start();
    overlay.classList.add("hidden");
    render();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    const paused = engine.togglePause();
    if (paused) {
      overlayText.textContent = "PAUSED";
      overlayScore.textContent = "";
      startBtn.textContent = "再開";
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function loop(time) {
    if (!engine.running || engine.paused) return;
    const dt = time - lastTime;
    lastTime = time;
    engine.update(dt);
    render();
    if (engine.running) requestAnimationFrame(loop);
  }

  function handleAction(action) {
    engine.handleAction(action);
    render();
  }

  document.addEventListener("keydown", (e) => {
    if (!engine.running || engine.paused) {
      if (e.key === "p" || e.key === "P") togglePause();
      return;
    }
    switch (e.key) {
      case "ArrowLeft": if (!e.repeat) { engine.startDas("left"); render(); } e.preventDefault(); break;
      case "ArrowRight": if (!e.repeat) { engine.startDas("right"); render(); } e.preventDefault(); break;
      case "ArrowDown":
        if (!e.repeat) { engine.softDropHeld = true; engine.softDropElapsed = 20; handleAction("down"); }
        e.preventDefault();
        break;
      case "ArrowUp": case "x": case "X": if (!e.repeat) handleAction("rotate"); e.preventDefault(); break;
      case "z": case "Z": if (!e.repeat) handleAction("rotate-ccw"); e.preventDefault(); break;
      case " ": if (!e.repeat) handleAction("drop"); e.preventDefault(); break;
      case "c": case "C": if (!e.repeat) handleAction("hold"); e.preventDefault(); break;
      case "p": case "P": togglePause(); e.preventDefault(); break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.key) {
      case "ArrowLeft": engine.stopDas("left"); break;
      case "ArrowRight": engine.stopDas("right"); break;
      case "ArrowDown": engine.softDropHeld = false; break;
    }
  });

  window.addEventListener("blur", () => {
    engine.dasDirection = null;
    engine.softDropHeld = false;
    engine.keysHeld.left = false;
    engine.keysHeld.right = false;
  });

  document.querySelectorAll(".tetris-touch button").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action));
  });

  startBtn.addEventListener("click", () => {
    if (engine.paused) {
      togglePause();
    } else {
      startGame();
    }
  });

  overlayText.textContent = "Ready?";
  render();
})();
