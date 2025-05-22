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


def is_blank(cell_img, area_thresh=0.015, margin=0.1, solidity_thresh=0.2):
    if not isinstance(cell_img, np.ndarray):
        return True

    gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY) if len(cell_img.shape) == 3 else cell_img
    h, w = gray.shape
    cropped = gray[int(h * margin):int(h * (1 - margin)), int(w * margin):int(w * (1 - margin))]

    # Noise reduction
    cropped = cv2.medianBlur(cropped, 3)

    # Invert and adaptive threshold
    inverted = cv2.bitwise_not(cropped)
    thresh = cv2.adaptiveThreshold(inverted, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)[1]

    # Morphological opening to remove noise
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    thresh_cleared = clear_border(thresh)

    contours, _ = cv2.findContours(thresh_cleared, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if len(contours) == 0:
        return True

    h_thresh, w_thresh = thresh_cleared.shape
    valid_contours = []

    for cnt in contours:
        x, y, w_cnt, h_cnt = cv2.boundingRect(cnt)
        if x <= 1 or y <= 1 or x + w_cnt >= w_thresh - 1 or y + h_cnt >= h_thresh - 1:
            continue
        area = cv2.contourArea(cnt)
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        solidity = area / float(hull_area) if hull_area > 0 else 0
        if solidity > solidity_thresh:
            valid_contours.append(cnt)

    if len(valid_contours) == 0:
        # Additional mean intensity check
        if np.mean(cropped) > 240:
            return True
        return False

    cnt = max(valid_contours, key=cv2.contourArea)
    mask = np.zeros(thresh_cleared.shape, dtype='uint8')
    cv2.drawContours(mask, [cnt], -1, 255, -1)
    percent_filled = cv2.countNonZero(mask) / float(mask.size)

    return percent_filled < area_thresh




def recognize_cells(cell_imgs):
    board = []
    for row_idx, row in enumerate(cell_imgs):
        board_row = []
        for col_idx, cell in enumerate(row):
            digit = 0
            try:
                if not is_blank(cell):
                    input_tensor = preprocess_for_model(cell)
                    prediction = get_model().predict(input_tensor, verbose=0)
                    digit = int(np.argmax(prediction))
            except Exception as e:
                print(f"Error processing cell[{row_idx}][{col_idx}]: {e}")
            board_row.append(digit)
        board.append(board_row)
    return board
