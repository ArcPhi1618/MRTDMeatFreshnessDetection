<?php
header('Content-Type: image/jpeg');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$url = $_GET['url'] ?? '';
$url = trim($url);

if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
  http_response_code(400);
  exit('Invalid URL');
}

$ctx = stream_context_create([
  'http' => [
    'timeout' => 6,
    'ignore_errors' => false,
    'user_agent' => 'IPCam-Proxy/1.0'
  ]
]);

$data = @file_get_contents($url, false, $ctx);
if ($data === false || $data === null || $data === '') {
  http_response_code(503);
  exit('Unable to fetch IP camera image');
}

$info = @getimagesizefromstring($data);
if ($info === false) {
  http_response_code(500);
  exit('Invalid image data');
}

header('Content-Length: ' . strlen($data));
echo $data;
