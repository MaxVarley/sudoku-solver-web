import cv2
import numpy as np
import os
import tensorflow as tf

from vision.preprocessing import preprocess_for_model

MODEL_PATH = 'models/mnist_model.h5'
_model = None  # lazy-loaded model

def get_model():
    global _model
    if _model is None:
        _model = tf.keras.models.load_model(MODEL_PATH)
    return _model


def is_blank(cell_img, threshold=0.01, margin=0.2):
    if not isinstance(cell_img, np.ndarray):
        return True
    if len(cell_img.shape) == 3:
        gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = cell_img

    h, w = gray.shape

    # crop the image to reduce bordering artifacts
    cropped = gray[int(h * margin):int(h * (1 - margin)), int(w * margin):int(w * (1 - margin))]

    # invert the image for better thresholding
    inverted = cv2.bitwise_not(cropped)
    _, binary = cv2.threshold(inverted, 180, 255, cv2.THRESH_BINARY)
    ink_ratio = np.count_nonzero(binary) / binary.size
    return ink_ratio < threshold  # Adjust threshold as needed


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
