import sys
import os
import cv2
from tkinter import Tk
from tkinter.filedialog import askopenfilename

# Add root directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from vision.preprocess import preprocess_image
from vision.grid_detection import find_sudoku_contour, get_perspective_transform

def main():
    Tk().withdraw()
    print("Please select a Sudoku image...")
    image_path = askopenfilename(filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp")])

    if not image_path:
        print("No image selected. Exiting.")
        return

    original, thresh = preprocess_image(image_path)
    debug_img = original.copy()

    # Draw all detected 4-point contours (not just best one)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(approx) == 4:
            cv2.drawContours(debug_img, [approx], -1, (0, 255, 0), 2)

    try:
        contour = find_sudoku_contour(thresh)
        warped = get_perspective_transform(original, contour)
        cv2.imshow("Warped Grid", warped)
    except Exception as e:
        print(f"[INFO] Sudoku grid not found: {e}")

    # Always show preprocessing steps
    cv2.imshow("Original", original)
    cv2.imshow("Thresholded", thresh)
    cv2.imshow("Detected 4-corner Candidates", debug_img)

    print("Press any key in a window to close...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
