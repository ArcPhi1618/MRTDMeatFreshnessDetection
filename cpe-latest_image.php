<?php

$dir = "uploads/";

$files = glob($dir . "*.jpg");

if (!$files) {
    exit;
}

usort($files, function($a, $b) {
    return filemtime($b) - filemtime($a);
});

// echo newest image path
echo $files[0];