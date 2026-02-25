// js-cpe-model-handler.js
(() => {
  const modelUpload = document.getElementById("modelUpload");
  const uploadStatus = document.getElementById("uploadStatus");
  const modelListDiv = document.querySelector(".model-list");

  const LS_KEY = "cpe_selected_model";
  const ALLOWED_EXT = ["onnx", "keras", "h5", "pt"];

  function setStatus(msg, isError = false) {
    if (!uploadStatus) return;
    uploadStatus.textContent = msg || "";
    uploadStatus.style.color = isError ? "#b00020" : "#2e7d32";
  }

  function getSelectedModel() {
    const sel = localStorage.getItem(LS_KEY);
    if (sel && sel.trim()) return sel;
    // Default to best.onnx if present in model list
    return "best.onnx";
  }
  function setSelectedModel(name) {
    if (!name) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, name);
  }

  // Expose to other scripts
  window.getSelectedModelName = () => getSelectedModel();
  window.setSelectedModelName = (name) => setSelectedModel(name);

  function extOf(filename) {
    const m = (filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }
  function isAllowedFile(filename) {
    return ALLOWED_EXT.includes(extOf(filename));
  }

  async function fetchModelList() {
    const r = await fetch("cpe-model_list.php?t=" + Date.now());
    if (!r.ok) throw new Error("Failed to load model list.");
    return await r.json();
  }

  function renderList(models) {
    if (!modelListDiv) return;

    const selected = getSelectedModel();
    modelListDiv.innerHTML = "";

    if (!Array.isArray(models) || models.length === 0) {
      modelListDiv.innerHTML = `<div style="opacity:.7;font-size:13px;">No uploaded models yet.</div>`;
      return;
    }

    models.forEach((m) => {
      const isSel = selected && m.name === selected;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.padding = "8px";
      row.style.borderRadius = "6px";
      row.style.marginBottom = "6px";
      row.style.border = isSel ? "1px solid #b71c1c" : "1px solid #ddd";
      row.style.background = isSel ? "rgba(46,125,50,0.10)" : "#fff";
      row.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      row.style.color = isSel ? "#ddd" : "#333";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";
      left.style.gap = "2px";

      const title = document.createElement("div");
      title.textContent = m.name;
      title.style.fontWeight = "600";
      title.style.fontSize = "13px";
      title.style.wordBreak = "break-word";

      const meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.opacity = "0.7";
      meta.textContent = `${m.ext.toUpperCase()} • ${(m.size_kb).toFixed(1)} KB`;

      left.appendChild(title);
      left.appendChild(meta);

      const btn = document.createElement("button");
      btn.textContent = isSel ? "Selected" : "Use";
      btn.style.padding = "6px 10px";
      btn.style.cursor = "pointer";
      btn.disabled = isSel;

      btn.addEventListener("click", () => {
        setSelectedModel(m.name);
        setStatus(`Selected model: ${m.name}`);
        renderList(models);
      });

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "X";
      delBtn.style.padding = "6px 10px";
      delBtn.style.cursor = "pointer";
      delBtn.style.background = "#b71c1c";
      delBtn.style.color = "#fff";
      delBtn.style.border = "none";
      delBtn.style.borderRadius = "4px";
      delBtn.cursor = "pointer";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete model '${m.name}'? This cannot be undone.`)) return;
        setStatus(`Deleting model: ${m.name}`);
        try {
          const r = await fetch("delete_model.php", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ model: m.name })
          });
          const data = await r.json().catch(() => null);
          if (!r.ok || !data || data.status !== "ok") {
            throw new Error(data?.message || "Delete failed.");
          }
          setStatus(`Deleted model: ${m.name}`);
          await refresh();
        } catch (err) {
          setStatus(err.message || "Delete failed.", true);
        }
      });

      row.appendChild(left);
      row.appendChild(btn);
      row.appendChild(delBtn);
      modelListDiv.appendChild(row);
    });
  }

  async function refresh() {
    try {
      const data = await fetchModelList();
      if (data.status !== "ok") throw new Error(data.message || "Model list error");
      renderList(data.models);

      const sel = getSelectedModel();
      if (sel) setStatus(`Selected model: ${sel}`, false);
      else setStatus("No model selected (default: best.onnx).", false);
    } catch (e) {
      console.error("[MODEL]", e);
      setStatus(e.message || "Failed to refresh model list.", true);
    }
  }

  async function uploadModel(file) {
    if (!file) return;
    if (!isAllowedFile(file.name)) {
      setStatus("Only .onnx, .keras, .h5, .pt are allowed.", true);
      return;
    }

    const fd = new FormData();
    fd.append("model", file, file.name);

    setStatus(`Uploading ${file.name}…`, false);

    const r = await fetch("cpe-model_upload.php", { method: "POST", body: fd });
    const data = await r.json().catch(() => null);

    if (!r.ok || !data || data.status !== "ok") {
      throw new Error(data?.message || "Model upload failed.");
    }

    setSelectedModel(data.name);
    setStatus(`Uploaded + selected: ${data.name}`, false);
    await refresh();
  }

  if (modelUpload) {
    modelUpload.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      modelUpload.value = "";
      try {
        await uploadModel(f);
      } catch (err) {
        console.error("[MODEL]", err);
        setStatus(err.message || "Upload failed.", true);
      }
    });
  }

  refresh();
})();
