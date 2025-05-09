import os
import uuid
import shutil
import tensorflow as tf
import cv2
from flask import Flask, request, jsonify, send_from_directory

from vision.preprocessing import preprocess_image, split_cells
from vision.grid_detection import find_sudoku_contour, get_perspective_transform
from vision.OCR import recognize_cells

from solver import solve_sudoku

app = Flask(__name__)
UPLOAD_FOLDER = 'sessions'
MAX_IMAGE_SIZE_MB = 3

@app.route('/upload', methods=['POST'])
def upload():
    # Generate a new session ID for every submission
    session_id = str(uuid.uuid4())
    session_path = os.path.join(UPLOAD_FOLDER, session_id)
    os.makedirs(session_path, exist_ok=True)

    # Ensure there are no more than 10 folders in the sessions directory
    session_folders = [os.path.join(UPLOAD_FOLDER, d) for d in os.listdir(UPLOAD_FOLDER) if os.path.isdir(os.path.join(UPLOAD_FOLDER, d))]
    if len(session_folders) > 10:
        # Sort folders by modification time (oldest first) and delete oldest folders until there are 10 or fewer
        session_folders.sort(key=os.path.getmtime)
        for folder in session_folders[:-10]:
            shutil.rmtree(folder)

    if 'image' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['image']
    if file.filename == '' or not file:
        return jsonify({'error': 'No selected file'}), 400
    if len(file.read()) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
        return jsonify({'error': 'Image too large'}), 413
    file.seek(0)

    image_path = os.path.join(session_path, 'uploaded_image.png')  # Overwrite the file
    file.save(image_path)


    try:
        original, thresh = preprocess_image(image_path)

        contour = find_sudoku_contour(thresh)
        warped = get_perspective_transform(original, contour)
        cell_imgs = split_cells(warped)
    
        warped_path = os.path.join(session_path, 'warped_board.png')
        cv2.imwrite(warped_path, warped)  # Save the warped board
    
        board = recognize_cells(cell_imgs)
    
        board_copy = [row[:] for row in board]
        solved = solve_sudoku(board_copy)
    except Exception as e:
        return jsonify({'error': f'Processing failed: {e}'}), 500

    return jsonify({
        'input': board,
        'solved': board_copy if solved else None,
        'success': solved,
        'session_id': session_id,
        'warped_url': f'/sessions/{session_id}/warped_board.png'
    })

@app.route('/sessions/<session_id>/<path:filename>')
def serve_session_file(session_id, filename):
    session_path = os.path.join(UPLOAD_FOLDER, session_id)
    if not os.path.exists(os.path.join(session_path, filename)):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(session_path, filename)

@app.route('/')
def serve_index():
    return send_from_directory('docs', 'index.html')

# Serve static files from the docs directory
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('docs', path)

if __name__ == '__main__':
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True)