<?php
header("Content-Type: application/json");

$uploadDir = __DIR__ . "/uploads/";
if(!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

if(!isset($_FILES['image'])){
    echo json_encode(['status'=>'error','message'=>'no image']);
    exit;
}

$filename = uniqid("img_") . ".jpg";
$imgPath = $uploadDir . $filename;

if(!move_uploaded_file($_FILES['image']['tmp_name'], $imgPath)){
    echo json_encode(['status'=>'error','message'=>'upload failed']);
    exit;
}

$threshold = isset($_POST['threshold']) ? floatval($_POST['threshold']) : 0.3;

// Use YOLO server (faster - model stays in memory)
$serverUrl = "http://localhost:5555/predict";
$ch = curl_init($serverUrl);
curl_setopt($ch, CURLOPT_POST, 1);
$postFields = [
    'image' => new CURLFile($imgPath),
    'threshold' => $threshold
];
// forward optional fields
if(isset($_POST['boxes_only'])) $postFields['boxes_only'] = $_POST['boxes_only'];
if(isset($_POST['client_id'])) $postFields['client_id'] = $_POST['client_id'];
if(isset($_POST['imgsz'])) $postFields['imgsz'] = $_POST['imgsz'];

curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $response = curl_exec($ch);
    $curlErr = '';
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if($response === false){
        $curlErr = curl_error($ch);
    }
    curl_close($ch);

    // If curl failed or returned non-200 or empty, fallback to subprocess
    if($httpCode !== 200 || $response === false || $response === null || trim((string)$response) === ''){
        // Log curl problem for diagnosis
        file_put_contents(__DIR__ . "/php_yolo_log.txt",
            date("Y-m-d H:i:s") . " CURL_FAIL server={$serverUrl} http={$httpCode} err=" . $curlErr . "\n",
            FILE_APPEND
        );

        // Try old subprocess method (use venv python if available)
        $python = __DIR__ . "/.venv/Scripts/python.exe";
        if(!file_exists($python)) $python = "python";
        $script = __DIR__ . "/py-model_predict.py";
        $cmd = escapeshellarg($python) . " " . escapeshellarg($script) . " " . escapeshellarg((string)$imgPath) . " " . escapeshellarg((string)$threshold) . " 2>&1";
        $response = shell_exec($cmd);

        file_put_contents(__DIR__ . "/php_yolo_log.txt",
            date("Y-m-d H:i:s") . " SUBPROCESS_CMD=" . $cmd . "\n" . substr((string)$response,0,200) . "\n",
            FILE_APPEND
        );
    }

    // Ensure we have a string to decode
    $resp_str = is_null($response) ? '' : (string)$response;
    $decoded = json_decode($resp_str, true);

if(!$decoded){
    echo json_encode([
        'status'=>'error',
        'message'=>'invalid response',
        'raw'=>substr($resp_str, 0, 200)
    ]);
    exit;
}

if($decoded['status'] !== 'ok'){
    echo json_encode($decoded);
    exit;
}

echo json_encode([
    'status' => 'ok',
    'path' => rawurldecode($decoded['annotated_path']),
    'predictions' => $decoded['predictions']
]);
