/**
 * =============================================================================
 * GOMOKU 3D BOARD CREATION FACTORY
 * =============================================================================
 *
 * Constructs and returns the Three.js 3D scene hierarchy representing the
 * physical Gomoku board:
 *   1. Wooden Slab: Solid chamfered-feel wooden base box with PBR material.
 *   2. 15x15 Grid Lines: Sharp, crisp line segments positioned at intersections.
 *   3. Star Points (Hoshi): 5 canonical circular ink markings at key grid anchors.
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED:
 *   - X-Z Plane with Y-up: The playing surface rests on the horizontal X-Z plane.
 *   - Intersection layout: Stones and lines intersect at (row, col) coordinates.
 *   - Z-Fighting Prevention: The top of the wooden slab is at y = 0. Grid lines
 *     are elevated to y = +0.01, and Hoshi star points to y = +0.012. This ensures
 *     the GPU depth buffer never exhibits pixel flickering or z-stitching.
 * =============================================================================
 */

import {
  BOARD_SIZE,
  BOARD_THICKNESS,
  BOARD_WIDTH,
  BOARD_DEPTH,
  BOARD_COLOR,
  BOARD_ROUGHNESS,
  BOARD_METALNESS,
  LINE_COLOR,
  HOSHI_COLOR,
  HOSHI_RADIUS,
  HOSHI_POINTS,
  GRID_ELEVATION,
  HOSHI_ELEVATION,
} from './boardConfig.js';
import { gridToWorld } from './gridUtils.js';

/**
 * Creates and returns the complete 3D Gomoku board as a THREE.Group.
 *
 * @returns {THREE.Group} Root board group ready to be added to a THREE.Scene
 */
export function createBoard() {
  const THREE = window.THREE;
  if (!THREE) {
    throw new Error(
      'window.THREE is not available. Ensure Three.js is loaded via CDN before creating the board.'
    );
  }

  // Root container group holding all board components
  const boardGroup = new THREE.Group();
  boardGroup.name = 'gomokuBoard';

  // ---------------------------------------------------------------------------
  // 1. WOODEN BOARD SLAB
  // ---------------------------------------------------------------------------
  // Geometry: Box with physical dimensions (width=X, height=Y, depth=Z)
  // Top surface is placed exactly at y = 0.
  // Because THREE.BoxGeometry is centered at origin (y extends from -H/2 to +H/2),
  // shifting the mesh position down by -BOARD_THICKNESS / 2 (-0.15) aligns
  // its top face exactly with the horizontal plane y = 0.
  const slabGeometry = new THREE.BoxGeometry(
    BOARD_WIDTH,
    BOARD_THICKNESS,
    BOARD_DEPTH
  );

  const slabMaterial = new THREE.MeshStandardMaterial({
    color: BOARD_COLOR,
    roughness: BOARD_ROUGHNESS,
    metalness: BOARD_METALNESS,
  });

  const slabMesh = new THREE.Mesh(slabGeometry, slabMaterial);
  slabMesh.name = 'boardSlab';
  slabMesh.position.y = -BOARD_THICKNESS / 2;
  slabMesh.receiveShadow = true; // Enables soft shadows cast by stones in future phases
  boardGroup.add(slabMesh);

  // ---------------------------------------------------------------------------
  // 2. 15x15 GRID LINES (THREE.LineSegments)
  // ---------------------------------------------------------------------------
  // Gomoku is played on line intersections (15 horizontal lines x 15 vertical lines).
  // We use THREE.LineSegments with a single BufferGeometry for optimal performance
  // (1 draw call instead of 30 separate line objects).
  //
  // 15 horizontal lines + 15 vertical lines = 30 segments.
  // Each segment has 2 vertices (start & end), so 30 * 2 = 60 vertices total.
  // Each vertex has 3 floats (x, y, z), so array length = 60 * 3 = 180 floats.
  const numLines = BOARD_SIZE * 2; // 15 horizontal + 15 vertical = 30
  const vertices = new Float32Array(numLines * 2 * 3);
  let vIdx = 0;

  // Horizontal lines (spanning along X axis from col 0 to col 14 at fixed rows)
  for (let row = 0; row < BOARD_SIZE; row++) {
    const start = gridToWorld(row, 0, GRID_ELEVATION);
    const end = gridToWorld(row, BOARD_SIZE - 1, GRID_ELEVATION);

    vertices[vIdx++] = start.x;
    vertices[vIdx++] = start.y;
    vertices[vIdx++] = start.z;

    vertices[vIdx++] = end.x;
    vertices[vIdx++] = end.y;
    vertices[vIdx++] = end.z;
  }

  // Vertical lines (spanning along Z axis from row 0 to row 14 at fixed columns)
  for (let col = 0; col < BOARD_SIZE; col++) {
    const start = gridToWorld(0, col, GRID_ELEVATION);
    const end = gridToWorld(BOARD_SIZE - 1, col, GRID_ELEVATION);

    vertices[vIdx++] = start.x;
    vertices[vIdx++] = start.y;
    vertices[vIdx++] = start.z;

    vertices[vIdx++] = end.x;
    vertices[vIdx++] = end.y;
    vertices[vIdx++] = end.z;
  }

  const linesGeometry = new THREE.BufferGeometry();
  linesGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(vertices, 3)
  );

  const linesMaterial = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    linewidth: 1, // Note: WebGL spec sets linewidth to 1 across most modern browsers
  });

  const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
  linesMesh.name = 'gridLines';
  boardGroup.add(linesMesh);

  // ---------------------------------------------------------------------------
  // 3. STAR POINTS (HOSHI)
  // ---------------------------------------------------------------------------
  // In Go/Gomoku, star points (Hoshi) help players visually locate intersections
  // without having to count lines from the edge.
  // We use flat circular disks (THREE.CircleGeometry) rotated flat onto the X-Z plane.
  const hoshiGroup = new THREE.Group();
  hoshiGroup.name = 'hoshiPoints';

  const hoshiGeometry = new THREE.CircleGeometry(HOSHI_RADIUS, 24);
  // Reusable material for all 5 star points
  const hoshiMaterial = new THREE.MeshBasicMaterial({
    color: HOSHI_COLOR,
  });

  HOSHI_POINTS.forEach(({ row, col }) => {
    const pos = gridToWorld(row, col, HOSHI_ELEVATION);
    const hoshiMesh = new THREE.Mesh(hoshiGeometry, hoshiMaterial);

    // Rotate circle by -90 deg (-PI/2) on X-axis so its normal points UP along the Y-axis
    hoshiMesh.rotation.x = -Math.PI / 2;
    hoshiMesh.position.set(pos.x, pos.y, pos.z);
    hoshiGroup.add(hoshiMesh);
  });

  boardGroup.add(hoshiGroup);

  return boardGroup;
}
