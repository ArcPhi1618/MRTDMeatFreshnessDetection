<?php
// Test database connection and show data

$conn = new mysqli('localhost', 'root', '', 'cpe220937');

if ($conn->connect_error) {
    echo "Connection failed: " . $conn->connect_error;
    exit;
}

echo "<h2>Database Connection Test</h2>";
echo "<p>✓ Connected to cpe220937 successfully</p>";

// Check if captures table exists
$result = $conn->query("SHOW TABLES LIKE 'captures'");
if ($result->num_rows > 0) {
    echo "<p>✓ 'captures' table exists</p>";
} else {
    echo "<p>✗ 'captures' table NOT found</p>";
    exit;
}

// Count records
$count_result = $conn->query("SELECT COUNT(*) as cnt FROM captures");
$count_row = $count_result->fetch_assoc();
echo "<p>Total captures in database: <strong>" . $count_row['cnt'] . "</strong></p>";

// Show sample records
echo "<h3>Latest 5 Captures:</h3>";
$query = "SELECT id, image_path, class_detected, confidence, model_name, sensor_ppm, taken_at FROM captures ORDER BY taken_at DESC LIMIT 5";
$result = $conn->query($query);

if ($result && $result->num_rows > 0) {
    echo "<table border='1' cellpadding='10'>";
    echo "<tr><th>ID</th><th>Image Path</th><th>Class</th><th>Confidence</th><th>Model</th><th>PPM</th><th>Time</th></tr>";
    
    while ($row = $result->fetch_assoc()) {
        echo "<tr>";
        echo "<td>" . $row['id'] . "</td>";
        echo "<td>" . htmlspecialchars($row['image_path']) . "</td>";
        echo "<td>" . htmlspecialchars($row['class_detected']) . "</td>";
        echo "<td>" . round($row['confidence'], 4) . "</td>";
        echo "<td>" . htmlspecialchars($row['model_name']) . "</td>";
        echo "<td>" . ($row['sensor_ppm'] ? round($row['sensor_ppm'], 2) : 'N/A') . "</td>";
        echo "<td>" . $row['taken_at'] . "</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<p>No captures found in database</p>";
}

$conn->close();
?>
