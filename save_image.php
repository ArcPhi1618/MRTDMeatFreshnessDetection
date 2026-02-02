<?php

$conn = new mysqli("localhost","root","","cpe_mrtd220937_db");
if($conn->connect_error) die("DB Error");

/* ================= CLEAN OLD FILES (24H) ================= */

$expire = "DATE_SUB(NOW(), INTERVAL 1 DAY)";

$res = $conn->query("SELECT img FROM cpe WHERE created_at < $expire");
while($r = $res->fetch_assoc()){
    if(file_exists($r['img'])) unlink($r['img']);
}

$conn->query("DELETE FROM cpe WHERE created_at < $expire");

/* ================= IMAGE UPLOAD ================= */

if(isset($_FILES['image'])){

    // UNIQUE filename
    $filename = microtime(true) . ".jpg";
    $relative = "uploads/".$filename;
    $path = __DIR__ . "/" . $relative;

    if(!move_uploaded_file($_FILES['image']['tmp_name'],$path)){
        exit("UPLOAD_FAIL");
    }

    /* ===== RUN YOLO ===== */

    $python = __DIR__."/.venv/Scripts/python.exe";
    if(!file_exists($python)) $python = __DIR__."/.venv/bin/python";

    $script = __DIR__."/model_predict.py";

    $cmd = escapeshellarg($python)." ".escapeshellarg($script)." ".escapeshellarg($path)." 2>&1";

    $output = shell_exec($cmd);

    file_put_contents(
        __DIR__."/php_yolo_log.txt",
        date("Y-m-d H:i:s")."\n".$cmd."\n".$output."\n\n",
        FILE_APPEND
    );

    /* ===== SAVE DB ===== */

    $prediction = trim($output);

    $stmt = $conn->prepare("INSERT INTO cpe(img_name,img,prediction) VALUES(?,?,?)");
    $stmt->bind_param("sss",$filename,$relative,$prediction);
    $stmt->execute();

    echo $relative;
    exit;
}

/* ================= LATEST IMAGE ================= */

$files = glob(__DIR__."/uploads/*.jpg");
if(!$files) exit;

usort($files,function($a,$b){
    return filemtime($b)-filemtime($a);
});

echo "uploads/".basename($files[0]);