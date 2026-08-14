// Shared Puyo Puyo-style engine: grid, falling color pairs, gravity,
// connected-group erase, chain scoring, and DAS/ARR-driven input. Mirrors
// the architecture of tetris-engine.js so the two games feel consistent and
// can eventually share a mixed-genre battle mode. Independent implementation
// of the general connect-4-and-chain puyo gameplay idea -- no SEGA code or
// assets involved.
(function (global) {
  "use strict";

  const COLS = 6;
  const ROWS = 12;
  const DAS = 130; // ms held before auto-repeat starts
  const ARR = 20; // ms between auto-repeat steps
  const SOFT_DROP_ARR = 20; // ms between soft-drop steps while held
  const LOCK_DELAY = 300;
  const MIN_GROUP_SIZE = 4;
  const FALL_ANIMATION_MS = 140;
  const ERASE_ANIMATION_MS = 480;

  const COLOR_NAMES = ["R", "G", "B", "Y"];
  const COLORS = {
    R: "#e0555f",
    G: "#4fd67a",
    B: "#4a9fe0",
    Y: "#f0d048",
  };

  const CHAIN_BONUS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
  const PIECE_BONUS = [0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10, 10];
  const COLOR_BONUS = [0, 0, 3, 6, 12, 24];

  function pieceBonus(size) {
    return PIECE_BONUS[Math.min(size, PIECE_BONUS.length - 1)];
  }

  function chainBonus(chainCount) {
    if (chainCount < CHAIN_BONUS.length) return CHAIN_BONUS[chainCount];
    return CHAIN_BONUS[CHAIN_BONUS.length - 1];
  }

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function childOffset(rot) {
    switch (rot) {
      case 0: return [0, -1]; // child above axis
      case 1: return [1, 0]; // child right of axis
      case 2: return [0, 1]; // child below axis
      default: return [-1, 0]; // child left of axis
    }
  }

  function refillColorBag(rng) {
    // 4 copies of each color per bag, shuffled -- keeps color distribution
    // fair over time (like the Tetris 7-bag) without being fully uniform-random.
    const bag = [];
    for (const c of COLOR_NAMES) for (let i = 0; i < 4; i++) bag.push(c);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  class PuyoEngine {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onLock = opts.onLock || function () {}; // (self, info) => {}
      this.onGameOver = opts.onGameOver || function () {};
      this.onChange = opts.onChange || function () {};
      this.reset();
    }

    reset() {
      this.grid = makeGrid();
      this.colorBag = refillColorBag(this.rng);
      this.nextQueue = [this._nextPairColors(), this._nextPairColors()];
      this.score = 0;
      this.chainCount = 0;
      this.maxChain = 0;
      this.dropInterval = 800;
      this.dropAccumulator = 0;
      this.elapsed = 0;
      this.lockTimer = null;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.keysHeld = { left: false, right: false };
      this.dasDirection = null;
      this.dasElapsed = 0;
      this.arrElapsed = 0;
      this.softDropHeld = false;
      this.softDropElapsed = 0;
      this.current = null;
      this.resolving = false;
      this.resolvePhase = null;
      this.resolveElapsed = 0;
      this.erasingCells = null;
      this._resolveGained = 0;
      this._resolveErased = 0;
      this._spawnNext();
    }

    start() {
      this.reset();
      this.running = true;
    }

    _nextColor() {
      if (this.colorBag.length === 0) this.colorBag = refillColorBag(this.rng);
      return this.colorBag.pop();
    }

    _nextPairColors() {
      return [this._nextColor(), this._nextColor()];
    }

    cellsOf(piece) {
      piece = piece || this.current;
      const [dx, dy] = childOffset(piece.rot);
      return [
        { x: piece.x, y: piece.y, color: piece.colors[0] },
        { x: piece.x + dx, y: piece.y + dy, color: piece.colors[1] },
      ];
    }

    _collides(piece) {
      for (const cell of this.cellsOf(piece)) {
        if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return true;
        if (cell.y >= 0 && this.grid[cell.y][cell.x]) return true;
      }
      return false;
    }

    _spawnPiece(colors) {
      return { colors, rot: 0, x: Math.floor(COLS / 2) - 1, y: -1 };
    }

    _spawnNext() {
      // The tutorial's spawn/game-over rule checks the third column's top
      // cell before creating the next pair. The pair itself starts just above
      // the visible board and falls in naturally.
      if (this.grid[0][2]) {
        this.current = null;
        this._endGame();
        this.onChange(this);
        return;
      }
      this.current = this._spawnPiece(this.nextQueue.shift());
      this.nextQueue.push(this._nextPairColors());
      this.lockTimer = null;
      this.dropAccumulator = 0;
      if (this._collides(this.current)) this._endGame();
      this.onChange(this);
    }

    tryMove(dx, dy) {
      if (!this.current || this.resolving) return false;
      const moved = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
      if (this._collides(moved)) return false;
      this.current = moved;
      return true;
    }

    tryRotate(dir) {
      if (!this.current || this.resolving) return false;
      const rot = (this.current.rot + dir + 4) % 4;
      const base = { ...this.current, rot };
      const kicks = [[0, 0], [1, 0], [-1, 0], [0, -1]];
      for (const [kx, ky] of kicks) {
        const candidate = { ...base, x: base.x + kx, y: base.y + ky };
        if (!this._collides(candidate)) {
          this.current = candidate;
          this._resetLockIfGrounded();
          return true;
        }
      }
      return false;
    }

    _resetLockIfGrounded() {
      const grounded = this._collides({ ...this.current, y: this.current.y + 1 });
      if (grounded && this.lockTimer !== null) this.lockTimer = 0;
    }

    hardDrop() {
      if (!this.current || this.resolving) return;
      let dist = 0;
      while (!this._collides({ ...this.current, y: this.current.y + 1 })) {
        this.current = { ...this.current, y: this.current.y + 1 };
        dist++;
      }
      this.score += dist;
      this._lockPiece();
    }

    _lockPiece() {
      for (const cell of this.cellsOf(this.current)) {
        // Like the tutorial, cells still above the visible field are not
        // written. The next-spawn check then decides game over.
        if (cell.y >= 0) this.grid[cell.y][cell.x] = cell.color;
      }
      this.current = null;
      this._beginResolve();
    }

    _applyGravity() {
      for (let x = 0; x < COLS; x++) {
        const col = [];
        for (let y = 0; y < ROWS; y++) if (this.grid[y][x]) col.push(this.grid[y][x]);
        for (let y = ROWS - 1, i = col.length - 1; y >= 0; y--, i--) {
          this.grid[y][x] = i >= 0 ? col[i] : null;
        }
      }
    }

    _findErasableGroups() {
      const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      const groups = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (seen[y][x] || !this.grid[y][x]) continue;
          const color = this.grid[y][x];
          const stack = [[x, y]];
          const cells = [];
          seen[y][x] = true;
          while (stack.length) {
            const [cx, cy] = stack.pop();
            cells.push([cx, cy]);
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
              if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
              if (seen[ny][nx] || this.grid[ny][nx] !== color) continue;
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
          if (cells.length >= MIN_GROUP_SIZE) groups.push({ color, cells });
        }
      }
      return groups;
    }

    _beginResolve() {
      this.resolving = true;
      this.resolvePhase = "fall";
      this.resolveElapsed = 0;
      this.erasingCells = null;
      this.chainCount = 0;
      this._resolveGained = 0;
      this._resolveErased = 0;
      this._applyGravity();
      this.onChange(this);
    }

    _updateResolve(dt) {
      this.resolveElapsed += dt;

      if (this.resolvePhase === "fall" && this.resolveElapsed >= FALL_ANIMATION_MS) {
        const groups = this._findErasableGroups();
        if (groups.length === 0) {
          this._finishResolve();
          return;
        }

        this.chainCount++;
        this.maxChain = Math.max(this.maxChain, this.chainCount);
        const colors = new Set(groups.map((g) => g.color));
        const erasedThisStep = groups.reduce((sum, g) => sum + g.cells.length, 0);
        const scale = Math.max(1,
          chainBonus(this.chainCount) +
          pieceBonus(erasedThisStep) +
          COLOR_BONUS[Math.min(colors.size, COLOR_BONUS.length - 1)]
        );
        const gained = erasedThisStep * 10 * scale;
        this.score += gained;
        this._resolveGained += gained;
        this._resolveErased += erasedThisStep;
        this._eraseGroups = groups;
        this.erasingCells = new Set(groups.flatMap((g) => g.cells.map(([x, y]) => `${x},${y}`)));
        this.resolvePhase = "erase";
        this.resolveElapsed = 0;
        return;
      }

      if (this.resolvePhase === "erase" && this.resolveElapsed >= ERASE_ANIMATION_MS) {
        for (const group of this._eraseGroups) {
          for (const [x, y] of group.cells) this.grid[y][x] = null;
        }
        this._eraseGroups = null;
        this.erasingCells = null;
        this._applyGravity();
        this.resolvePhase = "fall";
        this.resolveElapsed = 0;
      }
    }

    _finishResolve() {
      const allClear = this._resolveErased > 0 && this.grid.every((row) => row.every((cell) => !cell));
      if (allClear) {
        this.score += 3600;
        this._resolveGained += 3600;
      }
      const result = {
        chainCount: this.chainCount,
        gained: this._resolveGained,
        erasedCount: this._resolveErased,
        allClear,
      };
      this.resolving = false;
      this.resolvePhase = null;
      this.resolveElapsed = 0;
      this.erasingCells = null;
      this.onLock(this, result);
      this._spawnNext();
    }

    _endGame() {
      this.running = false;
      this.gameOver = true;
      this.dasDirection = null;
      this.softDropHeld = false;
      this.onGameOver(this);
    }

    togglePause() {
      if (!this.running) return false;
      this.paused = !this.paused;
      return this.paused;
    }

    handleAction(action) {
      if (!this.running || this.paused || this.resolving || !this.current) return;
      switch (action) {
        case "left": this.tryMove(-1, 0); this._resetLockIfGrounded(); break;
        case "right": this.tryMove(1, 0); this._resetLockIfGrounded(); break;
        case "down": if (this.tryMove(0, 1)) this.score += 1; break;
        case "rotate": this.tryRotate(1); break;
        case "rotate-ccw": this.tryRotate(-1); break;
        case "drop": this.hardDrop(); break;
      }
      this.onChange(this);
    }

    startDas(dir) {
      this.keysHeld[dir] = true;
      this.dasDirection = dir;
      this.dasElapsed = 0;
      this.arrElapsed = 0;
      this.handleAction(dir);
    }

    stopDas(dir) {
      this.keysHeld[dir] = false;
      if (this.dasDirection !== dir) return;
      if (dir === "left" && this.keysHeld.right) this.dasDirection = "right";
      else if (dir === "right" && this.keysHeld.left) this.dasDirection = "left";
      else this.dasDirection = null;
      this.dasElapsed = 0;
      this.arrElapsed = 0;
    }

    update(dt) {
      if (!this.running || this.paused) return;

      this.elapsed += dt;
      // Gentle difficulty ramp over time instead of a line-clear-based level.
      this.dropInterval = Math.max(200, 800 - Math.floor(this.elapsed / 20000) * 60);

      if (this.resolving) {
        this._updateResolve(dt);
        this.onChange(this);
        return;
      }

      if (!this.current) return;

      if (this.dasDirection) {
        this.dasElapsed += dt;
        if (this.dasElapsed >= DAS) {
          this.arrElapsed += dt;
          while (this.arrElapsed >= ARR) {
            this.arrElapsed -= ARR;
            const moved = this.tryMove(this.dasDirection === "left" ? -1 : 1, 0);
            this._resetLockIfGrounded();
            if (!moved) break;
          }
        }
      }

      if (this.softDropHeld) {
        this.softDropElapsed += dt;
        while (this.softDropElapsed >= SOFT_DROP_ARR) {
          this.softDropElapsed -= SOFT_DROP_ARR;
          if (this.tryMove(0, 1)) this.score += 1;
        }
      }

      const grounded = this._collides({ ...this.current, y: this.current.y + 1 });
      if (grounded) {
        if (this.lockTimer === null) this.lockTimer = 0;
        this.lockTimer += dt;
        if (this.lockTimer >= LOCK_DELAY) this._lockPiece();
      } else {
        this.dropAccumulator += dt;
        if (this.dropAccumulator >= this.dropInterval) {
          this.dropAccumulator = 0;
          this.tryMove(0, 1);
        }
        this.lockTimer = null;
      }

      this.onChange(this);
    }
  }

  global.PuyoEngine = PuyoEngine;
  global.PuyoEngine.COLORS = COLORS;
  global.PuyoEngine.COLOR_NAMES = COLOR_NAMES;
  global.PuyoEngine.COLS = COLS;
  global.PuyoEngine.ROWS = ROWS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PuyoEngine;
    module.exports.COLORS = COLORS;
    module.exports.COLOR_NAMES = COLOR_NAMES;
    module.exports.COLS = COLS;
    module.exports.ROWS = ROWS;
  }
})(typeof window !== "undefined" ? window : globalThis);
