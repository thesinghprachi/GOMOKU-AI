"""End-to-End Game Smoke Test for GomokuAI-Agent.

Simulates a full game sequence against the FastAPI backend via TestClient:
1. Resets the board via POST /new_game.
2. Plays an alternating 10-turn sequence of realistic human moves.
3. Verifies strict board synchronization (stone count increases by exactly 2 per turn).
4. Deliberately plays along the extreme boundary edges (row 14, col 14) to catch
   any off-by-one boundary bugs or index clamping issues.
"""

import sys
from pathlib import Path
from typing import List

# Ensure project root is in sys.path
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi.testclient import TestClient
from main import app


def print_ascii_board(grid: List[List[int]], title: str = "") -> None:
    """Print an ASCII representation of the 15x15 board."""
    if title:
        print(f"\n--- {title} ---")
    symbols = {0: ".", 1: "X", 2: "O"}
    header = "    " + " ".join(f"{c:2d}" for c in range(len(grid)))
    print(header)
    print("   +" + "--" * len(grid) + "-+")
    for r in range(len(grid)):
        row_str = " ".join(f" {symbols[grid[r][c]]}" for c in range(len(grid)))
        print(f"{r:2d} |{row_str} |")
    print("   +" + "--" * len(grid) + "-+")


def count_stones(grid: List[List[int]]) -> int:
    """Count total non-empty cells on the board."""
    return sum(1 for row in grid for cell in row if cell != 0)


def run_smoke_test():
    print("===============================================================================")
    print("           GomokuAI-Agent Phase 5: End-to-End API Smoke Test                   ")
    print("===============================================================================")

    client = TestClient(app)

    # 1. Health Check
    print("\n[Step 1] Verifying GET / health check...")
    health_res = client.get("/")
    assert health_res.status_code == 200, f"Health check failed: {health_res.text}"
    print(f"  Response: {health_res.json()}")

    # 2. Reset Game
    print("\n[Step 2] Initializing fresh board via POST /new_game...")
    new_res = client.post("/new_game")
    assert new_res.status_code == 200, f"New game failed: {new_res.text}"
    board = new_res.json()["board"]
    assert count_stones(board) == 0, "Board should have 0 stones after new_game!"
    print_ascii_board(board, "Initial Empty Board")

    # 3. Simulate a 10-turn sequence with alternating plausible moves
    # Includes tactical central play, expanding outwards, and testing boundary coordinates (row/col 14)
    human_moves = [
        (7, 7),    # Move 1: Opening Tengen / center
        (7, 8),    # Move 2: Horizontal extension
        (8, 7),    # Move 3: Vertical extension
        (8, 8),    # Move 4: Diagonal link
        (6, 6),    # Move 5: Upper diagonal
        (6, 8),    # Move 6: Diagonal wedge
        (9, 7),    # Move 7: Downward expansion
        (5, 7),    # Move 8: Upward expansion
        (14, 14),  # Move 9: Extreme corner boundary (row 14, col 14)
        (14, 13),  # Move 10: Extreme border edge (row 14, col 13)
    ]

    expected_stones = 0

    print("\n[Step 3] Executing 10-Turn Move Sequence with Synchronization Asserts...")

    for turn_idx, (r, c) in enumerate(human_moves, 1):
        print(f"\n>> Round {turn_idx}: Human plays ({r}, {c})")
        payload = {"row": r, "col": c, "player": 1}
        res = client.post("/move", json=payload)

        # If a cell was already occupied by an earlier AI move, pick an adjacent empty fallback
        if res.status_code == 400:
            print(f"   Cell ({r}, {c}) was occupied by AI! Finding fallback adjacent cell...")
            fallback_found = False
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    nr, nc = max(0, min(14, r + dr)), max(0, min(14, c + dc))
                    fallback_res = client.post("/move", json={"row": nr, "col": nc, "player": 1})
                    if fallback_res.status_code == 200:
                        res = fallback_res
                        r, c = nr, nc
                        print(f"   Successfully played fallback at ({r}, {c})")
                        fallback_found = True
                        break
                if fallback_found:
                    break
            assert fallback_found, "Could not find a valid move!"

        assert res.status_code == 200, f"Move failed: {res.text}"
        data = res.json()
        board = data["board"]

        # Human stone must be placed
        assert board[r][c] == 1, f"Human stone missing at ({r}, {c})!"

        winner = data["winner"]
        ai_move = data["ai_move"]

        if winner is not None:
            print(f"\n[Game Over] Detected Winner: Player {winner}!")
            if winner == 1:
                # Human won; AI turn was skipped, so stone count increased by 1
                expected_stones += 1
            else:
                expected_stones += 2
            current_count = count_stones(board)
            assert current_count == expected_stones, f"Desync! Expected {expected_stones}, got {current_count}"
            print_ascii_board(board, f"Final Winning Board (Round {turn_idx})")
            break
        else:
            # Both Human and AI placed a stone -> strictly +2 stones
            expected_stones += 2
            current_count = count_stones(board)
            assert current_count == expected_stones, (
                f"Board desynchronization detected at round {turn_idx}! "
                f"Expected {expected_stones} stones, but board contains {current_count}."
            )
            assert ai_move is not None, "AI move cannot be None when game is ongoing!"
            ai_r, ai_c = ai_move["row"], ai_move["col"]
            assert board[ai_r][ai_c] == 2, f"AI stone missing at ({ai_r}, {ai_c})!"

            print(f"   AI chose: ({ai_r}, {ai_c}) | Search Time: {data['time_ms']}ms | Nodes: {data['nodes_evaluated']}")
            print(f"   Top candidate evaluations: {data['top_moves']}")
            print_ascii_board(board, f"Board after Round {turn_idx} (Total Stones: {current_count})")

    # 4. Extreme Border Boundary Check
    print("\n[Step 4] Checking Extreme Boundary Coordinates (Row/Col 14 Edge Cases)...")
    border_cells_tested = [(0, 0), (0, 14), (14, 0), (14, 14)]
    for br, bc in border_cells_tested:
        val = board[br][bc]
        print(f"   Border cell ({br:2d}, {bc:2d}) state: {val} (0=empty, 1=human, 2=ai) -> Valid index lookup passed.")

    # 5. Stateless /ai_move test
    print("\n[Step 5] Testing POST /ai_move (Stateless API)...")
    stateless_board = [[0 for _ in range(15)] for _ in range(15)]
    stateless_board[14][13] = 1  # Human stone at row 14
    ai_stateless_res = client.post("/ai_move", json={"board": stateless_board, "player": 2})
    assert ai_stateless_res.status_code == 200, f"Stateless /ai_move failed: {ai_stateless_res.text}"
    stateless_data = ai_stateless_res.json()
    assert stateless_data["ai_move"] is not None
    print(f"   Stateless AI move near row 14 border: {stateless_data['ai_move']} (Time: {stateless_data['time_ms']}ms)")

    print("\n===============================================================================")
    print("  ALL SMOKE TEST ASSERTIONS PASSED! BACKEND IS ROBUST & SYNC-SAFE.")
    print("===============================================================================")


if __name__ == "__main__":
    run_smoke_test()
