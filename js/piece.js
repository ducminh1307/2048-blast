/**
 * Piece & Tray Management System
 * Based on GDD v0.1 Section 5, 21, 22
 */

class PieceGenerator {
  constructor() {
    this.useSmartGeneration = true;
    this.minActiveTier = 0;
  }

  setMinActiveTier(tier) {
    this.minActiveTier = tier;
  }

  // Pick random value based on weights, with optional bias to board state
  getRandomValue(boardState = null) {
    const minVal = CONFIG.getValueFromTier ? CONFIG.getValueFromTier(this.minActiveTier) : 2;
    const maxSmartVal = minVal * 8; // e.g. if min is 4, smart can pick up to 32

    if (this.useSmartGeneration && boardState && Math.random() < 0.35) {
      // Smart bias: pick a value that actually exists on the board to facilitate adjacent merges
      // Excludes values below minVal (retired values)
      const boardValues = [];
      const rows = boardState.length;
      const cols = boardState[0].length;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (boardState[r][c] && boardState[r][c].value >= minVal && boardState[r][c].value <= maxSmartVal) {
            boardValues.push(boardState[r][c].value);
          }
        }
      }
      if (boardValues.length > 0) {
        return boardValues[Math.floor(Math.random() * boardValues.length)];
      }
    }

    const spawnList = CONFIG.getSpawnValues ? CONFIG.getSpawnValues(this.minActiveTier) : CONFIG.SPAWN_VALUES;
    const totalWeight = spawnList.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of spawnList) {
      if (rand < item.weight) return item.value;
      rand -= item.weight;
    }
    return minVal;
  }

  // Pick random shape definition based on weights
  getRandomShape() {
    const totalWeight = SHAPE_DEFINITIONS.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const shape of SHAPE_DEFINITIONS) {
      if (rand < shape.weight) return shape;
      rand -= shape.weight;
    }
    return SHAPE_DEFINITIONS[0];
  }

  // Generate a piece with independent numbers on each cell (Section 5.3)
  createPiece(boardState = null, specificShapeId = null, forcedValues = null, allowWildcard = true) {
    const shapeDef = specificShapeId
      ? SHAPE_DEFINITIONS.find(s => s.id === specificShapeId) || this.getRandomShape()
      : this.getRandomShape();

    // Calculate dimensions
    let maxR = 0, maxC = 0;
    shapeDef.cells.forEach(([r, c]) => {
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });

    let pieceHasSpecial = false;

    const cells = shapeDef.cells.map(([r, c], idx) => {
      let isWildcard = false;
      let multiplier = 1;
      let val;

      if (forcedValues && forcedValues[idx] !== undefined) {
        const forced = forcedValues[idx];
        if (typeof forced === 'object' && forced !== null) {
          val = forced.value !== undefined ? forced.value : (forced.isWildcard ? '★' : this.getRandomValue(boardState));
          isWildcard = !!forced.isWildcard;
          multiplier = forced.multiplier || 1;
        } else if (forced === '★') {
          val = '★';
          isWildcard = true;
        } else {
          val = forced;
        }
      } else {
        // Roll for special tile (at most 1 special cell per piece to keep game balance)
        const wildcardChance = allowWildcard ? (CONFIG.WILDCARD_SPAWN_CHANCE || 0.012) : 0;
        const boosterChance = CONFIG.BOOSTER_2X_SPAWN_CHANCE || 0.03;
        const randSpecial = Math.random();

        if (!pieceHasSpecial && randSpecial < wildcardChance) {
          val = '★';
          isWildcard = true;
          pieceHasSpecial = true;
        } else if (!pieceHasSpecial && randSpecial < wildcardChance + boosterChance) {
          val = this.getRandomValue(boardState);
          multiplier = 2;
          pieceHasSpecial = true;
        } else {
          val = this.getRandomValue(boardState);
        }
      }

      return {
        r,
        c,
        value: val,
        isWildcard,
        multiplier
      };
    });

    return {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      shapeId: shapeDef.id,
      name: shapeDef.name,
      rows: maxR + 1,
      cols: maxC + 1,
      cells: cells
    };
  }

  // Generate a tray with 3 pieces (Section 5.1)
  createTray(boardState = null) {
    const pieces = [];
    let trayHasWildcard = false;
    for (let i = 0; i < CONFIG.TRAY_SIZE; i++) {
      const piece = this.createPiece(boardState, null, null, !trayHasWildcard);
      if (piece.cells.some(c => c.isWildcard)) {
        trayHasWildcard = true;
      }
      pieces.push(piece);
    }
    return pieces;
  }
}

class TrayManager {
  constructor(generator) {
    this.generator = generator;
    this.pieces = [null, null, null];
    this.selectedPieceIndex = null;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.pieces, this.selectedPieceIndex));
  }

  refill(boardState = null, minActiveTier = 0) {
    if (this.generator.setMinActiveTier) {
      this.generator.setMinActiveTier(minActiveTier);
    }
    this.pieces = this.generator.createTray(boardState);
    this.selectedPieceIndex = null;
    this.notify();
  }

  selectPiece(index) {
    if (this.selectedPieceIndex === index) {
      this.selectedPieceIndex = null; // Toggle off
    } else if (this.pieces[index] !== null) {
      this.selectedPieceIndex = index;
    }
    this.notify();
  }

  getSelectedPiece() {
    if (this.selectedPieceIndex !== null) {
      return this.pieces[this.selectedPieceIndex];
    }
    return null;
  }

  consumePiece(index) {
    this.pieces[index] = null;
    if (this.selectedPieceIndex === index) {
      this.selectedPieceIndex = null;
    }
    this.notify();
  }

  isTrayEmpty() {
    return this.pieces.every(p => p === null);
  }

  setPiece(index, piece) {
    this.pieces[index] = piece;
    this.notify();
  }
}
