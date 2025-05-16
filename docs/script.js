const AppState = {
  IMAGE_UPLOAD: 0,
  GRID_CONFIRM: 1,
  OCR_CONFIRM: 2,
  VISUAL_SOLVE: 3,
};

let currentStep = AppState.IMAGE_UPLOAD;
let uploadedImage = null;
let inputGrid = null;
let sessionId = localStorage.getItem("sudoku_session_id") || null;

const fileInput = document.getElementById("upload");
const submitBtn = document.getElementById("submit-btn");
const outputDiv = document.getElementById("output");

const warpedLabel = document.getElementById("warped-label");
const warpedPreview = document.getElementById("warped-preview");
const uploadedPreview = document.getElementById("uploaded-preview");
const solvedLabel = document.getElementById("solved-label");
const solvedBoard = document.getElementById("solved-board");
const inputBoard = document.getElementById("input-board");
const ocrLabel = document.getElementById("ocr-label");

const confirmGridBtn = document.getElementById("confirm-grid");
const retryGridBtn = document.getElementById("retry-grid");
const confirmOCRBtn = document.getElementById("confirm-ocr");
const retryOCRBtn = document.getElementById("retry-ocr");
const manualCornerBtn = document.getElementById("manual-corner-btn");
const manualFromConfirmBtn = document.getElementById("manual-from-confirm");
const manualInputBtn = document.getElementById("manual-input-btn");

const gridConfirmSection = document.getElementById("grid-confirm-section");
const ocrConfirmSection = document.getElementById("ocr-confirm-section");

const canvas = document.getElementById("corner-canvas");
const ctx = canvas.getContext("2d");
const resetCornersBtn = document.getElementById("reset-corners");
const submitCornersBtn = document.getElementById("submit-corners");

const restartContainer = document.getElementById("restart-container");
const startOverBtn = document.getElementById("start-over-btn");

startOverBtn.onclick = () => location.reload();

let cornerPoints = [[50, 50], [400, 50], [400, 400], [50, 400]];
let draggingIndex = null;
let uploadedCanvasImage = new Image();

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
        input.addEventListener('input', () => {
          const val = input.value.trim();
          input.value = /^[1-9]$/.test(val) ? val : '';
          data[row][col] = val === '' ? 0 : parseInt(val);
        });
        input.style.width = '28px';
        input.style.height = '28px';
        input.style.textAlign = 'center';
        input.style.border = 'none';
        input.style.fontSize = '18px';

        td.appendChild(input);
      } else {
        td.textContent = data[row][col] === 0 ? '' : data[row][col];
      }

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    uploadedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
      uploadedPreview.src = e.target.result;
      uploadedPreview.style.display = "block";
      submitBtn.style.display = "block";
      fileInput.style.display = "none";
    };
    reader.readAsDataURL(file);
    outputDiv.innerText = "Image loaded. Click Submit to proceed.";
    resetAll();
  }
});

function resetAll() {
  gridConfirmSection.style.display = "none";
  ocrConfirmSection.style.display = "none";
  inputBoard.style.display = "none";
  ocrLabel.style.display = "none";
  solvedBoard.style.display = "none";
  solvedLabel.style.display = "none";
  warpedPreview.style.display = "none";
  warpedLabel.style.display = "none";
  manualCornerBtn.style.display = "none";
  document.getElementById("manual-corner-section").style.display = "none";
  document.getElementById("ocr-prompt").style.display = "none";
  restartContainer.style.display = "none";
}

submitBtn.addEventListener("click", async () => {
  if (!uploadedImage) return alert("Please upload an image first.");
  switch (currentStep) {
    case AppState.IMAGE_UPLOAD: await handleGridDetection(); break;
    case AppState.GRID_CONFIRM: await handleOCRConfirmation(); break;
    case AppState.OCR_CONFIRM: await handleSolveVisual(inputGrid); break;
  }
});

async function handleGridDetection() {
  const formData = new FormData();
  formData.append("image", uploadedImage);

  try {
    const uploadRes = await fetch("/upload", { method: "POST", body: formData });
    const uploadResult = await uploadRes.json();

    sessionId = uploadResult.session_id;
    localStorage.setItem("sudoku_session_id", sessionId);

    const gridForm = new FormData();
    gridForm.append("session_id", sessionId);

    const detectRes = await fetch("/detect_grid", { method: "POST", body: gridForm });
    const detectResult = await detectRes.json();

    if (detectResult.warped_url) {
      warpedPreview.src = detectResult.warped_url + "?" + Date.now();
      warpedPreview.style.display = "block";
      warpedLabel.style.display = "block";
      gridConfirmSection.style.display = "block";
      outputDiv.innerText = "";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Grid not found. Try again or enter corners manually.";
      manualCornerBtn.style.display = "inline-block";
    }
  } catch (err) {
    outputDiv.innerText = "Error during grid detection.";
  }
}

confirmGridBtn.addEventListener("click", async () => {
  gridConfirmSection.style.display = "none";
  outputDiv.innerText = "";

  const readingDiv = document.createElement("div");
  readingDiv.id = "reading-msg";
  readingDiv.className = "grid-title";
  readingDiv.innerText = "Reading digits...";
  warpedPreview.insertAdjacentElement("afterend", readingDiv);

  const formData = new FormData();
  formData.append("session_id", sessionId);

  try {
    const ocrRes = await fetch("/ocr", { method: "POST", body: formData });
    const result = await ocrRes.json();

    if (result.input) {
      inputGrid = result.input;
      renderBoard(inputGrid, "input-board", true);
      inputBoard.style.display = "table";
      ocrLabel.style.display = "block";
      ocrConfirmSection.style.display = "block";
      document.getElementById("ocr-prompt").style.display = "block";
      readingDiv.remove();
      currentStep = AppState.OCR_CONFIRM;
    } else {
      outputDiv.innerText = "OCR failed.";
      restartContainer.style.display = "block";
    }
  } catch (err) {
    outputDiv.innerText = "Error during OCR.";
    restartContainer.style.display = "block";
  }
});

confirmOCRBtn.addEventListener("click", () => {
  ocrConfirmSection.style.display = "none";
  inputBoard.style.display = "none";
  document.getElementById("ocr-prompt").style.display = "none";
  const readingEl = document.getElementById("reading-msg");
  if (readingEl) readingEl.remove();
  outputDiv.innerText = "Solving visually...";
  currentStep = AppState.VISUAL_SOLVE;
  handleSolveVisual(inputGrid);
});

retryGridBtn.addEventListener("click", resetAll);
retryOCRBtn.addEventListener("click", resetAll);

manualInputBtn.addEventListener("click", () => {
  renderBoard(inputGrid, "input-board", true);
  outputDiv.innerText = "Edit the grid manually, then press Solve.";
});

async function handleSolveVisual(grid) {
  const res = await fetch("/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid })
  });

  const result = await res.json();
  if (!result.success || !result.finalBoard) {
    outputDiv.innerText = "Could not solve this puzzle.";
    restartContainer.style.display = "block";
    return;
  }

  const finalBoard = result.finalBoard;
  const board = grid.map(row => [...row]);
  solvedLabel.style.display = "block";
  solvedBoard.style.display = "table";

  const delay = ms => new Promise(res => setTimeout(res, ms));
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        board[row][col] = finalBoard[row][col];
        renderBoard(board, 'solved-board');
        await delay(50);
      }
    }
  }

  document.querySelectorAll(".grid-title").forEach(el => {
    if (el.innerText === "Sudoku Solved!") el.remove();
  });

  const solvedMsg = document.createElement("div");
  solvedMsg.className = "grid-title";
  solvedMsg.innerText = "Sudoku Solved!";
  solvedBoard.insertAdjacentElement("afterend", solvedMsg);
  restartContainer.style.display = "block";
}

// Manual Corners
manualCornerBtn.addEventListener("click", () => {
  document.getElementById("manual-corner-section").style.display = "block";
  drawImageOnCanvas();
});

manualFromConfirmBtn.addEventListener("click", () => {
  gridConfirmSection.style.display = "none";
  document.getElementById("manual-corner-section").style.display = "block";
  drawImageOnCanvas();
});

function drawImageOnCanvas() {
  uploadedCanvasImage.onload = drawCanvas;
  uploadedCanvasImage.src = uploadedPreview.src;
}

function drawCanvas() {
  canvas.width = uploadedCanvasImage.width;
  canvas.height = uploadedCanvasImage.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedCanvasImage, 0, 0);

  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...cornerPoints[0]);
  for (let i = 1; i < 4; i++) ctx.lineTo(...cornerPoints[i]);
  ctx.closePath();
  ctx.stroke();

  for (let i = 0; i < 4; i++) {
    const [x, y] = cornerPoints[i];
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.strokeText(["TL", "TR", "BR", "BL"][i], x + 10, y - 5);
  }
}

canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = cornerPoints[i];
    if (Math.hypot(cx - x, cy - y) < 12) {
      draggingIndex = i;
      return;
    }
  }
});

canvas.addEventListener("mousemove", e => {
  if (draggingIndex === null) return;
  const rect = canvas.getBoundingClientRect();
  cornerPoints[draggingIndex] = [e.clientX - rect.left, e.clientY - rect.top];
  drawCanvas();
});

canvas.addEventListener("mouseup", () => draggingIndex = null);
canvas.addEventListener("mouseleave", () => draggingIndex = null);

resetCornersBtn.addEventListener("click", () => {
  cornerPoints = [[50, 50], [400, 50], [400, 400], [50, 400]];
  drawCanvas();
});

submitCornersBtn.addEventListener("click", async () => {
  const scaled = cornerPoints.map(([x, y]) => {
    const sx = uploadedCanvasImage.naturalWidth / canvas.width;
    const sy = uploadedCanvasImage.naturalHeight / canvas.height;
    return [x * sx, y * sy];
  });

  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("corners", JSON.stringify(scaled));

  try {
    const response = await fetch("/manual_warp", { method: "POST", body: formData });
    const result = await response.json();
    if (result.warped_url) {
      warpedPreview.src = result.warped_url + "?" + Date.now();
      warpedPreview.style.display = "block";
      warpedLabel.style.display = "block";
      gridConfirmSection.style.display = "block";
      document.getElementById("manual-corner-section").style.display = "none";
      outputDiv.innerText = "Warp successful. Please confirm.";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Manual warp failed.";
      restartContainer.style.display = "block";
    }
  } catch (err) {
    outputDiv.innerText = "Error sending manual corners.";
    restartContainer.style.display = "block";
  }
});
