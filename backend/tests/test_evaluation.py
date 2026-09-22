"""Unit tests for Gomoku Position Evaluation (Phase 2)."""

import unittest
from game.board import Board
from ai.evaluation import (
    FIVE,
    OPEN_FOUR,
    BLOCKED_FOUR,
    OPEN_THREE,
    BLOCKED_THREE,
    OPEN_TWO,
    count_direction,
    find_all_runs,
    classify_and_score,
    evaluate_board,
)


class TestEvaluation(unittest.TestCase):
    def setUp(self):
        self.board = Board(size=15)

    def test_empty_board(self):
        score = evaluate_board(self.board, ai_player=1)
        self.assertEqual(score, 0)
        self.assertEqual(find_all_runs(self.board, 1), [])
        self.assertEqual(find_all_runs(self.board, 2), [])

    def test_count_direction_horizontal(self):
        # Place 3 stones horizontally: (7, 5), (7, 6), (7, 7)
        for c in [5, 6, 7]:
            self.board.place_stone(7, c, player=1)

        result = count_direction(self.board, row=7, col=5, player=1, d_row=0, d_col=1)
        self.assertEqual(result["length"], 3)
        self.assertEqual(result["open_ends"], 2)

    def test_count_direction_blocked_by_edge(self):
        # Place 3 stones starting at board border (0, 0) vertically
        for r in range(3):
            self.board.place_stone(r, 0, player=1)

        result = count_direction(self.board, row=0, col=0, player=1, d_row=1, d_col=0)
        self.assertEqual(result["length"], 3)
        # Top end (-1, 0) is off-board (blocked), bottom end (3, 0) is open
        self.assertEqual(result["open_ends"], 1)

    def test_count_direction_double_blocked(self):
        # Place O X X X O
        self.board.place_stone(7, 4, player=2)
        for c in [5, 6, 7]:
            self.board.place_stone(7, c, player=1)
        self.board.place_stone(7, 8, player=2)

        result = count_direction(self.board, row=7, col=5, player=1, d_row=0, d_col=1)
        self.assertEqual(result["length"], 3)
        self.assertEqual(result["open_ends"], 0)

    def test_run_deduplication(self):
        # Place 4 stones horizontally: (7, 3), (7, 4), (7, 5), (7, 6)
        for c in range(3, 7):
            self.board.place_stone(7, c, player=1)

        runs = find_all_runs(self.board, player=1)
        # Without de-duplication, the horizontal direction alone would produce 4 runs
        # of lengths 4, 3, 2, and 1.
        # With de-duplication, there is exactly ONE run of length >= 2 (the maximal length-4 run).
        significant_runs = [r for r in runs if r["length"] >= 2]
        self.assertEqual(len(significant_runs), 1)
        self.assertEqual(significant_runs[0]["length"], 4)
        self.assertEqual(significant_runs[0]["open_ends"], 2)

    def test_all_directions_detected(self):
        # Horizontal
        b_h = Board(15)
        for c in range(3):
            b_h.place_stone(2, c + 2, 1)
        runs_h = [r for r in find_all_runs(b_h, 1) if r["length"] >= 2]
        self.assertEqual(len(runs_h), 1)
        self.assertEqual(runs_h[0]["length"], 3)

        # Vertical
        b_v = Board(15)
        for r in range(3):
            b_v.place_stone(r + 2, 2, 1)
        runs_v = [r for r in find_all_runs(b_v, 1) if r["length"] >= 2]
        self.assertEqual(len(runs_v), 1)
        self.assertEqual(runs_v[0]["length"], 3)

        # Main Diagonal (\)
        b_d = Board(15)
        for i in range(3):
            b_d.place_stone(i + 2, i + 2, 1)
        runs_d = [r for r in find_all_runs(b_d, 1) if r["length"] >= 2]
        self.assertEqual(len(runs_d), 1)
        self.assertEqual(runs_d[0]["length"], 3)

        # Anti-Diagonal (/)
        b_ad = Board(15)
        for i in range(3):
            b_ad.place_stone(i + 2, 10 - i, 1)
        runs_ad = [r for r in find_all_runs(b_ad, 1) if r["length"] >= 2]
        self.assertEqual(len(runs_ad), 1)
        self.assertEqual(runs_ad[0]["length"], 3)

    def test_classify_and_score(self):
        # Five
        self.assertEqual(classify_and_score([{"length": 5, "open_ends": 0}]), FIVE)
        self.assertEqual(classify_and_score([{"length": 6, "open_ends": 2}]), FIVE)

        # Fours
        self.assertEqual(classify_and_score([{"length": 4, "open_ends": 2}]), OPEN_FOUR)
        self.assertEqual(classify_and_score([{"length": 4, "open_ends": 1}]), BLOCKED_FOUR)
        self.assertEqual(classify_and_score([{"length": 4, "open_ends": 0}]), 0)

        # Threes
        self.assertEqual(classify_and_score([{"length": 3, "open_ends": 2}]), OPEN_THREE)
        self.assertEqual(classify_and_score([{"length": 3, "open_ends": 1}]), BLOCKED_THREE)
        self.assertEqual(classify_and_score([{"length": 3, "open_ends": 0}]), 0)

        # Twos
        self.assertEqual(classify_and_score([{"length": 2, "open_ends": 2}]), OPEN_TWO)
        self.assertEqual(classify_and_score([{"length": 2, "open_ends": 1}]), 0)
        self.assertEqual(classify_and_score([{"length": 2, "open_ends": 0}]), 0)

        # Singles
        self.assertEqual(classify_and_score([{"length": 1, "open_ends": 2}]), 0)

    def test_evaluate_board_net_score(self):
        # AI (Black=1) has an Open Three (+1000)
        for c in range(5, 8):
            self.board.place_stone(7, c, player=1)

        # Opponent (White=2) has an Open Two (+10)
        self.board.place_stone(2, 2, player=2)
        self.board.place_stone(2, 3, player=2)

        net_score_ai = evaluate_board(self.board, ai_player=1)
        self.assertEqual(net_score_ai, OPEN_THREE - OPEN_TWO)  # 1000 - 10 = 990

        net_score_opp = evaluate_board(self.board, ai_player=2)
        self.assertEqual(net_score_opp, OPEN_TWO - OPEN_THREE)  # 10 - 1000 = -990


if __name__ == "__main__":
    unittest.main()
