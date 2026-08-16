(function () {
  "use strict";

  const WS_URL = "wss://tetris-table.koppepandayo07.workers.dev/";
  const CELL = 30;
  const COLORS = TetrisEngine.COLORS;
  const SHAPES = TetrisEngine.SHAPES;
  const PUYO_COLORS = PuyoEngine.COLORS;
  const holdPanel = document.getElementById("hold-panel");

  const connStatus = document.getElementById("conn-status");
  const lobbyPanel = document.getElementById("lobby-panel");
  const joinBtn = document.getElementById("join-btn");
  const playerCountEl = document.getElementById("player-count");
  const playerListEl = document.getElementById("player-list");
  const autoStartNote = document.getElementById("auto-start-note");
  const lobbyActions = document.getElementById("lobby-actions");
  const readyBtn = document.getElementById("ready-btn");
  const waitBtn = document.getElementById("wait-btn");
  const joinError = document.getElementById("join-error");
  const winsLoading = document.getElementById("wins-loading");
  const winsList = document.getElementById("wins-list");

  const SCORES_API = "https://tetris-scores.koppepandayo07.workers.dev";
  const WAIT_MIN_SECONDS = 3;

  let autoStartActive = false;
  let autoStartSeconds = null;
  let myUsedWait = false;
  let myReady = false;
  let selectedGame = "tetris";

  const gameSelect = document.getElementById("game-select");
  gameSelect.querySelectorAll(".game-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedGame = btn.dataset.game;
      gameSelect.querySelectorAll(".game-select-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

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
  let myGame = "tetris";
  let phase = "lobby";
  let inThisMatch = false;
  let engine = null;
  let lastTime = 0;
  let toastTimer;
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
        myUsedWait = !!msg.you.usedWait;
        myReady = !!(msg.players.find((p) => p.id === myId) || {}).ready;
        renderPlayerList(msg.players);
        queueStatus.textContent = msg.queueCount > 0 ? `参加待ち: ${msg.queueCount}人` : "";
        updatePanels();
        updateWaitBtn();
        updateReadyBtn();
        break;
      case "auto-start":
        autoStartActive = msg.seconds !== null;
        autoStartSeconds = msg.seconds;
        showAutoStartNote(msg.seconds, msg.extendedBy);
        updateWaitBtn();
        break;
      case "countdown":
        phase = "countdown";
        autoStartActive = false;
        autoStartNote.classList.add("hidden");
        updateWaitBtn();
        showCountdown(msg.seconds);
        TetrisAudio.playSFX(msg.seconds > 0 ? "countdown" : "go");
        break;
      case "match-start":
        phase = "playing";
        hideCountdown();
        beginMyMatch(msg.players);
        TetrisAudio.startMusic();
        break;
      case "incoming":
        // Attacks travel over the wire in a shared "garbage cell" currency.
        // Tetris converts cells back to lines (its native garbage unit);
        // Puyo receives cells directly (its garbage is already per-cell).
        if (engine) {
          const received = myGame === "tetris" ? Math.ceil(msg.amount / TetrisEngine.COLS) : msg.amount;
          engine.receiveGarbage(received);
        }
        TetrisAudio.playSFX("incoming");
        break;
      case "opponent-board":
        renderOpponentBoard(msg.id, msg.grid, msg.current);
        break;
      case "eliminated":
        markOpponentDead(msg.id);
        if (msg.id === myId) {
          showYouEliminated(msg.rank);
          TetrisAudio.playSFX("ko");
        }
        break;
      case "match-end":
        showRanking(msg.ranking);
        break;
    }
  }

  function makeAvatarImg(url) {
    const img = document.createElement("img");
    img.className = "player-avatar";
    img.src = url || "assets/koppecat.jpg";
    img.alt = "";
    // Discord avatar URLs are hash-pinned to a specific upload and 404 once
    // the user changes their profile picture, unlike mc-heads.net's
    // always-current-skin URLs -- fall back instead of showing a broken image.
    img.onerror = () => { img.onerror = null; img.src = "assets/koppecat.jpg"; };
    return img;
  }

  // The table server reports this directly (it's whatever the client claimed on join),
  // unlike the solo/wins leaderboards where we infer it from the avatar URL instead.
  function platformTag(platform) {
    return platform === "mc" ? "[MC]" : "[Web]";
  }

  function gameTag(game) {
    return game === "puyo" ? "ぷよぷよ" : "テトリス";
  }

  function renderPlayerList(players) {
    playerCountEl.textContent = players.length;
    playerListEl.innerHTML = "";
    for (const p of players) {
      const li = document.createElement("li");
      li.appendChild(makeAvatarImg(p.avatar));
      const name = document.createElement("span");
      name.textContent = (p.ready ? "✓ " : "") + p.name + ` ${platformTag(p.platform)}` + (p.id === myId ? " (あなた)" : "");
      if (p.ready) name.classList.add("ready-name");
      li.appendChild(name);
      const tag = document.createElement("span");
      tag.className = "game-tag";
      tag.textContent = ` ${gameTag(p.game)}`;
      li.appendChild(tag);
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
      lobbyActions.classList.toggle("hidden", myRole !== "player");
      gameSelect.querySelectorAll(".game-select-btn").forEach((b) => (b.disabled = myRole === "player"));
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

  function showAutoStartNote(seconds, extendedBy) {
    if (seconds === null) {
      autoStartNote.classList.add("hidden");
      return;
    }
    autoStartNote.textContent = extendedBy
      ? `${extendedBy}さんが延長しました。あと${seconds}秒で自動開始します`
      : `2人以上集まったので ${seconds}秒後に自動開始します`;
    autoStartNote.classList.remove("hidden");
  }

  function updateWaitBtn() {
    const show =
      phase === "lobby" &&
      myRole === "player" &&
      autoStartActive &&
      !myUsedWait &&
      (autoStartSeconds === null || autoStartSeconds > WAIT_MIN_SECONDS);
    waitBtn.classList.toggle("hidden", !show);
  }

  function updateReadyBtn() {
    readyBtn.textContent = myReady ? "Ready 済み" : "Ready";
    readyBtn.classList.toggle("btn-ghost", myReady);
    readyBtn.classList.toggle("btn-primary", !myReady);
  }

  function showCountdown(seconds) {
    rankingPanel.classList.add("hidden");
    countdownOverlay.classList.remove("hidden");
    countdownText.textContent = seconds > 0 ? String(seconds) : "GO!";
  }

  function hideCountdown() {
    countdownOverlay.classList.add("hidden");
  }

  function showRanking(ranking) {
    TetrisAudio.stopMusic();
    rankingPanel.classList.remove("hidden");
    rankingList.innerHTML = "";
    for (const r of ranking) {
      const li = document.createElement("li");
      const num = document.createElement("span");
      num.className = "rank-num";
      num.textContent = `#${r.rank}`;
      const name = document.createElement("span");
      name.textContent = `${r.name} ${platformTag(r.platform)}` + (r.id === myId ? " (あなた)" : "");
      const tag = document.createElement("span");
      tag.className = "game-tag";
      tag.textContent = ` ${gameTag(r.game)}`;
      li.appendChild(num);
      li.appendChild(makeAvatarImg(r.avatar));
      li.appendChild(name);
      li.appendChild(tag);
      rankingList.appendChild(li);
    }
    // Stays visible (no auto-hide timer) until the next countdown starts --
    // showCountdown() is what hides it.
    engine = null;
    youEliminated.classList.add("hidden");
    opponentTiles.forEach((t) => t.tile.remove());
    opponentTiles.clear();

    const won = ranking.find((r) => r.id === myId && r.rank === 1);
    if (won) {
      TetrisAudio.playSFX("victory");
      submitWin();
    }
  }

  function submitWin() {
    const account = getAccount();
    if (!account.discord) return;
    fetch(`${SCORES_API}/win`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordId: account.discord.id,
        name: account.discord.username,
        avatar: account.discord.avatar,
      }),
    })
      .then(() => loadWins())
      .catch(() => {});
  }

  function loadWins() {
    winsLoading.classList.remove("hidden");
    winsLoading.textContent = "読み込み中...";
    winsList.innerHTML = "";
    fetch(`${SCORES_API}/wins?limit=20`)
      .then((r) => r.json())
      .then((data) => {
        winsList.innerHTML = "";
        (data.wins || []).forEach((w, i) => {
          const li = document.createElement("li");
          const num = document.createElement("span");
          num.className = "rank-num";
          num.textContent = `#${i + 1}`;
          const info = document.createElement("div");
          info.className = "rank-info";
          const name = document.createElement("div");
          name.className = "rank-name";
          // Unlike the live table above, this list comes from tetris-scores-server's D1 table,
          // which (like the solo leaderboard) has no platform field - infer it from the avatar
          // URL instead: mc-heads.net (Minecraft mod) vs Discord's CDN (this site).
          name.textContent = `${w.name} ${w.avatar && w.avatar.indexOf("mc-heads.net") !== -1 ? "[MC]" : "[Web]"}`;
          const score = document.createElement("div");
          score.className = "rank-score";
          score.textContent = `${w.win_count}勝`;
          info.appendChild(name);
          info.appendChild(score);
          li.appendChild(num);
          li.appendChild(makeAvatarImg(w.avatar));
          li.appendChild(info);
          winsList.appendChild(li);
        });
        if ((data.wins || []).length === 0) {
          winsLoading.textContent = "まだ記録がありません";
        } else {
          winsLoading.classList.add("hidden");
        }
      })
      .catch(() => {
        winsLoading.textContent = "読み込みに失敗しました";
      });
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

  // childOffset mirrors PuyoEngine's own (private) cellsOf() so opponent/own
  // rendering can place a Puyo piece's two cells without needing a live
  // engine instance -- e.g. for opponent boards, which only ever arrive as
  // plain {colors, rot, x, y} data over the wire, not a real PuyoEngine.
  function puyoCellsOf(piece) {
    const offsets = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };
    const [dx, dy] = offsets[piece.rot];
    return [
      { x: piece.x, y: piece.y, color: piece.colors[0] },
      { x: piece.x + dx, y: piece.y + dy, color: piece.colors[1] },
    ];
  }

  function drawPuyoGridToCanvas(ctx, canvas, grid, current) {
    const cellSize = canvas.width / PuyoEngine.COLS;
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x]) drawCell(ctx, x, y, cellSize, PUYO_COLORS[grid[y][x]] || "#888");
      }
    }
    if (current) {
      for (const cell of puyoCellsOf(current)) {
        if (cell.y >= 0) drawCell(ctx, cell.x, cell.y, cellSize, PUYO_COLORS[cell.color] || "#888");
      }
    }
  }

  function drawPuyoNextPreview(queue) {
    nextCtx.fillStyle = "#0b0b10";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const boxH = nextCanvas.height / 2;
    const r = Math.min(nextCanvas.width * 0.6, boxH * 0.35);
    queue.slice(0, 2).forEach((pair, i) => {
      const cx = nextCanvas.width / 2;
      const baseY = i * boxH + boxH / 2;
      for (const [color, cy] of [[pair[1], baseY - r * 0.55], [pair[0], baseY + r * 0.55]]) {
        nextCtx.beginPath();
        nextCtx.arc(cx, cy, r / 2, 0, Math.PI * 2);
        nextCtx.fillStyle = PUYO_COLORS[color] || "#888";
        nextCtx.fill();
      }
    });
  }

  function renderOwn() {
    if (myGame === "puyo") renderOwnPuyo();
    else renderOwnTetris();
  }

  function renderOwnPuyo() {
    const cellSize = boardCanvas.width / PuyoEngine.COLS;
    boardCtx.fillStyle = "#0b0b10";
    boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    for (let y = 0; y < PuyoEngine.ROWS; y++) {
      for (let x = 0; x < PuyoEngine.COLS; x++) {
        if (engine.grid[y][x]) drawCell(boardCtx, x, y, cellSize, PUYO_COLORS[engine.grid[y][x]] || "#888");
      }
    }
    if (engine.current) {
      for (const cell of puyoCellsOf(engine.current)) {
        if (cell.y >= 0) drawCell(boardCtx, cell.x, cell.y, cellSize, PUYO_COLORS[cell.color] || "#888");
      }
    }
    drawPuyoNextPreview(engine.nextQueue);
    scoreEl.textContent = engine.score;
  }

  function renderOwnTetris() {
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
    if (entry.game === "puyo") drawPuyoGridToCanvas(entry.ctx, entry.canvas, grid, current);
    else drawGridToCanvas(entry.ctx, entry.canvas, grid, current, 6);
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
      entry.game = p.game === "puyo" ? "puyo" : "tetris";
      entry.tile.classList.remove("dead");
    }

    youEliminated.classList.add("hidden");

    localStorage.setItem("__debug_beginMyMatch", JSON.stringify({ myId, players }));
    myGame = ((players.find((p) => p.id === myId) || {}).game === "puyo") ? "puyo" : "tetris";
    localStorage.setItem("__debug_myGame", myGame);
    holdPanel.classList.toggle("hidden", myGame === "puyo");

    engine = myGame === "puyo" ? createPuyoEngine() : createTetrisEngine();
    engine.start();
    renderOwn();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function createTetrisEngine() {
    return new TetrisEngine({
      onLock(self, info) {
        if (info.label) showToast(info.label);
        if (info.tspin) TetrisAudio.playSFX("tspin");
        else if (info.cleared === 4) TetrisAudio.playSFX("tetris");
        else if (info.cleared === 3) TetrisAudio.playSFX("line3");
        else if (info.cleared === 2) TetrisAudio.playSFX("line2");
        else if (info.cleared === 1) TetrisAudio.playSFX("line1");
        else TetrisAudio.playSFX("lock");
        if (info.attack > 0) {
          // Convert lines -> shared "garbage cell" currency (board width
          // cells per line) so the amount is comparable to Puyo's attack.
          send({ type: "attack", amount: info.attack * TetrisEngine.COLS });
          TetrisAudio.playSFX("attack");
        }
        sendBoard();
      },
      onGameOver() {
        send({ type: "ko" });
      },
    });
  }

  function createPuyoEngine() {
    return new PuyoEngine({
      onLock(self, info) {
        if (info.chainCount > 0) {
          showToast(info.allClear ? "全消し！" : info.chainCount > 1 ? `${info.chainCount}連鎖！` : `${info.erasedCount}個消し`);
          TetrisAudio.playSFX(info.chainCount >= 4 ? "tetris" : info.chainCount >= 2 ? "line3" : "line1");
        } else {
          TetrisAudio.playSFX("lock");
        }
        if (info.attack > 0) {
          // Already in shared "garbage cell" currency -- no conversion needed.
          send({ type: "attack", amount: info.attack });
          TetrisAudio.playSFX("attack");
        }
        sendBoard();
      },
      onGameOver() {
        send({ type: "ko" });
      },
    });
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

  // requestAnimationFrame stops firing while the window is minimized/hidden,
  // which freezes the local engine (pieces stop falling, incoming garbage
  // just queues up unapplied) -- effectively making you unkillable if you
  // just minimize mid-match. Auto-forfeit after a short grace period instead
  // of letting that stand as a way to dodge a loss. setTimeout still fires
  // in a hidden/minimized tab, so this works even though the render loop
  // doesn't.
  const HIDDEN_FORFEIT_MS = 5000;
  let hiddenForfeitTimer = null;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (engine && engine.running && inThisMatch && !hiddenForfeitTimer) {
        hiddenForfeitTimer = setTimeout(() => {
          hiddenForfeitTimer = null;
          if (document.hidden && engine && engine.running) {
            send({ type: "ko" });
          }
        }, HIDDEN_FORFEIT_MS);
      }
    } else if (hiddenForfeitTimer) {
      clearTimeout(hiddenForfeitTimer);
      hiddenForfeitTimer = null;
    }
  });

  // ---- UI wiring ----

  function getAccount() {
    try {
      return JSON.parse(localStorage.getItem("koppepandayo-tetris-account")) || {};
    } catch (e) {
      return {};
    }
  }

  joinBtn.addEventListener("click", () => {
    TetrisAudio.resume();
    TetrisAudio.playSFX("join");
    joinError.classList.add("hidden");
    const account = getAccount();
    const name = (account.discord && account.discord.username) || account.username || "Guest";
    const avatar = account.discord ? account.discord.avatar : null;
    send({ type: "join", name, avatar, deviceId, platform: "web", game: selectedGame });
  });

  queueBtn.addEventListener("click", () => {
    const account = getAccount();
    const name = (account.discord && account.discord.username) || account.username || "Guest";
    const avatar = account.discord ? account.discord.avatar : null;
    send({ type: "queue", name, avatar, deviceId, platform: "web", game: selectedGame });
  });

  waitBtn.addEventListener("click", () => {
    myUsedWait = true;
    updateWaitBtn();
    send({ type: "wait" });
  });

  readyBtn.addEventListener("click", () => {
    send({ type: "ready" });
  });

  loadWins();
  connect();
})();
