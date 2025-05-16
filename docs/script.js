const AppState = {
  IMAGE_UPLOAD: 0,
  GRID_CONFIRM: 1,
  OCR_CONFIRM: 2,
  VISUAL_SOLVE: 3,
};

let currentStep = AppState.IMAGE_UPLOAD;
let uploadedImage = null;
let inputGrid = null;

const fileInput = document.getElementById("upload");
const submitBtn = document.getElementById("submit-btn");
const outputDiv = document.getElementById("output");
const warpedPreview = document.getElementById("warped-preview");
const uploadedPreview = document.getElementById("uploaded-preview");
const solvedLabel = document.getElementById("solved-label");
const confirmGridBtn = document.getElementById("confirm-grid");
const retryGridBtn = document.getElementById("retry-grid");
const confirmOCRBtn = document.getElementById("confirm-ocr");
const retryOCRBtn = document.getElementById("retry-ocr");

let sessionId = localStorage.getItem("sudoku_session_id") || null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    uploadedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
      uploadedPreview.src = e.target.result;
      uploadedPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
    outputDiv.innerText = "Image loaded. Click Submit to proceed.";
    currentStep = AppState.IMAGE_UPLOAD;
  }
});

function renderBoard(data, tableId) {
  const table = document.getElementById(tableId);
  table.innerHTML = '';
  for (let row = 0; row < 9; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < 9; col++) {
      const td = document.createElement('td');
      td.textContent = data[row][col] === 0 ? '' : data[row][col];
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

submitBtn.addEventListener("click", async () => {
  if (!uploadedImage) {
    alert("Please upload an image first.");
    return;
  }

  switch (currentStep) {
    case AppState.IMAGE_UPLOAD:
      await handleGridDetection();
      break;
    case AppState.GRID_CONFIRM:
      await handleOCRConfirmation();
      break;
    case AppState.OCR_CONFIRM:
      await handleSolveVisual(inputGrid);
      break;
  }
});

async function handleGridDetection() {
  const formData = new FormData();
  formData.append("image", uploadedImage);
  if (sessionId) formData.append("session_id", sessionId);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!sessionId && result.session_id) {
      sessionId = result.session_id;
      localStorage.setItem("sudoku_session_id", sessionId);
    }

    if (result.warped_url) {
      warpedPreview.src = result.warped_url + "?" + Date.now();
      warpedPreview.style.display = "block";
      document.getElementById("grid-confirm-section").style.display = "block";
      outputDiv.innerText = "Please confirm the detected grid.";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Grid not found. Try a new image.";
    }

    if (result.input) {
      inputGrid = result.input;
    }
  } catch (err) {
    console.error(err);
    outputDiv.innerText = "Error during grid detection.";
  }
}

confirmGridBtn.addEventListener("click", () => {
  document.getElementById("grid-confirm-section").style.display = "none";
  renderBoard(inputGrid, "input-board");
  document.getElementById("ocr-confirm-section").style.display = "block";
  outputDiv.innerText = "Please confirm the OCR result.";
  currentStep = AppState.OCR_CONFIRM;
});

retryGridBtn.addEventListener("click", () => {
  document.getElementById("grid-confirm-section").style.display = "none";
  outputDiv.innerText = "Please upload a new image.";
  uploadedPreview.style.display = "none";
  warpedPreview.style.display = "none";
  currentStep = AppState.IMAGE_UPLOAD;
});

confirmOCRBtn.addEventListener("click", () => {
  document.getElementById("ocr-confirm-section").style.display = "none";
  outputDiv.innerText = "Solving visually...";
  currentStep = AppState.VISUAL_SOLVE;
  handleSolveVisual(inputGrid);
});

retryOCRBtn.addEventListener("click", () => {
  document.getElementById("ocr-confirm-section").style.display = "none";
  outputDiv.innerText = "Please upload a new image.";
  uploadedPreview.style.display = "none";
  warpedPreview.style.display = "none";
  currentStep = AppState.IMAGE_UPLOAD;
});

async function handleOCRConfirmation() {
  renderBoard(inputGrid, 'input-board');
  document.getElementById("ocr-confirm-section").style.display = "block";
  outputDiv.innerText = "Confirm OCR output or upload again.";
}

async function handleSolveVisual(grid) {
  const delay = ms => new Promise(res => setTimeout(res, ms));

  function isValid(board, row, col, num) {
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num || board[x][col] === num) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        if (board[r][c] === num) return false;
      }
    }
    return true;
  }

  async function solve(board) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(board, row, col, num)) {
              board[row][col] = num;
              renderBoard(board, 'solved-board');
              await delay(50);
              if (await solve(board)) return true;
              board[row][col] = 0;
              renderBoard(board, 'solved-board');
              await delay(50);
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  solvedLabel.style.display = "block";
  const boardCopy = grid.map(row => [...row]);
  await solve(boardCopy);
  outputDiv.innerText = "Sudoku Solved!";
}
