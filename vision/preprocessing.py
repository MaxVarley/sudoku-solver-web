import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

def preprocess_image(path):
    image = cv2.imread(path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 0) # Apply Gaussian blur to reduce noise (can be adjusted)
    # Apply adaptive thresholding to create a binary image, inverts for better contour detection
    thresh = cv2.adaptiveThreshold( 
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )
    return image, thresh

def preprocess_for_model(cell_img, debug_path=None, margin=0.17):
    if len(cell_img.shape) == 3:
        gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = cell_img

    h, w = gray.shape
    margin_h = int(h * margin)
    margin_w = int(w * margin)
    cropped = gray[margin_h:h - margin_h, margin_w:w - margin_w]

    inverted = cv2.bitwise_not(cropped)
    _, thresh = cv2.threshold(inverted, 120, 255, cv2.THRESH_BINARY)
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return np.zeros((1, 28, 28, 1), dtype=np.float32)

    x, y, w, h = cv2.boundingRect(coords) # Get bounding box of non-zero regions, helps in cropping
    digit_crop = thresh[y:y+h, x:x+w]

    max_dim = max(w, h)
    scale = 20.0 / max_dim
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    resized = cv2.resize(digit_crop, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((28, 28), dtype=np.uint8)
    x_offset = (28 - new_w) // 2
    y_offset = (28 - new_h) // 2
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    cy, cx = ndimage.center_of_mass(canvas)
    shift_x = int(np.round(14 - cx))
    shift_y = int(np.round(14 - cy))
    transform = np.float32([[1, 0, shift_x], [0, 1, shift_y]])
    centered = cv2.warpAffine(canvas, transform, (28, 28), borderValue=0)

    if debug_path:
        Image.fromarray(centered).save(debug_path)

    img_array = centered.astype(np.float32) / 255.0
    img_array = np.expand_dims(img_array, axis=(0, -1))  # shape: (1, 28, 28, 1) for model input

    return img_array

def split_cells(warped_img):

    grid = []
    h, w = warped_img.shape[:2]
    cell_h = h // 9
    cell_w = w // 9

    # Splits into 9 rows and 9 columns, could be improved with more advanced techniques
    # like Hough Transform or contour detection for more complex grids
    # Common problem is variable width of borders (exterior = thick, interior = thin)
    # This is a simple approach that assumes uniform cell size and spacing
    for i in range(9):
        row = []
        for j in range(9):
            x_start = j * cell_w
            y_start = i * cell_h
            cell = warped_img[y_start:y_start + cell_h, x_start:x_start + cell_w]
            row.append(cell)
        grid.append(row)
    return grid