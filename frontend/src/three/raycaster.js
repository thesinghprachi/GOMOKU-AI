/**
 * =============================================================================
 * THREE.JS RAYCASTING & INTERACTION UTILITIES
 * =============================================================================
 *
 * Provides raycasting capabilities to translate 2D screen clicks into 3D world
 * intersections, and then snap those continuous world hits onto discrete
 * Gomoku grid coordinates (row, col).
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED:
 *
 * 1. RAYCASTING AS "THE REVERSE OF RENDERING":
 *    - Rendering Pipeline (Forward):
 *        3D World Geometry (x, y, z) -> Camera View Matrix -> Projection Matrix
 *        -> Normalized Device Coordinates (NDC) -> Viewport Transform -> 2D Screen Pixels.
 *    - Raycasting Pipeline (Inverse):
 *        2D Screen Click Pixel (clientX, clientY) -> Normalized Device Coordinates (NDC [-1, 1])
 *        -> Unproject via Camera Frustum into a 3D Ray (origin + direction vector)
 *        -> Test Ray-Triangle / Ray-Box intersections against 3D scene meshes
 *        -> Read hit point (x, y, z) -> Snap to discrete grid cell (row, col).
 *
 * 2. NORMALIZED DEVICE COORDINATES (NDC):
 *    - Screen space is pixel-based, resolution-dependent, and top-left origin:
 *      (0, 0) is top-left, and Y increases downwards.
 *    - Raycaster math operates in Normalized Device Coordinates (NDC):
 *      Range is [-1, +1] on both axes, centered at (0, 0), with Y increasing UPWARDS.
 *    - Conversion formula:
 *        ndc.x =  ((clientX - canvas.left) / canvas.width)  * 2 - 1
 *        ndc.y = -((clientY - canvas.top)  / canvas.height) * 2 + 1
 *
 * 3. RECURSIVE INTERSECTION (intersectObject(boardMesh, true)):
 *    - `boardMesh` is a `THREE.Group` container, not a single mesh with geometric faces.
 *    - If `recursive = false`, Three.js tests only the root group node (which has no
 *      triangles/polygons) and immediately returns an empty hit array.
 *    - Setting `recursive = true` traverses all child meshes (the wooden slab,
 *      grid line segments, and star points).
 *
 * 4. STEEP-ANGLE ACCURACY (SLAB FILTERING):
 *    - At steep camera angles, a ray could graze a thin grid line segment (y = 0.01)
 *      before reaching the wood. To ensure maximum precision from all viewing angles,
 *      we prioritize the hit on the main wooden slab (`boardSlab`).
 * =============================================================================
 */

import { worldToGrid, isValidGridCoordinate } from './gridUtils.js';

/**
 * Instantiates and returns a reusable Raycaster and 2D mouse vector.
 *
 * @returns {{ raycaster: THREE.Raycaster, mouse: THREE.Vector2 }}
 */
export function createRaycaster() {
  const THREE = window.THREE;
  if (!THREE) {
    throw new Error(
      'window.THREE is not available. Ensure Three.js is loaded via CDN before initializing raycaster.'
    );
  }

  return {
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
  };
}

/**
 * Performs raycasting from a DOM mouse/pointer event against the board mesh,
 * resolving the target discrete (row, col) grid intersection.
 *
 * Pipeline:
 *   user clicks pixel -> convert to NDC -> cast ray from camera through pixel
 *   -> find intersection with board mesh -> read world X/Z -> convert to grid row/col.
 *
 * @param {MouseEvent|PointerEvent} event - Browser DOM mouse event
 * @param {THREE.Camera} camera - Active scene camera
 * @param {THREE.WebGLRenderer} renderer - Active WebGL renderer
 * @param {THREE.Object3D} boardMesh - The root board group (or slab mesh)
 * @param {THREE.Raycaster} [existingRaycaster] - Optional pre-allocated raycaster
 * @param {THREE.Vector2} [existingMouse] - Optional pre-allocated mouse vector
 * @returns {{ row: number, col: number, worldPoint: { x: number, y: number, z: number } } | null}
 */
export function getIntersectedGridCell(
  event,
  camera,
  renderer,
  boardMesh,
  existingRaycaster = null,
  existingMouse = null
) {
  const THREE = window.THREE;
  if (!THREE || !renderer || !camera || !boardMesh) {
    return null;
  }

  // Reuse existing or instantiate temporary raycaster and mouse vector
  const raycaster = existingRaycaster || new THREE.Raycaster();
  const mouse = existingMouse || new THREE.Vector2();

  // ---------------------------------------------------------------------------
  // Step A: Convert mouse pixel coordinates to Normalized Device Coordinates (NDC)
  // ---------------------------------------------------------------------------
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // ---------------------------------------------------------------------------
  // Step B: Configure the ray from camera through the NDC mouse position
  // ---------------------------------------------------------------------------
  raycaster.setFromCamera(mouse, camera);

  // ---------------------------------------------------------------------------
  // Step C: Test intersection against the board hierarchy (recursive = true)
  // ---------------------------------------------------------------------------
  const intersects = raycaster.intersectObject(boardMesh, true);

  // Step D: If nothing on the board was clicked, return null
  if (!intersects || intersects.length === 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Step E: Extract the 3D world coordinate on the board surface
  // ---------------------------------------------------------------------------
  // Filter for the main wooden slab mesh if present to avoid minor line-segment
  // grazing offsets at extreme angles
  const slabHit =
    intersects.find((hit) => hit.object.name === 'boardSlab') || intersects[0];
  const point = slabHit.point;

  // ---------------------------------------------------------------------------
  // Step F: Convert continuous world (x, z) to discrete grid (row, col)
  // ---------------------------------------------------------------------------
  const { row, col } = worldToGrid(point.x, point.z);

  // Step G: Validate bounds [0, 14]
  if (!isValidGridCoordinate(row, col)) {
    return null;
  }

  return {
    row,
    col,
    worldPoint: { x: point.x, y: point.y, z: point.z },
  };
}
