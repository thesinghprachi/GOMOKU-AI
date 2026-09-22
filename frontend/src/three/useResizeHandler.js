/**
 * =============================================================================
 * SHARED THREE.JS RESIZE HANDLER UTILITY
 * =============================================================================
 *
 * Provides a robust, leak-free resize listener that synchronizes Three.js
 * cameras and WebGL renderers to container and browser window dimensions.
 *
 * CRITICAL VIVA NOTE: WHY updateProjectionMatrix() IS MANDATORY:
 * In Three.js, `camera.aspect` is simply a scalar property (width / height).
 * However, the GPU's vertex shader does not read `camera.aspect` directly;
 * it multiplies 3D vertex coordinates by the camera's internal 4x4
 * `projectionMatrix`.
 * Three.js caches this 4x4 matrix for rendering performance. Mutating
 * `camera.aspect` alone does NOT recompute the matrix. Calling
 * `camera.updateProjectionMatrix()` explicitly recalculates the frustum planes
 * and matrix columns, preventing the 3D geometry from stretching or squashing
 * when the viewport aspect ratio changes.
 * =============================================================================
 */

/**
 * Attaches window and container resize listeners to update a Three.js camera and renderer.
 *
 * @param {THREE.PerspectiveCamera} camera - Active scene camera
 * @param {THREE.WebGLRenderer} renderer - Active WebGL renderer
 * @param {HTMLElement} [container] - Container DOM element (defaults to window)
 * @returns {() => void} Cleanup function to detach listeners
 */
export function attachResizeHandler(camera, renderer, container = null) {
  if (!camera || !renderer) {
    return () => {};
  }

  const handleResize = () => {
    const hasWindow = typeof window !== 'undefined';
    const fallbackWidth = hasWindow ? window.innerWidth : 1024;
    const fallbackHeight = hasWindow ? window.innerHeight : 768;

    const width = container
      ? container.clientWidth || fallbackWidth
      : fallbackWidth;
    const height = container
      ? container.clientHeight || fallbackHeight
      : fallbackHeight;

    if (width === 0 || height === 0) return;

    // 1. Update aspect ratio
    camera.aspect = width / height;

    // 2. Recalculate the cached 4x4 perspective projection matrix
    camera.updateProjectionMatrix();

    // 3. Resize the WebGL drawing buffer and canvas DOM element
    renderer.setSize(width, height);
  };

  // Immediate initial alignment
  handleResize();

  // Listen to browser window resize if window is present
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    window.addEventListener('resize', handleResize);
  }

  // Also attach ResizeObserver to container if available for flexbox/layout reflows
  let resizeObserver = null;
  if (container && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
  }

  // Teardown cleanup function
  return () => {
    if (hasWindow) {
      window.removeEventListener('resize', handleResize);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  };
}
