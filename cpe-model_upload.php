<?php
header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

$uploadDir = __DIR__ . '/models/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$allowedExt = ['onnx', 'keras', 'h5', 'pt'];

if (!isset($_FILES['model'])) {
    echo json_encode(['status' => 'error', 'message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['model'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['status' => 'error', 'message' => 'Upload error code ' . $file['error']]);
    exit;
}

$name = basename($file['name']);
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid file type. Allowed: .onnx, .keras, .h5, .pt']);
    exit;
}

$target = $uploadDir . $name;
if (!move_uploaded_file($file['tmp_name'], $target)) {
    echo json_encode(['status' => 'error', 'message' => 'Failed to save file.']);
    exit;
}

$size_kb = round(filesize($target) / 1024, 1);

echo json_encode([
    'status' => 'ok',
    'name' => $name,
    'ext' => $ext,
    'size_kb' => $size_kb
]);
