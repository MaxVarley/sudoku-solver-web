// --- 1. App State & Globals ---

const AppState = { IMAGE_UPLOAD: 0, GRID_CONFIRM: 1, OCR_CONFIRM: 2, VISUAL_SOLVE: 3 };
let currentStep = AppState.IMAGE_UPLOAD;
let uploadedImage = null;
let inputGrid = null;
let sessionId = localStorage.getItem("sudoku_session_id") || null;

// DOM Refs
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
const ocrBtn = document.getElementById("ocr-btn");
const gridConfirmSection = document.getElementById("grid-confirm-section");
const ocrConfirmSection = document.getElementById("ocr-confirm-section");
const canvas = document.getElementById("corner-canvas");
const resetCornersBtn = document.getElementById("reset-corners");
const submitCornersBtn = document.getElementById("submit-corners");
const restartContainer = document.getElementById("restart-container");
const startOverBtn = document.getElementById("start-over-btn");
const ctx = canvas.getContext("2d");

// Example Images & Intro
const exampleImagesDiv = document.getElementById("example-images");
const exampleImgs = document.querySelectorAll(".example-img");
const introText = document.getElementById("intro-text");

// Manual Corners State
let cornerPoints = [
  [0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]
];
let draggingIndex = null;
let uploadedCanvasImage = new Image();

// --- 2. UI Utility Functions ---

function showIntroText() { introText.style.display = ""; }
function hideIntroText() { introText.style.display = "none"; }
function showExampleImages() { exampleImagesDiv.style.display = "flex"; }
function hideExampleImages() { exampleImagesDiv.style.display = "none"; }

function showSections(...idsToShow) {
  const allIds = [
    'upload-section', 'uploaded-preview', 'submit-container',
    'warped-label', 'warped-preview', 'ocr-button-group',
    'ocr-label', 'input-board', 'ocr-confirm-section',
    'manual-corner-section', 'grid-confirm-section',
    'ocr-prompt', 'solved-board', 'solved-label',
    'manual-corner-btn-container', 'output'
  ];
  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = idsToShow.includes(id) ? '' : 'none';
  });
  document.getElementById('start-over-btn').style.display = idsToShow.includes('upload-section') ? 'none' : '';
}

function showOnly(...idsToShow) {
  const allIds = [
    'upload-section', 'uploaded-preview', 'submit-container',
    'warped-label', 'warped-preview', 'ocr-button-group',
    'ocr-label', 'input-board', 'ocr-confirm-section',
    'manual-corner-section', 'grid-confirm-section',
    'ocr-prompt', 'solved-board', 'solved-label',
    'manual-corner-btn-container'
  ];
  allIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = idsToShow.includes(id) ? '' : 'none';
  });
  document.getElementById('start-over-btn').style.display = idsToShow.includes('upload-section') ? 'none' : '';
}

// Render the Sudoku board
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
        td.appendChild(input);
      } else {
        td.textContent = data[row][col] === 0 ? '' : data[row][col];
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

// Resize an image if it's larger than maxDim
function resizeImage(fileOrImg, callback, maxDim = 2000) {
  const img = new Image();
  img.onload = function() {
    let { width, height } = img;
    if (width <= maxDim && height <= maxDim) {
      callback(fileOrImg);
      return;
    }
    let scale = Math.min(maxDim / width, maxDim / height);
    let newWidth = Math.round(width * scale);
    let newHeight = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    canvas.toBlob(blob => {
      const resizedFile = new File([blob], (fileOrImg.name || "resized.jpg"), { type: "image/jpeg" });
      callback(resizedFile);
    }, "image/jpeg", 0.92);
  };
  if (typeof fileOrImg === "string") {
    img.src = fileOrImg;
  } else {
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.readAsDataURL(fileOrImg);
  }
}

// --- Manual Corners: Canvas Drawing & Dragging ---

// Get mouse/touch coords in canvas units
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if (e.touches && e.touches.length) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return [
    (clientX - rect.left) / rect.width * canvas.width,
    (clientY - rect.top) / rect.height * canvas.height
  ];
}

// Draw the image and corners on the canvas
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedCanvasImage, 0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cornerPoints[0][0] * canvas.width, cornerPoints[0][1] * canvas.height);
  for (let i = 1; i < 4; i++)
    ctx.lineTo(cornerPoints[i][0] * canvas.width, cornerPoints[i][1] * canvas.height);
  ctx.closePath();
  ctx.stroke();

  for (let i = 0; i < 4; i++) {
    const x = cornerPoints[i][0] * canvas.width;
    const y = cornerPoints[i][1] * canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.strokeText(["TL", "TR", "BR", "BL"][i], x + 10, y - 5);
  }
}

// Set up canvas size and image for manual corner selection
function drawImageOnCanvas() {
  const maxDim = Math.min(450, Math.round(window.innerWidth * 0.9));
  canvas.width = maxDim;
  canvas.height = maxDim;
  uploadedCanvasImage.onload = drawCanvas;
  uploadedCanvasImage.src = uploadedPreview.src;
}

// Drag logic for manual corners
function startDrag(e) {
  const [x, y] = getCanvasCoords(e);
  for (let i = 0; i < 4; i++) {
    const cx = cornerPoints[i][0] * canvas.width;
    const cy = cornerPoints[i][1] * canvas.height;
    if (Math.hypot(cx - x, cy - y) < 18) {
      draggingIndex = i;
      e.preventDefault();
      break;
    }
  }
}

// Update corner points while dragging
function drag(e) {
  if (draggingIndex === null) return;
  const [x, y] = getCanvasCoords(e);
  cornerPoints[draggingIndex] = [
    Math.max(0, Math.min(1, x / canvas.width)),
    Math.max(0, Math.min(1, y / canvas.height))
  ];
  drawCanvas();
  e.preventDefault();
}
function stopDrag(e) { draggingIndex = null; }

// --- Main Event Handlers & User Actions ---

// Example Image Selection
function selectExampleImage(imgPath) {
  hideIntroText();
  hideExampleImages();
  fetch(imgPath)
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], imgPath.split('/').pop(), { type: blob.type });
      const reader = new FileReader();
      reader.onload = e => {
        resizeImage(e.target.result, (finalFile) => {
          uploadedImage = finalFile;
          const previewReader = new FileReader();
          previewReader.onload = ev => {
            uploadedPreview.src = ev.target.result;
            uploadedPreview.style.display = "block";
            fileInput.style.display = "none";
            showSections('uploaded-preview', 'submit-container', 'upload-section');
          };
          previewReader.readAsDataURL(finalFile);
          outputDiv.innerText = "Image loaded. Click Submit to proceed.";
          outputDiv.style.display = "";
        });
      };
      reader.readAsDataURL(file);
    });
}

// Handle file upload (resize if needed)
fileInput.addEventListener("change", () => {
  hideIntroText();
  hideExampleImages();
  const file = fileInput.files[0];
  if (file) {
    resizeImage(file, (finalFile) => {
      uploadedImage = finalFile;
      const reader = new FileReader();
      reader.onload = e => {
        uploadedPreview.src = e.target.result;
        uploadedPreview.style.display = "block";
        fileInput.style.display = "none";
        showSections('uploaded-preview', 'submit-container', 'upload-section');
      };
      reader.readAsDataURL(finalFile);
      outputDiv.innerText = "Image loaded. Click Submit to proceed.";
      outputDiv.style.display = "";
    });
  }
});

// Submit/Next-Step Button
submitBtn.addEventListener("click", async () => {
  if (!uploadedImage) return alert("Please upload an image first.");
  switch (currentStep) {
    case AppState.IMAGE_UPLOAD: await handleGridDetection(); break;
    case AppState.GRID_CONFIRM: showOnly(); await handleOCR(); break;
    case AppState.OCR_CONFIRM: await handleSolveVisual(inputGrid); break;
  }
});

// --- Sudoku Flow Logic: Detection, OCR, Solve ---

// Detect the Sudoku grid
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
      showSections(
        'warped-label', 'warped-preview', 'ocr-button-group',
        'manual-corner-btn-container', 'manual-input-btn-container', 'restart-container'
      );
      outputDiv.innerText = "Grid detected. You can run OCR, or manually select corners if needed.";
      outputDiv.style.display = "";
      currentStep = AppState.GRID_CONFIRM;
    } else {
      outputDiv.innerText = "Grid not found. Try setting corners manually, or upload a new image.";
      outputDiv.style.display = "";
      uploadedImage = null;
      fileInput.value = '';
      fileInput.style.display = '';
      showSections(
        'upload-section', 'submit-container', 'manual-corner-btn-container',
        'manual-input-btn-container', 'output'
      );
      currentStep = AppState.IMAGE_UPLOAD;
    }
  } catch (err) {
    outputDiv.innerText = "Error during grid detection. You can try setting corners or entering digits manually.";
    outputDiv.style.display = "";
    showSections(
      'upload-section', 'submit-container', 'manual-corner-btn-container',
      'manual-input-btn-container', 'output'
    );
    currentStep = AppState.IMAGE_UPLOAD;
  }
}

// Handle OCR
async function handleOCR() {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  document.getElementById('reading-msg').classList.remove('hidden');
  try {
    const ocrRes = await fetch("/ocr", { method: "POST", body: formData });
    const result = await ocrRes.json();
    if (result.input) {
      inputGrid = result.input;
      renderBoard(inputGrid, "input-board", true);
      showOnly('warped-label', 'warped-preview', 'ocr-label', 'input-board', 'ocr-confirm-section', 'ocr-prompt');
      document.getElementById("reading-msg").classList.add("hidden");
      currentStep = AppState.OCR_CONFIRM;
      document.getElementById('manual-corner-btn-container').style.display = 'none';
    } else {
      outputDiv.innerText = "OCR failed.";
    }
  } catch (err) {
    outputDiv.innerText = "Error during OCR.";
  }
}

// Make a POST request to solve the Sudoku
async function handleSolveVisual(grid) {
  const res = await fetch("/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grid })
  });

  const result = await res.json();
  if (!result.success || !result.finalBoard) {
    outputDiv.innerText = "This Sudoku puzzle is unsolvable, or the digits were not recognised correctly.";
    document.getElementById("restart-container").style.display = "block";
    return;
  }

  outputDiv.innerText = "Sudoku solved!";
  outputDiv.style.display = ""; 

  const finalBoard = result.finalBoard;
  const board = grid.map(row => [...row]);
  showOnly('solved-label', 'solved-board');
  document.getElementById('manual-corner-btn-container').style.display = 'none';

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
}

// --- Reset/cancel actions ---

function resetToUpload() {
  uploadedImage = null;
  sessionId = null;
  fileInput.value = '';
  uploadedPreview.src = '';
  warpedPreview.src = '';
  inputBoard.innerHTML = '';
  solvedBoard.innerHTML = '';
  fileInput.style.display = '';
  showOnly('upload-section', 'submit-container', 'upload');
  document.getElementById('manual-corner-btn-container').style.display = 'none';
  outputDiv.innerText = '';
  showIntroText();
  showExampleImages();
}

// --- Event Listeners / Bindings --- 

canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mousemove", drag);
canvas.addEventListener("mouseup", stopDrag);
canvas.addEventListener("mouseleave", stopDrag);
canvas.addEventListener("touchstart", startDrag, {passive: false});
canvas.addEventListener("touchmove", drag, {passive: false});
canvas.addEventListener("touchend", stopDrag, {passive: false});

resetCornersBtn.addEventListener("click", () => {
  cornerPoints = [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]];
  drawCanvas();
});
submitCornersBtn.addEventListener("click", async () => { /* ... */ });

document.getElementById('manual-corner-btn-container').style.display = 'none';
manualCornerBtn.addEventListener("click", () => { /* ... */ });
manualFromConfirmBtn.addEventListener("click", () => { /* ... */ });
manualInputBtn.addEventListener("click", () => { /* ... */ });
retryGridBtn.addEventListener("click", resetToUpload);
retryOCRBtn.addEventListener("click", resetToUpload);
startOverBtn.onclick = () => location.reload();

ocrBtn.addEventListener("click", async () => { await handleOCR(); });
confirmOCRBtn.addEventListener("click", () => {
  showOnly();
  currentStep = AppState.VISUAL_SOLVE;
  handleSolveVisual(inputGrid);
});

// Example Images (initial setup)
document.addEventListener("DOMContentLoaded", () => {
  showExampleImages();
  exampleImgs.forEach(img => {
    img.addEventListener("click", () => {
      selectExampleImage(img.dataset.path);
    });
  });
});