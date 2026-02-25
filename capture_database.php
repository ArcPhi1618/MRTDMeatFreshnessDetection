<?php
header('Content-Type: application/json');
ini_set('display_errors', 0);
error_reporting(E_ALL);

// ====== CONFIG ======
$DB_HOST = "localhost";
$DB_USER = "root";
$DB_PASS = "";
$DB_NAME = "cpe220937";
// ====================

function respond($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr);
  exit;
}

function get_pdo($host, $user, $pass, $name) {
  $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
  return new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
}

try {
  $pdo = get_pdo($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
} catch (Exception $e) {
  respond(['status'=>'error','message'=>'DB connection failed'], 500);
}

$method = $_SERVER['REQUEST_METHOD'];


// ==========================================================
// INSERT NEW CAPTURE
// ==========================================================
if ($method === 'POST') {

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);

  if (!is_array($data)) {
    respond(['status'=>'error','message'=>'Invalid JSON body'], 400);
  }

  $image_path     = trim((string)($data['image_path'] ?? ''));
  $class_detected = trim((string)($data['class_detected'] ?? ''));
  $model_name     = trim((string)($data['model_name'] ?? ''));

  if ($image_path === '' || $class_detected === '' || $model_name === '') {
    respond([
      'status'=>'error',
      'message'=>'Missing required fields'
    ], 400);
  }

  $confidence = isset($data['confidence']) ? floatval($data['confidence']) : null;
  $sensor_ppm = isset($data['sensor_ppm']) ? floatval($data['sensor_ppm']) : null;

  $taken_at = isset($data['taken_at']) ? trim((string)$data['taken_at']) : '';
  if ($taken_at === '') {
    $taken_at = date('Y-m-d H:i:s');
  } else {
    $taken_at = str_replace('T', ' ', $taken_at);
    $taken_at = preg_replace('/\.\d+$/', '', $taken_at);
  }

  try {
    $stmt = $pdo->prepare("
      INSERT INTO captures
        (image_path, class_detected, confidence, model_name, sensor_ppm, taken_at)
      VALUES
        (:image_path, :class_detected, :confidence, :model_name, :sensor_ppm, :taken_at)
    ");

    $stmt->execute([
      ':image_path'     => $image_path,
      ':class_detected' => $class_detected,
      ':confidence'     => $confidence,
      ':model_name'     => $model_name,
      ':sensor_ppm'     => $sensor_ppm,
      ':taken_at'       => $taken_at
    ]);

    respond([
      'status' => 'ok',
      'insert_id' => (int)$pdo->lastInsertId()
    ]);

  } catch (Exception $e) {
    respond([
      'status'=>'error',
      'message'=>'Insert failed: '.$e->getMessage()
    ], 500);
  }
}


// ==========================================================
// FETCH CAPTURES
// ==========================================================
if ($method === 'GET') {

  $limit = isset($_GET['limit']) ? max(1, min(200, intval($_GET['limit']))) : 50;

  try {
    $stmt = $pdo->prepare("
      SELECT id, image_path, class_detected, confidence, model_name,
             sensor_ppm, taken_at, created_at
      FROM captures
      ORDER BY taken_at DESC
      LIMIT {$limit}
    ");

    $stmt->execute();
    $rows = $stmt->fetchAll();

    respond(['status'=>'ok','records'=>$rows]);

  } catch (Exception $e) {
    respond(['status'=>'error','message'=>'Fetch failed'], 500);
  }
}

respond(['status'=>'error','message'=>'Method not allowed'], 405);
