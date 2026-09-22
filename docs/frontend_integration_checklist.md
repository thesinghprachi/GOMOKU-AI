# React Frontend Integration Checklist

This guide provides the exact, step-by-step manual procedure to connect your React (or Three.js / Vite) frontend to the GomokuAI-Agent FastAPI backend.

---

## 1. Start the Backend on `127.0.0.1:8000`

Run the backend server using Uvicorn from the project root:

```bash
# Windows
.venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000

# macOS / Linux
.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> [!IMPORTANT]
> **Use `http://127.0.0.1:8000`, NOT `http://localhost:8000`**
>
> In browser security specifications (RFC 6454), `127.0.0.1` and `localhost` are treated as **different origins** even though they resolve to the loopback interface on the same machine.
> - If your frontend server runs on `http://localhost:5173` and requests `http://127.0.0.1:8000`, or vice versa, the browser enforces strict CORS cross-origin rules.
> - Inconsistency between `localhost` and `127.0.0.1` is the **#1 most common failure mode** in local full-stack development. Keep both your frontend API client and your backend host on `127.0.0.1` uniformly.

Verify the server is reachable by navigating to:
- Health check: [http://127.0.0.1:8000](http://127.0.0.1:8000) (should return `{"status": "GomokuAI-Agent backend running"}`)
- Swagger UI docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 2. Verify Frontend API Client Configuration

Check your frontend project's API service file, environment variable (`.env`), or Axios instance configuration:

```typescript
// e.g., src/config/api.ts or src/services/gameService.ts
export const API_BASE_URL = "http://127.0.0.1:8000"; // Ensure exact match
```

Ensure the endpoints match the backend contracts:
- `POST ${API_BASE_URL}/new_game`
- `POST ${API_BASE_URL}/move`
- `POST ${API_BASE_URL}/ai_move`

---

## 3. Network Tab Inspection (DevTools)

1. Open your browser and navigate to your React app (e.g. `http://127.0.0.1:5173`).
2. Press `F12` (or Right-Click → **Inspect**) and switch to the **Network** tab.
3. Click an intersection on the 3D board to trigger a human move.
4. Verify the outgoing HTTP request:
   - **Request URL**: `http://127.0.0.1:8000/move`
   - **Method**: `POST`
   - **Status**: `200 OK`
   - **Request Payload**:
     ```json
     {
       "row": 7,
       "col": 7,
       "player": 1
     }
     ```
5. Select the network request and inspect the **Response** tab. Verify all required JSON fields are present:
   ```json
   {
     "board": [[...]],        // 15x15 2D integer array (0=empty, 1=black, 2=white)
     "ai_move": {             // Coordinate of the AI's counter-move
       "row": 6,
       "col": 7
     },
     "top_moves": [           // Up to top 3 candidate moves with Gomoku notation
       { "coordinate": "H7", "score": 100 }
     ],
     "nodes_evaluated": 4522, // Total minimax tree nodes explored
     "time_ms": 257,          // Wall-clock search duration in milliseconds
     "depth": 3,              // Search depth limit
     "winner": null           // 1 (Human), 2 (AI), 0 (Draw), or null (In progress)
   }
   ```

---

## 4. Console Tab & CORS Error Checking

Switch to the **Console** tab in browser DevTools:
- Check for any red error text stating:
  > *"Access to fetch at 'http://127.0.0.1:8000/move' from origin 'http://localhost:5173' has been blocked by CORS policy"*
- **Resolution**:
  - `main.py` is configured with `allow_origins=["*"]`, which permits all origins during development.
  - If a CORS error still occurs, ensure the frontend is not using a custom header that requires explicit allowlisting or that requests are correctly using `http://127.0.0.1:8000`.

---

## 5. End-to-End Visual Loop Verification

Perform a complete manual playtest through the React UI:

1. **Game Start**:
   - Refresh the page or click "New Game".
   - Confirm the 3D board clears and renders 225 empty intersections.
2. **Human Turn**:
   - Click cell `(7, 7)` (center).
   - Confirm a Black stone (`player 1`) immediately renders at `(7, 7)`.
3. **AI Thinking State**:
   - Confirm your UI displays a loading indicator or "AI is thinking..." state.
4. **AI Counter-Move**:
   - Within < 1 second, a White stone (`player 2`) should appear on the board at the coordinate specified in `data.ai_move`.
5. **HUD / Sidebar Telemetry**:
   - Verify the telemetry panel updates with:
     - **Nodes Evaluated**: e.g. `~1,000 - 4,500`
     - **Thinking Time**: e.g. `~200 - 700 ms`
     - **Top Evaluated Moves**: e.g. `H7 (score: 100)`
6. **Victory / Game Over**:
   - Play to a 5-in-a-row (or set up a winning line).
   - Confirm the winner banner displays ("Human Wins!" or "AI Wins!") and further board clicks are disabled.
