import React, { useRef, useEffect, useCallback } from 'react';
import { BOARD_SIZE } from '../three/boardConfig.js';
import { createBoard } from '../three/createBoard.js';
import { createStoneMesh } from '../three/createStone.js';
import { createRaycaster, getIntersectedGridCell } from '../three/raycaster.js';
import { makeMove } from '../api/gameApi.js';
import { gridToWorld } from '../three/gridUtils.js';
import { attachResizeHandler } from '../three/useResizeHandler.js';

/**
 * =============================================================================
 * GOMOKU SCENE COMPONENT (PHASE 5: EXPLAINABLE-AI INTEGRATION & AFFORDANCES)
 * =============================================================================
 *
 * WHAT THIS COMPONENT DOES:
 * Hosts the Three.js 3D WebGL viewport for Gomoku, receiving lifted game state
 * from App.jsx:
 *   - Renders the 3D Goban board and studio lighting
 *   - Translates canvas clicks into game moves via Raycasting
 *   - Synchronizes authoritative server board state to 3D stone meshes
 *   - Triggers a temporary animated glowing ring on the AI's counter-move
 *   - Forwards Minimax decision metrics (top candidate moves, scores, node count)
 *     to the AI Thoughts panel
 *
 * CRITICAL VIVA CONCEPTS IMPLEMENTED:
 *
 * 1. AI MOVE HIGHLIGHTING AFFORDANCE:
 *    - Gomoku played against a fast search engine (depth 3 running in 300-500ms)
 *      can be disorienting: the AI plays its counter-move almost instantly.
 *    - We spawn a temporary `THREE.RingGeometry` around the AI's chosen intersection
 *      that expands and fades its opacity from 0.95 to 0 over 1.5 seconds.
 *    - This is a critical UX affordance that guides the human's visual focus to
 *      the newly placed enemy stone.
 *
 * 2. SEPARATION OF CONCERNS (DATA VS. SCENE GRAPH):
 *    - Board state (data) is owned by App.jsx.
 *    - GomokuScene manages the imperative WebGL scene graph (meshes, lights, camera).
 *    - Synchronization is achieved via `syncStonesToBoard`, which diffs data against
 *      the `stonesRef` map without full-scene rebuilds or flickering.
 *
 * 3. OPTIMISTIC UI RENDERING & STALE CLOSURE PREVENTION:
 *    - The human player's stone is rendered immediately (<16ms) before awaiting the
 *      backend's 300–500ms Minimax calculation, eliminating perceived interaction lag.
 *    - Uses synchronous `boardRef.current` assignment alongside state setters to protect
 *      asynchronous callbacks and click handlers from React stale closure bugs.
 *    - Clean rollback via `syncStonesToBoard` on error disposes mesh resources and maintains
 *      absolute client-server synchronization.
 * =============================================================================
 */

// Camera preset positions for quick perspective switching
const CAMERA_PRESETS = {
  isometric: { x: 0, y: 16, z: 15 },
  topDown: { x: 0, y: 22, z: 0.001 },
  sideAngle: { x: 14, y: 12, z: 14 },
};

export default function GomokuScene({
  board,
  setBoard,
  aiThoughts,
  setAiThoughts,
  winner,
  setWinner,
  isAiThinking,
  setIsAiThinking,
  statusMessage,
  setStatusMessage,
  sessionEpochRef,
}) {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);

  // Map of "row,col" -> THREE.Mesh for O(1) lookup and lifecycle management
  const stonesRef = useRef(new Map());

  // Active visual effects queue (e.g. AI move glow rings)
  const activeEffectsRef = useRef([]);

  // Mutable refs synchronizing with props to prevent stale closures in canvas event listeners
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const isAiThinkingRef = useRef(isAiThinking);
  useEffect(() => {
    isAiThinkingRef.current = isAiThinking;
  }, [isAiThinking]);

  const winnerRef = useRef(winner);
  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  // ---------------------------------------------------------------------------
  // INCREMENTAL STONE SYNCHRONIZATION HELPER
  // ---------------------------------------------------------------------------
  const syncStonesToBoard = useCallback((newBoard, scene) => {
    if (!scene || !newBoard) return;

    const currentStones = stonesRef.current;
    const incomingKeys = new Set();

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const player = newBoard[r][c];
        if (player !== 0) {
          const key = `${r},${c}`;
          incomingKeys.add(key);

          const existingMesh = currentStones.get(key);
          if (!existingMesh || existingMesh.userData.player !== player) {
            if (existingMesh) {
              scene.remove(existingMesh);
              if (existingMesh.geometry) existingMesh.geometry.dispose();
              if (existingMesh.material) existingMesh.material.dispose();
              currentStones.delete(key);
            }

            const mesh = createStoneMesh(r, c, player);
            scene.add(mesh);
            currentStones.set(key, mesh);
          }
        }
      }
    }

    // Remove meshes for cells that became empty (e.g. on new game reset)
    currentStones.forEach((mesh, key) => {
      if (!incomingKeys.has(key)) {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
        currentStones.delete(key);
      }
    });
  }, []);

  // Synchronize stones whenever board prop updates (e.g. on New Game reset from parent)
  useEffect(() => {
    if (sceneRef.current) {
      syncStonesToBoard(board, sceneRef.current);
    }
  }, [board, syncStonesToBoard]);

  // ---------------------------------------------------------------------------
  // AI MOVE GLOW RING SPAWNER
  // ---------------------------------------------------------------------------
  /**
   * Spawns a glowing cyan ring at the AI's move position that pulses and fades
   * over 1.5 seconds to highlight the newly placed stone.
   *
   * @param {number} row - Grid row of AI move
   * @param {number} col - Grid col of AI move
   * @param {THREE.Scene} scene - Active Three.js scene
   */
  const spawnAiGlowRing = useCallback((row, col, scene) => {
    const THREE = window.THREE;
    if (!THREE || !scene) return;

    // Ring dimensions: wraps comfortably around stone (stone radius is 0.44)
    const ringGeometry = new THREE.RingGeometry(0.48, 0.62, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Vibrant electric cyan glow
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevents z-fighting with board slab
    });

    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = -Math.PI / 2; // Lie flat on X-Z plane

    const worldPos = gridToWorld(row, col, 0.02);
    ringMesh.position.set(worldPos.x, worldPos.y, worldPos.z);

    scene.add(ringMesh);

    activeEffectsRef.current.push({
      mesh: ringMesh,
      startTime: performance.now(),
      duration: 1500, // 1.5 seconds
    });
  }, []);

  // ---------------------------------------------------------------------------
  // MAIN THREE.JS MOUNT & INTERACTION EFFECT
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !THREE.OrbitControls) {
      console.error('Three.js or OrbitControls CDN bundle is missing.');
      return;
    }

    const currentMount = mountRef.current;
    if (!currentMount) return;

    // 1. Scene Graph
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12141a);
    sceneRef.current = scene;

    // 2. Camera Setup
    const width = currentMount.clientWidth || window.innerWidth;
    const height = currentMount.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    const initialPos = CAMERA_PRESETS.isometric;
    camera.position.set(initialPos.x, initialPos.y, initialPos.z);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    currentMount.appendChild(renderer.domElement);

    // 4. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 0.85);
    keyLight.position.set(12, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9bc2e6, 0.35);
    fillLight.position.set(-12, 14, -10);
    scene.add(fillLight);

    // 5. 3D Board Addition
    const boardGroup = createBoard();
    scene.add(boardGroup);

    // Initial sync of stones from board prop
    syncStonesToBoard(boardRef.current, scene);

    // 6. OrbitControls Setup
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 6;
    controls.maxDistance = 30;
    controls.target.set(0, 0, 0);

    // 7. Raycaster Initialization
    const { raycaster, mouse } = createRaycaster();
    let pointerDownCoord = { x: 0, y: 0 };
    let lastInteractionTime = performance.now();

    const handlePointerDown = (event) => {
      lastInteractionTime = performance.now();
      pointerDownCoord = { x: event.clientX, y: event.clientY };
    };

    const handleInteractionActivity = () => {
      lastInteractionTime = performance.now();
    };

    // -------------------------------------------------------------------------
    // ASYNC CANVAS CLICK & OPTIMISTIC UI MOVE SUBMISSION HANDLER
    // -------------------------------------------------------------------------
    /**
     * VIVA EXAMINATION ARCHITECTURAL CONCEPT: OPTIMISTIC UI RENDERING
     * -------------------------------------------------------------------------
     * WHAT IS OPTIMISTIC UI RENDERING?
     * Optimistic UI rendering is a frontend engineering pattern where the client
     * updates its presentation layer immediately under the assumption that a network
     * request will succeed, prior to receiving authoritative confirmation from the server.
     *
     * WHY WE USE IT HERE (UX & PERCEIVED LATENCY):
     * The Gomoku AI executes a Minimax Alpha-Beta search with depth 3 evaluation that
     * explores hundreds or thousands of nodes, taking ~300–500ms on the backend.
     * - Without Optimistic Rendering: When the human clicks an intersection, the screen
     *   remains static for 500ms while awaiting the network round-trip. This produces
     *   a sluggish, unresponsive sensation.
     * - With Optimistic Rendering: The player's black stone (player 1) renders
     *   immediately (<16ms, within the current animation frame) upon click. The
     *   subsequent 300–500ms calculation period is perceived as the AI's natural
     *   "thinking time" rather than UI lag, providing instant tabletop tactile feedback.
     *
     * AVOIDING STALE CLOSURES IN THREE.JS EVENT LISTENERS:
     * In React, event listeners attached directly to DOM/canvas elements inside `useEffect`
     * capture state variables from the closure formed at mount time. If the click
     * listener directly read `board` or `isAiThinking`, it would forever inspect stale
     * initial states. We resolve this via two complementary mechanisms:
     * 1. State-mirroring mutable refs (`boardRef`, `isAiThinkingRef`, `winnerRef`).
     * 2. Synchronous ref updates: When the optimistic move is initiated, we update
     *    `boardRef.current = optimisticBoard` SYNCHRONOUSLY before invoking `setBoard()`.
     *    This guarantees that any subsequent rapid clicks or async operations immediately
     *    perceive the occupied cell without awaiting React's scheduled render cycle.
     *
     * RECONCILIATION & ROLLBACK GUARANTEE:
     * - Success Path: When the server returns the full authoritative 15x15 board,
     *   `syncStonesToBoard` diffs the server state against `stonesRef.current`. Because
     *   the player's stone already exists in `stonesRef`, it is not recreated (zero flicker),
     *   and only the AI's newly chosen stone mesh is instantiated in the scene.
     * - Failure / Network Error Path: In the `catch` block, we rollback the optimistic
     *   stone placement by zeroing `board[row][col] = 0` and calling `syncStonesToBoard`.
     *   The diffing engine automatically disposes of the geometry/material and removes
     *   the mesh from the Three.js scene graph, preserving client-server synchronization.
     */
    const handleCanvasClick = async (event) => {
      lastInteractionTime = performance.now();

      // Guard 1: Ignore drags from camera orbit
      const deltaX = event.clientX - pointerDownCoord.x;
      const deltaY = event.clientY - pointerDownCoord.y;
      if (Math.hypot(deltaX, deltaY) > 4) {
        return;
      }

      // Guard 2: Block input when AI is thinking or game has ended
      if (isAiThinkingRef.current || winnerRef.current !== null) {
        return;
      }

      // 1. Raycast to resolve targeted grid intersection
      const hitCell = getIntersectedGridCell(
        event,
        camera,
        renderer,
        boardGroup,
        raycaster,
        mouse
      );

      if (!hitCell) return;
      const { row, col } = hitCell;

      // Guard 3: Local occupancy check (prevents wasted network round-trip & illegal moves)
      if (boardRef.current[row][col] !== 0) {
        return;
      }

      // 2. OPTIMISTIC UI RENDERING:
      // Instantly place the human player's stone (player 1) in local state & 3D scene
      const optimisticBoard = boardRef.current.map((r) => [...r]);
      optimisticBoard[row][col] = 1;
      boardRef.current = optimisticBoard; // Synchronously update ref to prevent stale closures
      setBoard(optimisticBoard);          // Update React parent state
      syncStonesToBoard(optimisticBoard, scene); // Render stone immediately in Three.js (<16ms)

      // 3. Set AI thinking state
      setIsAiThinking(true);
      isAiThinkingRef.current = true;
      setStatusMessage('AI Thinking...');

      // 4. Submit move to Python backend
      const requestEpoch = sessionEpochRef ? sessionEpochRef.current : 0;
      try {
        const moveData = await makeMove(row, col, 1);

        // If user reset the game while AI was searching, discard this stale response
        if (sessionEpochRef && sessionEpochRef.current !== requestEpoch) {
          return;
        }

        // 5. Overwrite local state with authoritative full board from backend response
        boardRef.current = moveData.board;
        setBoard(moveData.board);
        syncStonesToBoard(moveData.board, scene);

        // 6. Extract and store AI thoughts in React state for sidebar visualization
        setAiThoughts({
          topMoves: moveData.top_moves || [],
          nodesEvaluated: moveData.nodes_evaluated || 0,
          timeMs: moveData.time_ms || 0,
          depth: moveData.depth || 3,
        });

        // 7. Spawn glowing highlight ring on AI's counter-move position
        if (moveData.ai_move) {
          spawnAiGlowRing(moveData.ai_move.row, moveData.ai_move.col, scene);
        }

        // 8. Check game outcome and display winner message
        if (moveData.winner !== null) {
          setWinner(moveData.winner);
          winnerRef.current = moveData.winner;
          console.log('Game ended! Winner:', moveData.winner);

          if (moveData.winner === 1) {
            setStatusMessage('Victory! You Won!');
          } else if (moveData.winner === 2) {
            setStatusMessage('Game Over: AI Won!');
          } else {
            setStatusMessage('Game Over: Draw!');
          }
        } else {
          setStatusMessage('Your Turn (Black)');
        }
      } catch (err) {
        console.error('Failed to submit move:', err);

        // 9. ERROR HANDLING / ROLLBACK:
        // Revert optimistic stone placement and dispose 3D mesh if backend request fails
        const revertedBoard = boardRef.current.map((r) => [...r]);
        revertedBoard[row][col] = 0;
        boardRef.current = revertedBoard;
        setBoard(revertedBoard);
        syncStonesToBoard(revertedBoard, scene);

        setStatusMessage(`Move error: ${err.message || 'Server unreachable'}. Move reverted.`);
      } finally {
        setIsAiThinking(false);
        isAiThinkingRef.current = false;
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handleInteractionActivity);
    renderer.domElement.addEventListener('wheel', handleInteractionActivity);
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 8. Animation Loop (Includes ambient idle drift & glow ring updates)
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Ambient slow camera drift when user is idle for 10+ seconds
      const now = performance.now();
      if (now - lastInteractionTime > 10000 && controls && !isAiThinkingRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
      } else if (controls) {
        controls.autoRotate = false;
      }

      controls.update();

      // Update active visual effects (AI Move Glow Ring)
      const effects = activeEffectsRef.current;
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        const elapsed = now - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1);

        // Fade opacity
        effect.mesh.material.opacity = (1 - progress) * 0.95;

        // Subtle outward pulse
        const scale = 1 + progress * 0.25;
        effect.mesh.scale.set(scale, scale, 1);

        // Dispose on completion
        if (progress >= 1) {
          scene.remove(effect.mesh);
          if (effect.mesh.geometry) effect.mesh.geometry.dispose();
          if (effect.mesh.material) effect.mesh.material.dispose();
          effects.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Handling via attachResizeHandler
    const detachResizeHandler = attachResizeHandler(camera, renderer, currentMount);

    // 10. Cleanup
    return () => {
      detachResizeHandler();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handleInteractionActivity);
      renderer.domElement.removeEventListener('wheel', handleInteractionActivity);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);

      controls.dispose();

      // Clean up glow rings
      activeEffectsRef.current.forEach((effect) => {
        scene.remove(effect.mesh);
        if (effect.mesh.geometry) effect.mesh.geometry.dispose();
        if (effect.mesh.material) effect.mesh.material.dispose();
      });
      activeEffectsRef.current = [];

      // Clean up stones
      stonesRef.current.forEach((mesh) => {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      });
      stonesRef.current.clear();

      // Clean up board
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [setAiThoughts, setBoard, setIsAiThinking, setStatusMessage, setWinner, spawnAiGlowRing, syncStonesToBoard]);

  // Camera preset switcher
  const setCameraView = (viewKey) => {
    const preset = CAMERA_PRESETS[viewKey];
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!preset || !camera || !controls) return;

    camera.position.set(preset.x, preset.y, preset.z);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
      }}
    >
      {/* Camera View Switcher Buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '8px',
          background: 'rgba(24, 26, 32, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setCameraView('isometric')}
          style={{
            background: 'transparent',
            color: '#d0d4dc',
            border: 'none',
            padding: '5px 12px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Perspective
        </button>
        <button
          onClick={() => setCameraView('topDown')}
          style={{
            background: 'transparent',
            color: '#d0d4dc',
            border: 'none',
            padding: '5px 12px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Top-Down
        </button>
        <button
          onClick={() => setCameraView('sideAngle')}
          style={{
            background: 'transparent',
            color: '#d0d4dc',
            border: 'none',
            padding: '5px 12px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Side Angle
        </button>
      </div>

      {/* Navigation Hints */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          color: '#848a99',
          fontSize: '11px',
          pointerEvents: 'none',
          userSelect: 'none',
          background: 'rgba(24, 26, 32, 0.7)',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 10,
        }}
      >
        Left Click: <strong>Orbit / Move</strong> &bull; Right Click: <strong>Pan</strong> &bull; Scroll: <strong>Zoom</strong>
      </div>
    </div>
  );
}
