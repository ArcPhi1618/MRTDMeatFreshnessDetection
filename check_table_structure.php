<?php
$conn = new mysqli('localhost', 'root', '', 'cpe220937');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "<h2>Captures Table Structure</h2>";
$result = $conn->query("DESCRIBE captures");
echo "<table border='1' cellpadding='10'>" .
     "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr>";

while ($row = $result->fetch_assoc()) {
    echo "<tr>";
    echo "<td>" . $row['Field'] . "</td>";
    echo "<td>" . $row['Type'] . "</td>";
    echo "<td>" . $row['Null'] . "</td>";
    echo "<td>" . $row['Key'] . "</td>";
    echo "<td>" . $row['Default'] . "</td>";
    echo "<td>" . $row['Extra'] . "</td>";
    echo "</tr>";
}
echo "</table>";

echo "<h2>Create Table Statement</h2>";
$result = $conn->query("SHOW CREATE TABLE captures");
$row = $result->fetch_assoc();
echo "<pre>" . htmlspecialchars($row['Create Table']) . "</pre>";

$conn->close();
?>
