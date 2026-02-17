<?php
$dir = __DIR__ . '/models';
$allowed = ['pt','h5','keras','onnx'];
$models = [];
if (is_dir($dir)) {
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..') continue;
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, $allowed)) $models[] = $f;
    }
}
echo json_encode(['models'=>$models]);
?>