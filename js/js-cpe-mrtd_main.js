// js/js-cpe-mrtd_main.js
(() => {
  const $ = (id) => document.getElementById(id);

  const cam = $("esp32StreamImg");
  const captureBtn = $("captureBtn");
  const predDiv = $("prediction");
  const conf = $("conf");
  const confVal = $("confVal");
  const overlay = $("overlay");

  const uploadPhotoBtn = $("uploadPhotoBtn");
  const photoUploadInput = $("photoUploadInput");

  const ipCamToggleBtn = $("ipCamToggleBtn");
  const ipCamInputDiv = $("ipCamInputDiv");
  const ipCamUrlInput = $("ipCamUrl");
  const connectIpCamBtn = $("connectIpCamBtn");
  const backToEsp32Btn = $("backToEsp32Btn");
  const ipCamStatus = $("ipCamStatus");

  const mq137Data = $("mq137Data");

  const modelSelect = $("modelSelect");
  const refreshModelsBtn = $("refreshModelsBtn");
  const modelUploadInput = $("modelUploadInput");
  const uploadModelBtn = $("uploadModelBtn");
  const currentModelText = $("currentModelText");

  if (!cam) console.error("[MRTD] Missing #esp32StreamImg");
  if (!captureBtn) console.error("[MRTD] Missing #captureBtn");

  let paused = false;
  let currentCameraMode = "esp32"; // esp32 | ipcam
  let ipCamUrl = "";

  const esp32StreamUrl = cam?.getAttribute("src") || "";
  const esp32CaptureUrl = esp32StreamUrl
    ? esp32StreamUrl.replace(/\/stream(\?.*)?$/i, "/capture")
    : "http://192.168.4.2:81/capture";

  function esp32ProxyCaptureUrl() {
    return `esp32_camera_proxy.php?url=${encodeURIComponent(
      esp32CaptureUrl + (esp32CaptureUrl.includes("?") ? "&" : "?") + "t=" + Date.now()
    )}`;
  }

  function ipCamProxyCaptureUrl() {
    let snap = ipCamUrl;
    try {
      const u = new URL(ipCamUrl);
      snap = u.origin + "/shot.jpg";
    } catch {}
    return `cpe-ipcam_proxy.php?url=${encodeURIComponent(
      snap + (snap.includes("?") ? "&" : "?") + "t=" + Date.now()
    )}`;
  }

  function setStatus(html, type = "info") {
    if (!predDiv) return;
    const color = type === "error" ? "#ff7b7b" : type === "warn" ? "#ffd27b" : "#cfe2ff";
    predDiv.innerHTML = `<div style="color:${color};font-size:12px;line-height:1.35;">${html}</div>`;
  }

  function showBusy(on) {
    if (!captureBtn) return;
    captureBtn.disabled = on;
  }

  function clearOverlay() {
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  window.resume = function resume() {
    paused = false;
    currentCameraMode = "esp32";
    if (cam) cam.src = esp32StreamUrl;
    clearOverlay();
    setStatus("Live stream resumed.");
  };

  // Slider
  if (conf && confVal) {
    confVal.textContent = conf.value + "%";
    conf.addEventListener("input", () => (confVal.textContent = conf.value + "%"));
  }

  async function loadImageAsBlob(proxyUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Failed to load capture image via proxy"));
      img.src = proxyUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 640;
    canvas.height = img.naturalHeight || 480;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("Canvas toBlob() returned null");
    return blob;
  }

  async function captureFrameBlob() {
    const proxyUrl =
      currentCameraMode === "ipcam" && ipCamUrl ? ipCamProxyCaptureUrl() : esp32ProxyCaptureUrl();
    return await loadImageAsBlob(proxyUrl);
  }

  function renderPredictions(data) {
    const top = data.top_class ?? "?";
    const confPct = ((data.top_confidence ?? 0) * 100).toFixed(1);
    const t = data.inference_time_ms != null ? ` • ${data.inference_time_ms} ms` : "";
    setStatus(`<b>Prediction:</b> ${top} (${confPct}%)${t}`);

    if (Array.isArray(data.predictions) && data.predictions.length) {
      const items = data.predictions
        .map((p) => `<li>${p.name} — ${(p.conf * 100).toFixed(1)}%</li>`)
        .join("");
      predDiv.innerHTML += `<ul style="margin:8px 0 0 16px;font-size:12px;">${items}</ul>`;
    }
  }

  async function uploadAndPredict(blobOrFile) {
    if (!conf) throw new Error("Confidence slider missing");
    const fd = new FormData();
    fd.append("image", blobOrFile, blobOrFile.name || "frame.jpg");
    fd.append("threshold", (Number(conf.value) / 100).toString());

    const resp = await fetch("cpe-save_image.php", { method: "POST", body: fd });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) throw new Error(`Server error HTTP ${resp.status}`);
    if (data.status !== "ok") throw new Error(data.message || "Prediction failed");
    return data;
  }

  async function captureAndDetect() {
    if (!cam) return setStatus("Camera element not found.", "error");
    paused = true;
    showBusy(true);
    setStatus("Capturing frame…");

    try {
      const blob = await captureFrameBlob();
      setStatus(`Uploading (${Math.round(blob.size / 1024)} KB)…`);
      const data = await uploadAndPredict(blob);

      cam.src = `${data.path}?t=${Date.now()}`;
      renderPredictions(data);
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Capture & Detect failed.", "error");
      paused = false;
      cam.src = esp32StreamUrl;
    } finally {
      showBusy(false);
    }
  }

  captureBtn && captureBtn.addEventListener("click", captureAndDetect);

  // Upload photo
  if (uploadPhotoBtn && photoUploadInput) {
    uploadPhotoBtn.addEventListener("click", () => {
      photoUploadInput.value = "";
      photoUploadInput.click();
    });
    photoUploadInput.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      paused = true;
      showBusy(true);
      setStatus("Uploading photo…");
      try {
        const data = await uploadAndPredict(f);
        cam.src = `${data.path}?t=${Date.now()}`;
        renderPredictions(data);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Upload failed.", "error");
        paused = false;
        cam.src = esp32StreamUrl;
      } finally {
        showBusy(false);
      }
    });
  }

  // IP cam
  if (ipCamToggleBtn && ipCamInputDiv) {
    ipCamToggleBtn.addEventListener("click", () => {
      ipCamInputDiv.style.display = ipCamInputDiv.style.display === "none" ? "block" : "none";
    });
  }

  if (connectIpCamBtn && ipCamUrlInput) {
    connectIpCamBtn.addEventListener("click", () => {
      const url = (ipCamUrlInput.value || "").trim();
      if (!url) {
        ipCamStatus && (ipCamStatus.textContent = "Enter an IP cam URL.");
        return;
      }
      ipCamUrl = url;
      currentCameraMode = "ipcam";
      paused = false;
      ipCamStatus && (ipCamStatus.textContent = "Connected (snapshot mode).");

      const loop = () => {
        if (currentCameraMode !== "ipcam") return;
        cam.src = ipCamProxyCaptureUrl();
        setTimeout(loop, 250);
      };
      loop();
    });
  }

  if (backToEsp32Btn) {
    backToEsp32Btn.addEventListener("click", () => {
      ipCamUrl = "";
      currentCameraMode = "esp32";
      paused = false;
      cam.src = esp32StreamUrl;
      ipCamStatus && (ipCamStatus.textContent = "Back to ESP32.");
    });
  }

  // MQ-137 polling (expects mq137_proxy.php returns JSON {ppm, status} or {value,...})
  async function pollMq() {
    if (!mq137Data) return;
    try {
      const r = await fetch("mq137_proxy.php?t=" + Date.now());
      const d = await r.json();
      const ppm = d.ppm ?? d.value ?? "—";
      const st = d.status ? ` (${d.status})` : "";
      mq137Data.textContent = `${ppm}${st}`;
    } catch {
      mq137Data.textContent = "—";
    }
  }
  setInterval(pollMq, 1000);
  pollMq();

  // ===== Model management =====
  async function refreshModels() {
    try {
      const r = await fetch("list_models.php?t=" + Date.now());
      const d = await r.json();
      if (!d || d.status !== "ok") throw new Error(d?.message || "Failed to list models");

      modelSelect.innerHTML = "";
      (d.models || []).forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });

      const r2 = await fetch("get_current_model.php?t=" + Date.now());
      const cur = await r2.json();
      if (cur?.status === "ok" && cur.model) {
        currentModelText.textContent = cur.model;
        modelSelect.value = cur.model;
      }
    } catch (e) {
      console.error(e);
      currentModelText.textContent = "(error)";
    }
  }

  refreshModelsBtn && refreshModelsBtn.addEventListener("click", refreshModels);
  modelSelect && modelSelect.addEventListener("change", async () => {
    const m = modelSelect.value;
    try {
      const fd = new FormData();
      fd.append("model", m);
      const r = await fetch("set_model.php", { method: "POST", body: fd });
      const d = await r.json();
      if (d.status !== "ok") throw new Error(d.message || "Failed to set model");
      currentModelText.textContent = m;
      setStatus(`Active model set to <b>${m}</b>.`);
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Failed to set model", "error");
    }
  });

  uploadModelBtn && uploadModelBtn.addEventListener("click", async () => {
    const f = modelUploadInput?.files?.[0];
    if (!f) return setStatus("Choose an .onnx model file first.", "warn");
    if (!f.name.toLowerCase().endsWith(".onnx")) return setStatus("Only .onnx is allowed.", "warn");
    try {
      const fd = new FormData();
      fd.append("model", f, f.name);
      const r = await fetch("upload_model.php", { method: "POST", body: fd });
      const d = await r.json();
      if (d.status !== "ok") throw new Error(d.message || "Upload failed");
      setStatus(`Model uploaded: <b>${d.filename}</b>.`);
      await refreshModels();
      modelSelect.value = d.filename;
      modelSelect.dispatchEvent(new Event("change"));
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Model upload failed.", "error");
    }
  });

  refreshModels();
})();
