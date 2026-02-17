<?php
set_time_limit(120);
ini_set('default_socket_timeout', 120);
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json");

$log = __DIR__ . '/php_yolo_log.txt';
file_put_contents($log, date('Y-m-d H:i:s') . " REQUEST method=" . ($_SERVER['REQUEST_METHOD'] ?? '') . "\n", FILE_APPEND);

$uploadDir = __DIR__ . "/uploads/";
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

if (!isset($_FILES['image'])) {
  echo json_encode(['status'=>'error','message'=>'no image provided']);
  exit;
}

if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
  $code = $_FILES['image']['error'];
  echo json_encode(['status'=>'error','message'=>"Upload error code {$code}"]);
  exit;
}

// Validate actual image
$tmp = $_FILES['image']['tmp_name'];
$info = @getimagesize($tmp);
if ($info === false) {
  echo json_encode(['status'=>'error','message'=>'uploaded file is not a valid image']);
  exit;
}

$threshold = isset($_POST['threshold']) ? floatval($_POST['threshold']) : 0.3;
if ($threshold < 0) $threshold = 0;
if ($threshold > 1) $threshold = 1;

// Unique filename
$timestamp = date('Y-m-d-H-i-s');
$suffix = bin2hex(random_bytes(3));
$filename = "{$timestamp}-{$suffix}.jpg";
$imgPath = $uploadDir . $filename;

if (!move_uploaded_file($tmp, $imgPath)) {
  echo json_encode(['status'=>'error','message'=>'upload failed']);
  exit;
}

file_put_contents($log, date('Y-m-d H:i:s') . " SAVED {$imgPath} size=" . filesize($imgPath) . "\n", FILE_APPEND);

// Ensure ONNX exists
$modelPath = __DIR__ . "/models/best.onnx";
if (!file_exists($modelPath)) {
  echo json_encode(['status'=>'error','message'=>'best.onnx model file not found in models/']);
  exit;
}

// Python selection (Windows + Linux)
$pythonWin = __DIR__ . "/.venv/Scripts/python.exe";
$pythonNix = __DIR__ . "/.venv/bin/python";
if (file_exists($pythonWin)) $python = $pythonWin;
elseif (file_exists($pythonNix)) $python = $pythonNix;
else $python = "python";

// Script path
$script = __DIR__ . "/py-onnx_predict.py";
if (!file_exists($script)) {
  echo json_encode(['status'=>'error','message'=>'py-onnx_predict.py not found']);
  exit;
}

// Execute python (capture stderr too)
$cmd = escapeshellarg($python) . " " . escapeshellarg($script) . " " .
       escapeshellarg($imgPath) . " " . escapeshellarg((string)$threshold) . " 2>&1";

$start = microtime(true);
$out = shell_exec($cmd);
$ms = (microtime(true) - $start) * 1000;

if ($out === null || trim((string)$out) === "") {
  file_put_contents($log, date('Y-m-d H:i:s') . " PY_EMPTY cmd={$cmd}\n", FILE_APPEND);
  echo json_encode(['status'=>'error','message'=>'Model script returned no output']);
  exit;
}

$decoded = json_decode((string)$out, true);
if (!$decoded || !is_array($decoded)) {
  file_put_contents($log, date('Y-m-d H:i:s') . " PY_BAD_JSON out=" . substr((string)$out, 0, 500) . "\n", FILE_APPEND);
  echo json_encode(['status'=>'error','message'=>'Invalid model response (not JSON)','raw'=>substr((string)$out, 0, 300)]);
  exit;
}

if (($decoded['status'] ?? '') !== 'ok') {
  echo json_encode($decoded);
  exit;
}

// annotated_path must be browser-loadable (relative URL)
$annot = $decoded['annotated_path'] ?? '';
if (is_string($annot) && $annot !== '') {
  $annotNorm = str_replace('\\', '/', $annot);
  $rootNorm  = str_replace('\\', '/', __DIR__);
  if (strpos($annotNorm, $rootNorm) === 0) {
    $annot = ltrim(substr($annotNorm, strlen($rootNorm)), '/');
  }
}

$predictions = $decoded['predictions'] ?? [];
$predEmpty = empty($predictions);

$response = [
  'status' => 'ok',
  'path' => $annot,                 // shown in place of stream
  'image_path' => 'uploads/' . $filename, // original upload
  'predictions' => $predictions,
  'all_classes' => $decoded['all_classes'] ?? null,
  'top_class' => $decoded['top_class'] ?? null,
  'top_confidence' => $decoded['top_confidence'] ?? null,
  'inference_time_ms' => $decoded['inference_time_ms'] ?? round($ms, 2)
];

if ($predEmpty) {
  $response['warning'] = 'No detections above threshold. Try lowering confidence threshold.';
}

echo json_encode($response);
