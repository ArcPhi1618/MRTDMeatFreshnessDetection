// Database Handler for Meat Freshness Detection System
// This JS file handles all database-related AJAX calls to the server

class CaptureDatabase {
    constructor() {
        this.apiEndpoint = 'capture_handler.php';
    }

    /**
     * Save a capture record to the database
     * @param {Object} captureData - Object containing all capture information
     * @returns {Promise} - Server response
     */
    async saveCapture(captureData) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'save_capture',
                    image_path: captureData.imagePath,
                    class_detected: captureData.classDetected,
                    confidence: captureData.confidence,
                    model_name: captureData.modelName,
                    sensor_ppm: captureData.sensorPpm,
                    storage_condition: captureData.storageCondition,
                    notes: captureData.notes || null
                })
            });

            const result = await response.json();
            console.log('[CaptureDatabase] Save capture response:', result);
            
            if (result.success) {
                console.log('[CaptureDatabase] Capture saved successfully with ID:', result.capture_id);
                return result;
            } else {
                throw new Error(result.message || 'Failed to save capture');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error saving capture:', error);
            throw error;
        }
    }

    /**
     * Get all captures from database
     * @param {Object} filters - Optional filters (limit, offset, class_detected, model_name, date_range)
     * @returns {Promise} - Array of captures
     */
    async getAllCaptures(filters = {}) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_all_captures',
                    filters: filters
                })
            });

            const result = await response.json();
            console.log('[CaptureDatabase] Get all captures response:', result);
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to retrieve captures');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error getting captures:', error);
            throw error;
        }
    }

    /**
     * Get a specific capture by ID
     * @param {number} captureId - ID of the capture to retrieve
     * @returns {Promise} - Capture object
     */
    async getCaptureById(captureId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_capture',
                    capture_id: captureId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to retrieve capture');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error getting capture:', error);
            throw error;
        }
    }

    /**
     * Get statistics about captures
     * @returns {Promise} - Statistics object
     */
    async getStatistics() {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'get_statistics'
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to retrieve statistics');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error getting statistics:', error);
            throw error;
        }
    }

    /**
     * Delete a capture record by ID
     * @param {number} captureId - ID of the capture to delete
     * @returns {Promise} - Success confirmation
     */
    async deleteCapture(captureId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete_capture',
                    capture_id: captureId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('[CaptureDatabase] Capture deleted successfully');
                return result;
            } else {
                throw new Error(result.message || 'Failed to delete capture');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error deleting capture:', error);
            throw error;
        }
    }

    /**
     * Update storage condition for a capture
     * @param {number} captureId - ID of the capture to update
     * @param {string} storageCondition - Storage condition (below4, neg18, above4)
     * @returns {Promise} - Success confirmation
     */
    async updateStorageCondition(captureId, storageCondition) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'update_storage_condition',
                    capture_id: captureId,
                    storage_condition: storageCondition
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('[CaptureDatabase] Storage condition updated');
                return result;
            } else {
                throw new Error(result.message || 'Failed to update storage condition');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error updating storage condition:', error);
            throw error;
        }
    }

    /**
     * Search captures by date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise} - Array of captures in date range
     */
    async searchByDateRange(startDate, endDate) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'search_by_date',
                    start_date: startDate,
                    end_date: endDate
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to search captures');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error searching captures:', error);
            throw error;
        }
    }

    /**
     * Search captures by class detected
     * @param {string} classDetected - Class to search for (e.g., "Fresh Chicken")
     * @returns {Promise} - Array of matching captures
     */
    async searchByClass(classDetected) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'search_by_class',
                    class_detected: classDetected
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to search by class');
            }
        } catch (error) {
            console.error('[CaptureDatabase] Error searching by class:', error);
            throw error;
        }
    }
}

// Initialize global instance for easy access
const captureDB = new CaptureDatabase();
