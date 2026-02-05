<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ESP32 YOLO Capture</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: Arial, sans-serif; background:#f4f4f4; }
.main { max-width:600px; margin:auto; padding:20px; }
img { width:100%; border:2px solid #333; background:#000; }
button { padding:10px 20px; margin:8px 4px; font-size:16px; }
#prediction { background:#fff; padding:10px; margin-top:10px; border:1px solid #ccc; }
</style>
</head>
<body>

<div class="main">
    <h2>ESP32-CAM YOLO Detection</h2>

    <img id="cam">

    <div>
        <button id="captureBtn">Capture & Detect</button>
        <button onclick="resume()">Resume</button>
    </div>

    <div>
        Confidence:
        <input type="range" id="conf" min="0" max="100" value="30">
        <span id="confVal">30%</span>

        Target FPS:
        <input type="number" id="targetFps" min="1" max="15" value="5" style="width:60px">
        <button id="streamBtn">Start Stream Detect</button>
    </div>

    <div id="prediction"></div>
</div>

<!-- Canvas overlay for drawing boxes -->
<canvas id="overlay" style="position:fixed;left:0;top:0;pointer-events:none;display:none"></canvas>

<script>
const cam = document.getElementById("cam");
const btn = document.getElementById("captureBtn");
const conf = document.getElementById("conf");
const confVal = document.getElementById("confVal");
const predDiv = document.getElementById("prediction");

const ESP32_URL = "http://192.168.4.2/capture";
let paused = false;
let streamInterval = null;

conf.oninput = () => confVal.innerText = conf.value + "%";

// ===== LIVE STREAM =====
function startStream(){
    streamInterval = setInterval(() => {
        if(!paused){
            cam.src = ESP32_URL + "?t=" + Date.now();
        }
    }, 500);
}
startStream();

// Prepare overlay canvas size & position
const overlay = document.getElementById('overlay');
function resizeOverlay(){
    const rect = cam.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.width = rect.width;
    overlay.height = rect.height;
    overlay.style.display = 'block';
}
window.addEventListener('resize', resizeOverlay);
cam.addEventListener('load', resizeOverlay);
resizeOverlay();

// ===== CAPTURE & YOLO =====
btn.onclick = () => {
    paused = true;
    clearInterval(streamInterval);
    btn.disabled = true;
    predDiv.innerHTML = "Processing...";

    fetch(ESP32_URL)
    .then(r => r.blob())
    .then(blob => {
        const fd = new FormData();
        fd.append("image", blob, "frame.jpg");
        fd.append("threshold", (conf.value / 100).toString());

        return fetch("cpe-save_image.php", {
            method: "POST",
            body: fd
        });
    })
    .then(r => r.json())
    .then(data => {
        btn.disabled = false;

        if(data.status !== "ok"){
            predDiv.innerText = "Error: " + data.message;
            return;
        }

        // Decode path and add cache-buster
        let imgPath = data.path;
        if(imgPath) {
            imgPath = decodeURIComponent(imgPath);
            cam.src = imgPath + "?t=" + Date.now();
        }
        renderPredictions(data.predictions);
    })
    .catch(err => {
        console.error(err);
        predDiv.innerText = "Request failed";
        btn.disabled = false;
    });
};

// ===== STREAM DETECTION =====
let streamDetect = false;
let streamIntervalId = null;
let pendingReq = false;
let clientId = 'client_' + Math.random().toString(36).slice(2,9);
const streamBtn = document.getElementById('streamBtn');
const targetFpsInput = document.getElementById('targetFps');

function clearCanvas(){
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,overlay.width,overlay.height);
}

// Interpolated draw: we keep prev and curr detection maps and interpolate by time
let prevDetections = {};
let currDetections = {};
let lastDetectTime = 0;
let detectInterval = 1000; // ms

function drawBoxesInterpolated(){
    const now = Date.now();
    const dt = Math.max(1, now - lastDetectTime);
    const t = Math.min(1, dt / detectInterval);

    // build blended list
    const blended = [];
    const keys = new Set([...Object.keys(prevDetections), ...Object.keys(currDetections)]);
    keys.forEach(k => {
        const a = prevDetections[k];
        const b = currDetections[k];
        if(a && b){
            // interpolate
            const bbox = [0,0,0,0];
            for(let i=0;i<4;i++) bbox[i] = Math.round(a.bbox[i] * (1-t) + b.bbox[i] * t);
            const conf = a.conf * (1-t) + b.conf * t;
            blended.push({id:k, name:b.name, conf, bbox});
        } else if(b && !a){
            // new detection: fade in
            const bbox = b.bbox.slice();
            const conf = b.conf * t;
            blended.push({id:k, name:b.name, conf, bbox});
        } else if(a && !b){
            // disappearing: fade out
            const bbox = a.bbox.slice();
            const conf = a.conf * (1-t);
            if(conf > 0.05) blended.push({id:k, name:a.name, conf, bbox});
        }
    });

    // actual draw
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,overlay.width,overlay.height);
    ctx.lineWidth = 2;
    ctx.font = '16px Arial';
    const rect = cam.getBoundingClientRect();
    const imgW = cam.naturalWidth || rect.width;
    const imgH = cam.naturalHeight || rect.height;
    const scaleX = rect.width / imgW;
    const scaleY = rect.height / imgH;

    blended.forEach(p => {
        const [x1,y1,x2,y2] = p.bbox;
        const sx = x1 * scaleX, sy = y1 * scaleY, sw = (x2-x1)*scaleX, sh = (y2-y1)*scaleY;
        ctx.strokeStyle = '#00FF00';
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.fillStyle = '#00FF00';
        ctx.fillText(p.name + ' ' + (p.conf*100).toFixed(1) + '%', sx, Math.max(12, sy - 4));
    });
}


streamBtn.onclick = () => {
    streamDetect = !streamDetect;
    streamBtn.innerText = streamDetect ? 'Stop Stream Detect' : 'Start Stream Detect';

    if(streamDetect){
        // Start loop at target fps
        const fps = Math.max(1, Math.min(15, parseInt(targetFpsInput.value)));
        const interval = 1000 / fps;
        streamIntervalId = setInterval(() => {
            if(pendingReq) return; // drop frame
            pendingReq = true;

            // fetch the current frame
            fetch(ESP32_URL)
            .then(r => r.blob())
            .then(blob => {
                const fd = new FormData();
                fd.append('image', blob, 'frame.jpg');
                fd.append('threshold', (conf.value/100).toString());
                fd.append('boxes_only', '1');
                fd.append('client_id', clientId);
                fd.append('imgsz', '320');

                return fetch('cpe-save_image.php', {method:'POST', body:fd});
            })
            .then(r => r.json())
            .then(data => {
                pendingReq = false;
                if(data.status !== 'ok'){
                    console.warn('stream detect failed', data);
                    return;
                }
                // update smoothing maps and timing for interpolation
                const now = Date.now();
                prevDetections = JSON.parse(JSON.stringify(currDetections));
                currDetections = {};
                (data.predictions||[]).forEach(p => { currDetections[p.id||(p.name+'_'+Math.random().toString(36).slice(2,6))] = p; });
                // update timing
                detectInterval = Math.max(200, now - lastDetectTime || 200);
                lastDetectTime = now;

            })
            .catch(err => {
                pendingReq = false;
                console.error('stream detect error', err);
            });
        }, interval);
    } else {
        if(streamIntervalId) clearInterval(streamIntervalId);
        pendingReq = false;
        clearCanvas();
    }
};

// run interpolation draw loop at higher refresh rate for smoothness
let displayIntervalId = setInterval(() => {
    if(streamDetect) drawBoxesInterpolated();
}, 1000/20); // 20 fps display


// ===== RESUME =====
function resume(){
    paused = false;
    predDiv.innerHTML = "";
    startStream();
}

// ===== SHOW PREDICTIONS =====
function renderPredictions(preds){
    predDiv.innerHTML = "";

    if(!preds || preds.length === 0){
        predDiv.innerText = "No detections";
        return;
    }

    const ul = document.createElement("ul");
    preds.forEach(p => {
        const li = document.createElement("li");
        li.innerText = `${p.name} — ${(p.conf*100).toFixed(1)}%`;
        ul.appendChild(li);
    });
    predDiv.appendChild(ul);
}
</script>

</body>
</html>
