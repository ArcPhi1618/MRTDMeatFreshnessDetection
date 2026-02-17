/**
 * Usage Examples for Capture Database System
 * Shows how to use capture_database.js with the backend
 */

// ========== EXAMPLE 1: Save a Capture After Detection ==========
async function saveDetectionResult(predictionData, sensorData, modelName) {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const captureData = {
            imagePath: predictionData.imagePath || 'uploads/capture_' + Date.now() + '.jpg',
            classDetected: predictionData.class || predictionData.className, // e.g., "Fresh Chicken"
            confidence: predictionData.confidence || 0, // e.g., 0.95
            modelName: modelName || 'unknown',
            sensorPpm: sensorData.ppm || sensorData.nh3_ppm || null, // e.g., 1.5
            storageCondition: document.getElementById('freshnessSelection')?.value || null
        };

        const result = await captureDB.saveCapture(captureData);
        console.log('Capture saved:', result);
        alert('Detection saved with ID: ' + result.capture_id);
        return result;
    } catch (error) {
        console.error('Failed to save capture:', error);
        alert('Error saving capture: ' + error.message);
        throw error;
    }
}

// ========== EXAMPLE 2: Retrieve All Captures ==========
async function displayAllCaptures() {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const filters = {
            limit: 50,
            offset: 0
        };
        
        const captures = await captureDB.getAllCaptures(filters);
        console.log('All captures:', captures);
        
        const capturesTableElement = document.getElementById('capturesTable');
        if (!capturesTableElement) {
            console.warn('Element "capturesTable" not found');
            return captures;
        }

        // Display in HTML table
        let html = '<table border="1" style="width: 100%; border-collapse: collapse;"><thead><tr><th>ID</th><th>Class</th><th>Confidence</th><th>Sensor PPM</th><th>Date</th><th>Model</th><th>Storage</th><th>Action</th></tr></thead><tbody>';
        
        if (captures.length === 0) {
            html += '<tr><td colspan="8" style="text-align: center; padding: 20px;">No captures found</td></tr>';
        } else {
            captures.forEach(capture => {
                html += `<tr>
                    <td>${capture.id}</td>
                    <td>${capture.class_detected || 'N/A'}</td>
                    <td>${capture.confidence ? (capture.confidence * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td>${capture.sensor_ppm ? capture.sensor_ppm.toFixed(2) : 'N/A'}</td>
                    <td>${capture.taken_at || 'N/A'}</td>
                    <td>${capture.model_name || 'N/A'}</td>
                    <td>${capture.storage_condition || 'N/A'}</td>
                    <td><button onclick="viewCaptureDetails(${capture.id})">View</button></td>
                </tr>`;
            });
        }
        
        html += '</tbody></table>';
        capturesTableElement.innerHTML = html;
        return captures;
    } catch (error) {
        console.error('Failed to load captures:', error);
        alert('Error loading captures: ' + error.message);
    }
}

// ========== EXAMPLE 3: Search by Date Range ==========
async function searchCapturesByDate() {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (!startDateInput || !endDateInput) {
            alert('Date input elements not found');
            return;
        }

        const startDate = startDateInput.value; // YYYY-MM-DD
        const endDate = endDateInput.value;
        
        if (!startDate || !endDate) {
            alert('Please enter both start and end dates');
            return;
        }

        const captures = await captureDB.searchByDateRange(startDate, endDate);
        console.log('Captures in date range:', captures);
        
        alert('Found ' + captures.length + ' captures between ' + startDate + ' and ' + endDate);
        return captures;
    } catch (error) {
        console.error('Search failed:', error);
        alert('Error searching captures: ' + error.message);
    }
}

// ========== EXAMPLE 4: Search by Meat Class ==========
async function searchByMeatClass() {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const classInput = document.getElementById('classFilter');
        const meatClass = classInput ? classInput.value : 'Fresh Chicken'; // or 'Fresh Pork' or 'Spoiled'
        
        if (!meatClass) {
            alert('Please enter a class to search');
            return;
        }

        const captures = await captureDB.searchByClass(meatClass);
        console.log('Captures for ' + meatClass + ':', captures);
        
        alert('Found ' + captures.length + ' captures of ' + meatClass);
        return captures;
    } catch (error) {
        console.error('Search failed:', error);
        alert('Error searching by class: ' + error.message);
    }
}

// ========== EXAMPLE 5: Get Statistics ==========
async function displayStatistics() {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const stats = await captureDB.getStatistics();
        console.log('Statistics:', stats);
        
        const elements = {
            totalCaptures: document.getElementById('totalCaptures'),
            freshCount: document.getElementById('freshCount'),
            spoiledCount: document.getElementById('spoiledCount'),
            avgConfidence: document.getElementById('avgConfidence'),
            avgSensorPpm: document.getElementById('avgSensorPpm')
        };

        // Update elements if they exist
        if (elements.totalCaptures) elements.totalCaptures.textContent = stats.total_captures || 0;
        if (elements.freshCount) elements.freshCount.textContent = stats.fresh_detections || 0;
        if (elements.spoiledCount) elements.spoiledCount.textContent = stats.spoiled_detections || 0;
        if (elements.avgConfidence) elements.avgConfidence.textContent = stats.average_confidence ? (stats.average_confidence * 100).toFixed(1) + '%' : 'N/A';
        if (elements.avgSensorPpm) elements.avgSensorPpm.textContent = stats.average_sensor_ppm ? stats.average_sensor_ppm.toFixed(2) + ' PPM' : 'N/A';

        console.log('Statistics updated on page');
        return stats;
    } catch (error) {
        console.error('Failed to get statistics:', error);
        alert('Error loading statistics: ' + error.message);
    }
}

// ========== EXAMPLE 6: Get Single Capture Details ==========
async function viewCaptureDetails(captureId) {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        if (!captureId) {
            alert('Please enter a capture ID');
            return;
        }

        const capture = await captureDB.getCaptureById(captureId);
        console.log('Capture details:', capture);
        
        // Update image if element exists
        const imageElement = document.getElementById('captureImage');
        if (imageElement && capture.image_path) {
            imageElement.src = capture.image_path;
            imageElement.style.maxWidth = '500px';
            imageElement.style.maxHeight = '500px';
            imageElement.style.marginTop = '10px';
        }

        // Update details if element exists
        const detailsElement = document.getElementById('detailsDiv');
        if (detailsElement) {
            detailsElement.innerHTML = `
                <div style="margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    <h3>Capture Details (ID: ${capture.id})</h3>
                    <p><strong>Class:</strong> ${capture.class_detected || 'N/A'}</p>
                    <p><strong>Confidence:</strong> ${capture.confidence ? (capture.confidence * 100).toFixed(1) + '%' : 'N/A'}</p>
                    <p><strong>Sensor PPM:</strong> ${capture.sensor_ppm ? capture.sensor_ppm.toFixed(2) : 'N/A'}</p>
                    <p><strong>Model:</strong> ${capture.model_name || 'N/A'}</p>
                    <p><strong>Storage Condition:</strong> ${capture.storage_condition || 'N/A'}</p>
                    <p><strong>Captured At:</strong> ${capture.taken_at || 'N/A'}</p>
                    <p><strong>Notes:</strong> ${capture.notes || 'None'}</p>
                    <button onclick="deleteCapture(${capture.id})" style="padding: 10px 15px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete Capture</button>
                </div>
            `;
        }
        
        return capture;
    } catch (error) {
        console.error('Failed to load capture:', error);
        alert('Error loading capture: ' + error.message);
    }
}

// ========== EXAMPLE 7: Update Storage Condition ==========
async function updateStorageCondition(captureId, condition) {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        if (!captureId || !condition) {
            alert('Please provide both capture ID and storage condition');
            return;
        }

        const result = await captureDB.updateStorageCondition(captureId, condition);
        console.log('Updated:', result);
        alert('Storage condition updated to: ' + condition);
        
        // Refresh details if viewing
        viewCaptureDetails(captureId);
        return result;
    } catch (error) {
        console.error('Failed to update:', error);
        alert('Error updating storage condition: ' + error.message);
    }
}

// ========== EXAMPLE 8: Delete a Capture ==========
async function deleteCapture(captureId) {
    if (!confirm('Are you sure you want to delete this capture? This action cannot be undone.')) {
        return;
    }
    
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const result = await captureDB.deleteCapture(captureId);
        console.log('Deleted:', result);
        alert('Capture deleted successfully');
        
        // Refresh the captures list and clear details
        displayAllCaptures();
        const detailsElement = document.getElementById('detailsDiv');
        if (detailsElement) {
            detailsElement.innerHTML = '';
        }
        
        return result;
    } catch (error) {
        console.error('Failed to delete:', error);
        alert('Error deleting capture: ' + error.message);
    }
}

// ========== EXAMPLE 9: Generate Report ==========
async function generateReport() {
    try {
        if (typeof captureDB === 'undefined') {
            console.error('captureDB not loaded');
            return;
        }

        const captures = await captureDB.getAllCaptures({ limit: 1000 });
        const stats = await captureDB.getStatistics();
        
        let report = `
==============================================
MEAT FRESHNESS DETECTION SYSTEM - REPORT
Generated: ${new Date().toLocaleString()}
==============================================

STATISTICS:
- Total Captures: ${stats.total_captures || 0}
- Fresh Detections: ${stats.fresh_detections || 0}
- Spoiled Detections: ${stats.spoiled_detections || 0}
- Average Confidence: ${stats.average_confidence ? (stats.average_confidence * 100).toFixed(1) + '%' : 'N/A'}
- Average Sensor PPM: ${stats.average_sensor_ppm ? stats.average_sensor_ppm.toFixed(2) : 'N/A'}
- Data Range: ${stats.date_range_start || 'N/A'} to ${stats.date_range_end || 'N/A'}

CAPTURES:
----------------------------------------------
`;
        
        if (captures.length === 0) {
            report += 'No captures found\n';
        } else {
            captures.forEach((capture, index) => {
                report += `
${index + 1}. ID: ${capture.id}
   Class: ${capture.class_detected || 'N/A'}
   Confidence: ${capture.confidence ? (capture.confidence * 100).toFixed(1) + '%' : 'N/A'}
   Model: ${capture.model_name || 'N/A'}
   Sensor PPM: ${capture.sensor_ppm ? capture.sensor_ppm.toFixed(2) : 'N/A'}
   Date: ${capture.taken_at || 'N/A'}
   Storage Condition: ${capture.storage_condition || 'N/A'}
`;
            });
        }
        
        report += `
==============================================
End of Report
==============================================
`;
        
        console.log(report);
        
        // Optional: Download as text file
        const reportElement = document.getElementById('reportDiv');
        if (reportElement) {
            reportElement.innerHTML = '<pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">' + report.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
            reportElement.innerHTML += '<button onclick="downloadReport()">Download Report as TXT</button>';
        }
        
        return report;
    } catch (error) {
        console.error('Failed to generate report:', error);
        alert('Error generating report: ' + error.message);
    }
}

// ========== HELPER: Download Report ==========
function downloadReport() {
    const reportElement = document.getElementById('reportDiv');
    if (!reportElement) {
        alert('Report not found');
        return;
    }

    const text = reportElement.textContent;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', 'report_' + new Date().toISOString().split('T')[0] + '.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// ========== INITIALIZATION ==========
/**
 * Initialize the capture viewer UI
 * Call this when the page loads if you have the HTML elements
 */
function initializeCaptureViewer() {
    console.log('[Capture Viewer] Initializing...');
    
    // Load initial data
    displayStatistics();
    displayAllCaptures();
    
    console.log('[Capture Viewer] Initialized');
}

// Auto-initialize if page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCaptureViewer);
} else {
    initializeCaptureViewer();
}

