const fileInput = document.getElementById("upload");
const outputDiv = document.getElementById("output");
const warpedPreview = document.getElementById("warped-preview");
const uploadedPreview = document.getElementById("uploaded-preview");
const solvedLabel = document.getElementById("solved-label");

// Persistent session ID across uploads
let sessionId = localStorage.getItem("sudoku_session_id") || null;

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      uploadedPreview.src = e.target.result;
      uploadedPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
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

document.getElementById("submit-btn").addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select an image file.");
    return;
  }

  const formData = new FormData();
  formData.append("image", file);

  try {
    console.log("Sending POST request to /upload...");
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    console.log("Received response from /upload.");
    const result = await response.json();
    console.log("Parsed JSON response:", result);

    if (result.input) {
      console.log("Rendering input board...");
      renderBoard(result.input, 'input-board');
      outputDiv.innerText = "Sudoku Found";
    } else {
      console.warn("No input board found in response.");
      outputDiv.innerText = "Sudoku Not Found";
    }

    if (result.warped_url) {
      console.log("Warped URL:", result.warped_url);
      warpedPreview.src = result.warped_url + "?" + Date.now(); // Force cache refresh
      warpedPreview.style.display = "block";

      // Add event listeners for debugging image loading
      warpedPreview.addEventListener("load", () => {
        console.log("Warped board image loaded successfully.");
      });

      warpedPreview.addEventListener("error", (err) => {
        console.error("Failed to load warped board image:", err);
        outputDiv.textContent = "Failed to load warped board image.";
      });
    } else {
      console.error("Warped URL not provided in response.");
      warpedPreview.style.display = "none";
    }

    if (result.success && result.solved) {
      console.log("Rendering solved board...");
      renderBoard(result.solved, 'solved-board');
      solvedLabel.style.display = "block";
      outputDiv.innerText += "\nSudoku Solved";
    } else {
      console.warn("Sudoku not solved.");
      solvedLabel.style.display = "none";
      outputDiv.innerText += "\nSudoku Not Solved";
    }
  } catch (err) {
    console.error("Error during processing:", err);
    outputDiv.textContent = "Error processing image.";
  } finally {
    // Hide the loading spinner
    loadingSpinner.style.display = "none";
  }
});