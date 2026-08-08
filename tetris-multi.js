(function () {
  "use strict";

  const WS_URL = "wss://tetris-table.koppepandayo07.workers.dev/";
  const CELL = 30;
  const COLORS = TetrisEngine.COLORS;
  const SHAPES = TetrisEngine.SHAPES;

  const connStatus = document.getElementById("conn-status");
  const lobbyPanel = document.getElementById("lobby-panel");
  const joinBtn = document.getElementById("join-btn");
  const playerCountEl = document.getElementById("player-count");
  const playerListEl = document.getElementById("player-list");
  const autoStartNote = document.getElementById("auto-start-note");
  const joinError = document.getElementById("join-error");

  const DEVICE_ID_KEY = "koppepandayo-tetris-device-id";
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  const spectatePanel = document.getElementById("spectate-panel");
  const queueBtn = document.getElementById("queue-btn");
  const queueStatus = document.getElementById("queue-status");

  const countdownOverlay = document.getElementById("countdown-overlay");
  const countdownText = document.getElementById("countdown-text");

  const rankingPanel = document.getElementById("ranking-panel");
  const rankingList = document.getElementById("ranking-list");

  const battleLayout = document.getElementById("battle-layout");
  const boardCanvas = document.getElementById("board-canvas");
  const boardCtx = boardCanvas.getContext("2d");
  const nextCanvas = document.getElementById("next-canvas");
  const nextCtx = nextCanvas.getContext("2d");
  const holdCanvas = document.getElementById("hold-canvas");
  const holdCtx = holdCanvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const youEliminated = document.getElementById("you-eliminated");
  const youRankEl = document.getElementById("you-rank");
  const toastEl = document.getElementById("clear-toast");
  const opponentsGrid = document.getElementById("opponents-grid");

  let ws = null;
  let myId = null;
  let myRole = "spectator";
  let phase = "lobby";
  let inThisMatch = false;
  let engine = null;
  let lastTime = 0;
  let toastTimer;
  let rankingTimer;
  const opponentTiles = new Map(); // id -> { tile, canvas, ctx, nameEl }
  let boardSendAccum = 0;

  function connect() {
    connStatus.textContent = "接続中...";
    ws = new WebSocket(WS_URL);
    ws.addEventListener("open", () => {
      connStatus.textContent = "接続済み";
    });
    ws.addEventListener("close", () => {
      connStatus.textContent = "切断されました。再接続します...";
      setTimeout(connect, 2000);
    });
    ws.addEventListener("message", (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        return;
      }
      handleMessage(msg);
    });
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case "welcome":
        myId = msg.id;
        break;
      case "join-rejected":
        joinError.textContent = "このブラウザからは既に参加しています（別タブでの多重参加はできません）";
        joinError.classList.remove("hidden");
        break;
      case "state":
        phase = msg.phase;
        myRole = msg.you.role;
        renderPlayerList(msg.players);
        queueStatus.textContent = msg.queueCount > 0 ? `参加待ち: ${msg.queueCount}人` : "";
        updatePanels();
        break;
      case "auto-start":
        showAutoStartNote(msg.seconds);
        break;
      case "countdown":
        phase = "countdown";
        autoStartNote.classList.add("hidden");
        showCountdown(msg.seconds);
        break;
      case "match-start":
        phase = "playing";
        hideCountdown();
        beginMyMatch(msg.players);
        break;
      case "incoming":
        if (engine) engine.receiveGarbage(msg.amount);
        break;
      case "opponent-board":
        renderOpponentBoard(msg.id, msg.grid, msg.current);
        break;
      case "eliminated":
        markOpponentDead(msg.id);
        if (msg.id === myId) showYouEliminated(msg.rank);
        break;
      case "match-end":
        showRanking(msg.ranking);
        break;
    }
  }

  function renderPlayerList(players) {
    playerCountEl.textContent = players.length;
    playerListEl.innerHTML = "";
    for (const p of players) {
      const li = document.createElement("li");
      li.textContent = p.name + (p.id === myId ? " (あなた)" : "");
      playerListEl.appendChild(li);
    }
  }

  function updatePanels() {
    lobbyPanel.classList.add("hidden");
    spectatePanel.classList.add("hidden");
    battleLayout.classList.add("hidden");
    // rankingPanel is intentionally left alone here: showRanking() manages
    // its own visibility with a timeout, independent of phase transitions
    // (the server moves phase back to "lobby" right after match-end, and
    // that state broadcast used to blow the ranking panel away instantly).

    if (phase === "lobby") {
      inThisMatch = false;
      lobbyPanel.classList.remove("hidden");
      joinBtn.disabled = myRole === "player";
      joinBtn.textContent = myRole === "player" ? "参加済み" : "参加";
    } else if (phase === "countdown") {
      if (inThisMatch) battleLayout.classList.remove("hidden");
      else lobbyPanel.classList.remove("hidden");
    } else if (phase === "playing") {
      if (inThisMatch) {
        battleLayout.classList.remove("hidden");
      } else {
        spectatePanel.classList.remove("hidden");
        queueBtn.disabled = myRole === "queued";
        queueBtn.textContent = myRole === "queued" ? "参加予約済み" : "次の試合に参加 (inQueue)";
      }
    }
  }

  function showAutoStartNote(seconds) {
    if (seconds === null) {
      autoStartNote.classList.add("hidden");
      return;
    }
    autoStartNote.textContent = `2人以上集まったので ${seconds}秒後に自動開始します`;
    autoStartNote.classList.remove("hidden");
  }

  function showCountdown(seconds) {
    clearTimeout(rankingTimer);
    rankingPanel.classList.add("hidden");
    countdownOverlay.classList.remove("hidden");
    countdownText.textContent = seconds > 0 ? String(seconds) : "GO!";
  }

  function hideCountdown() {
    countdownOverlay.classList.add("hidden");
  }

  function showRanking(ranking) {
    rankingPanel.classList.remove("hidden");
    rankingList.innerHTML = "";
    for (const r of ranking) {
      const li = document.createElement("li");
      const num = document.createElement("span");
      num.className = "rank-num";
      num.textContent = `#${r.rank}`;
      const name = document.createElement("span");
      name.textContent = r.name + (r.id === myId ? " (あなた)" : "");
      li.appendChild(num);
      li.appendChild(name);
      rankingList.appendChild(li);
    }
    clearTimeout(rankingTimer);
    rankingTimer = setTimeout(() => rankingPanel.classList.add("hidden"), 6000);
    engine = null;
    youEliminated.classList.add("hidden");
    opponentTiles.forEach((t) => t.tile.remove());
    opponentTiles.clear();
  }

  // ---- own board rendering ----

  function drawCell(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, Math.max(1, size * 0.1));
  }

  function drawGridToCanvas(ctx, canvas, grid, current, cellSize) {
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x]) drawCell(ctx, x, y, cellSize, COLORS[grid[y][x]] || "#888");
      }
    }
    if (current) {
      for (const [dx, dy] of SHAPES[current.name][current.rot]) {
        const x = current.x + dx, y = current.y + dy;
        if (y >= 0) drawCell(ctx, x, y, cellSize, COLORS[current.name]);
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

  function renderOwn() {
    boardCtx.fillStyle = "#0b0b10";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    for (let y = 0; y < TetrisEngine.ROWS; y++) {
      for (let x = 0; x < TetrisEngine.COLS; x++) {
        if (engine.grid[y][x]) drawCell(boardCtx, x, y, CELL, COLORS[engine.grid[y][x]] || "#888");
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

    nextCtx.fillStyle = "#0b0b10";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const slotH = nextCanvas.height / 5;
    engine.nextQueue.slice(0, 5).forEach((name, i) => {
      drawPieceInBox(nextCtx, name, 0, i * slotH, nextCanvas.width, slotH);
    });

    holdCtx.fillStyle = "#0b0b10";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    drawPieceInBox(holdCtx, engine.holdPiece, 0, 0, holdCanvas.width, holdCanvas.height);

    scoreEl.textContent = engine.score;
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1200);
  }

  function showYouEliminated(rank) {
    youRankEl.textContent = `${rank}位`;
    youEliminated.classList.remove("hidden");
  }

  // ---- opponents ----

  function getOpponentTile(id) {
    let entry = opponentTiles.get(id);
    if (!entry) {
      const tile = document.createElement("div");
      tile.className = "opponent-tile";
      const canvas = document.createElement("canvas");
      canvas.width = 60;
      canvas.height = 120;
      const nameEl = document.createElement("div");
      nameEl.className = "opponent-name";
      tile.appendChild(canvas);
      tile.appendChild(nameEl);
      opponentsGrid.appendChild(tile);
      entry = { tile, canvas, ctx: canvas.getContext("2d"), nameEl };
      opponentTiles.set(id, entry);
    }
    return entry;
  }

  function renderOpponentBoard(id, grid, current) {
    if (id === myId) return;
    const entry = getOpponentTile(id);
    drawGridToCanvas(entry.ctx, entry.canvas, grid, current, 6);
  }

  function markOpponentDead(id) {
    const entry = opponentTiles.get(id);
    if (entry) entry.tile.classList.add("dead");
  }

  // ---- match lifecycle ----

  function beginMyMatch(players) {
    inThisMatch = players.some((p) => p.id === myId);
    updatePanels();
    if (!inThisMatch) return;

    opponentTiles.forEach((t) => t.tile.remove());
    opponentTiles.clear();
    for (const p of players) {
      if (p.id === myId) continue;
      const entry = getOpponentTile(p.id);
      entry.nameEl.textContent = p.name;
      entry.tile.classList.remove("dead");
    }

    youEliminated.classList.add("hidden");

    engine = new TetrisEngine({
      onLock(self, info) {
        if (info.label) showToast(info.label);
        if (info.attack > 0) send({ type: "attack", amount: info.attack });
        sendBoard();
      },
      onGameOver() {
        send({ type: "ko" });
      },
    });
    engine.start();
    renderOwn();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function sendBoard() {
    if (!engine) return;
    send({ type: "board", grid: engine.grid, current: engine.current });
  }

  function loop(time) {
    if (!engine) return;
    const dt = time - lastTime;
    lastTime = time;
    if (engine.running) {
      engine.update(dt);
      boardSendAccum += dt;
      if (boardSendAccum >= 150) {
        boardSendAccum = 0;
        sendBoard();
      }
    }
    renderOwn();
    requestAnimationFrame(loop);
  }

  function handleAction(action) {
    if (!engine) return;
    engine.handleAction(action);
    renderOwn();
  }

  document.addEventListener("keydown", (e) => {
    if (!engine || !engine.running || engine.paused) return;
    switch (e.key) {
      case "ArrowLeft": if (!e.repeat) { engine.startDas("left"); renderOwn(); } e.preventDefault(); break;
      case "ArrowRight": if (!e.repeat) { engine.startDas("right"); renderOwn(); } e.preventDefault(); break;
      case "ArrowDown":
        if (!e.repeat) { engine.softDropHeld = true; engine.softDropElapsed = 20; handleAction("down"); }
        e.preventDefault();
        break;
      case "ArrowUp": case "x": case "X": if (!e.repeat) handleAction("rotate"); e.preventDefault(); break;
      case "z": case "Z": if (!e.repeat) handleAction("rotate-ccw"); e.preventDefault(); break;
      case " ": if (!e.repeat) handleAction("drop"); e.preventDefault(); break;
      case "c": case "C": if (!e.repeat) handleAction("hold"); e.preventDefault(); break;
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!engine) return;
    switch (e.key) {
      case "ArrowLeft": engine.stopDas("left"); break;
      case "ArrowRight": engine.stopDas("right"); break;
      case "ArrowDown": engine.softDropHeld = false; break;
    }
  });

  // ---- UI wiring ----

  function getAccountName() {
    try {
      const account = JSON.parse(localStorage.getItem("koppepandayo-tetris-account"));
      if (account) return (account.discord && account.discord.username) || account.username || "";
    } catch (e) {
      // ignore malformed/missing account data
    }
    return "";
  }

  joinBtn.addEventListener("click", () => {
    joinError.classList.add("hidden");
    send({ type: "join", name: getAccountName() || "Guest", deviceId });
  });

  queueBtn.addEventListener("click", () => {
    send({ type: "queue" });
  });

  connect();
})();
