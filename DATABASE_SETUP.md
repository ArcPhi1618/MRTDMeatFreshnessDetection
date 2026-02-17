# Capture Database System - Setup & Usage Guide

## Files Overview

### 1. **capture_database.js** (Frontend - Isolated)
JavaScript class that handles all database operations via AJAX calls.

**Features:**
- `saveCapture()` - Save detection results
- `getAllCaptures()` - Retrieve all captures with filters
- `getCaptureById()` - Get specific capture details
- `getStatistics()` - Get database statistics
- `deleteCapture()` - Delete a capture record
- `updateStorageCondition()` - Update storage info
- `searchByDateRange()` - Search captures by date
- `searchByClass()` - Search captures by meat class

**Usage:**
```javascript
// Include in your HTML
<script src="capture_database.js"></script>

// Use the global instance
const result = await captureDB.saveCapture({
    imagePath: 'uploads/image.jpg',
    classDetected: 'Fresh Chicken',
    confidence: 0.95,
    modelName: 'model_v1.pt',
    sensorPpm: 1.5,
    storageCondition: 'below4'
});
```

### 2. **capture_handler.php** (Backend - Isolated)
PHP backend that processes all AJAX requests and manages database operations.

**Database Configuration:**
Edit these settings at the top of the file:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'meat_freshness_detection');
```

**Endpoints Handled:**
- `save_capture` - Insert new capture record
- `get_all_captures` - Retrieve all captures with pagination
- `get_capture` - Get single capture by ID
- `get_statistics` - Get database statistics
- `delete_capture` - Delete capture record
- `update_storage_condition` - Update storage condition
- `search_by_date` - Search by date range
- `search_by_class` - Search by meat class

**Security Features:**
- Input validation
- SQL injection prevention (using `real_escape_string()`)
- CORS headers support
- Proper HTTP status codes
- Comprehensive error handling

### 3. **capture_usage_examples.js** (Reference)
Practical examples showing how to use the database system.

**Includes examples for:**
- Saving detection results
- Loading and displaying captures
- Searching by date range
- Searching by meat class
- Displaying statistics
- Viewing capture details
- Updating storage conditions
- Deleting captures

---

## Setup Instructions

### Step 1: Create Database
Run the SQL from `database_schema.sql`:
```sql
-- In phpMyAdmin or MySQL client, paste and execute:
CREATE DATABASE meat_freshness_detection;
USE meat_freshness_detection;
-- ... (paste contents of database_schema.sql)
```

### Step 2: Update PHP Configuration
Edit `capture_handler.php` to match your database credentials:
```php
define('DB_USER', 'your_db_user');
define('DB_PASS', 'your_db_password');
```

### Step 3: Include JavaScript in Your HTML
Add to your page (e.g., cpe-mrtd-main2.php):
```html
<script src="capture_database.js"></script>
<!-- Use captureDB anywhere on the page -->
```

### Step 4: Integrate with Your Detection System
After getting predictions from the model:
```javascript
// In your detection handler (cpe-mrtd_main.js)
async function saveDetection() {
    const result = await captureDB.saveCapture({
        imagePath: 'uploads/detection_' + Date.now() + '.jpg',
        classDetected: 'Fresh Chicken', // from model
        confidence: 0.95,
        modelName: 'model_v2.pt',
        sensorPpm: 1.5, // from MQ-137 sensor
        storageCondition: document.getElementById('freshnessSelection').value
    });
    console.log('Saved capture ID:', result.capture_id);
}
```

---

## Data Flow

```
User Action (Capture Detection)
    ↓
capture_database.js (Frontend)
    ↓
AJAX POST Request to capture_handler.php
    ↓
capture_handler.php (Backend)
    ↓
MySQL Database
    ↓
Response JSON to Frontend
    ↓
Update UI / Display Results
```

---

## Example Integration with cpe-mrtd-main2.php

Add this script tag before closing body:
```html
<script src="capture_database.js"></script>

<script>
// After detection is complete
document.getElementById('captureBtn').addEventListener('click', async function() {
    // Your existing detection code...
    
    // Save to database
    try {
        const result = await captureDB.saveCapture({
            imagePath: 'uploads/capture_' + Date.now() + '.jpg',
            classDetected: detectionClass,
            confidence: detectionConfidence,
            modelName: currentModelName,
            sensorPpm: currentSensorPpm,
            storageCondition: document.getElementById('freshnessSelection').value
        });
        
        console.log('Capture saved successfully');
        alert('Detection saved. ID: ' + result.capture_id);
    } catch (error) {
        console.error('Failed to save:', error);
    }
});
</script>
```

---

## Database Table Structure

### captures table
| Column | Type | Purpose |
|--------|------|---------|
| id | INT | Auto-increment ID |
| image_path | VARCHAR(500) | Path to uploaded image |
| class_detected | VARCHAR(100) | Detected class (Fresh Chicken, etc.) |
| confidence | FLOAT | Confidence score 0-1 |
| model_name | VARCHAR(150) | Model filename/name |
| sensor_ppm | FLOAT | MQ-137 sensor reading |
| storage_condition | VARCHAR(50) | Selected storage temp condition |
| taken_at | DATETIME | When image was captured |
| created_at | DATETIME | When record was created |
| notes | TEXT | Additional notes |

---

## Troubleshooting

### Database Connection Error
- Check credentials in capture_handler.php
- Verify MySQL server is running
- Check database and tables exist

### AJAX 404 Error
- Verify capture_handler.php is in the root directory
- Check file permissions
- Check AJAX endpoint path in capture_database.js

### No Data Returned
- Check database credentials
- Verify table exists and has data
- Check browser console for errors

### CORS Issues
- capture_handler.php includes CORS headers
- If still issues, add to header of PHP file:
```php
header('Access-Control-Allow-Origin: *');
```

---

## Performance Tips

1. **Add Database Indexes** (already included in schema):
   - Index on `taken_at` for faster date searches
   - Index on `class_detected` for filtering

2. **Use Pagination** in searches:
   ```javascript
   const captures = await captureDB.getAllCaptures({
       limit: 50,
       offset: 0
   });
   ```

3. **Cache Statistics** if queried frequently

4. **Archive Old Records** periodically

---

## Security Notes

- ✅ Input validation on all endpoints
- ✅ SQL injection prevention
- ✅ Proper error handling without exposing sensitive info
- ⚠️ Consider adding authentication for production
- ⚠️ Consider using prepared statements (mysqli_prepare) for extra security

---

## Future Enhancements

1. Add user authentication
2. Implement file upload handling
3. Add automatic image compression
4. Add data export (CSV, PDF)
5. Add analytics dashboard
6. Use prepared statements instead of string escaping
7. Add rate limiting
8. Add data validation layers

---

## Support Files

- `database_schema.sql` - Complete database structure
- `capture_usage_examples.js` - Reference implementation examples
- `capture_database.js` - Frontend JavaScript library
- `capture_handler.php` - Backend PHP handler
