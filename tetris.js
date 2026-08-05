(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;

  const COLORS = {
    I: "#33e0ff",
    O: "#f0d048",
    T: "#b06fe0",
    S: "#4fd67a",
    Z: "#e0555f",
    J: "#4a7fe0",
    L: "#f0a048",
  };

  const SHAPES = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  };

  const PIECE_NAMES = Object.keys(SHAPES);

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

  const HIGH_SCORE_KEY = "koppepandayo-tetris-high-score";
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  highScoreEl.textContent = highScore;

  let grid, bag, nextQueue, current, holdPiece, canHold;
  let score, level, lines, dropInterval, dropAccumulator, lockTimer, lockResets;
  let running, paused, gameOver, lastTime;

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    const b = PIECE_NAMES.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  function nextFromBag() {
    if (bag.length === 0) bag = refillBag();
    return bag.pop();
  }

  function spawnPiece(name) {
    return { name, rot: 0, x: 3, y: -1 };
  }

  function cells(piece) {
    return SHAPES[piece.name][piece.rot].map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
  }

  function collides(piece) {
    for (const [x, y] of cells(piece)) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function tryMove(dx, dy) {
    const moved = { ...current, x: current.x + dx, y: current.y + dy };
    if (collides(moved)) return false;
    current = moved;
    return true;
  }

  function tryRotate() {
    const rot = (current.rot + 1) % 4;
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      const rotated = { ...current, rot, x: current.x + k };
      if (!collides(rotated)) {
        current = rotated;
        resetLockIfGrounded();
        return true;
      }
    }
    return false;
  }

  function resetLockIfGrounded() {
    const grounded = collides({ ...current, y: current.y + 1 });
    if (grounded && lockTimer !== null && lockResets < 15) {
      lockTimer = 0;
      lockResets++;
    }
  }

  function hardDrop() {
    let dist = 0;
    while (tryMove(0, 1)) dist++;
    score += dist * 2;
    lockPiece();
  }

  function lockPiece() {
    for (const [x, y] of cells(current)) {
      if (y < 0) {
        endGame();
        return;
      }
      grid[y][x] = current.name;
    }
    clearLines();
    spawnNext();
    canHold = true;
    lockTimer = null;
    lockResets = 0;
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((c) => c)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
      score += (table[cleared] || 0) * level;
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(100, 1000 - (level - 1) * 75);
      }
    }
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function spawnNext() {
    current = spawnPiece(nextQueue.shift());
    nextQueue.push(nextFromBag());
    drawNext();
    if (collides(current)) endGame();
  }

  function holdSwap() {
    if (!canHold) return;
    canHold = false;
    if (holdPiece === null) {
      holdPiece = current.name;
      spawnNext();
    } else {
      const tmp = holdPiece;
      holdPiece = current.name;
      current = spawnPiece(tmp);
    }
    drawHold();
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
      highScoreEl.textContent = highScore;
    }
    overlayText.textContent = "GAME OVER";
    overlayScore.textContent = `スコア: ${score}`;
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

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawCell(boardCtx, x, y, CELL, COLORS[grid[y][x]]);
      }
    }

    if (current) {
      const ghost = { ...current };
      while (!collides({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      boardCtx.globalAlpha = 0.25;
      for (const [x, y] of cells(ghost)) {
        if (y >= 0) drawCell(boardCtx, x, y, CELL, COLORS[current.name]);
      }
      boardCtx.globalAlpha = 1;

      for (const [x, y] of cells(current)) {
        if (y >= 0) drawCell(boardCtx, x, y, CELL, COLORS[current.name]);
      }
    }
  }

  function drawMini(ctx, canvas, name) {
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!name) return;
    const size = 20;
    const shape = SHAPES[name][0];
    const xs = shape.map((c) => c[0]);
    const ys = shape.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const offX = (canvas.width / size - (maxX - minX + 1)) / 2 - minX;
    const offY = (canvas.height / size - (maxY - minY + 1)) / 2 - minY;
    for (const [x, y] of shape) {
      drawCell(ctx, x + offX, y + offY, size, COLORS[name]);
    }
  }

  function drawNext() {
    drawMini(nextCtx, nextCanvas, nextQueue[0]);
  }

  function drawHold() {
    drawMini(holdCtx, holdCanvas, holdPiece);
  }

  function resetGame() {
    grid = makeGrid();
    bag = refillBag();
    nextQueue = [nextFromBag(), nextFromBag()];
    holdPiece = null;
    canHold = true;
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    dropAccumulator = 0;
    lockTimer = null;
    lockResets = 0;
    gameOver = false;
    scoreEl.textContent = "0";
    levelEl.textContent = "1";
    linesEl.textContent = "0";
    spawnNext();
    drawHold();
    drawBoard();
  }

  function startGame() {
    resetGame();
    running = true;
    paused = false;
    overlay.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
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
    if (!running || paused) return;
    const dt = time - lastTime;
    lastTime = time;

    const grounded = collides({ ...current, y: current.y + 1 });
    if (grounded) {
      if (lockTimer === null) lockTimer = 0;
      lockTimer += dt;
      if (lockTimer >= 500) {
        lockPiece();
      }
    } else {
      dropAccumulator += dt;
      if (dropAccumulator >= dropInterval) {
        dropAccumulator = 0;
        tryMove(0, 1);
      }
      lockTimer = null;
      lockResets = 0;
    }

    drawBoard();
    requestAnimationFrame(loop);
  }

  function handleAction(action) {
    if (!running || paused) return;
    switch (action) {
      case "left": tryMove(-1, 0); resetLockIfGrounded(); break;
      case "right": tryMove(1, 0); resetLockIfGrounded(); break;
      case "down": if (tryMove(0, 1)) score += 1; break;
      case "rotate": tryRotate(); break;
      case "drop": hardDrop(); break;
      case "hold": holdSwap(); break;
    }
    scoreEl.textContent = score;
  }

  document.addEventListener("keydown", (e) => {
    if (e.repeat && ["ArrowUp", "x", "X", " ", "c", "C", "p", "P"].includes(e.key)) return;
    switch (e.key) {
      case "ArrowLeft": handleAction("left"); e.preventDefault(); break;
      case "ArrowRight": handleAction("right"); e.preventDefault(); break;
      case "ArrowDown": handleAction("down"); e.preventDefault(); break;
      case "ArrowUp": case "x": case "X": handleAction("rotate"); e.preventDefault(); break;
      case " ": handleAction("drop"); e.preventDefault(); break;
      case "c": case "C": handleAction("hold"); e.preventDefault(); break;
      case "p": case "P": togglePause(); e.preventDefault(); break;
    }
  });

  document.querySelectorAll(".tetris-touch button").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action));
  });

  startBtn.addEventListener("click", () => {
    if (paused) {
      togglePause();
    } else {
      startGame();
    }
  });

  overlayText.textContent = "TETRIS";
  grid = makeGrid();
  drawBoard();
})();
