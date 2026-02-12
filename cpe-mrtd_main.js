const cam = document.getElementById("cam");
const btn = document.getElementById("captureBtn");
const conf = document.getElementById("conf");
const confVal = document.getElementById("confVal");
const predDiv = document.getElementById("prediction");
const mqDiv = document.getElementById("mq137Data");

const ESP32_CAM_URL = "http://192.168.4.2/capture"; // Change if your ESP32-CAM IP is different

let paused = false;
let streamInterval = null;

// ===== IP CAMERA CONFIG =====
let currentCameraMode = 'esp32'; // 'esp32' or 'ipcam'
let ipCamUrl = '';
const ipCamInputDiv = document.getElementById('ipCamInputDiv');
const ipCamUrlInput = document.getElementById('ipCamUrl');
const connectIpCamBtn = document.getElementById('connectIpCamBtn');
const backToEsp32Btn = document.getElementById('backToEsp32Btn');
const ipCamStatus = document.getElementById('ipCamStatus');
const ipCamDisplayContainer = document.getElementById('ipCamDisplayContainer');
const ipCamImg = document.getElementById('ipCamImg');


connectIpCamBtn.onclick = () => {
    let url = ipCamUrlInput.value.trim();
    if(!url){
        ipCamStatus.innerHTML = '<span style="color:red;">Please enter an IP camera URL</span>';
        return;
    }
    
    // Auto-prepend http:// if no protocol is specified
    if(!url.toLowerCase().startsWith('http://') && !url.toLowerCase().startsWith('https://')){
        url = 'http://' + url;
    }
    
    // If URL doesn't have a path, try common paths
    if(!url.includes('/', url.indexOf('://') + 3)) {
        // This is just an IP:port, try common stream paths
        if(url.match(/:\d+$/)) {
            // Has port but no path, suggest adding /video or /stream
            url = url + '/video';
        }
    }
    
    ipCamUrl = url;
    ipCamUrlInput.value = url;
    currentCameraMode = 'ipcam';
    paused = false;
    clearInterval(streamInterval);
    ipCamStatus.innerHTML = '<span style="color:blue;">Connecting to IP camera...</span>';
    
    switchToIpCamDisplay();
    startIpCamStream();
};

function switchToIpCamDisplay() {
    cam.style.display = 'none';
    ipCamDisplayContainer.style.display = 'block';
    ipCamStatus.innerHTML = '<span style="color:green;">✓ IP Camera stream connected</span>';
    setTimeout(resizeOverlay, 100);
}

function switchToEsp32Display() {
    cam.style.display = 'block';
    ipCamDisplayContainer.style.display = 'none';
    ipCamImg.src = '';
    setTimeout(resizeOverlay, 100);
}

backToEsp32Btn.onclick = () => {
    currentCameraMode = 'esp32';
    ipCamUrl = '';
    ipCamStatus.innerHTML = '<span style="color:green;">✓ Switched back to ESP32 camera</span>';
    switchToEsp32Display();
    paused = false;
    predDiv.innerHTML = '';
    startStream();
};

function startIpCamStream(){
    // Continuously update the img src to refresh the stream
    streamInterval = setInterval(() => {
        if(currentCameraMode === 'ipcam' && ipCamUrl && !paused){
            // Add timestamp to bypass cache
            ipCamImg.src = ipCamUrl + (ipCamUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
    }, 500);
}

function renderIpCamFrame() {
    // Not needed with simple img tag
}

conf.oninput = () => confVal.innerText = conf.value + "%";

// ===== LIVE STREAM =====
function startStream(){
    if(currentCameraMode === 'ipcam'){
        startIpCamStream();
    } else {
        // Ensure camera parameters are applied before streaming
        setEsp32CamParams();
        streamInterval = setInterval(() => {
            if(!paused){
                cam.src = ESP32_CAM_URL + "?t=" + Date.now();
            }
        }, 500);
    }
}

function setEsp32CamParams(){
    try{
        const base = ESP32_CAM_URL.replace(/\/capture\/?$/,'');
        const cmds = [
            {v: 'quality', val: 4},
            {v: 'brightness', val: -2},
            {v: 'contrast', val: -1},
            {v: 'saturation', val: 1}
        ];

        // Fire-and-forget requests to the ESP32 control endpoint
        cmds.forEach(c => {
            const u = base + '/control?var=' + encodeURIComponent(c.v) + '&val=' + encodeURIComponent(c.val);
            fetch(u).catch(() => {});
        });
    }catch(e){
        console.warn('setEsp32CamParams failed', e);
    }
}
startStream();

// Prepare overlay canvas size & position
const overlay = document.getElementById('overlay');
function resizeOverlay(){
    const activeDisplay = currentCameraMode === 'esp32' ? cam : ipCamDisplayContainer;
    const rect = activeDisplay.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.width = rect.width;
    overlay.height = rect.height;
    overlay.style.display = 'block';
}
window.addEventListener('resize', resizeOverlay);
cam.addEventListener('load', resizeOverlay);
ipCamDisplayContainer.addEventListener('load', resizeOverlay);
resizeOverlay();

// ===== CAPTURE & YOLO =====
btn.onclick = () => {
    paused = true;
    clearInterval(streamInterval);
    btn.disabled = true;
    // Dim the display and overlay a centered spinner+text
    const display = currentCameraMode === 'ipcam' ? ipCamDisplayContainer : cam;
    display.style.transition = 'filter 0.2s';
    display.style.filter = 'brightness(0.5)';
    // Remove any previous overlay
    let overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = display.offsetTop + 'px';
    overlay.style.left = display.offsetLeft + 'px';
    overlay.style.width = display.offsetWidth + 'px';
    overlay.style.height = display.offsetHeight + 'px';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 1000;
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:10px;">'
        + '<div class="spinner" style="width:22px;height:22px;border:3px solid #bbb;border-top:3px solid #3498db;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></div>'
        + '<div style="font-size:11px;font-weight:500;text-align:left;line-height:22px;">Loading, the captured image is being processed.</div>'
        + '</div>';
    // Insert overlay into the same parent as display
    display.parentElement.appendChild(overlay);
    predDiv.innerHTML = '';

    if(currentCameraMode === 'ipcam') {
        // If the user input is an IP Webcam stream, fetch /shot.jpg for a snapshot
        let snapshotUrl = ipCamUrl;
        try {
            // Try to extract base URL (protocol://host:port)
            const urlObj = new URL(ipCamUrl);
            snapshotUrl = urlObj.origin + '/shot.jpg';
        } catch (e) {
            // fallback: try to replace /video or /stream with /shot.jpg
            snapshotUrl = ipCamUrl.replace(/\/(video|stream).*$/, '/shot.jpg');
        }
        fetch(snapshotUrl)
        .then(r => r.blob())
        .then(blob => {
            if(!blob){
                predDiv.innerText = "Error: Failed to capture image";
                btn.disabled = false;
                paused = false;
                return;
            }
            const fd = new FormData();
            fd.append("image", blob, "frame.jpg");
            fd.append("threshold", (conf.value / 100).toString());
            fetch("cpe-save_image.php", {
                method: "POST",
                body: fd
            })
            .then(r => r.json())
            .then(data => {
                btn.disabled = false;
                // Restore display brightness and remove overlay
                display.style.filter = '';
                let overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.remove();
                if(data.status !== "ok"){
                    predDiv.innerText = "Error: " + data.message;
                    paused = false;
                    return;
                }
                let imgPath = data.path;
                if(imgPath) {
                    imgPath = decodeURIComponent(imgPath);
                    ipCamImg.src = imgPath + "?t=" + Date.now();
                }
                renderPredictions(data.predictions);
            })
            .catch(err => {
                console.error(err);
                display.style.filter = '';
                let overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.remove();
                predDiv.innerHTML = '<span style="color:red;">Request failed</span>';
                btn.disabled = false;
                paused = false;
            });
        });
    } else {
        // ESP32: fetch from capture endpoint as before
        fetch(ESP32_CAM_URL)
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
            // Restore display brightness and remove overlay
            display.style.filter = '';
            let overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.remove();

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
            display.style.filter = '';
            let overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.remove();
            predDiv.innerHTML = '<span style="color:red;">Request failed</span>';
            btn.disabled = false;
        });
    // Add spinner animation CSS if not already present
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.innerHTML = `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { border-right-color: #bbb !important; border-top-color: #3498db !important; }
        `;
        document.head.appendChild(style);
    }
    }
};

// ===== MQ-137 SENSOR FETCH =====
function fetchMQ137(){
    // Try direct connection first, then fallback to PHP proxy
    fetchMQ137WithUrl("http://192.168.4.1/mq137");
}

function fetchMQ137WithUrl(url) {
    fetch(url)
    .then(r => {
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    })
    .then(data => {
        mqDiv.innerHTML = `
            <ul>
                <li>ADC Value: ${data.adc}</li>
                <li>Voltage: ${data.voltage.toFixed(3)} V</li>
                <li>Rs/Ro Ratio: ${data.ratio.toFixed(3)}</li>
                <li>NH3 Concentration: ${data.nh3_ppm.toFixed(1)} ppm</li>
            </ul>
        `;
    })
    .catch(err => {
        // If direct connection fails, try PHP proxy
        if(url === "http://192.168.4.1/mq137"){
            console.warn('Direct connection to ESP32 failed, trying PHP proxy...');
            fetchMQ137WithUrl("mq137_proxy.php");
        } else {
            mqDiv.innerHTML = `<strong>Error:</strong> ${err.message}<br/>Make sure ESP32 is online and connected.`;
            console.error('MQ137 fetch error:', err);
        }
    });
}
// Fetch every second
setInterval(fetchMQ137, 1000);
fetchMQ137(); // initial fetch

// ===== STREAM DETECTION =====
// (Keep your existing stream detection code as is)

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

    const blended = [];
    const keys = new Set([...Object.keys(prevDetections), ...Object.keys(currDetections)]);
    keys.forEach(k => {
        const a = prevDetections[k];
        const b = currDetections[k];
        if(a && b){
            const bbox = [0,0,0,0];
            for(let i=0;i<4;i++) bbox[i] = Math.round(a.bbox[i] * (1-t) + b.bbox[i] * t);
            const conf = a.conf * (1-t) + b.conf * t;
            blended.push({id:k, name:b.name, conf, bbox});
        } else if(b && !a){
            const bbox = b.bbox.slice();
            const conf = b.conf * t;
            blended.push({id:k, name:b.name, conf, bbox});
        } else if(a && !b){
            const bbox = a.bbox.slice();
            const conf = a.conf * (1-t);
            if(conf > 0.05) blended.push({id:k, name:a.name, conf, bbox});
        }
    });

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
        const fps = Math.max(1, Math.min(15, parseInt(targetFpsInput.value)));
        const interval = 1000 / fps;
        streamIntervalId = setInterval(() => {
            if(pendingReq) return;
            pendingReq = true;

            fetch(ESP32_CAM_URL)
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
                const now = Date.now();
                prevDetections = JSON.parse(JSON.stringify(currDetections));
                currDetections = {};
                (data.predictions||[]).forEach(p => { currDetections[p.id||(p.name+'_'+Math.random().toString(36).slice(2,6))] = p; });
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

let displayIntervalId = setInterval(() => {
    if(streamDetect) drawBoxesInterpolated();
}, 1000/20); // 20 fps display

// ===== RESUME =====
function resume(){
    paused = false;
    predDiv.innerHTML = "";
    clearCanvas();
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

if (ipCamImg) ipCamImg.crossOrigin = 'anonymous';
