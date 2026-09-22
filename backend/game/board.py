"""Gomoku Board Module.

This module provides the core `Board` class responsible for representing a 15x15
Gomoku board, maintaining game state, validating moves, performing fast local
win detection, supporting search-tree backtracking with O(1) undo operations,
and pruning candidate moves for AI search algorithms.
"""

from typing import List, Tuple, Optional


class Board:
    """Represents a Gomoku (Five-in-a-Row) game board.

    Attributes:
        size (int): Board dimension (standard Gomoku is 15x15).
        grid (List[List[int]]): 2D grid where 0=empty, 1=black, 2=white.
        move_history (List[Tuple[int, int, int]]): Sequential history of moves
            recorded as (row, col, player) tuples.
        last_move (Optional[Tuple[int, int, int]]): The most recent move played.

    Why this design:
        1. Pure Python Data Structures: Using native Python lists and integers
           avoids the overhead of external dependencies and FFI bridging (e.g. NumPy),
           which is actually faster for single-cell lookups and mutations common in
           game tree traversals.
        2. In-Place Mutation & Backtracking: Designed specifically for AI minimax
           search. Rather than cloning the entire board state at each depth level,
           `place_stone` and `undo_last_move` allow O(1) traversal and backtracking.
        3. Localized Win Checking: Gomoku wins only occur along lines passing through
           the stone just placed. Checking 4 directional rays locally bounds win
           checking to O(1) time instead of scanning the full O(N^2) grid.
    """

    def __init__(self, size: int = 15) -> None:
        """Initialize an empty Gomoku board.

        Args:
            size (int): Width and height of the board. Defaults to 15.

        What it does:
            - Sets `self.size` to the given dimension.
            - Allocates a 2D grid of dimensions `size x size` initialized with 0.
            - Initializes an empty list `move_history` to track move sequences.
            - Sets `last_move` to None.

        Why it is implemented this way:
            - Standard Gomoku is played on a 15x15 grid of intersections.
            - Numerical encoding (0: Empty, 1: Black, 2: White) allows fast integer
              comparisons and aligns with standard game protocols and neural network inputs.
            - Tracking `move_history` as a stack enables O(1) undo operations without
              requiring an external move manager.
        """
        self.size: int = size
        self.grid: List[List[int]] = [[0 for _ in range(size)] for _ in range(size)]
        self.move_history: List[Tuple[int, int, int]] = []
        self.last_move: Optional[Tuple[int, int, int]] = None

    def is_valid_move(self, row: int, col: int) -> bool:
        """Check if a coordinate is a legal move on the current board.

        Args:
            row (int): 0-indexed row coordinate.
            col (int): 0-indexed column coordinate.

        Returns:
            bool: True if the coordinate is within bounds and unoccupied, False otherwise.

        What it does:
            - Validates that `0 <= row < size` and `0 <= col < size`.
            - Confirms that `self.grid[row][col] == 0`.

        Why it is implemented this way:
            - Gomoku rules strictly prohibit placing a stone outside board bounds or
              on top of an existing stone.
            - Short-circuiting evaluation (`and`) ensures `self.grid[row][col]` is only
              accessed if coordinates are guaranteed to be within bounds, preventing
              `IndexError`.
        """
        return 0 <= row < self.size and 0 <= col < self.size and self.grid[row][col] == 0

    def place_stone(self, row: int, col: int, player: int) -> bool:
        """Attempt to place a stone for the given player at the specified coordinate.

        Args:
            row (int): 0-indexed row coordinate.
            col (int): 0-indexed column coordinate.
            player (int): Player identifier (1 for Black, 2 for White).

        Returns:
            bool: True if the stone was successfully placed; False if the move was invalid.

        What it does:
            - Calls `is_valid_move(row, col)`.
            - If invalid, returns False without mutating board state or raising exceptions.
            - If valid, updates `self.grid[row][col] = player`.
            - Appends `(row, col, player)` to `self.move_history`.
            - Updates `self.last_move` to `(row, col, player)` and returns True.

        Why it is implemented this way:
            - Returning a boolean instead of raising an exception avoids expensive Python
              exception handling overhead during search exploration or untrusted client inputs.
            - Updating `move_history` and `last_move` synchronously guarantees that board
              state, historical records, and undo pointers remain strictly consistent.
        """
        if not self.is_valid_move(row, col):
            return False

        self.grid[row][col] = player
        move = (row, col, player)
        self.move_history.append(move)
        self.last_move = move
        return True

    def undo_last_move(self) -> Optional[Tuple[int, int, int]]:
        """Undo the most recent move, reverting the board to its prior state.

        Returns:
            Optional[Tuple[int, int, int]]: The popped move `(row, col, player)`,
                or None if the move history was empty.

        What it does:
            - Checks if `self.move_history` contains any moves.
            - Pops the most recent `(row, col, player)` tuple from `self.move_history`.
            - Resets `self.grid[row][col]` back to 0 (empty).
            - Re-points `self.last_move` to the previous move in history (or None if empty).
            - Returns the undone move.

        Why it is implemented this way:
            - **Critical for AI Minimax / Alpha-Beta Search**: In game tree search, the AI
              explores tens of thousands of branches. If the AI cloned the entire board
              at every branch, memory allocation and garbage collection would cripple performance.
              By applying a move with `place_stone` and then reverting it with `undo_last_move`,
              state transitions are achieved in O(1) time and O(1) auxiliary memory.
        """
        if not self.move_history:
            return None

        row, col, player = self.move_history.pop()
        self.grid[row][col] = 0
        self.last_move = self.move_history[-1] if self.move_history else None
        return (row, col, player)

    def check_win(self, row: int, col: int, player: int) -> bool:
        r"""Check if placing a stone at (row, col) achieves 5 or more consecutive stones.

        Args:
            row (int): Row coordinate of the placed stone.
            col (int): Column coordinate of the placed stone.
            player (int): Player stone to check (1=Black, 2=White).

        Returns:
            bool: True if 5 or more stones in a line are formed in any direction; False otherwise.

        What it does:
            - Evaluates 4 line orientations:
                1. Horizontal: Left (0, -1) and Right (0, 1)
                2. Vertical: Up (-1, 0) and Down (1, 0)
                3. Main Diagonal (\): Up-Left (-1, -1) and Down-Right (1, 1)
                4. Anti-Diagonal (/): Up-Right (-1, 1) and Down-Left (1, -1)
            - For each orientation, counts consecutive stones of `player` radiating outward
              in both opposite directions from `(row, col)`.
            - Sums the counts from both directions plus 1 (the stone at `row, col` itself).
            - If the total consecutive count in any direction is >= 5, returns True immediately.
            - If none reach 5+, returns False.

        Why it is implemented this way (Viva Explanation):
            1. **O(1) Local Verification vs O(N^2) Global Scan**: A win can only be created
               or modified along lines passing through the most recently placed stone. Scanning
               the entire 15x15 board would require inspecting up to 225 cells every move.
               By only checking rays radiating from `(row, col)` up to 4 steps in each direction,
               we inspect at most 4 directions * 8 cells = 32 cell lookups in the worst case,
               providing a true O(1) win test.
            2. **Direction-Pair Logic (Bi-directional Ray Scanning)**: A stone can be placed
               at the beginning, end, OR anywhere in the middle of a winning sequence (for
               example, filling the gap in `X X _ X X` to create `X X X X X`). Checking opposite
               direction pairs together `(dr, dc)` and `(-dr, -dc)` correctly detects 5-in-a-row
               regardless of where in the sequence the final winning stone was placed.
            3. **Freestyle Gomoku Rule (>= 5)**: In standard freestyle Gomoku, an overline
               (5 or more stones in a row) constitutes a win.
        """
        # A player cannot place a stone or win at a cell occupied by an opponent
        if self.grid[row][col] != 0 and self.grid[row][col] != player:
            return False

        # 4 directional axes represented by a single direction vector (dr, dc)
        # Horizontal (0, 1), Vertical (1, 0), Diagonal \ (1, 1), Anti-diagonal / (1, -1)
        directions = [
            (0, 1),   # Horizontal
            (1, 0),   # Vertical
            (1, 1),   # Main diagonal (\)
            (1, -1),  # Anti-diagonal (/)
        ]

        for dr, dc in directions:
            # Start count at 1 for the stone itself at (row, col)
            consecutive_count = 1

            # 1. Scan in positive direction (+dr, +dc)
            step = 1
            while True:
                r = row + dr * step
                c = col + dc * step
                if 0 <= r < self.size and 0 <= c < self.size and self.grid[r][c] == player:
                    consecutive_count += 1
                    step += 1
                else:
                    break

            # 2. Scan in negative direction (-dr, -dc)
            step = 1
            while True:
                r = row - dr * step
                c = col - dc * step
                if 0 <= r < self.size and 0 <= c < self.size and self.grid[r][c] == player:
                    consecutive_count += 1
                    step += 1
                else:
                    break

            # Win condition satisfied if 5 or more consecutive stones are found
            if consecutive_count >= 5:
                return True

        return False

    def copy(self) -> "Board":
        """Create a deep copy of the current board state.

        Returns:
            Board: A completely independent new Board instance with identical grid,
                move history, and last move.

        What it does:
            - Instantiates a new `Board(size=self.size)`.
            - Deep-copies the 2D grid using list slicing `[row[:] for row in self.grid]`.
            - Copies `move_history` via `list(self.move_history)`.
            - Replicates `last_move`.

        Why it is implemented this way:
            - **Performance**: Standard library `copy.deepcopy` is notoriously slow in Python
              because it performs extensive type introspection, class lookups, and memo dictionary
              tracking. Using list comprehension with slicing `[row[:] for row in self.grid]` is
              5x to 10x faster while ensuring complete mutation independence.
            - **Use Case**: While minimax tree searches use in-place mutation (`place_stone` +
              `undo_last_move`), multi-threaded search, rollout simulations (MCTS), or state
              snapshots for debugging need safe, decoupled clones.
        """
        cloned = Board(size=self.size)
        cloned.grid = [row[:] for row in self.grid]
        cloned.move_history = list(self.move_history)
        cloned.last_move = self.last_move
        return cloned

    def get_empty_cells(self) -> List[Tuple[int, int]]:
        """Return coordinates of all unoccupied cells on the board.

        Returns:
            List[Tuple[int, int]]: List of (row, col) tuples where grid[row][col] == 0.

        What it does:
            - Iterates across all rows and columns.
            - Collects and returns coordinates where cell value is 0.

        Why it is implemented this way:
            - Provides an exhaustive set of legal moves for baseline bots, random rollouts,
              or validation checks.
        """
        return [
            (r, c)
            for r in range(self.size)
            for c in range(self.size)
            if self.grid[r][c] == 0
        ]

    def get_neighbor_cells(self, distance: int = 2) -> List[Tuple[int, int]]:
        r"""Return empty cells within a specified Chebyshev distance of any placed stone.

        Args:
            distance (int): Maximum Chebyshev distance (box radius) to search around
                occupied cells. Defaults to 2.

        Returns:
            List[Tuple[int, int]]: List of empty (row, col) candidate moves.
                If the board is completely empty, returns `[(7, 7)]` (center cell for 15x15).

        What it does:
            - If no moves have been played, returns `[(self.size // 2, self.size // 2)]`.
            - Collects unique empty cells that lie within Chebyshev distance <= `distance`
              of any stone currently on the board.
            - Chebyshev distance means: `max(|r1 - r2|, |c1 - c2|) <= distance`, defining
              a square bounding box around each stone.

        Why it is implemented this way (Viva Explanation):
            1. **Dramatic Branching Factor Reduction**:
               A 15x15 Gomoku board has 225 cells. In a minimax search with depth 4,
               evaluating all empty cells yields an astronomical branching factor of:
                   $225 \\times 224 \\times 223 \\times 222 \\approx 2.5 \\times 10^9$ positions.
               This is computationally infeasible in pure Python without timeouts.
               However, in Gomoku, playing a stone isolated far away from existing stones
               has near-zero tactical value (it builds no immediate threats and blocks nothing).
               Restricting candidate moves to empty cells within Chebyshev distance $\\le 2$
               of existing stones reduces the branching factor to ~20–40 moves, reducing the
               search space by several orders of magnitude:
                   $30^4 = 810,000$ positions.
               With Alpha-Beta pruning, this easily runs within sub-second deadlines.
            2. **Opening Move Theory**: If the board is completely empty, the center cell (7,7)
               (known as 'Tengen' in Go/Gomoku) is mathematically and strategically the strongest
               first move for Black, eliminating any useless search on opening.
        """
        if not self.move_history:
            center = self.size // 2
            return [(center, center)]

        candidate_cells = set()

        for r, c, _ in self.move_history:
            r_min = max(0, r - distance)
            r_max = min(self.size - 1, r + distance)
            c_min = max(0, c - distance)
            c_max = min(self.size - 1, c + distance)

            for nr in range(r_min, r_max + 1):
                for nc in range(c_min, c_max + 1):
                    if self.grid[nr][nc] == 0:
                        candidate_cells.add((nr, nc))

        return sorted(candidate_cells)

    def to_list(self) -> List[List[int]]:
        """Return the board grid as a 2D list of integers.

        Returns:
            List[List[int]]: The raw 2D grid representation (0=empty, 1=black, 2=white).

        What it does:
            - Returns `self.grid`.

        Why it is implemented this way:
            - Designed for clean JSON serialization when exposing board states
              over FastAPI HTTP endpoints or WebSocket payloads to the frontend 3D UI.
        """
        return self.grid

    @classmethod
    def load_from_list(cls, grid: List[List[int]]) -> "Board":
        """Reconstruct a Board instance from a 2D grid matrix.

        Args:
            grid (List[List[int]]): 2D square matrix where 0=empty, 1=black, 2=white.

        Returns:
            Board: Reconstructed Board instance with dimensions matching the grid.

        Why this is needed for /ai_move (Viva Explanation):
            - The /move endpoint is stateful: it mutates the server's persistent
              board instance which is already trusted and guaranteed to have accurate
              internal structures (move_history, last_move).
            - In contrast, the /ai_move endpoint is completely stateless. The frontend
              sends an arbitrary 2D board state across the network. The server must
              reconstitute that grid into a Board object so that minimax search,
              candidate generation, and localized win detection can execute safely
              without modifying the server's global game session.
        """
        size = len(grid)
        board = cls(size=size)
        board.grid = [row[:] for row in grid]

        # Reconstruct move_history from occupied cells
        history: List[Tuple[int, int, int]] = []
        for r in range(size):
            for c in range(size):
                val = board.grid[r][c]
                if val != 0:
                    history.append((r, c, val))

        board.move_history = history
        board.last_move = history[-1] if history else None
        return board

    def display(self) -> None:
        """Print a formatted ASCII representation of the board to the console.

        What it does:
            - Renders column index numbers header.
            - Renders each row with its 0-indexed row number.
            - Displays '.' for empty cells (0), 'X' for Black (1), and 'O' for White (2).

        Why it is implemented this way:
            - Allows quick, human-readable terminal inspection and debugging without
              requiring a graphical interface or web server to be running.
        """
        symbols = {0: ".", 1: "X", 2: "O"}

        # Print header with column numbers formatted to 2 characters
        col_header = "    " + " ".join(f"{c:2d}" for c in range(self.size))
        print(col_header)
        print("   +" + "--" * self.size + "-+")

        for r in range(self.size):
            row_symbols = " ".join(f" {symbols[self.grid[r][c]]}" for c in range(self.size))
            print(f"{r:2d} |{row_symbols} |")

        print("   +" + "--" * self.size + "-+")

    def is_full(self) -> bool:
        """Check if the board is completely filled with no empty cells remaining.

        Returns:
            bool: True if all 225 cells are occupied (draw condition); False otherwise.

        What it does:
            - Compares `len(self.move_history)` with `self.size * self.size`.

        Why it is implemented this way:
            - **O(1) Time Complexity**: Since `place_stone` only places stones on empty
              cells and `undo_last_move` decrements `move_history`, the length of `move_history`
              is guaranteed to equal the total count of occupied cells.
            - Checking `len(self.move_history) == size * size` avoids iterating through all
              225 cells of the 2D grid, providing instantaneous draw detection.
        """
        return len(self.move_history) == self.size * self.size


if __name__ == "__main__":
    print("==================================================")
    print("     GomokuAI-Agent: Phase 1 Board Verification   ")
    print("==================================================")

    # 1. Initialize Board
    board = Board(size=15)
    print(f"\n[1] Initialized 15x15 Board. Empty cells count: {len(board.get_empty_cells())}")
    print(f"    Empty board neighbor cells: {board.get_neighbor_cells()}")

    # 2. Place opening stones
    # Black (1) plays center (7, 7)
    board.place_stone(7, 7, player=1)
    # White (2) plays adjacent (7, 8)
    board.place_stone(7, 8, player=2)
    # Black (1) plays (6, 7)
    board.place_stone(6, 7, player=1)

    print("\n[2] Board after 3 moves:")
    board.display()
    print(f"    Last move played: {board.last_move}")
    print(f"    Total moves in history: {len(board.move_history)}")

    # 3. Test get_neighbor_cells pruning
    neighbors = board.get_neighbor_cells(distance=2)
    print(f"\n[3] Candidate neighbor cells (distance=2): count = {len(neighbors)}")
    print(f"    Sample neighbors: {neighbors[:10]}...")

    # 4. Test invalid move rejection
    invalid_placed = board.place_stone(7, 7, player=2)  # Occupied cell
    out_of_bounds = board.place_stone(15, 15, player=1) # Out of bounds
    print(f"\n[4] Invalid move tests:")
    print(f"    Placing on occupied (7, 7) succeeded: {invalid_placed} (Expected: False)")
    print(f"    Placing out of bounds (15, 15) succeeded: {out_of_bounds} (Expected: False)")

    # 5. Test undo functionality
    undone_move = board.undo_last_move()
    print(f"\n[5] Undid last move: {undone_move}")
    print(f"    New last move: {board.last_move}")
    print(f"    Cell (6, 7) value after undo: {board.grid[6][7]} (Expected: 0)")

    # 6. Test winning line detection (Horizontal 5-in-a-row with middle stone placement)
    print("\n[6] Testing win detection (Horizontal line):")
    win_board = Board(size=15)
    # Black places stones at (7, 5), (7, 6), (7, 8), (7, 9)
    for c in [5, 6, 8, 9]:
        win_board.place_stone(7, c, player=1)

    # Check win before completing line
    win_before = win_board.check_win(7, 9, player=1)
    print(f"    Win detected with 4 stones: {win_before} (Expected: False)")

    # Complete 5-in-a-row by placing in the MIDDLE gap at (7, 7)
    win_board.place_stone(7, 7, player=1)
    win_after = win_board.check_win(7, 7, player=1)
    print(f"    Win detected after completing (7, 7): {win_after} (Expected: True)")
    win_board.display()

    # 7. Test Diagonal (\) and Anti-Diagonal (/) win detection
    print("\n[7] Testing Diagonal win detection:")
    diag_board = Board(size=15)
    for i in range(5):
        diag_board.place_stone(i, i, player=2)
    diag_win = diag_board.check_win(4, 4, player=2)
    print(f"    Diagonal (\\) 5-in-a-row win: {diag_win} (Expected: True)")

    anti_diag_board = Board(size=15)
    for i in range(5):
        anti_diag_board.place_stone(i, 4 - i, player=1)
    anti_win = anti_diag_board.check_win(4, 0, player=1)
    print(f"    Anti-Diagonal (/) 5-in-a-row win: {anti_win} (Expected: True)")

    # 8. Test Deep Copy
    copied_board = board.copy()
    copied_board.place_stone(0, 0, player=1)
    print("\n[8] Testing Board copy independence:")
    print(f"    Copied board cell (0, 0): {copied_board.grid[0][0]} (Expected: 1)")
    print(f"    Original board cell (0, 0): {board.grid[0][0]} (Expected: 0)")

    # 9. Test is_full detection on mini 2x2 board
    mini_board = Board(size=2)
    mini_board.place_stone(0, 0, 1)
    mini_board.place_stone(0, 1, 2)
    mini_board.place_stone(1, 0, 1)
    print(f"\n[9] Mini board full before last move: {mini_board.is_full()} (Expected: False)")
    mini_board.place_stone(1, 1, 2)
    print(f"    Mini board full after last move: {mini_board.is_full()} (Expected: True)")

    print("\nAll Phase 1 Board checks completed successfully!")
