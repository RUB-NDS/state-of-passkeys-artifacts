// Admin functionality for The Passkey Radar

let currentDataType = null;
let taskPollInterval = null;

// Poll server for task status
async function pollTasks() {
    try {
        // Tasks endpoint is now public for reading
        const response = await fetch('/api/admin/tasks');
        if (response.ok) {
            const tasks = await response.json();
            updateTaskListFromServer(tasks);
        }
    } catch (error) {
        console.error('Error polling tasks:', error);
    }
}

// Start polling when admin section is shown
function startTaskPolling() {
    if (!taskPollInterval) {
        pollTasks(); // Poll immediately
        taskPollInterval = setInterval(pollTasks, 2000); // Poll every 2 seconds
    }
}

// Stop polling when leaving admin section
function stopTaskPolling() {
    if (taskPollInterval) {
        clearInterval(taskPollInterval);
        taskPollInterval = null;
    }
}

// Make authenticated request - let browser handle Basic Auth
async function makeAuthenticatedRequest(url, options = {}) {
    // Simply make the request without any Authorization header
    // The browser will prompt for credentials if needed
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers
        }
    });
}

// Refresh system status
async function refreshStatus() {
    try {
        // Status endpoint is now public
        const response = await fetch('/api/admin/status');
        
        if (response.ok) {
            const status = await response.json();
            
            // Update counters
            document.getElementById('statCombined').textContent = status.combined || 0;
            document.getElementById('statMerged').textContent = status.merged || 0;
            document.getElementById('statConflicts').textContent = status.conflicts || 0;
            document.getElementById('statDirectories').textContent = Object.keys(status.directories || {}).length;
            
            // Update last update time and data points in System Health
            // Get the latest merged file to determine last update
            if (status.merged > 0) {
                // Fetch merged files to get the latest
                const mergedResponse = await makeAuthenticatedRequest('/api/admin/files/merged');
                if (mergedResponse.ok) {
                    const mergedData = await mergedResponse.json();
                    const files = mergedData.files || [];
                    if (files.length > 0) {
                        // Files are sorted, get the last one
                        const latestFile = files[files.length - 1];
                        // Extract date from filename (e.g., "2025-01-15-10-30-45.json")
                        const match = latestFile.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
                        if (match) {
                            const dateStr = match[1];
                            const [year, month, day, hour, minute, second] = dateStr.split('-');
                            const date = new Date(year, month - 1, day, hour, minute, second);
                            document.getElementById('lastUpdateTime').textContent = date.toLocaleString();
                        }
                    }
                }
            }
            
            // Update total data points (combined files count)
            document.getElementById('dataPointCount').textContent = (status.combined || 0).toLocaleString();
        }
    } catch (error) {
        console.error('Error loading status:', error);
    }
}

// Load directory status
async function loadDirectoryStatus() {
    try {
        // Status endpoint is now public
        const response = await fetch('/api/admin/status');
        
        if (response.ok) {
            const status = await response.json();
            const directoryStatus = document.getElementById('directoryStatus');
            directoryStatus.innerHTML = '';
            
            // Add directory cards
            for (const [dir, count] of Object.entries(status.directories || {})) {
                const col = document.createElement('div');
                col.className = 'col-md-4 mb-3';
                col.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">${dir}</h6>
                            <p class="card-text text-muted mb-0">${count} files</p>
                        </div>
                    </div>
                `;
                directoryStatus.appendChild(col);
            }
            
            // Add wellknown cards
            for (const [type, count] of Object.entries(status.wellknown || {})) {
                const col = document.createElement('div');
                col.className = 'col-md-4 mb-3';
                col.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">Well-known ${type}</h6>
                            <p class="card-text text-muted mb-0">${count} files</p>
                        </div>
                    </div>
                `;
                directoryStatus.appendChild(col);
            }
        }
    } catch (error) {
        console.error('Error loading directory status:', error);
    }
}

// Load directories for fetch modal
async function loadDirectories() {
    try {
        // Directories endpoint is now public
        const response = await fetch('/api/admin/directories');
        
        if (response.ok) {
            const directories = await response.json();
            const directoryList = document.getElementById('directoryList');
            directoryList.innerHTML = '';
            
            // Add "Select All" checkbox
            const selectAllDiv = document.createElement('div');
            selectAllDiv.className = 'form-check mb-3';
            selectAllDiv.innerHTML = `
                <input class="form-check-input" type="checkbox" id="selectAll" onchange="toggleAllDirectories()">
                <label class="form-check-label fw-bold" for="selectAll">
                    Select All Directories
                </label>
            `;
            directoryList.appendChild(selectAllDiv);
            
            // Add individual directories
            directories.forEach(dir => {
                const div = document.createElement('div');
                div.className = 'form-check mb-2';
                div.innerHTML = `
                    <input class="form-check-input directory-checkbox" type="checkbox" value="${dir.name}" id="dir-${dir.name}">
                    <label class="form-check-label" for="dir-${dir.name}">
                        ${dir.value}
                    </label>
                `;
                directoryList.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Error loading directories:', error);
    }
}

// Toggle all directories
function toggleAllDirectories() {
    const selectAll = document.getElementById('selectAll').checked;
    document.querySelectorAll('.directory-checkbox').forEach(cb => {
        cb.checked = selectAll;
    });
}

// Show merge modal
async function showMergeModal() {
    const modal = new bootstrap.Modal(document.getElementById('mergeModal'));
    await loadUnmergedFiles();
    modal.show();
}

// Load combined files and their merge status
async function loadUnmergedFiles() {
    try {
        // Get combined files
        const combinedResponse = await makeAuthenticatedRequest('/api/admin/files/combined');
        
        if (!combinedResponse.ok) {
            throw new Error('Failed to load combined files');
        }
        
        const combinedData = await combinedResponse.json();
        const combinedFiles = combinedData.files || [];
        
        // Get merged files to determine which are already merged
        const mergedResponse = await makeAuthenticatedRequest('/api/admin/files/merged');
        
        if (!mergedResponse.ok) {
            throw new Error('Failed to load merged files');
        }
        
        const mergedData = await mergedResponse.json();
        const mergedFiles = mergedData.files || [];
        
        // Create a set of merged dates for quick lookup
        const mergedDates = new Set(mergedFiles.map(file => file.replace('.json', '')));
        
        // Create file info with merge status
        const filesWithStatus = combinedFiles.map(file => ({
            filename: file,
            isMerged: mergedDates.has(file.replace('.json', ''))
        }));
        
        const unmergedCount = filesWithStatus.filter(f => !f.isMerged).length;
        
        const fileList = document.getElementById('mergeFileList');
        fileList.innerHTML = '';
        
        if (combinedFiles.length === 0) {
            fileList.innerHTML = '<div class="text-center text-muted py-4">No combined files found.</div>';
            return;
        }
        
        // Add filter buttons
        const filterDiv = document.createElement('div');
        filterDiv.className = 'btn-group mb-3';
        filterDiv.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-primary active" onclick="filterMergeFiles('all')">
                All Files (${combinedFiles.length})
            </button>
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="filterMergeFiles('unmerged')">
                Unmerged Only (${unmergedCount})
            </button>
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="filterMergeFiles('merged')">
                Merged Only (${combinedFiles.length - unmergedCount})
            </button>
        `;
        fileList.appendChild(filterDiv);
        
        // Add select options
        const selectDiv = document.createElement('div');
        selectDiv.className = 'd-flex gap-2 mb-3';
        selectDiv.innerHTML = `
            <button type="button" class="btn btn-sm btn-secondary" onclick="selectAllVisible()">
                <i class="bi bi-check-square me-1"></i>Select Visible
            </button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="selectNone()">
                <i class="bi bi-square me-1"></i>Select None
            </button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="selectUnmergedOnly()">
                <i class="bi bi-check2-square me-1"></i>Select Unmerged
            </button>
        `;
        fileList.appendChild(selectDiv);
        
        // Add file list container
        const fileContainer = document.createElement('div');
        fileContainer.id = 'mergeFileContainer';
        fileContainer.style.maxHeight = '300px';
        fileContainer.style.overflowY = 'auto';
        
        // Add individual file checkboxes
        filesWithStatus.forEach(fileInfo => {
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            div.setAttribute('data-merge-status', fileInfo.isMerged ? 'merged' : 'unmerged');
            
            const fileDate = fileInfo.filename.replace('.json', '');
            const displayDate = formatFileDate(fileDate);
            
            const statusBadge = fileInfo.isMerged 
                ? '<span class="badge bg-success ms-2" title="Already merged - will be overwritten if selected"><i class="bi bi-arrow-repeat me-1"></i>Merged</span>'
                : '<span class="badge bg-warning ms-2">Not Merged</span>';
            
            // Don't disable merged files anymore - allow re-merging
            
            div.innerHTML = `
                <input class="form-check-input merge-checkbox" type="checkbox" value="${fileInfo.filename}" 
                       id="merge-${fileInfo.filename}" data-is-merged="${fileInfo.isMerged}">
                <label class="form-check-label" for="merge-${fileInfo.filename}">
                    <i class="bi bi-file-earmark-text me-2"></i>${displayDate}
                    ${statusBadge}
                    <span class="text-muted ms-2">(${fileInfo.filename})</span>
                </label>
            `;
            fileContainer.appendChild(div);
        });
        
        fileList.appendChild(fileContainer);
        
        // Store the file status data globally for filtering
        window.mergeFilesData = filesWithStatus;
        
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('mergeFileList').innerHTML = 
            '<div class="alert alert-danger">Error loading files</div>';
    }
}

// Filter merge files by status
function filterMergeFiles(filter) {
    // Update active button
    document.querySelectorAll('#mergeFileList .btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide files based on filter
    const container = document.getElementById('mergeFileContainer');
    if (!container) return;
    
    container.querySelectorAll('.form-check').forEach(div => {
        const status = div.getAttribute('data-merge-status');
        
        if (filter === 'all') {
            div.style.display = 'block';
        } else if (filter === 'unmerged' && status === 'unmerged') {
            div.style.display = 'block';
        } else if (filter === 'merged' && status === 'merged') {
            div.style.display = 'block';
        } else {
            div.style.display = 'none';
        }
    });
}

// Select all visible files
function selectAllVisible() {
    const container = document.getElementById('mergeFileContainer');
    if (!container) return;
    
    container.querySelectorAll('.form-check').forEach(div => {
        if (div.style.display !== 'none') {
            const checkbox = div.querySelector('.merge-checkbox');
            if (checkbox) {
                checkbox.checked = true;
            }
        }
    });
}

// Deselect all files
function selectNone() {
    document.querySelectorAll('.merge-checkbox').forEach(cb => {
        cb.checked = false;
    });
}

// Select only unmerged files
function selectUnmergedOnly() {
    const container = document.getElementById('mergeFileContainer');
    if (!container) return;
    
    container.querySelectorAll('.form-check').forEach(div => {
        const checkbox = div.querySelector('.merge-checkbox');
        if (checkbox) {
            const status = div.getAttribute('data-merge-status');
            checkbox.checked = (status === 'unmerged');
        }
    });
}

// Format file date for display
function formatFileDate(dateStr) {
    // dateStr is in format YYYY-MM-DD-HH-MM-SS
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.toLocaleString();
    }
    return dateStr;
}

// Execute merge for selected files
async function executeMerge() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('.merge-checkbox:checked'));
    const selected = selectedCheckboxes.map(cb => cb.value);
    
    if (selected.length === 0) {
        alert('Please select at least one file to merge');
        return;
    }
    
    // Check if any selected files are already merged
    const remergeCount = selectedCheckboxes.filter(cb => cb.getAttribute('data-is-merged') === 'true').length;
    
    if (remergeCount > 0) {
        const message = remergeCount === selected.length
            ? `All ${remergeCount} selected files have already been merged. Do you want to re-merge them? This will overwrite the existing merged files.`
            : `${remergeCount} of the ${selected.length} selected files have already been merged. Do you want to proceed? This will overwrite the existing merged files.`;
        
        if (!confirm(message)) {
            return;
        }
    }
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('mergeModal')).hide();
    
    const resultDiv = document.getElementById('processResult');
    resultDiv.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split me-2"></i>Merging selected files...</div>';
    
    try {
        const response = await makeAuthenticatedRequest('/api/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: selected })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                resultDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-lock me-2"></i>Authentication required. Please check credentials.</div>';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        resultDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Merge operation initiated! ${result.message}</div>`;
        
        // Refresh status
        await refreshStatus();
    } catch (error) {
        console.error('Error merging files:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}</div>`;
    }
}

// Show fetch modal
function showFetchModal() {
    const modal = new bootstrap.Modal(document.getElementById('fetchModal'));
    modal.show();
}

// Execute fetch for selected directories
async function executeFetch() {
    const selected = Array.from(document.querySelectorAll('.directory-checkbox:checked'))
        .map(cb => cb.value);
    
    if (selected.length === 0) {
        alert('Please select at least one directory');
        return;
    }
    
    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('fetchModal')).hide();
    
    const resultDiv = document.getElementById('fetchResult');
    resultDiv.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split me-2"></i>Fetching selected directories...</div>';
    
    try {
        // Fetch each directory
        let results = [];
        for (const dir of selected) {
            const response = await makeAuthenticatedRequest(`/api/admin/fetch/${dir}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                results.push({ directory: dir, status: 'success', message: result.message });
            } else {
                results.push({ directory: dir, status: 'error', message: 'Failed to fetch' });
            }
        }
        
        // Display results
        let html = '<div class="alert alert-success mb-2"><i class="bi bi-check-circle me-2"></i>Fetch operation initiated!</div>';
        html += '<ul class="list-unstyled mb-0">';
        
        results.forEach(result => {
            const icon = result.status === 'success' ? 
                '<i class="bi bi-check text-success"></i>' : 
                '<i class="bi bi-x text-danger"></i>';
            html += `<li>${icon} ${result.directory}: ${result.message}</li>`;
        });
        
        html += '</ul>';
        resultDiv.innerHTML = html;
        
        // Refresh status
        await refreshStatus();
    } catch (error) {
        console.error('Error fetching directories:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}</div>`;
    }
}

// Fetch all directories
async function fetchData() {
    const resultDiv = document.getElementById('fetchResult');
    resultDiv.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split me-2"></i>Fetching data from all directories...</div>';
    
    try {
        const response = await makeAuthenticatedRequest('/api/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                resultDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-lock me-2"></i>Authentication required. Please check credentials.</div>';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        resultDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Fetch operation initiated! ${result.message}</div>`;
        
        // Refresh data
        await refreshStatus();
    } catch (error) {
        console.error('Error fetching data:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}</div>`;
    }
}

// Combine data
async function combineData() {
    const resultDiv = document.getElementById('processResult');
    resultDiv.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split me-2"></i>Combining data from all directories...</div>';
    
    try {
        const response = await makeAuthenticatedRequest('/api/combine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                resultDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-lock me-2"></i>Authentication required. Please check credentials.</div>';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        resultDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Combine operation initiated! ${result.message}</div>`;
        
        await refreshStatus();
    } catch (error) {
        console.error('Error combining data:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}</div>`;
    }
}

// Merge data
async function mergeData() {
    const resultDiv = document.getElementById('processResult');
    resultDiv.innerHTML = '<div class="text-info"><i class="bi bi-hourglass-split me-2"></i>Merging and deduplicating data...</div>';
    
    try {
        const response = await makeAuthenticatedRequest('/api/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                resultDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-lock me-2"></i>Authentication required. Please check credentials.</div>';
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        resultDiv.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle me-2"></i>Merge operation initiated! ${result.message}</div>`;
        
        // Refresh data
        await refreshStatus();
    } catch (error) {
        console.error('Error merging data:', error);
        resultDiv.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}</div>`;
    }
}


// Browse data
async function browseData(type) {
    currentDataType = type;
    
    // Update active button
    document.querySelectorAll('#browser-tab .list-group-item').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update title with icon
    const titleElement = document.getElementById('browserTitle');
    const typeIcons = {
        'directories': 'bi-folder',
        'wellknown': 'bi-shield-check',
        'combined': 'bi-layers',
        'merged': 'bi-intersect',
        'conflicts': 'bi-exclamation-triangle'
    };
    const icon = typeIcons[type] || 'bi-folder';
    titleElement.innerHTML = `<i class="${icon} me-2"></i>${type.charAt(0).toUpperCase() + type.slice(1)}`;
    
    // Load files
    try {
        const response = await makeAuthenticatedRequest(`/api/admin/files/${type}`);
        
        if (!response.ok) {
            throw new Error('Failed to load files');
        }
        
        const data = await response.json();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';
        
        if (type === 'directories' || type === 'wellknown') {
            // Show subdirectories
            for (const [subdir, files] of Object.entries(data)) {
                const group = document.createElement('div');
                group.className = 'mb-4';
                group.innerHTML = `<h6 class="text-muted mb-2">${subdir} <span class="badge bg-secondary">${files.length} files</span></h6>`;
                
                const list = document.createElement('div');
                list.className = 'list-group';
                list.style.maxHeight = '400px';
                list.style.overflowY = 'auto';
                
                // Reverse the files array to show most recent first
                files.reverse().forEach(file => {
                    const item = document.createElement('a');
                    item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                    item.href = '#';
                    item.onclick = (e) => {
                        e.preventDefault();
                        viewFile(`${type}/${subdir}/${file}`);
                    };
                    item.innerHTML = `
                        <span><i class="bi bi-file-text me-2"></i>${file}</span>
                        <span class="badge bg-primary rounded-pill">View</span>
                    `;
                    list.appendChild(item);
                });
                
                group.appendChild(list);
                fileList.appendChild(group);
            }
        } else {
            // Show files directly
            const files = data.files || [];
            if (files.length === 0) {
                fileList.innerHTML = '<div class="text-center text-muted py-5">No files found</div>';
                return;
            }
            
            // Add file count header
            const header = document.createElement('div');
            header.className = 'mb-3';
            header.innerHTML = `<span class="text-muted">Showing all ${files.length} files</span>`;
            fileList.appendChild(header);
            
            const list = document.createElement('div');
            list.className = 'list-group';
            list.style.maxHeight = '400px';
            list.style.overflowY = 'auto';
            
            // Reverse the files array to show most recent first
            files.reverse().forEach(file => {
                const item = document.createElement('a');
                item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                item.href = '#';
                item.onclick = (e) => {
                    e.preventDefault();
                    viewFile(`${type}/${file}`);
                };
                item.innerHTML = `
                    <span><i class="bi bi-file-text me-2"></i>${file}</span>
                    <div>
                        <span class="badge bg-primary rounded-pill me-2">View</span>
                        ${type !== 'directories' && type !== 'wellknown' ? `
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteFile('${type}', '${file}'); event.stopPropagation();">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
                list.appendChild(item);
            });
            
            fileList.appendChild(list);
        }
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('fileList').innerHTML = '<div class="alert alert-danger">Error loading files</div>';
    }
}

// View file
function viewFile(path) {
    window.open(`/data/${path}`, '_blank');
}

// Delete file
async function deleteFile(type, filename) {
    if (!confirm(`Delete ${filename}?`)) return;
    
    try {
        const response = await makeAuthenticatedRequest(`/api/admin/files/${type}/${filename}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            browseData(type);
            await refreshStatus();
        } else {
            alert('Error deleting file');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Error deleting file');
    }
}

// Update task list from server data
function updateTaskListFromServer(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-clock-history display-4 d-block mb-3"></i>
                <div>No recent tasks</div>
            </div>
        `;
        return;
    }
    
    // Show only recent tasks (last 20)
    tasks.slice(0, 20).forEach(task => {
        const item = document.createElement('div');
        item.className = 'list-group-item';
        
        let statusBadge = '';
        let statusIcon = '';
        
        switch(task.status) {
            case 'running':
                statusBadge = 'bg-warning';
                statusIcon = 'bi-hourglass-split';
                break;
            case 'success':
                statusBadge = 'bg-success';
                statusIcon = 'bi-check-circle';
                break;
            case 'error':
                statusBadge = 'bg-danger';
                statusIcon = 'bi-x-circle';
                break;
        }
        
        const timestamp = new Date(task.start_time);
        const timeStr = timestamp.toLocaleTimeString();
        
        // Calculate duration for completed tasks
        let duration = '';
        if (task.duration_seconds) {
            const seconds = Math.floor(task.duration_seconds);
            if (seconds < 60) {
                duration = ` (${seconds}s)`;
            } else {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                duration = ` (${minutes}m ${remainingSeconds}s)`;
            }
        }
        
        // Show result or spinning icon
        let statusInfo = '';
        if (task.status === 'running') {
            statusInfo = ' <span class="spinner-border spinner-border-sm ms-2" role="status" style="width: 0.7rem; height: 0.7rem;"></span>';
        } else if (task.result) {
            statusInfo = ` - ${task.result}`;
        }
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div>
                        <span class="badge ${statusBadge} me-2">
                            <i class="${statusIcon}"></i>
                        </span>
                        <strong>${task.type}</strong> - ${task.description}${statusInfo}${duration}
                    </div>
                </div>
                <small class="text-muted ms-2">${timeStr}</small>
            </div>
        `;
        taskList.appendChild(item);
    });
}

// Listen for tab changes to load data
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('#admin-section button[data-bs-toggle="tab"]');
    tabButtons.forEach(button => {
        button.addEventListener('shown.bs.tab', async function (e) {
            const target = e.target.getAttribute('data-bs-target');
            
            switch(target) {
                case '#status-tab':
                    await loadDirectoryStatus();
                    break;
                case '#browser-tab':
                    // Always browse directories when tab is shown
                    browseData('directories');
                    break;
            }
        });
    });
});

// Expose functions globally for integration with app.js and HTML
window.refreshStatus = refreshStatus;
window.loadDirectories = loadDirectories;
window.loadDirectoryStatus = loadDirectoryStatus;
window.showFetchModal = showFetchModal;
window.showMergeModal = showMergeModal;
window.fetchData = fetchData;
window.combineData = combineData;
window.mergeData = mergeData;
window.executeFetch = executeFetch;
window.executeMerge = executeMerge;
window.browseData = browseData;
window.deleteFile = deleteFile;
window.toggleAllDirectories = toggleAllDirectories;
window.filterMergeFiles = filterMergeFiles;
window.selectAllVisible = selectAllVisible;
window.selectNone = selectNone;
window.selectUnmergedOnly = selectUnmergedOnly;
window.startTaskPolling = startTaskPolling;
window.stopTaskPolling = stopTaskPolling;