// cpe-mrtd_main.js
(() => {
  // ===== DOM =====
  const cam = document.getElementById("esp32StreamImg");
  const captureBtn = document.getElementById("captureBtn");

  // Keep your layout intact: update only the span
  const predSpan = document.getElementById("predictionResult");

  // Slider is optional (you commented it out in PHP)
  const conf = document.getElementById("conf");
  const confVal = document.getElementById("confVal");

  const mqDiv = document.getElementById("mq137Data");

  const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
  const photoUploadInput = document.getElementById("photoUploadInput");

  const ipCamUrlInput = document.getElementById("ipCamUrl");
  const connectIpCamBtn = document.getElementById("connectIpCamBtn");
  const backToEsp32Btn = document.getElementById("backToEsp32Btn");
  const ipCamStatus = document.getElementById("ipCamStatus");

  if (!cam) console.error("[MRTD] Missing #esp32StreamImg");
  if (!captureBtn) console.error("[MRTD] Missing #captureBtn");

  // ===== STATE =====
  let currentMode = "esp32";        // "esp32" | "ipcam"
  let modeBeforePause = "esp32";    // restore mode on Resume
  let ipCamUrl = "";
  let ipSnapshotTimer = null;
  let esp32PollInterval = null;
  let isPaused = false;             // paused on prediction image

  const esp32StreamUrl = cam?.getAttribute("src") || "http://192.168.4.2:81/stream";

  // Convert /stream -> /capture; also allow capture on port 80
  let esp32CaptureUrl = esp32StreamUrl.replace(/\/stream(\?.*)?$/i, "/capture");
  esp32CaptureUrl = esp32CaptureUrl.replace(":81/capture", "/capture");

  // ===== HELPERS =====
  function setPredictionHtml(html) {
    if (predSpan) predSpan.innerHTML = html;
  }

  function setBusy(isBusy) {
    if (!captureBtn) return;
    captureBtn.disabled = isBusy;
    captureBtn.classList.toggle("btnBusy", isBusy);
    captureBtn.textContent = isBusy ? "Processing…" : "Capture & Detect";
  }

  function selectedModelName() {
    // Provided by js-cpe-model-handler.js (load it BEFORE this file)
    if (window.getSelectedModelName && typeof window.getSelectedModelName === "function") {
      return window.getSelectedModelName() || "";
    }
    return "";
  }

  function thresholdValue01() {
    // slider is optional; default 0.50
    const thr = Number(conf?.value || 50) / 100;
    return Math.max(0.01, Math.min(1.0, thr));
  }

  async function saveToDbFromResult(data, topClass, topConf) {
    // Requires js-capture_database.js loaded BEFORE this file
    if (typeof insertCapture !== "function") {
      console.warn("[DB] insertCapture() not found. Check js-capture_database.js is loaded.");
      return;
    }

    try {
      const storageCond = document.getElementById("freshnessSelection")?.value || null;
      const sensor_ppm = (window.lastMq137Ppm !== undefined) ? window.lastMq137Ppm : null;

      const takenAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      const modelUsed = data.model_used || selectedModelName() || "";

      // IMPORTANT: store captured image in uploads/ (image_path), not annotated display image
      const capturedPath = data.image_path || data.uploaded_path || ""; // expected from cpe-save_image.php
      const fallbackPath = data.path || ""; // annotated path fallback
      const image_path = capturedPath || fallbackPath;

      if (!image_path) {
        console.warn("[DB] No image path returned from server; skipping DB insert.");
        return;
      }

      const res = await insertCapture({
        image_path: image_path,
        class_detected: topClass || "?",
        confidence: (typeof topConf === "number") ? topConf : null,
        model_name: modelUsed || "unknown",
        sensor_ppm: (sensor_ppm === null ? null : Number(sensor_ppm)),
        taken_at: takenAt,
        storage_condition: storageCond,
        notes: ""
      });

      console.log("[DB] Saved capture:", res);
    } catch (e) {
      console.error("[DB] Save failed:", e);
    }
  }

  // ===== SLIDER (optional) =====
  if (conf && confVal) {
    confVal.textContent = `${conf.value}%`;
    conf.addEventListener("input", () => {
      confVal.textContent = `${conf.value}%`;
    });
  }

  // ===== RESUME (called by HTML onclick="resume()") =====
  window.resume = function resume() {
    console.log("[MRTD] Resume clicked. Restoring:", modeBeforePause);

    stopIpSnapshots();
    if (esp32PollInterval) {
      clearInterval(esp32PollInterval);
      esp32PollInterval = null;
    }

    isPaused = false;
    currentMode = modeBeforePause;

    if (currentMode === "ipcam" && ipCamUrl) {
      if (ipCamStatus) ipCamStatus.textContent = "Resuming IP camera stream…";
      startIpSnapshots();
    } else {
      if (cam) cam.src = esp32StreamUrl;
      if (ipCamStatus) ipCamStatus.textContent = "Resumed ESP32 stream.";
    }

    setPredictionHtml("N/A");

    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.classList.remove("btnBusy");
      captureBtn.textContent = "Capture & Detect";
    }
  };

  // ===== PROXIES =====
  function esp32ProxyCapture() {
    return `esp32_camera_proxy.php?url=${encodeURIComponent(
      esp32CaptureUrl + "?t=" + Date.now()
    )}`;
  }

  function ipCamProxySnapshot() {
    let url = (ipCamUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) url = "http://" + url;

    // Always use /shot.jpg for IP Webcam app
    try {
      const u = new URL(url);
      // IP Webcam app: force /shot.jpg for snapshot
      const snapUrl = u.origin + "/shot.jpg";
      const sep = snapUrl.includes("?") ? "&" : "?";
      return `cpe-ipcam_proxy.php?url=${encodeURIComponent(snapUrl + sep + "t=" + Date.now())}`;
    } catch {
      // fallback: append /shot.jpg if not present
      if (!url.endsWith("/shot.jpg")) {
        url = url.replace(/\/$/, "") + "/shot.jpg";
      }
      const sep = url.includes("?") ? "&" : "?";
      return `cpe-ipcam_proxy.php?url=${encodeURIComponent(url + sep + "t=" + Date.now())}`;
    }
  }

  // ===== IMAGE → BLOB =====
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

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("Canvas toBlob returned null.");
    return blob;
  }

  async function captureCurrentFrameBlob() {
    const src = (currentMode === "ipcam" && ipCamUrl) ? ipCamProxySnapshot() : esp32ProxyCapture();
    const img = await loadImage(src);
    return await imageToJpegBlob(img);
  }

  function renderPrediction(data) {
    const topClass = data.top_class ?? "?";
    const topConf = (typeof data.top_confidence === "number") ? data.top_confidence : 0;
    const inferenceMs = data.inference_time_ms ?? null;

    let html = `<b>${topClass}</b> — ${(topConf * 100).toFixed(1)}%`;
    if (inferenceMs !== null) html += `<br><span style="opacity:.85;">Inference: ${inferenceMs} ms</span>`;
    if (data.model_used) html += `<br><span style="opacity:.75;">Model: ${data.model_used}</span>`;

    if (data.warning) {
      html += `<div style="margin-top:8px;font-size:12px;opacity:.85;">${data.warning}</div>`;
    }

    setPredictionHtml(html);
    return { topClass, topConf };
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
      fd.append("threshold", thresholdValue01().toString());

      const sel = selectedModelName();
      if (sel) fd.append("model_path", sel);

      const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[MRTD] Non-JSON response:", text);
        throw new Error("Server did not return JSON. See console for response body.");
      }

      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${data?.message || "Server error"}`);
      if (!data || data.status !== "ok") throw new Error(data?.message || "Prediction failed.");

      // Pause stream by showing annotated output (preferred)
      if (data.path) cam.src = `${data.path}?t=${Date.now()}`;
      else if (data.image_path) cam.src = `${data.image_path}?t=${Date.now()}`;

      const { topClass, topConf } = renderPrediction(data);

      // --- SAVE TO DB ---
      await saveToDbFromResult(data, topClass, topConf);

      // mark paused and remember mode
      modeBeforePause = currentMode;
      isPaused = true;
      console.log("[MRTD] Prediction complete. Stream PAUSED on result image. Click Resume to continue.");
    } catch (err) {
      console.error("[MRTD]", err);
      setPredictionHtml(`Error: ${err.message || err}`);
      // Do not auto-resume stream
    } finally {
      setBusy(false);
    }
  }

  if (captureBtn) captureBtn.addEventListener("click", captureAndDetect);

  // ===== UPLOAD PHOTO =====
  if (uploadPhotoBtn && photoUploadInput) {
    uploadPhotoBtn.addEventListener("click", () => {
      photoUploadInput.value = "";
      photoUploadInput.click();
    });

    photoUploadInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setBusy(true);
      setPredictionHtml("Uploading file…");

      // remember current mode and pause
      modeBeforePause = currentMode;
      isPaused = true;

      try {
        const fd = new FormData();
        fd.append("image", file, file.name);
        fd.append("threshold", thresholdValue01().toString());

        const sel = selectedModelName();
        if (sel) fd.append("model_path", sel);

        const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });

        let data;
        try {
          data = await resp.json();
        } catch {
          throw new Error("Server did not return JSON. Check PHP logs.");
        }

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${data?.message || "Server error"}`);
        if (!data || data.status !== "ok") throw new Error(data?.message || "Prediction failed.");

        // show annotated output (preferred)
        if (data.path) cam.src = `${data.path}?t=${Date.now()}`;
        else if (data.image_path) cam.src = `${data.image_path}?t=${Date.now()}`;

        const { topClass, topConf } = renderPrediction(data);

        // --- SAVE TO DB ---
        await saveToDbFromResult(data, topClass, topConf);
      } catch (err) {
        console.error("[MRTD] Upload failed:", err);
        setPredictionHtml(`Error: ${err.message || err}`);
      } finally {
        setBusy(false);
      }
    });
  }

  // ===== IP CAMERA SNAPSHOT LOOP =====
  function stopIpSnapshots() {
    if (ipSnapshotTimer) {
      clearTimeout(ipSnapshotTimer);
      ipSnapshotTimer = null;
    }
  }

  function startIpSnapshots() {
    stopIpSnapshots();
    const loop = () => {
      if (currentMode !== "ipcam" || isPaused) return;
      cam.src = ipCamProxySnapshot();
      ipSnapshotTimer = setTimeout(loop, 750);
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
      currentMode = "ipcam";
      if (ipCamStatus) ipCamStatus.textContent = "IP cam connected (snapshot mode).";
      if (!isPaused) startIpSnapshots();
    });
  }

  if (backToEsp32Btn) {
    backToEsp32Btn.addEventListener("click", () => {
      stopIpSnapshots();
      currentMode = "esp32";
      modeBeforePause = "esp32";
      isPaused = false;
      setPredictionHtml("N/A");
      if (ipCamStatus) ipCamStatus.textContent = "Switched to ESP32 stream.";
      if (cam) cam.src = esp32StreamUrl;
      if (captureBtn) {
        captureBtn.disabled = false;
        captureBtn.classList.remove("btnBusy");
        captureBtn.textContent = "Capture & Detect";
      }
    });
  }

  // ===== INITIALIZE ESP32 STREAM + FALLBACK SNAPSHOT POLLING (ANTI-SPAM / RETRIES) =====
  let streamFallbackTimer = null;
  let streamRetryTimer = null;
  let streamRetries = 0;
  let fallbackStarted = false;
  let lastWarnAt = 0;

  function warnOnce(msg) {
    const now = Date.now();
    // rate-limit warnings (1 every 8s)
    if (now - lastWarnAt > 8000) {
      console.warn(msg);
      lastWarnAt = now;
    }
  }

  // Try MJPEG stream, then retry a few times before fallback
  function startEsp32StreamWithRetries() {
    if (!cam) return;

    // Always attempt the stream URL (may fail if ESP32 not reachable)
    cam.src = esp32StreamUrl;

    // After 4s, check if stream actually loaded (naturalWidth still 0 = likely failed)
    clearTimeout(streamFallbackTimer);
    streamFallbackTimer = setTimeout(() => {
      // If paused or not in ESP32 mode, do nothing
      if (isPaused || currentMode !== "esp32") return;

      const loaded = cam.naturalWidth > 0 && cam.naturalHeight > 0;
      if (loaded) {
        // Stream is OK
        streamRetries = 0;
        return;
      }

      // Not loaded: retry stream a few times before fallback
      streamRetries += 1;
      warnOnce(`[MRTD] Stream did not load (attempt ${streamRetries}). Retrying…`);

      if (streamRetries <= 3) {
        // retry after short delay
        clearTimeout(streamRetryTimer);
        streamRetryTimer = setTimeout(() => {
          startEsp32StreamWithRetries();
        }, 1200);
        return;
      }

      // After retries, start fallback ONCE
      if (!fallbackStarted) {
        fallbackStarted = true;
        warnOnce("[MRTD] Stream unavailable after retries. Using snapshot polling fallback.");

        if (!esp32PollInterval) {
          esp32PollInterval = setInterval(() => {
            if (currentMode === "esp32" && cam && !isPaused) {
              cam.src = esp32ProxyCapture();
            }
          }, 700); // slightly slower = less load / fewer timeouts
        }
      }
    }, 4000);
  }

  if (cam) {
    console.log("[MRTD] Initializing ESP32 stream from:", esp32StreamUrl);

    // When the <img> errors, do NOT instantly fallback; let the retry logic handle it
    cam.addEventListener("error", () => {
      if (isPaused || currentMode !== "esp32") return;

      // If already in fallback mode, just ignore errors
      if (fallbackStarted) return;

      warnOnce("[MRTD] Stream error event. Will retry stream before fallback…");
      startEsp32StreamWithRetries();
    });

    // Start the stream with retries
    startEsp32StreamWithRetries();
  } else {
    console.error("[MRTD] Camera element #esp32StreamImg not found!");
  }

  // ===== MQ-137 POLLING + BASELINE BUTTON (FIXED: no childNodes[0], no overlapping requests) =====
  const MQ_ENDPOINT = "mq137_proxy.php";

  // baseline UI state
  let baselineBtn = null;
  let baselineValSpan = null;
  let baselineTimeout = null;
  let baselineInterval = null;
  let baselineCollecting = false;
  let baselineValues = [];
  let baselineDuration = 20; // seconds
  let baselineCountdown = baselineDuration;

  // ensure we have a dedicated element for sensor values (so we don't wipe baseline button/span)
  let mqValuesEl = null;

  if (mqDiv) {
    mqValuesEl = document.getElementById("mq137Values");
    if (!mqValuesEl) {
      mqValuesEl = document.createElement("div");
      mqValuesEl.id = "mq137Values";
      mqValuesEl.innerHTML = "Loading...";
      // Put sensor values FIRST, then baseline UI appended after
      mqDiv.prepend(mqValuesEl);
    }

    // Add baseline button and value display
    baselineBtn = document.createElement("button");
    baselineBtn.textContent = "Get Baseline";
    baselineBtn.style.margin = "8px 0 0 0";
    baselineBtn.style.display = "block";
    baselineBtn.style.padding = "6px 16px";
    baselineBtn.style.fontWeight = "bold";
    baselineBtn.style.fontSize = "1rem";
    baselineBtn.style.cursor = "pointer";
    baselineBtn.style.borderRadius = "5px";
    baselineBtn.style.background = "#e0e0e0";
    baselineBtn.style.border = "1px solid #bbb";
    baselineBtn.style.color = "#222";

    baselineValSpan = document.createElement("div");
    baselineValSpan.style.margin = "8px 0 0 0";
    baselineValSpan.style.fontWeight = "bold";
    baselineValSpan.style.fontSize = "1rem";
    baselineValSpan.style.color = "#1976d2";

    mqDiv.appendChild(baselineBtn);
    mqDiv.appendChild(baselineValSpan);

    baselineBtn.addEventListener("click", () => {
      if (baselineCollecting) return;

      baselineCollecting = true;
      baselineValues = [];
      baselineCountdown = baselineDuration;

      baselineBtn.disabled = true;
      baselineBtn.style.opacity = "0.7";
      baselineBtn.textContent = `00:${baselineCountdown.toString().padStart(2, "0")}`;
      baselineValSpan.textContent = "";

      if (baselineInterval) clearInterval(baselineInterval);
      baselineInterval = setInterval(() => {
        baselineCountdown--;
        baselineBtn.textContent = `00:${baselineCountdown.toString().padStart(2, "0")}`;
        if (baselineCountdown <= 0) {
          clearInterval(baselineInterval);
          baselineInterval = null;
        }
      }, 1000);

      if (baselineTimeout) clearTimeout(baselineTimeout);
      baselineTimeout = setTimeout(() => {
        baselineCollecting = false;
        baselineBtn.disabled = false;
        baselineBtn.style.opacity = "1";
        baselineBtn.textContent = "Get Baseline";

        if (baselineValues.length > 0) {
          const avg = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
          baselineValSpan.textContent = `Baseline: ${avg.toFixed(2)} ppm (${baselineValues.length} samples)`;
        } else {
          baselineValSpan.textContent = "Baseline: No data";
        }
      }, baselineDuration * 1000);
    });

    // polling (non-overlapping)
    let mqInFlight = false;

    async function pollMq() {
      if (!mqValuesEl) return;
      if (mqInFlight) return; // prevent request pile-up
      mqInFlight = true;

      try {
        const r = await fetch(`${MQ_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" });

        if (!r.ok) {
          mqValuesEl.innerHTML = `<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>`;
          return;
        }

        const d = await r.json();

        // offline-safe mode (recommended mq137_proxy.php returns status="offline")
        if (d.status === "offline") {
          mqValuesEl.innerHTML = `<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>`;
          return;
        }

        let ppm = d.ppm ?? d.value ?? d.reading ?? null;
        let adc = null, voltage = null, ratio = null;

        if (d.raw) {
          if (typeof d.raw.nh3_ppm !== "undefined" && ppm === null) ppm = d.raw.nh3_ppm;
          if (typeof d.raw.adc !== "undefined") adc = d.raw.adc;
          if (typeof d.raw.voltage !== "undefined") voltage = d.raw.voltage;
          if (typeof d.raw.ratio !== "undefined") ratio = d.raw.ratio;
        }

        const status = d.status ?? "";

        if (ppm !== null) {
          window.lastMq137Ppm = ppm;

          let html = `<div><b>MQ-137 Sensor</b></div>`;
          html += `<div>NH₃: <b>${ppm}</b> ppm</div>`;
          if (adc !== null) html += `<div>ADC: <b>${adc}</b></div>`;
          if (voltage !== null) html += `<div>Voltage: <b>${voltage}</b> V</div>`;
          if (ratio !== null) html += `<div>Ratio: <b>${ratio}</b></div>`;
          if (status && status !== "ok") html += `<div style='color:#b71c1c;'>Status: ${status}</div>`;

          mqValuesEl.innerHTML = html;

          // If collecting baseline, store value
          if (baselineCollecting && typeof ppm === "number" && !isNaN(ppm)) {
            baselineValues.push(ppm);
          }
        } else if (status && status !== "ok") {
          mqValuesEl.innerHTML = `<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline (${status})</div>`;
        } else {
          mqValuesEl.innerHTML = `<div><b>MQ-137 Sensor</b></div><div>No data</div>`;
        }
      } catch (e) {
        mqValuesEl.innerHTML = `<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>`;
      } finally {
        mqInFlight = false;
      }
    }

    // start immediately + poll
    pollMq();
    setInterval(pollMq, 1200);
  }
})();