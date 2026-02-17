# ESP32 Camera - Complete Debugging Guide

## Issues Found & Fixed

### 1. **Frame Counter Logic Error**
- **Problem**: The frame counter was being completely reset every 2 seconds, making it impossible to track total frames
- **Fix**: Split into two counters:
  - `__esp32TotalFrameCount` - tracks all frames ever loaded
  - `__esp32FramesIn2s` - tracks frames in the last 2 seconds (then resets)
- **Location**: `js-cpe-mrtd_main.js` lines ~418-433

### 2. **Lazy Loading Attribute**
- **Problem**: `loading="lazy"` on the image element delays image rendering
- **Fix**: Removed the `loading="lazy"` attribute
- **Location**: `cpe-mrtd-main2.php` line 88

### 3. **All Syntax Verified**
✓ `getElementById()` calls - all correct  
✓ Function definitions - all correct  
✓ Proxy URL building - correct  
✓ Promise chains - correct  
✓ Event listeners - correct  
✓ HTML image tag - correctly closed  
✓ Script tag order - correct  

---

## Testing Steps (In Order)

### Step 1: Test HTML Elements
**Go to**: `http://localhost/MRTDMeatFreshnessDetection/full_diagnostic.html`  
**Click**: "Check DOM Elements"  
**Look for**:
- ✓ Camera element found
- ✓ Capture button found
- ✓ Overlay canvas found

**If any are missing**: The HTML file might have syntax errors or missing elements.

### Step 2: Test JavaScript Initialization
**Same page, click**: "Check JS Initialization"  
**Look for**:
- ✓ ESP32_CAM_URL defined
- ✓ buildEsp32ProxyUrl function exists
- ✓ loadEsp32Frame function exists
- ✓ startStream function exists

**If any fail**: The JavaScript file might have loading issues.

### Step 3: Test Proxy Connection
**Same page, click**: "Test ESP32 Proxy"  
**Look for**:
- ✓ Proxy responded successfully!
- ✓ Is JPEG: YES

**If proxy fails**:
- Check if `esp32_camera_proxy.php` file exists
- Check if ESP32 is online at `192.168.4.2`
- Check the proxy log: `esp32_proxy_debug.log`

### Step 4: Test Direct ESP32
**Same page, click**: "Test Direct ESP32"  
**Expected**: Will fail with CORS error (that's OK!)  
**This confirms**: We need the proxy (which we have)

### Step 5: Monitor Live Stream
**Same page, click**: "Start Monitoring Frames"  
**Look for**: Frame counter incrementing  
**Expected output**:
```
Total: 1 | Last 2s: 1
Total: 2 | Last 2s: 2
Total: 3 | Last 2s: 3
...
```

**If frames are incrementing**:
- ✓ Stream is working!
- Go to main page and check if images are displaying

**If no frames load**:
- Check proxy connection (Step 3)
- Check ESP32 is online
- Check console for errors (F12)

### Step 6: Check Window Variables
**Same page, click**: "Check Window Variables"  
**Look for**:
- Total frames > 0
- Last 2s frames > 0

---

## Quick Standalone Test (No Dependencies)

**Go to**: `http://localhost/MRTDMeatFreshnessDetection/minimal_test.html`

This page has everything built-in and doesn't rely on any external files.

**Click**: "Load Single Frame"  
**Expected**: Image appears showing current ESP32 frame  

**Click**: "Start Live Stream"  
**Expected**: Image updates every 500ms with new frames

**Look for in Status Box**:
```
[time] Loading single frame...
[time] Proxy URL: esp32_camera_proxy.php?url=...
[time] Received: 12345 bytes
[time] Valid JPEG image detected ✓
[time] Image displayed on screen
```

---

## Browser Console Debugging (F12)

Open the camera page and press **F12**. In console, you should see:

```javascript
// Initialization logs
[Init] Page loaded, initializing ESP32 camera...
[Init] Camera element found: true
[Init] Starting stream after DOM ready...
[Stream] Starting stream, mode: esp32
[Stream] Loading initial frame...

// Frame logs (should appear every 500ms)
[ESP32 Frame] Frame #1 loaded, size: 12345 bytes
[ESP32 Frame] Frame #2 loaded, size: 12300 bytes
[ESP32 Frame] Frame #3 loaded, size: 12350 bytes

// Every 2 seconds
[Frame Monitor] Total frames: 4 | Last 2s: 4
```

**If you see errors**:
1. Copy the error message
2. Check which function is failing
3. Use the testing steps above to isolate the issue

---

## Syntax Verification Checklist

### JavaScript (js-cpe-mrtd_main.js)
- [x] Line 2: `const cam = document.getElementById("cam");` ✓
- [x] Line 176: `const ESP32_CAM_URL = "http://192.168.4.2/capture";` ✓
- [x] Line 183-188: `function buildEsp32ProxyUrl(addTimestamp = true)` ✓
- [x] Line 302-339: `function startStream()` ✓
- [x] Line 344-388: `function loadEsp32Frame()` ✓
- [x] Line 418-433: Frame counter and initialization ✓

### HTML (cpe-mrtd-main2.php)
- [x] Line 88: Image element with id="cam" ✓
- [x] Image has proper closing (not self-closed) ✓
- [x] `loading="lazy"` attribute removed ✓
- [x] Script tags at bottom (correct order) ✓

### PHP (esp32_camera_proxy.php)
- [x] Headers set before output ✓
- [x] URL validation ✓
- [x] JPEG magic bytes check ✓
- [x] Error handling ✓

---

## If Camera Still Not Showing

### Scenario 1: Proxy Works, But Camera Doesn't Update
- Stream is loading frames (check console logs)
- But image doesn't update on the actual page
- **Solution**: Try `minimal_test.html` - if it works there, the issue is with the full page setup

### Scenario 2: Proxy Fails
- Error: "Unable to fetch from ESP32"
- **Check**:
  - Is ESP32 on? Ping `192.168.4.2`
  - Is ESP32 on the same network?
  - Try accessing directly: `http://192.168.4.2/capture` (in another browser, should show image)
  - Check `esp32_proxy_debug.log` file for error details

### Scenario 3: No Errors But Still Blank
- Console shows frame logs but image is blank
- **Check**:
  - Browser might be blocking blob URL creation
  - Try refreshing the page
  - Clear browser cache (Ctrl+Shift+Delete)
  - Try different browser
  - Check if `object-fit: contain` CSS is being applied

### Scenario 4: Frames Stock at 1
- Only 1 frame loads, then nothing
- Interval might not be running
- **Check**:
  - `window.streamInterval` should be a number (interval ID)
  - `window.paused` should be `false`
  - Check for JavaScript errors in console

---

## Contact Points for Issues

### If proxy fails: Check `esp32_camera_proxy.php`
### If initialization fails: Check `js-cpe-mrtd_main.js` lines 1-70
### If DOM issues: Check `cpe-mrtd-main2.php` lines 85-110
### If stream doesn't start: Check `js-cpe-mrtd_main.js` lines 302-339

---

## Quick Commands for Console Testing

```javascript
// Check if stream is running
console.log('Frame count:', window.__esp32TotalFrameCount)
console.log('Paused:', window.paused)
console.log('Interval ID:', window.streamInterval)

// Force load a frame
window.loadEsp32Frame()

// Stop/start stream
window.paused = true
window.paused = false
window.startStream()

// Check proxy
fetch('esp32_camera_proxy.php?url=' + encodeURIComponent('http://192.168.4.2/capture?t=' + Date.now()))
    .then(r => r.blob())
    .then(b => console.log('Blob size:', b.size))
```
