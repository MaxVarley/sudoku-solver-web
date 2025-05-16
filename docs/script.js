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
const manualCornerBtn = document.getElementById("manual-corner-btn");
const canvas = document.getElementById("corner-canvas");
const ctx = canvas.getContext("2d");
const resetCornersBtn = document.getElementById("reset-corners");
const submitCornersBtn = document.getElementById("submit-corners");
const manualFromConfirmBtn = document.getElementById("manual-from-confirm");


let cornerPoints = [];

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

function renderBoard(data, tableId, editable = false) {
  const table = document.getElementById(tableId);
  table.innerHTML = '';

  for (let row = 0; row < 9; row++) {
    const tr = document.createElement('tr');
    for (let col = 0; col < 9; col++) {
      const td = document.createElement('td');
      
      if (editable) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.value = data[row][col] === 0 ? '' : data[row][col];
        input.style.width = '28px';
        input.style.height = '28px';
        input.style.textAlign = 'center';
        input.style.border = 'none';
        input.style.fontSize = '18px';

        // Validate input: only digits 1–9 or blank
        input.addEventListener('input', () => {
          const val = input.value.trim();
          if (!/^[1-9]?$/.test(val)) {
            input.value = '';
          }
          data[row][col] = val === '' ? 0 : parseInt(val);
        });

        td.appendChild(input);
      } else {
        td.textContent = data[row][col] === 0 ? '' : data[row][col];
      }

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}


manualFromConfirmBtn.addEventListener("click", () => {
  document.getElementById("grid-confirm-section").style.display = "none";
  document.getElementById("manual-corner-section").style.display = "block";
  drawImageOnCanvas();
});

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

  try {
    const uploadResponse = await fetch("/upload", {
      method: "POST",
      body: formData,
    });
    const uploadResult = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadResult.session_id) {
      outputDiv.innerText = "Failed to upload image.";
      return;
    }

    sessionId = uploadResult.session_id;
    localStorage.setItem("sudoku_session_id", sessionId);

    const gridFormData = new FormData();
    gridFormData.append("session_id", sessionId);

    const detectResponse = await fetch("/detect_grid", {
      method: "POST",
      body: gridFormData,
    });

    const detectResult = await detectResponse.json();

    if (detectResult.warped_url && detectResult.corners) {
      warpedPreview.src = detectResult.warped_url + "?" + Date.now();
      warpedPreview.style.display = "block";
      document.getElementById("grid-confirm-section").style.display = "block";
      outputDiv.innerText = "Please confirm the detected grid.";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Grid not found. Try again or enter corners manually.";
      manualCornerBtn.style.display = "block";
    }

  } catch (err) {
    console.error(err);
    outputDiv.innerText = "Error during grid detection.";
  }
}

confirmGridBtn.addEventListener("click", async () => {
  document.getElementById("grid-confirm-section").style.display = "none";
  outputDiv.innerText = "Reading digits...";

  const formData = new FormData();
  formData.append("session_id", sessionId);

  try {
    const ocrResponse = await fetch("/ocr", {
      method: "POST",
      body: formData
    });

    const result = await ocrResponse.json();

    if (result.input) {
      inputGrid = result.input;
      renderBoard(inputGrid, "input-board", true);
      document.getElementById("ocr-confirm-section").style.display = "block";
      outputDiv.innerText = "Please confirm the OCR result.";
      currentStep = AppState.OCR_CONFIRM;
    } else {
      outputDiv.innerText = "OCR failed. Please try a new image.";
    }

  } catch (err) {
    console.error(err);
    outputDiv.innerText = "Error during OCR.";
  }
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

// Manual Corner Input

manualCornerBtn.addEventListener("click", () => {
  manualCornerBtn.style.display = "none";
  document.getElementById("manual-corner-section").style.display = "block";
  drawImageOnCanvas();
});

function drawImageOnCanvas() {
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
  };
  img.src = uploadedPreview.src;
}

canvas.addEventListener("click", (e) => {
  if (cornerPoints.length >= 4) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  cornerPoints.push([x, y]);

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();

  ctx.font = "12px sans-serif";
  ctx.fillText(["TL", "TR", "BR", "BL"][cornerPoints.length - 1], x + 6, y - 6);
});

resetCornersBtn.addEventListener("click", () => {
  cornerPoints = [];
  drawImageOnCanvas();
});

submitCornersBtn.addEventListener("click", async () => {
  if (cornerPoints.length !== 4) {
    alert("Please click exactly 4 corners.");
    return;
  }

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("corners", JSON.stringify(cornerPoints));

  try {
    const response = await fetch("/manual_warp", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (result.warped_url) {
      warpedPreview.src = result.warped_url + "?" + Date.now();
      warpedPreview.style.display = "block";
      document.getElementById("grid-confirm-section").style.display = "block";
      document.getElementById("manual-corner-section").style.display = "none";
      outputDiv.innerText = "Warp successful. Please confirm.";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Manual warp failed.";
    }
  } catch (err) {
    console.error(err);
    outputDiv.innerText = "Error sending manual corners.";
  }
});
