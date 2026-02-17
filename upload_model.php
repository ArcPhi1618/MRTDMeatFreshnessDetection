<?php
// Set PHP limits for large file uploads
ini_set('upload_max_filesize', '500M');
ini_set('post_max_size', '500M');
ini_set('max_execution_time', 300);

// Handle model file upload
error_log('[UPLOAD] Request method: ' . $_SERVER['REQUEST_METHOD']);
error_log('[UPLOAD] POST keys: ' . json_encode(array_keys($_POST)));
error_log('[UPLOAD] FILES keys: ' . json_encode(array_keys($_FILES)));
error_log('[UPLOAD] upload_max_filesize: ' . ini_get('upload_max_filesize'));
error_log('[UPLOAD] post_max_size: ' . ini_get('post_max_size'));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Log any upload errors
    if (!empty($_FILES)) {
        foreach ($_FILES as $key => $file) {
            error_log('[UPLOAD] FILE ' . $key . ': error=' . $file['error'] . ', name=' . $file['name'] . ', size=' . $file['size']);
        }
    }
    
    // Check for PHP upload errors
    if (isset($_FILES['model'])) {
        $file = $_FILES['model'];
        
        // Check for upload errors
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds form max_file_size',
                UPLOAD_ERR_PARTIAL => 'File upload was partial',
                UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'No temp directory',
                UPLOAD_ERR_CANT_WRITE => 'Cannot write to disk',
                UPLOAD_ERR_EXTENSION => 'Upload stopped by extension'
            ];
            $msg = $errors[$file['error']] ?? 'Unknown upload error (' . $file['error'] . ')';
            error_log('[UPLOAD] Upload error: ' . $msg);
            echo json_encode(['status' => 'error', 'message' => $msg]);
            exit;
        }
        
        $allowed = ['pt', 'h5', 'keras'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        error_log('[UPLOAD] File extension: ' . $ext);
        
        if (!in_array($ext, $allowed)) {
            error_log('[UPLOAD] Invalid extension: ' . $ext);
            echo json_encode(['status' => 'error', 'message' => 'Invalid file type']);
            exit;
        }
        
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($ext === 'onnx') {
            $target = __DIR__ . '/3/' . basename($file['name']);
        } else {
            $target = __DIR__ . '/models/' . basename($file['name']);
        }
        error_log('[UPLOAD] Moving file to: ' . $target);
        
        if (move_uploaded_file($file['tmp_name'], $target)) {
            error_log('[UPLOAD] File moved successfully, size: ' . filesize($target));
            echo json_encode(['status' => 'ok']);
        } else {
            error_log('[UPLOAD] Failed to move uploaded file');
            echo json_encode(['status' => 'error', 'message' => 'Failed to save file']);
        }
        exit;
    } else {
        error_log('[UPLOAD] No model file in FILES');
        echo json_encode(['status' => 'error', 'message' => 'No file field in request']);
        exit;
    }
}
error_log('[UPLOAD] Unexpected request method or GET request');
echo json_encode(['status' => 'error', 'message' => 'No file uploaded']);
exit;
?>