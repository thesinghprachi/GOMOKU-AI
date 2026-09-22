import React, { useRef, useEffect } from 'react';

/**
 * =============================================================================
 * SCENE TEST COMPONENT (PHASE 1 3D SMOKE TEST)
 * =============================================================================
 *
 * WHAT THIS COMPONENT DOES:
 * Validates the Three.js WebGL rendering pipeline inside a React functional
 * component by displaying a single illuminated, rotating 3D cube.
 *
 * WHY `window.THREE` (GLOBAL NAMESPACE) IS USED (VIVA NOTE):
 * In a standard npm-based frontend, you would write `import * as THREE from 'three'`.
 * However, per course/project constraints, Three.js is loaded externally via CDN
 * <script> tags in `index.html`. This exposes Three.js on the global browser object
 * as `window.THREE`. Accessing `const THREE = window.THREE;` ensures React consumes
 * the pre-loaded CDN bundle without requiring npm bundling or node_modules overhead.
 * =============================================================================
 */

export default function SceneTest() {
  // Container ref: Provides a real DOM anchor where Three.js can attach its WebGL <canvas>
  const mountRef = useRef(null);

  useEffect(() => {
    // -------------------------------------------------------------------------
    // 0. VERIFY GLOBAL THREE OBJECT AVAILABILITY
    // -------------------------------------------------------------------------
    const THREE = window.THREE;
    if (!THREE) {
      console.error(
        'Three.js is not loaded on window.THREE. Ensure the CDN script tag in index.html is loaded.'
      );
      return;
    }

    const currentMount = mountRef.current;
    if (!currentMount) return;

    // -------------------------------------------------------------------------
    // 1. THREE.Scene (THE 3D WORLD CONTAINER)
    // -------------------------------------------------------------------------
    // Concept: The Scene is the root node of the 3D scene graph. It acts as the
    // universe/container where all 3D entities live: meshes, cameras, lights, and helpers.
    // Nothing is visible unless it has been explicitly added to the Scene.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24); // Subtle dark-slate backdrop

    // -------------------------------------------------------------------------
    // 2. THREE.PerspectiveCamera (THE VIEWPOINT / EYE)
    // -------------------------------------------------------------------------
    // Concept: Simulates human eye vision using perspective projection, where
    // distant objects appear smaller than nearby objects.
    // Parameters:
    //   - Field of View (FOV): 75 degrees (vertical viewing angle).
    //   - Aspect Ratio: viewport width / height (prevents geometric stretching).
    //   - Near Clipping Plane: 0.1 (closest distance rendered).
    //   - Far Clipping Plane: 1000 (farthest distance rendered).
    const width = currentMount.clientWidth || window.innerWidth;
    const height = currentMount.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    // Position camera along the Z-axis so it looks back toward the origin (0, 0, 0)
    camera.position.z = 5;

    // -------------------------------------------------------------------------
    // 3. THREE.WebGLRenderer (DRAWS THE 3D WORLD ONTO THE SCREEN)
    // -------------------------------------------------------------------------
    // Concept: The Renderer communicates with the GPU via WebGL shaders to calculate
    // lighting, rasterize polygons, and draw the 3D scene onto an HTML5 <canvas>.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Crisp rendering on high-DPI displays

    // Attach the renderer's generated <canvas> element into our React container div
    currentMount.appendChild(renderer.domElement);

    // -------------------------------------------------------------------------
    // 4. LIGHTING (AMBIENT + DIRECTIONAL LIGHTS)
    // -------------------------------------------------------------------------
    // Concept: Without lighting, physically-based materials render as pitch black.
    // - AmbientLight: Non-directional, omni-present base illumination that fills
    //   shadows equally from all angles.
    // - DirectionalLight: Simulates distant sunlight with parallel rays that create
    //   distinct surface highlights and shadows, revealing depth and 3D curvature.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Key light
    directionalLight.position.set(5, 5, 5); // Angled down from upper right
    scene.add(directionalLight);

    // -------------------------------------------------------------------------
    // 5. MESH: GEOMETRY + MATERIAL
    // -------------------------------------------------------------------------
    // Concept: A 3D object on screen is called a "Mesh". A Mesh requires two parts:
    //   a. Geometry: The mathematical wireframe vertices/edges (the shape).
    //   b. Material: The optical properties determining how light reflects (color, roughness, metalness).
    //
    // WHY MeshStandardMaterial INSTEAD OF MeshBasicMaterial (VIVA NOTE):
    // MeshBasicMaterial completely ignores scene lights, resulting in flat, unshaded
    // 2D-looking silhouettes. In contrast, MeshStandardMaterial uses Physically Based
    // Rendering (PBR) equations (roughness, metalness) that respond to ambient and
    // directional lights. This will be essential in Phase 2 for rendering the warm,
    // tactile wooden grain of the Gomoku board and shiny black/white polished stones.
    const geometry = new THREE.BoxGeometry(2, 2, 2); // 2x2x2 unit cube
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a90e2, // Pleasant cobalt blue
      roughness: 0.3,   // Moderately smooth surface
      metalness: 0.2,   // Slight metallic sheen
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // -------------------------------------------------------------------------
    // 6. RENDER / ANIMATION LOOP (WHY requestAnimationFrame IS ESSENTIAL)
    // -------------------------------------------------------------------------
    // Concept: Calling `renderer.render(scene, camera)` only draws a single static snapshot.
    // To achieve smooth 60 FPS motion, we need a continuous render loop.
    // We use `requestAnimationFrame`:
    //   1. It synchronizes with the monitor's refresh rate (typically 60Hz or 120Hz).
    //   2. It automatically pauses when the browser tab is hidden/minimized, saving
    //      battery and CPU/GPU cycles (unlike setInterval or setTimeout).
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate cube slightly on each frame
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.015;

      // Draw the scene from the perspective of the camera
      renderer.render(scene, camera);
    };

    animate();

    // -------------------------------------------------------------------------
    // 7. WINDOW RESIZE HANDLER
    // -------------------------------------------------------------------------
    // Automatically updates camera projection and canvas dimensions on window resize
    const handleResize = () => {
      if (!currentMount) return;
      const newWidth = currentMount.clientWidth || window.innerWidth;
      const newHeight = currentMount.clientHeight || window.innerHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix(); // Recalculate camera frustum
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------------------
    // 8. REACT CLEANUP FUNCTION (PREVENTING MEMORY LEAKS / STRICTMODE DUPLICATES)
    // -------------------------------------------------------------------------
    // Concept: When a React component unmounts (or during React 18 StrictMode's
    // deliberate mount->unmount->mount test cycle), we MUST clean up resources.
    // If we fail to clean up:
    //   1. Duplicate WebGL canvases will stack on top of each other in the DOM.
    //   2. The animation loop continues firing in the background, consuming CPU/GPU.
    //   3. Geometries and materials remain locked in VRAM, causing browser memory leaks.
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      // Dispose Three.js GPU resources
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      // Remove the WebGL <canvas> from the DOM
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'block',
        position: 'relative',
      }}
    />
  );
}
