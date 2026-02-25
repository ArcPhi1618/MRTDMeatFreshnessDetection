<?php
// API endpoint to get the currently active model from py-model_predict.py or py-onnx_predict.py

/**
 * Extract MODEL_PATH value from a Python file
 */
function getModelPathFromFile($pyFile) {
    if (!file_exists($pyFile)) {
        return null;
    }
    
    $lines = file($pyFile, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        return null;
    }
    
    foreach ($lines as $line) {
        // Look for line containing MODEL_PATH assignment
        if (strpos($line, 'MODEL_PATH') !== false && strpos($line, '=') !== false && strpos($line, 'os.path.join') !== false) {
            // Extract the quoted string between the last pair of quotes
            // Pattern: os.path.join(BASE, "something", "filename")
            if (preg_match('/"([^"]+)"\s*\)/', $line, $matches)) {
                return $matches[1]; // Return the filename (last quoted part)
            }
        }
    }
    
    return null;
}

header('Content-Type: application/json');

// Check if ONNX model is in models/ directory
$onnxModel = getModelPathFromFile(__DIR__ . '/py-onnx_predict.py');
if ($onnxModel && file_exists(__DIR__ . '/models/' . $onnxModel)) {
    error_log('[GET_CURRENT_MODEL] Detected ONNX model in models/: ' . $onnxModel);
    echo json_encode(['status' => 'ok', 'model' => $onnxModel]);
    exit;
}

// Check PyTorch model
$ptModel = getModelPathFromFile(__DIR__ . '/py-pt_predict.py');
if ($ptModel && file_exists(__DIR__ . '/models/' . $ptModel)) {
    error_log('[GET_CURRENT_MODEL] Detected PyTorch model in models/: ' . $ptModel);
    echo json_encode(['status' => 'ok', 'model' => $ptModel]);
    exit;
}

// Check Keras model
$kerasModel = getModelPathFromFile(__DIR__ . '/py-keras_predict.py');
if ($kerasModel && file_exists(__DIR__ . '/models/' . $kerasModel)) {
    error_log('[GET_CURRENT_MODEL] Detected Keras model in models/: ' . $kerasModel);
    echo json_encode(['status' => 'ok', 'model' => $kerasModel]);
    exit;
}

// Fallback to py-model_predict.py for backward compatibility
$regularModel = getModelPathFromFile(__DIR__ . '/py-model_predict.py');
if ($regularModel && file_exists(__DIR__ . '/models/' . $regularModel)) {
    error_log('[GET_CURRENT_MODEL] Detected regular model: ' . $regularModel);
    echo json_encode(['status' => 'ok', 'model' => $regularModel]);
    exit;
}

// Fallback (try to find best.onnx as default)
if (file_exists(__DIR__ . '/models/best.onnx')) {
    error_log('[GET_CURRENT_MODEL] Using default best.onnx');
    echo json_encode(['status' => 'ok', 'model' => 'best.onnx']);
    exit;
}

error_log('[GET_CURRENT_MODEL] No model found, returning fallback');
echo json_encode(['status' => 'ok', 'model' => 'cpe-mfmrtd-03.pt']);
?>

