<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <link rel="stylesheet" href="mainv2.css">
</head>

<style>
</style>

<body>
    <div class="main">

        <div class="sidebar-l">
            <div class="sdb-upper">
                <a href="index.php" class="back-link"> 🡸 To Home </a>
            </div>

            <div class="model-lib">
                <div class="model-lib-header">
                    <p> Model Library </p>
                    <label for="modelUpload" class="upload-model-btn" style="cursor:pointer;"> + Upload Model </label>
                    <input type="file" id="modelUpload" accept=".pt,.h5,.keras,.onnx" style="display:none;" />
                </div>
                <div class="model-list" style="; border-radius:3px; padding:10px;">
                </div>
                <div class="model-lib-footer">
                    <p id="uploadStatus" style="margin:5px 0; min-height:20px;"></p>
                </div>
            </div>

            <div class="cam-selection">
                <div class="cam-selection-header">
                    <p> Camera Selection </p>
                </div>
                <div class="cam-config">
                    <h4>IP Camera Configuration</h4>
                <div class="ipcamindiv" id="ipCamInputDiv" style="display: block !important;">
                        <label>IP Camera Stream URL:</label><br>
                        <input class="ipcamin" type="text" id="ipCamUrl" placeholder="192.168.x.x:8080">
                        <div style="margin-top: 10px;">
                            <button id="connectIpCamBtn">Connect IP Camera</button>
                            <button id="backToEsp32Btn">Back to ESP32</button>
                        </div>
                        <div id="ipCamStatus" style="margin-top: 10px; color: #666; font-size: 14px;">
                        </div>
                    </div>
                </div>
            </div>
        </div>



        <!-- ============================================================ -->
        <!-- MAIN CONTENT AREA -->
        <!-- ============================================================ -->



        <div class="main-content">
            <div class="cam-sec" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#000;">
                <img id="esp32StreamImg" src="http://192.168.4.2:81/stream" alt="ESP32-CAM Stream" style="width:100%;height:100%;object-fit:cover;display:block;border:2px solid #0f0;background:#000;">
            </div>

            <div class="cam-stream-title"> 
                <p> Camera Stream </p>
                <div class="cam-stream-controls">
                    <button id="captureBtn">Capture & Detect</button>
                    <button onclick="resume()">Resume</button>
                    <button id="uploadPhotoBtn">📁 Upload Photo</button>
                    <input type="file" id="photoUploadInput" accept="image/*" style="display:none;" />
                </div>
            </div>

            <!-- REQUIRED by JS: confidence slider -->
            <div class="threshold-control" style="background:#f5f5f5; padding:15px; border-radius:5px; margin:10px 0; color=black;">
              <div style="display:flex; align-items:center; gap:15px;">
                <label class=""style="font-weight:bold; min-width:120px; color:#000000;">Confidence Threshold:</label>
                <input type="range" id="conf" min="1" max="100" value="50" style="flex:1; cursor:pointer;">
                <span id="confVal" style="font-weight:bold; min-width:50px; text-align:right; color:#000000;">50%</span>
              </div>
            </div>

            <div class="selection-sec">
                <label for="freshnessSelection" style="display: block; margin-bottom: 10px; font-weight: bold;">Select Storage Conditon: </label>
                <select id="freshnessSelection" style="font-size:1rem; padding: 10px; border-radius: 5px; border: 1px solid #ccc; width: 100%; max-width: 300px; cursor: pointer;">
                    <option value="">-- Select Status --</option>
                    <option value="below4"> 4.0 °C or below ( ≤ 4.0 °C) </option>
                    <option value="neg18"> Freezer Temperature (−18.0 °C) </option>
                    <option value="above4"> Above 4.0 °C (> 4.0 °C)</option>
                </select>
                <div id="selectionOutput" style="margin-top: 15px; padding: 12px; border-radius: 5px; font-weight: 500; min-height: 20px;"></div>
            </div>

            <div class="sensor-sec">
                <h3>MQ-137 Sensor Readings</h3>
                 <div id="mq137Data">
                    <div id="mq137Values">Loading...</div>
                </div>
            </div>

            <div class="back-btn-con" style="display:none;">
                <button class="back-btn" onclick="location.href='index.php'">
                    Back to Home ➜ 
                </button>  
            </div>
        </div>

        <div id="prediction" style="margin-left: 20px">
            Prediction: <span id="predictionResult">N/A</span>
        </div>

    </div>

    <canvas id="captureCanvas" style="display:none;"></canvas>
    <canvas id="overlay" style="position:fixed;left:0;top:0;pointer-events:none;display:none"></canvas>

    <script src="js-capture_database.js"></script>
    <script src="js-capture_db_integration.js"></script>

    <!-- MUST be before cpe-mrtd_main.js -->
    <script src="js-cpe-model-handler.js"></script>

    <script src="cpe-mrtd_main.js"></script>
    <script src="js-cpe-selection-handler.js"></script>



    <script>
      // (optional) place page-specific JS here
    </script>
</body>
</html>
