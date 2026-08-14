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

  const COLOR_NAMES = ["R", "G", "B", "Y"];
  const COLORS = {
    R: "#e0555f",
    G: "#4fd67a",
    B: "#4a9fe0",
    Y: "#f0d048",
  };

  const CHAIN_BONUS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
  const COLOR_BONUS = [0, 0, 3, 6, 12, 24];

  function groupBonus(size) {
    if (size <= 4) return 0;
    if (size === 5) return 2;
    if (size === 6) return 3;
    if (size <= 8) return 4;
    if (size <= 10) return 5;
    if (size <= 12) return 6;
    return 7;
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
      // Axis spawns on the top visible row (y=0) with the child a row above
      // it (invisible, rot 0). Spawning both cells off-grid (y<0) would mean
      // _collides() never checks the stack at all, so game-over would never
      // fire no matter how full the spawn column got.
      return { colors, rot: 0, x: Math.floor(COLS / 2) - 1, y: 0 };
    }

    _spawnNext() {
      this.current = this._spawnPiece(this.nextQueue.shift());
      this.nextQueue.push(this._nextPairColors());
      this.lockTimer = null;
      this.dropAccumulator = 0;
      if (this._collides(this.current)) this._endGame();
      this.onChange(this);
    }

    tryMove(dx, dy) {
      const moved = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
      if (this._collides(moved)) return false;
      this.current = moved;
      return true;
    }

    tryRotate(dir) {
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
        if (cell.y < 0) {
          this._endGame();
          return;
        }
        this.grid[cell.y][cell.x] = cell.color;
      }
      this._resolveChain();
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

    _resolveChain() {
      let totalGained = 0;
      let totalErased = 0;
      let chainCount = 0;

      while (true) {
        this._applyGravity();
        const groups = this._findErasableGroups();
        if (groups.length === 0) break;
        chainCount++;

        const colors = new Set(groups.map((g) => g.color));
        let erasedThisStep = 0;
        let groupBonusSum = 0;
        for (const g of groups) {
          erasedThisStep += g.cells.length;
          groupBonusSum += groupBonus(g.cells.length);
          for (const [x, y] of g.cells) this.grid[y][x] = null;
        }

        const bonus = Math.max(1, chainBonus(chainCount) + COLOR_BONUS[Math.min(colors.size, COLOR_BONUS.length - 1)] + groupBonusSum);
        totalGained += erasedThisStep * 10 * bonus;
        totalErased += erasedThisStep;
      }

      if (totalGained > 0) this.score += totalGained;
      if (chainCount > this.maxChain) this.maxChain = chainCount;
      this.chainCount = chainCount;

      this.onLock(this, { chainCount, gained: totalGained, erasedCount: totalErased });
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
      if (!this.running || this.paused) return;
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
