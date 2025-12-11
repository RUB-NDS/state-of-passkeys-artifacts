// Global variables
let currentData = [];
let temporalChart = null;
let directoryChart = null;
let coverageChart = null;
let historyChart = null;
let currentSection = 'overview';

// Directory names mapping
const directoryNames = {
    "passkeys-directory.dashlane.com": "Dashlane",
    "enpass.io": "Enpass",
    "fidoalliance.org": "FIDO Alliance",
    "hideez.com": "Hideez",
    "keepersecurity.com": "Keeper",
    "passkeyindex.io": "Passkey Index",
    "passkeys.com": "Passkeys.com",
    "passkeys.directory": "Passkeys Directory",
    "passkeys.io": "Passkeys.io",
    "passkeys.2fa.directory": "2FA Passkeys",
    "2fa.directory": "2FA Directory",
    "passkeys.2stable.com": "2Stable"
};

// Initialize application
document.addEventListener("DOMContentLoaded", function() {
    // Ensure page starts at top on reload
    window.scrollTo(0, 0);
    
    setupEventListeners();
    showSection('overview');
    
    // Set today's date as default for scan date picker
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("scanDatePicker").value = today;
});

// Show specific section
function showSection(section) {
    currentSection = section;
    
    // Update nav links
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
        const linkText = link.textContent.trim().toLowerCase();
        if (linkText.includes(section.toLowerCase()) || 
            (section === 'scans' && linkText.includes('explore'))) {
            link.classList.add('active');
        }
    });
    
    // Stop task polling if leaving admin section
    if (currentSection === 'admin' && section !== 'admin') {
        if (typeof stopTaskPolling === 'function') {
            stopTaskPolling();
        }
    }
    
    // Show/hide sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    // Load data for the section
    switch(section) {
        case 'overview':
            loadOverviewData();
            break;
        case 'history':
            loadHistoryData();
            break;
        case 'scans':
            // Data loads when user clicks Load Scan
            break;
        case 'admin':
            // Ensure admin.js functions are available and call them
            if (typeof refreshStatus === 'function') {
                refreshStatus();
            }
            if (typeof loadDirectories === 'function') {
                loadDirectories();
            }
            if (typeof startTaskPolling === 'function') {
                startTaskPolling();
            }
            
            // Ensure Operations tab is shown by default
            const operationsTab = document.querySelector('#admin-section button[data-bs-target="#operations-tab"]');
            if (operationsTab && !operationsTab.classList.contains('active')) {
                operationsTab.click();
            }
            break;
    }
}

// Load overview data
async function loadOverviewData() {
    showLoading(true);
    
    try {
        // Load temporal statistics
        const temporalResponse = await fetch("/api/statistics/temporal");
        const temporalResult = await temporalResponse.json();
        
        // Extract data array from the new response format
        const temporalStats = temporalResult.data || temporalResult;  // Fallback for backward compatibility
        const totalCount = temporalResult.total_count;
        const displayedCount = temporalResult.displayed_count;
        
        // Load directory statistics
        const directoryResponse = await fetch("/api/statistics/directory");
        const directoryStats = await directoryResponse.json();
        
        // Update summary statistics
        if (temporalStats.length > 0) {
            const latest = temporalStats[temporalStats.length - 1];
            document.getElementById("totalDomains").textContent = latest.total_domains;
            document.getElementById("latestScan").textContent = formatDate(latest.date);
            
            // Show both total and displayed counts if available
            if (totalCount !== undefined && displayedCount !== undefined) {
                document.getElementById("totalDataPoints").textContent = 
                    `${displayedCount.toLocaleString()} (of ${totalCount.toLocaleString()} total)`;
            } else {
                document.getElementById("totalDataPoints").textContent = temporalStats.length;
            }
        }
        
        // Create charts
        createTemporalChart(temporalStats);
        createDirectoryChart(directoryStats.statistics);
        createCoverageChart(directoryStats.statistics);
        
    } catch (error) {
        console.error("Error loading overview data:", error);
        alert("Error loading overview data. Please check the console for details.");
    } finally {
        showLoading(false);
    }
}

// Load history data
async function loadHistoryData() {
    showLoading(true);
    
    try {
        // Load directory growth data using the new endpoint
        const response = await fetch("/api/statistics/directory-growth");
        const result = await response.json();
        
        // Store full data for filtering
        window.fullHistoryData = result.data;
        window.availableDirectories = result.directories;
        
        // Set default time range to "All Time" if not set
        if (!window.selectedTimeRange) {
            window.selectedTimeRange = 'all';
            // Set "All Time" button as active
            const allTimeBtn = document.querySelector('.btn-group button[onclick*="all"]');
            if (allTimeBtn) {
                document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
                allTimeBtn.classList.add('active');
            }
        }
        
        // Create history chart with filtered data
        createHistoryChart(filterHistoryByTimeRange(window.fullHistoryData));
        
    } catch (error) {
        console.error("Error loading history data:", error);
        alert("Error loading history data. Please check the console for details.");
    } finally {
        showLoading(false);
    }
}


// Create history chart
function createHistoryChart(data) {
    const ctx = document.getElementById("historyChart").getContext("2d");
    
    if (historyChart) {
        historyChart.destroy();
    }
    
    // Determine appropriate time unit based on actual data range
    let timeUnit = 'month';
    let minTime = null;
    let maxTime = null;
    
    // Find the actual date range in the data
    if (data && data.length > 0) {
        const timestamps = data.map(d => new Date(d.date).getTime());
        minTime = Math.min(...timestamps);
        maxTime = Math.max(...timestamps);
        
        const rangeInDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
        
        // Choose unit based on actual range
        if (rangeInDays <= 7) {
            timeUnit = 'day';
        } else if (rangeInDays <= 31) {
            timeUnit = 'day';
        } else if (rangeInDays <= 93) {  // ~3 months
            timeUnit = 'week';
        } else if (rangeInDays <= 365) {
            timeUnit = 'month';
        } else if (rangeInDays <= 365 * 3) {  // 3 years
            timeUnit = 'quarter';
        } else {
            timeUnit = 'year';
        }
    }
    
    // Group data by directory type
    const groupedData = {};
    data.forEach(item => {
        if (!groupedData[item.type]) {
            groupedData[item.type] = [];
        }
        groupedData[item.type].push({
            x: new Date(item.date),
            y: item.count
        });
    });
    
    // Prepare datasets for all directories
    const datasets = [];
    const colors = [
        'rgb(255, 99, 132)', 'rgb(54, 162, 235)', 'rgb(255, 205, 86)',
        'rgb(75, 192, 192)', 'rgb(153, 102, 255)', 'rgb(255, 159, 64)',
        'rgb(199, 199, 199)', 'rgb(83, 102, 255)', 'rgb(255, 99, 255)',
        'rgb(99, 255, 132)', 'rgb(255, 205, 205)', 'rgb(162, 235, 54)',
        'rgb(235, 162, 54)', 'rgb(192, 75, 192)'
    ];
    
    // Create datasets from grouped data
    let colorIndex = 0;
    Object.entries(groupedData).forEach(([type, points]) => {
        // Sort points by date
        points.sort((a, b) => a.x - b.x);
        
        datasets.push({
            label: type,
            data: points,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: colors[colorIndex % colors.length] + '33',
            borderWidth: 3,
            tension: 0.1,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
        });
        colorIndex++;
    });
    
    historyChart = new Chart(ctx, {
        type: "line",
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            hour: 'MMM d',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy',
                            quarter: 'MMM yyyy',
                            year: 'yyyy'
                        },
                        tooltipFormat: 'MMM d, yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        source: 'auto',
                        autoSkip: true,
                        autoSkipPadding: 50,
                        maxRotation: 45,
                        minRotation: 0,
                        major: {
                            enabled: true
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Websites',
                        font: {
                            size: 14
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}


// Set history time range
function setHistoryTimeRange(range) {
    // Update button states
    document.querySelectorAll('.btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Store selected range
    window.selectedTimeRange = range;
    
    // Filter and update chart
    if (window.fullHistoryData && historyChart) {
        createHistoryChart(filterHistoryByTimeRange(window.fullHistoryData));
    }
}

// Filter history data by time range
function filterHistoryByTimeRange(data) {
    if (!window.selectedTimeRange || window.selectedTimeRange === 'all') {
        return data;
    }
    
    const now = new Date();
    let cutoffDate = new Date();
    
    switch(window.selectedTimeRange) {
        case 'year':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        case '6months':
            cutoffDate.setMonth(now.getMonth() - 6);
            break;
        case '3months':
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
        case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
    }
    
    return data.filter(d => new Date(d.date) >= cutoffDate);
}

// Load scan for selected date
async function loadScanForDate() {
    const selectedDate = document.getElementById("scanDatePicker").value;
    if (!selectedDate) {
        alert("Please select a date");
        return;
    }
    
    // Convert date to format used by API (YYYY-MM-DD-HH-MM-SS)
    // selectedDate is in YYYY-MM-DD format from the date input
    const apiDate = selectedDate + "-00-00-00";
    
    showLoading(true);
    document.getElementById("scanInfo").classList.add("d-none");
    document.getElementById("scanFilters").classList.add("d-none");
    document.getElementById("scanDataCard").classList.add("d-none");
    
    try {
        // First try to get combined data
        const combinedResponse = await fetch(`/api/data/combined/${apiDate}`);
        const combinedResult = await combinedResponse.json();
        
        let actualDate = combinedResult.actual_date || combinedResult.date || apiDate;
        document.getElementById("scanInfoText").textContent = 
            `Using scan from ${formatDate(actualDate)}${combinedResult.actual_date ? ' (closest available)' : ''}`;
        document.getElementById("scanInfo").classList.remove("d-none");
        
        // Try to get merged data (will generate if needed)
        const mergedResponse = await fetch(`/api/data/merged/${actualDate}`);
        const mergedResult = await mergedResponse.json();
        
        // Display the data
        currentData = mergedResult.data;
        displayScanData(currentData);
        
        // Show filters and data card
        document.getElementById("scanFilters").classList.remove("d-none");
        document.getElementById("scanDataCard").classList.remove("d-none");
        
        // Populate directory filter for scans
        populateScanDirectoryFilter();
        
    } catch (error) {
        console.error("Error loading scan data:", error);
        alert("Error loading scan data. Please try again.");
    } finally {
        showLoading(false);
    }
}

// Populate scan directory filter
function populateScanDirectoryFilter() {
    const filter = document.getElementById("scanDirectoryFilter");
    filter.innerHTML = '<option value="">All Directories</option>';
    
    Object.entries(directoryNames).forEach(([key, name]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = name;
        filter.appendChild(option);
    });
}

// Display scan data in table
function displayScanData(data) {
    const tbody = document.getElementById("scanDataTableBody");
    const domainFilter = document.getElementById("scanDomainFilter").value.toLowerCase();
    const directoryFilter = document.getElementById("scanDirectoryFilter").value;
    
    // Populate directory headers if not already done
    const directoryHeaders = document.getElementById("directoryHeaders");
    if (directoryHeaders && directoryHeaders.children.length === 0) {
        // Add directory headers - use keys to ensure same order as data
        Object.keys(directoryNames).forEach(key => {
            const th = document.createElement("th");
            th.className = "text-center small";
            th.style.whiteSpace = "nowrap";
            th.style.fontSize = "0.75rem";
            th.textContent = directoryNames[key];
            directoryHeaders.appendChild(th);
        });
        
        // Add well-known headers
        ["WebAuthn", "Endpoints"].forEach(type => {
            const th = document.createElement("th");
            th.className = "text-center small";
            th.style.whiteSpace = "nowrap";
            th.style.fontSize = "0.75rem";
            th.textContent = type;
            directoryHeaders.appendChild(th);
        });
    }
    
    // Convert object to array and filter
    let dataArray = Object.entries(data).map(([key, value]) => ({
        id: key,
        ...value
    }));
    
    // Apply filters
    if (domainFilter) {
        dataArray = dataArray.filter(item => 
            (item.domain && item.domain.toLowerCase().includes(domainFilter)) ||
            (item.name && item.name.toLowerCase().includes(domainFilter))
        );
    }
    
    if (directoryFilter) {
        dataArray = dataArray.filter(item => 
            item.directories && item.directories[directoryFilter]
        );
    }
    
    // Update result count
    document.getElementById("scanResultCount").textContent = `${dataArray.length} results`;
    
    // Clear table
    tbody.innerHTML = "";
    
    if (dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="18" class="text-center">No results found</td></tr>';
        return;
    }
    
    // Build table rows
    dataArray.forEach(item => {
        const row = document.createElement("tr");

        // Format name with alternative names
        let nameDisplay = item.name || "-";
        if (item.alt && item.alt.length > 0) {
            const altNames = item.alt.join(", ");
            nameDisplay = `${nameDisplay}<br><small class="text-muted" style="display: block; overflow-x: auto; white-space: nowrap;">(${altNames})</small>`;
        }

        // Name and Domain
        row.innerHTML = `
            <td style="max-width: 200px; height: 60px; overflow: hidden;">${nameDisplay}</td>
            <td><a href="https://${item.domain}" target="_blank">${item.domain || "-"}</a></td>
            <td>${item.signin ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>'}</td>
            <td>${item.mfa ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>'}</td>
        `;
        
        // Directory columns - use keys to ensure same order as headers
        Object.keys(directoryNames).forEach(dirKey => {
            const hasEntry = item.directories && item.directories[dirKey];
            
            const cell = document.createElement("td");
            cell.className = "text-center";
            
            if (hasEntry) {
                const badge = document.createElement("span");
                badge.className = "badge bg-success directory-badge";
                badge.innerHTML = '<i class="bi bi-check"></i>';
                badge.style.cursor = "pointer";
                badge.onclick = () => showDetails(item.directories[dirKey], dirKey);
                cell.appendChild(badge);
            } else {
                cell.innerHTML = '<i class="bi bi-dash text-muted"></i>';
            }
            
            row.appendChild(cell);
        });
        
        // Well-known columns
        ["webauthn", "endpoints"].forEach(type => {
            const hasEntry = item.wellknown && item.wellknown[type];
            
            const cell = document.createElement("td");
            cell.className = "text-center";
            
            if (hasEntry) {
                const badge = document.createElement("span");
                badge.className = "badge bg-info directory-badge";
                badge.innerHTML = '<i class="bi bi-check"></i>';
                badge.style.cursor = "pointer";
                badge.onclick = () => showDetails(item.wellknown[type], `wellknown_${type}`);
                cell.appendChild(badge);
            } else {
                cell.innerHTML = '<i class="bi bi-dash text-muted"></i>';
            }
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
}

// Filter functions for scans
function filterScanByWellKnown() {
    const filtered = Object.entries(currentData).filter(([key, value]) => 
        value.wellknown && (value.wellknown.webauthn || value.wellknown.endpoints)
    );
    displayFilteredScanData(filtered);
}

function filterScanBySignIn() {
    const filtered = Object.entries(currentData).filter(([key, value]) => value.signin);
    displayFilteredScanData(filtered);
}

function filterScanByMFA() {
    const filtered = Object.entries(currentData).filter(([key, value]) => value.mfa);
    displayFilteredScanData(filtered);
}

function displayFilteredScanData(filtered) {
    const filteredData = {};
    filtered.forEach(([key, value]) => {
        filteredData[key] = value;
    });
    displayScanData(filteredData);
}

// Create temporal chart
function createTemporalChart(data) {
    const ctx = document.getElementById("temporalChart").getContext("2d");
    
    if (temporalChart) {
        temporalChart.destroy();
    }
    
    // Determine appropriate time unit based on data range
    let timeUnit = 'month';
    if (data && data.length > 0) {
        const timestamps = data.map(d => new Date(d.timestamp || d.date).getTime());
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);
        const rangeInDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
        
        if (rangeInDays <= 31) {
            timeUnit = 'day';
        } else if (rangeInDays <= 93) {
            timeUnit = 'week';
        } else if (rangeInDays <= 365) {
            timeUnit = 'month';
        } else if (rangeInDays <= 365 * 3) {
            timeUnit = 'quarter';
        } else {
            timeUnit = 'year';
        }
    }
    
    temporalChart = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [{
                label: "Total Domains",
                data: data.map(d => ({
                    x: new Date(d.timestamp || d.date),
                    y: d.total_domains
                })),
                borderColor: "rgb(75, 192, 192)",
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return formatDate(context[0].raw.x);
                        },
                        label: function(context) {
                            return `Domains: ${context.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: timeUnit,
                        displayFormats: {
                            hour: 'MMM d',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy',
                            quarter: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        source: 'auto',
                        autoSkip: true,
                        autoSkipPadding: 50,
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Domains'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Create directory chart
function createDirectoryChart(data) {
    const ctx = document.getElementById("directoryChart").getContext("2d");
    
    if (directoryChart) {
        directoryChart.destroy();
    }
    
    // Sort by count
    data.sort((a, b) => b.count - a.count);
    
    directoryChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(d => directoryNames[d.directory] || d.name),
            datasets: [{
                label: "Domain Count",
                data: data.map(d => d.count),
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Create coverage chart
function createCoverageChart(data) {
    const ctx = document.getElementById("coverageChart").getContext("2d");
    
    if (coverageChart) {
        coverageChart.destroy();
    }
    
    // Filter only directories (not wellknown)
    const directories = data.filter(d => !d.directory.startsWith("wellknown_"));
    
    coverageChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: directories.map(d => directoryNames[d.directory] || d.name),
            datasets: [{
                data: directories.map(d => d.count),
                backgroundColor: [
                    "rgba(255, 99, 132, 0.5)",
                    "rgba(54, 162, 235, 0.5)",
                    "rgba(255, 205, 86, 0.5)",
                    "rgba(75, 192, 192, 0.5)",
                    "rgba(153, 102, 255, 0.5)",
                    "rgba(255, 159, 64, 0.5)",
                    "rgba(199, 199, 199, 0.5)",
                    "rgba(83, 102, 255, 0.5)",
                    "rgba(255, 99, 255, 0.5)",
                    "rgba(99, 255, 132, 0.5)",
                    "rgba(255, 205, 205, 0.5)",
                    "rgba(162, 235, 54, 0.5)"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    position: "right"
                }
            }
        }
    });
}

// Show details modal
function showDetails(data, source) {
    const modal = new bootstrap.Modal(document.getElementById("detailModal"));
    const content = document.getElementById("detailContent");
    
    content.textContent = JSON.stringify(data, null, 2);
    document.querySelector("#detailModal .modal-title").textContent = `Details - ${directoryNames[source] || source}`;
    
    modal.show();
}

// Setup event listeners
function setupEventListeners() {
    // Scan filters
    document.getElementById("scanDomainFilter").addEventListener("input", function() {
        displayScanData(currentData);
    });
    
    document.getElementById("scanDirectoryFilter").addEventListener("change", function() {
        displayScanData(currentData);
    });
}

// Utility functions
function formatDate(dateString) {
    // Handle null, undefined, or empty string
    if (!dateString) {
        return "N/A";
    }
    
    // Handle ISO format (from API)
    if (dateString.includes('T')) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.error("Invalid ISO date:", dateString);
            return dateString;
        }
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }
    
    // Handle YYYY-MM-DD-HH-MM-SS format
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
    if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        const date = new Date(year, month - 1, day, hour, minute, second);
        if (isNaN(date.getTime())) {
            console.error("Invalid date from pattern:", dateString);
            return dateString;
        }
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }
    
    // Fallback
    console.warn("Unknown date format:", dateString);
    return dateString;
}

function showLoading(show) {
    document.querySelector(".loading-spinner").style.display = show ? "block" : "none";
}

// Expose functions globally
window.setHistoryTimeRange = setHistoryTimeRange;

