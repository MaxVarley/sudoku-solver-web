import os
import uuid
import shutil
import cv2
from flask import Flask, request, jsonify, send_from_directory
from vision.grid_detection import warp_from_corners
import numpy as np

from vision.preprocessing import preprocess_image, split_cells
from vision.grid_detection import find_sudoku_contour, get_perspective_transform
from vision.OCR import recognize_cells
from solver import solve_and_record_steps

app = Flask(__name__)
UPLOAD_FOLDER = 'sessions'
MAX_IMAGE_SIZE_MB = 10


# Utility: create or validate session
def get_session_path(session_id=None):
    if session_id:
        session_path = os.path.join(UPLOAD_FOLDER, session_id)
        if not os.path.exists(session_path):
            raise FileNotFoundError("Session not found")
    else:
        session_id = str(uuid.uuid4())
        session_path = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(session_path, exist_ok=True)
    return session_id, session_path


@app.route('/upload', methods=['POST'])
def upload():
    # Save uploaded image and return session ID
    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['image']
    if file.filename == '' or not file:
        return jsonify({'error': 'No selected file'}), 400

    if len(file.read()) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        return jsonify({'error': 'Image too large'}), 413
    file.seek(0)

    session_id, session_path = get_session_path()
    image_path = os.path.join(session_path, 'uploaded_image.png')
    file.save(image_path)

    # Keep session folder count under 10
    session_folders = sorted(
        [os.path.join(UPLOAD_FOLDER, d) for d in os.listdir(UPLOAD_FOLDER)],
        key=os.path.getmtime
    )
    if len(session_folders) > 10:
        for old_folder in session_folders[:-10]:
            shutil.rmtree(old_folder)

    return jsonify({'session_id': session_id})


@app.route('/detect_grid', methods=['POST'])
def detect_grid():
    session_id = request.form.get('session_id')
    if not session_id:
        return jsonify({'error': 'Missing session_id'}), 400

    try:
        session_id, session_path = get_session_path(session_id)
        image_path = os.path.join(session_path, 'uploaded_image.png')

        original, thresh = preprocess_image(image_path)
        contour = find_sudoku_contour(thresh)
        warped, ordered_corners = get_perspective_transform(original, contour)

        warped_path = os.path.join(session_path, 'warped_board.png')
        cv2.imwrite(warped_path, warped)

        return jsonify({
            'warped_url': f'/sessions/{session_id}/warped_board.png',
            'corners': ordered_corners.tolist()
        })


    except Exception as e:
        return jsonify({'error': f'Detection failed: {str(e)}'}), 500

@app.route('/manual_warp', methods=['POST'])
def manual_warp():
    session_id = request.form.get('session_id')
    corners = request.form.get('corners')

    if not session_id or not corners:
        return jsonify({'error': 'Missing session_id or corners'}), 400

    try:
        # Parse stringified list of points
        corners = np.array(eval(corners), dtype="float32")
        if corners.shape != (4, 2):
            raise ValueError("Corners must be a 4x2 array")

        session_id, session_path = get_session_path(session_id)
        image_path = os.path.join(session_path, 'uploaded_image.png')
        original = cv2.imread(image_path)

        warped = warp_from_corners(original, corners)
        warped_path = os.path.join(session_path, 'warped_board.png')
        cv2.imwrite(warped_path, warped)

        return jsonify({
            'warped_url': f'/sessions/{session_id}/warped_board.png',
            'message': 'Manual warp successful'
        })

    except Exception as e:
        return jsonify({'error': f'Manual warp failed: {str(e)}'}), 500

@app.route('/ocr', methods=['POST'])
def ocr_grid():
    session_id = request.form.get('session_id')
    if not session_id:
        return jsonify({'error': 'Missing session_id'}), 400

    try:
        session_id, session_path = get_session_path(session_id)
        warped_path = os.path.join(session_path, 'warped_board.png')
        warped = cv2.imread(warped_path)

        cell_imgs = split_cells(warped)
        board = recognize_cells(cell_imgs)

        return jsonify({'input': board})

    except Exception as e:
        return jsonify({'error': f'OCR failed: {str(e)}'}), 500


@app.route('/solve', methods=['POST'])
def solve():
    data = request.get_json()
    if not data or 'grid' not in data:
        return jsonify({'error': 'Missing grid data'}), 400

    try:
        board = data['grid']
        board_copy = [row[:] for row in board]  # Deep copy to preserve input
        success, steps, final_board = solve_and_record_steps(board_copy)

        return jsonify({
            'success': success,
            'steps': steps,
            'finalBoard': final_board
        })

    except Exception as e:
        return jsonify({'error': f'Solving failed: {str(e)}'}), 500



@app.route('/sessions/<session_id>/<path:filename>')
def serve_session_file(session_id, filename):
    session_path = os.path.join(UPLOAD_FOLDER, session_id)
    if not os.path.exists(os.path.join(session_path, filename)):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(session_path, filename)


@app.route('/')
def serve_index():
    return send_from_directory('docs', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('docs', path)


if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
