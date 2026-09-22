"""Unit tests for Gomoku Minimax with Alpha-Beta Pruning (Phase 3)."""

import unittest
from game.board import Board
from ai.minimax import (
    WIN_SCORE,
    get_candidate_moves,
    minimax,
    find_best_move,
)


class TestMinimax(unittest.TestCase):
    def setUp(self):
        self.board = Board(size=15)

    def test_first_move_empty_board(self):
        # Empty board should select center (7, 7)
        result = find_best_move(self.board, ai_player=1, depth=1)
        self.assertEqual(result["ai_move"], {"row": 7, "col": 7})
        self.assertEqual(result["top_moves"][0]["coordinate"], "H8")
        self.assertEqual(result["depth"], 1)

    def test_immediate_win_detected(self):
        # AI (Black=1) has 4 stones: (7, 5), (7, 6), (7, 7), (7, 8)
        # Completing (7, 4) or (7, 9) wins immediately!
        for c in [5, 6, 7, 8]:
            self.board.place_stone(7, c, player=1)
        self.board.place_stone(0, 0, player=2)

        result = find_best_move(self.board, ai_player=1, depth=2)
        move = result["ai_move"]
        self.assertIn((move["row"], move["col"]), [(7, 4), (7, 9)])
        # Winning move score must be >= WIN_SCORE
        self.assertGreaterEqual(result["top_moves"][0]["score"], WIN_SCORE)

    def test_immediate_block_detected(self):
        # Opponent (Black=1) has 4 stones: (7, 5), (7, 6), (7, 7), (7, 8)
        # White (player 2) has already blocked at (7, 4)
        self.board.place_stone(7, 4, player=2)
        for c in [5, 6, 7, 8]:
            self.board.place_stone(7, c, player=1)

        result = find_best_move(self.board, ai_player=2, depth=2)
        move = result["ai_move"]
        # AI White must block the remaining open end at (7, 9)
        self.assertEqual((move["row"], move["col"]), (7, 9))

    def test_returned_dict_schema(self):
        self.board.place_stone(7, 7, 1)
        self.board.place_stone(7, 8, 2)

        result = find_best_move(self.board, ai_player=1, depth=1)
        self.assertIn("ai_move", result)
        self.assertIn("top_moves", result)
        self.assertIn("nodes_evaluated", result)
        self.assertIn("time_ms", result)
        self.assertIn("depth", result)

        self.assertIsInstance(result["ai_move"], dict)
        self.assertIn("row", result["ai_move"])
        self.assertIn("col", result["ai_move"])

        self.assertIsInstance(result["top_moves"], list)
        self.assertLessEqual(len(result["top_moves"]), 3)
        for tm in result["top_moves"]:
            self.assertIn("coordinate", tm)
            self.assertIn("score", tm)

    def test_candidate_moves_pruning(self):
        # Empty board -> only center (7, 7)
        self.assertEqual(get_candidate_moves(self.board), [(7, 7)])

        # Single stone -> 24 candidate moves around it
        self.board.place_stone(7, 7, 1)
        candidates = get_candidate_moves(self.board)
        self.assertEqual(len(candidates), 24)
        self.assertNotIn((7, 7), candidates)


if __name__ == "__main__":
    unittest.main()
