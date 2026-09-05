/**
 * Board Logic & Rule Engine
 * Based on GDD v0.1 Section 4, 6, 7, 8, 10, 11, 12
 */

class Board {
  constructor(size = CONFIG.DEFAULT_BOARD_SIZE) {
    this.size = size;
    this.grid = [];
    this.score = 0;
    this.isResolving = false;
    this.history = [];
    this.anchorStrategy = 'chain_seeker'; // 'chain_seeker' (Smart Chain) or 'classic' (Section 10)
    
    // Mode & Level State
    this.gameMode = 'endless'; // 'endless' or 'level'
    this.currentLevel = 1;
    this.targetNumber = 64;
    this.movesLeft = 20;
    this.maxMoves = 20;
    this.isLevelWon = false;
    this.isLevelFailed = false;

    this.initGrid();
    this.initTierState();
  }

  initTierState() {
    this.activeTierCount = CONFIG.ACTIVE_TIER_COUNT || 7;
    this.minActiveTier = 0; // Tier 0 = 2
    this.highestUnlockedTier = 0; // Starts at Tier 0 (Value 2)
    this.highestUnlockedValue = 2; // Dynamic: real current highest number achieved
  }

  loadLevel(levelNum = 1) {
    const levelData = CONFIG.getLevelData(levelNum);
    this.gameMode = 'level';
    this.currentLevel = levelData.level;
    this.targetNumber = levelData.target;
    this.maxMoves = levelData.moves;
    this.movesLeft = levelData.moves;
    this.isLevelWon = false;
    this.isLevelFailed = false;

    this.size = levelData.boardSize || CONFIG.DEFAULT_BOARD_SIZE;
    this.initGrid();
    this.initTierState();
    this.score = 0;
    this.history = [];

    // Load preset tiles for this level
    if (levelData.presetTiles && levelData.presetTiles.length > 0) {
      for (const pt of levelData.presetTiles) {
        if (this.inBounds(pt.r, pt.c)) {
          this.grid[pt.r][pt.c] = {
            value: pt.value,
            id: 'tile_' + Math.random().toString(36).substr(2, 7),
            isWildcard: !!pt.isWildcard,
            multiplier: pt.multiplier || 1
          };
        }
      }
    }

    const maxVal = this.getHighestValueOnBoard();
    if (maxVal > this.highestUnlockedValue) {
      this.highestUnlockedValue = maxVal;
      this.highestUnlockedTier = CONFIG.getTierFromValue ? CONFIG.getTierFromValue(maxVal) : 0;
    }
  }

  calculateLevelStars() {
    if (!this.isLevelWon) return 0;
    const ratio = this.movesLeft / this.maxMoves;
    if (ratio >= 0.35) return 3;
    if (ratio >= 0.15) return 2;
    return 1;
  }

  getHighestValueOnBoard() {
    let maxVal = 2;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] && typeof this.grid[r][c].value === 'number' && this.grid[r][c].value > maxVal) {
          maxVal = this.grid[r][c].value;
        }
      }
    }
    return maxVal;
  }

  initGrid() {
    this.grid = [];
    for (let r = 0; r < this.size; r++) {
      const row = [];
      for (let c = 0; c < this.size; c++) {
        row.push(null);
      }
      this.grid.push(row);
    }
  }

  setSize(newSize) {
    this.size = newSize;
    this.initGrid();
    this.initTierState();
    this.score = 0;
    this.history = [];
  }

  cloneGrid(grid = this.grid) {
    return grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
  }

  saveSnapshot() {
    this.history.push({
      grid: this.cloneGrid(),
      score: this.score,
      minActiveTier: this.minActiveTier,
      highestUnlockedTier: this.highestUnlockedTier,
      highestUnlockedValue: this.highestUnlockedValue,
      movesLeft: this.movesLeft,
      isLevelWon: this.isLevelWon,
      isLevelFailed: this.isLevelFailed
    });
    if (this.history.length > 20) {
      this.history.shift();
    }
  }

  undo() {
    if (this.history.length > 0 && !this.isResolving) {
      const snapshot = this.history.pop();
      this.grid = snapshot.grid;
      this.score = snapshot.score;
      if (snapshot.minActiveTier !== undefined) {
        this.minActiveTier = snapshot.minActiveTier;
        this.highestUnlockedTier = snapshot.highestUnlockedTier;
        this.highestUnlockedValue = snapshot.highestUnlockedValue;
      }
      if (snapshot.movesLeft !== undefined) {
        this.movesLeft = snapshot.movesLeft;
        this.isLevelWon = snapshot.isLevelWon;
        this.isLevelFailed = snapshot.isLevelFailed;
      }
      return true;
    }
    return false;
  }

  // Check if coordinates are within board bounds
  inBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  // Get current occupancy ratio (0.0 to 1.0)
  getOccupancyRatio() {
    let occupied = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== null) occupied++;
      }
    }
    return occupied / (this.size * this.size);
  }

  getEmptyCellCount() {
    let empty = 0;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === null) empty++;
      }
    }
    return empty;
  }

  /**
   * Validate Placement Rules (Section 6)
   * EMPTY -> Legal (place)
   * OCCUPIED (any number) -> Illegal (blocked)
   */
  validatePlacement(piece, startR, startC, targetGrid = this.grid) {
    const cellResults = [];
    let isValid = true;
    let emptyCount = 0;

    for (const cell of piece.cells) {
      const br = startR + cell.r;
      const bc = startC + cell.c;

      if (!this.inBounds(br, bc)) {
        isValid = false;
        cellResults.push({
          r: cell.r,
          c: cell.c,
          br,
          bc,
          value: cell.value,
          status: 'out_of_bounds'
        });
        continue;
      }

      const boardCell = targetGrid[br][bc];
      if (boardCell === null) {
        // Empty cell -> legal normal placement
        emptyCount++;
        cellResults.push({
          r: cell.r,
          c: cell.c,
          br,
          bc,
          value: cell.value,
          isWildcard: !!cell.isWildcard,
          multiplier: cell.multiplier || 1,
          status: 'empty'
        });
      } else {
        // Occupied cell -> blocked
        isValid = false;
        cellResults.push({
          r: cell.r,
          c: cell.c,
          br,
          bc,
          value: cell.value,
          boardValue: boardCell.value,
          isWildcard: !!cell.isWildcard,
          multiplier: cell.multiplier || 1,
          status: 'blocked'
        });
      }
    }

    return {
      valid: isValid,
      cellResults,
      emptyCount,
      startR,
      startC
    };
  }

  /**
   * Check 4-directional connected components containing active cells.
   * Supports Special Tiles:
   * - Wildcard (★): adopts neighbor number to join active group (Smart Selection if touching multiple values)
   * - 2x Booster: multiplies merge result value by 2x
   */
  findActivatedGroups(targetGrid, activeCoordSet) {
    const wildcardClusters = [];
    const visitedWildcards = new Set();
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = targetGrid[r][c];
        const key = `${r},${c}`;
        if (cell && (cell.isWildcard || cell.value === '★') && !visitedWildcards.has(key)) {
          const cluster = [];
          const q = [[r, c]];
          visitedWildcards.add(key);

          while (q.length > 0) {
            const [cr, cc] = q.shift();
            cluster.push({ r: cr, c: cc, cell: targetGrid[cr][cc] });

            for (const [dr, dc] of dirs) {
              const nr = cr + dr;
              const nc = cc + dc;
              const nKey = `${nr},${nc}`;
              if (this.inBounds(nr, nc) && !visitedWildcards.has(nKey)) {
                const nCell = targetGrid[nr][nc];
                if (nCell && (nCell.isWildcard || nCell.value === '★')) {
                  visitedWildcards.add(nKey);
                  q.push([nr, nc]);
                }
              }
            }
          }
          wildcardClusters.push(cluster);
        }
      }
    }

    // Fast path: No wildcards on board
    if (wildcardClusters.length === 0) {
      return this._findStandardGroups(targetGrid, activeCoordSet);
    }

    // Clone grid to prepare effectiveGrid
    const effectiveGrid = this.cloneGrid(targetGrid);

    // For each wildcard cluster, determine candidate numbers from its orthogonal neighbors
    for (const cluster of wildcardClusters) {
      const neighborValues = new Set();

      for (const w of cluster) {
        for (const [dr, dc] of dirs) {
          const nr = w.r + dr;
          const nc = w.c + dc;
          if (this.inBounds(nr, nc)) {
            const nCell = targetGrid[nr][nc];
            if (nCell && typeof nCell.value === 'number') {
              neighborValues.add(nCell.value);
            }
          }
        }
      }

      if (neighborValues.size === 0) {
        // No number neighbors, remains wildcard
        continue;
      }

      // Evaluate each candidate value to find the smartest choice (highest merge result/tier)
      let bestVal = null;
      let bestScore = -1;

      for (const candVal of neighborValues) {
        const testGrid = this.cloneGrid(targetGrid);
        for (const w of cluster) {
          testGrid[w.r][w.c] = {
            ...w.cell,
            value: candVal,
            isWildcard: true
          };
        }

        const candGroups = this._findStandardGroups(testGrid, activeCoordSet);
        const clusterCoordKeys = new Set(cluster.map(w => `${w.r},${w.c}`));
        const matchingGroup = candGroups.find(g => g.cells.some(c => clusterCoordKeys.has(`${c.r},${c.c}`)));

        if (matchingGroup) {
          const resultVal = this.calculateMergeResult(matchingGroup.value, matchingGroup.count, matchingGroup.totalMultiplier || 1);
          const score = resultVal * CONFIG.getGroupMultiplier(matchingGroup.count);
          if (score > bestScore || (score === bestScore && candVal > (bestVal || 0))) {
            bestScore = score;
            bestVal = candVal;
          }
        }
      }

      if (bestVal !== null) {
        for (const w of cluster) {
          effectiveGrid[w.r][w.c] = {
            ...w.cell,
            value: bestVal,
            isWildcard: true
          };
        }
      }
    }

    return this._findStandardGroups(effectiveGrid, activeCoordSet);
  }

  _findStandardGroups(targetGrid, activeCoordSet) {
    const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    const qualifyingGroups = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (visited[r][c] || !targetGrid[r][c]) continue;

        const rootCell = targetGrid[r][c];
        if (rootCell.value === '★') continue; // Unmatched wildcard stays idle

        const groupVal = rootCell.value;
        const groupCells = [];
        let containsActive = false;
        let totalMultiplier = 1;
        let hasWildcard = false;
        let hasBooster = false;

        const queue = [[r, c]];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [currR, currC] = queue.shift();
          const cellObj = targetGrid[currR][currC];
          const mult = cellObj.multiplier || 1;
          if (mult > 1) {
            totalMultiplier *= mult;
            hasBooster = true;
          }
          if (cellObj.isWildcard) {
            hasWildcard = true;
          }

          groupCells.push({
            r: currR,
            c: currC,
            value: groupVal,
            multiplier: mult,
            isWildcard: !!cellObj.isWildcard
          });

          const key = `${currR},${currC}`;
          if (activeCoordSet.has(key)) {
            containsActive = true;
          }

          for (const [dr, dc] of dirs) {
            const nr = currR + dr;
            const nc = currC + dc;
            if (this.inBounds(nr, nc) && !visited[nr][nc]) {
              const neighbor = targetGrid[nr][nc];
              if (neighbor && neighbor.value === groupVal) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
              }
            }
          }
        }

        // Must contain at least 2 cells AND at least one active cell from current action/chain
        if (groupCells.length >= 2 && containsActive) {
          qualifyingGroups.push({
            value: groupVal,
            cells: groupCells,
            count: groupCells.length,
            totalMultiplier,
            hasWildcard,
            hasBooster
          });
        }
      }
    }

    return qualifyingGroups;
  }

  /**
   * Determine merge result anchor position (Section 10 & Smart Chain-Seeking)
   * If anchorStrategy is 'chain_seeker':
   *   1. If one or more positions in the group allow the result tile to immediately connect
   *      with tiles of the same value outside the group, prioritize the position creating the largest connection.
   *   2. If there is no immediate chain, the result appears at the Active Cell.
   * If anchorStrategy is 'classic':
   *   1. Active cell if in group
   *   2. Deterministic first cell
   */
  selectAnchor(groupCells, activeCoords, targetGrid = null, resultVal = null) {
    if (this.anchorStrategy === 'chain_seeker' && targetGrid && resultVal !== null) {
      const groupCoordSet = new Set(groupCells.map(c => `${c.r},${c.c}`));
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      let bestChainCandidate = null;
      let maxChainSize = 0;

      for (const cand of groupCells) {
        let chainGroupSize = 0;

        // Find connected components of value === resultVal outside the merging group
        const visitedExt = new Set();
        for (const [dr, dc] of dirs) {
          const nr = cand.r + dr;
          const nc = cand.c + dc;
          if (this.inBounds(nr, nc)) {
            const key = `${nr},${nc}`;
            if (!groupCoordSet.has(key)) {
              const neighbor = targetGrid[nr][nc];
              if (neighbor && neighbor.value === resultVal && !visitedExt.has(key)) {
                // BFS flood-fill to measure size of the external matching cluster
                const q = [[nr, nc]];
                visitedExt.add(key);
                let clusterCount = 0;

                while (q.length > 0) {
                  const [cr, cc] = q.shift();
                  clusterCount++;
                  for (const [fdr, fdc] of dirs) {
                    const fnr = cr + fdr;
                    const fnc = cc + fdc;
                    const fKey = `${fnr},${fnc}`;
                    if (this.inBounds(fnr, fnc) && !visitedExt.has(fKey) && !groupCoordSet.has(fKey)) {
                      const fNeighbor = targetGrid[fnr][fnc];
                      if (fNeighbor && fNeighbor.value === resultVal) {
                        visitedExt.add(fKey);
                        q.push([fnr, fnc]);
                      }
                    }
                  }
                }
                chainGroupSize += clusterCount;
              }
            }
          }
        }

        // If this position allows immediate connection with tiles of value resultVal outside the group
        if (chainGroupSize > 0) {
          const candKey = `${cand.r},${cand.c}`;
          const isCandActive = activeCoords && activeCoords.has(candKey);
          const bestIsActive = bestChainCandidate && activeCoords && activeCoords.has(`${bestChainCandidate.r},${bestChainCandidate.c}`);

          // Prioritize position creating largest connection; tie-break with active cell
          if (chainGroupSize > maxChainSize ||
             (chainGroupSize === maxChainSize && isCandActive && !bestIsActive)) {
            maxChainSize = chainGroupSize;
            bestChainCandidate = cand;
          }
        }
      }

      // If an immediate chain connection exists, return the best candidate
      if (bestChainCandidate) {
        return bestChainCandidate;
      }
    }

    // If no immediate chain (or classic mode): Result appears at the Active Cell
    for (const cell of groupCells) {
      const key = `${cell.r},${cell.c}`;
      if (activeCoords && activeCoords.has(key)) {
        return cell;
      }
    }

    // Deterministic fallback
    return groupCells[0];
  }

  /**
   * Calculate Multi-Tile Merge result (Section 8)
   * Result = Value * 2^(Count - 1) * multiplier
   */
  calculateMergeResult(value, count, multiplier = 1) {
    return value * Math.pow(2, count - 1) * (multiplier || 1);
  }

  /**
   * Virtual simulation for Ghost Preview (Section 24)
   */
  previewPlacement(piece, startR, startC) {
    const valResult = this.validatePlacement(piece, startR, startC);
    if (!valResult.valid) {
      return {
        valid: false,
        validation: valResult
      };
    }

    // Clone grid to simulate outcome
    const simGrid = this.cloneGrid();
    const activeCoords = new Set();
    const placements = [];

    // Simulate Step 1: Placement onto empty cells
    for (const cr of valResult.cellResults) {
      const key = `${cr.br},${cr.bc}`;
      activeCoords.add(key);
      simGrid[cr.br][cr.bc] = {
        value: cr.value,
        isWildcard: !!cr.isWildcard,
        multiplier: cr.multiplier || 1
      };
      placements.push({
        r: cr.br,
        c: cr.bc,
        value: cr.value,
        isWildcard: !!cr.isWildcard,
        multiplier: cr.multiplier || 1
      });
    }

    // Simulate Step 2: Group merges & chains
    let simWave = 1;
    let simActive = new Set(activeCoords);
    let simScore = 0;
    const allMergingCells = new Set();
    const predictedMerges = [];

    while (simActive.size > 0) {
      const groups = this.findActivatedGroups(simGrid, simActive);
      if (groups.length === 0) break;

      const nextActive = new Set();
      for (const group of groups) {
        const resultVal = this.calculateMergeResult(group.value, group.count, group.totalMultiplier || 1);
        const anchor = this.selectAnchor(group.cells, simActive, simGrid, resultVal);

        group.cells.forEach(c => {
          allMergingCells.add(`${c.r},${c.c}`);
          simGrid[c.r][c.c] = null;
        });

        simGrid[anchor.r][anchor.c] = { value: resultVal };
        const anchorKey = `${anchor.r},${anchor.c}`;
        nextActive.add(anchorKey);

        const groupMult = CONFIG.getGroupMultiplier(group.count);
        const chainMult = CONFIG.getChainMultiplier(simWave);
        simScore += Math.round(resultVal * groupMult * chainMult);

        predictedMerges.push({
          wave: simWave,
          count: group.count,
          value: group.value,
          resultVal,
          multiplier: group.totalMultiplier || 1,
          hasWildcard: !!group.hasWildcard,
          hasBooster: !!group.hasBooster,
          anchor: { r: anchor.r, c: anchor.c }
        });
      }

      simActive = nextActive;
      simWave++;
    }

    return {
      valid: true,
      validation: valResult,
      placements,
      mergingCells: Array.from(allMergingCells).map(k => {
        const [r, c] = k.split(',').map(Number);
        return { r, c };
      }),
      predictedMerges,
      predictedScore: simScore,
      predictedChains: Math.max(0, simWave - 2)
    };
  }

  /**
   * Execute placement with visual wave resolution (Section 3, 7, 8, 11)
   */
  async executePlacement(piece, startR, startC, onStep, animSpeed = 'normal') {
    const valResult = this.validatePlacement(piece, startR, startC);
    if (!valResult.valid) {
      if (window.soundSystem) window.soundSystem.playInvalid();
      if (window.analyticsTracker) window.analyticsTracker.recordInvalidDrop();
      return false;
    }

    this.isResolving = true;
    this.saveSnapshot();

    if (this.gameMode === 'level') {
      this.movesLeft = Math.max(0, this.movesLeft - 1);
    }

    const delayMs = CONFIG.ANIMATION_SPEEDS[animSpeed] || CONFIG.ANIMATION_SPEEDS.normal;
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const activeCoords = new Set();

    // Step 1: Place piece cells onto empty board
    for (const cr of valResult.cellResults) {
      const key = `${cr.br},${cr.bc}`;
      activeCoords.add(key);
      this.grid[cr.br][cr.bc] = {
        value: cr.value,
        id: 'tile_' + Math.random().toString(36).substr(2, 7),
        isNewlyPlaced: true,
        isWildcard: !!cr.isWildcard,
        multiplier: cr.multiplier || 1
      };
      if (typeof cr.value === 'number' && cr.value > this.highestUnlockedValue) {
        this.highestUnlockedValue = cr.value;
        this.highestUnlockedTier = CONFIG.getTierFromValue ? CONFIG.getTierFromValue(cr.value) : 0;
      }
    }

    if (window.soundSystem) window.soundSystem.playPlace();

    if (window.analyticsTracker) {
      window.analyticsTracker.recordTurn(
        valResult.emptyCount,
        this.getOccupancyRatio()
      );
      window.analyticsTracker.recordScore(this.score);
    }

    if (onStep) {
      onStep({
        phase: 'placed',
        grid: this.cloneGrid(),
        score: this.score,
        activeCoords: Array.from(activeCoords)
      });
    }

    await sleep(delayMs);

    // Step 2: Iterative group merges and chain waves
    let currentActive = new Set(activeCoords);
    let wave = 1;
    const formedValues = [];

    while (currentActive.size > 0) {
      const qualifyingGroups = this.findActivatedGroups(this.grid, currentActive);
      if (qualifyingGroups.length === 0) break;

      const nextActive = new Set();
      const waveResults = [];

      for (const group of qualifyingGroups) {
        const resultVal = this.calculateMergeResult(group.value, group.count, group.totalMultiplier || 1);
        const anchor = this.selectAnchor(group.cells, currentActive, this.grid, resultVal);
        formedValues.push(resultVal);

        // Calculate score
        const groupMult = CONFIG.getGroupMultiplier(group.count);
        const chainMult = CONFIG.getChainMultiplier(wave);
        const earnedScore = Math.round(resultVal * groupMult * chainMult);
        this.score += earnedScore;

        if (window.analyticsTracker) {
          window.analyticsTracker.recordMerge(group.count, resultVal, wave);
          window.analyticsTracker.recordScore(this.score);
        }

        waveResults.push({
          anchor,
          resultVal,
          earnedScore,
          count: group.count,
          cells: group.cells,
          value: group.value,
          multiplier: group.totalMultiplier || 1,
          hasWildcard: !!group.hasWildcard,
          hasBooster: !!group.hasBooster
        });
      }

      const maxCount = Math.max(...waveResults.map(w => w.count));
      const isBigMerge = maxCount >= 4;

      // Phase 1: Inward Collapse / Anticipation
      if (onStep) {
        await onStep({
          phase: 'wave_collapse',
          wave,
          waveResults,
          isBigMerge,
          maxCount
        });
      } else {
        await sleep(delayMs);
      }

      // Execute board collapse for this wave
      for (const wr of waveResults) {
        // Clear non-anchor cells
        for (const c of wr.cells) {
          if (c.r !== wr.anchor.r || c.c !== wr.anchor.c) {
            this.grid[c.r][c.c] = null;
          }
        }
        // Set anchor cell to result
        this.grid[wr.anchor.r][wr.anchor.c] = {
          value: wr.resultVal,
          id: 'tile_' + Math.random().toString(36).substr(2, 7),
          isMerged: true
        };
        const anchorKey = `${wr.anchor.r},${wr.anchor.c}`;
        nextActive.add(anchorKey);
      }

      // Phase 2: Impact Frame (Result Tile Appears, Pop, Board Shake, SFX, Particles, Settle)
      if (onStep) {
        await onStep({
          phase: 'wave_resolved',
          wave,
          waveResults,
          grid: this.cloneGrid(),
          score: this.score,
          isBigMerge,
          maxCount
        });
      } else {
        await sleep(delayMs);
      }

      currentActive = nextActive;
      wave++;
    }

    // Clean flags
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c]) {
          delete this.grid[r][c].isDirectMerge;
          delete this.grid[r][c].isNewlyPlaced;
          delete this.grid[r][c].isMerged;
        }
      }
    }

    // Step 3: Check New Highest Tier & Tier Purge (Section 39 GDD)
    // Critical Invariant (Section 39.8): Resolves strictly after merge chain finishes completely
    if (formedValues.length > 0) {
      const maxValFormed = Math.max(...formedValues);
      if (maxValFormed > this.highestUnlockedValue) {
        const oldHighestVal = this.highestUnlockedValue;
        const newHighestTier = CONFIG.getTierFromValue(maxValFormed);
        this.highestUnlockedTier = newHighestTier;
        this.highestUnlockedValue = maxValFormed;

        // Calculate Window Slide (Section 39.3, 39.5, 39.23)
        const newMinTier = Math.max(0, this.highestUnlockedTier - this.activeTierCount + 1);
        const hasPurge = newMinTier > this.minActiveTier;
        const retiredTiers = [];
        const retiredValues = [];

        if (hasPurge) {
          for (let t = this.minActiveTier; t < newMinTier; t++) {
            retiredTiers.push(t);
            retiredValues.push(CONFIG.getValueFromTier(t));
          }
          this.minActiveTier = newMinTier;
        }

        // Notify UI of Tier Unlock
        if (onStep) {
          await onStep({
            phase: 'tier_unlock',
            newHighestValue: this.highestUnlockedValue,
            newHighestTier: this.highestUnlockedTier,
            oldHighestValue: oldHighestVal,
            hasPurge,
            retiredValues,
            minActiveTier: this.minActiveTier
          });
        }

        // Tier Purge Execution (Section 39.6, 39.10, 39.25)
        if (hasPurge && retiredValues.length > 0) {
          const purgeTargets = [];
          const retiredSet = new Set(retiredValues);
          for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
              if (this.grid[r][c] && retiredSet.has(this.grid[r][c].value)) {
                purgeTargets.push({ r, c, value: this.grid[r][c].value });
              }
            }
          }

          if (purgeTargets.length > 0) {
            // Visual highlight & dissolution
            if (onStep) {
              await onStep({
                phase: 'tier_purge',
                purgeTargets,
                retiredValues,
                tilesCount: purgeTargets.length
              });
            } else {
              await sleep(delayMs);
            }

            // Evacuate targets cleanly to null (EMPTY)
            for (const pt of purgeTargets) {
              this.grid[pt.r][pt.c] = null;
            }

            if (onStep) {
              await onStep({
                phase: 'tier_purge_complete',
                grid: this.cloneGrid(),
                retiredValues,
                tilesCount: purgeTargets.length
              });
            }
          }
        }
      }
    }

    // Step 4: Level Mode Win / Loss Evaluation
    if (this.gameMode === 'level') {
      const highestOnBoard = this.getHighestValueOnBoard();
      if (!this.isLevelWon && highestOnBoard >= this.targetNumber) {
        this.isLevelWon = true;
        if (onStep) {
          await onStep({
            phase: 'level_won',
            level: this.currentLevel,
            targetNumber: this.targetNumber,
            highestAchieved: highestOnBoard,
            movesLeft: this.movesLeft,
            maxMoves: this.maxMoves,
            stars: this.calculateLevelStars(),
            score: this.score
          });
        }
      } else if (!this.isLevelWon && this.movesLeft <= 0) {
        this.isLevelFailed = true;
        if (onStep) {
          await onStep({
            phase: 'level_failed',
            level: this.currentLevel,
            targetNumber: this.targetNumber,
            reason: 'out_of_moves',
            score: this.score
          });
        }
      }
    }

    this.isResolving = false;
    return true;
  }

  /**
   * Game Over Check (Section 19)
   * Run ends when none of the remaining pieces has ANY legal placement on the board.
   * Considers open EMPTY cells on the board.
   */
  checkGameOver(pieces) {
    const activePieces = pieces.filter(p => p !== null);
    if (activePieces.length === 0) return false;

    for (const piece of activePieces) {
      for (let r = 0; r <= this.size - piece.rows; r++) {
        for (let c = 0; c <= this.size - piece.cols; c++) {
          if (this.validatePlacement(piece, r, c).valid) {
            return false; // Found a legal move!
          }
        }
      }
    }

    // No legal placement anywhere
    return true;
  }

  /**
   * Load standard GDD test presets for quick scenario evaluation
   */
  loadPreset(presetId) {
    this.initGrid();
    this.score = 0;
    this.history = [];

    switch (presetId) {
      case 'stable_groups':
        // GDD Section 13: 2 2 . . 4 4 (should remain stable)
        this.grid[3][0] = { value: 2 };
        this.grid[3][1] = { value: 2 };
        this.grid[3][4] = { value: 4 };
        this.grid[3][5] = { value: 4 };
        break;

      case 'triple_merge':
        // GDD Section 14: 2 2 .
        this.grid[3][2] = { value: 2 };
        this.grid[3][3] = { value: 2 };
        break;

      case 'adjacency_demo':
        // GDD Section 15: . 2 . .
        this.grid[3][3] = { value: 2 };
        break;

      case 'chain_reaction':
        // GDD Section 16:
        // . 2 . .
        // . . 4 4
        // Placing a 2 next to the 2 merges into 4, which touches the 4 4 and chains into 16!
        this.grid[2][2] = { value: 2 };
        this.grid[3][3] = { value: 4 };
        this.grid[3][4] = { value: 4 };
        break;

      case 'crowded_board':
        // Almost full board with scattered numbers to test space pressure & game over
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            if ((r + c) % 3 !== 0) {
              const val = [2, 4, 8][(r * 2 + c) % 3];
              this.grid[r][c] = { value: val };
            }
          }
        }
        break;

      case 'tier_purge_ready':
        // GDD Section 39: Test Tier Purge when unlocking 256 (Clears all 2s)
        this.initTierState();
        this.grid[3][3] = { value: 128 };
        // Scatter some 2s across the board to be purged
        this.grid[1][1] = { value: 2 };
        this.grid[1][5] = { value: 2 };
        this.grid[5][2] = { value: 2 };
        this.grid[5][6] = { value: 2 };
        this.grid[2][4] = { value: 4 };
        this.grid[4][1] = { value: 8 };
        this.highestUnlockedValue = 128;
        this.highestUnlockedTier = CONFIG.getTierFromValue ? CONFIG.getTierFromValue(128) : 6;
        break;

      case 'preset_wildcard':
        // Test Wildcard Star: place 4 at (3,2) and 8 at (3,4)
        this.initTierState();
        this.grid[3][2] = { value: 4 };
        this.grid[3][4] = { value: 8 };
        break;

      case 'preset_booster_2x':
        // Test 2x Booster: place 4 at (3,2)
        this.initTierState();
        this.grid[3][2] = { value: 4 };
        break;
    }

    // Synchronize highest value with loaded board state
    const maxValOnBoard = this.getHighestValueOnBoard();
    if (maxValOnBoard > this.highestUnlockedValue) {
      this.highestUnlockedValue = maxValOnBoard;
      this.highestUnlockedTier = CONFIG.getTierFromValue ? CONFIG.getTierFromValue(maxValOnBoard) : 0;
    }
  }
}
