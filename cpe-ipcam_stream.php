<?php
// IP Camera Stream Proxy
// This file streams the IP camera feed through the server to avoid CORS issues

header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('Access-Control-Allow-Origin: *');

$camUrl = $_GET['cam_url'] ?? null;

if (!$camUrl) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'No camera URL provided']);
    exit;
}

$camUrl = urldecode($camUrl);

// Validate URL (be lenient for IP cameras)
if (filter_var($camUrl, FILTER_VALIDATE_URL) === false && !preg_match('/^https?:\/\//', $camUrl)) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Invalid URL format']);
    exit;
}

// Try using cURL first (more reliable for streaming)
if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $camUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        CURLOPT_HTTPHEADER => [
            'Accept: image/*, video/*',
            'Connection: close'
        ],
        CURLOPT_RETURNTRANSFER => false,  // Stream to output directly
        CURLOPT_BINARYTRANSFER => 1
    ]);
    
    // Stream directly
    curl_exec($ch);
    
    if (curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200) {
        curl_close($ch);
        exit;
    }
    
    curl_close($ch);
}

// Fallback: Use file_get_contents with longer timeout
$context_options = [
    'http' => [
        'method' => 'GET',
        'timeout' => 30,
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'follow_location' => 1,
        'max_redirects' => 5
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false
    ]
];

$context = stream_context_create($context_options);
$response = @file_get_contents($camUrl, false, $context);

if ($response === false) {
    header('Content-Type: application/json');
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch from camera after retries']);
    error_log("Failed to connect to camera: {$camUrl}");
    exit;
}

// Detect content type from response headers
$contentType = 'image/jpeg';
if ($http_response_header) {
    foreach ($http_response_header as $header) {
        if (stripos($header, 'Content-Type:') === 0) {
            $contentType = trim(substr($header, 13));
            break;
        }
    }
}

// Set appropriate headers
header("Content-Type: {$contentType}");
header('Content-Length: ' . strlen($response));

echo $response;
?>
