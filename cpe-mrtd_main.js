// cpe-mrtd_main.js
(() => {
  // ===== DOM =====
  const cam = document.getElementById("esp32StreamImg");
  const captureBtn = document.getElementById("captureBtn");

  // Use the span so we don't destroy your layout
  const predSpan = document.getElementById("predictionResult");

  const conf = document.getElementById("conf");
  const confVal = document.getElementById("confVal");
  const mqDiv = document.getElementById("mq137Data");

  const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
  const photoUploadInput = document.getElementById("photoUploadInput");

  const ipCamToggleBtn = document.getElementById("ipCamToggleBtn");
  const ipCamInputDiv = document.getElementById("ipCamInputDiv");
  const ipCamUrlInput = document.getElementById("ipCamUrl");
  const connectIpCamBtn = document.getElementById("connectIpCamBtn");
  const backToEsp32Btn = document.getElementById("backToEsp32Btn");
  const ipCamStatus = document.getElementById("ipCamStatus");

  if (!cam) console.error("[MRTD] Missing #esp32StreamImg");
  if (!captureBtn) console.error("[MRTD] Missing #captureBtn");
  if (!conf) console.error("[MRTD] Missing #conf slider");
  if (!uploadPhotoBtn) console.warn("[MRTD] Missing #uploadPhotoBtn (optional)");
  if (!photoUploadInput) console.warn("[MRTD] Missing #photoUploadInput (optional)");

  // ===== STATE =====
  let currentMode = "esp32"; // "esp32" | "ipcam"
  let modeBeforePause = "esp32"; // Track which mode we were in before pausing
  let ipCamUrl = "";
  let ipCamEnabled = false; // Track if IP camera is currently enabled/connected
  let ipSnapshotTimer = null;
  let esp32PollInterval = null;  // <-- Track main ESP32 polling
  let isPaused = false;  // <-- Track if viewing prediction (paused on result image)

  const esp32StreamUrl = cam?.getAttribute("src") || "http://192.168.4.2:81/stream";

  // Convert /stream -> /capture; if your capture is on port 80, this line also fixes :81/capture -> /capture
  let esp32CaptureUrl = esp32StreamUrl.replace(/\/stream(\?.*)?$/i, "/capture");
  esp32CaptureUrl = esp32CaptureUrl.replace(":81/capture", "/capture"); // safe if capture runs on port 80

  // ===== UI HELPERS =====
  function setPredictionHtml(html) {
    if (predSpan) predSpan.innerHTML = html;
  }
  function setBusy(isBusy) {
    if (!captureBtn) return;
    captureBtn.disabled = isBusy;
    captureBtn.classList.toggle("btnBusy", isBusy);
    captureBtn.textContent = isBusy ? "Processing…" : "Capture & Detect";
  }

  // ===== SLIDER =====
  if (conf && confVal) {
    confVal.textContent = `${conf.value}%`;
    conf.addEventListener("input", () => {
      confVal.textContent = `${conf.value}%`;
    });
  }

  // ===== RESUME (called by HTML onclick="resume()") =====
  window.resume = function resume() {
    console.log("[MRTD] Resume button clicked. Resuming mode:", modeBeforePause);
    
    // Stop any running intervals
    stopIpSnapshots();
    if (esp32PollInterval) {
      clearInterval(esp32PollInterval);
      esp32PollInterval = null;
    }
    
    // Mark stream as ACTIVE (not paused anymore)
    isPaused = false;
    
    // Restore to the mode we were in before capturing
    currentMode = modeBeforePause;
    
    if (currentMode === "ipcam" && ipCamUrl) {
      // Resume IP camera stream
      console.log("[MRTD] Resuming IP camera stream:", ipCamUrl);
      if (ipCamStatus) ipCamStatus.textContent = "Resuming IP camera stream…";
      startIpSnapshots();
    } else {
      // Resume ESP32 stream
      console.log("[MRTD] Resuming ESP32 stream:", esp32StreamUrl);
      if (cam) {
        cam.src = esp32StreamUrl;
      }
      if (ipCamStatus) ipCamStatus.textContent = "Resumed ESP32 stream.";
    }
    
    // Clear predictions
    setPredictionHtml("N/A");
    
    // Restore button state
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.classList.remove("btnBusy");
      captureBtn.textContent = "Capture & Detect";
    }
  };

  // ===== PROXY URLS (prevents canvas tainting) =====
  function esp32ProxyCapture() {
    return `esp32_camera_proxy.php?url=${encodeURIComponent(
      esp32CaptureUrl + "?t=" + Date.now()
    )}`;
  }

  function ipCamProxySnapshot() {
    // If user enters host:port without scheme, add http://
    let url = ipCamUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "http://" + url;

    // If user entered only host or host:port (no path), default snapshot path
    try {
      const u = new URL(url);
      const hasPath = u.pathname && u.pathname !== "/";
      const snap = hasPath ? u.href : (u.origin + "/shot.jpg");
      return `cpe-ipcam_proxy.php?url=${encodeURIComponent(snap + (snap.includes("?") ? "&" : "?") + "t=" + Date.now())}`;
    } catch {
      // fallback: treat as direct snapshot URL
      return `cpe-ipcam_proxy.php?url=${encodeURIComponent(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now())}`;
    }
  }

  // ===== CANVAS CAPTURE → JPEG BLOB =====
  async function loadImage(src) {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load capture image via proxy."));
      img.src = src;
    });
  }

  async function imageToJpegBlob(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 480;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) throw new Error("Canvas toBlob returned null.");
    return blob;
  }

  async function captureCurrentFrameBlob() {
    const src = (currentMode === "ipcam" && ipCamUrl) ? ipCamProxySnapshot() : esp32ProxyCapture();
    const img = await loadImage(src);
    return await imageToJpegBlob(img);
  }

  // ===== CAPTURE & DETECT =====
  async function captureAndDetect() {
    setBusy(true);
    setPredictionHtml("Capturing frame…");

    try {
      const blob = await captureCurrentFrameBlob();
      setPredictionHtml(`Uploading (${Math.round(blob.size / 1024)} KB)…`);

      const fd = new FormData();
      fd.append("image", blob, "frame.jpg");
      fd.append("threshold", (Number(conf.value) / 100).toString());

      const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });

      let data;
      try {
        data = await resp.json();
      } catch {
        throw new Error("Server did not return JSON. Check PHP logs.");
      }

      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${data?.message || "Server error"}`);
      if (!data || data.status !== "ok") throw new Error(data?.message || "Prediction failed.");

      // Pause stream by showing annotated output
      if (data.path) cam.src = `${data.path}?t=${Date.now()}`;

      const topClass = data.top_class ?? "?";
      const topConf = typeof data.top_confidence === "number" ? data.top_confidence : 0;
      const inferenceMs = data.inference_time_ms ?? null;

      let html = `<b>${topClass}</b> — ${(topConf * 100).toFixed(1)}%`;
      if (inferenceMs !== null) html += `<br><span style="opacity:.85;">Inference: ${inferenceMs} ms</span>`;

      if (Array.isArray(data.predictions) && data.predictions.length) {
        html += `<ul style="margin:8px 0 0 16px;font-size:12px;">` +
          data.predictions.map(p => `<li>${p.name} — ${(p.conf * 100).toFixed(1)}%</li>`).join("") +
          `</ul>`;
      }

      if (data.warning) {
        html += `<div style="margin-top:8px;font-size:12px;opacity:.85;">${data.warning}</div>`;
      }

      setPredictionHtml(html);
      
      // IMPORTANT: Mark stream as paused on prediction image
      // Remember which mode we were in so Resume can restore to it
      modeBeforePause = currentMode;
      // Stream will NOT auto-resume until user clicks "Resume" button
      isPaused = true;
      console.log("[MRTD] Prediction complete. Stream PAUSED on result image. Click Resume to continue.");

    } catch (err) {
      console.error("[MRTD]", err);
      setPredictionHtml("N/A");
      // Keep whatever is currently shown (do NOT auto-resume stream)
      // cam.src = esp32StreamUrl;
    } finally {
      setBusy(false);
    }
  }

  if (captureBtn) captureBtn.addEventListener("click", captureAndDetect);

  // ===== UPLOAD PHOTO BUTTON =====
  if (uploadPhotoBtn && photoUploadInput) {
    uploadPhotoBtn.addEventListener("click", () => {
      console.log("[MRTD] Upload Photo button clicked");
      photoUploadInput.value = ""; // Reset input
      photoUploadInput.click(); // Trigger file picker
    });

    photoUploadInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        console.log("[MRTD] No file selected");
        return;
      }

      console.log("[MRTD] File selected:", file.name, file.size, "bytes");
      setBusy(true);
      setPredictionHtml("Uploading file…");
      // Remember which mode we were in so Resume can restore to it
      modeBeforePause = currentMode;
      isPaused = true;

      try {
        const fd = new FormData();
        fd.append("image", file, file.name);
        fd.append("threshold", (Number(conf.value) / 100).toString());

        console.log("[MRTD] Sending to cpe-save_image.php…");
        const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });

        let data;
        try {
          data = await resp.json();
        } catch {
          throw new Error("Server did not return JSON. Check PHP logs.");
        }

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${data?.message || "Server error"}`);
        if (!data || data.status !== "ok") throw new Error(data?.message || "Prediction failed.");

        console.log("[MRTD] Prediction received:", data);

        // Show annotated image
        if (data.path) {
          cam.src = `${data.path}?t=${Date.now()}`;
          console.log("[MRTD] Displaying annotated image:", data.path);
        }

        const topClass = data.top_class ?? "?";
        const topConf = typeof data.top_confidence === "number" ? data.top_confidence : 0;
        const inferenceMs = data.inference_time_ms ?? null;

        let html = `<b>${topClass}</b> — ${(topConf * 100).toFixed(1)}%`;
        if (inferenceMs !== null) html += `<br><span style="opacity:.85;">Inference: ${inferenceMs} ms</span>`;

        if (Array.isArray(data.predictions) && data.predictions.length) {
          html += `<ul style="margin:8px 0 0 16px;font-size:12px;">` +
            data.predictions.map(p => `<li>${p.name} — ${(p.conf * 100).toFixed(1)}%</li>`).join("") +
            `</ul>`;
        }

        if (data.warning) {
          html += `<div style="margin-top:8px;font-size:12px;opacity:.85;">${data.warning}</div>`;
        }

        setPredictionHtml(html);
        console.log("[MRTD] Upload & prediction complete. Click Resume to continue.");

      } catch (err) {
        console.error("[MRTD] Upload failed:", err);
        setPredictionHtml(`Error: ${err.message}`);
      } finally {
        setBusy(false);
      }
    });
  }

  // ===== IP CAMERA MODE (simple snapshot refresh) =====
  function stopIpSnapshots() {
    if (ipSnapshotTimer) {
      clearTimeout(ipSnapshotTimer);
      ipSnapshotTimer = null;
    }
  }

  function startIpSnapshots() {
    stopIpSnapshots();
    const loop = () => {
      // IMPORTANT: Do NOT update stream if currently paused on prediction image
      if (currentMode !== "ipcam" || isPaused) return;
      cam.src = ipCamProxySnapshot();
      ipSnapshotTimer = setTimeout(loop, 750); // snapshot mode; don't overload server
    };
    loop();
  }

  if (connectIpCamBtn && ipCamUrlInput) {
    connectIpCamBtn.addEventListener("click", () => {
      const url = (ipCamUrlInput.value || "").trim();
      if (!url) {
        if (ipCamStatus) ipCamStatus.textContent = "Enter an IP camera URL.";
        return;
      }
      ipCamUrl = url;
      ipCamEnabled = true; // Mark IP camera as enabled
      currentMode = "ipcam";
      if (ipCamStatus) ipCamStatus.textContent = "IP cam connected (snapshot mode).";
      startIpSnapshots();
    });
  }

  if (backToEsp32Btn) {
    backToEsp32Btn.addEventListener("click", () => {
      // Switch back to ESP32 stream
      ipCamEnabled = false;
      stopIpSnapshots();
      currentMode = "esp32";
      modeBeforePause = "esp32";
      if (ipCamStatus) ipCamStatus.textContent = "Switched to ESP32 stream.";
      if (cam) cam.src = esp32StreamUrl;
      isPaused = false;
      setPredictionHtml("N/A");
      if (captureBtn) {
        captureBtn.disabled = false;
        captureBtn.classList.remove("btnBusy");
        captureBtn.textContent = "Capture & Detect";
      }
    });
  }

  // ===== INITIALIZE ESP32 STREAM ON PAGE LOAD =====
  let streamFallbackTimer = null;
  
  if (cam) {
    console.log("[MRTD] Initializing ESP32 stream from:", esp32StreamUrl);
    
    // Try direct MJPEG stream first
    cam.src = esp32StreamUrl;
    
    // Set up error handler for stream failures
    cam.addEventListener('error', () => {
      console.warn("[MRTD] Stream failed to load, attempting fallback to snapshot polling");
      clearTimeout(streamFallbackTimer);
      // Switch to snapshot polling
      if (!esp32PollInterval) {
        esp32PollInterval = setInterval(() => {
          // IMPORTANT: Do NOT update stream if currently paused on prediction image
          if (currentMode === 'esp32' && cam && !isPaused) {
            cam.src = esp32CaptureUrl + "?t=" + Date.now();
          }
        }, 500);
      }
    });
    
    // If image hasn't loaded after 4 seconds, use fallback
    streamFallbackTimer = setTimeout(() => {
      if (cam && cam.naturalWidth === 0 && cam.naturalHeight === 0) {
        console.warn("[MRTD] Stream did not load in 4s, switching to snapshot polling");
        if (!esp32PollInterval) {
          esp32PollInterval = setInterval(() => {
            // IMPORTANT: Do NOT update stream if currently paused on prediction image
            if (currentMode === 'esp32' && cam && !isPaused) {
              cam.src = esp32CaptureUrl + "?t=" + Date.now();
            }
          }, 500);
        }
      }
    }, 4000);
  } else {
    console.error("[MRTD] Camera element #esp32StreamImg not found!");
  }

  // ===== MQ-137 POLLING (optional) =====
  const MQ_ENDPOINT = "mq137_proxy.php";
  if (mqDiv) {
    setInterval(async () => {
      try {
        const r = await fetch(`${MQ_ENDPOINT}?t=${Date.now()}`);
        if (!r.ok) return;
        const d = await r.json();
        const ppm = d.ppm ?? d.value ?? d.reading ?? null;
        const status = d.status ?? "";
        if (ppm !== null) mqDiv.textContent = `MQ-137: ${ppm} ppm ${status ? `(${status})` : ""}`;
      } catch {
        // silent
      }
    }, 1000);
  }
})();
