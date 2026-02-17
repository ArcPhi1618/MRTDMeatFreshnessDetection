<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Test the exact request
$testData = [
    'action' => 'save_capture',
    'image_path' => 'uploads/test.jpg',
    'class_detected' => 'Fresh Chicken',
    'confidence' => 0.95,
    'model_name' => 'test.onnx',
    'sensor_ppm' => 25.5,
    'storage_condition' => null,
    'notes' => 'Test'
];

echo "<h2>Simulating Capture Handler Request</h2>";
echo "<p>Test Data:</p>";
echo "<pre>" . json_encode($testData, JSON_PRETTY_PRINT) . "</pre>";

// Simulate what capture_handler.php does
$input = $testData;

$conn = new mysqli('localhost', 'root', '', 'cpe220937');
if ($conn->connect_error) {
    echo "<p>Connection error: " . $conn->connect_error . "</p>";
    exit;
}

$conn->set_charset('utf8mb4');
echo "<p>✓ Database connected</p>";

// Test escaping
$image_path = $conn->real_escape_string($input['image_path']);
echo "<p>image_path escaped: " . var_export($image_path, true) . "</p>";

$class_detected = $conn->real_escape_string($input['class_detected']);
$confidence = isset($input['confidence']) ? floatval($input['confidence']) : null;
$model_name = $conn->real_escape_string($input['model_name']);
$sensor_ppm = isset($input['sensor_ppm']) ? floatval($input['sensor_ppm']) : null;

// This is the problematic line
$storage_condition = isset($input['storage_condition']) ? $conn->real_escape_string($input['storage_condition']) : null;
echo "<p>storage_condition value: " . var_export($input['storage_condition'], true) . "</p>";
echo "<p>storage_condition isset: " . var_export(isset($input['storage_condition']), true) . "</p>";
echo "<p>storage_condition escaped: " . var_export($storage_condition, true) . "</p>";

$notes = isset($input['notes']) ? $conn->real_escape_string($input['notes']) : null;

$taken_at = date('Y-m-d H:i:s');

$sql = "INSERT INTO captures (image_path, class_detected, confidence, model_name, sensor_ppm, storage_condition, notes, taken_at) 
        VALUES ('$image_path', '$class_detected', " . ($confidence !== null ? $confidence : "NULL") . ", '$model_name', " . ($sensor_ppm !== null ? $sensor_ppm : "NULL") . ", " . ($storage_condition ? "'$storage_condition'" : "NULL") . ", " . ($notes ? "'$notes'" : "NULL") . ", '$taken_at')";

echo "<h3>Generated SQL:</h3>";
echo "<pre>" . htmlspecialchars($sql) . "</pre>";

echo "<h3>Executing SQL...</h3>";
if ($conn->query($sql) === TRUE) {
    echo "<p style='color:green;'>✓ Success! ID: " . $conn->insert_id . "</p>";
} else {
    echo "<p style='color:red;'>✗ Error: " . $conn->error . "</p>";
}

$conn->close();
?>
