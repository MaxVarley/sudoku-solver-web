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
const manualInputBtn = document.getElementById("manual-input-btn");

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

manualInputBtn.addEventListener("click", () => {
  renderBoard(inputGrid, 'input-board', true); // Enable editing
  outputDiv.innerText = "Edit the grid manually, then press Solve.";
});

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
  const response = await fetch("/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid })
  });

  const result = await response.json();

  if (!result.success || !result.finalBoard) {
    outputDiv.innerText = "Could not solve this puzzle.";
    return;
  }

  const finalBoard = result.finalBoard;
  const board = grid.map(row => [...row]);
  solvedLabel.style.display = "block";

  const delay = ms => new Promise(res => setTimeout(res, ms));
  const ANIMATION_DELAY = 50;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        board[row][col] = finalBoard[row][col];
        renderBoard(board, 'solved-board');
        await delay(ANIMATION_DELAY);
      }
    }
  }

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

const HANDLE_RADIUS = 8;
let draggingIndex = null;

 cornerPoints = [[50, 50], [400, 50], [400, 400], [50, 400]];

let uploadedCanvasImage = new Image();
uploadedCanvasImage.onload = () => drawCanvas();

function drawImageOnCanvas() {
  uploadedCanvasImage.src = uploadedPreview.src;
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedCanvasImage, 0, 0, canvas.width, canvas.height);

  // Outline
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...cornerPoints[0]);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(...cornerPoints[i]);
  }
  ctx.closePath();
  ctx.stroke();

  // Corner handles
  for (let i = 0; i < 4; i++) {
    const [x, y] = cornerPoints[i];
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.strokeText(["TL", "TR", "BR", "BL"][i], x + 10, y - 5);
  }
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (let i = 0; i < 4; i++) {
    const [cx, cy] = cornerPoints[i];
    const dist = Math.hypot(cx - x, cy - y);
    if (dist < HANDLE_RADIUS * 2) {
      draggingIndex = i;
      return;
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (draggingIndex === null) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  cornerPoints[draggingIndex] = [x, y];
  drawCanvas();
});

canvas.addEventListener("mouseup", () => {
  draggingIndex = null;
});

canvas.addEventListener("mouseleave", () => {
  draggingIndex = null;
});

resetCornersBtn.addEventListener("click", () => {
  cornerPoints = [
    [50, 50], [400, 50], [400, 400], [50, 400]
  ];
  drawCanvas();
});

submitCornersBtn.addEventListener("click", async () => {
  const scaledCorners = cornerPoints.map(([x, y]) => {
    const scaleX = uploadedCanvasImage.naturalWidth / canvas.width;
    const scaleY = uploadedCanvasImage.naturalHeight / canvas.height;
    return [x * scaleX, y * scaleY];
  });

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("corners", JSON.stringify(scaledCorners));

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
