// Shared Tetris engine: grid, pieces, SRS rotation, T-spin detection, scoring,
// combo/back-to-back, and DAS/ARR-driven input. Used by both the solo page
// (tetris.js) and the multiplayer client (tetris-multi.js) so the rules only
// live in one place.
(function (global) {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const DAS = 130; // ms held before auto-repeat starts
  const ARR = 20; // ms between auto-repeat steps
  const SOFT_DROP_ARR = 20; // ms between soft-drop steps while held
  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;

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
  // Applied to the grid (dy positive = down) by negating dy on use.
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

  const CLEAR_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE"];

  // Garbage (attack) lines sent per clear. Matches common Tetris 99 / Guideline tables.
  const ATTACK_TABLE = {
    "none:1": 0, "none:2": 1, "none:3": 2, "none:4": 4,
    "mini:0": 0, "mini:1": 1,
    "full:0": 1, "full:1": 2, "full:2": 4, "full:3": 6,
  };

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag(rng) {
    const b = PIECE_NAMES.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  class TetrisEngine {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.onLock = opts.onLock || function () {}; // (info) => {}
      this.onGameOver = opts.onGameOver || function () {};
      this.onChange = opts.onChange || function () {}; // called after any state mutation
      this.reset();
    }

    reset() {
      this.grid = makeGrid();
      this.bag = refillBag(this.rng);
      this.nextQueue = [this._nextFromBag(), this._nextFromBag(), this._nextFromBag(), this._nextFromBag(), this._nextFromBag()];
      this.holdPiece = null;
      this.canHold = true;
      this.score = 0;
      this.level = 1;
      this.lines = 0;
      this.dropInterval = 1000;
      this.dropAccumulator = 0;
      this.lockTimer = null;
      this.lockResets = 0;
      this.running = false;
      this.paused = false;
      this.gameOver = false;
      this.combo = -1;
      this.backToBack = false;
      this.lastActionWasRotate = false;
      this.lastKickIndex = -1;
      this.garbageQueue = []; // pending incoming garbage line counts
      this.keysHeld = { left: false, right: false };
      this.dasDirection = null;
      this.dasElapsed = 0;
      this.arrElapsed = 0;
      this.softDropHeld = false;
      this.softDropElapsed = 0;
      this.current = null;
      this._spawnNext();
    }

    start() {
      this.reset();
      this.running = true;
    }

    cells(piece) {
      piece = piece || this.current;
      return SHAPES[piece.name][piece.rot].map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
    }

    ghostPiece() {
      const ghost = { ...this.current };
      while (!this._collides({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      return ghost;
    }

    _collides(piece) {
      for (const [x, y] of this.cells(piece)) {
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && this.grid[y][x]) return true;
      }
      return false;
    }

    _nextFromBag() {
      if (this.bag.length === 0) this.bag = refillBag(this.rng);
      return this.bag.pop();
    }

    _spawnPiece(name) {
      return { name, rot: 0, x: 3, y: -1 };
    }

    _spawnNext() {
      this.current = this._spawnPiece(this.nextQueue.shift());
      this.nextQueue.push(this._nextFromBag());
      this.lastActionWasRotate = false;
      this.lastKickIndex = -1;
      if (this._collides(this.current)) this._endGame();
      this.onChange(this);
    }

    tryMove(dx, dy) {
      const moved = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
      if (this._collides(moved)) return false;
      this.current = moved;
      this.lastActionWasRotate = false;
      return true;
    }

    tryRotate(dir) {
      const rot = (this.current.rot + dir + 4) % 4;
      if (this.current.name === "O") {
        this.current = { ...this.current, rot };
        this.lastActionWasRotate = true;
        this.lastKickIndex = 0;
        return true;
      }
      const table = this.current.name === "I" ? KICKS_I : KICKS_JLSTZ;
      const kicks = table[`${this.current.rot}-${rot}`] || [[0, 0]];
      for (let i = 0; i < kicks.length; i++) {
        const [kx, ky] = kicks[i];
        const rotated = { ...this.current, rot, x: this.current.x + kx, y: this.current.y - ky };
        if (!this._collides(rotated)) {
          this.current = rotated;
          this.lastActionWasRotate = true;
          this.lastKickIndex = i;
          this._resetLockIfGrounded();
          return true;
        }
      }
      return false;
    }

    _resetLockIfGrounded() {
      const grounded = this._collides({ ...this.current, y: this.current.y + 1 });
      if (grounded && this.lockTimer !== null && this.lockResets < MAX_LOCK_RESETS) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }

    _isBlocked(x, y) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return !!this.grid[y][x];
    }

    _detectTSpin() {
      const c = this.current;
      if (c.name !== "T" || !this.lastActionWasRotate) return null;
      const topLeft = this._isBlocked(c.x, c.y);
      const topRight = this._isBlocked(c.x + 2, c.y);
      const bottomLeft = this._isBlocked(c.x, c.y + 2);
      const bottomRight = this._isBlocked(c.x + 2, c.y + 2);
      const total = [topLeft, topRight, bottomLeft, bottomRight].filter(Boolean).length;
      if (total < 3) return null;
      let frontCount;
      switch (c.rot) {
        case 0: frontCount = [topLeft, topRight].filter(Boolean).length; break;
        case 1: frontCount = [topRight, bottomRight].filter(Boolean).length; break;
        case 2: frontCount = [bottomLeft, bottomRight].filter(Boolean).length; break;
        default: frontCount = [topLeft, bottomLeft].filter(Boolean).length; break;
      }
      if (frontCount === 2) return "full";
      if (this.lastKickIndex === 4) return "full";
      return "mini";
    }

    hardDrop() {
      let dist = 0;
      while (!this._collides({ ...this.current, y: this.current.y + 1 })) {
        this.current = { ...this.current, y: this.current.y + 1 };
        dist++;
      }
      this.score += dist * 2;
      this._lockPiece();
    }

    _lockPiece() {
      const tspin = this._detectTSpin();
      for (const [x, y] of this.cells(this.current)) {
        if (y < 0) {
          this._endGame();
          return;
        }
        this.grid[y][x] = this.current.name;
      }
      const result = this._clearLines(tspin);
      this._applyPendingGarbage(result.cleared);
      this.canHold = true;
      this.lockTimer = null;
      this.lockResets = 0;
      this.onLock(this, result);
      this._spawnNext();
    }

    _clearLines(tspin) {
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.grid[y].every((c) => c)) {
          this.grid.splice(y, 1);
          this.grid.unshift(Array(COLS).fill(null));
          cleared++;
          y++;
        }
      }

      let gained = 0;
      let label = null;
      let attack = 0;

      if (tspin) {
        const table = { "full:0": 400, "full:1": 800, "full:2": 1200, "full:3": 1600, "mini:0": 100, "mini:1": 200 };
        gained = (table[`${tspin}:${cleared}`] || 0) * this.level;
        label = (tspin === "mini" ? "T-SPIN MINI" : "T-SPIN") + (cleared ? " " + CLEAR_NAMES[cleared] : "");
        attack = ATTACK_TABLE[`${tspin}:${cleared}`] || 0;
      } else if (cleared > 0) {
        const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
        gained = (table[cleared] || 0) * this.level;
        label = cleared === 4 ? "TETRIS" : CLEAR_NAMES[cleared];
        attack = ATTACK_TABLE[`none:${cleared}`] || 0;
      }

      if (cleared > 0) {
        const difficult = cleared === 4 || tspin !== null;
        if (difficult) {
          if (this.backToBack) {
            gained = Math.floor(gained * 1.5);
            label += " B2B";
            attack += 1;
          }
          this.backToBack = true;
        } else {
          this.backToBack = false;
        }

        this.combo++;
        if (this.combo > 0) {
          gained += 50 * this.combo * this.level;
          attack += Math.floor(this.combo / 2);
          label += ` COMBO x${this.combo + 1}`;
        }
      } else {
        this.combo = -1;
      }

      if (gained > 0) this.score += gained;

      if (cleared > 0) {
        this.lines += cleared;
        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel !== this.level) {
          this.level = newLevel;
          this.dropInterval = Math.max(50, Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1) * 1000);
        }
      }

      return { cleared, tspin, label, gained, attack };
    }

    // Cancel pending incoming garbage against lines you just cleared, then
    // apply whatever remains. Real competitive Tetris cancels 1-for-1.
    _applyPendingGarbage(clearedByMe) {
      let remaining = clearedByMe;
      while (remaining > 0 && this.garbageQueue.length > 0) {
        const n = this.garbageQueue[0];
        if (n <= remaining) {
          remaining -= n;
          this.garbageQueue.shift();
        } else {
          this.garbageQueue[0] -= remaining;
          remaining = 0;
        }
      }
      if (clearedByMe === 0 && this.garbageQueue.length > 0) {
        const total = this.garbageQueue.reduce((a, b) => a + b, 0);
        this.garbageQueue = [];
        this._insertGarbage(total);
      }
    }

    // Called by the multiplayer client when an attack arrives from another player.
    receiveGarbage(n) {
      if (n > 0) this.garbageQueue.push(n);
    }

    // Only ever called between a lock and the next spawn (see
    // _applyPendingGarbage), so there's no live falling piece to reposition:
    // `this.current` at this point is the piece that just locked, already
    // baked into `this.grid`. A row-of-blocks-getting-pushed-off-the-top is
    // the actual top-out condition for garbage, not a collision check
    // against `this.current` (which used to always self-collide with its
    // own just-shifted cells and cause a bogus instant death).
    _insertGarbage(n) {
      if (n <= 0) return;
      const gapCol = Math.floor(this.rng() * COLS);
      let toppedOut = false;
      for (let i = 0; i < n; i++) {
        const removed = this.grid.shift();
        if (removed.some((c) => c)) toppedOut = true;
        const row = Array(COLS).fill("X");
        row[gapCol] = null;
        this.grid.push(row);
      }
      if (toppedOut) this._endGame();
    }

    holdSwap() {
      if (!this.canHold) return;
      this.canHold = false;
      if (this.holdPiece === null) {
        this.holdPiece = this.current.name;
        this._spawnNext();
      } else {
        const tmp = this.holdPiece;
        this.holdPiece = this.current.name;
        this.current = this._spawnPiece(tmp);
        this.lastActionWasRotate = false;
      }
      this.onChange(this);
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
      if (!this.running || this.paused) return;
      switch (action) {
        case "left": this.tryMove(-1, 0); this._resetLockIfGrounded(); break;
        case "right": this.tryMove(1, 0); this._resetLockIfGrounded(); break;
        case "down": if (this.tryMove(0, 1)) this.score += 1; break;
        case "rotate": this.tryRotate(1); break;
        case "rotate-ccw": this.tryRotate(-1); break;
        case "drop": this.hardDrop(); break;
        case "hold": this.holdSwap(); break;
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

    // Advance the simulation by dt milliseconds. Returns true if anything changed.
    update(dt) {
      if (!this.running || this.paused) return;

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
        this.lockResets = 0;
      }

      this.onChange(this);
    }
  }

  global.TetrisEngine = TetrisEngine;
  global.TetrisEngine.SHAPES = SHAPES;
  global.TetrisEngine.COLORS = COLORS;
  global.TetrisEngine.COLS = COLS;
  global.TetrisEngine.ROWS = ROWS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = TetrisEngine;
    module.exports.SHAPES = SHAPES;
    module.exports.COLORS = COLORS;
    module.exports.COLS = COLS;
    module.exports.ROWS = ROWS;
  }
})(typeof window !== "undefined" ? window : globalThis);
