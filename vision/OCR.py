import cv2
import numpy as np
import tensorflow as tf
from skimage.segmentation import clear_border

from vision.preprocessing import preprocess_for_model

MODEL_PATH = 'models/mnist_model.h5'
_model = None  # lazy-loaded model

def get_model():
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model


def is_blank(cell_img, area_thresh=0.02, margin=0):
    """
    Check if the cell is blank or has too little content.
    Returns True if the cell is blank or has too little content.
    """
    if not isinstance(cell_img, np.ndarray):
        return True

    # Convert to grayscale if needed
    gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY) if len(cell_img.shape) == 3 else cell_img

    h, w = gray.shape
    cropped = gray[int(h * margin):int(h * (1 - margin)), int(w * margin):int(w * (1 - margin))]

    # thresholding using Otsu's method
    thresh = cv2.threshold(cropped, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]

    # Clear features touching the border
    # This really helps to avoid false positives on the edges
    thresh_cleared = clear_border(thresh)

    # Find contours
    contours, _ = cv2.findContours(thresh_cleared, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours) == 0:
        return True

    # Take largest valid contour
    cnt = max(contours, key=cv2.contourArea)
    mask = np.zeros(thresh_cleared.shape, dtype='uint8')
    cv2.drawContours(mask, [cnt], -1, 255, -1)

    percent_filled = cv2.countNonZero(mask) / float(mask.size)

    return percent_filled < area_thresh



def recognize_cells(cell_imgs):
    """
    Recognize digits in the given cell images using a pre-trained model.
    Each cell image is expected to be a 28x28 grayscale image.
    Returns a 2D list of recognized digits.
    """
    board = []
    for row_idx, row in enumerate(cell_imgs):
        board_row = []
        for col_idx, cell in enumerate(row):
            digit = 0
            try:
                if not is_blank(cell):
                    # Need to preprocess the image to match the model input
                    input_tensor = preprocess_for_model(cell)
                    prediction = get_model().predict(input_tensor, verbose=0)
                    digit = int(np.argmax(prediction))
            except Exception as e:
                print(f"Error processing cell[{row_idx}][{col_idx}]: {e}")
            board_row.append(digit)
        board.append(board_row)
    return board
