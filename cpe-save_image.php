<?php
set_time_limit(120);
ini_set('default_socket_timeout', 120);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=utf-8");

function fail($msg, $extra = []) {
  echo json_encode(array_merge(['status'=>'error','message'=>$msg], $extra));
  exit;
}

$uploadDir = __DIR__ . "/uploads/";
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

if (!isset($_FILES['image'])) {
  fail('no image provided');
}

if ($_FILES['image']['error'] !== UPLOAD_ERR_OK) {
  fail('Upload error code '.$_FILES['image']['error']);
}

// validate actual image
$tmp = $_FILES['image']['tmp_name'];
$info = @getimagesize($tmp);
if ($info === false) {
  fail('uploaded file is not a valid image');
}

$threshold = isset($_POST['threshold']) ? floatval($_POST['threshold']) : 0.5;
if ($threshold < 0) $threshold = 0;
if ($threshold > 1) $threshold = 1;

// unique filename
$timestamp = date('Y-m-d-H-i-s');
$suffix = bin2hex(random_bytes(3));
$filename = "{$timestamp}-{$suffix}.jpg";
$imgPath = $uploadDir . $filename;

if (!move_uploaded_file($tmp, $imgPath)) {
  fail('upload failed');
}

// Determine selected model
$allowedExt = ['onnx','keras','h5','pt'];

// IMPORTANT: JS sends model_path, older code might send model.
// Prefer model_path if present.
$sel = '';
if (isset($_POST['model_path']) && $_POST['model_path'] !== '') {
  $sel = (string)$_POST['model_path'];
} elseif (isset($_POST['model']) && $_POST['model'] !== '') {
  $sel = (string)$_POST['model'];
}

$sel = basename($sel);
$sel = preg_replace('/[^a-zA-Z0-9._-]/', '_', $sel);

function findModelPath($name, $extAllowed) {
  $p1 = __DIR__ . "/models/" . $name;
  $p2 = __DIR__ . "/models_user/" . $name;
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
  if ($name === '') return '';
  if (!in_array($ext, $extAllowed, true)) return '';
  if (is_file($p1)) return $p1;
  if (is_file($p2)) return $p2;
  return '';
}

$modelPath = '';
if ($sel !== '') {
  $modelPath = findModelPath($sel, $allowedExt);
  if ($modelPath === '') {
    fail('Selected model not found or not allowed');
  }
}

// default model if none selected
if ($modelPath === '') {
  $modelPath = __DIR__ . "/models/best.onnx";
  if (!file_exists($modelPath)) {
    fail('Default model models/best.onnx not found');
  }
  $sel = "best.onnx";
}

$ext = strtolower(pathinfo($modelPath, PATHINFO_EXTENSION));

// python selection (Windows + Linux)
$pythonWin = __DIR__ . "/.venv/Scripts/python.exe";
$pythonNix = __DIR__ . "/.venv/bin/python";
if (file_exists($pythonWin)) $python = $pythonWin;
elseif (file_exists($pythonNix)) $python = $pythonNix;
else $python = "python";

if ($ext === 'onnx') $script = __DIR__ . "/py-onnx_predict.py";
elseif ($ext === 'keras' || $ext === 'h5') $script = __DIR__ . "/py-keras_predict.py";
elseif ($ext === 'pt') $script = __DIR__ . "/py-pt_predict.py";
else fail('Unsupported model type');

if (!file_exists($script)) {
  fail('Model script not found: ' . basename($script));
}

if (!function_exists('proc_open')) {
  fail('proc_open() is disabled in this PHP setup');
}

$cmd = [
  $python,
  "-u",
  $script,
  $imgPath,
  (string)$threshold,
  $modelPath
];

$descriptorspec = [
  0 => ["pipe", "r"],
  1 => ["pipe", "w"],
  2 => ["pipe", "w"],
];

$start = microtime(true);
$process = proc_open($cmd, $descriptorspec, $pipes, __DIR__);

if (!is_resource($process)) {
  fail('Failed to start model process');
}

fclose($pipes[0]);

$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);

fclose($pipes[1]);
fclose($pipes[2]);

$exitCode = proc_close($process);
$ms = (microtime(true) - $start) * 1000;

$stdoutTrim = trim((string)$stdout);
if ($stdoutTrim === "") {
  fail('Model script returned no output', [
    'exit_code' => $exitCode,
    'stderr' => substr((string)$stderr, 0, 1200)
  ]);
}

$decoded = json_decode($stdoutTrim, true);
if (!$decoded || !is_array($decoded)) {
  fail('Invalid model response (not JSON)', [
    'exit_code' => $exitCode,
    'raw_stdout' => substr($stdoutTrim, 0, 1200),
    'stderr' => substr((string)$stderr, 0, 1200)
  ]);
}

if (($decoded['status'] ?? '') !== 'ok') {
  if (!empty($stderr)) $decoded['stderr'] = substr((string)$stderr, 0, 1200);
  echo json_encode($decoded);
  exit;
}

// Python returns absolute path in annotated_path. Convert to relative URL for browser.
$annot = $decoded['annotated_path'] ?? '';
if (is_string($annot) && $annot !== '') {
  $annotNorm = str_replace('\\', '/', $annot);
  $rootNorm  = str_replace('\\', '/', __DIR__);
  if (strpos($annotNorm, $rootNorm) === 0) {
    $annot = ltrim(substr($annotNorm, strlen($rootNorm)), '/');
  }
}

$response = [
  'status' => 'ok',
  'model_used' => basename($sel),

  // This is what your JS displays in the <img> when present:
  // It will now point to uploads/<timestamp>_nobg.png
  'path' => $annot,

  // Original uploaded JPG (still useful for DB storage / reference)
  'image_path' => 'uploads/' . $filename,
  'uploaded_path' => 'uploads/' . $filename,

  // Prediction outputs
  'predictions' => $decoded['predictions'] ?? [],
  'all_classes' => $decoded['all_classes'] ?? null,
  'top_class' => $decoded['top_class'] ?? null,
  'top_confidence' => $decoded['top_confidence'] ?? null,
  'inference_time_ms' => $decoded['inference_time_ms'] ?? round($ms, 2),

  // Debug fields so you can confirm bg removal path/method
  'rembg_ok' => $decoded['rembg_ok'] ?? null,
  'bg_method' => $decoded['bg_method'] ?? null,
];

echo json_encode($response);