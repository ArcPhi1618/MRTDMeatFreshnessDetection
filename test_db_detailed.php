<?php
// Detailed database diagnostic

$conn = new mysqli('localhost', 'root', '', 'cpe220937');

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "<h2>Database Diagnostic</h2>";

// Check table structure
echo "<h3>Table Structure:</h3>";
$result = $conn->query("DESCRIBE captures");
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";
while ($row = $result->fetch_assoc()) {
    echo "<tr>";
    foreach ($row as $value) {
        echo "<td>" . htmlspecialchars($value) . "</td>";
    }
    echo "</tr>";
}
echo "</table>";

echo "<h3>All Captures (No Limit):</h3>";
$result = $conn->query("SELECT * FROM captures ORDER BY id DESC");
echo "<p>Total records: " . $result->num_rows . "</p>";

if ($result->num_rows > 0) {
    echo "<table border='1' cellpadding='5'>";
    echo "<tr>";
    
    // Print headers
    $fields = $result->fetch_assoc();
    foreach ($fields as $key => $value) {
        echo "<th>" . htmlspecialchars($key) . "</th>";
    }
    echo "</tr>";
    
    // Print first row
    echo "<tr>";
    foreach ($fields as $value) {
        echo "<td>" . htmlspecialchars((string)$value) . "</td>";
    }
    echo "</tr>";
    
    // Print remaining rows
    while ($row = $result->fetch_assoc()) {
        echo "<tr>";
        foreach ($row as $value) {
            echo "<td>" . htmlspecialchars((string)$value) . "</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<p>No records found</p>";
}

echo "<h3>Check for Recent Inserts:</h3>";
$result = $conn->query("SELECT id, taken_at FROM captures WHERE taken_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) ORDER BY taken_at DESC");
echo "<p>Captures from last 24 hours: " . $result->num_rows . "</p>";

$conn->close();
?>
