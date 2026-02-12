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


        <!-- =============================================================================================== -->
        <!-- Sidebar -->
        <!-- =============================================================================================== -->

        <div class="sidebar-l">
            <div class="sdb-upper">
                <a href="index.php" class="back-link"> 🡸 To Home </a>
            </div>

            <div class="model-lib">
                <div class="model-lib-header">
                    <p> Model Library </p>
                    <a href="#" class="upload-model-btn"> + Upload Model </a>
                </div>
                <div class="model-list">
                </div>
            </div>

            <div class="cam-selection">
                <div class="cam-selection-header"> 
                    <p> Camera Selection </p> 
                </div> 
                <button class="btn-esp32cam" id="backToEsp32Btn"> ESP32 Camera </button>
                <div class="cam-list"> 
                    <div id="ipCamInputDiv" style="margin-top: 10px;">
                        <label style="padding-left: 16px">IP Camera Stream URL:</label><br>
                        <input class="ipcamin" type="text" id="ipCamUrl" placeholder="e.g., 192.168.1.100:8080/video" style="margin-left: 16px;">
                        <button id="connectIpCamBtn">Connect IP Camera</button>
                        <div class="btn-ipcam" id="ipCamStatus"></div>
                    </div> 
                </div> 
            </div> 

            
        </div>



        <!-- =============================================================================================== -->
        <!-- Main -->
        <!-- =============================================================================================== -->

        <div class="main-content">
            wwwwwwwwwww
            <div class="cam-sec">
                <div id="camContainer" style="position:relative; display:inline-block; width:100%;">
                    <img id="cam" crossorigin="anonymous" style="display:block; width:100%;">
                    <div id="detectionOverlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.05); z-index:10;">
                        <img id="detectionImg" style="width:100%; height:100%; object-fit:contain;" alt="Detection Result">
                    </div>
                </div>
            </div>

            <div class="cam-stream-title"> 
                <p> Camera Stream </p>
                <div class="cam-stream-controls">
                    <button id="captureBtn">Capture & Detect</button>
                    <button onclick="resume()">Resume</button>
                </div>
            </div>




        </div>








    </div>

<script src="cpe-mrtd_main.js"></script> 
</body>
</html>