// cpe-mrtd_main.js
// Clean JS (no TypeScript syntax issues), balanced braces/parens, no fancy unicode chars.
// Also fixes: absolute endpoint paths + safe MQ DOM update (no childNodes[0]) + no overlapping MQ requests.

(() => {
  // =========================
  // DOM
  // =========================
  const cam = document.getElementById("esp32StreamImg");
  const captureBtn = document.getElementById("captureBtn");
  const predSpan = document.getElementById("predictionResult");

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

  // =========================
  // ENDPOINTS (ABSOLUTE PATHS)
  // IMPORTANT: adjust these if your PHP files are in a subfolder.
  // =========================
  const ENDPOINT_SAVE = "/cpe-save_image.php";
  const ENDPOINT_MQ = "/mq137_proxy.php";
  const ENDPOINT_ESP32_PROXY = "/esp32_camera_proxy.php";
  const ENDPOINT_IPCAM_PROXY = "/cpe-ipcam_proxy.php";

  // =========================
  // STATE
  // =========================
  let currentMode = "esp32";     // "esp32" | "ipcam"
  let modeBeforePause = "esp32";
  let ipCamUrl = "";
  let ipSnapshotTimer = null;
  let esp32PollInterval = null;
  let isPaused = false;

  const esp32StreamUrl = (cam && cam.getAttribute("src")) ? cam.getAttribute("src") : "http://192.168.4.2:81/stream";

  // Convert /stream -> /capture; also allow capture on port 80
  let esp32CaptureUrl = String(esp32StreamUrl).replace(/\/stream(\?.*)?$/i, "/capture");
  esp32CaptureUrl = esp32CaptureUrl.replace(":81/capture", "/capture");

  // =========================
  // HELPERS
  // =========================
  function setPredictionHtml(html) {
    if (predSpan) predSpan.innerHTML = html;
  }

  function setBusy(busy) {
    if (!captureBtn) return;
    captureBtn.disabled = !!busy;
    captureBtn.classList.toggle("btnBusy", !!busy);
    captureBtn.textContent = busy ? "Processing..." : "Capture & Detect";
  }

  function selectedModelName() {
    if (window.getSelectedModelName && typeof window.getSelectedModelName === "function") {
      return window.getSelectedModelName() || "";
    }
    return "";
  }

  function thresholdValue01() {
    const thr = Number(conf && conf.value ? conf.value : 50) / 100;
    return Math.max(0.01, Math.min(1.0, thr));
  }

  async function saveToDbFromResult(data, topClass, topConf) {
    // Requires js-capture_database.js loaded BEFORE this file
    if (typeof window.insertCapture !== "function") {
      console.warn("[DB] insertCapture() not found. Check js-capture_database.js is loaded.");
      return;
    }

    try {
      const storageCondEl = document.getElementById("freshnessSelection");
      const storageCond = storageCondEl ? storageCondEl.value : null;

      const sensor_ppm = (window.lastMq137Ppm !== undefined) ? window.lastMq137Ppm : null;

      const takenAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      const modelUsed = (data && data.model_used) ? data.model_used : (selectedModelName() || "");

      const capturedPath = (data && (data.image_path || data.uploaded_path)) ? (data.image_path || data.uploaded_path) : "";
      const fallbackPath = (data && data.path) ? data.path : "";
      const image_path = capturedPath || fallbackPath;

      if (!image_path) {
        console.warn("[DB] No image path returned from server; skipping DB insert.");
        return;
      }

      const res = await window.insertCapture({
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

  // =========================
  // SLIDER (optional)
  // =========================
  if (conf && confVal) {
    confVal.textContent = conf.value + "%";
    conf.addEventListener("input", () => {
      confVal.textContent = conf.value + "%";
    });
  }

  // =========================
  // RESUME (called by HTML onclick="resume()")
  // =========================
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
      if (ipCamStatus) ipCamStatus.textContent = "Resuming IP camera stream...";
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

  // =========================
  // PROXIES
  // =========================
  function esp32ProxyCapture() {
    const u = esp32CaptureUrl + "?t=" + Date.now();
    return ENDPOINT_ESP32_PROXY + "?url=" + encodeURIComponent(u);
  }

  function ipCamProxySnapshot() {
    let url = (ipCamUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) url = "http://" + url;

    try {
      const u = new URL(url);
      const snapUrl = u.origin + "/shot.jpg";
      const sep = snapUrl.indexOf("?") >= 0 ? "&" : "?";
      return ENDPOINT_IPCAM_PROXY + "?url=" + encodeURIComponent(snapUrl + sep + "t=" + Date.now());
    } catch (e) {
      if (!/\/shot\.jpg(\?.*)?$/i.test(url)) {
        url = url.replace(/\/$/, "") + "/shot.jpg";
      }
      const sep = url.indexOf("?") >= 0 ? "&" : "?";
      return ENDPOINT_IPCAM_PROXY + "?url=" + encodeURIComponent(url + sep + "t=" + Date.now());
    }
  }

  // =========================
  // IMAGE -> BLOB
  // =========================
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // If your proxies return bytes from SAME origin, crossOrigin isn't needed.
      // Keeping it off avoids some taint/cors edge cases.
      // img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load capture image via proxy."));
      img.src = src;
    });
  }

  function imageToJpegBlob(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 480;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas toBlob returned null."));
        resolve(blob);
      }, "image/jpeg", 0.92);
    });
  }

  async function captureCurrentFrameBlob() {
    const src = (currentMode === "ipcam" && ipCamUrl) ? ipCamProxySnapshot() : esp32ProxyCapture();
    const img = await loadImage(src);
    return await imageToJpegBlob(img);
  }

  function renderPrediction(data) {
    const topClass = (data && data.top_class !== undefined) ? data.top_class : "?";
    const topConf = (data && typeof data.top_confidence === "number") ? data.top_confidence : 0;
    const inferenceMs = (data && data.inference_time_ms !== undefined) ? data.inference_time_ms : null;

    let html = "<b>" + topClass + "</b> - " + (topConf * 100).toFixed(1) + "%";
    if (inferenceMs !== null) html += "<br><span style='opacity:.85;'>Inference: " + inferenceMs + " ms</span>";
    if (data && data.model_used) html += "<br><span style='opacity:.75;'>Model: " + data.model_used + "</span>";
    if (data && data.warning) html += "<div style='margin-top:8px;font-size:12px;opacity:.85;'>" + data.warning + "</div>";

    setPredictionHtml(html);
    return { topClass, topConf };
  }

  // =========================
  // CAPTURE & DETECT
  // =========================
  async function captureAndDetect() {
    setBusy(true);
    setPredictionHtml("Capturing frame...");

    try {
      const blob = await captureCurrentFrameBlob();
      setPredictionHtml("Uploading (" + Math.round(blob.size / 1024) + " KB)...");

      const fd = new FormData();
      fd.append("image", blob, "frame.jpg");
      fd.append("threshold", String(thresholdValue01()));

      const sel = selectedModelName();
      if (sel) fd.append("model_path", sel);

      const resp = await fetch(ENDPOINT_SAVE, { method: "POST", body: fd });
      const text = await resp.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("[MRTD] Non-JSON response:", text);
        throw new Error("Server did not return JSON. See console for response body.");
      }

      if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + ((data && data.message) ? data.message : "Server error"));
      if (!data || data.status !== "ok") throw new Error((data && data.message) ? data.message : "Prediction failed.");

      // Pause stream by showing annotated output (preferred)
      if (cam) {
        if (data.path) cam.src = data.path + "?t=" + Date.now();
        else if (data.image_path) cam.src = data.image_path + "?t=" + Date.now();
      }

      const out = renderPrediction(data);

      // Save to DB (optional)
      await saveToDbFromResult(data, out.topClass, out.topConf);

      modeBeforePause = currentMode;
      isPaused = true;
      console.log("[MRTD] Prediction complete. Stream paused on result image. Click Resume to continue.");
    } catch (err) {
      console.error("[MRTD]", err);
      setPredictionHtml("Error: " + (err && err.message ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  if (captureBtn) captureBtn.addEventListener("click", captureAndDetect);

  // =========================
  // UPLOAD PHOTO
  // =========================
  if (uploadPhotoBtn && photoUploadInput) {
    uploadPhotoBtn.addEventListener("click", () => {
      photoUploadInput.value = "";
      photoUploadInput.click();
    });

    photoUploadInput.addEventListener("change", async (e) => {
      const file = e && e.target && e.target.files ? e.target.files[0] : null;
      if (!file) return;

      setBusy(true);
      setPredictionHtml("Uploading file...");
      modeBeforePause = currentMode;
      isPaused = true;

      try {
        const fd = new FormData();
        fd.append("image", file, file.name);
        fd.append("threshold", String(thresholdValue01()));

        const sel = selectedModelName();
        if (sel) fd.append("model_path", sel);

        const resp = await fetch(ENDPOINT_SAVE, { method: "POST", body: fd });
        const data = await resp.json();

        if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + ((data && data.message) ? data.message : "Server error"));
        if (!data || data.status !== "ok") throw new Error((data && data.message) ? data.message : "Prediction failed.");

        if (cam) {
          if (data.path) cam.src = data.path + "?t=" + Date.now();
          else if (data.image_path) cam.src = data.image_path + "?t=" + Date.now();
        }

        const out = renderPrediction(data);
        await saveToDbFromResult(data, out.topClass, out.topConf);
      } catch (err) {
        console.error("[MRTD] Upload failed:", err);
        setPredictionHtml("Error: " + (err && err.message ? err.message : String(err)));
      } finally {
        setBusy(false);
      }
    });
  }

  // =========================
  // IP CAMERA SNAPSHOT LOOP
  // =========================
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
      if (cam) cam.src = ipCamProxySnapshot();
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

  // =========================
  // ESP32 STREAM + FALLBACK SNAPSHOT POLLING (RETRIES)
  // =========================
  let streamFallbackTimer = null;
  let streamRetryTimer = null;
  let streamRetries = 0;
  let fallbackStarted = false;
  let lastWarnAt = 0;

  function warnOnce(msg) {
    const now = Date.now();
    if (now - lastWarnAt > 8000) {
      console.warn(msg);
      lastWarnAt = now;
    }
  }

  function startEsp32StreamWithRetries() {
    if (!cam) return;

    cam.src = esp32StreamUrl;

    if (streamFallbackTimer) clearTimeout(streamFallbackTimer);
    streamFallbackTimer = setTimeout(() => {
      if (isPaused || currentMode !== "esp32") return;

      const loaded = cam.naturalWidth > 0 && cam.naturalHeight > 0;
      if (loaded) {
        streamRetries = 0;
        return;
      }

      streamRetries += 1;
      warnOnce("[MRTD] Stream did not load (attempt " + streamRetries + "). Retrying...");

      if (streamRetries <= 3) {
        if (streamRetryTimer) clearTimeout(streamRetryTimer);
        streamRetryTimer = setTimeout(() => startEsp32StreamWithRetries(), 1200);
        return;
      }

      if (!fallbackStarted) {
        fallbackStarted = true;
        warnOnce("[MRTD] Stream unavailable after retries. Using snapshot polling fallback.");

        if (!esp32PollInterval) {
          esp32PollInterval = setInterval(() => {
            if (currentMode === "esp32" && cam && !isPaused) {
              cam.src = esp32ProxyCapture();
            }
          }, 700);
        }
      }
    }, 4000);
  }

  if (cam) {
    console.log("[MRTD] Initializing ESP32 stream from:", esp32StreamUrl);

    cam.addEventListener("error", () => {
      if (isPaused || currentMode !== "esp32") return;
      if (fallbackStarted) return;
      warnOnce("[MRTD] Stream error event. Will retry stream before fallback...");
      startEsp32StreamWithRetries();
    });

    startEsp32StreamWithRetries();
  }

  // =========================
  // MQ-137 POLLING + BASELINE UI
  // =========================
  let baselineBtn = null;
  let baselineValSpan = null;
  let baselineTimeout = null;
  let baselineInterval = null;
  let baselineCollecting = false;
  let baselineValues = [];
  const baselineDuration = 120; // seconds ===============================================================================
  let baselineCountdown = baselineDuration;

  let mqValuesEl = null;

  if (mqDiv) {
    mqValuesEl = document.getElementById("mq137Values");
    if (!mqValuesEl) {
      mqValuesEl = document.createElement("div");
      mqValuesEl.id = "mq137Values";
      mqValuesEl.innerHTML = "Loading...";
      mqDiv.prepend(mqValuesEl);
    }

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
      baselineBtn.textContent = String(baselineCountdown).padStart(2, "0");
      baselineValSpan.textContent = "";

      if (baselineInterval) clearInterval(baselineInterval);
      baselineInterval = setInterval(() => {
        baselineCountdown -= 1;
        baselineBtn.textContent = String(baselineCountdown).padStart(2, "0") + "s";
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
          const sum = baselineValues.reduce((a, b) => a + b, 0);
          const avg = sum / baselineValues.length;
          baselineValSpan.textContent = "Baseline: " + avg.toFixed(2) + " ppm (" + baselineValues.length + " samples)";
        } else {
          baselineValSpan.textContent = "Baseline: No data";
        }
      }, baselineDuration * 1000);
    });

    // non-overlapping polling
    let mqInFlight = false;

    async function pollMq() {
      if (!mqValuesEl) return;
      if (mqInFlight) return;
      mqInFlight = true;

      try {
        const r = await fetch(ENDPOINT_MQ + "?t=" + Date.now(), { cache: "no-store" });

        if (!r.ok) {
          mqValuesEl.innerHTML = "<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>";
          return;
        }

        const d = await r.json();

        if (d.status === "offline") {
          mqValuesEl.innerHTML = "<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>";
          return;
        }

        let ppm = (d.ppm !== undefined) ? d.ppm : ((d.value !== undefined) ? d.value : ((d.reading !== undefined) ? d.reading : null));
        let adc = null, voltage = null, ratio = null;

        if (d.raw) {
          if (ppm === null && d.raw.nh3_ppm !== undefined) ppm = d.raw.nh3_ppm;
          if (d.raw.adc !== undefined) adc = d.raw.adc;
          if (d.raw.voltage !== undefined) voltage = d.raw.voltage;
          if (d.raw.ratio !== undefined) ratio = d.raw.ratio;
        }

        if (ppm !== null) {
          window.lastMq137Ppm = ppm;

          let html = "<div><b>MQ-137 Sensor</b></div>";
          html += "<div>NH3: <b>" + ppm + "</b> ppm</div>";
          if (adc !== null) html += "<div>ADC: <b>" + adc + "</b></div>";
          if (voltage !== null) html += "<div>Voltage: <b>" + voltage + "</b> V</div>";
          if (ratio !== null) html += "<div>Ratio: <b>" + ratio + "</b></div>";

          mqValuesEl.innerHTML = html;

          if (baselineCollecting && typeof ppm === "number" && !isNaN(ppm)) {
            baselineValues.push(ppm);
          }
        } else {
          mqValuesEl.innerHTML = "<div><b>MQ-137 Sensor</b></div><div>No data</div>";
        }
      } catch (e) {
        mqValuesEl.innerHTML = "<div><b>MQ-137 Sensor</b></div><div style='color:#b71c1c;'>Offline</div>";
      } finally {
        mqInFlight = false;
      }
    }

    pollMq();
    setInterval(pollMq, 1200);
  }
})();