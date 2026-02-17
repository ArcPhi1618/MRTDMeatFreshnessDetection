<?php
/**
 * ESP32 Camera Debug Page
 * Tests the ESP32 camera connection and proxy
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESP32 Camera Debug</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
        }
        .test-section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
        }
        .test-section h2 {
            margin-top: 0;
            color: #555;
            font-size: 1.1em;
        }
        button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #0056b3;
        }
        .status {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .camera-test {
            border: 2px solid #ddd;
            background: #000;
            max-width: 800px;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        .camera-test img {
            width: 100%;
            height: auto;
            display: block;
        }
        input[type="text"], input[type="number"], select {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
            margin: 5px 0;
            width: 100%;
            max-width: 500px;
        }
        .log {
            background: #222;
            color: #0f0;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .log-entry {
            margin: 2px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 ESP32 Camera Debug Tool</h1>
        
        <div class="test-section">
            <h2>1. Direct ESP32 Connection Test</h2>
            <p>Tests direct connection to ESP32 (may fail due to CORS if not on same network)</p>
            <input type="text" id="esp32Url" value="http://192.168.4.2/capture" placeholder="ESP32 URL">
            <button onclick="testDirectConnection()">Test Direct Connection</button>
            <div id="directStatus" class="status"></div>
            <div id="directImage" class="camera-test" style="display:none;">
                <img id="directImg" alt="Direct ESP32 test">
            </div>
        </div>

        <div class="test-section">
            <h2>2. Proxy Connection Test</h2>
            <p>Tests the proxy PHP script (should work even on different networks)</p>
            <button onclick="testProxyConnection()">Test Proxy Connection</button>
            <div id="proxyStatus" class="status"></div>
            <div id="proxyImage" class="camera-test" style="display:none;">
                <img id="proxyImg" alt="Proxy test">
            </div>
        </div>

        <div class="test-section">
            <h2>3. Stream Test (Proxy)</h2>
            <p>Continuously updates image from proxy every 500ms</p>
            <button id="streamBtn" onclick="startStreamTest()">Start Stream Test</button>
            <button id="stopStreamBtn" onclick="stopStreamTest()" style="display:none; background:#dc3545;">Stop Stream Test</button>
            <div id="streamStatus" class="status"></div>
            <div id="streamImage" class="camera-test" style="display:none;">
                <img id="streamImg" alt="Stream test">
            </div>
        </div>

        <div class="test-section">
            <h2>4. Proxy Debug Log</h2>
            <p>Check the server-side proxy log file</p>
            <button onclick="checkProxyLog()">Check Proxy Log</button>
            <button onclick="clearProxyLog()">Clear Proxy Log</button>
            <div id="logStatus" class="status"></div>
            <div id="proxyLog" class="log"></div>
        </div>

        <div class="test-section">
            <h2>5. Configuration</h2>
            <p>Current configuration values</p>
            <div id="configDisplay" style="font-family: monospace; white-space: pre-wrap; background: #f9f9f9; padding: 10px; border-radius: 4px;"></div>
        </div>
    </div>

    <script>
        const ESP32_URL = 'http://192.168.4.2/capture';
        let streamInterval = null;
        let frameCount = 0;

        function log(elementId, message, type = 'info') {
            const el = document.getElementById(elementId);
            const className = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
            el.className = `status ${className}`;
            el.innerHTML = message.replace(/\n/g, '<br>');
        }

        function logStream(message) {
            const el = document.getElementById('proxyLog');
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
            el.appendChild(entry);
            el.scrollTop = el.scrollHeight;
        }

        async function testDirectConnection() {
            const url = document.getElementById('esp32Url').value || ESP32_URL;
            log('directStatus', 'Testing direct connection to: ' + url + '...', 'info');
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors'
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    document.getElementById('directImg').src = objectUrl;
                    document.getElementById('directImage').style.display = 'block';
                    log('directStatus', '✓ Direct connection successful!\nImage size: ' + blob.size + ' bytes', 'success');
                } else {
                    log('directStatus', '✗ Connection failed with status: ' + response.status, 'error');
                }
            } catch (e) {
                log('directStatus', '✗ Direct connection failed (expected for CORS): ' + e.message + '\nTry using the Proxy test below.', 'error');
            }
        }

        async function testProxyConnection() {
            const url = 'esp32_camera_proxy.php?url=' + encodeURIComponent(ESP32_URL + '?t=' + Date.now());
            log('proxyStatus', 'Testing proxy connection: ' + url + '...', 'info');
            
            try {
                const response = await fetch(url);
                
                if (response.ok) {
                    const blob = await response.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    document.getElementById('proxyImg').src = objectUrl;
                    document.getElementById('proxyImage').style.display = 'block';
                    log('proxyStatus', '✓ Proxy connection successful!\nImage size: ' + blob.size + ' bytes\nContent-Type: ' + response.headers.get('content-type'), 'success');
                } else {
                    log('proxyStatus', '✗ Proxy connection failed with status: ' + response.status + '\n' + await response.text(), 'error');
                }
            } catch (e) {
                log('proxyStatus', '✗ Proxy connection failed:\n' + e.message, 'error');
            }
        }

        function startStreamTest() {
            frameCount = 0;
            document.getElementById('streamBtn').style.display = 'none';
            document.getElementById('stopStreamBtn').style.display = 'inline';
            document.getElementById('streamImage').style.display = 'block';
            log('streamStatus', 'Starting stream test... (0 frames loaded)', 'info');

            streamInterval = setInterval(() => {
                const url = 'esp32_camera_proxy.php?url=' + encodeURIComponent(ESP32_URL + '?t=' + Date.now());
                
                fetch(url)
                    .then(r => r.blob())
                    .then(blob => {
                        const objectUrl = URL.createObjectURL(blob);
                        document.getElementById('streamImg').src = objectUrl;
                        frameCount++;
                        log('streamStatus', '✓ Stream running - ' + frameCount + ' frames loaded', 'success');
                    })
                    .catch(e => {
                        log('streamStatus', '✗ Stream error: ' + e.message, 'error');
                    });
            }, 500);
        }

        function stopStreamTest() {
            if (streamInterval) clearInterval(streamInterval);
            document.getElementById('streamBtn').style.display = 'inline';
            document.getElementById('stopStreamBtn').style.display = 'none';
            log('streamStatus', '⏹ Stream stopped after ' + frameCount + ' frames', 'info');
        }

        async function checkProxyLog() {
            try {
                const response = await fetch('get_proxy_log.php');
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('proxyLog').innerHTML = '';
                    data.log.split('\n').forEach(line => {
                        if (line.trim()) logStream(line);
                    });
                    log('logStatus', '✓ Proxy log retrieved (' + data.lines + ' lines)', 'success');
                } else {
                    log('logStatus', '✗ ' + data.message, 'error');
                }
            } catch (e) {
                log('logStatus', '✗ Failed to fetch log: ' + e.message, 'error');
            }
        }

        function clearProxyLog() {
            if (confirm('Clear the proxy log file?')) {
                fetch('clear_proxy_log.php')
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            document.getElementById('proxyLog').innerHTML = '';
                            log('logStatus', '✓ Proxy log cleared', 'success');
                        } else {
                            log('logStatus', '✗ ' + data.message, 'error');
                        }
                    })
                    .catch(e => log('logStatus', '✗ Failed: ' + e.message, 'error'));
            }
        }

        function displayConfig() {
            const config = `ESP32 Configuration
================================
Base URL:             ${ESP32_URL}
Proxy Endpoint:       esp32_camera_proxy.php
Proxy Log File:       esp32_proxy_debug.log
Stream Interval:      500ms
Default Timeout:      5 seconds

ESP32-CAM Endpoints
================================
Live Capture:         ${ESP32_URL}
Control:              ${ESP32_URL.replace('/capture', '/control')}
Quality Parameter:    ?var=quality&val=4
Brightness:           ?var=brightness&val=-2
Contrast:             ?var=contrast&val=-1
Saturation:           ?var=saturation&val=1`;

            document.getElementById('configDisplay').textContent = config;
        }

        // Initialize on load
        window.addEventListener('load', () => {
            displayConfig();
        });
    </script>
</body>
</html>
