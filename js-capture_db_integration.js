// Database Integration for CPE MRTD System
// This integrates the capture database saving with the detection system

// Global variables to track current capture state
let lastCaptureData = {
    imagePath: null,
    predictions: [],
    modelName: 'unknown',
    sensorPpm: null,
    timestamp: null
};

let currentSensorReading = {
    ppm: null,
    adc: null,
    voltage: null,
    ratio: null
};

/**
 * Update sensor reading (called from the main MQ-137 fetch)
 */
function updateSensorReading(data) {
    if (data && data.nh3_ppm !== undefined) {
        currentSensorReading.ppm = data.nh3_ppm;
        currentSensorReading.adc = data.adc;
        currentSensorReading.voltage = data.voltage;
        currentSensorReading.ratio = data.ratio;
    }
}

/**
 * Get the current model name from the model library
 */
function getCurrentModelName() {
    try {
        const modelList = document.querySelector('.model-list');
        if (modelList) {
            // Look for the selected/active model
            const activeModel = modelList.querySelector('li.active') || modelList.querySelector('li');
            if (activeModel) {
                return activeModel.textContent.trim();
            }
        }
    } catch (e) {
        console.warn('Could not determine model name:', e);
    }
    return 'unknown_model';
}

/**
 * Enhanced renderPredictions that also saves to database
 * This replaces the original renderPredictions function
 */
function renderPredictionsWithDB(preds, imagePath = null) {
    // Store prediction data for later database save
    lastCaptureData.predictions = preds || [];
    lastCaptureData.imagePath = imagePath;
    lastCaptureData.modelName = getCurrentModelName();
    lastCaptureData.sensorPpm = currentSensorReading.ppm;
    lastCaptureData.timestamp = new Date();

    // Render predictions to UI (original behavior)
    const predDiv = document.getElementById('prediction');
    if (predDiv) {
        predDiv.innerHTML = "";
        if (!preds || preds.length === 0) {
            predDiv.innerText = "No detections";
            return;
        }
        const ul = document.createElement("ul");
        preds.forEach(p => {
            const li = document.createElement("li");
            li.innerText = `${p.name} — ${(p.conf * 100).toFixed(1)}%`;
            ul.appendChild(li);
        });
        predDiv.appendChild(ul);
    }

    // Save to database if we have predictions (silently, without showing messages)
    if (preds && preds.length > 0 && lastCaptureData.imagePath) {
        saveDetectionToDatabase();
    }
}

/**
 * Save the current detection to the database
 */
async function saveDetectionToDatabase() {
    try {
        // Verify captureDB is available
        if (typeof captureDB === 'undefined') {
            console.error('[DB Integration] captureDB not loaded. Make sure capture_database.js is included.');
            return;
        }

        // Get the first prediction (highest confidence)
        const firstPred = lastCaptureData.predictions[0];
        if (!firstPred) {
            console.warn('[DB Integration] No predictions to save');
            return;
        }

        // Get storage condition from selector if available
        const storageConditionSelect = document.getElementById('freshnessSelection');
        const storageCondition = storageConditionSelect ? storageConditionSelect.value : null;

        // Prepare capture data
        const captureData = {
            imagePath: lastCaptureData.imagePath,
            classDetected: firstPred.name,
            confidence: firstPred.conf,
            modelName: lastCaptureData.modelName,
            sensorPpm: currentSensorReading.ppm,
            storageCondition: storageCondition,
            notes: `Detection taken at ${lastCaptureData.timestamp.toLocaleString()}`
        };

        console.log('[DB Integration] Saving capture to database:', captureData);

        // Call the database function
        const result = await captureDB.saveCapture(captureData);
        
        console.log('[DB Integration] Capture saved successfully. ID:', result.capture_id);
        // No UI messages - keep prediction div clean with just the detection results

    } catch (error) {
        console.error('[DB Integration] Error saving to database:', error);
        // No UI messages - keep prediction div clean with just the detection results
    }
}

/**
 * Initialize the database integration
 * Call this after the page loads
 */
function initializeDatabaseIntegration() {
    console.log('[DB Integration] Initializing...');

    // Hook into the MQ-137 fetch updates
    const originalFetchMQ137WithUrl = window.fetchMQ137WithUrl;
    window.fetchMQ137WithUrl = function(url) {
        const originalThen = fetch(url).then;
        
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                // Update our sensor reading
                updateSensorReading(data);
                
                // Also update the UI (original behavior)
                const mqDiv = document.getElementById('mq137Data');
                if (mqDiv) {
                    mqDiv.innerHTML = `
                        <ul>
                            <li>ADC Value: ${data.adc}</li>
                            <li>Voltage: ${data.voltage.toFixed(3)} V</li>
                            <li>Rs/Ro Ratio: ${data.ratio.toFixed(3)}</li>
                            <li>NH3 Concentration: ${data.nh3_ppm.toFixed(1)} ppm</li>
                        </ul>
                    `;
                }
            })
            .catch(err => {
                if (url === "http://192.168.4.1/mq137") {
                    console.warn('Direct connection to ESP32 failed, trying PHP proxy...');
                    fetchMQ137WithUrl("mq137_proxy.php");
                } else {
                    const mqDiv = document.getElementById('mq137Data');
                    if (mqDiv) {
                        mqDiv.innerHTML = `<strong>Error:</strong> ${err.message}<br/>Make sure ESP32 is online and connected.`;
                    }
                    console.error('MQ137 fetch error:', err);
                }
            });
    };

    console.log('[DB Integration] Initialized successfully');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDatabaseIntegration);
} else {
    initializeDatabaseIntegration();
}
