// cpe-mrtd_main.js (FIXED)

// ===== DOM =====
const cam =
  document.getElementById("cam") ||
  document.getElementById("esp32StreamImg"); // <-- matches your HTML

const btn = document.getElementById("captureBtn");
const predDiv = document.getElementById("prediction");
const conf = document.getElementById("conf") || { value: 50 }; // fallback
const confVal = document.getElementById("confVal");

const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
const photoUploadInput = document.getElementById("photoUploadInput");

// IP cam controls (exist in your HTML, but display container/img do NOT)
const ipCamToggleBtn = document.getElementById("ipCamToggleBtn");
const ipCamInputDiv = document.getElementById("ipCamInputDiv");
const ipCamUrlInput = document.getElementById("ipCamUrl");
const connectIpCamBtn = document.getElementById("connectIpCamBtn");
const backToEsp32Btn = document.getElementById("backToEsp32Btn");
const ipCamStatus = document.getElementById("ipCamStatus");

// These are NOT in your current HTML; keep them optional.
const ipCamDisplayContainer = document.getElementById("ipCamDisplayContainer");
const ipCamImg = document.getElementById("ipCamImg");

// Overlay canvas
const overlay = document.getElementById("overlay");

// ===== STATE =====
let paused = false;
let streamInterval = null;

let currentCameraMode = "esp32"; // 'esp32' | 'ipcam'
let ipCamUrl = "";

// Save original stream URL from the <img>
const esp32StreamUrl = cam?.getAttribute("src") || "";
// Derive /capture from /stream (your HTML uses /stream)
const esp32CaptureUrl = esp32StreamUrl
  ? esp32StreamUrl.replace(/\/stream(\?.*)?$/i, "/capture")
  : "http://192.168.4.2:81/capture";

// ===== HELPERS =====
function ensureSpinnerCss() {
  if (document.getElementById("spinner-style")) return;
  const style = document.createElement("style");
  style.id = "spinner-style";
  style.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
    .spinner { border-right-color:#bbb !important; border-top-color:#3498db !important; }
  `;
  document.head.appendChild(style);
}

function showLoading(displayEl, text) {
  if (!displayEl) return;
  ensureSpinnerCss();

  displayEl.style.transition = "filter 0.2s";
  displayEl.style.filter = "brightness(0.5)";

  let lo = document.getElementById("loading-overlay");
  if (lo) lo.remove();

  lo = document.createElement("div");
  lo.id = "loading-overlay";
  lo.style.position = "absolute";
  lo.style.inset = "0";
  lo.style.display = "flex";
  lo.style.alignItems = "center";
  lo.style.justifyContent = "center";
  lo.style.zIndex = "1000";
  lo.style.pointerEvents = "none";
  lo.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="spinner" style="width:22px;height:22px;border:3px solid #bbb;border-top:3px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <div style="font-size:11px;font-weight:500;line-height:18px;">${text}</div>
    </div>
  `;

  // Put overlay on the camera container if possible
  const parent = displayEl.parentElement;
  if (parent) {
    parent.style.position = parent.style.position || "relative";
    parent.appendChild(lo);
  }
}

function hideLoading(displayEl) {
  if (displayEl) displayEl.style.filter = "";
  const lo = document.getElementById("loading-overlay");
  if (lo) lo.remove();
}

function clearCanvas() {
  if (!overlay) return;
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function resizeOverlay() {
  if (!overlay) return;
  const activeDisplay =
    currentCameraMode === "ipcam" && ipCamDisplayContainer
      ? ipCamDisplayContainer
      : cam;

  if (!activeDisplay) return;

  const rect = activeDisplay.getBoundingClientRect();
  overlay.style.left = rect.left + "px";
  overlay.style.top = rect.top + "px";
  overlay.width = rect.width;
  overlay.height = rect.height;
  overlay.style.display = "block";
}

window.addEventListener("resize", resizeOverlay);
if (cam) cam.addEventListener("load", resizeOverlay);
resizeOverlay();

// ===== STREAM CONTROL =====
function stopEsp32SnapshotLoop() {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
}

function startEsp32Stream() {
  paused = false;
  stopEsp32SnapshotLoop();

  // If we have an MJPEG stream URL, use it directly (no interval needed)
  if (cam && /\/stream(\?|$)/i.test(esp32StreamUrl)) {
    cam.src = esp32StreamUrl;
    return;
  }

  // Otherwise, snapshot loop using /capture
  if (cam) {
    streamInterval = setInterval(() => {
      if (!paused) cam.src = esp32CaptureUrl + "?t=" + Date.now();
    }, 500);
  }
}

// Expose resume() because your HTML uses onclick="resume()"
window.resume = function resume() {
  paused = false;
  if (btn) btn.disabled = false;
  if (predDiv) predDiv.innerHTML = "";
  clearCanvas();

  // Switch display back to live stream
  currentCameraMode = "esp32";
  startEsp32Stream();
};

// Start stream on load
startEsp32Stream();

// ===== CONF SLIDER =====
if (conf && conf.id && confVal) {
  conf.oninput = () => (confVal.innerText = conf.value + "%");
}

// ===== CAPTURE & DETECT =====
async function captureBlobFromEsp32() {
  const r = await fetch(esp32CaptureUrl + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("ESP32 capture failed: HTTP " + r.status);
  return await r.blob();
}

btn && (btn.onclick = async () => {
  if (!cam) {
    if (predDiv) predDiv.innerText = "Error: camera element not found.";
    return;
  }

  paused = true;
  stopEsp32SnapshotLoop();
  btn.disabled = true;

  showLoading(cam, "Loading, the captured image is being processed.");
  if (predDiv) predDiv.innerHTML = "";

  try {
    let blob;

    if (currentCameraMode === "ipcam" && ipCamUrl) {
      // Optional: only if you actually implement ipcam display in HTML
      const snapshotUrl = (() => {
        try {
          const u = new URL(ipCamUrl);
          return u.origin + "/shot.jpg";
        } catch {
          return ipCamUrl.replace(/\/(video|stream).*$/i, "/shot.jpg");
        }
      })();
      const r = await fetch(snapshotUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("IP cam capture failed: HTTP " + r.status);
      blob = await r.blob();
    } else {
      // ESP32 capture
      blob = await captureBlobFromEsp32();
    }

    const fd = new FormData();
    fd.append("image", blob, "frame.jpg");
    fd.append("threshold", (conf.value / 100).toString());

    const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });
    const data = await resp.json();

    hideLoading(cam);
    btn.disabled = false;

    if (data.status !== "ok") {
      if (predDiv) predDiv.innerText = "Error: " + (data.message || "unknown");
      paused = false;
      startEsp32Stream();
      return;
    }

    // Replace camera display with predicted image
    // Your backend returns `path` = predicted_images/... (annotated) :contentReference[oaicite:3]{index=3}
    const predictedPath = data.path ? decodeURIComponent(data.path) : null;

    if (predictedPath) {
      cam.src = predictedPath + "?t=" + Date.now();
      cam.style.width = "100%";
      cam.style.height = "100%";
      cam.style.objectFit = "contain";
    }

    renderPredictions(data.predictions, data.image_path, data.top_class, data.top_confidence);
    resizeOverlay();
  } catch (err) {
    console.error(err);
    hideLoading(cam);
    btn.disabled = false;
    if (predDiv) predDiv.innerHTML = '<span style="color:red;">Request failed</span>';
    paused = false;
    startEsp32Stream();
  }
});

// ===== UPLOAD PHOTO (still works, and also replaces display with predicted image) =====
if (uploadPhotoBtn && photoUploadInput) {
  uploadPhotoBtn.addEventListener("click", () => {
    photoUploadInput.value = "";
    photoUploadInput.click();
  });

  photoUploadInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    paused = true;
    stopEsp32SnapshotLoop();
    showLoading(cam, "Loading, the uploaded image is being processed.");
    if (predDiv) predDiv.innerHTML = "";

    try {
      const fd = new FormData();
      fd.append("image", file, file.name);
      fd.append("threshold", (conf.value / 100).toString());

      const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });
      const data = await resp.json();

      hideLoading(cam);

      if (data.status !== "ok") {
        if (predDiv) predDiv.innerText = "Error: " + (data.message || "unknown");
        paused = false;
        startEsp32Stream();
        return;
      }

      const predictedPath = data.path ? decodeURIComponent(data.path) : null;
      if (predictedPath) cam.src = predictedPath + "?t=" + Date.now();

      renderPredictions(data.predictions, data.image_path, data.top_class, data.top_confidence);
      resizeOverlay();
    } catch (err) {
      console.error(err);
      hideLoading(cam);
      if (predDiv) predDiv.innerHTML = '<span style="color:red;">Request failed</span>';
      paused = false;
      startEsp32Stream();
    }
  });
}

// ===== SHOW PREDICTIONS =====
function renderPredictions(preds, imagePath, topClass, topConfidence) {
  if (!predDiv) return;
  predDiv.innerHTML = "";

  if (!preds || preds.length === 0) {
    predDiv.innerText = "No detections";
    return;
  }

  const ul = document.createElement("ul");
  preds.forEach((p) => {
    const li = document.createElement("li");
    li.innerText = `${p.name} — ${(p.conf * 100).toFixed(1)}%`;
    ul.appendChild(li);
  });
  predDiv.appendChild(ul);
}
