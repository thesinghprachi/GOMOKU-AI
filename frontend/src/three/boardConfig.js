/**
 * =============================================================================
 * GOMOKU 3D BOARD CONFIGURATION CONSTANTS
 * =============================================================================
 *
 * Plain JavaScript constants defining the spatial, geometric, and visual
 * properties of the 3D Gomoku board.
 *
 * WHY CENTRALIZING THESE CONSTANTS MATTERS (CRITICAL VIVA NOTE):
 * In a 3D board game architecture, multiple distinct subsystems interact:
 *   1. Board Geometry Generation (createBoard.js) creates the wooden slab,
 *      15x15 line meshes, and star points.
 *   2. Raycasting & Click Detection (Phase 3) intercepts mouse clicks on the
 *      board plane and snaps the cursor hit point to the nearest valid intersection.
 *   3. Stone Placement (Phase 3) positions 3D black/white stone meshes at
 *      precise world coordinates (x, y, z) calculated from grid (row, col).
 *   4. AI Move Highlighting (Phase 6) displays glow rings or markers over
 *      target intersections.
 *
 * If values like grid size (15), cell spacing (1.0), or wooden padding (0.8)
 * were hardcoded across separate files, any tweak or discrepancy would cause
 * catastrophic desync: stones would appear offset from grid lines, raycasts
 * would pick the wrong cell, and AI markers would float in empty space.
 * Centralizing them here guarantees single-source-of-truth consistency.
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// 1. GRID DIMENSIONS
// -----------------------------------------------------------------------------
/** Number of lines / intersections along each axis (standard Gomoku is 15x15) */
export const BOARD_SIZE = 15;

/**
 * World units between adjacent grid lines.
 * Scale visually via camera position/FOV, NOT by altering CELL_SIZE.
 */
export const CELL_SIZE = 1.0;

/**
 * Height / thickness of the wooden board slab along the vertical Y-axis.
 */
export const BOARD_THICKNESS = 0.3;

/**
 * Wood border margin extending past the outermost grid lines on all 4 sides.
 * Traditional boards feature a comfortable wooden border surrounding the playable grid.
 */
export const BOARD_PADDING = 0.8;

/**
 * Total physical width (X-axis) and depth (Z-axis) of the wooden board slab.
 * Outermost lines span from -7 to +7 (distance of 14 units = (15 - 1) * 1.0).
 * With BOARD_PADDING = 0.8 on each side: 14 + 2 * 0.8 = 15.6 units.
 */
export const BOARD_WIDTH = (BOARD_SIZE - 1) * CELL_SIZE + 2 * BOARD_PADDING;
export const BOARD_DEPTH = (BOARD_SIZE - 1) * CELL_SIZE + 2 * BOARD_PADDING;

// -----------------------------------------------------------------------------
// 2. RENDERING & ELEVATION OFFSETS (Z-FIGHTING PREVENTION)
// -----------------------------------------------------------------------------
/**
 * Height offset above the wooden slab's top surface (y = 0) for drawing grid lines.
 *
 * WHY THIS OFFSET IS REQUIRED (Z-FIGHTING EXPLANATION):
 * When two 3D surfaces occupy the exact same spatial plane (here, y = 0 for both
 * the wooden slab top and the grid lines), the GPU's depth buffer (Z-buffer)
 * suffers from floating-point rounding ambiguity. As the camera orbits or zooms,
 * depth calculations alternate between favoring the line or the wood pixel-by-pixel,
 * causing flickering noise known as "Z-fighting" or "stitching".
 * Lifting the grid lines by +0.01 world units guarantees the line always passes
 * the depth test cleanly without floating visibly above the board.
 */
export const GRID_ELEVATION = 0.01;

/**
 * Star points (Hoshi) sit slightly above the grid lines to avoid mutual Z-fighting.
 */
export const HOSHI_ELEVATION = 0.012;

/**
 * Radius of the circular star point markers (Hoshi).
 */
export const HOSHI_RADIUS = 0.08;

// -----------------------------------------------------------------------------
// 3. STAR POINT (HOSHI) COORDINATES
// -----------------------------------------------------------------------------
/**
 * Traditional star points (Hoshi) for a 15x15 Gomoku/Renju board.
 * Five canonical points:
 *   - Center / Tengen: (7, 7)
 *   - Four corner reference points: (3, 3), (3, 11), (11, 3), (11, 11)
 * Defined as 0-indexed (row, col) grid coordinates.
 */
export const HOSHI_POINTS = [
  { row: 3, col: 3 },
  { row: 3, col: 11 },
  { row: 7, col: 7 }, // Tengen (Center)
  { row: 11, col: 3 },
  { row: 11, col: 11 },
];

// -----------------------------------------------------------------------------
// 4. VISUAL AESTHETICS & MATERIAL PALETTE
// -----------------------------------------------------------------------------
/** Warm natural Kaya / Shin-Kaya honey wood tone for the board slab */
export const BOARD_COLOR = 0xd4a373;

/** Rich dark espresso / charcoal ink color for grid lines */
export const LINE_COLOR = 0x2c1d11;

/** Matching espresso ink color for star points */
export const HOSHI_COLOR = 0x2c1d11;

/** Realistic PBR surface roughness for finished wood (0 = mirror, 1 = chalk) */
export const BOARD_ROUGHNESS = 0.45;

/** Metalness of natural wood (dielectric material: 0.0) */
export const BOARD_METALNESS = 0.05;

// -----------------------------------------------------------------------------
// 5. STONE DIMENSIONS, GEOMETRY & MATERIALS
// -----------------------------------------------------------------------------
/**
 * Radius of the Gomoku stone in world units.
 * With CELL_SIZE = 1.0, a radius of 0.44 gives a diameter of 0.88, covering 88%
 * of the grid cell without overlapping adjacent stones at distance 1.0.
 */
export const STONE_RADIUS = 0.44;

/**
 * Y-axis scale factor flattening the sphere into a lenticular biconvex disc.
 * Real Go/Gomoku stones are rounded discs, not spherical balls.
 */
export const STONE_SCALE_Y = 0.6;

/**
 * World height of the stone center above the board plane (y = 0).
 * Since the stone is flattened along Y by STONE_SCALE_Y, its bottom vertex
 * sits exactly at (STONE_ELEVATION - STONE_RADIUS * STONE_SCALE_Y) = 0.0.
 */
export const STONE_ELEVATION = STONE_RADIUS * STONE_SCALE_Y;

/**
 * Black stone color (Player 1 / Human).
 * Pure dark slate/obsidian finish.
 */
export const STONE_BLACK_COLOR = 0x111111;

/**
 * White stone color (Player 2 / AI).
 * Polished ivory / shell finish.
 */
export const STONE_WHITE_COLOR = 0xf5f5f5;

/**
 * PBR roughness for polished stones: 0.3 gives a soft, silky specular reflection.
 */
export const STONE_ROUGHNESS = 0.3;

/**
 * PBR metalness for stones: 0.1 provides a subtle pearlescent gloss.
 */
export const STONE_METALNESS = 0.1;

