<?php
header('Content-Type: application/json');

// Get the IP camera URL from the request
$data = json_decode(file_get_contents('php://input'), true);
$url = $data['url'] ?? null;

if (!$url) {
    echo json_encode(['status' => 'error', 'message' => 'No URL provided']);
    exit;
}

// Lenient URL validation (allow IPs without strict validation)
if (!preg_match('/^https?:\/\/.+/i', $url)) {
    echo json_encode(['status' => 'error', 'message' => 'URL must start with http:// or https://']);
    exit;
}

// Return proxy URL directly without testing (to avoid timeout delays)
// The actual connection test will happen when frames are requested
$proxyUrl = 'cpe-ipcam_stream.php?cam_url=' . urlencode($url);

echo json_encode([
    'status' => 'ok',
    'proxy_url' => $proxyUrl,
    'message' => 'IP camera proxy configured'
]);
?>
