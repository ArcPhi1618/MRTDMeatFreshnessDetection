<?php
// Always return JSON for errors
function send_json_error($msg, $extra = []) {
    $out = ['status' => 'error', 'message' => $msg];
    if (!empty($extra)) $out = array_merge($out, $extra);
    error_log('[SET_MODEL_ERROR] ' . $msg . ' ' . json_encode($extra));
    header('Content-Type: application/json');
    echo json_encode($out);
    exit;
}

/**
 * Update MODEL_PATH in a Python file more robustly
 * Handles the line regardless of whitespace/formatting
 */
function updateModelPath($pyFile, $newPath) {
    if (!file_exists($pyFile)) {
        error_log('[SET_MODEL] File not found: ' . $pyFile);
        return false;
    }
    
    $lines = file($pyFile, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        error_log('[SET_MODEL] Failed to read file: ' . $pyFile);
        return false;
    }
    
    $updated = false;
    foreach ($lines as $i => $line) {
        // Check if this line contains MODEL_PATH assignment
        if (strpos($line, 'MODEL_PATH') !== false && strpos($line, '=') !== false && strpos($line, 'os.path.join') !== false) {
            // Extract the indentation from the original line
            $indent = '';
            for ($j = 0; $j < strlen($line); $j++) {
                if ($line[$j] === ' ' || $line[$j] === '\t') {
                    $indent .= $line[$j];
                } else {
                    break;
                }
            }
            $lines[$i] = $indent . $newPath;
            error_log('[SET_MODEL] Updated line ' . ($i+1) . ' in ' . $pyFile);
            $updated = true;
            break;
        }
    }
    
    if (!$updated) {
        error_log('[SET_MODEL] Could not find MODEL_PATH line in ' . $pyFile);
        return false;
    }
    
    $newContent = implode("\n", $lines) . "\n";
    $result = file_put_contents($pyFile, $newContent);
    
    if ($result === false) {
        error_log('[SET_MODEL] Failed to write to ' . $pyFile);
        return false;
    }
    
    error_log('[SET_MODEL] Successfully wrote to ' . $pyFile);
    return true;
}

// API endpoint to set the active model
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $modelName = $input['model'] ?? null;
    
    if (!$modelName) {
        send_json_error('No model specified');
    }

    // Allow model names with 'models/' prefix or without
    $cleanModelName = $modelName;
    if (strpos($modelName, 'models/') === 0) {
        $cleanModelName = substr($modelName, 7);
    }
    
    // Validate model name - prevent path traversal
    if (strpos($cleanModelName, '..') !== false || strpos($cleanModelName, '/') !== false || strpos($cleanModelName, '\\') !== false) {
        send_json_error('Invalid model name', ['model'=>$cleanModelName]);
    }
    
    $modelPath = __DIR__ . '/models/' . $cleanModelName;
    $modelName = $cleanModelName;
    
    if (!file_exists($modelPath)) {
        send_json_error('Model file not found', ['model'=>$modelName, 'path'=>$modelPath]);
    }

    error_log('[SET_MODEL] Model file exists: ' . $modelPath);

    // Check file extension to determine which Python file to update
    $ext = strtolower(pathinfo($modelName, PATHINFO_EXTENSION));
    
    if ($ext === 'onnx') {
        // Update py-onnx_predict.py for ONNX models
        $pyFile = __DIR__ . '/py-onnx_predict.py';
        $newPath = 'MODEL_PATH = os.path.join(BASE, "models", "' . $modelName . '")';
        
        if (!updateModelPath($pyFile, $newPath)) {
            send_json_error('Could not update ONNX model path', ['model'=>$modelName, 'file'=>$pyFile]);
        }
        
        error_log('[SET_MODEL] ONNX model changed to: ' . $modelName);
        echo json_encode(['status' => 'ok', 'message' => 'ONNX model changed to ' . $modelName]);
        exit;
    } elseif ($ext === 'pt') {
        // Update py-pt_predict.py for PyTorch models
        $pyFile = __DIR__ . '/py-pt_predict.py';
        $newPath = 'MODEL_PATH = os.path.join(BASE, "models", "' . $modelName . '")';
        
        if (!updateModelPath($pyFile, $newPath)) {
            send_json_error('Could not update PyTorch model path', ['model'=>$modelName, 'file'=>$pyFile]);
        }
        
        error_log('[SET_MODEL] PyTorch model changed to: ' . $modelName);
        echo json_encode(['status' => 'ok', 'message' => 'PyTorch model changed to ' . $modelName]);
        exit;
    } elseif ($ext === 'h5' || $ext === 'keras') {
        // Update py-keras_predict.py for Keras models
        $pyFile = __DIR__ . '/py-keras_predict.py';
        $newPath = 'MODEL_PATH = os.path.join(BASE, "models", "' . $modelName . '")';
        
        if (!updateModelPath($pyFile, $newPath)) {
            send_json_error('Could not update Keras model path', ['model'=>$modelName, 'file'=>$pyFile]);
        }
        
        error_log('[SET_MODEL] Keras model changed to: ' . $modelName);
        echo json_encode(['status' => 'ok', 'message' => 'Keras model changed to ' . $modelName]);
        exit;
    } else {
        send_json_error('Unsupported model type', ['ext'=>$ext, 'model'=>$modelName]);
    }
}

// Fallback for non-POST requests
send_json_error('Invalid request method');
?>

