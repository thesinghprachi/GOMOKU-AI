/**
 * =============================================================================
 * GOMOKU GRID COORDINATE CONVERSION UTILITIES
 * =============================================================================
 *
 * Pure JavaScript mathematical transformations between 2D Discrete Grid
 * Coordinates (row, col) and 3D Continuous World Coordinates (x, y, z).
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED HERE:
 *
 * 1. INTERSECTION-BASED VS. CELL-BASED LAYOUT:
 *    - In Chess/Checkers, pieces are placed inside square cells (an 8x8 board
 *      consists of 64 squares enclosed by 9 lines).
 *    - In Gomoku/Go, stones are placed directly on the **intersections** of grid lines.
 *      A 15x15 Gomoku board consists of 15 horizontal and 15 vertical lines,
 *      yielding exactly 15 x 15 = 225 valid playable intersection points.
 *    - Therefore, the coordinate range spans from index 0 to 14, with the physical
 *      outermost lines located at -7.0 and +7.0 world units.
 *
 * 2. 3D AXIS CONVENTIONS (X-Z PLANE WITH Y-UP):
 *    - Gomoku is played on a horizontal surface. In Three.js standard coordinates,
 *      the horizontal ground is the X-Z plane, and the vertical elevation is Y-up.
 *    - Column index (0..14) maps to the X-axis (left-to-right).
 *    - Row index (0..14) maps to the Z-axis (top-to-bottom).
 *    - Board center is anchored at world origin (0, 0, 0), meaning:
 *        Grid Center (row 7, col 7) <==> World Position (0, 0, 0).
 *
 * 3. ZERO THREE.JS DEPENDENCIES (TESTABILITY):
 *    - By implementing these transformations as pure JS functions returning plain
 *      objects ({ x, y, z } and { row, col }), they can be unit-tested without
 *      needing WebGL contexts, mock Scene graphs, or DOM trees.
 * =============================================================================
 */

import { BOARD_SIZE, CELL_SIZE, BOARD_WIDTH, BOARD_DEPTH } from './boardConfig.js';

/**
 * Converts a 2D discrete grid coordinate (row, col) to 3D continuous world space (x, y, z).
 *
 * @param {number} row - Grid row index (0 to 14, top to bottom)
 * @param {number} col - Grid column index (0 to 14, left to right)
 * @param {number} [elevation=0] - Optional Y-height above the board surface
 * @returns {{ x: number, y: number, z: number }} 3D world coordinates
 */
export function gridToWorld(row, col, elevation = 0) {
  const centerOffset = (BOARD_SIZE - 1) / 2; // For 15x15: (15 - 1) / 2 = 7

  const x = (col - centerOffset) * CELL_SIZE;
  const z = (row - centerOffset) * CELL_SIZE;
  const y = elevation;

  return { x, y, z };
}

/**
 * Converts 3D continuous world coordinates (x, z) to the nearest discrete grid coordinate (row, col).
 * Clamps coordinates to the valid grid index range [0, BOARD_SIZE - 1].
 *
 * @param {number} x - 3D world X coordinate
 * @param {number} z - 3D world Z coordinate
 * @returns {{ row: number, col: number }} Discrete grid coordinate snapped to nearest intersection
 */
export function worldToGrid(x, z) {
  const centerOffset = (BOARD_SIZE - 1) / 2; // 7

  // Calculate floating-point continuous grid coordinates
  const continuousCol = x / CELL_SIZE + centerOffset;
  const continuousRow = z / CELL_SIZE + centerOffset;

  // Snap to nearest integer intersection
  const rawCol = Math.round(continuousCol);
  const rawRow = Math.round(continuousRow);

  // Clamp strictly within [0, BOARD_SIZE - 1] to prevent out-of-bounds array access
  const col = Math.max(0, Math.min(BOARD_SIZE - 1, rawCol));
  const row = Math.max(0, Math.min(BOARD_SIZE - 1, rawRow));

  return { row, col };
}

/**
 * Checks whether a (row, col) pair is a valid intersection within the grid.
 *
 * @param {number} row - Grid row index
 * @param {number} col - Grid column index
 * @returns {boolean} True if within [0, BOARD_SIZE - 1]
 */
export function isValidGridCoordinate(row, col) {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < BOARD_SIZE &&
    col >= 0 &&
    col < BOARD_SIZE
  );
}

/**
 * Checks whether a 3D world point (x, z) lies within the physical boundaries
 * of the board slab (useful for filtering out-of-board raycaster clicks in Phase 3).
 *
 * @param {number} x - World X position
 * @param {number} z - World Z position
 * @param {number} [tolerance=0] - Additional margin beyond board borders
 * @returns {boolean} True if the point is on the wooden slab
 */
export function isWithinBoardBounds(x, z, tolerance = 0) {
  const halfWidth = BOARD_WIDTH / 2 + tolerance;
  const halfDepth = BOARD_DEPTH / 2 + tolerance;

  return (
    x >= -halfWidth &&
    x <= halfWidth &&
    z >= -halfDepth &&
    z <= halfDepth
  );
}
