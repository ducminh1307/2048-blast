/**
 * Piece & Tray Management System
 * Based on GDD v0.1 Section 5, 21, 22
 */

class PieceGenerator {
  constructor() {
    this.useSmartGeneration = true;
  }

  // Pick random value based on weights, with optional bias to board state
  getRandomValue(boardState = null) {
    if (this.useSmartGeneration && boardState && Math.random() < 0.35) {
      // Smart bias: pick a value that actually exists on the board to facilitate adjacent merges
      const boardValues = [];
      const rows = boardState.length;
      const cols = boardState[0].length;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (boardState[r][c] && boardState[r][c].value <= 16) {
            boardValues.push(boardState[r][c].value);
          }
        }
      }
      if (boardValues.length > 0) {
        return boardValues[Math.floor(Math.random() * boardValues.length)];
      }
    }

    const totalWeight = CONFIG.SPAWN_VALUES.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const item of CONFIG.SPAWN_VALUES) {
      if (rand < item.weight) return item.value;
      rand -= item.weight;
    }
    return 2;
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
  createPiece(boardState = null, specificShapeId = null, forcedValues = null) {
    const shapeDef = specificShapeId
      ? SHAPE_DEFINITIONS.find(s => s.id === specificShapeId) || this.getRandomShape()
      : this.getRandomShape();

    // Calculate dimensions
    let maxR = 0, maxC = 0;
    shapeDef.cells.forEach(([r, c]) => {
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });

    const cells = shapeDef.cells.map(([r, c], idx) => {
      const val = forcedValues && forcedValues[idx] !== undefined
        ? forcedValues[idx]
        : this.getRandomValue(boardState);
      return { r, c, value: val };
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
    for (let i = 0; i < CONFIG.TRAY_SIZE; i++) {
      pieces.push(this.createPiece(boardState));
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

  refill(boardState = null) {
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
