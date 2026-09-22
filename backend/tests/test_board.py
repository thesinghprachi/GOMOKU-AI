"""Unit tests for Gomoku Board class (Phase 1)."""

import unittest
from game.board import Board


class TestBoard(unittest.TestCase):
    def setUp(self):
        self.board = Board(size=15)

    def test_initialization(self):
        self.assertEqual(self.board.size, 15)
        self.assertEqual(len(self.board.grid), 15)
        self.assertEqual(len(self.board.grid[0]), 15)
        self.assertEqual(self.board.move_history, [])
        self.assertIsNone(self.board.last_move)
        self.assertEqual(len(self.board.get_empty_cells()), 225)
        self.assertFalse(self.board.is_full())

    def test_is_valid_move(self):
        self.assertTrue(self.board.is_valid_move(0, 0))
        self.assertTrue(self.board.is_valid_move(7, 7))
        self.assertTrue(self.board.is_valid_move(14, 14))

        # Out of bounds
        self.assertFalse(self.board.is_valid_move(-1, 0))
        self.assertFalse(self.board.is_valid_move(0, -1))
        self.assertFalse(self.board.is_valid_move(15, 0))
        self.assertFalse(self.board.is_valid_move(0, 15))

        # Already occupied
        self.board.place_stone(7, 7, player=1)
        self.assertFalse(self.board.is_valid_move(7, 7))

    def test_place_stone(self):
        # Valid move
        success = self.board.place_stone(7, 7, player=1)
        self.assertTrue(success)
        self.assertEqual(self.board.grid[7][7], 1)
        self.assertEqual(self.board.last_move, (7, 7, 1))
        self.assertEqual(self.board.move_history, [(7, 7, 1)])

        # Duplicate move on occupied square
        success_dup = self.board.place_stone(7, 7, player=2)
        self.assertFalse(success_dup)
        self.assertEqual(self.board.grid[7][7], 1)
        self.assertEqual(len(self.board.move_history), 1)

        # Out of bounds move
        success_oob = self.board.place_stone(-1, 5, player=1)
        self.assertFalse(success_oob)

    def test_undo_last_move(self):
        # Undo on empty board
        self.assertIsNone(self.board.undo_last_move())

        # Place 2 stones and undo
        self.board.place_stone(7, 7, player=1)
        self.board.place_stone(7, 8, player=2)
        self.assertEqual(self.board.last_move, (7, 8, 2))

        # Undo second move
        popped = self.board.undo_last_move()
        self.assertEqual(popped, (7, 8, 2))
        self.assertEqual(self.board.grid[7][8], 0)
        self.assertEqual(self.board.last_move, (7, 7, 1))
        self.assertEqual(len(self.board.move_history), 1)

        # Undo first move
        popped2 = self.board.undo_last_move()
        self.assertEqual(popped2, (7, 7, 1))
        self.assertEqual(self.board.grid[7][7], 0)
        self.assertIsNone(self.board.last_move)
        self.assertEqual(len(self.board.move_history), 0)

    def test_check_win_horizontal(self):
        # Place 5 stones horizontally: (5, 3), (5, 4), (5, 5), (5, 6), (5, 7)
        for c in range(3, 7):
            self.board.place_stone(5, c, player=1)
            self.assertFalse(self.board.check_win(5, c, player=1))

        self.board.place_stone(5, 7, player=1)
        self.assertTrue(self.board.check_win(5, 7, player=1))
        # Completing in middle
        self.assertTrue(self.board.check_win(5, 5, player=1))

    def test_check_win_vertical(self):
        for r in range(4):
            self.board.place_stone(r, 6, player=2)
        self.assertFalse(self.board.check_win(3, 6, player=2))

        self.board.place_stone(4, 6, player=2)
        self.assertTrue(self.board.check_win(4, 6, player=2))

    def test_check_win_main_diagonal(self):
        for i in range(4):
            self.board.place_stone(i, i, player=1)
        self.assertFalse(self.board.check_win(3, 3, player=1))

        self.board.place_stone(4, 4, player=1)
        self.assertTrue(self.board.check_win(4, 4, player=1))

    def test_check_win_anti_diagonal(self):
        for i in range(4):
            self.board.place_stone(i, 4 - i, player=2)
        self.assertFalse(self.board.check_win(3, 1, player=2))

        self.board.place_stone(4, 0, player=2)
        self.assertTrue(self.board.check_win(4, 0, player=2))

    def test_check_win_over_five(self):
        # In freestyle Gomoku, 6 or more in a row is also >= 5
        for c in range(6):
            self.board.place_stone(2, c, player=1)
        self.assertTrue(self.board.check_win(2, 5, player=1))

    def test_check_win_different_player(self):
        for c in range(4):
            self.board.place_stone(3, c, player=1)
        # White blocks the 5th spot
        self.board.place_stone(3, 4, player=2)
        self.assertFalse(self.board.check_win(3, 4, player=1))
        self.assertFalse(self.board.check_win(3, 4, player=2))

    def test_copy(self):
        self.board.place_stone(7, 7, player=1)
        clone = self.board.copy()

        self.assertEqual(clone.size, self.board.size)
        self.assertEqual(clone.grid[7][7], 1)
        self.assertEqual(clone.move_history, [(7, 7, 1)])
        self.assertEqual(clone.last_move, (7, 7, 1))

        # Ensure mutation of clone does not affect original
        clone.place_stone(0, 0, player=2)
        self.assertEqual(clone.grid[0][0], 2)
        self.assertEqual(self.board.grid[0][0], 0)
        self.assertEqual(len(clone.move_history), 2)
        self.assertEqual(len(self.board.move_history), 1)

    def test_get_neighbor_cells_empty_board(self):
        # Empty board should return center (7, 7)
        neighbors = self.board.get_neighbor_cells(distance=2)
        self.assertEqual(neighbors, [(7, 7)])

    def test_get_neighbor_cells_with_stones(self):
        self.board.place_stone(7, 7, player=1)
        neighbors = self.board.get_neighbor_cells(distance=1)
        # Distance 1 around (7, 7) has 8 empty neighbor cells
        self.assertEqual(len(neighbors), 8)
        self.assertNotIn((7, 7), neighbors)
        self.assertIn((6, 6), neighbors)
        self.assertIn((8, 8), neighbors)

        # Distance 2 around (7, 7) has 5x5 - 1 occupied = 24 empty neighbor cells
        neighbors_d2 = self.board.get_neighbor_cells(distance=2)
        self.assertEqual(len(neighbors_d2), 24)

    def test_to_list(self):
        grid = self.board.to_list()
        self.assertEqual(len(grid), 15)
        self.assertEqual(len(grid[0]), 15)
        self.assertIs(grid, self.board.grid)

    def test_is_full(self):
        small_board = Board(size=2)
        self.assertFalse(small_board.is_full())
        small_board.place_stone(0, 0, 1)
        small_board.place_stone(0, 1, 2)
        small_board.place_stone(1, 0, 1)
        self.assertFalse(small_board.is_full())
        small_board.place_stone(1, 1, 2)
        self.assertTrue(small_board.is_full())

        # Undo should make it not full
        small_board.undo_last_move()
        self.assertFalse(small_board.is_full())


if __name__ == "__main__":
    unittest.main()
