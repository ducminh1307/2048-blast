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

  // Start new game
  function startNewGame(boardSize = 8) {
    board.setSize(boardSize);
    board.anchorStrategy = 'chain_seeker';
    if (window.analyticsTracker) window.analyticsTracker.reset();

    trayManager.refill(board.grid, board.minActiveTier);
    ui.renderBoard();
    ui.renderTray();
    ui.updateStats(true);

    // Close any open modals
    document.getElementById('game-over-modal')?.classList.remove('active');
    document.getElementById('settings-modal')?.classList.remove('active');
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
    }
    ui.renderBoard();
    ui.renderTray();
    ui.updateStats(true);
    settingsModal?.classList.remove('active');
  }

  // Initial Game Start
  startNewGame(8);

  // 2. Action Buttons Binding
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
    startNewGame(8);
  });

  document.getElementById('btn-preset-purge')?.addEventListener('click', () => {
    loadTestPreset('tier_purge_ready');
  });

  // Game Over Restart Button
  document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
    startNewGame(8);
  });

  // Expose global game instance for verification & console inspection
  window.game = { board, trayManager, pieceGenerator, ui, startNewGame, loadTestPreset };
});

