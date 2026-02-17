<?php
/**
 * Database Diagnostic Tool
 * Check if the database and tables are properly set up
 */

// Database configuration
$host = 'localhost';
$user = 'root';
$pass = '';
$database = 'cpe220937';

$conn = new mysqli($host, $user, $pass);

if ($conn->connect_error) {
    die('Database connection failed: ' . $conn->connect_error);
}

echo "<h1>Database Diagnostic Report</h1>";
echo "<style>
body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
.success { color: green; background: #e8f5e9; padding: 10px; margin: 10px 0; border-radius: 4px; }
.error { color: red; background: #ffebee; padding: 10px; margin: 10px 0; border-radius: 4px; }
.warning { color: orange; background: #fff3e0; padding: 10px; margin: 10px 0; border-radius: 4px; }
code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
table th, table td { padding: 10px; text-align: left; border: 1px solid #ddd; }
table th { background: #f5f5f5; font-weight: bold; }
</style>";

// Check 1: Database exists
echo "<h2>1. Database Connection</h2>";
$databases = $conn->query("SHOW DATABASES");
$db_exists = false;

while ($row = $databases->fetch_assoc()) {
    if ($row['Database'] === $database) {
        $db_exists = true;
        break;
    }
}

if ($db_exists) {
    echo "<div class='success'>✓ Database '<code>$database</code>' exists</div>";
    
    // Select the database
    $conn->select_db($database);
    
    // Check 2: Table exists
    echo "<h2>2. Captures Table</h2>";
    $tables = $conn->query("SHOW TABLES");
    $table_exists = false;
    $tables_list = [];
    
    while ($row = $tables->fetch_row()) {
        $tables_list[] = $row[0];
        if ($row[0] === 'captures') {
            $table_exists = true;
        }
    }
    
    echo "<p><strong>Tables in database:</strong> " . implode(', ', $tables_list) . "</p>";
    
    if ($table_exists) {
        echo "<div class='success'>✓ Table '<code>captures</code>' exists</div>";
        
        // Check 3: Table structure
        echo "<h2>3. Table Structure</h2>";
        $columns = $conn->query("DESCRIBE captures");
        
        if ($columns) {
            echo "<table>";
            echo "<thead><tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr></thead>";
            echo "<tbody>";
            while ($col = $columns->fetch_assoc()) {
                echo "<tr>";
                echo "<td><code>" . $col['Field'] . "</code></td>";
                echo "<td>" . $col['Type'] . "</td>";
                echo "<td>" . $col['Null'] . "</td>";
                echo "<td>" . $col['Key'] . "</td>";
                echo "<td>" . ($col['Default'] ?? 'N/A') . "</td>";
                echo "<td>" . $col['Extra'] . "</td>";
                echo "</tr>";
            }
            echo "</tbody>";
            echo "</table>";
        }
        
        // Check 4: Sample data
        echo "<h2>4. Sample Data</h2>";
        $count = $conn->query("SELECT COUNT(*) as total FROM captures")->fetch_assoc();
        echo "<div class='info'><strong>Total records in captures table:</strong> " . $count['total'] . "</div>";
        
        $recent = $conn->query("SELECT * FROM captures ORDER BY id DESC LIMIT 5");
        if ($recent && $count['total'] > 0) {
            echo "<h3>Latest 5 captures:</h3>";
            echo "<table>";
            echo "<thead><tr><th>ID</th><th>Class</th><th>Model</th><th>Confidence</th><th>Sensor PPM</th><th>Captured At</th></tr></thead>";
            echo "<tbody>";
            while ($row = $recent->fetch_assoc()) {
                echo "<tr>";
                echo "<td>" . $row['id'] . "</td>";
                echo "<td>" . $row['class_detected'] . "</td>";
                echo "<td>" . $row['model_name'] . "</td>";
                echo "<td>" . ($row['confidence'] ? (round($row['confidence'] * 100, 1) . '%') : 'N/A') . "</td>";
                echo "<td>" . ($row['sensor_ppm'] ? round($row['sensor_ppm'], 2) : 'N/A') . "</td>";
                echo "<td>" . $row['taken_at'] . "</td>";
                echo "</tr>";
            }
            echo "</tbody>";
            echo "</table>";
        } else {
            echo "<div class='warning'>⚠ No data in captures table yet</div>";
        }
        
        // Check 5: Test INSERT
        echo "<h2>5. Test INSERT Operation</h2>";
        $test_image = 'uploads/test_' . time() . '.jpg';
        $test_sql = "INSERT INTO captures (image_path, class_detected, confidence, model_name, sensor_ppm, storage_condition, taken_at) 
                    VALUES ('$test_image', 'Test Detection', 0.95, 'test_model.pt', 1.5, 'below4', NOW())";
        
        if ($conn->query($test_sql)) {
            $insert_id = $conn->insert_id;
            echo "<div class='success'>✓ Test INSERT successful! ID: $insert_id</div>";
            
            // Delete the test record
            $conn->query("DELETE FROM captures WHERE id = $insert_id");
            echo "<div class='success'>✓ Test record cleaned up</div>";
        } else {
            echo "<div class='error'>✗ Test INSERT failed: " . $conn->error . "</div>";
        }
        
    } else {
        echo "<div class='error'>✗ Table '<code>captures</code>' does not exist</div>";
        echo "<p><strong>To create the table, run the following SQL:</strong></p>";
        echo "<pre><code>" . htmlspecialchars(file_get_contents('database_schema.sql')) . "</code></pre>";
    }
} else {
    echo "<div class='error'>✗ Database '<code>$database</code>' does not exist</div>";
    echo "<p><strong>Available databases:</strong> " . implode(', ', $tables_list ?? []) . "</p>";
    echo "<p>Please create the database first:</p>";
    echo "<pre><code>CREATE DATABASE $database;</code></pre>";
}

// Check 6: Debug log
echo "<h2>6. Debug Log</h2>";
$log_file = __DIR__ . '/capture_debug.log';
if (file_exists($log_file)) {
    $log_content = file_get_contents($log_file);
    $log_lines = array_reverse(explode("\n", $log_content));
    
    echo "<p><strong>Last 20 log entries:</strong> (from <code>$log_file</code>)</p>";
    echo "<pre style='background: #f0f0f0; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 400px; overflow-y: auto;'>";
    $count = 0;
    foreach ($log_lines as $line) {
        if (!empty(trim($line))) {
            echo htmlspecialchars($line) . "\n";
            $count++;
            if ($count >= 20) break;
        }
    }
    echo "</pre>";
} else {
    echo "<div class='warning'>⚠ No debug log file found yet. It will be created on first request.</div>";
}

// Check 7: API endpoint test
echo "<h2>7. API Health Check</h2>";
echo "<p>Test the capture_handler.php endpoint:</p>";
echo "<pre><code>POST /capture_handler.php
Content-Type: application/json

{
  \"action\": \"get_statistics\"
}
</code></pre>";

echo "<p><strong>PHP Configuration:</strong></p>";
echo "<ul>";
echo "<li>PHP Version: " . phpversion() . "</li>";
echo "<li>MySQLi Support: " . (extension_loaded('mysqli') ? '✓ YES' : '✗ NO') . "</li>";
echo "<li>Max Upload Size: " . ini_get('upload_max_filesize') . "</li>";
echo "<li>Display Errors: " . (ini_get('display_errors') ? 'ON' : 'OFF') . "</li>";
echo "</ul>";

echo "<h2>Quick Setup Checklist</h2>";
echo "<ul>";
echo "<li>" . ($db_exists ? "✓" : "✗") . " Database 'cpe220937' exists</li>";
echo "<li>" . ($table_exists ? "✓" : "✗") . " Table 'captures' exists</li>";
echo "<li>" . (file_exists('capture_handler.php') ? "✓" : "✗") . " capture_handler.php exists</li>";
echo "<li>" . (file_exists('capture_database.js') ? "✓" : "✗") . " capture_database.js exists</li>";
echo "<li>" . (extension_loaded('mysqli') ? "✓" : "✗") . " MySQLi PHP extension loaded</li>";
echo "</ul>";

$conn->close();
?>
