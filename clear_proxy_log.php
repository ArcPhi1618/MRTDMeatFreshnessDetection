<?php
/**
 * Clear ESP32 Proxy Debug Log
 */

$log_file = __DIR__ . '/esp32_proxy_debug.log';

if (file_exists($log_file)) {
    unlink($log_file);
}

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'Proxy log cleared'
]);
