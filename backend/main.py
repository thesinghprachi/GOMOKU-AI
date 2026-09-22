"""GomokuAI-Agent: FastAPI Backend Service.

===============================================================================
API ENDPOINTS & CONTRACTS SUMMARY (VIVA OVERVIEW)
===============================================================================
This FastAPI backend exposes three core endpoints for local Gomoku gameplay:

1. GET /
   - Health-check endpoint. Returns server status string.
   - Response: {"status": "GomokuAI-Agent backend running"}

2. POST /new_game
   - Resets the server's global board session to a fresh 15x15 empty grid.
   - Response: {"board": List[List[int]]} (225 cells initialized to 0)

3. POST /move
   - Stateful gameplay endpoint for human turns (Player 1 by contract).
   - Request Body: MoveRequest(row: int, col: int, player: int)
   - Flow:
       a. Validates coordinates via board.is_valid_move(). Returns HTTP 400 if illegal.
       b. Places the human's stone on the persistent global board.
       c. Checks if human won. If won, skips AI turn and sets "winner": player.
       d. Dispatches AI search: find_best_move(board, ai_player=2, depth=3).
       e. Applies AI's chosen move and checks if AI achieved victory.
   - Response:
       {
           "board": List[List[int]],
           "ai_move": {"row": int, "col": int} | None,
           "top_moves": [{"coordinate": str, "score": int}, ...],
           "nodes_evaluated": int,
           "time_ms": int,
           "depth": int,
           "winner": int | None  # 1: Human won, 2: AI won, 0: Draw, None: In progress
       }

4. POST /ai_move
   - Stateless move generator. Accepts an arbitrary 2D board matrix from the client.
   - Request Body: AIMoveRequest(board: List[List[int]], player: int)
   - Flow:
       a. Reconstitutes a temporary Board instance using Board.load_from_list().
       b. Computes best move via Minimax Alpha-Beta without mutating global state.
       c. Returns identical response shape as /move.

Interactive Swagger documentation is auto-generated at: http://127.0.0.1:8000/docs
===============================================================================
"""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure project root is in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from game.board import Board
from ai.minimax import find_best_move

# Initialize FastAPI application
app = FastAPI(
    title="GomokuAI-Agent API",
    description="High-performance Python backend for 3D Gomoku featuring Minimax & Alpha-Beta pruning.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS CONFIGURATION (VIVA / SECURITY EXPLANATION)
# ---------------------------------------------------------------------------
# Setting allow_origins=["*"], allow_methods=["*"], and allow_headers=["*"] is
# configured strictly for local development to allow communication with frontend
# development servers (e.g. Vite, React, Three.js running on localhost:5173 or 3000).
#
# PRODUCTION WARNING:
# In a production environment with sensitive user data, wildcards ("*") introduce
# significant Cross-Origin vulnerabilities. A production deployment MUST specify
# an explicit allowlist of trusted origin domains (e.g. ["https://gomoku-ai.example.com"]).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# GLOBAL GAME STATE (VIVA EXPLANATION)
# ---------------------------------------------------------------------------
# We maintain a single module-level `current_board` instance representing the active game.
#
# WHY THIS IS ACCEPTABLE HERE:
#   This application is built as a local, single-player desktop game where one human
#   interacts with the AI backend on localhost. There is only one game session active at
#   a time, so a simple global variable operates correctly and without concurrency conflicts.
#
# PRODUCTION ARCHITECTURAL LIMITATION:
#   In a multi-user production system, a global variable is NOT thread-safe across different
#   users (User A's moves would overwrite User B's game!). A production architecture
#   would manage state using session IDs or JWTs, storing individual board states in an
#   external store (e.g., Redis cache or PostgreSQL database) keyed by `session_id`.
current_board: Board = Board(size=15)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------
class MoveRequest(BaseModel):
    """Payload for submitting a human player move."""

    row: int = Field(..., ge=0, le=14, description="0-indexed row coordinate (0-14)")
    col: int = Field(..., ge=0, le=14, description="0-indexed column coordinate (0-14)")
    player: int = Field(1, description="Player identifier: 1 for Black (Human), 2 for White (AI)")


class AIMoveRequest(BaseModel):
    """Payload for requesting an AI move from an arbitrary board state."""

    board: List[List[int]] = Field(..., description="15x15 2D matrix of integers (0=empty, 1=black, 2=white)")
    player: int = Field(..., description="Player identifier whose turn it is to move")


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check() -> Dict[str, str]:
    """Health-check endpoint for server verification."""
    return {"status": "GomokuAI-Agent backend running"}


@app.post("/new_game")
@app.post("/new-game")
def new_game() -> Dict[str, Any]:
    """Reset the global board session to a fresh 15x15 empty grid."""
    global current_board
    current_board = Board(size=15)
    return {"board": current_board.to_list()}


@app.post("/move")
def make_move(move_req: MoveRequest) -> Dict[str, Any]:
    """Process a human player move and return the updated board and AI counter-move."""
    global current_board
    row, col, player = move_req.row, move_req.col, move_req.player

    # 1. Validate human move
    if not current_board.is_valid_move(row, col):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid move at ({row}, {col}): cell is out of bounds or already occupied.",
        )

    # 2. Apply human move to persistent board
    current_board.place_stone(row, col, player)

    # 3. Check if human won immediately with this stone
    if current_board.check_win(row, col, player):
        # Human won! Game ends immediately; skip AI counter-move
        # Note: 'winner' field added to inform frontend of game termination
        return {
            "board": current_board.to_list(),
            "ai_move": None,
            "top_moves": [],
            "nodes_evaluated": 0,
            "time_ms": 0,
            "depth": 3,
            "winner": player,
        }

    # Check for draw
    if current_board.is_full():
        return {
            "board": current_board.to_list(),
            "ai_move": None,
            "top_moves": [],
            "nodes_evaluated": 0,
            "time_ms": 0,
            "depth": 3,
            "winner": 0,  # 0 indicates a drawn game
        }

    # 4. Determine AI player number (the opponent of human)
    ai_player = 2 if player == 1 else 1

    # 5. Compute AI counter-move via Minimax Alpha-Beta search
    try:
        ai_result = find_best_move(current_board, ai_player=ai_player, depth=3)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI search computation failed: {str(exc)}",
        )

    ai_move = ai_result["ai_move"]
    winner: Optional[int] = None

    if ai_move is not None:
        ai_row, ai_col = ai_move["row"], ai_move["col"]
        current_board.place_stone(ai_row, ai_col, ai_player)

        # Check if AI move completed a winning line
        if current_board.check_win(ai_row, ai_col, ai_player):
            winner = ai_player
        elif current_board.is_full():
            winner = 0  # Draw
    else:
        if current_board.is_full():
            winner = 0

    return {
        "board": current_board.to_list(),
        "ai_move": ai_result["ai_move"],
        "top_moves": ai_result["top_moves"],
        "nodes_evaluated": ai_result["nodes_evaluated"],
        "time_ms": ai_result["time_ms"],
        "depth": ai_result["depth"],
        "winner": winner,
    }


@app.post("/ai_move")
@app.post("/ai-move")
def compute_ai_move(ai_req: AIMoveRequest) -> Dict[str, Any]:
    """Stateless endpoint: compute optimal AI move for an arbitrary board state."""
    # Reconstitute incoming grid into a temporary Board instance
    try:
        temp_board = Board.load_from_list(ai_req.board)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Malformed board array: {str(exc)}",
        )

    ai_player = ai_req.player

    # Compute best move for the requested player
    try:
        ai_result = find_best_move(temp_board, ai_player=ai_player, depth=3)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI search computation failed: {str(exc)}",
        )

    ai_move = ai_result["ai_move"]
    winner: Optional[int] = None

    if ai_move is not None:
        ai_row, ai_col = ai_move["row"], ai_move["col"]
        temp_board.place_stone(ai_row, ai_col, ai_player)

        if temp_board.check_win(ai_row, ai_col, ai_player):
            winner = ai_player
        elif temp_board.is_full():
            winner = 0
    else:
        if temp_board.is_full():
            winner = 0

    return {
        "board": temp_board.to_list(),
        "ai_move": ai_result["ai_move"],
        "top_moves": ai_result["top_moves"],
        "nodes_evaluated": ai_result["nodes_evaluated"],
        "time_ms": ai_result["time_ms"],
        "depth": ai_result["depth"],
        "winner": winner,
    }


if __name__ == "__main__":
    import uvicorn

    banner = """
===============================================================================
                     GomokuAI-Agent FastAPI Server
===============================================================================
  Server URL:        http://127.0.0.1:8000
  Swagger UI Docs:   http://127.0.0.1:8000/docs
  ReDoc Docs:        http://127.0.0.1:8000/redoc

  Available Endpoints:
    • GET  /          -> Root Health-Check status probe
    • POST /new_game  -> Reset game to fresh 15x15 board
    • POST /move      -> Stateful human turn & AI minimax counter-move
    • POST /ai_move   -> Stateless move calculation on arbitrary board matrix

  Note for Viva Demo:
    Open http://127.0.0.1:8000/docs in your browser to execute live endpoint tests!
===============================================================================
"""
    print(banner)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
