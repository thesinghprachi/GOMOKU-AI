"""Gomoku Position Evaluation Module.

===============================================================================
WHY OPEN-ENDED PATTERNS ARE WEIGHTED SO MUCH HIGHER THAN BLOCKED ONES (VIVA NOTE)
===============================================================================
In Gomoku, tactical dominance is governed by "forcing threats" (initiative / sente).

1. OPEN THREE (. X X X .) vs BLOCKED THREE (O X X X . or edge):
   - An Open Three is an imminent DOUBLE-THREAT. Because both ends are open, playing
     on either end immediately turns it into an Open Four (. X X X X .).
   - An Open Four has two separate winning ends; since the opponent can only place
     one stone per turn, an Open Four is completely unstoppable and guarantees a win
     on the very next move.
   - Therefore, creating an Open Three forces the opponent to drop everything and
     block it immediately on their very next turn, or they lose. It dictates the game.
   - In contrast, a Blocked Three has only ONE open end. The player can at best turn
     it into a Blocked Four (O X X X X .). Because a Blocked Four only threatens one
     specific cell, the opponent can trivially defend it with a single stone on their
     subsequent turn. A Blocked Three is NOT an emergency.
   - This is why an Open Three (1,000) is weighted 10x higher than a Blocked Three (100).

2. OPEN FOUR (. X X X X .) vs BLOCKED FOUR (O X X X X .):
   - An Open Four guarantees immediate victory on the next move because neither player
     can block two ends at once. Its weight (100,000) is second only to a completed
     Five (1,000,000).
   - A Blocked Four can be defended with one stone. Its weight (10,000) reflects that
     it is a single-threat forcing move, but not an unconditional win.

3. DEAD PATTERNS (open_ends == 0):
   - Any run of length 4, 3, or 2 that is blocked on BOTH ends (e.g. O X X X O) can
     NEVER become a 5 in a row. It is functionally dead and awarded 0 points.
===============================================================================
"""

import sys
from pathlib import Path

# Ensure project root is in sys.path when running this script directly
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from typing import List, Dict, Tuple
from game.board import Board

# ---------------------------------------------------------------------------
# Module-level Pattern Weights
# ---------------------------------------------------------------------------
FIVE: int = 1000000
OPEN_FOUR: int = 100000
BLOCKED_FOUR: int = 10000
OPEN_THREE: int = 1000
BLOCKED_THREE: int = 100
OPEN_TWO: int = 10

# The 4 standard directional ray vectors to traverse all possible Gomoku lines:
# Horizontal (→), Vertical (↓), Main Diagonal (\), Anti-Diagonal (/)
DIRECTIONS: List[Tuple[int, int]] = [
    (0, 1),   # Horizontal
    (1, 0),   # Vertical
    (1, 1),   # Main Diagonal (\)
    (1, -1),  # Anti-Diagonal (/)
]


def count_direction(
    board: Board, row: int, col: int, player: int, d_row: int, d_col: int
) -> Dict[str, int]:
    r"""Count the contiguous run length and open ends for a player starting at (row, col).

    Args:
        board (Board): The current Gomoku board instance.
        row (int): Starting row coordinate of the run.
        col (int): Starting col coordinate of the run.
        player (int): Player stone ID (1=Black, 2=White).
        d_row (int): Row step vector.
        d_col (int): Column step vector.

    Returns:
        Dict[str, int]: Dictionary containing:
            - 'length': Number of contiguous stones of `player`.
            - 'open_ends': 0, 1, or 2 indicating how many ends are open.

    What it does:
        1. Starting from (row, col), steps forward along (d_row, d_col), counting
           consecutive stones matching `player`.
        2. Inspects the cell immediately beyond the far end of the run.
        3. Inspects the cell immediately before the start of the run.
        4. Classifies each end as open (within board bounds AND empty / 0) or blocked.
    """
    length = 0
    curr_r = row
    curr_c = col
    size = board.size

    # Walk in the positive direction (d_row, d_col) as long as we see player's stones
    while 0 <= curr_r < size and 0 <= curr_c < size and board.grid[curr_r][curr_c] == player:
        length += 1
        curr_r += d_row
        curr_c += d_col

    # -----------------------------------------------------------------------
    # OPEN_ENDS CLASSIFICATION STEP (VIVA EXPLANATION)
    # -----------------------------------------------------------------------
    # To determine how many open ends this run has (0, 1, or 2):
    # - "Before start": Cell located at (row - d_row, col - d_col).
    # - "After end": Cell located at (curr_r, curr_c), which is where the loop stopped.
    # An end is OPEN if and only if:
    #   1. It is within board boundaries (not blocked by the board border), AND
    #   2. The cell contains 0 (empty, not blocked by the opponent).
    # If an end is off-board OR contains an opponent stone, it is BLOCKED.
    prev_r = row - d_row
    prev_c = col - d_col

    open_before = (
        0 <= prev_r < size
        and 0 <= prev_c < size
        and board.grid[prev_r][prev_c] == 0
    )
    open_after = (
        0 <= curr_r < size
        and 0 <= curr_c < size
        and board.grid[curr_r][curr_c] == 0
    )

    open_ends = (1 if open_before else 0) + (1 if open_after else 0)

    return {"length": length, "open_ends": open_ends}


def find_all_runs(board: Board, player: int) -> List[Dict[str, int]]:
    r"""Scan the board and find all maximal contiguous runs of `player`'s stones.

    Args:
        board (Board): The Gomoku board.
        player (int): Player stone ID (1=Black, 2=White).

    Returns:
        List[Dict[str, int]]: List of dicts with 'length' and 'open_ends'.

    What it does:
        - Scans every intersection on the board.
        - For each cell belonging to `player`, checks the 4 ray directions:
          (0, 1), (1, 0), (1, 1), and (1, -1).
        - Applies backward de-duplication to guarantee each contiguous run is counted
          exactly once from its starting head.
    """
    runs: List[Dict[str, int]] = []
    size = board.size

    # Fast path: If move_history is populated (standard in game loops and minimax),
    # iterate only the stones placed on the board instead of scanning all 225 grid cells.
    if board.move_history:
        for r, c, p in board.move_history:
            if p != player:
                continue

            for dr, dc in DIRECTIONS:
                # RUN DE-DUPLICATION STEP (VIVA EXPLANATION)
                # Only initiate counting at the true head of the run.
                prev_r = r - dr
                prev_c = c - dc
                if (
                    0 <= prev_r < size
                    and 0 <= prev_c < size
                    and board.grid[prev_r][prev_c] == player
                ):
                    continue

                run_data = count_direction(board, r, c, player, dr, dc)
                runs.append(run_data)
        return runs

    # Fallback: Scan full grid if move_history is empty (e.g. arbitrary direct grid mutation)
    for r in range(size):
        for c in range(size):
            if board.grid[r][c] != player:
                continue

            for dr, dc in DIRECTIONS:
                prev_r = r - dr
                prev_c = c - dc
                if (
                    0 <= prev_r < size
                    and 0 <= prev_c < size
                    and board.grid[prev_r][prev_c] == player
                ):
                    continue

                run_data = count_direction(board, r, c, player, dr, dc)
                runs.append(run_data)

    return runs


def classify_and_score(runs: List[Dict[str, int]]) -> int:
    """Map extracted runs to weighted heuristic scores according to Gomoku patterns.

    Args:
        runs (List[Dict[str, int]]): List of runs with 'length' and 'open_ends'.

    Returns:
        int: Total heuristic score for the player.

    Scoring Rules:
        - length >= 5: FIVE (1,000,000)
        - length == 4, open_ends == 2: OPEN_FOUR (100,000)
        - length == 4, open_ends == 1: BLOCKED_FOUR (10,000)
        - length == 4, open_ends == 0: 0 (Dead 4, cannot form 5)
        - length == 3, open_ends == 2: OPEN_THREE (1,000)
        - length == 3, open_ends == 1: BLOCKED_THREE (100)
        - length == 3, open_ends == 0: 0 (Dead 3)
        - length == 2, open_ends == 2: OPEN_TWO (10)
        - length == 2, open_ends == 1: 0 (Blocked Two - see simplification note below)
        - length < 2: 0
    """
    total_score = 0

    for run in runs:
        length = run["length"]
        open_ends = run["open_ends"]

        if length >= 5:
            total_score += FIVE
        elif length == 4:
            if open_ends == 2:
                total_score += OPEN_FOUR
            elif open_ends == 1:
                total_score += BLOCKED_FOUR
            # open_ends == 0 is dead (blocked on both sides), score 0
        elif length == 3:
            if open_ends == 2:
                total_score += OPEN_THREE
            elif open_ends == 1:
                total_score += BLOCKED_THREE
            # open_ends == 0 is dead, score 0
        elif length == 2:
            if open_ends == 2:
                total_score += OPEN_TWO
            # ---------------------------------------------------------------
            # SIMPLIFICATION NOTE (VIVA EXPLANATION):
            # length == 2 with open_ends == 1 (Blocked Two) is scored 0.
            # A blocked two has only one open end and requires 3 additional
            # uninterrupted moves in that single direction to form a 5.
            # In competitive Gomoku, this provides virtually zero immediate or
            # latent pressure. Ignoring blocked twos keeps the evaluation function
            # fast, reduces noise in minimax tree leaves, and focuses search on
            # genuine threats.
            # ---------------------------------------------------------------
        # length < 2 contributes 0 points

    return total_score


def evaluate_board(board: Board, ai_player: int) -> int:
    """Compute the static heuristic score of the board relative to ai_player.

    Args:
        board (Board): The Gomoku board state.
        ai_player (int): AI player ID (1 for Black, 2 for White).

    Returns:
        int: Net score (ai_score - opponent_score). Positive scores favor ai_player;
            negative scores favor the opponent.

    What it does:
        - Determines the opponent's ID (1 if ai_player is 2, else 2).
        - Extracts and scores all runs for `ai_player`.
        - Extracts and scores all runs for `opponent`.
        - Returns `ai_score - opp_score`.

    Why it is implemented this way:
        - Zero-sum relative evaluation is standard for Minimax / Alpha-Beta algorithms.
        - By subtracting opponent score, the AI naturally values both advancing its own
          offensive threats and countering opponent threats proportionally to their urgency.
    """
    opponent = 2 if ai_player == 1 else 1

    ai_runs = find_all_runs(board, ai_player)
    opp_runs = find_all_runs(board, opponent)

    ai_score = classify_and_score(ai_runs)
    opp_score = classify_and_score(opp_runs)

    return ai_score - opp_score


if __name__ == "__main__":
    print("================================================================")
    print("      GomokuAI-Agent: Phase 2 Position Evaluation Verification  ")
    print("================================================================")

    # -------------------------------------------------------------------
    # a) Manually placed OPEN THREE (. X X X .)
    # -------------------------------------------------------------------
    print("\n[Case A] OPEN THREE Test (. X X X . horizontally):")
    board_open_three = Board(size=15)
    # Place Black (1) stones at (7, 6), (7, 7), (7, 8)
    # (7, 5) and (7, 9) are empty -> open_ends = 2
    board_open_three.place_stone(7, 6, player=1)
    board_open_three.place_stone(7, 7, player=1)
    board_open_three.place_stone(7, 8, player=1)

    score_open_three = evaluate_board(board_open_three, ai_player=1)
    board_open_three.display()
    print(f"Board Score (AI=Black): {score_open_three} (Expected: ~{OPEN_THREE})")
    assert score_open_three == OPEN_THREE, f"Expected {OPEN_THREE}, got {score_open_three}"
    print("=> Confirmed: Open Three successfully evaluated at OPEN_THREE (1,000)!")

    # -------------------------------------------------------------------
    # b) Manually placed BLOCKED THREE (O X X X .)
    # -------------------------------------------------------------------
    print("\n[Case B] BLOCKED THREE Test (White blocks left: O X X X .):")
    board_blocked_three = Board(size=15)
    # White (2) blocks at (7, 5)
    board_blocked_three.place_stone(7, 5, player=2)
    # Black (1) stones at (7, 6), (7, 7), (7, 8)
    board_blocked_three.place_stone(7, 6, player=1)
    board_blocked_three.place_stone(7, 7, player=1)
    board_blocked_three.place_stone(7, 8, player=1)

    score_blocked_three = evaluate_board(board_blocked_three, ai_player=1)
    board_blocked_three.display()
    # Black has BLOCKED_THREE (100). White has single stone length 1 (score 0).
    print(f"Board Score (AI=Black): {score_blocked_three} (Expected: ~{BLOCKED_THREE})")
    assert score_blocked_three == BLOCKED_THREE, f"Expected {BLOCKED_THREE}, got {score_blocked_three}"
    print(
        f"=> Confirmed: Blocked Three scored {score_blocked_three}, which is "
        f"10x lower than Open Three ({OPEN_THREE})!"
    )

    # -------------------------------------------------------------------
    # c) Manually placed OPEN FOUR (. X X X X .)
    # -------------------------------------------------------------------
    print("\n[Case C] OPEN FOUR Test (. X X X X . horizontally):")
    board_open_four = Board(size=15)
    for c in range(6, 10):
        board_open_four.place_stone(7, c, player=1)

    score_open_four = evaluate_board(board_open_four, ai_player=1)
    board_open_four.display()
    print(f"Board Score (AI=Black): {score_open_four} (Expected: ~{OPEN_FOUR})")
    assert score_open_four == OPEN_FOUR, f"Expected {OPEN_FOUR}, got {score_open_four}"
    print("=> Confirmed: Open Four successfully evaluated at OPEN_FOUR (100,000)!")

    # -------------------------------------------------------------------
    # d) Comparison & Multi-Pattern Verification
    # -------------------------------------------------------------------
    print("\n[Case D] Relative Score Summary:")
    print(f"  - Empty Board:         {evaluate_board(Board(15), ai_player=1)}")
    print(f"  - Open Two:            {OPEN_TWO}")
    print(f"  - Blocked Three:       {BLOCKED_THREE}")
    print(f"  - Open Three:          {OPEN_THREE}")
    print(f"  - Blocked Four:        {BLOCKED_FOUR}")
    print(f"  - Open Four:           {OPEN_FOUR}")
    print(f"  - Five in a Row:       {FIVE}")
    print("\nAll Phase 2 evaluation assertions passed successfully!")
