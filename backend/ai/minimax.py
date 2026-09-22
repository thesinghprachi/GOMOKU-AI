"""Minimax Search with Alpha-Beta Pruning for Gomoku.

===============================================================================
VIVA EXPLANATION: MINIMAX & ALPHA-BETA PRUNING IN GOMOKU
===============================================================================
1. Minimax Formulation:
   - Gomoku is a zero-sum, perfect-information game.
   - The AI (Maximizer) selects moves that maximize the heuristic evaluation score.
   - The Opponent (Minimizer) is assumed to play rationally, choosing moves that
     minimize the AI's score.
   - The game tree alternates between maximizing and minimizing plies.

2. Mathematical Invariance of Alpha-Beta Pruning:
   - "Does Alpha-Beta pruning change the best move choice compared to plain Minimax?"
     ANSWER: NO, NEVER.
   - Plain Minimax explores every reachable branch exhaustively.
   - Alpha-Beta pruning maintains two bounds:
       - alpha: the best (highest) value the maximizer is currently guaranteed.
       - beta: the best (lowest) value the minimizer is currently guaranteed.
   - Whenever beta <= alpha, we encounter a condition where one player already has
     a superior alternative earlier in the search tree. That player will never allow
     play to enter this sub-branch.
   - Because these pruned sub-trees are provably irrelevant to the root minimax value,
     the root decision and score returned by Alpha-Beta pruning are MATHEMATICALLY
     IDENTICAL to an exhaustive, unpruned Minimax search, but achieved in a fraction
     of the time.
===============================================================================
"""

import sys
import time
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

# Ensure project root is in sys.path when running this script directly
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from game.board import Board
from ai.evaluation import evaluate_board

# Win / Terminal score constant (dominates all heuristic pattern scores)
WIN_SCORE: int = 10_000_000


def get_candidate_moves(
    board: Board, max_candidates: Optional[int] = None
) -> List[Tuple[int, int]]:
    """Return candidate moves pruned to the Chebyshev neighborhood of existing stones.

    Args:
        board (Board): Current Gomoku board.
        max_candidates (Optional[int]): Maximum candidate moves to return. Defaults to None.
            If None, returns all candidate moves (preserving full list for ranking).

    Returns:
        List[Tuple[int, int]]: List of (row, col) coordinates for candidate moves.

    Why this design choice (Viva Explanation):
        - On a 15x15 board (225 cells), unpruned search at depth 3 evaluates up to:
            225 * 224 * 223 ≈ 11.2 million nodes.
          In pure Python, that would take 30+ seconds per move, causing severe lag
          and HTTP timeouts in FastAPI.
        - In Gomoku, playing far away from existing stones has no immediate or latent
          tactical value. Wrapping `board.get_neighbor_cells(distance=2)` limits candidates
          to empty cells within Chebyshev distance <= 2 of placed stones.
        - Ranking and forward pruning are applied downstream via `rank_candidates`
          to prioritize promising branches for alpha-beta cutoffs.
    """
    candidates = board.get_neighbor_cells(distance=2)
    if max_candidates is not None and len(candidates) > max_candidates:
        return candidates[:max_candidates]
    return candidates


def rank_candidates(
    board: Board,
    candidates: List[Tuple[int, int]],
    player: int,
    opponent: int,
) -> List[Tuple[int, int]]:
    """Rank candidate moves by immediate 1-ply heuristic evaluation score.

    Args:
        board (Board): Current Gomoku board.
        candidates (List[Tuple[int, int]]): Candidate move coordinates to rank.
        player (int): Player whose turn it is to move.
        opponent (int): The opposing player.

    Returns:
        List[Tuple[int, int]]: Candidate coordinates sorted descending by 1-ply score.

    Why Move Ordering Matters Beyond Trimming (Viva / Algorithmic Explanation):
        Alpha-Beta pruning's efficiency depends critically on move ordering.
        If strong moves are searched first:
          - A high-scoring move found early at a maximizing node raises `alpha` immediately.
          - A strong defensive counter found early at a minimizing node lowers `beta` immediately.
        Once beta <= alpha, all remaining sibling branches are cut off without exploration.
        By temporarily placing each candidate stone and evaluating the resulting board at 1-ply,
        we identify high-threat and tactical moves upfront. Searching these first triggers
        early alpha-beta cutoffs, drastically shrinking the visited game-tree size.
    """
    scored_candidates: List[Tuple[Tuple[int, int], int]] = []
    for r, c in candidates:
        board.place_stone(r, c, player)
        # Fast 1-ply heuristic evaluation from the perspective of `player`
        score = evaluate_board(board, player)
        board.undo_last_move()
        scored_candidates.append(((r, c), score))

    # Sort descending: highest immediate tactical value first
    scored_candidates.sort(key=lambda item: item[1], reverse=True)
    return [coord for coord, _ in scored_candidates]


def minimax(
    board: Board,
    depth: int,
    alpha: float,
    beta: float,
    maximizing_player: bool,
    ai_player: int,
    stats: Dict[str, int],
    max_candidates: Optional[int] = 12,
) -> int:
    r"""Recursively search game tree using Minimax with Alpha-Beta pruning and forward pruning.

    Args:
        board (Board): The mutable board instance.
        depth (int): Remaining search depth.
        alpha (float): Best score achievable by maximizer along path.
        beta (float): Best score achievable by minimizer along path.
        maximizing_player (bool): True if current turn is AI (maximizer); False if opponent.
        ai_player (int): AI player stone ID (1=Black, 2=White).
        stats (Dict[str, int]): Mutable accumulator tracking 'nodes' evaluated.
        max_candidates (Optional[int]): Maximum ranked moves to explore per ply (default: 12).

    Returns:
        int: Minimax evaluation score from the perspective of ai_player.
    """
    # Increment node visitation counter for performance diagnostics
    stats["nodes"] += 1

    # -----------------------------------------------------------------------
    # BASE CASE: Leaf node reached or board is full
    # -----------------------------------------------------------------------
    if depth == 0 or board.is_full():
        return evaluate_board(board, ai_player)

    candidates = get_candidate_moves(board)
    if not candidates:
        return evaluate_board(board, ai_player)

    opponent = 2 if ai_player == 1 else 1

    # -----------------------------------------------------------------------
    # RECURSIVE FORWARD PRUNING & MOVE ORDERING (VIVA EXPLANATION)
    # -----------------------------------------------------------------------
    # Cost vs. Benefit Analysis:
    # Ranking candidates at recursive nodes introduces overhead: each candidate
    # requires one `evaluate_board` call. However, the benefits compound exponentially:
    # 1. Capping branching at `max_candidates` (e.g. 12) prevents exponential node explosion
    #    at deeper plies (since branching factor b is applied depth times).
    # 2. Searching best-ranked moves first maximizes the probability of early
    #    alpha-beta cutoffs, meaning most candidate branches are never explored.
    # Empirically, the cost of 1-ply evaluation on candidates is vastly outweighed
    # by avoiding thousands of deep sub-tree evaluations.
    current_player = ai_player if maximizing_player else opponent
    other_player = opponent if maximizing_player else ai_player

    ranked_candidates = rank_candidates(board, candidates, current_player, other_player)
    if max_candidates is not None:
        candidates = ranked_candidates[:max_candidates]
    else:
        candidates = ranked_candidates

    if maximizing_player:
        max_eval = -float("inf")

        for r, c in candidates:
            # ---------------------------------------------------------------
            # IN-PLACE MUTATION & BACKTRACKING (VIVA EXPLANATION)
            # ---------------------------------------------------------------
            board.place_stone(r, c, ai_player)

            # ---------------------------------------------------------------
            # TERMINAL WIN DETECTION BEFORE DEEPER SEARCH (VIVA EXPLANATION)
            # ---------------------------------------------------------------
            if board.check_win(r, c, ai_player):
                board.undo_last_move()
                return WIN_SCORE + depth

            eval_score = minimax(
                board,
                depth - 1,
                alpha,
                beta,
                False,
                ai_player,
                stats,
                max_candidates=max_candidates,
            )
            board.undo_last_move()

            max_eval = max(max_eval, eval_score)
            alpha = max(alpha, eval_score)

            # ---------------------------------------------------------------
            # BETA CUTOFF (VIVA EXPLANATION)
            # ---------------------------------------------------------------
            # Minimizing ancestor already has a path guaranteeing <= beta.
            # Maximizer here guarantees >= alpha (where alpha >= beta).
            # Minimizer will never choose this path -> prune remaining moves.
            if beta <= alpha:
                break

        return int(max_eval)

    else:
        min_eval = float("inf")

        for r, c in candidates:
            board.place_stone(r, c, opponent)

            # Terminal win check for opponent
            if board.check_win(r, c, opponent):
                board.undo_last_move()
                return -WIN_SCORE - depth

            eval_score = minimax(
                board,
                depth - 1,
                alpha,
                beta,
                True,
                ai_player,
                stats,
                max_candidates=max_candidates,
            )
            board.undo_last_move()

            min_eval = min(min_eval, eval_score)
            beta = min(beta, eval_score)

            # ---------------------------------------------------------------
            # ALPHA CUTOFF (VIVA EXPLANATION)
            # ---------------------------------------------------------------
            # Maximizing ancestor already has a path guaranteeing >= alpha.
            # Minimizer here forces <= beta (where beta <= alpha).
            # Maximizer will never choose this path -> prune remaining moves.
            if beta <= alpha:
                break

        return int(min_eval)


def find_best_move(
    board: Board,
    ai_player: int,
    depth: int = 3,
    max_candidates: int = 20,
) -> Dict[str, Any]:
    """Select the optimal Gomoku move using depth-limited Minimax with Alpha-Beta and forward pruning.

    Args:
        board (Board): The current game board.
        ai_player (int): AI player ID (1=Black, 2=White).
        depth (int): Search depth limit. Defaults to 3.
        max_candidates (int): Maximum top-ranked 1-ply candidate moves to evaluate (default: 20).

    Returns:
        Dict[str, Any]: Dictionary formatted for the FastAPI backend:
            {
                "ai_move": {"row": int, "col": int},
                "top_moves": [{"coordinate": "H8", "score": int}, ...],
                "nodes_evaluated": int,
                "time_ms": int,
                "depth": int
            }

    Why Thread-Safe Accumulator Pattern:
        - `stats = {"nodes": 0}` is instantiated locally inside `find_best_move`
          and passed down through the recursion.
        - Avoids module-level or global variables, preventing state corruption
          or race conditions when handling concurrent requests in a FastAPI server.

    Coordinate Notation:
        - Columns: Sequential letters A-O (col 0='A', col 7='H', col 14='O').
          Note: Traditional Go/Gomoku skips 'I' to avoid confusion with 'J' or '1',
          but using sequential A-O provides a clean, 1:1 mapping with standard 0-14 indices.
        - Rows: 1-indexed string (row 0='1', row 7='8', row 14='15').
        - Example: (7, 7) -> "H8".

    Score Scaling Rationale:
        - We output raw minimax integer scores.
        - Preserving raw scores allows frontend clients to clearly distinguish
          decisive wins (+10M), forced blocks, open threats (+100K, +1K), and
          neutral positional moves without distortion.
    """
    opponent = 2 if ai_player == 1 else 1

    # Get full candidate list from neighborhood (no limit yet)
    candidate_moves = get_candidate_moves(board)

    # Fallback if no moves are available (e.g. board full)
    if not candidate_moves:
        return {
            "ai_move": None,
            "top_moves": [],
            "nodes_evaluated": 0,
            "time_ms": 0,
            "depth": depth,
        }

    # -----------------------------------------------------------------------
    # FORWARD PRUNING HEURISTIC & TRADEOFF (VIVA EXPLANATION)
    # -----------------------------------------------------------------------
    # We order candidate moves by their immediate 1-ply tactical score using
    # `rank_candidates`, and slice to the top `max_candidates` (default: 20)
    # before initiating the deep minimax search.
    #
    # Terminology: This technique is a light form of "forward pruning" (also known
    # as move filtering or beam search pruning). We trust that the strategically
    # superior moves are almost certainly contained within the top N 1-ply ranked moves.
    #
    # The Tradeoff:
    # Forward pruning is an intentional heuristic simplification. It is theoretically
    # possible (though exceedingly rare in practical Gomoku play) to miss a move that
    # appears weak or neutral at 1-ply but becomes strong through a deep multi-move
    # combination 3+ plies later. This is an accepted and standard heuristic tradeoff,
    # not a bug: capping the root candidates at 20 prevents combinatorial explosion as
    # the board fills, guaranteeing sub-second response times in local and web environments.
    ranked_candidates = rank_candidates(board, candidate_moves, ai_player, opponent)
    if max_candidates is not None and len(ranked_candidates) > max_candidates:
        candidate_moves = ranked_candidates[:max_candidates]
    else:
        candidate_moves = ranked_candidates

    # Start wall-clock timer for performance telemetry
    start_time = time.time()

    # Local, thread-safe counter for nodes visited
    stats: Dict[str, int] = {"nodes": 0}

    scored_moves: List[Dict[str, Any]] = []

    # Evaluate each candidate move at the root
    for r, c in candidate_moves:
        # Check if this move wins the game immediately at the root
        board.place_stone(r, c, ai_player)
        if board.check_win(r, c, ai_player):
            board.undo_last_move()
            # Immediate win found
            score = WIN_SCORE + depth
            scored_moves.append({"row": r, "col": c, "score": score})
            # A winning move at root cannot be surpassed; continue to evaluate others or finish
            continue

        # Root move consumed 1 ply of depth; recurse with depth - 1 for minimizer
        move_score = minimax(
            board,
            depth=depth - 1,
            alpha=-float("inf"),
            beta=float("inf"),
            maximizing_player=False,
            ai_player=ai_player,
            stats=stats,
            max_candidates=12,
        )
        board.undo_last_move()

        scored_moves.append({"row": r, "col": c, "score": move_score})

    elapsed_ms = int((time.time() - start_time) * 1000)

    # Sort moves by score descending (highest score = best move for AI)
    scored_moves.sort(key=lambda item: item["score"], reverse=True)
    best_move = scored_moves[0]

    # Convert top candidate moves to Gomoku coordinate notation
    top_moves = []
    for m in scored_moves[:3]:
        col_letter = chr(ord("A") + m["col"])
        row_number = m["row"] + 1
        coord_str = f"{col_letter}{row_number}"
        top_moves.append({"coordinate": coord_str, "score": m["score"]})

    return {
        "ai_move": {"row": best_move["row"], "col": best_move["col"]},
        "top_moves": top_moves,
        "nodes_evaluated": stats["nodes"],
        "time_ms": elapsed_ms,
        "depth": depth,
    }


if __name__ == "__main__":
    print("================================================================")
    print("      GomokuAI-Agent: Phase 3 Minimax & Alpha-Beta Search       ")
    print("================================================================")

    # -------------------------------------------------------------------
    # a) Depth-3 search on opening board with a few stones
    # -------------------------------------------------------------------
    print("\n[Test A] Benchmarking Depth-3 Search on Active Board:")
    b = Board(size=15)
    # Simulate an opening sequence:
    # Move 1: Black plays Center (7, 7)
    b.place_stone(7, 7, player=1)
    # Move 2: White plays (7, 8)
    b.place_stone(7, 8, player=2)
    # Move 3: Black plays (8, 7)
    b.place_stone(8, 7, player=1)
    b.display()

    print("\nExecuting find_best_move(b, ai_player=2, depth=3) for White...")
    result = find_best_move(b, ai_player=2, depth=3)
    print("\nResult Dictionary:")
    import pprint
    pprint.pprint(result)

    print(f"\n[Test B] Performance Sanity Check:")
    print(f"  - Nodes Evaluated: {result['nodes_evaluated']}")
    print(f"  - Execution Time:  {result['time_ms']} ms")
    assert result["time_ms"] < 1000, f"Execution too slow ({result['time_ms']} ms > 1000 ms)!"
    print("  => Confirmed: Depth-3 search executed in well under 1 second!")

    # -------------------------------------------------------------------
    # c) Tactical Scenario: AI completes open four -> five
    # -------------------------------------------------------------------
    print("\n[Test C] Tactical Check: AI Completes Winning 5-in-a-Row:")
    win_b = Board(size=15)
    # Black has 4 stones in a row at row 7, cols 5, 6, 7, 8
    # Col 9 (7, 9) is empty. Placing there completes 5-in-a-row!
    for col in [5, 6, 7, 8]:
        win_b.place_stone(7, col, player=1)
    # Opponent White has stones elsewhere
    win_b.place_stone(2, 2, player=2)
    win_b.place_stone(2, 3, player=2)

    win_b.display()
    print("Black (AI=1) has stones at (7, 5), (7, 6), (7, 7), (7, 8).")
    print("Candidate winning moves: (7, 4) or (7, 9).")

    win_result = find_best_move(win_b, ai_player=1, depth=3)
    best = win_result["ai_move"]
    print(f"\nAI selected move: {best} (Coordinate: {win_result['top_moves'][0]['coordinate']})")
    print(f"Move score: {win_result['top_moves'][0]['score']}")

    # The AI must select either (7, 4) or (7, 9) to win immediately!
    assert (best["row"], best["col"]) in [(7, 4), (7, 9)], (
        f"AI failed to complete 5-in-a-row! Selected: {best}"
    )
    print("=> Confirmed: AI decisively detected and played the winning 5-in-a-row move!")

    # -------------------------------------------------------------------
    # d) Tactical Scenario: AI blocks opponent's winning threat
    # -------------------------------------------------------------------
    print("\n[Test D] Defensive Check: AI Blocks Opponent's Winning Four:")
    defend_b = Board(size=15)
    # White already blocks (7, 4)
    defend_b.place_stone(7, 4, player=2)
    # Opponent (Black=1) has 4 stones: (7, 5), (7, 6), (7, 7), (7, 8)
    for col in [5, 6, 7, 8]:
        defend_b.place_stone(7, col, player=1)

    print("Opponent Black (1) threatens to win immediately at (7, 9).")
    defend_result = find_best_move(defend_b, ai_player=2, depth=3)
    defend_move = defend_result["ai_move"]
    print(f"White AI selected defensive block: {defend_move} (Coordinate: {defend_result['top_moves'][0]['coordinate']})")
    assert (defend_move["row"], defend_move["col"]) == (7, 9), (
        f"AI failed to block opponent's winning threat! Selected: {defend_move}"
    )
    print("=> Confirmed: AI successfully blocked opponent's imminent win at (7, 9)!")

    print("\nAll Phase 3 Minimax & Alpha-Beta checks passed successfully!")
