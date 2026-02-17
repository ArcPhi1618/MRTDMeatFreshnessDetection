<?php
/**
 * Get ESP32 Proxy Debug Log
 */

$log_file = __DIR__ . '/esp32_proxy_debug.log';

if (!file_exists($log_file)) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'log' => 'No log file yet. Run some ESP32 camera tests first.',
        'lines' => 0
    ]);
    exit;
}

$content = file_get_contents($log_file);
$lines = count(array_filter(explode("\n", $content), fn($x) => trim($x)));

header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'log' => $content,
    'lines' => $lines
]);
