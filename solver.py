BOX_SIZE = 3

def is_board_valid(board):
    def has_duplicates(unit):
        nums = [n for n in unit if n != 0]
        return len(nums) != len(set(nums))
    
    # Check rows
    for row in board:
        if has_duplicates(row):
            return False
        
    # Check columns
    for col in zip(*board):
        if has_duplicates(col):
            return False
        
    # Check BOX_SIZExBOX_SIZE boxes
    for box_row in range(0, 9, BOX_SIZE):
        for box_col in range(0, 9, BOX_SIZE):
            box = [board[r][c] for r in range(box_row, box_row + BOX_SIZE) for c in range(box_col, box_col + BOX_SIZE)]
            if has_duplicates(box):
                return False
    return True

def is_valid(board, row, col, num):
    if num in board[row]:
        return False
    for i in range(9):
        if board[i][col] == num:
            return False
    box_start_row = row - row % BOX_SIZE
    box_start_col = col - col % BOX_SIZE
    for i in range(BOX_SIZE):
        for j in range(BOX_SIZE):
            if board[box_start_row + i][box_start_col + j] == num:
                return False
    return True

def solve_sudoku(board):
    if not is_board_valid(board):
        return False  # Reject invalid puzzles immediately

    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                for num in range(1, 10):
                    if is_valid(board, row, col, num):
                        board[row][col] = num
                        if solve_sudoku(board):
                            return True
                        board[row][col] = 0
                return False
    return True


def solve_and_record_steps(board):
    """
    Solves the board and records each placement and removal as a step.
    Each step is a dictionary: {'row': r, 'col': c, 'value': v}
    """
    if not is_board_valid(board):
        return False, [], board  # Reject early with empty steps
    
    steps = []

    def backtrack():
        for row in range(9):
            for col in range(9):
                if board[row][col] == 0:
                    for num in range(1, 10):
                        if is_valid(board, row, col, num):
                            board[row][col] = num
                            steps.append({'row': row, 'col': col, 'value': num})

                            if backtrack():
                                return True

                            board[row][col] = 0
                            steps.append({'row': row, 'col': col, 'value': 0})
                    return False
        return True

    success = backtrack()
    return success, steps, board

def print_board(board):
    for row in board:
        print(" ".join(str(num) if num != 0 else "." for num in row))
