<?php
// API endpoint to delete a model file

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $modelName = $input['model'] ?? null;
    
    if (!$modelName) {
        echo json_encode(['status' => 'error', 'message' => 'No model specified']);
        exit;
    }
    
    // Validate model name - prevent path traversal
    if (strpos($modelName, '..') !== false || strpos($modelName, '/') !== false || strpos($modelName, '\\') !== false) {
        echo json_encode(['status' => 'error', 'message' => 'Invalid model name']);
        exit;
    }
    
    // Prevent deletion of the default model
    $defaultModel = 'cpe-mfmrtd-03.pt';
    if ($modelName === $defaultModel) {
        echo json_encode(['status' => 'error', 'message' => 'Cannot delete the default model']);
        exit;
    }
    
    // Check if model file exists
    // Allow deleting ONNX models from 3/ folder
    if (strpos($modelName, '3/') === 0) {
        $onnxFile = substr($modelName, 2); // Remove '3/'
        $modelPath = __DIR__ . '/3/' . $onnxFile;
    } else {
        $modelPath = __DIR__ . '/models/' . $modelName;
    }
    if (!file_exists($modelPath)) {
        echo json_encode(['status' => 'error', 'message' => 'Model file not found']);
        exit;
    }
    
    // Prevent deletion if model is currently in use
    $pyFile = __DIR__ . '/py-model_predict.py';
    if (file_exists($pyFile)) {
        $content = file_get_contents($pyFile);
        if (preg_match('/MODEL_PATH = os\.path\.join\(BASE, "models", "([^"]+)"\)/', $content, $matches)) {
            $currentModel = $matches[1];
            if ($modelName === $currentModel) {
                echo json_encode(['status' => 'error', 'message' => 'Cannot delete the currently active model. Switch to another model first.']);
                exit;
            }
        }
    }
    
    // Delete the file
    if (unlink($modelPath)) {
        error_log('[DELETE_MODEL] Model deleted: ' . $modelName);
        echo json_encode(['status' => 'ok', 'message' => 'Model deleted successfully']);
        exit;
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to delete model file']);
        exit;
    }
}

echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
exit;
