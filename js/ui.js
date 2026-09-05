/**
 * UI Renderer & Interaction Controller
 * Drag & Drop, Tap-to-Place, Ghost Preview, Particle / Floating Text FX
 */

class UIManager {
  constructor(board, trayManager) {
    this.board = board;
    this.trayManager = trayManager;

    // DOM Elements
    this.boardEl = document.getElementById('game-board');
    this.trayEl = document.getElementById('pieces-tray');
    this.scoreValEl = document.getElementById('score-val');
    this.bestValEl = document.getElementById('best-val');
    this.turnsValEl = document.getElementById('turns-val');
    this.occupancyValEl = document.getElementById('occupancy-val');
    this.floatingContainer = document.getElementById('floating-container');

    // Level Mode Elements & Persistence State
    this.unlockedLevel = parseInt(localStorage.getItem('mpp_level_unlocked') || '1', 10);
    try {
      this.levelStars = JSON.parse(localStorage.getItem('mpp_level_stars') || '{}');
    } catch (e) {
      this.levelStars = {};
    }

    this.tabEndless = document.getElementById('tab-endless');
    this.tabLevels = document.getElementById('tab-levels');
    this.endlessHeaderView = document.getElementById('endless-header-view');
    this.levelHeaderView = document.getElementById('level-header-view');
    this.levelNumDisplay = document.getElementById('level-num-display');
    this.levelTargetTile = document.getElementById('level-target-tile');
    this.movesLeftVal = document.getElementById('moves-left-val');
    this.levelScoreVal = document.getElementById('level-score-val');
    this.levelCompleteModal = document.getElementById('level-complete-modal');
    this.levelFailedModal = document.getElementById('level-failed-modal');
    this.levelSelectModal = document.getElementById('level-select-modal');
    this.levelSelectionGrid = document.getElementById('level-selection-grid');

    // High Score & Score Rolling Animation state
    this.bestScore = parseInt(localStorage.getItem('mpp_best_score') || '0', 10);
    this.displayedScore = 0;
    this.displayedBestScore = this.bestScore;
    this.scoreAnimFrame = null;
    this.bestAnimFrame = null;
    this.hintTimeout = null;

    // Drag & Pointer state
    this.isDragging = false;
    this.activePointerId = null;
    this.draggedPieceIndex = null;
    this.dragGhostEl = null;
    this.currentDragAnchor = { r: 0, c: 0 };
    this.anchorOffset = { x: 0, y: 0 };
    this.touchLiftY = 0;
    this.currentPlacement = null; // { startR, startC }

    this.setupEventListeners();
    this.updateTierHUD();
  }

  setupEventListeners() {
    // Window pointermove for active dragging (unified mouse & touch)
    window.addEventListener('pointermove', (e) => {
      if (this.activePointerId !== null && e.pointerId === this.activePointerId && this.isDragging) {
        if (e.cancelable) e.preventDefault();
        this.onPointerMove(e.clientX, e.clientY);
      }
    }, { passive: false });

    // Window pointerup to complete drag
    window.addEventListener('pointerup', (e) => {
      if (this.activePointerId !== null && e.pointerId === this.activePointerId) {
        this.onPointerUp(e.clientX, e.clientY);
      }
    });

    // Window pointercancel for touch interruptions (incoming call, gesture nav)
    window.addEventListener('pointercancel', (e) => {
      if (this.activePointerId !== null && e.pointerId === this.activePointerId) {
        this.cancelDrag();
      }
    });
  }

  cancelDrag() {
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }

    this.isDragging = false;
    this.draggedPieceIndex = null;
    this.currentPlacement = null;
    this.activePointerId = null;
    this.clearGhostPreview();
    this.updateActiveSlotVisual();
  }

  updateActiveSlotVisual(activeIdx = null) {
    for (let i = 0; i < CONFIG.TRAY_SIZE; i++) {
      const slotEl = document.getElementById(`tray-slot-${i}`);
      if (slotEl) {
        const isActive = (activeIdx === i || this.draggedPieceIndex === i);
        slotEl.classList.toggle('active-slot', isActive);
      }
    }
  }

  // Render the entire board grid
  renderBoard() {
    this.boardEl.innerHTML = '';
    this.boardEl.style.gridTemplateColumns = `repeat(${this.board.size}, 1fr)`;
    this.boardEl.style.gridTemplateRows = `repeat(${this.board.size}, 1fr)`;

    for (let r = 0; r < this.board.size; r++) {
      for (let c = 0; c < this.board.size; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'board-cell';
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;

        const cellData = this.board.grid[r][c];
        if (cellData) {
          const tileEl = this.createTileElement(cellData);
          cellEl.appendChild(tileEl);
        }

        this.boardEl.appendChild(cellEl);
      }
    }

    this.updateStats();
  }

  createTileElement(cellDataOrValue, isGhost = false, extraClass = '') {
    let value, isWildcard = false, multiplier = 1;
    if (typeof cellDataOrValue === 'object' && cellDataOrValue !== null) {
      value = cellDataOrValue.value;
      isWildcard = !!cellDataOrValue.isWildcard || value === '★';
      multiplier = cellDataOrValue.multiplier || 1;
    } else {
      value = cellDataOrValue;
      isWildcard = value === '★';
    }

    const tile = document.createElement('div');
    const wildcardClass = isWildcard ? 'tile-wildcard' : '';
    const boosterClass = multiplier > 1 ? 'tile-booster-2x' : '';
    tile.className = `tile val-${value} ${wildcardClass} ${boosterClass} ${isGhost ? 'ghost-tile' : ''} ${extraClass}`.trim();
    tile.textContent = isWildcard ? '★' : value;

    const style = CONFIG.TILE_COLORS[value] || CONFIG.TILE_COLORS.DEFAULT;
    if (style.bg && style.bg.startsWith('linear-gradient')) {
      tile.style.background = style.bg;
    } else {
      tile.style.backgroundColor = style.bg;
    }
    tile.style.color = style.text;
    tile.style.borderColor = style.border;
    if (style.glow) {
      tile.style.boxShadow = `0 0 12px ${style.glow}`;
    }

    if (multiplier > 1 && !isWildcard) {
      const badge = document.createElement('span');
      badge.className = 'booster-badge';
      badge.textContent = `${multiplier}×`;
      tile.appendChild(badge);
    }

    return tile;
  }

  // Render tray containing the 3 pieces
  renderTray() {
    this.trayEl.innerHTML = '';

    this.trayManager.pieces.forEach((piece, index) => {
      const isSlotActive = (this.draggedPieceIndex === index);
      const slotEl = document.createElement('div');
      slotEl.className = `tray-slot ${isSlotActive ? 'active-slot' : ''}`;
      slotEl.id = `tray-slot-${index}`;

      if (!piece) {
        slotEl.classList.add('empty-slot');
        this.trayEl.appendChild(slotEl);
        return;
      }

      // Compute dynamic cell size so the piece fits proportionately inside the fixed slot
      const maxDim = Math.max(piece.rows, piece.cols, 1);
      const slotInnerSize = 78; // maximum width/height inside the fixed slot
      const gap = maxDim >= 3 ? 2 : 3;
      const cellSize = Math.min(36, Math.floor((slotInnerSize - (maxDim - 1) * gap) / maxDim));
      const fontSize = Math.max(9, Math.round(cellSize * 0.46));

      const pieceEl = document.createElement('div');
      pieceEl.className = 'tray-piece';
      pieceEl.style.gridTemplateColumns = `repeat(${piece.cols}, ${cellSize}px)`;
      pieceEl.style.gridTemplateRows = `repeat(${piece.rows}, ${cellSize}px)`;
      pieceEl.style.gap = `${gap}px`;

      // Fill grid cells of the polyomino
      for (let r = 0; r < piece.rows; r++) {
        for (let c = 0; c < piece.cols; c++) {
          const matchingCell = piece.cells.find(cell => cell.r === r && cell.c === c);
          const cellDiv = document.createElement('div');
          cellDiv.className = 'piece-cell-wrapper';
          cellDiv.style.width = `${cellSize}px`;
          cellDiv.style.height = `${cellSize}px`;

          if (matchingCell) {
            cellDiv.dataset.r = r;
            cellDiv.dataset.c = c;
            const tileEl = this.createTileElement(matchingCell);
            tileEl.classList.add('mini-tile');
            tileEl.style.fontSize = `${fontSize}px`;
            cellDiv.appendChild(tileEl);
          }
          pieceEl.appendChild(cellDiv);
        }
      }

      slotEl.appendChild(pieceEl);

      // Drag starts from ANYWHERE inside the slot (slot background or piece tiles)
      slotEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== undefined && e.pointerType === 'mouse') return;
        if (this.board.isResolving || !piece) return;
        e.preventDefault();
        e.stopPropagation();

        // Check if a specific cell was grabbed
        let grabCell = null;
        const cellWrapper = (e.target && typeof e.target.closest === 'function') ? e.target.closest('.piece-cell-wrapper') : null;
        if (cellWrapper && cellWrapper.dataset.r !== undefined && cellWrapper.dataset.c !== undefined) {
          grabCell = {
            r: parseInt(cellWrapper.dataset.r, 10),
            c: parseInt(cellWrapper.dataset.c, 10)
          };
        }

        this.activePointerId = e.pointerId;
        const isTouch = e.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches;
        this.startDrag(index, piece, e.clientX, e.clientY, grabCell, isTouch);
      });

      this.trayEl.appendChild(slotEl);
    });
  }

  // Find optimal anchor cell for the piece (grabbed cell, or closest to visual center)
  getPieceAnchor(piece, grabCell = null) {
    if (grabCell && piece.cells.some(c => c.r === grabCell.r && c.c === grabCell.c)) {
      return { r: grabCell.r, c: grabCell.c };
    }
    // Default to cell closest to center of piece bounding box
    const centerR = (piece.rows - 1) / 2;
    const centerC = (piece.cols - 1) / 2;
    let bestCell = piece.cells[0];
    let bestDist = Infinity;
    for (const cell of piece.cells) {
      const dist = Math.hypot(cell.r - centerR, cell.c - centerC);
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = cell;
      }
    }
    return { r: bestCell.r, c: bestCell.c };
  }

  // Precise board grid metrics based on actual rendered DOM cells
  getBoardMetrics() {
    const boardRect = this.boardEl.getBoundingClientRect();
    const cell00 = this.getCellEl(0, 0);
    const cell01 = this.getCellEl(0, 1);
    const cell10 = this.getCellEl(1, 0);

    let cellW = 44, cellH = 44, strideX = 50, strideY = 50, gap = 6;
    let originX = boardRect.left + 8;
    let originY = boardRect.top + 8;

    if (cell00) {
      const r00 = cell00.getBoundingClientRect();
      cellW = r00.width;
      cellH = r00.height;
      originX = r00.left;
      originY = r00.top;

      if (cell01) {
        const r01 = cell01.getBoundingClientRect();
        strideX = r01.left - r00.left;
        gap = Math.max(0, strideX - cellW);
      } else {
        strideX = cellW + 6;
      }

      if (cell10) {
        const r10 = cell10.getBoundingClientRect();
        strideY = r10.top - r00.top;
      } else {
        strideY = cellH + 6;
      }
    }

    return {
      boardRect,
      cellW,
      cellH,
      strideX,
      strideY,
      gap,
      originX,
      originY
    };
  }

  // Map pointer position to board placement coordinates using the piece's anchor
  getPlacementAtPoint(piece, clientX, clientY, anchor = null) {
    const activeAnchor = anchor || this.currentDragAnchor || this.getPieceAnchor(piece);
    const m = this.getBoardMetrics();

    // Visual pointer position (accounting for touch finger lift)
    const visualX = clientX;
    const visualY = clientY - this.touchLiftY;

    // Find nearest board cell center under pointer
    const hoveredCol = Math.round((visualX - (m.originX + m.cellW / 2)) / m.strideX);
    const hoveredRow = Math.round((visualY - (m.originY + m.cellH / 2)) / m.strideY);

    // Compute top-left placement coordinate
    const startR = hoveredRow - activeAnchor.r;
    const startC = hoveredCol - activeAnchor.c;

    // Ensure the piece is within reasonable vicinity of the board
    if (
      startR + piece.rows <= -1 ||
      startR >= this.board.size + 1 ||
      startC + piece.cols <= -1 ||
      startC >= this.board.size + 1
    ) {
      return null;
    }

    return { startR, startC, hoveredRow, hoveredCol };
  }

  startDrag(pieceIndex, piece, clientX, clientY, grabCell = null, isTouch = false) {
    if (this.board.isResolving) return;

    this.isDragging = true;
    this.draggedPieceIndex = pieceIndex;
    this.currentDragAnchor = this.getPieceAnchor(piece, grabCell);

    if (window.soundSystem) window.soundSystem.playPick();

    const m = this.getBoardMetrics();
    this.touchLiftY = isTouch ? 60 : 0;

    // Create floating drag clone scaled EXACTLY to match board cell size
    this.dragGhostEl = document.createElement('div');
    this.dragGhostEl.className = 'drag-floating-piece';
    this.dragGhostEl.style.gridTemplateColumns = `repeat(${piece.cols}, ${m.cellW}px)`;
    this.dragGhostEl.style.gridTemplateRows = `repeat(${piece.rows}, ${m.cellH}px)`;
    this.dragGhostEl.style.gap = `${m.gap}px`;

    for (let r = 0; r < piece.rows; r++) {
      for (let c = 0; c < piece.cols; c++) {
        const matchingCell = piece.cells.find(cell => cell.r === r && cell.c === c);
        const cellDiv = document.createElement('div');
        cellDiv.className = 'piece-cell-wrapper';
        cellDiv.style.width = `${m.cellW}px`;
        cellDiv.style.height = `${m.cellH}px`;

        if (matchingCell) {
          const tileEl = this.createTileElement(matchingCell);
          cellDiv.appendChild(tileEl);
        }
        this.dragGhostEl.appendChild(cellDiv);
      }
    }

    document.body.appendChild(this.dragGhostEl);

    // Anchor offset: place center of the anchor cell exactly at pointer
    this.anchorOffset = {
      x: this.currentDragAnchor.c * m.strideX + m.cellW / 2,
      y: this.currentDragAnchor.r * m.strideY + m.cellH / 2
    };

    this.updateDragPosition(clientX, clientY);
    this.updateActiveSlotVisual(pieceIndex);
  }

  updateDragPosition(clientX, clientY) {
    if (!this.dragGhostEl) return;
    const x = clientX - this.anchorOffset.x;
    const y = clientY - this.touchLiftY - this.anchorOffset.y;
    this.dragGhostEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  onPointerMove(clientX, clientY) {
    if (!this.isDragging) return;
    this.updateDragPosition(clientX, clientY);

    const piece = this.trayManager.pieces[this.draggedPieceIndex];
    if (!piece) return;

    const placement = this.getPlacementAtPoint(piece, clientX, clientY, this.currentDragAnchor);
    if (placement) {
      if (
        !this.currentPlacement ||
        this.currentPlacement.startR !== placement.startR ||
        this.currentPlacement.startC !== placement.startC
      ) {
        this.currentPlacement = placement;
        this.showGhostPreview(this.draggedPieceIndex, placement.startR, placement.startC);
      }
    } else {
      if (this.currentPlacement) {
        this.currentPlacement = null;
        this.clearGhostPreview();
      }
    }
  }

  onPointerUp(clientX, clientY) {
    if (!this.isDragging) return;

    const pieceIndex = this.draggedPieceIndex;
    const piece = this.trayManager.pieces[pieceIndex];
    const placement = piece ? this.getPlacementAtPoint(piece, clientX, clientY, this.currentDragAnchor) : null;

    // Remove drag clone
    if (this.dragGhostEl) {
      this.dragGhostEl.remove();
      this.dragGhostEl = null;
    }

    this.isDragging = false;
    this.draggedPieceIndex = null;
    this.currentPlacement = null;
    this.clearGhostPreview();

    if (placement && pieceIndex !== null) {
      this.attemptPlacement(pieceIndex, placement.startR, placement.startC);
    } else {
      this.updateActiveSlotVisual();
    }
  }

  // Show Ghost Preview (Section 24 GDD)
  showGhostPreview(pieceIndex, startR, startC) {
    this.clearGhostPreview();
    const piece = this.trayManager.pieces[pieceIndex];
    if (!piece) return;

    const preview = this.board.previewPlacement(piece, startR, startC);

    if (!preview.valid) {
      // Show invalid / blocked feedback
      preview.validation.cellResults.forEach(cr => {
        if (this.board.inBounds(cr.br, cr.bc)) {
          const cellEl = this.getCellEl(cr.br, cr.bc);
          if (cellEl) {
            if (cr.status === 'blocked') {
              cellEl.classList.add('preview-blocked');
            } else if (cr.status === 'empty') {
              cellEl.classList.add('preview-valid');
            }
          }
        }
      });
      return;
    }

    // Placement is VALID!
    // 1. Show ghost tiles
    preview.placements.forEach(p => {
      const cellEl = this.getCellEl(p.r, p.c);
      if (!cellEl) return;

      cellEl.classList.add('preview-valid');
      const ghostTile = this.createTileElement(p, true);
      cellEl.appendChild(ghostTile);
    });

    // 2. Highlight cells that will participate in group merge with green dashed outline
    preview.mergingCells.forEach(mc => {
      const cellEl = this.getCellEl(mc.r, mc.c);
      if (cellEl) {
        cellEl.classList.add('preview-merging', 'preview-merging-dashed');
      }
    });

    // 3. Highlight merge anchors
    preview.predictedMerges.forEach(pm => {
      const anchorEl = this.getCellEl(pm.anchor.r, pm.anchor.c);
      if (anchorEl) {
        anchorEl.classList.add('preview-anchor');
      }
    });
  }

  clearGhostPreview() {
    const cells = this.boardEl.querySelectorAll('.board-cell');
    cells.forEach(c => {
      c.classList.remove(
        'preview-valid',
        'preview-blocked',
        'preview-merging',
        'preview-merging-dashed',
        'preview-anchor'
      );
      const ghosts = c.querySelectorAll('.ghost-tile, .preview-result-badge');
      ghosts.forEach(g => g.remove());
    });

    const pill = document.getElementById('preview-score-pill');
    if (pill) pill.remove();

    const bubble = document.getElementById('merge-speech-bubble');
    if (bubble) bubble.remove();
  }

  getCellEl(r, c) {
    return this.boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
  }

  // Attempt to drop / place piece
  async attemptPlacement(pieceIndex, startR, startC) {
    this.clearHint();
    const piece = this.trayManager.pieces[pieceIndex];
    if (!piece || this.board.isResolving) return;

    // Check validity before starting animation
    const valResult = this.board.validatePlacement(piece, startR, startC);
    if (!valResult.valid) {
      // Invalid placement feedback
      if (window.soundSystem) window.soundSystem.playInvalid();
      if (window.analyticsTracker) window.analyticsTracker.recordInvalidDrop();

      const cellEl = this.getCellEl(startR, startC);
      if (cellEl) {
        cellEl.classList.add('shake-invalid');
        setTimeout(() => cellEl.classList.remove('shake-invalid'), 300);
      }
      this.clearGhostPreview();
      this.updateActiveSlotVisual();
      return;
    }

    // Valid placement: IMMEDIATELY consume piece from slot and update tray UI!
    this.trayManager.consumePiece(pieceIndex);
    this.clearGhostPreview();
    this.renderTray();

    const animSpeed = 'normal';

    const success = await this.board.executePlacement(
      piece,
      startR,
      startC,
      async (stepInfo) => await this.onStepUpdate(stepInfo),
      animSpeed
    );

    if (success) {
      // Check if tray is empty -> refill (Section 5.1)
      if (this.trayManager.isTrayEmpty()) {
        this.trayManager.refill(this.board.grid, this.board.minActiveTier);
        this.renderTray();
      }

      this.renderBoard();

      // Check Game Over (Section 19)
      const isOver = this.board.checkGameOver(this.trayManager.pieces);
      if (isOver) {
        if (this.board.gameMode === 'level') {
          if (!this.board.isLevelWon) {
            this.board.isLevelFailed = true;
            this.showLevelFailedModal({
              level: this.board.currentLevel,
              targetNumber: this.board.targetNumber,
              reason: 'no_moves',
              score: this.board.score
            });
          }
        } else {
          this.triggerGameOver();
        }
      }
    }
  }

  /**
   * Isolated Board Shake: Rung duy nhất #game-board container, giữ nguyên HUD/Score/Tray
   */
  triggerBoardShake(shakeType) {
    if (!shakeType || shakeType === 'none' || !this.boardEl) return;
    this.boardEl.classList.remove('shake-tiny', 'shake-light', 'shake-medium');
    void this.boardEl.offsetWidth; // Force CSS reflow
    const cls = `shake-${shakeType}`;
    this.boardEl.classList.add(cls);
    setTimeout(() => {
      if (this.boardEl) this.boardEl.classList.remove(cls);
    }, 260);
  }

  /**
   * Subtle Board Flash: Chớp sáng nhẹ trên mặt bàn cờ khi chuỗi combo Chain >= 4
   */
  triggerBoardFlash() {
    if (!this.boardEl) return;
    this.boardEl.classList.remove('board-flash');
    void this.boardEl.offsetWidth;
    this.boardEl.classList.add('board-flash');
    setTimeout(() => {
      if (this.boardEl) this.boardEl.classList.remove('board-flash');
    }, 240);
  }

  /**
   * Radial Particle Burst & Shockwave Ring emitting from anchor cell at impact frame
   */
  spawnParticleBurst(r, c, count, colorHex, withShockwave = false) {
    const cellEl = this.getCellEl(r, c);
    if (!cellEl || !this.floatingContainer) return;

    const cellRect = cellEl.getBoundingClientRect();
    const contRect = this.floatingContainer.getBoundingClientRect();
    const cx = cellRect.left - contRect.left + cellRect.width / 2;
    const cy = cellRect.top - contRect.top + cellRect.height / 2;

    if (withShockwave) {
      const ring = document.createElement('div');
      ring.className = 'shockwave-ring';
      ring.style.left = `${cx}px`;
      ring.style.top = `${cy}px`;
      ring.style.borderColor = colorHex || '#38bdf8';
      this.floatingContainer.appendChild(ring);
      setTimeout(() => ring.remove(), 380);
    }

    const baseDist = cellRect.width * 0.75;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'merge-particle';
      const size = Math.random() * 4 + 4; // 4 to 8px
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.backgroundColor = colorHex || '#38bdf8';
      particle.style.boxShadow = `0 0 7px ${colorHex || '#38bdf8'}`;

      this.floatingContainer.appendChild(particle);

      const angle = (2 * Math.PI * i) / count + (Math.random() - 0.5) * 0.45;
      const dist = baseDist * (0.55 + Math.random() * 0.85) * (count > 25 ? 1.35 : 1.0);
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const dur = 300 + Math.random() * 150;

      if (particle.animate) {
        const anim = particle.animate([
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.15)`, opacity: 0 }
        ], {
          duration: dur,
          easing: 'cubic-bezier(0.12, 0.8, 0.32, 1)',
          fill: 'forwards'
        });
        anim.onfinish = () => particle.remove();
      } else {
        setTimeout(() => particle.remove(), dur);
      }
    }
  }

  /**
   * Inward suck / collapse: Các ô phụ trượt và co vào tâm ô anchor, anchor co nhẹ để tích lực
   */
  async animateInwardCollapse(waveResults, isBigMerge) {
    const { strideX, strideY } = this.getBoardMetrics();
    const suckDur = isBigMerge ? 140 : 170;

    for (const wr of waveResults) {
      const anchor = wr.anchor;
      const nonAnchorCells = wr.cells.filter(c => c.r !== anchor.r || c.c !== anchor.c);

      for (const c of nonAnchorCells) {
        const cellEl = this.getCellEl(c.r, c.c);
        const tile = cellEl?.querySelector('.tile');
        if (tile) {
          const dx = (anchor.c - c.c) * strideX;
          const dy = (anchor.r - c.r) * strideY;
          tile.style.transition = `transform ${suckDur}ms cubic-bezier(0.35, 0, 0.25, 1), opacity ${suckDur}ms ease-in`;
          tile.style.transform = `translate(${dx}px, ${dy}px) scale(0.35)`;
          tile.style.opacity = '0.2';
        }
      }

      const anchorEl = this.getCellEl(anchor.r, anchor.c);
      const anchorTile = anchorEl?.querySelector('.tile');
      if (anchorTile) {
        anchorTile.style.transition = `transform ${suckDur}ms ease-out`;
        anchorTile.style.transform = 'scale(0.86)';
      }
    }

    await new Promise(resolve => setTimeout(resolve, suckDur));
  }

  async onStepUpdate(stepInfo) {
    if (stepInfo.phase === 'placed') {
      this.renderBoard();
      this.updateStats();
      if (stepInfo.activeCoords) {
        stepInfo.activeCoords.forEach(coordKey => {
          const [r, c] = coordKey.split(',').map(Number);
          const cellData = this.board.grid[r][c];
          if (cellData && cellData.isDirectMerge) {
            const cellEl = this.getCellEl(r, c);
            const tile = cellEl?.querySelector('.tile');
            if (tile) tile.classList.add('tile-pop-normal');
          }
        });
      }
    } else if (stepInfo.phase === 'wave_collapse') {
      await this.animateInwardCollapse(stepInfo.waveResults, stepInfo.isBigMerge);
    } else if (stepInfo.phase === 'wave_resolved') {
      const maxCount = stepInfo.maxCount || Math.max(...stepInfo.waveResults.map(w => w.count));
      const wave = stepInfo.wave;

      // Hierarchy: Group Size + Chain Depth (Skill-driven feedback)
      let shake = 'none';
      let isHeavyPop = false;
      let particleCount = 10;
      let withShockwave = false;
      let withFlash = false;
      let hitStopMs = 0;

      if (wave >= 4) {
        shake = 'medium';
        isHeavyPop = true;
        particleCount = 38;
        withShockwave = true;
        withFlash = true;
        hitStopMs = 45; // Micro hit-stop (~30-60ms) for high chain combo climax
      } else if (wave === 3) {
        shake = 'light';
        isHeavyPop = true;
        particleCount = 28;
        withShockwave = true;
      } else if (wave === 2) {
        shake = 'tiny';
        isHeavyPop = true;
        particleCount = 20;
        withShockwave = false;
      } else {
        // wave === 1
        if (maxCount >= 4) {
          shake = 'tiny';
          isHeavyPop = true;
          particleCount = 24;
          withShockwave = true;
        } else if (maxCount === 3) {
          shake = 'none';
          isHeavyPop = false;
          particleCount = 16;
        } else {
          shake = 'none';
          isHeavyPop = false;
          particleCount = 10;
        }
      }

      // Micro hit-stop: Dừng rất ngắn ngay trước khi số kết quả bùng nổ
      if (hitStopMs > 0) {
        await new Promise(r => setTimeout(r, hitStopMs));
      } else {
        await new Promise(r => setTimeout(r, 20));
      }

      // Render new board grid (Result tiles appear in DOM)
      this.renderBoard();
      this.updateStats();

      // --- EXACT IMPACT FRAME: Shake, SFX, Pop, Particles, Flash ---
      // 1. Isolated Board Shake (Only on #game-board container!)
      if (shake !== 'none') {
        this.triggerBoardShake(shake);
      }

      // 2. Subtle board flash for high combos
      if (withFlash) {
        this.triggerBoardFlash();
      }

      // 3. Audio SFX right at impact frame
      if (window.soundSystem) {
        stepInfo.waveResults.forEach(wr => {
          if (wr.hasWildcard && window.soundSystem.playWildcardMerge) {
            window.soundSystem.playWildcardMerge();
          }
          if (wr.hasBooster && window.soundSystem.playBoosterMerge) {
            window.soundSystem.playBoosterMerge();
          }
          window.soundSystem.playGroupMerge(wr.count, wr.resultVal, wave);
        });
        if (wave > 1) {
          window.soundSystem.playChain(wave);
        }
      }

      // 4. Result tile pop, particle burst, and floating text for each anchor
      stepInfo.waveResults.forEach(wr => {
        const anchorEl = this.getCellEl(wr.anchor.r, wr.anchor.c);
        if (anchorEl) {
          const tile = anchorEl.querySelector('.tile');
          if (tile) {
            tile.classList.add(isHeavyPop ? 'tile-pop-heavy' : 'tile-pop-normal');
          }
        }

        const tileColor = wr.hasWildcard
          ? '#facc15'
          : (CONFIG.TILE_COLORS[wr.resultVal]?.bg || '#38bdf8');
        this.spawnParticleBurst(wr.anchor.r, wr.anchor.c, particleCount, tileColor, withShockwave || wr.hasBooster);

        let specialTag = '';
        if (wr.hasBooster) specialTag = ' 2×!';
        else if (wr.hasWildcard) specialTag = ' ★!';

        const label = `+${wr.earnedScore}${specialTag}`;
        this.spawnFloatingText(wr.anchor.r, wr.anchor.c, label);
      });

      // 5. Result Settle: Nhịp thở ngắn để số hồi về bình thường trước khi bước sóng tiếp tục
      await new Promise(r => setTimeout(r, isHeavyPop ? 200 : 160));
    } else if (stepInfo.phase === 'tier_unlock') {
      if (stepInfo.hasPurge) {
        if (window.soundSystem) window.soundSystem.playTierUnlock();
        this.showTierUnlockBanner(stepInfo.newHighestValue, stepInfo.retiredValues);
        this.updateTierHUD(true);
        await new Promise(r => setTimeout(r, 350));
      } else {
        // Pre-Tier 1 record increase (e.g. formed 4, 8, 16, 32, 64, 128)
        this.updateTierHUD(false);
        const currentEl = document.getElementById('tier-tile-current');
        if (currentEl) {
          currentEl.classList.remove('tier-milestone-bump');
          void currentEl.offsetWidth;
          currentEl.classList.add('tier-milestone-bump');
          setTimeout(() => currentEl.classList.remove('tier-milestone-bump'), 450);
        }
      }
    } else if (stepInfo.phase === 'tier_purge') {
      await this.animateTierPurge(stepInfo.purgeTargets, stepInfo.tilesCount);
    } else if (stepInfo.phase === 'tier_purge_complete') {
      this.renderBoard();
      this.updateStats();
      this.updateTierHUD();
    } else if (stepInfo.phase === 'level_won') {
      // Save level progression
      if (stepInfo.stars > (this.levelStars[stepInfo.level] || 0)) {
        this.levelStars[stepInfo.level] = stepInfo.stars;
        try {
          localStorage.setItem('mpp_level_stars', JSON.stringify(this.levelStars));
        } catch (e) {}
      }
      if (stepInfo.level >= this.unlockedLevel && stepInfo.level < (CONFIG.LEVELS_DATA ? CONFIG.LEVELS_DATA.length : 10)) {
        this.unlockedLevel = stepInfo.level + 1;
        try {
          localStorage.setItem('mpp_level_unlocked', this.unlockedLevel.toString());
        } catch (e) {}
      }
      this.showLevelCompleteModal(stepInfo);
    } else if (stepInfo.phase === 'level_failed') {
      this.showLevelFailedModal(stepInfo);
    }
  }

  showTierUnlockBanner(newVal, retiredVals) {
    const banner = document.createElement('div');
    banner.className = 'tier-unlock-banner';
    const retiredText = retiredVals && retiredVals.length > 0
      ? `<div class="tier-retired-sub">Cleared ${retiredVals.join(', ')} from the board!</div>`
      : '';
    banner.innerHTML = `
      <div class="tier-unlock-badge">🏆 NEW TIER UNLOCKED</div>
      <div class="tier-unlock-title">${newVal}</div>
      ${retiredText}
    `;
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.classList.add('banner-exit');
      setTimeout(() => banner.remove(), 350);
    }, 1800);
  }

  async animateTierPurge(purgeTargets, tilesCount) {
    if (window.soundSystem) window.soundSystem.playTierPurge();

    // Step 1: Highlight pulse (150ms)
    for (const pt of purgeTargets) {
      const cellEl = this.getCellEl(pt.r, pt.c);
      const tile = cellEl?.querySelector('.tile');
      if (tile) {
        tile.classList.add('tile-purge-highlight');
      }
    }

    await new Promise(r => setTimeout(r, 150));

    // Step 2: Dissolve into empty cells + particles (260ms)
    if (tilesCount >= 6) {
      this.triggerBoardShake('light');
    }

    for (const pt of purgeTargets) {
      const cellEl = this.getCellEl(pt.r, pt.c);
      const tile = cellEl?.querySelector('.tile');
      if (tile) {
        tile.classList.remove('tile-purge-highlight');
        tile.classList.add('tile-purge-dissolve');
      }
      const tileColor = CONFIG.TILE_COLORS[pt.value]?.bg || '#2298f8';
      this.spawnParticleBurst(pt.r, pt.c, 12, tileColor, false);
    }

    await new Promise(r => setTimeout(r, 260));
  }

  styleMiniTile(el, value) {
    if (!el) return;
    el.textContent = value;
    const colorInfo = CONFIG.TILE_COLORS[value] || CONFIG.TILE_COLORS.DEFAULT;
    el.style.backgroundColor = colorInfo.bg;
    el.style.color = colorInfo.text;
    el.style.borderColor = colorInfo.border;
    el.classList.remove('small-text', 'tiny-text');
    if (value >= 10000) {
      el.classList.add('tiny-text');
    } else if (value >= 1000) {
      el.classList.add('small-text');
    }
  }

  updateTierHUD(isUnlockCelebration = false) {
    const minEl = document.getElementById('tier-tile-min');
    const currentEl = document.getElementById('tier-tile-current');
    const goalEl = document.getElementById('tier-tile-goal');
    const fillEl = document.getElementById('tier-track-fill');
    if (!minEl || !currentEl || !goalEl) return;

    const minVal = CONFIG.getValueFromTier ? CONFIG.getValueFromTier(this.board.minActiveTier) : 2;
    const boardMax = this.board.getHighestValueOnBoard ? this.board.getHighestValueOnBoard() : 2;
    // Current highest value on board or achieved in this run (starts at real current, NOT 128!)
    const currentVal = Math.max(minVal, this.board.highestUnlockedValue || 2, boardMax);

    // Goal calculation:
    // If not yet reached Tier 1 milestone (256), the goal is 256.
    // Once 256 or higher is reached, goal becomes currentVal * 2.
    const goalVal = currentVal < 256 ? 256 : currentVal * 2;

    this.styleMiniTile(minEl, minVal);
    this.styleMiniTile(currentEl, currentVal);
    this.styleMiniTile(goalEl, goalVal);

    if (fillEl) {
      if (isUnlockCelebration) {
        // Surge to 100% (reached the goal), pop the goal tile, then settle to 50%
        fillEl.style.width = '100%';
        currentEl.classList.add('tier-milestone-bump');
        goalEl.classList.add('tier-milestone-bump');
        setTimeout(() => {
          fillEl.style.width = '50%';
          currentEl.classList.remove('tier-milestone-bump');
          goalEl.classList.remove('tier-milestone-bump');
        }, 600);
      } else {
        fillEl.style.width = '50%';
      }
    }
  }

  spawnFloatingText(r, c, text) {
    const cellEl = this.getCellEl(r, c);
    if (!cellEl) return;

    const rect = cellEl.getBoundingClientRect();
    const containerRect = this.floatingContainer.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'floating-score';
    popup.textContent = text;
    popup.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
    popup.style.top = `${rect.top - containerRect.top}px`;

    this.floatingContainer.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }

  animateCounter(startVal, endVal, duration, onUpdate) {
    if (startVal === endVal) {
      onUpdate(endVal);
      return null;
    }
    const startTime = performance.now();
    let frameId;

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out curve for fast start and smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * ease);

      onUpdate(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        onUpdate(endVal);
      }
    };

    frameId = requestAnimationFrame(step);
    return frameId;
  }

  updateStats(immediate = false) {
    const targetScore = this.board.score;

    // 1. Current Score count-up rolling animation
    if (immediate || targetScore < this.displayedScore) {
      if (this.scoreAnimFrame) cancelAnimationFrame(this.scoreAnimFrame);
      this.displayedScore = targetScore;
      if (this.scoreValEl) this.scoreValEl.textContent = targetScore.toLocaleString();
    } else if (targetScore > this.displayedScore) {
      if (this.scoreAnimFrame) cancelAnimationFrame(this.scoreAnimFrame);
      const startScore = this.displayedScore;
      const diff = targetScore - startScore;
      const duration = Math.min(800, Math.max(280, Math.sqrt(diff) * 22));

      // Trigger bounce bump animation on score element
      if (this.scoreValEl) {
        this.scoreValEl.classList.remove('score-bump');
        void this.scoreValEl.offsetWidth; // Force CSS reflow
        this.scoreValEl.classList.add('score-bump');
      }

      this.scoreAnimFrame = this.animateCounter(startScore, targetScore, duration, (val) => {
        this.displayedScore = val;
        if (this.scoreValEl) this.scoreValEl.textContent = val.toLocaleString();
      });
    }

    // 2. High Score tracking & count-up animation
    if (this.board.score > this.bestScore) {
      this.bestScore = this.board.score;
      localStorage.setItem('mpp_best_score', this.bestScore.toString());
    }

    const targetBest = this.bestScore;
    if (immediate || targetBest < this.displayedBestScore) {
      if (this.bestAnimFrame) cancelAnimationFrame(this.bestAnimFrame);
      this.displayedBestScore = targetBest;
      if (this.bestValEl) this.bestValEl.textContent = targetBest.toLocaleString();
    } else if (targetBest > this.displayedBestScore) {
      if (this.bestAnimFrame) cancelAnimationFrame(this.bestAnimFrame);
      const startBest = this.displayedBestScore;
      const diff = targetBest - startBest;
      const duration = Math.min(800, Math.max(280, Math.sqrt(diff) * 22));

      const crown = document.querySelector('.crown-icon');
      if (crown) {
        crown.classList.remove('crown-bump');
        void crown.offsetWidth;
        crown.classList.add('crown-bump');
      }

      this.bestAnimFrame = this.animateCounter(startBest, targetBest, duration, (val) => {
        this.displayedBestScore = val;
        if (this.bestValEl) this.bestValEl.textContent = val.toLocaleString();
      });
    } else {
      if (this.bestValEl) this.bestValEl.textContent = this.displayedBestScore.toLocaleString();
    }

    if (window.analyticsTracker) {
      const metrics = window.analyticsTracker.getMetrics();
      if (this.turnsValEl) this.turnsValEl.textContent = metrics.turns;
      if (this.occupancyValEl) this.occupancyValEl.textContent = metrics.currentOccupancy;
    }

    if (this.board.gameMode === 'level') {
      if (this.levelNumDisplay) this.levelNumDisplay.textContent = this.board.currentLevel;
      if (this.movesLeftVal) {
        this.movesLeftVal.textContent = this.board.movesLeft;
        this.movesLeftVal.classList.toggle('moves-low', this.board.movesLeft <= 5);
      }
      if (this.levelScoreVal) {
        this.levelScoreVal.textContent = this.board.score.toLocaleString();
      }
      if (this.levelTargetTile) {
        this.styleMiniTile(this.levelTargetTile, this.board.targetNumber);
      }
    }

    this.updateTierHUD();
  }

  clearHint() {
    if (this.hintTimeout) {
      clearTimeout(this.hintTimeout);
      this.hintTimeout = null;
    }
    document.querySelectorAll('.hint-slot-active').forEach(el => el.classList.remove('hint-slot-active'));
    document.querySelectorAll('.hint-cell-active').forEach(el => el.classList.remove('hint-cell-active'));
  }

  triggerHint() {
    if (this.board.isResolving) return;
    this.clearHint();

    let bestMove = null;
    let maxScore = -1;

    this.trayManager.pieces.forEach((piece, pieceIndex) => {
      if (!piece) return;

      for (let r = -piece.rows + 1; r < this.board.size; r++) {
        for (let c = -piece.cols + 1; c < this.board.size; c++) {
          const valResult = this.board.validatePlacement(piece, r, c);
          if (!valResult.valid) continue;

          const preview = this.board.previewPlacement(piece, r, c);
          let moveScore = 0;

          if (preview.predictedScore > 0) {
            // Priority 1: High scoring merges and chains
            moveScore = preview.predictedScore * 1000 + (preview.predictedMerges.length * 500);
          } else {
            // Priority 2: Adjacent matching values for future combos
            for (const p of preview.placements) {
              const neighbors = [
                { r: p.r - 1, c: p.c },
                { r: p.r + 1, c: p.c },
                { r: p.r, c: p.c - 1 },
                { r: p.r, c: p.c + 1 }
              ];
              for (const n of neighbors) {
                if (this.board.inBounds(n.r, n.c) && this.board.grid[n.r][n.c]?.value === p.value) {
                  moveScore += 50;
                }
              }
            }

            // Priority 3: Keep center open
            const centerDist = Math.abs(r - (this.board.size / 2)) + Math.abs(c - (this.board.size / 2));
            moveScore += centerDist * 2;
          }

          if (moveScore > maxScore) {
            maxScore = moveScore;
            bestMove = { pieceIndex, startR: r, startC: c, piece, preview };
          }
        }
      }
    });

    if (bestMove) {
      // Highlight recommended tray slot
      const slotEl = document.getElementById(`tray-slot-${bestMove.pieceIndex}`);
      if (slotEl) slotEl.classList.add('hint-slot-active');

      // Highlight destination cells on board
      bestMove.piece.cells.forEach(cell => {
        const targetR = bestMove.startR + cell.r;
        const targetC = bestMove.startC + cell.c;
        if (this.board.inBounds(targetR, targetC)) {
          const cellEl = this.getCellEl(targetR, targetC);
          if (cellEl) cellEl.classList.add('hint-cell-active');
        }
      });

      if (window.soundSystem) window.soundSystem.playPick();

      // Auto-clear after 3.5 seconds
      this.hintTimeout = setTimeout(() => this.clearHint(), 3500);
    } else {
      this.triggerGameOver();
    }
  }

  triggerShuffle() {
    if (this.board.isResolving) return;
    this.clearHint();
    this.clearGhostPreview();

    this.trayManager.refill(this.board.grid, this.board.minActiveTier);
    this.renderTray();

    document.querySelectorAll('.tray-piece').forEach(p => {
      p.classList.add('tray-shuffle-anim');
      setTimeout(() => p.classList.remove('tray-shuffle-anim'), 350);
    });

    if (window.soundSystem) window.soundSystem.playMerge(1);
  }

  triggerGameOver() {
    if (window.soundSystem) window.soundSystem.playGameOver();
    const emptyCount = this.board.getEmptyCellCount();
    if (window.analyticsTracker) window.analyticsTracker.recordGameOver(emptyCount);

    const modal = document.getElementById('game-over-modal');
    const finalScoreEl = document.getElementById('final-score-val');
    finalScoreEl.textContent = this.board.score.toLocaleString();

    modal.classList.add('active');
  }

  setGameMode(mode) {
    this.board.gameMode = mode;
    if (mode === 'level') {
      this.tabEndless?.classList.remove('active');
      this.tabLevels?.classList.add('active');
      this.endlessHeaderView?.classList.remove('active');
      this.levelHeaderView?.classList.add('active');
    } else {
      this.tabEndless?.classList.add('active');
      this.tabLevels?.classList.remove('active');
      this.endlessHeaderView?.classList.add('active');
      this.levelHeaderView?.classList.remove('active');
    }
    this.updateStats(true);
  }

  showLevelCompleteModal(info) {
    if (window.soundSystem && window.soundSystem.playTierUnlock) {
      window.soundSystem.playTierUnlock();
    }

    const targetEl = document.getElementById('win-target-number');
    if (targetEl) targetEl.textContent = info.targetNumber;

    const movesEl = document.getElementById('win-moves-left');
    if (movesEl) movesEl.textContent = info.movesLeft;

    const scoreEl = document.getElementById('win-level-score');
    if (scoreEl) scoreEl.textContent = (info.score || 0).toLocaleString();

    // Reset stars visual & trigger staggered pop
    const starsContainer = document.getElementById('level-stars-container');
    if (starsContainer) {
      const stars = starsContainer.querySelectorAll('.star');
      stars.forEach(s => s.classList.remove('earned'));

      const earnedCount = info.stars || 1;
      stars.forEach((star, idx) => {
        if (idx < earnedCount) {
          setTimeout(() => {
            star.classList.add('earned');
            if (window.soundSystem && window.soundSystem.playPick) {
              window.soundSystem.playPick();
            }
          }, 300 + idx * 260);
        }
      });
    }

    if (this.levelCompleteModal) {
      this.levelCompleteModal.classList.add('active');
    }
  }

  showLevelFailedModal(info) {
    if (window.soundSystem && window.soundSystem.playGameOver) {
      window.soundSystem.playGameOver();
    }

    const targetEl = document.getElementById('fail-target-val');
    if (targetEl) {
      targetEl.textContent = info.targetNumber;
      this.styleMiniTile(targetEl, info.targetNumber);
    }

    const scoreEl = document.getElementById('failed-score-val');
    if (scoreEl) scoreEl.textContent = (info.score || 0).toLocaleString();

    const reasonEl = document.getElementById('fail-reason-text');
    if (reasonEl) {
      if (info.reason === 'no_moves') {
        reasonEl.textContent = 'None of the pieces in your tray can fit on the board!';
      } else {
        reasonEl.textContent = 'You ran out of moves before reaching the target!';
      }
    }

    if (this.levelFailedModal) {
      this.levelFailedModal.classList.add('active');
    }
  }

  renderLevelSelectGrid(onSelectLevel) {
    if (!this.levelSelectionGrid) return;
    this.levelSelectionGrid.innerHTML = '';

    const levels = CONFIG.LEVELS_DATA || [];
    levels.forEach(lvl => {
      const isLocked = lvl.level > this.unlockedLevel;
      const isActive = this.board.gameMode === 'level' && this.board.currentLevel === lvl.level;
      const stars = this.levelStars[lvl.level] || 0;

      const card = document.createElement('div');
      card.className = `level-card ${isLocked ? 'locked' : ''} ${isActive ? 'active-level' : ''}`.trim();

      let starDisplay = '';
      if (isLocked) {
        starDisplay = '🔒';
      } else {
        starDisplay = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      }

      card.innerHTML = `
        <div class="level-card-num">${lvl.level}</div>
        <div class="level-card-target">🎯 ${lvl.target}</div>
        <div class="level-card-stars">${starDisplay}</div>
      `;

      if (!isLocked) {
        card.addEventListener('click', () => {
          if (this.levelSelectModal) this.levelSelectModal.classList.remove('active');
          if (typeof onSelectLevel === 'function') {
            onSelectLevel(lvl.level);
          }
        });
      }

      this.levelSelectionGrid.appendChild(card);
    });
  }
}
