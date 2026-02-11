<!DOCTYPE html>
<html>
<head>
    <title>IP Camera Connection Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; }
        .test-box { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        input { width: 100%; padding: 10px; margin: 10px 0; font-size: 14px; }
        button { background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; font-size: 14px; }
        button:hover { background: #0052a3; }
        .result { margin-top: 20px; padding: 15px; border-radius: 3px; display: none; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; display: block; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; display: block; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; display: block; }
        .loading { background: #e7d4f5; color: #5a378a; border: 1px solid #d6c2e0; display: block; }
        img { max-width: 100%; height: auto; margin-top: 10px; border: 2px solid #ccc; }
        pre { background: #f8f9fa; padding: 10px; overflow-x: auto; font-size: 12px; }
        h2 { color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>IP Camera Connection Tester</h1>
        
        <div class="test-box">
            <h2>1. Test Camera URL Accessibility</h2>
            <input type="text" id="camUrl" placeholder="Enter camera URL (e.g., 192.168.1.100:8080/video)" value="">
            <button onclick="testDirect()">Test Direct Connection</button>
            <div id="directResult"></div>
        </div>

        <div class="test-box">
            <h2>2. Test via PHP Proxy</h2>
            <button onclick="testProxy()" disabled id="proxyBtn">Test via Proxy</button>
            <div id="proxyResult"></div>
        </div>

        <div class="test-box">
            <h2>3. Live Preview</h2>
            <button onclick="startLivePreview()" id="liveBtn">Start Live Preview</button>
            <div id="liveResult"></div>
            <video id="liveVideo" style="border: 2px solid #ccc; width: 100%; margin-top: 10px; max-height: 600px; background-color: #000;" controls></video>
        </div>
    </div>

    <script>
        let proxyUrl = '';

        function testDirect() {
            const url = document.getElementById('camUrl').value.trim();
            if (!url) {
                showResult('directResult', 'Please enter a camera URL', 'error');
                return;
            }

            let fullUrl = url;
            if (!fullUrl.match(/^https?:\/\//i)) {
                fullUrl = 'http://' + fullUrl;
            }

            showResult('directResult', 'Testing direct connection to: ' + fullUrl, 'loading');

            const img = new Image();
            const timeout = setTimeout(() => {
                showResult('directResult', 'Connection timed out (>5s). Try using the proxy.', 'error');
            }, 5000);

            img.onload = () => {
                clearTimeout(timeout);
                showResult('directResult', 'Direct connection successful!', 'success');
                document.getElementById('proxyBtn').disabled = false;
                setupProxy(fullUrl);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                showResult('directResult', 'Direct connection failed. Will try proxy.', 'error');
                document.getElementById('proxyBtn').disabled = false;
                setupProxy(fullUrl);
            };

            img.src = fullUrl;
        }

        function setupProxy(url) {
            const result = document.getElementById('directResult');
            const msg = document.createElement('p');
            msg.innerText = 'Setting up proxy...';
            result.appendChild(msg);

            fetch('cpe-ipcam_proxy.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url: url})
            })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'ok') {
                    proxyUrl = data.proxy_url;
                    msg.innerText = 'Proxy URL: ' + proxyUrl;
                    msg.style.color = 'green';
                } else {
                    throw new Error(data.message);
                }
            })
            .catch(err => {
                msg.innerText = 'Proxy setup failed: ' + err.message;
                msg.style.color = 'red';
            });
        }

        function testProxy() {
            if (!proxyUrl) {
                showResult('proxyResult', 'Run test direct first', 'error');
                return;
            }

            showResult('proxyResult', 'Testing proxy connection...', 'loading');

            const img = new Image();
            const timeout = setTimeout(() => {
                showResult('proxyResult', 'Proxy connection timed out', 'error');
            }, 10000);

            img.onload = () => {
                clearTimeout(timeout);
                showResult('proxyResult', 'Proxy connection successful! Image size: ' + img.width + 'x' + img.height, 'success');
            };

            img.onerror = () => {
                clearTimeout(timeout);
                showResult('proxyResult', 'Proxy failed to load image', 'error');
            };

            img.src = proxyUrl + '?t=' + Date.now();
        }

        function startLivePreview() {
            if (!proxyUrl) {
                showResult('liveResult', 'Run tests first to configure proxy', 'error');
                return;
            }

            showResult('liveResult', 'Starting live preview...', 'loading');
            const video = document.getElementById('liveVideo');
            
            video.src = proxyUrl;
            video.play().then(() => {
                showResult('liveResult', 'Live preview active', 'success');
            }).catch(e => {
                showResult('liveResult', 'Playback error: ' + e.message, 'error');
                console.warn('Video playback error:', e);
            });
        }

        function showResult(elementId, message, type) {
            const el = document.getElementById(elementId);
            el.className = 'result ' + type;
            el.innerText = message;
        }

        // Auto-fill from URL param
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('url')) {
            document.getElementById('camUrl').value = urlParams.get('url');
        }
    </script>
</body>
</html>
