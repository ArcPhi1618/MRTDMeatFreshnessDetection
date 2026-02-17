<?php
header('Content-Type: image/jpeg');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$log_file = __DIR__ . '/esp32_proxy_debug.log';

$esp32_url = isset($_GET['url']) ? trim($_GET['url']) : 'http://192.168.4.2/capture';

if (!filter_var($esp32_url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    error_log("[Proxy] Invalid URL: {$esp32_url}\n", 3, $log_file);
    exit("Invalid URL");
}

$ctx = stream_context_create([
    'http' => [
        'timeout' => 6,
        'ignore_errors' => false,
        'user_agent' => 'ESP32-Proxy/1.0'
    ]
]);

$image_data = @file_get_contents($esp32_url, false, $ctx);

if ($image_data === false || $image_data === null || $image_data === "") {
    http_response_code(503);
    error_log("[Proxy] Failed fetch: {$esp32_url}\n", 3, $log_file);
    exit("Unable to fetch from ESP32");
}

// Validate it is an image (more reliable than magic bytes)
$info = @getimagesizefromstring($image_data);
if ($info === false) {
    http_response_code(500);
    error_log("[Proxy] Non-image data from ESP32. First bytes=" . bin2hex(substr($image_data, 0, 24)) . "\n", 3, $log_file);
    exit("Invalid image data");
}

header('Content-Length: ' . strlen($image_data));
echo $image_data;
