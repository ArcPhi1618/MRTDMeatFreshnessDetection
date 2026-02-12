<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ESP32 YOLO & MQ137 Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="css-mrtd_main.css">
</head>
<body>

<div class="main compact">
    <h2>ESP32-CAM YOLO Detection</h2>

    <div id="camContainer" style="position:relative; display:inline-block; width:100%;">
        <img id="cam" crossorigin="anonymous" style="display:block; width:100%;">
        <div id="detectionOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.05); z-index:10;">
            <img id="detectionImg" style="width:100%; height:100%; object-fit:contain;" alt="Detection Result">
        </div>
    </div>
    
    <div id="ipCamDisplayContainer" style="display:none; width:100%; border:2px solid #ccc; border-radius:5px; overflow:hidden; background-color:#000; position:relative;">
        <img id="ipCamImg" style="width:100%; height:auto; display:block; max-height:600px; object-fit:contain;" alt="IP Camera Feed">
        <div id="ipCamDetectionOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.05); z-index:10;">
            <img id="ipCamDetectionImg" style="width:100%; height:auto; max-height:600px; object-fit:contain;" alt="IP Cam Detection Result">
        </div>
    </div>

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

    <!-- IP Camera Selection -->
    <div style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
        <h4>IP Camera Configuration</h4>
        <button id="ipCamToggleBtn">Enable IP Camera</button>
        <div id="ipCamInputDiv" style="display:none; margin-top: 10px;">
            <label>IP Camera Stream URL:</label><br>
            <input type="text" id="ipCamUrl" placeholder="e.g., 192.168.1.100:8080/video (http:// will be added automatically)" style="width: 100%; padding: 8px; margin-top: 5px;">
            <div style="margin-top: 10px;">
                <button id="connectIpCamBtn">Connect IP Camera</button>
                <button id="backToEsp32Btn">Back to ESP32</button>
            </div>
            <div id="ipCamStatus" style="margin-top: 10px; color: #666; font-size: 14px;"></div>
        </div>
    </div>

    <div id="prediction"></div>

    <!-- ===== MQ-137 SENSOR DATA ===== -->
    <h3>MQ-137 Sensor Readings</h3>
    <div id="mq137Data">
        Loading...
    </div>
</div>


<!-- Hidden canvas for capturing IP camera frames -->
<canvas id="captureCanvas" style="display:none;"></canvas>

    <div class=back-btn-con>
        <button class="back-btn" onclick="location.href='index.php'">
            Back to Home ➜ 
        </button>  
    </div>

<!-- Canvas overlay for drawing boxes -->
<canvas id="overlay" style="position:fixed;left:0;top:0;pointer-events:none;display:none"></canvas>

<script src="cpe-mrtd_main.js"></script>    

</body>
</html>