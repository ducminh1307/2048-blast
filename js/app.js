/**
 * App Entry Point & Controller
 * Clean controller for 8x8 Board, Normal Speed, Smart Chain, Hint & Shuffle
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize core game systems
  const pieceGenerator = new PieceGenerator();
  pieceGenerator.useSmartGeneration = true;

  const trayManager = new TrayManager(pieceGenerator);
  const board = new Board(CONFIG.DEFAULT_BOARD_SIZE); // 8x8 Board
  board.anchorStrategy = 'chain_seeker'; // Smart Chain by default

  const ui = new UIManager(board, trayManager);

  // Setup analytics change listener
  if (window.analyticsTracker) {
    window.analyticsTracker.onChange(() => {
      ui.updateStats();
    });
  }

  // Start new game (Endless)
  function startNewGame(boardSize = 8) {
    board.setSize(boardSize);
    board.anchorStrategy = 'chain_seeker';
    ui.setGameMode('endless');
    if (window.analyticsTracker) window.analyticsTracker.reset();

    trayManager.refill(board.grid, board.minActiveTier);
    ui.renderBoard();
    ui.renderTray();
    ui.updateStats(true);

    // Close any open modals
    document.getElementById('game-over-modal')?.classList.remove('active');
    document.getElementById('settings-modal')?.classList.remove('active');
    document.getElementById('level-complete-modal')?.classList.remove('active');
    document.getElementById('level-failed-modal')?.classList.remove('active');
    document.getElementById('level-select-modal')?.classList.remove('active');
  }

  // Start specific level
  function startLevel(levelNum = 1) {
    board.loadLevel(levelNum);
    ui.setGameMode('level');
    if (window.analyticsTracker) window.analyticsTracker.reset();

    trayManager.refill(board.grid, board.minActiveTier);
    ui.renderBoard();
    ui.renderTray();
    ui.updateStats(true);

    // Close any open modals
    document.getElementById('game-over-modal')?.classList.remove('active');
    document.getElementById('settings-modal')?.classList.remove('active');
    document.getElementById('level-complete-modal')?.classList.remove('active');
    document.getElementById('level-failed-modal')?.classList.remove('active');
    document.getElementById('level-select-modal')?.classList.remove('active');
  }

  function loadTestPreset(presetId) {
    board.loadPreset(presetId);
    if (presetId === 'tier_purge_ready') {
      // Provide a piece that has value 128 to drop directly adjacent to (3,3)
      trayManager.pieces = [
        {
          id: 'p_test_128',
          shapeId: 'single',
          name: '1-Cell Dot (128)',
          rows: 1,
          cols: 1,
          cells: [{ r: 0, c: 0, value: 128 }]
        },
        null,
        null
      ];
      trayManager.notify();
    } else if (presetId === 'preset_wildcard') {
      trayManager.pieces = [
        {
          id: 'p_test_wildcard',
          shapeId: 'single',
          name: '1-Cell Star (★)',
          rows: 1,
          cols: 1,
          cells: [{ r: 0, c: 0, value: '★', isWildcard: true, multiplier: 1 }]
        },
        null,
        null
      ];
      trayManager.notify();
    } else if (presetId === 'preset_booster_2x') {
      trayManager.pieces = [
        {
          id: 'p_test_booster',
          shapeId: 'single',
          name: '1-Cell Booster (4 [2×])',
          rows: 1,
          cols: 1,
          cells: [{ r: 0, c: 0, value: 4, isWildcard: false, multiplier: 2 }]
        },
        null,
        null
      ];
      trayManager.notify();
    }
    ui.renderBoard();
    ui.renderTray();
    ui.updateStats(true);
    settingsModal?.classList.remove('active');
  }

  // Initial Game Start (Endless)
  startNewGame(8);

  // Mode Switcher Tabs
  document.getElementById('tab-endless')?.addEventListener('click', () => {
    if (board.gameMode !== 'endless') {
      startNewGame(CONFIG.DEFAULT_BOARD_SIZE);
    }
  });

  document.getElementById('tab-levels')?.addEventListener('click', () => {
    if (board.gameMode !== 'level') {
      startLevel(ui.unlockedLevel || 1);
    }
  });

  // Level Select Modal Controls
  const levelSelectModal = document.getElementById('level-select-modal');
  document.getElementById('btn-level-select')?.addEventListener('click', () => {
    ui.renderLevelSelectGrid((lvl) => startLevel(lvl));
    levelSelectModal?.classList.add('active');
  });

  document.getElementById('close-level-select-btn')?.addEventListener('click', () => {
    levelSelectModal?.classList.remove('active');
  });

  levelSelectModal?.addEventListener('click', (e) => {
    if (e.target === levelSelectModal) {
      levelSelectModal.classList.remove('active');
    }
  });

  // Level Complete Modal Controls
  document.getElementById('btn-next-level')?.addEventListener('click', () => {
    const nextLvl = board.currentLevel + 1;
    const maxLvl = CONFIG.LEVELS_DATA ? CONFIG.LEVELS_DATA.length : 10;
    if (nextLvl <= maxLvl) {
      startLevel(nextLvl);
    } else {
      document.getElementById('level-complete-modal')?.classList.remove('active');
      ui.renderLevelSelectGrid((lvl) => startLevel(lvl));
      levelSelectModal?.classList.add('active');
    }
  });

  // Level Failed Modal Controls
  document.getElementById('btn-retry-level')?.addEventListener('click', () => {
    startLevel(board.currentLevel);
  });

  document.getElementById('btn-failed-level-select')?.addEventListener('click', () => {
    document.getElementById('level-failed-modal')?.classList.remove('active');
    ui.renderLevelSelectGrid((lvl) => startLevel(lvl));
    levelSelectModal?.classList.add('active');
  });

  // Action Buttons Binding
  document.getElementById('btn-hint')?.addEventListener('click', () => {
    ui.triggerHint();
  });

  document.getElementById('btn-shuffle')?.addEventListener('click', () => {
    ui.triggerShuffle();
  });

  // Settings Modal Controls
  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    settingsModal?.classList.add('active');
  });

  document.getElementById('btn-settings-level')?.addEventListener('click', () => {
    settingsModal?.classList.add('active');
  });

  document.getElementById('close-settings-btn')?.addEventListener('click', () => {
    settingsModal?.classList.remove('active');
  });

  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  });

  document.getElementById('btn-toggle-sound')?.addEventListener('click', () => {
    if (window.soundSystem) {
      const isMuted = window.soundSystem.toggleMute();
      const iconEl = document.getElementById('sound-status-icon');
      const textEl = document.getElementById('sound-status-text');
      if (iconEl) iconEl.textContent = isMuted ? '🔇' : '🔊';
      if (textEl) textEl.textContent = isMuted ? 'Sound: OFF' : 'Sound: ON';
    }
  });

  document.getElementById('btn-modal-restart')?.addEventListener('click', () => {
    settingsModal?.classList.remove('active');
    if (board.gameMode === 'level') {
      startLevel(board.currentLevel);
    } else {
      startNewGame(8);
    }
  });

  document.getElementById('btn-preset-purge')?.addEventListener('click', () => {
    loadTestPreset('tier_purge_ready');
  });

  document.getElementById('btn-preset-wildcard')?.addEventListener('click', () => {
    loadTestPreset('preset_wildcard');
  });

  document.getElementById('btn-preset-booster')?.addEventListener('click', () => {
    loadTestPreset('preset_booster_2x');
  });

  // Game Over Restart Button (Endless)
  document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
    startNewGame(8);
  });

  // Expose global game instance for verification & console inspection
  window.game = { board, trayManager, pieceGenerator, ui, startNewGame, startLevel, loadTestPreset };
});

