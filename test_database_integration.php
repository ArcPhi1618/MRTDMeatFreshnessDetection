<!DOCTYPE html>
<html>
<head>
    <title>Database Integration Test</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .test { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        .loading { background: #cce5ff; color: #004085; }
        #console { background: #000; color: #0f0; padding: 10px; margin-top: 20px; height: 200px; overflow-y: auto; font-family: monospace; }
    </style>
</head>
<body>
    <h1>Database Integration Test</h1>
    
    <div class="test loading" id="test-scripts">
        ⏳ Loading scripts...
    </div>
    
    <div class="test loading" id="test-database">
        ⏳ Checking database handler...
    </div>
    
    <div class="test loading" id="test-save">
        ⏳ Testing save function...
    </div>
    
    <h2>Console Output:</h2>
    <div id="console"></div>

    <!-- Include the same scripts as the main page -->
    <script src="capture_database.js"></script>
    <script>
        const consoleDom = document.getElementById('console');
        
        function log(msg) {
            consoleDom.innerHTML += msg + '<br>';
            consoleDom.scrollTop = consoleDom.scrollHeight;
            console.log(msg);
        }
        
        function updateTest(elementId, passed, message) {
            const elem = document.getElementById(elementId);
            elem.className = 'test ' + (passed ? 'pass' : 'fail');
            elem.innerHTML = (passed ? '✓' : '✗') + ' ' + message;
        }
        
        log('Initializing test...');
        
        // Test 1: Check if CaptureDatabase class is available
        try {
            log('Test 1: Checking CaptureDatabase class...');
            if (typeof CaptureDatabase !== 'undefined') {
                log('✓ CaptureDatabase class found');
                updateTest('test-scripts', true, 'capture_database.js loaded successfully');
            } else {
                log('✗ CaptureDatabase class not found');
                updateTest('test-scripts', false, 'capture_database.js failed to load');
            }
        } catch (e) {
            log('✗ Error: ' + e.message);
            updateTest('test-scripts', false, 'Error loading scripts: ' + e.message);
        }
        
        // Test 2: Try to instantiate CaptureDatabase
        try {
            log('Test 2: Instantiating CaptureDatabase...');
            const db = new CaptureDatabase();
            log('✓ CaptureDatabase instantiated');
            log('API endpoint: ' + db.apiEndpoint);
            updateTest('test-database', true, 'CaptureDatabase instantiated successfully');
            
            // Test 3: Try to save a test record
            log('Test 3: Attempting to save test record...');
            const testData = {
                imagePath: 'uploads/test_' + Date.now() + '.jpg',
                classDetected: 'Fresh Chicken',
                confidence: 0.95,
                modelName: 'test.onnx',
                sensorPpm: 25.5,
                storageCondition: null,
                notes: 'Test from database integration page'
            };
            
            log('Sending data: ' + JSON.stringify(testData));
            
            db.saveCapture(testData).then(result => {
                log('✓ Save successful!');
                log('Response: ' + JSON.stringify(result));
                updateTest('test-save', true, 'Database save successful - ID: ' + result.capture_id);
            }).catch(error => {
                log('✗ Save failed: ' + error.message);
                updateTest('test-save', false, 'Database save failed: ' + error.message);
            });
            
        } catch (e) {
            log('✗ Error: ' + e.message);
            updateTest('test-database', false, 'Error: ' + e.message);
            updateTest('test-save', false, 'Skipped due to error');
        }
    </script>
</body>
</html>
