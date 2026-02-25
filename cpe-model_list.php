<?php
header("Content-Type: application/json");
ini_set('display_errors', 0);
error_reporting(E_ALL);

$allowedExt = ['onnx','keras','h5','pt'];
$maxBytes = 200 * 1024 * 1024; // 200MB



$modelsDir = __DIR__ . "/models/";
if (!is_dir($modelsDir)) mkdir($modelsDir, 0755, true);

// If GET: return list of models
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $models = [];
  foreach (scandir($modelsDir) as $f) {
    if ($f === '.' || $f === '..') continue;
    $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) continue;
    $size = filesize($modelsDir . $f);
    $models[] = [
      'name' => $f,
      'ext' => $ext,
      'size_kb' => $size ? ($size / 1024) : 0
    ];
  }
  echo json_encode(['status'=>'ok','models'=>$models]);
  exit;
}

// If POST: handle upload
if (!isset($_FILES['model'])) {
  echo json_encode(['status'=>'error','message'=>'No model file uploaded']);
  exit;
}

$f = $_FILES['model'];
if ($f['error'] !== UPLOAD_ERR_OK) {
  echo json_encode(['status'=>'error','message'=>'Upload error code: '.$f['error']]);
  exit;
}

if ($f['size'] <= 0 || $f['size'] > $maxBytes) {
  echo json_encode(['status'=>'error','message'=>'File too large or empty']);
  exit;
}

// sanitize filename
$orig = $f['name'] ?? 'model';
$base = basename($orig);
$base = preg_replace('/[^a-zA-Z0-9._-]/', '_', $base);

// extension check
$ext = strtolower(pathinfo($base, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
  echo json_encode(['status'=>'error','message'=>'Only .onnx, .keras, .h5, .pt are allowed']);
  exit;
}

// prevent overwrite: add suffix if exists
$target = $modelsDir . $base;
if (file_exists($target)) {
  $nameNoExt = pathinfo($base, PATHINFO_FILENAME);
  $suffix = bin2hex(random_bytes(3));
  $base = $nameNoExt . "-" . $suffix . "." . $ext;
  $target = $modelsDir . $base;
}

if (!move_uploaded_file($f['tmp_name'], $target)) {
  echo json_encode(['status'=>'error','message'=>'Failed to save model file']);
  exit;
}

echo json_encode([
  'status' => 'ok',
  'name' => $base,
  'ext' => $ext,
  'size_bytes' => filesize($target)
]);

