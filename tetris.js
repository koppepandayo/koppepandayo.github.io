(function () {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const DAS = 130; // ms held before auto-repeat starts
  const ARR = 20; // ms between auto-repeat steps
  const SOFT_DROP_ARR = 20; // ms between soft-drop steps while held

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

  // SRS wall kick offsets, [dx, dy] with dy positive = UP (official SRS convention).
  // Applied to our grid (dy positive = down) by negating dy on use.
  const KICKS_JLSTZ = {
    "0-1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "1-0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1-2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "2-1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "3-2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3-0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "0-3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };

  const KICKS_I = {
    "0-1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "1-0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1-2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    "2-1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2-3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "3-2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3-0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "0-3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

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

  const HIGH_SCORE_KEY = "koppepandayo-tetris-high-score";
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  highScoreEl.textContent = highScore;

  let grid, bag, nextQueue, current, holdPiece, canHold;
  let score, level, lines, dropInterval, dropAccumulator, lockTimer, lockResets;
  let running, paused, gameOver, lastTime;
  let lastActionWasRotate, lastKickIndex, combo, backToBack;
  let toastTimer;

  // input state
  const keysHeld = { left: false, right: false };
  let dasDirection = null;
  let dasElapsed = 0;
  let arrElapsed = 0;
  let softDropHeld = false;
  let softDropElapsed = 0;

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
    lastActionWasRotate = false;
    return true;
  }

  function tryRotate(dir) {
    const rot = (current.rot + dir + 4) % 4;
    if (current.name === "O") {
      current = { ...current, rot };
      lastActionWasRotate = true;
      lastKickIndex = 0;
      return true;
    }
    const table = current.name === "I" ? KICKS_I : KICKS_JLSTZ;
    const key = `${current.rot}-${rot}`;
    const kicks = table[key] || [[0, 0]];
    for (let i = 0; i < kicks.length; i++) {
      const [kx, ky] = kicks[i];
      const rotated = { ...current, rot, x: current.x + kx, y: current.y - ky };
      if (!collides(rotated)) {
        current = rotated;
        lastActionWasRotate = true;
        lastKickIndex = i;
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

  function isBlocked(x, y) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return !!grid[y][x];
  }

  function detectTSpin() {
    if (current.name !== "T" || !lastActionWasRotate) return null;

    const topLeft = isBlocked(current.x, current.y);
    const topRight = isBlocked(current.x + 2, current.y);
    const bottomLeft = isBlocked(current.x, current.y + 2);
    const bottomRight = isBlocked(current.x + 2, current.y + 2);
    const total = [topLeft, topRight, bottomLeft, bottomRight].filter(Boolean).length;
    if (total < 3) return null;

    let frontCount;
    switch (current.rot) {
      case 0: frontCount = [topLeft, topRight].filter(Boolean).length; break;
      case 1: frontCount = [topRight, bottomRight].filter(Boolean).length; break;
      case 2: frontCount = [bottomLeft, bottomRight].filter(Boolean).length; break;
      default: frontCount = [topLeft, bottomLeft].filter(Boolean).length; break;
    }

    if (frontCount === 2) return "full";
    if (lastKickIndex === 4) return "full"; // TST kick exception
    return "mini";
  }

  function hardDrop() {
    let dist = 0;
    while (!collides({ ...current, y: current.y + 1 })) {
      current = { ...current, y: current.y + 1 };
      dist++;
    }
    score += dist * 2;
    lockPiece();
  }

  function lockPiece() {
    const tspin = detectTSpin();
    for (const [x, y] of cells(current)) {
      if (y < 0) {
        endGame();
        return;
      }
      grid[y][x] = current.name;
    }
    clearLines(tspin);
    spawnNext();
    canHold = true;
    lockTimer = null;
    lockResets = 0;
  }

  const CLEAR_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE"];

  function clearLines(tspin) {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((c) => c)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }

    let gained = 0;
    let label = null;

    if (tspin) {
      const table = { "full:0": 400, "full:1": 800, "full:2": 1200, "full:3": 1600, "mini:0": 100, "mini:1": 200 };
      gained = (table[`${tspin}:${cleared}`] || 0) * level;
      label = (tspin === "mini" ? "T-SPIN MINI" : "T-SPIN") + (cleared ? " " + CLEAR_NAMES[cleared] : "");
    } else if (cleared > 0) {
      const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
      gained = (table[cleared] || 0) * level;
      label = cleared === 4 ? "TETRIS" : CLEAR_NAMES[cleared];
    }

    if (cleared > 0) {
      const difficult = cleared === 4 || tspin !== null;
      if (difficult) {
        if (backToBack) {
          gained = Math.floor(gained * 1.5);
          label += " B2B";
        }
        backToBack = true;
      } else {
        backToBack = false;
      }

      combo++;
      if (combo > 0) {
        gained += 50 * combo * level;
        label += ` COMBO x${combo + 1}`;
      }
    } else {
      combo = -1;
    }

    if (gained > 0) score += gained;
    if (label) showToast(label);

    if (cleared > 0) {
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(50, Math.pow(0.8 - (level - 1) * 0.007, level - 1) * 1000);
      }
    }

    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1200);
  }

  function spawnNext() {
    current = spawnPiece(nextQueue.shift());
    nextQueue.push(nextFromBag());
    lastActionWasRotate = false;
    lastKickIndex = -1;
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
      lastActionWasRotate = false;
    }
    drawHold();
  }

  function endGame() {
    running = false;
    gameOver = true;
    dasDirection = null;
    softDropHeld = false;
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
    nextQueue.slice(0, 5).forEach((name, i) => {
      drawPieceInBox(nextCtx, name, 0, i * slotH, nextCanvas.width, slotH);
    });
  }

  function drawHold() {
    holdCtx.fillStyle = "#0b0b10";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    drawPieceInBox(holdCtx, holdPiece, 0, 0, holdCanvas.width, holdCanvas.height);
  }

  function resetGame() {
    grid = makeGrid();
    bag = refillBag();
    nextQueue = [nextFromBag(), nextFromBag(), nextFromBag(), nextFromBag(), nextFromBag()];
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
    combo = -1;
    backToBack = false;
    lastActionWasRotate = false;
    lastKickIndex = -1;
    dasDirection = null;
    softDropHeld = false;
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

    if (dasDirection) {
      dasElapsed += dt;
      if (dasElapsed >= DAS) {
        arrElapsed += dt;
        while (arrElapsed >= ARR) {
          arrElapsed -= ARR;
          const moved = tryMove(dasDirection === "left" ? -1 : 1, 0);
          resetLockIfGrounded();
          if (!moved) break;
        }
      }
    }

    if (softDropHeld) {
      softDropElapsed += dt;
      while (softDropElapsed >= SOFT_DROP_ARR) {
        softDropElapsed -= SOFT_DROP_ARR;
        if (tryMove(0, 1)) score += 1;
      }
    }

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

    scoreEl.textContent = score;
    drawBoard();
    requestAnimationFrame(loop);
  }

  function handleAction(action) {
    if (!running || paused) return;
    switch (action) {
      case "left": tryMove(-1, 0); resetLockIfGrounded(); break;
      case "right": tryMove(1, 0); resetLockIfGrounded(); break;
      case "down": if (tryMove(0, 1)) score += 1; break;
      case "rotate": tryRotate(1); break;
      case "rotate-ccw": tryRotate(-1); break;
      case "drop": hardDrop(); break;
      case "hold": holdSwap(); break;
    }
    scoreEl.textContent = score;
  }

  function startDas(dir) {
    keysHeld[dir] = true;
    dasDirection = dir;
    dasElapsed = 0;
    arrElapsed = 0;
    handleAction(dir);
  }

  function stopDas(dir) {
    keysHeld[dir] = false;
    if (dasDirection !== dir) return;
    if (dir === "left" && keysHeld.right) {
      dasDirection = "right";
    } else if (dir === "right" && keysHeld.left) {
      dasDirection = "left";
    } else {
      dasDirection = null;
    }
    dasElapsed = 0;
    arrElapsed = 0;
  }

  document.addEventListener("keydown", (e) => {
    if (!running || paused) {
      if (e.key === "p" || e.key === "P") togglePause();
      return;
    }
    switch (e.key) {
      case "ArrowLeft": if (!e.repeat) startDas("left"); e.preventDefault(); break;
      case "ArrowRight": if (!e.repeat) startDas("right"); e.preventDefault(); break;
      case "ArrowDown":
        if (!e.repeat) { softDropHeld = true; softDropElapsed = SOFT_DROP_ARR; handleAction("down"); }
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
      case "ArrowLeft": stopDas("left"); break;
      case "ArrowRight": stopDas("right"); break;
      case "ArrowDown": softDropHeld = false; break;
    }
  });

  window.addEventListener("blur", () => {
    dasDirection = null;
    softDropHeld = false;
    keysHeld.left = false;
    keysHeld.right = false;
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
