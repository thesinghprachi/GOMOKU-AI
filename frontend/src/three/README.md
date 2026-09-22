# Three.js Helper Logic Directory (`src/three/`)

## Architectural Separation of Concerns (Viva Explanation)

In this project, raw Three.js 3D graphics logic is kept strictly isolated in `src/three/` rather than mixed directly into React component JSX files.

### Why this design separation matters:

1. **Imperative vs. Declarative Paradigm Clash**:
   - **React** is a *declarative* framework: components describe what the UI should look like based on state, and React handles rendering and diffing.
   - **Three.js** is an *imperative* state-machine API: objects, meshes, materials, and lights are explicitly constructed, mutated in-place, attached to parent scene graphs, and drawn frame-by-frame via WebGL.
   - Mixing dozens of lines of imperative Three.js allocations, matrix transformations, and animation callbacks directly into React JSX component bodies creates bloated, unreadable code that is difficult to test and maintain.

2. **Lifecycle & Memory Management**:
   - WebGL contexts and Three.js allocations (geometries, textures, materials, and render targets) reside in GPU VRAM and are **not** automatically cleaned up by JavaScript's garbage collector.
   - By organizing 3D builders, shaders, stone placement maths, and board geometry in `src/three/`, we can cleanly expose initialization and explicit `.dispose()` teardown functions for React's `useEffect` hooks to invoke.

3. **Reusability across Frontend Phases**:
   - As we transition from Phase 1 (Smoke Test) to Phase 2 (Gomoku Board Construction) and Phase 3 (Interactive Raycasting & Stone Placement), the 3D scene modules in `src/three/` can be reused or tested independently of React UI component state.
