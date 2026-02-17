-- Database for Meat Freshness Detection System
-- This database records all image captures, detections, and sensor readings

CREATE DATABASE IF NOT EXISTS cpe220937;
USE cpe220937;

-- Main table for storing capture records
CREATE TABLE IF NOT EXISTS captures (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for each capture',
    image_path VARCHAR(500) NOT NULL COMMENT 'Path to the captured image in uploads/ folder',
    class_detected VARCHAR(100) NOT NULL COMMENT 'Class detected by the model (e.g., Fresh Chicken, Fresh Pork, Spoiled)',
    confidence FLOAT DEFAULT NULL COMMENT 'Confidence score of the detection (0-1)',
    model_name VARCHAR(150) NOT NULL COMMENT 'Name/filename of the model used for detection',
    sensor_ppm FLOAT DEFAULT NULL COMMENT 'PPM (parts per million) reading from MQ-137 sensor at time of capture',
    taken_at DATETIME NOT NULL COMMENT 'Timestamp when the image was captured',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when the record was created in database',
    storage_condition VARCHAR(50) DEFAULT NULL COMMENT 'Storage condition selected (below4, neg18, above4)',
    notes TEXT DEFAULT NULL COMMENT 'Additional notes or observations',
    
    INDEX idx_taken_at (taken_at) COMMENT 'Index for fast queries by capture time',
    INDEX idx_class_detected (class_detected) COMMENT 'Index for filtering by detected class',
    INDEX idx_model_name (model_name) COMMENT 'Index for filtering by model used',
    INDEX idx_created_at (created_at) COMMENT 'Index for chronological queries'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores all meat freshness detection captures and sensor data';
