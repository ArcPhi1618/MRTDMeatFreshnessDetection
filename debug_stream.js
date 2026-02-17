/*
 * Stream Debug Helper
 * Copy and paste this into the browser console on the camera page to debug the stream
 * 
 * Usage:
 * 1. Open cpe-mrtd-main2.php
 * 2. Press F12 to open DevTools
 * 3. Go to Console tab
 * 4. Copy & paste everything below this line into the console
 * 5. Watch the output as frames load
 */

console.clear();
console.log('%c🔧 ESP32 Stream Debug Started', 'color: #00ff00; font-size: 16px; font-weight: bold;');

// Check initial state
console.log('%cInitial State:', 'color: #00d4ff; font-weight: bold;');
console.log('Camera element exists:', !!document.getElementById('cam'));
console.log('Camera is visible:', document.getElementById('cam')?.style.display !== 'none');
console.log('Current src:', document.getElementById('cam')?.src?.substring(0, 60) + '...');
console.log('Paused state:', window.paused);
console.log('Current camera mode:', window.currentCameraMode);

// Track frames
let debugFrameCount = 0;
let debugStartTime = Date.now();

// Patch the loadEsp32Frame function to track calls
const originalLoadEsp32Frame = window.loadEsp32Frame;
window.loadEsp32Frame = function() {
    debugFrameCount++;
    const elapsed = ((Date.now() - debugStartTime) / 1000).toFixed(1);
    const fps = (debugFrameCount / elapsed).toFixed(2);
    console.log(`%c[Frame ${debugFrameCount}] at ${elapsed}s (${fps} fps)`, 'color: #00ff00;');
    
    // Call original function
    return originalLoadEsp32Frame.call(this);
};

// Check interval
console.log('%cStream Interval Check:', 'color: #00d4ff; font-weight: bold;');
const checkInterval = setInterval(() => {
    if(window.__esp32FrameCount > 0) {
        clearInterval(checkInterval);
        console.log('%c✓ Stream is working!', 'color: #00aa00; font-size: 14px; font-weight: bold;');
        console.log('Frames loaded:', window.__esp32FrameCount);
    }
}, 3000);

// Set timeout to check after 5 seconds
setTimeout(() => {
    clearInterval(checkInterval);
    console.log('%cDebug Summary (after 5s):', 'color: #00d4ff; font-weight: bold;');
    console.log('Paused:', window.paused);
    console.log('Camera mode:', window.currentCameraMode);
    console.log('Frames tracked by patch:', debugFrameCount);
    console.log('Frames tracked by counter:', window.__esp32FrameCount || 0);
    
    if(debugFrameCount === 0 && window.__esp32FrameCount === 0) {
        console.log('%c⚠️ WARNING: No frames loaded!', 'color: #ff6600; font-weight: bold;');
        console.log('Possible issues:');
        console.log('1. ESP32 is offline or unreachable');
        console.log('2. Proxy script is failing');
        console.log('3. Network error');
        console.log('\nTry running: testStreamProxy()');
    } else {
        console.log('%c✓ Stream appears to be working', 'color: #00aa00; font-weight: bold;');
    }
}, 5000);

// Helper function to test proxy directly
window.testStreamProxy = async function() {
    console.log('%cTesting Proxy...', 'color: #00d4ff; font-weight: bold;');
    try {
        const url = 'esp32_camera_proxy.php?url=' + encodeURIComponent('http://192.168.4.2/capture?t=' + Date.now());
        console.log('Testing URL:', url);
        
        const response = await fetch(url, { cache: 'no-store' });
        console.log('Response status:', response.status);
        console.log('Response headers:', {
            contentType: response.headers.get('content-type'),
            contentLength: response.headers.get('content-length'),
            cacheControl: response.headers.get('cache-control')
        });
        
        const blob = await response.blob();
        console.log('Received blob:', blob.size, 'bytes');
        
        if(blob.size > 0) {
            console.log('%c✓ Proxy is working!', 'color: #00aa00; font-weight: bold;');
        }
    } catch(e) {
        console.error('%c✗ Proxy test failed:', 'color: #ff0000;', e.message);
    }
};

console.log('%cDebug helper ready! Check console in 5 seconds for results.', 'color: #ffaa00;');
console.log('%cOr run: testStreamProxy() to test the proxy directly', 'color: #ffaa00;');
