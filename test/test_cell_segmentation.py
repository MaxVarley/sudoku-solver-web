import sys
import os
import cv2
import matplotlib.pyplot as plt
from tkinter import Tk
from tkinter.filedialog import askopenfilename

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from vision.preprocessing import preprocess_image
from vision.grid_detection import find_sudoku_contour, get_perspective_transform
from vision.cell_segmentation import split_cells

def main():
    Tk().withdraw()
    image_path = askopenfilename(filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp")])

    if not image_path:
        print("No image selected.")
        return

    # Step 1: Preprocess the image
    original, thresh = preprocess_image(image_path)

    try:
        # Step 2: Detect the grid and warp it
        contour = find_sudoku_contour(thresh)
        warped = get_perspective_transform(original, contour)

        # Step 3: Segment into 81 cells
        cells = split_cells(warped)

    except Exception as e:
        print(f"[ERROR] {e}")
        return

    # Step 4: Display warped board and cell segments
    fig, axes = plt.subplots(10, 9, figsize=(10, 12))
    fig.suptitle("Warped Sudoku Grid + Segmented Cells", fontsize=16)

    # Row 0: Full warped image (spanning all 9 columns)
    for i in range(9):
        axes[0, i].imshow(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
        axes[0, i].axis('off')
        if i == 4:
            axes[0, i].set_title("Warped Grid (top row)")

    # Rows 1–9: Display the 81 individual cells
    flat_cells = [cell for row in cells for cell in row]
    for idx, cell in enumerate(flat_cells):
        row = (idx // 9) + 1  # offset by 1 to skip top row
        col = idx % 9
        # Handle grayscale or color image
        if len(cell.shape) == 2:
            axes[row, col].imshow(cell, cmap='gray')
        else:
            axes[row, col].imshow(cv2.cvtColor(cell, cv2.COLOR_BGR2RGB))
        axes[row, col].axis('off')

    plt.tight_layout()
    plt.subplots_adjust(top=0.95)  # leave room for title
    plt.show()

if __name__ == "__main__":
    main()
