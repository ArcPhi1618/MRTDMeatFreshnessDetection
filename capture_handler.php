<?php
/**
 * Capture Database Handler
 * Handles all database operations for the Meat Freshness Detection System
 * Processes AJAX requests from capture_database.js
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Create log file for debugging
$log_file = __DIR__ . '/capture_debug.log';
function addLog($message) {
    global $log_file;
    file_put_contents($log_file, date('Y-m-d H:i:s') . ' - ' . $message . "\n", FILE_APPEND);
}

// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'cpe220937');

// Response headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Log incoming request
addLog('Incoming request: ' . $_SERVER['REQUEST_METHOD']);

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Initialize database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    addLog('Database connection failed: ' . $conn->connect_error);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $conn->connect_error
    ]);
    exit();
}

// Set charset to utf8mb4
$conn->set_charset('utf8mb4');
addLog('Database connected successfully');

// Get request data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['action'])) {
    addLog('Invalid request: missing action parameter');
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request: action parameter required'
    ]);
    exit();
}

$action = $input['action'];
addLog('Action requested: ' . $action);

// Route to appropriate handler
switch ($action) {
    case 'save_capture':
        saveCapture($conn, $input);
        break;
    case 'get_all_captures':
        getAllCaptures($conn, $input);
        break;
    case 'capture_frame':
        captureFrame($input);
        break;
    /**
     * Capture ESP32 stream frame and upload to uploads/
     */
    function captureFrame($input) {
        $stream_url = isset($input['stream_url']) ? $input['stream_url'] : '';
        $output_path = isset($input['output_path']) ? $input['output_path'] : '';
        if (!$stream_url || !$output_path) {
            echo json_encode(['status' => 'error', 'message' => 'Missing stream_url or output_path']);
            return;
        }
        $uploads_dir = __DIR__ . '/uploads';
        if (!is_dir($uploads_dir)) {
            mkdir($uploads_dir, 0777, true);
        }
        $full_output_path = $uploads_dir . '/' . basename($output_path);
        $cmd = escapeshellcmd("python capture_frame.py " . escapeshellarg($stream_url) . " " . escapeshellarg($full_output_path));
        exec($cmd, $output, $ret);
        if ($ret === 0 && file_exists($full_output_path)) {
            $web_path = 'uploads/' . basename($output_path);
            echo json_encode(['status' => 'ok', 'path' => $web_path]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to capture frame', 'output' => $output]);
        }
    }
    case 'get_capture':
        getCapture($conn, $input);
        break;
    case 'get_statistics':
        getStatistics($conn);
        break;
    case 'delete_capture':
        deleteCapture($conn, $input);
        break;
    case 'update_storage_condition':
        updateStorageCondition($conn, $input);
        break;
    case 'search_by_date':
        searchByDate($conn, $input);
        break;
    case 'search_by_class':
        searchByClass($conn, $input);
        break;
    default:
        addLog('Unknown action: ' . $action);
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Unknown action: ' . $action
        ]);
        break;
}

$conn->close();

// ========== HANDLER FUNCTIONS ==========

/**
 * Save a new capture record to the database
 */
function saveCapture($conn, $input) {
    addLog('saveCapture called');
    addLog('Input data: ' . json_encode($input));
    
    // Validate required fields
    $required = ['image_path', 'class_detected', 'model_name'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            addLog("Missing required field: $field");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Missing required field: $field"
            ]);
            return;
        }
    }

    $image_path = $conn->real_escape_string($input['image_path']);
    $class_detected = $conn->real_escape_string($input['class_detected']);
    $confidence = isset($input['confidence']) ? floatval($input['confidence']) : null;
    $model_name = $conn->real_escape_string($input['model_name']);
    $sensor_ppm = isset($input['sensor_ppm']) ? floatval($input['sensor_ppm']) : null;
    $storage_condition = isset($input['storage_condition']) ? $conn->real_escape_string($input['storage_condition']) : null;
    $notes = isset($input['notes']) ? $conn->real_escape_string($input['notes']) : null;

    // Use current timestamp for taken_at if not provided
    $taken_at = date('Y-m-d H:i:s');

    $sql = "INSERT INTO captures (image_path, class_detected, confidence, model_name, sensor_ppm, storage_condition, notes, taken_at) 
            VALUES ('$image_path', '$class_detected', " . ($confidence !== null ? $confidence : "NULL") . ", '$model_name', " . ($sensor_ppm !== null ? $sensor_ppm : "NULL") . ", " . ($storage_condition ? "'$storage_condition'" : "NULL") . ", " . ($notes ? "'$notes'" : "NULL") . ", '$taken_at')";

    addLog('SQL Query: ' . $sql);

    if ($conn->query($sql) === TRUE) {
        $capture_id = $conn->insert_id;
        addLog("Capture saved successfully with ID: $capture_id");
        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Capture saved successfully',
            'capture_id' => $capture_id,
            'taken_at' => $taken_at
        ]);
    } else {
        $error = $conn->error;
        $errno = $conn->errno;
        addLog("Database error (errno=$errno): $error");
        addLog("Failed SQL: $sql");
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $error,
            'sql_error_code' => $errno,
            'debug_sql' => $sql
        ]);
    }
}

/**
 * Get all captures with optional filters
 */
function getAllCaptures($conn, $input) {
    $filters = isset($input['filters']) ? $input['filters'] : [];
    
    $sql = "SELECT * FROM captures WHERE 1=1";

    // Apply filters
    if (isset($filters['class_detected']) && !empty($filters['class_detected'])) {
        $class = $conn->real_escape_string($filters['class_detected']);
        $sql .= " AND class_detected LIKE '%$class%'";
    }

    if (isset($filters['model_name']) && !empty($filters['model_name'])) {
        $model = $conn->real_escape_string($filters['model_name']);
        $sql .= " AND model_name LIKE '%$model%'";
    }

    // Order by most recent first
    $sql .= " ORDER BY taken_at DESC";

    // Pagination
    $limit = isset($filters['limit']) ? intval($filters['limit']) : 50;
    $offset = isset($filters['offset']) ? intval($filters['offset']) : 0;
    $sql .= " LIMIT $offset, $limit";

    $result = $conn->query($sql);

    if ($result) {
        $captures = [];
        while ($row = $result->fetch_assoc()) {
            $captures[] = $row;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'count' => count($captures),
            'data' => $captures
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $conn->error
        ]);
    }
}

/**
 * Get a specific capture by ID
 */
function getCapture($conn, $input) {
    if (!isset($input['capture_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing capture_id'
        ]);
        return;
    }

    $capture_id = intval($input['capture_id']);
    $sql = "SELECT * FROM captures WHERE id = $capture_id";
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $capture = $result->fetch_assoc();
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $capture
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Capture not found'
        ]);
    }
}

/**
 * Get database statistics
 */
function getStatistics($conn) {
    $sql = "SELECT 
                COUNT(*) as total_captures,
                SUM(CASE WHEN class_detected LIKE '%Fresh%' THEN 1 ELSE 0 END) as fresh_detections,
                SUM(CASE WHEN class_detected LIKE '%Spoiled%' THEN 1 ELSE 0 END) as spoiled_detections,
                AVG(confidence) as average_confidence,
                AVG(sensor_ppm) as average_sensor_ppm,
                MIN(DATE(taken_at)) as date_range_start,
                MAX(DATE(taken_at)) as date_range_end
            FROM captures";

    $result = $conn->query($sql);

    if ($result) {
        $stats = $result->fetch_assoc();
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $stats
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $conn->error
        ]);
    }
}

/**
 * Delete a capture by ID
 */
function deleteCapture($conn, $input) {
    if (!isset($input['capture_id'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing capture_id'
        ]);
        return;
    }

    $capture_id = intval($input['capture_id']);
    
    // Get image path before deleting to also delete the file
    $sql_select = "SELECT image_path FROM captures WHERE id = $capture_id";
    $result = $conn->query($sql_select);
    
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $image_path = $row['image_path'];
        
        // Delete database record
        $sql_delete = "DELETE FROM captures WHERE id = $capture_id";
        
        if ($conn->query($sql_delete) === TRUE) {
            // Optionally delete the image file
            if (!empty($image_path) && file_exists($image_path)) {
                unlink($image_path);
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Capture deleted successfully'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $conn->error
            ]);
        }
    } else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Capture not found'
        ]);
    }
}

/**
 * Update storage condition for a capture
 */
function updateStorageCondition($conn, $input) {
    if (!isset($input['capture_id']) || !isset($input['storage_condition'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing capture_id or storage_condition'
        ]);
        return;
    }

    $capture_id = intval($input['capture_id']);
    $storage_condition = $conn->real_escape_string($input['storage_condition']);

    $sql = "UPDATE captures SET storage_condition = '$storage_condition' WHERE id = $capture_id";

    if ($conn->query($sql) === TRUE) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Storage condition updated successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $conn->error
        ]);
    }
}

/**
 * Search captures by date range
 */
function searchByDate($conn, $input) {
    if (!isset($input['start_date']) || !isset($input['end_date'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing start_date or end_date'
        ]);
        return;
    }

    $start_date = $conn->real_escape_string($input['start_date']);
    $end_date = $conn->real_escape_string($input['end_date']);

    $sql = "SELECT * FROM captures WHERE DATE(taken_at) BETWEEN '$start_date' AND '$end_date' ORDER BY taken_at DESC";
    $result = $conn->query($sql);

    if ($result) {
        $captures = [];
        while ($row = $result->fetch_assoc()) {
            $captures[] = $row;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'count' => count($captures),
            'data' => $captures
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $conn->error
        ]);
    }
}

/**
 * Search captures by class detected
 */
function searchByClass($conn, $input) {
    if (!isset($input['class_detected'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing class_detected'
        ]);
        return;
    }

    $class_detected = $conn->real_escape_string($input['class_detected']);
    $sql = "SELECT * FROM captures WHERE class_detected LIKE '%$class_detected%' ORDER BY taken_at DESC";
    $result = $conn->query($sql);

    if ($result) {
        $captures = [];
        while ($row = $result->fetch_assoc()) {
            $captures[] = $row;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'count' => count($captures),
            'data' => $captures
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $conn->error
        ]);
    }
}
?>
