/**
 * Merge Placement Puzzle - Configuration & Constants
 * Based on GDD v0.1
 */

const CONFIG = {
  DEFAULT_BOARD_SIZE: 8,
  MIN_BOARD_SIZE: 6,
  MAX_BOARD_SIZE: 8,

  TRAY_SIZE: 3,

  // Number Tier System (Section 39 GDD)
  ACTIVE_TIER_COUNT: 7,
  INITIAL_HIGHEST_VALUE: 128,

  getTierFromValue(val) {
    return Math.round(Math.log2(Math.max(2, val))) - 1;
  },

  getValueFromTier(tier) {
    return Math.pow(2, tier + 1);
  },

  // Dynamic spawn values based on current min active tier (Section 39.12, 39.13)
  // Window Base Offset: generates pieces containing 3 base values starting at minActiveTier
  getSpawnValues(minActiveTier = 0) {
    const v1 = this.getValueFromTier(minActiveTier);
    const v2 = this.getValueFromTier(minActiveTier + 1);
    const v3 = this.getValueFromTier(minActiveTier + 2);
    return [
      { value: v1, weight: 65 },
      { value: v2, weight: 30 },
      { value: v3, weight: 5 }
    ];
  },

  // Numbers spawn probabilities (Section 21)
  // Initially dominated by 2 and 4, occasionally 8
  SPAWN_VALUES: [
    { value: 2, weight: 65 },
    { value: 4, weight: 30 },
    { value: 8, weight: 5 }
  ],


  // Special Tile Spawn Rates
  WILDCARD_SPAWN_CHANCE: 0.035, // ~3.5% chance per cell to spawn as Wildcard Star
  BOOSTER_2X_SPAWN_CHANCE: 0.05, // ~5% chance per cell to spawn with 2x Booster

  // Visual tile themes (Vibrant modern casual puzzle palette matching mockup)
  TILE_COLORS: {
    2: { bg: '#2298f8', text: '#ffffff', border: '#1a7fd4', glow: 'rgba(34, 152, 248, 0.4)' },
    4: { bg: '#ff8328', text: '#ffffff', border: '#e66a12', glow: 'rgba(255, 131, 40, 0.4)' },
    8: { bg: '#9e44ea', text: '#ffffff', border: '#872fd1', glow: 'rgba(158, 68, 234, 0.45)' },
    16: { bg: '#ea2a6f', text: '#ffffff', border: '#d11b5c', glow: 'rgba(234, 42, 111, 0.5)' },
    32: { bg: '#ef4444', text: '#ffffff', border: '#dc2626', glow: 'rgba(239, 68, 68, 0.5)' },
    64: { bg: '#10b981', text: '#ffffff', border: '#059669', glow: 'rgba(16, 185, 129, 0.5)' },
    128: { bg: '#f59e0b', text: '#ffffff', border: '#d97706', glow: 'rgba(245, 158, 11, 0.5)' },
    256: { bg: '#06b6d4', text: '#ffffff', border: '#0891b2', glow: 'rgba(6, 182, 212, 0.5)' },
    512: { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed', glow: 'rgba(139, 92, 246, 0.55)' },
    1024: { bg: '#3b82f6', text: '#ffffff', border: '#2563eb', glow: 'rgba(59, 130, 246, 0.6)' },
    2048: { bg: '#eab308', text: '#ffffff', border: '#ca8a04', glow: 'rgba(234, 179, 8, 0.7)' },
    4096: { bg: '#ec4899', text: '#ffffff', border: '#db2777', glow: 'rgba(236, 72, 153, 0.7)' },
    8192: { bg: '#14b8a6', text: '#ffffff', border: '#0d9488', glow: 'rgba(20, 184, 166, 0.8)' },
    '★': { bg: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)', text: '#ffffff', border: '#facc15', glow: 'rgba(250, 204, 21, 0.8)' },
    DEFAULT: { bg: '#6366f1', text: '#ffffff', border: '#4f46e5', glow: 'rgba(99, 102, 241, 0.8)' }
  },

  // Scoring multipliers (Section 20 GDD)
  // Merge Score = Result Number * Group Multiplier * Chain Multiplier
  getGroupMultiplier(count) {
    if (count <= 2) return 1.0;
    if (count === 3) return 1.5;
    if (count === 4) return 2.0;
    return 2.0 + (count - 4) * 0.5; // 5+ scaling bonus
  },

  getChainMultiplier(chainLevel) {
    // chainLevel: 1 = x1, 2 = x1.5, 3 = x2, 4 = x2.5...
    return 1.0 + (chainLevel - 1) * 0.5;
  },

  // Animation timings (ms)
  ANIMATION_SPEEDS: {
    slow: 450,
    normal: 260,
    fast: 140
  }
};

// Polyomino Shape Definitions (Section 5.2)
// Relative coordinate offsets [row, col]
const SHAPE_DEFINITIONS = [
  // 1-Cell
  {
    id: 'single',
    name: '1-Cell Dot',
    cells: [[0, 0]],
    weight: 15
  },

  // 2-Cell Dominoes
  {
    id: 'domino_h',
    name: '2-Cell Horizontal',
    cells: [[0, 0], [0, 1]],
    weight: 22
  },
  {
    id: 'domino_v',
    name: '2-Cell Vertical',
    cells: [[0, 0], [1, 0]],
    weight: 22
  },

  // 3-Cell Lines
  {
    id: 'trio_line_h',
    name: '3-Cell Line H',
    cells: [[0, 0], [0, 1], [0, 2]],
    weight: 14
  },
  {
    id: 'trio_line_v',
    name: '3-Cell Line V',
    cells: [[0, 0], [1, 0], [2, 0]],
    weight: 14
  },

  // 3-Cell Corners (L-Triominoes in 4 orientations)
  {
    id: 'trio_corner_tl',
    name: 'Corner Top-Left',
    cells: [[0, 0], [1, 0], [1, 1]],
    weight: 10
  },
  {
    id: 'trio_corner_tr',
    name: 'Corner Top-Right',
    cells: [[0, 1], [1, 0], [1, 1]],
    weight: 10
  },
  {
    id: 'trio_corner_bl',
    name: 'Corner Bottom-Left',
    cells: [[0, 0], [0, 1], [1, 0]],
    weight: 10
  },
  {
    id: 'trio_corner_br',
    name: 'Corner Bottom-Right',
    cells: [[0, 0], [0, 1], [1, 1]],
    weight: 10
  },

  // Occasional 4-Cell Pieces (Section 5.2)
  {
    id: 'tetra_square',
    name: '2x2 Square',
    cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
    weight: 6
  },
  {
    id: 'tetra_line_h',
    name: '4-Cell Line H',
    cells: [[0, 0], [0, 1], [0, 2], [0, 3]],
    weight: 4
  },
  {
    id: 'tetra_line_v',
    name: '4-Cell Line V',
    cells: [[0, 0], [1, 0], [2, 0], [3, 0]],
    weight: 4
  },
  {
    id: 'tetra_t_up',
    name: 'T-Shape Up',
    cells: [[0, 1], [1, 0], [1, 1], [1, 2]],
    weight: 5
  },
  {
    id: 'tetra_t_down',
    name: 'T-Shape Down',
    cells: [[0, 0], [0, 1], [0, 2], [1, 1]],
    weight: 5
  },
  {
    id: 'tetra_l',
    name: 'L-Tetromino',
    cells: [[0, 0], [1, 0], [2, 0], [2, 1]],
    weight: 4
  }
];
