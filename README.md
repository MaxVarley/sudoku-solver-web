# OCR Sudoku Solver

A web-based Sudoku solver that uses image processing and OCR to detect and solve Sudoku puzzles from photos. Upload a photo of a Sudoku grid, and the app will automatically detect, digitise, and solve it.

---

## Browser Demo

[Try it here on render ](https://sudoku-solver-web.onrender.com)  

---

## Features

- Upload any photo of a Sudoku puzzle
- Automatic grid detection and perspective correction
- OCR digit recognition using a tiny custom-trained model
- Visual solving animation that fills in missing digits
- Manual corner adjustment and manual digit input options
  
---

## Tech Stack

- **Frontend**:  
  - HTML5
  - CSS
  - JavaScript

- **Backend**:
  - Python  
  - Flask for API handling  
  - OpenCV for image processing  
  - Custom CNN OCR model (trained on augmented MNIST)

- **Deployment**:
  - [Render.com](https://render.com) for backend and static hosting

---

## License

This project is for educational use, you are welcome to modify or extend it.
