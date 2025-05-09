import time
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from solver import (
    solve_sudoku,
    print_board, 
    is_board_valid
)

test_board = [
    [3, 0, 0, 1, 0, 0, 0, 8, 0],
    [0, 0, 0, 0, 6, 0, 0, 0, 4],
    [5, 6, 0, 2, 0, 0, 0, 0, 0],
    [0, 3, 0, 0, 0, 8, 1, 0, 2],
    [6, 0, 0, 0, 0, 0, 0, 7, 0],
    [0, 0, 0, 0, 0, 4, 5, 0, 0],
    [0, 0, 1, 0, 0, 9, 7, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 9, 0],
    [0, 2, 0, 0, 8, 0, 0, 0, 0]
]

print("Original board:")
print_board(test_board)

if is_board_valid(test_board):
    start_time = time.time()
    if solve_sudoku(test_board):
        elapsed_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        print("\nSolved board:")
        print_board(test_board)
        print(f"\nSolved in {elapsed_time:.2f} milliseconds.")
    else:
        print("\nNo solution exists.")
else:
    print("\nThe board is not valid.")
