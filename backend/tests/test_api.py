"""Integration tests for GomokuAI-Agent FastAPI application (Phase 4)."""

import unittest
from fastapi.testclient import TestClient
from main import app, current_board
from game.board import Board


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Reset game before each test
        self.client.post("/new_game")

    def test_health_check(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "GomokuAI-Agent backend running"})

    def test_new_game(self):
        response = self.client.post("/new_game")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("board", data)
        self.assertEqual(len(data["board"]), 15)
        self.assertEqual(len(data["board"][0]), 15)
        # Check all cells are 0
        self.assertTrue(all(cell == 0 for row in data["board"] for cell in row))

    def test_valid_human_move_and_ai_response(self):
        payload = {"row": 7, "col": 7, "player": 1}
        response = self.client.post("/move", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check required schema keys
        self.assertIn("board", data)
        self.assertIn("ai_move", data)
        self.assertIn("top_moves", data)
        self.assertIn("nodes_evaluated", data)
        self.assertIn("time_ms", data)
        self.assertIn("depth", data)
        self.assertIn("winner", data)

        # Human stone placed
        self.assertEqual(data["board"][7][7], 1)

        # AI stone placed
        ai_move = data["ai_move"]
        self.assertIsNotNone(ai_move)
        ai_row, ai_col = ai_move["row"], ai_move["col"]
        self.assertEqual(data["board"][ai_row][ai_col], 2)

        # Game should still be in progress
        self.assertIsNone(data["winner"])
        self.assertGreater(data["nodes_evaluated"], 0)

    def test_invalid_move_occupied_cell(self):
        # First move
        self.client.post("/move", json={"row": 7, "col": 7, "player": 1})
        # Duplicate move on cell (7, 7)
        response = self.client.post("/move", json={"row": 7, "col": 7, "player": 1})
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())

    def test_human_win_skips_ai_turn(self):
        # Manually prepare 4 stones for human (player 1)
        import main
        main.current_board = Board(size=15)
        for c in [5, 6, 7, 8]:
            main.current_board.place_stone(7, c, player=1)
        # AI has stones elsewhere
        main.current_board.place_stone(0, 0, player=2)

        # Human plays (7, 9) completing 5-in-a-row!
        response = self.client.post("/move", json={"row": 7, "col": 9, "player": 1})
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Human won!
        self.assertEqual(data["winner"], 1)
        # AI turn was skipped
        self.assertIsNone(data["ai_move"])
        self.assertEqual(data["board"][7][9], 1)

    def test_stateless_ai_move(self):
        # Create custom board with human stone at (7, 7)
        custom_grid = [[0 for _ in range(15)] for _ in range(15)]
        custom_grid[7][7] = 1

        payload = {"board": custom_grid, "player": 2}
        response = self.client.post("/ai_move", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("ai_move", data)
        self.assertIsNotNone(data["ai_move"])
        self.assertIn("top_moves", data)
        self.assertIn("nodes_evaluated", data)
        self.assertIn("time_ms", data)
        self.assertIn("depth", data)
        self.assertIn("winner", data)

        # Ensure global board was NOT affected
        res_new = self.client.post("/new_game")
        self.assertTrue(all(cell == 0 for row in res_new.json()["board"] for cell in row))


if __name__ == "__main__":
    unittest.main()
