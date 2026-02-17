<?php
// Manual test to insert a record directly

$conn = new mysqli('localhost', 'root', '', 'cpe220937');

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$conn->set_charset('utf8mb4');

echo "<h2>Direct Insert Test</h2>";

$image_path = 'uploads/test_' . date('Y-m-d-H-i-s') . '.jpg';
$class_detected = 'Fresh Chicken';
$confidence = 0.95;
$model_name = 'best.onnx';
$sensor_ppm = 25.5;
$taken_at = date('Y-m-d H:i:s');

// Using real_escape_string
$image_path_escaped = $conn->real_escape_string($image_path);
$class_escaped = $conn->real_escape_string($class_detected);
$model_escaped = $conn->real_escape_string($model_name);

$sql = "INSERT INTO captures (image_path, class_detected, confidence, model_name, sensor_ppm, taken_at) 
        VALUES ('$image_path_escaped', '$class_escaped', $confidence, '$model_escaped', $sensor_ppm, '$taken_at')";

echo "<p>SQL: " . htmlspecialchars($sql) . "</p>";

if ($conn->query($sql) === TRUE) {
    $id = $conn->insert_id;
    echo "<p style='color:green;'><strong>✓ Successfully inserted with ID: $id</strong></p>";
} else {
    echo "<p style='color:red;'><strong>✗ Error: " . $conn->error . " (errno: " . $conn->errno . ")</strong></p>";
}

echo "<h3>Current records in database:</h3>";
$result = $conn->query("SELECT id, class_detected, model_name, taken_at FROM captures ORDER BY id DESC LIMIT 5");
while ($row = $result->fetch_assoc()) {
    echo "<p>ID: " . $row['id'] . " | Class: " . $row['class_detected'] . " | Model: " . $row['model_name'] . " | Time: " . $row['taken_at'] . "</p>";
}

$conn->close();
?>
