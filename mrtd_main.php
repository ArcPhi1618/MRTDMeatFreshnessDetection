<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="mrtd_main.css">
<title>ESP32 Capture</title>
</head>
<body>

<div class="main-con">

    <div class="head">
        <a class="head-back" href="index.php">🡨</a>
        <img class="img" src="images/LOGO_THESIS.png">
    </div>

    <div class="main">

        <div class="output-main-con">
            <img class="out-img" id="esp32-cam">
        </div>

        <button id="captureBtn">Capture</button>
        <button onclick="resume()">Resume</button>

    </div>
</div>

<script>
const video = document.getElementById("esp32-cam");
const btn = document.getElementById("captureBtn");

// ESP32 capture URL
let streamURL = "http://192.168.4.2/capture";  
let paused = false;

// ===== LIVE STREAM POLLING =====
setInterval(() => {
    if(!paused){
        video.src = streamURL + "?t=" + Date.now();
    }
}, 500);  // 500ms works well for ESP32

// ===== CAPTURE BUTTON =====
btn.addEventListener("click", () => {

    paused = true;  // freeze display

    fetch(streamURL)
    .then(res => res.blob())
    .then(blob => {

        let formData = new FormData();
        formData.append("image", blob);

        return fetch("save_image.php", {
            method: "POST",
            body: formData
        });

    })
    .then(res => res.text())
    .then(path => {
        // freeze using the uploaded file from PHP
        video.src = path.trim();
    });

});

// ===== RESUME =====
function resume(){
    paused = false;
}
</script>

</body>
</html>