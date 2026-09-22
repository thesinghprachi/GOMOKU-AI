/**
 * =============================================================================
 * GOMOKU 3D STONE CREATION FACTORY
 * =============================================================================
 *
 * Constructs and returns a 3D stone mesh for a given player at a specified
 * grid intersection (row, col).
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED:
 *
 * 1. LENTICULAR (BICONVEX) STONE GEOMETRY:
 *    - Real Go / Gomoku stones (Yunzi or Kuroki碁 stone discs) are lenticular discs
 *      with convex top and bottom surfaces, NOT spherical balls.
 *    - In 3D computer graphics, a full sphere viewed from an elevated camera angle
 *      appears tall and bulbous, occluding adjacent grid lines unnaturally.
 *    - By applying `scale.y = 0.6` to a `THREE.SphereGeometry`, we deform the sphere
 *      into an authentic biconvex stone disc with smooth, rounded curvature.
 *
 * 2. PBR MATERIAL & SPECULAR SHEEN (MeshStandardMaterial vs. MeshBasicMaterial):
 *    - Traditional stones (slate and clamshell) possess a silky, polished sheen.
 *    - `MeshStandardMaterial` with `roughness: 0.3` and `metalness: 0.1` produces
 *      realistic specular highlights that shift dynamically as the camera orbits,
 *      delivering the visual payoff of the physically-based rendering pipeline
 *      established in Phase 1.
 *
 * 3. THREE.JS USERDATA SEMANTIC ATTACHMENT:
 *    - Three.js provides a generic `.userData` dictionary on every `Object3D`.
 *    - Setting `mesh.userData = { row, col, player }` binds the logical game-state
 *      identity directly to the visual GPU object.
 *    - This is the idiomatic Three.js pattern for picking/raycasting: when the user
 *      or raycaster selects a mesh, its game coordinates can be recovered in O(1)
 *      without scanning or synchronizing a parallel lookup table.
 * =============================================================================
 */

import {
  STONE_RADIUS,
  STONE_SCALE_Y,
  STONE_ELEVATION,
  STONE_BLACK_COLOR,
  STONE_WHITE_COLOR,
  STONE_ROUGHNESS,
  STONE_METALNESS,
} from './boardConfig.js';
import { gridToWorld } from './gridUtils.js';

/**
 * Creates a 3D stone mesh positioned at (row, col) for the given player.
 *
 * @param {number} row - Grid row index (0 to 14)
 * @param {number} col - Grid column index (0 to 14)
 * @param {number} player - 1 for Black (Human), 2 for White (AI)
 * @returns {THREE.Mesh} Configured stone mesh ready for addition to scene
 */
export function createStoneMesh(row, col, player) {
  const THREE = window.THREE;
  if (!THREE) {
    throw new Error(
      'window.THREE is not available. Ensure Three.js is loaded via CDN before creating stones.'
    );
  }

  // 1. Geometry: 32 segments along equator, 16 vertical rings for smooth silhouette
  const geometry = new THREE.SphereGeometry(STONE_RADIUS, 32, 16);

  // 2. Material: Dark obsidian for Black (1), polished ivory for White (2)
  const isBlack = player === 1;
  const material = new THREE.MeshStandardMaterial({
    color: isBlack ? STONE_BLACK_COLOR : STONE_WHITE_COLOR,
    roughness: STONE_ROUGHNESS,
    metalness: STONE_METALNESS,
  });

  const stoneMesh = new THREE.Mesh(geometry, material);
  stoneMesh.name = `stone_${row}_${col}_p${player}`;

  // 3. Lenticular Deformation: flatten Y-axis to form authentic disc
  stoneMesh.scale.set(1.0, STONE_SCALE_Y, 1.0);

  // 4. Physical Positioning:
  // X and Z are centered on the grid intersection.
  // Y is elevated to STONE_ELEVATION so the flattened bottom sits flush on the board (y = 0).
  const worldPos = gridToWorld(row, col, STONE_ELEVATION);
  stoneMesh.position.set(worldPos.x, worldPos.y, worldPos.z);

  // 5. Lighting & Shadows: Cast realistic soft shadows onto the wooden slab
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;

  // 6. Semantic UserData: Idiomatic Three.js metadata binding
  stoneMesh.userData = {
    row,
    col,
    player,
    isStone: true,
  };

  return stoneMesh;
}
