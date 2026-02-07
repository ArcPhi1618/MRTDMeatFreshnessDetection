<?php
header('Content-Type: application/json');

$url = 'http://192.168.4.1/mq137';

try {
    $context = stream_context_create([
        'http' => [
            'timeout' => 5,
            'ignore_errors' => true
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    if ($response === false) {
        http_response_code(503);
        echo json_encode([
            'status' => 'error',
            'message' => 'Could not connect to ESP32 at ' . $url,
            'debug' => 'Check if ESP32 is online and IP is correct'
        ]);
        exit;
    }
    
    // Try to decode as JSON to validate
    $data = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(502);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid JSON from ESP32',
            'raw_response' => substr($response, 0, 200)
        ]);
        exit;
    }
    
    echo $response;
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
