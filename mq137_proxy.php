<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

$hosts = [
  'http://192.168.4.1/mq137',
  'http://192.168.4.2/mq137',
];

function try_fetch($url) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT_MS => 250, // fast connect fail
    CURLOPT_TIMEOUT_MS => 800,        // total time cap
    CURLOPT_FAILONERROR => false,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
  ]);

  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);

  if ($resp === false || $resp === null || trim($resp) === '') return [false, null];

  $data = json_decode($resp, true);
  if (json_last_error() !== JSON_ERROR_NONE) return [false, null];

  return [true, $data];
}

foreach ($hosts as $u) {
  [$ok, $data] = try_fetch($u);
  if ($ok) {
    $ppm = $data['ppm'] ?? $data['value'] ?? $data['reading'] ?? null;
    echo json_encode([
      'status' => 'ok',
      'source' => $u,
      'ppm' => $ppm,
      'raw' => $data
    ]);
    exit;
  }
}

echo json_encode([
  'status' => 'offline',
  'ppm' => null,
  'message' => 'MQ-137 sensor endpoint not reachable'
]);