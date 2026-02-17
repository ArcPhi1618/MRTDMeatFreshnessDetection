
const uploadInput = document.getElementById('modelUpload');
const uploadStatus = document.getElementById('uploadStatus');

// ===== MODEL UPLOAD HANDLER =====
console.log('[DEBUG] Setting up model upload handler from cpe-mrtd_main.js');

// Handle model upload

console.log('[DEBUG] uploadInput:', uploadInput);
console.log('[DEBUG] uploadStatus:', uploadStatus);

if (uploadInput) {
    uploadInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        console.log('[DEBUG] File selected:', file?.name, 'Size:', file?.size);
        
        if (!file) {
            console.warn('[DEBUG] No file selected');
            if (uploadStatus) uploadStatus.innerHTML = '<span style="color:orange;">No file selected</span>';
            return;
        }
        
        const allowed = ['.pt', '.h5', '.keras'];
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        console.log('[DEBUG] File extension:', ext, 'Allowed:', allowed);
        
        if (!allowed.includes(ext)) {
            if (uploadStatus) uploadStatus.innerHTML = '<span style="color:#163556;">Only .pt, .h5, .keras files allowed</span>';
            console.warn('[DEBUG] Invalid file extension:', ext);
            return;
        }
        
        if (uploadStatus) uploadStatus.innerHTML = '<span style="color:blue;">Uploading ' + file.name + '...</span>';
        
        const formData = new FormData();
        formData.append('model', file);
        console.log('[DEBUG] FormData prepared, uploading to upload_model.php');
        
        try {
            const resp = await fetch('upload_model.php', { 
                method: 'POST', 
                body: formData 
            });
            console.log('[DEBUG] Upload response received, status:', resp.status);
            
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status);
            }
            
            const result = await resp.json();
            console.log('[DEBUG] Upload response JSON:', result);
            
            if (result.status === 'ok') {
                if (uploadStatus) uploadStatus.innerHTML = '<span style="color:green;">✓ ' + file.name + ' uploaded successfully!</span>';
                console.log('[DEBUG] Upload successful, refreshing model list');
                uploadInput.value = ''; // Reset file input
                setTimeout(loadModelList, 500); // Delay slightly to ensure file is written
            } else {
                if (uploadStatus) uploadStatus.innerHTML = '<span style="color:red;">Upload failed: ' + (result.message || 'Unknown error') + '</span>';
                console.warn('[DEBUG] Upload failed:', result);
            }
        } catch (err) {
            console.error('[DEBUG] Upload error:', err);
            if (uploadStatus) uploadStatus.innerHTML = '<span style="color:red;">Upload error: ' + err.message + '</span>';
        }
    });
    
    // Also allow drag-and-drop
    const modelLib = document.querySelector('.model-lib');
    if (modelLib) {
        modelLib.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modelLib.style.backgroundColor = '#f0f0f0';
        });
        modelLib.addEventListener('dragleave', () => {
            modelLib.style.backgroundColor = '';
        });
        modelLib.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modelLib.style.backgroundColor = '';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                uploadInput.files = files;
                // Trigger the change event manually
                uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
} else {
    console.error('[DEBUG] modelUpload element not found!');
}

// Load model list from server with cache-busting and error handling
// Get the current model from py-model_predict.py
async function getCurrentModel() {
    try {
        const response = await fetch('get_current_model.php');
        const data = await response.json();
        console.log('[DEBUG] Current model:', data.model);
        return data.model || 'cpe-mfmrtd-03.pt';
    } catch (err) {
        console.error('[DEBUG] Error getting current model:', err);
        return 'cpe-mfmrtd-03.pt'; // fallback
    }
}

// Change the active model
async function changeModel(modelName) {
    console.log('[DEBUG] Changing model to:', modelName);
    try {
        const resp = await fetch('set_model.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName })
        });
        const result = await resp.json();
        console.log('[DEBUG] Change model result:', result);
        
        if (result.status === 'ok') {
            console.log('[DEBUG] Model changed successfully');
            loadModelList(); // Refresh the list to show new active model
            return true;
        } else {
            console.error('[DEBUG] Failed to change model:', result.message);
            alert('Failed to change model: ' + result.message);
            return false;
        }
    } catch (err) {
        console.error('[DEBUG] Error changing model:', err);
        alert('Error changing model: ' + err.message);
        return false;
    }
}

// Delete a model
async function deleteModel(modelName) {
    console.log('[DEBUG] Deleting model:', modelName);
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete "' + modelName + '"?\n\nThis action cannot be undone.')) {
        console.log('[DEBUG] Deletion cancelled by user');
        return false;
    }
    
    try {
        const resp = await fetch('delete_model.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName })
        });
        const result = await resp.json();
        console.log('[DEBUG] Delete model result:', result);
        
        if (result.status === 'ok') {
            console.log('[DEBUG] Model deleted successfully');
            if (uploadStatus) {
                uploadStatus.innerHTML = '<span style="color:green;">✓ ' + modelName + ' deleted</span>';
                setTimeout(() => {
                    uploadStatus.innerHTML = '';
                }, 3000);
            }
            loadModelList(); // Refresh the list
            return true;
        } else {
            console.error('[DEBUG] Failed to delete model:', result.message);
            alert('Failed to delete model: ' + result.message);
            return false;
        }
    } catch (err) {
        console.error('[DEBUG] Error deleting model:', err);
        alert('Error deleting model: ' + err.message);
        return false;
    }
}

async function loadModelList() {
    console.log('[DEBUG] loadModelList() called');
    const listDiv = document.querySelector('.model-list');
    if (!listDiv) {
        console.error('[DEBUG] .model-list element not found!');
        return;
    }
    listDiv.innerHTML = '<span style="color:#888;">Loading models...</span>';
    try {
        const url = 'list_models.php?t=' + Date.now();
        console.log('[DEBUG] Fetching:', url);
        const resp = await fetch(url);
        console.log('[DEBUG] Response status:', resp.status);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        console.log('[DEBUG] Response text:', text);
        let data;
        try {
            data = JSON.parse(text);
            console.log('[DEBUG] Parsed data:', data);
        } catch (e) {
            console.error('[DEBUG] JSON parse error:', e);
            listDiv.innerHTML = '<span style="color:red;">JSON parse error</span><br><pre style="font-size:11px;">' + text + '</pre>';
            return;
        }
        listDiv.innerHTML = '';
        if (data.models && data.models.length) {
            console.log('[DEBUG] Found', data.models.length, 'models');
            
            // Get the currently active model
            const currentModel = await getCurrentModel();
            console.log('[DEBUG] Current active model:', currentModel);
            
            const ul = document.createElement('ul');
            ul.style.margin = '0';
            ul.style.paddingLeft = '0';
            data.models.forEach(name => {
                const isCurrentModel = name === currentModel;
                
                // Create container for model item
                const liContainer = document.createElement('div');
                liContainer.style.display = 'flex';
                liContainer.style.alignItems = 'center';
                liContainer.style.marginBottom = '4px';
                liContainer.style.gap = '8px';
                
                // Create the model name item
                const li = document.createElement('li');
                li.style.flex = '1';
                li.style.fontSize = '13px';
                li.style.padding = '8px 12px';
                li.style.backgroundColor = '#163556';
                li.style.borderRadius = '3px';
                li.style.cursor = 'pointer';
                li.style.transition = 'all 0.2s ease';
                li.style.listStyle = 'none';
                li.textContent = name;
                
                // Check if this is the current model
                if (isCurrentModel) {
                    li.style.backgroundColor = '#d32f2f';
                    li.style.color = '#fff';
                    li.style.fontWeight = '600';
                    li.style.borderLeft = '3px solid #ff5252';
                    li.title = 'Current model (in use)';
                } else {
                    li.style.borderLeft = '3px solid #0a1a2b';
                }
                
                // Add hover effect
                li.addEventListener('mouseenter', function() {
                    if (!isCurrentModel) {
                        this.style.backgroundColor = '#1a4566';
                        this.style.borderLeftColor = '#d32f2f';
                    }
                });
                li.addEventListener('mouseleave', function() {
                    if (!isCurrentModel) {
                        this.style.backgroundColor = '#163556';
                        this.style.borderLeftColor = '#0a1a2b';
                    }
                });
                
                // Add click handler to switch model
                li.addEventListener('click', async function() {
                    if (!isCurrentModel) {
                        if (uploadStatus) uploadStatus.innerHTML = '<span style="color:blue;">Switching to ' + name + '...</span>';
                        const success = await changeModel(name);
                        if (success) {
                            if (uploadStatus) {
                                uploadStatus.innerHTML = '<span style="color:green;">✓ Now using ' + name + '</span>';
                                setTimeout(() => {
                                    uploadStatus.innerHTML = '';
                                }, 3000);
                            }
                        }
                    }
                });
                
                // Create delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '✕';
                deleteBtn.style.width = '28px';
                deleteBtn.style.height = '28px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.backgroundColor = '#d32f2f';
                deleteBtn.style.color = '#fff';
                deleteBtn.style.border = 'none';
                deleteBtn.style.borderRadius = '3px';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.fontSize = '16px';
                deleteBtn.style.fontWeight = 'bold';
                deleteBtn.style.transition = 'all 0.2s ease';
                deleteBtn.style.opacity = isCurrentModel ? '0.3' : '1';
                deleteBtn.style.pointerEvents = isCurrentModel ? 'none' : 'auto';
                deleteBtn.title = isCurrentModel ? 'Cannot delete active model' : 'Delete model';
                
                deleteBtn.addEventListener('mouseenter', function() {
                    if (!isCurrentModel) {
                        this.style.backgroundColor = '#b71c1c';
                        this.style.transform = 'scale(1.1)';
                    }
                });
                deleteBtn.addEventListener('mouseleave', function() {
                    if (!isCurrentModel) {
                        this.style.backgroundColor = '#d32f2f';
                        this.style.transform = 'scale(1)';
                    }
                });
                
                // Add delete click handler
                deleteBtn.addEventListener('click', async function(e) {
                    e.stopPropagation(); // Prevent triggering model switch
                    if (!isCurrentModel) {
                        await deleteModel(name);
                    }
                });
                
                // Add to container
                const listItem = document.createElement('li');
                listItem.style.listStyle = 'none';
                listItem.style.display = 'flex';
                listItem.style.alignItems = 'center';
                listItem.style.gap = '8px';
                listItem.appendChild(li);
                listItem.appendChild(deleteBtn);
                
                ul.appendChild(listItem);
            });
            listDiv.appendChild(ul);
        } else {
            console.log('[DEBUG] No models found');
            listDiv.textContent = 'No models uploaded.';
            listDiv.style.color = '#999';
        }
    } catch (err) {
        console.error('[DEBUG] loadModelList error:', err);
        listDiv.innerHTML = '<span style="color:red;">Failed to load: ' + err.message + '</span>';
    }
}

console.log('[DEBUG] Calling loadModelList() at initialization');
loadModelList();
