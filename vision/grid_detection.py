import cv2
import numpy as np

def find_sudoku_contour(thresh_img, min_area=2000, aspect_ratio_tol=0.1):
    """
    Find the best candidate contour for the Sudoku board.
    Returns a 4-point polygon (approx) if successful, or raises an error.
    """
    contours, _ = cv2.findContours(thresh_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best_candidate = None

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        area = cv2.contourArea(contour)
        if area < min_area:
            continue

        approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)

        if len(approx) != 4:
            continue  # not a quadrilateral

        x, y, w, h = cv2.boundingRect(approx)
        aspect_ratio = w / float(h)
        if abs(aspect_ratio - 1.0) > aspect_ratio_tol:
            continue  # not square enough

        best_candidate = approx
        break

    if best_candidate is None:
        raise ValueError("No suitable Sudoku contour found.")

    return best_candidate


def get_perspective_transform(image, contour):
    """
    Compute a top-down warped image of the Sudoku board from a 4-point contour.
    Returns the warped image and the ordered corners.
    """
    if len(contour) != 4:
        raise Exception("Contour must have 4 points.")

    pts = contour.reshape(4, 2).astype("float32")
    rect = order_points(pts)

    side = max(
        np.linalg.norm(rect[0] - rect[1]),
        np.linalg.norm(rect[1] - rect[2]),
        np.linalg.norm(rect[2] - rect[3]),
        np.linalg.norm(rect[3] - rect[0])
    )

    dst = np.array([
        [0, 0],
        [side, 0],
        [side, side],
        [0, side]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (int(side), int(side)))

    return warped, rect  # return both warped image and ordered points


def warp_from_corners(image, corners):
    """
    Warp the original image using manually provided corners (TL, TR, BR, BL).
    """
    rect = np.array(corners, dtype="float32")
    if rect.shape != (4, 2):
        raise ValueError("Corners must be a list or array of shape (4, 2)")

    side = max(
        np.linalg.norm(rect[0] - rect[1]),
        np.linalg.norm(rect[1] - rect[2]),
        np.linalg.norm(rect[2] - rect[3]),
        np.linalg.norm(rect[3] - rect[0])
    )

    dst = np.array([
        [0, 0],
        [side, 0],
        [side, side],
        [0, side]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (int(side), int(side)))
    return warped


def order_points(pts):
    """
    Order 4 corner points in the order: top-left, top-right, bottom-right, bottom-left.
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    rect[0] = pts[np.argmin(s)]       # top-left
    rect[2] = pts[np.argmax(s)]       # bottom-right
    rect[1] = pts[np.argmin(diff)]    # top-right
    rect[3] = pts[np.argmax(diff)]    # bottom-left

    return rect
