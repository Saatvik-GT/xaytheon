/**
 * Analytics Dashboard JavaScript
 * Handles data fetching, chart rendering, and user interactions
 */

import ErrorHandler from './js/errorHandler.js';
// Configuration
const API_BASE_URL = 'http://127.0.0.1:5000/api';
let currentUser = null;
let analyticsData = [];
let charts = {};
let offlineManager;
let socket; // Socket.io instance

// Chart color schemes
const COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    gradient: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Initializing Analytics Dashboard...');

    // Initialize offline manager
    offlineManager = new OfflineManager();
    await offlineManager.initDB();

    // Listen for auth changes
    window.addEventListener('xaytheon:authchange', async (e) => {
        const user = e.detail.user;
        if (user) {
            currentUser = user;
            hideAuthWarning();
            await loadPreferences();
            await loadAnalyticsData();
            initWebSocket();
        } else {
            currentUser = null;
            showAuthWarning();
        }
    });

    // Check initial authentication (wait a bit for auth.js to restore session)
    setTimeout(async () => {
        if (window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated()) {
            currentUser = window.XAYTHEON_AUTH.getSession().user;
            hideAuthWarning();
            await loadPreferences();
            await loadAnalyticsData();
            initWebSocket();
        } else {
            // If not authenticated yet, checkAuthentication() might not be needed if we rely on event
            // but let's keep it as fallback or direct check
            await checkAuthentication();
        }
    }, 500);

    // Set up event listeners
    setupEventListeners();

    // Monitor network status
    setupNetworkMonitoring();

    // Set default date range (last 30 days)
    setDefaultDateRange(30);
});

/**
 * Load user preferences for analytics
 */
async function loadPreferences() {
    if (!window.XAYTHEON_AUTH) return;
    const prefs = await window.XAYTHEON_AUTH.fetchPreferences();

    if (prefs && prefs.analytics) {
        const p = prefs.analytics;
        if (p.starsChartType) document.getElementById('stars-chart-type').value = p.starsChartType;
        if (p.followersChartType) document.getElementById('followers-chart-type').value = p.followersChartType;

        // Table visibility
        const tableContainer = document.getElementById('table-container');
        if (p.showTable) {
            tableContainer.style.display = 'block';
        } else {
            tableContainer.style.display = 'none';
        }
    }
}

/**
 * Save analytics preference
 */
function saveAnalyticsPreference(key, value) {
    if (!window.XAYTHEON_AUTH || !window.XAYTHEON_AUTH.isAuthenticated()) return;

    // We need to fetch current prefs first to merge? 
    // API implementation handles merge of `analytics` object keys if we send logic correctly.
    // My controller implementation: newPrefs.analytics = { ...old, ...req.body.analytics }
    // so I can just send the partial update.

    const payload = {
        analytics: {
            [key]: value
        }
    };
    window.XAYTHEON_AUTH.savePreferences(payload);
}

/**
 * Monitor network status
 */
/**
 * Monitor network status
 */
function setupNetworkMonitoring() {
    window.addEventListener('online', () => {
        updateOnlineStatus(true);
        showToast('You are back online! Syncing data...', 'success');
        loadAnalyticsData(true);
    });
    window.addEventListener('offline', () => {
        updateOnlineStatus(false);
        showToast('You are offline. Some features may be limited.', 'error');
    });
    updateOnlineStatus(navigator.onLine);
}

/**
 * Update UI based on online status
 */
function updateOnlineStatus(isOnline) {
    const statusEl = document.getElementById('connection-status');
    const refreshBtn = document.getElementById('refresh-data-btn');

    if (isOnline) {
        statusEl.classList.add('hidden');
        statusEl.innerHTML = '<span class="status-dot online"></span><span class="status-text">ONLINE</span>';
        refreshBtn.disabled = false;
        // Hide badge after delay if needed, or keep logic simple
        statusEl.style.display = 'none';
    } else {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = '<span class="status-dot offline"></span><span class="status-text">OFFLINE</span>';
        statusEl.style.display = 'flex';
        // refreshBtn.disabled = true; // Optional: disable refresh while offline
    }
}

/**
 * Check if user is authenticated
 */
async function checkAuthentication() {
    try {
        // Use XAYTHEON_AUTH instead of localStorage
        if (!window.XAYTHEON_AUTH || !window.XAYTHEON_AUTH.isAuthenticated()) {
            showAuthWarning();
            return;
        }

        const token = window.XAYTHEON_AUTH.getAccessToken();

        if (!token) {
            showAuthWarning();
            return;
        }

        // Verify token with backend
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            currentUser = await response.json();
            hideAuthWarning();
        } else {
            showAuthWarning();
        }
    } catch (error) {
        ErrorHandler.handle('Authentication check failed:', error);
        showAuthWarning();
    }
}

/**
 * Show authentication warning
 */
function showAuthWarning() {
    const warning = document.getElementById('auth-warning');
    if (warning) {
        warning.style.display = 'flex';
    }

    // Hide main content
    document.getElementById('metrics-grid').style.display = 'none';
    document.querySelector('.charts-grid').style.display = 'none';
    document.querySelector('.table-card').style.display = 'none';
    document.querySelector('.date-range-card').style.display = 'none';
}

/**
 * Hide authentication warning
 */
function hideAuthWarning() {
    const warning = document.getElementById('auth-warning');
    if (warning) {
        warning.style.display = 'none';
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Date range quick buttons
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const days = parseInt(e.target.dataset.range);
            setDefaultDateRange(days);
            loadAnalyticsData();
        });
    });

    // Date inputs
    document.getElementById('start-date').addEventListener('change', loadAnalyticsData);
    document.getElementById('end-date').addEventListener('change', loadAnalyticsData);

    // Refresh button
    document.getElementById('refresh-data-btn').addEventListener('click', () => {
        loadAnalyticsData(true);
    });

// Export button to show modal
document.getElementById('export-data-btn').addEventListener('click', showExportModal);

// Close modal button
document.getElementById('close-export-modal').addEventListener('click', hideExportModal);

// Export option buttons
document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const format = e.currentTarget.dataset.format;
        exportData(format);
    });
});

    // Table toggle
    document.getElementById('toggle-table-btn').addEventListener('click', () => {
        toggleTable();
        const container = document.getElementById('table-container');
        saveAnalyticsPreference('showTable', container.style.display !== 'none');
    });

    // Chart type selectors
    document.getElementById('stars-chart-type').addEventListener('change', (e) => {
        updateChartType('stars', e.target.value);
        saveAnalyticsPreference('starsChartType', e.target.value);
    });

    document.getElementById('followers-chart-type').addEventListener('change', (e) => {
        updateChartType('followers', e.target.value);
        saveAnalyticsPreference('followersChartType', e.target.value);
    });
}

/**
 * Set default date range
 */
function setDefaultDateRange(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
}

/**
 * Generate sample analytics data for demonstration
 */
function generateSampleData() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const data = [];

    // Base values with realistic growth
    let stars = 150;
    let followers = 85;
    let following = 42;
    let publicRepos = 12;
    let totalCommits = 450;
    let contributionCount = 15;

    // Language distribution (stays relatively constant)
    const languageStats = {
        'JavaScript': 35,
        'Python': 25,
        'TypeScript': 20,
        'HTML': 10,
        'CSS': 10
    };

    // Generate data for each day in range
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        // Add realistic random growth
        stars += Math.floor(Math.random() * 3); // 0-2 stars per day
        followers += Math.random() < 0.3 ? 1 : 0; // 30% chance of new follower
        following += Math.random() < 0.1 ? 1 : 0; // 10% chance
        publicRepos += Math.random() < 0.05 ? 1 : 0; // 5% chance of new repo
        totalCommits += Math.floor(Math.random() * 8) + 2; // 2-10 commits per day
        contributionCount += Math.floor(Math.random() * 5); // 0-4 contributions

        data.push({
            snapshot_date: new Date(date).toISOString(),
            stars,
            followers,
            following,
            public_repos: publicRepos,
            total_commits: totalCommits,
            contribution_count: contributionCount,
            language_stats: { ...languageStats }
        });
    }

    return data;
}

/**
 * Load analytics data from API
 */
/**
 * Load analytics data from API with client-side TTL caching
 */
async function loadAnalyticsData(forceRefresh = false) {
    // Check if user is authenticated
    const isAuthenticated = currentUser && window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated();

    // If not authenticated, use sample data for demo
    if (!isAuthenticated) {
        console.log('📊 Loading sample data for demonstration...');
        analyticsData = generateSampleData();

        if (analyticsData.length > 0) {
            // Show demo indicator
            const header = document.querySelector('.analytics-header h1');
            if (header && !header.querySelector('.demo-badge')) {
                const badge = document.createElement('span');
                badge.className = 'demo-badge';
                badge.textContent = '(Demo Data)';
                badge.style.cssText = 'font-size: 0.6em; color: #f59e0b; margin-left: 10px; font-weight: normal;';
                header.appendChild(badge);
            }

            // Update UI with sample data
            updateMetrics();
            renderCharts();
            updateTable();

            // Show content
            document.getElementById('metrics-grid').style.display = 'grid';
            document.querySelector('.charts-grid').style.display = 'grid';
            document.querySelector('.table-card').style.display = 'block';
            document.querySelector('.date-range-card').style.display = 'block';
        }
        return;
    }

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const cacheKey = `analytics_${startDate}_${endDate}`;
    const lastUpdatedEl = document.getElementById('last-updated-time');
    const lastUpdatedInfo = document.getElementById('last-updated-info');

    if (!startDate || !endDate) {
        ErrorHandler.handle('Please select both start and end dates');
        return;
    }

    // --- STEP 1: TTL CACHE CHECK (Issue #225) ---
    // If we are online and NOT forcing a refresh, check the CacheManager first
    if (!forceRefresh && navigator.onLine) {
        const cachedData = defaultCache.get(cacheKey); //
        if (cachedData) {
            console.log('✅ Using valid TTL-cached data for:', cacheKey);
            analyticsData = cachedData;
            
            // Update UI immediately with cached data
            updateMetrics();
            renderCharts();
            updateTable();

            // Indicate the data is from the recent cache
            lastUpdatedEl.textContent = 'Cached (Recently)';
            lastUpdatedInfo.style.display = 'inline-block';
            return; // Exit early to avoid redundant API request
        }
    }

    try {
        // Try to fetch from API if online
        if (navigator.onLine) {
            const token = window.XAYTHEON_AUTH ? window.XAYTHEON_AUTH.getAccessToken() : null;

            if (!token) throw new Error('No access token');

            // Fetch snapshots
            const response = await fetch(
                `${API_BASE_URL}/analytics/snapshots?startDate=${startDate}&endDate=${endDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch analytics data');
            }

            const data = await response.json();
            analyticsData = data.snapshots || [];

            // --- STEP 2: UPDATE TTL CACHE (Issue #225) ---
            // Store the fresh data in localStorage with the default 30-minute expiry
            defaultCache.set(cacheKey, analyticsData); //

            // Persistent storage for offline use
            await offlineManager.saveData(cacheKey, analyticsData); //

            // Update "Last updated" text
            lastUpdatedEl.textContent = 'Just now';
            lastUpdatedInfo.style.display = 'inline-block';

        } else {
            // Offline: fallback to cache 
            throw new Error('Offline');
        }

    } catch (error) {
        ErrorHandler.handle('Fetching unsuccessful, attempting persistent cache...', error);

        // Try loading from persistent OfflineManager
        const cachedRecord = await offlineManager.loadData(cacheKey); //

        if (cachedRecord && cachedRecord.data) {
            analyticsData = cachedRecord.data;

            if (navigator.onLine) {
                showError('Could not fetch new data. Showing cached version.');
            }

            // Update timestamp based on when it was originally saved to OfflineManager
            lastUpdatedEl.textContent = offlineManager.formatTime(cachedRecord.timestamp);
            lastUpdatedInfo.style.display = 'inline-block';

        } else {
            if (!navigator.onLine) {
                showError('You are offline and no cached data is available for this date range.');
            } else {
                ErrorHandler.handle('Error loading analytics data:', error);
                showError('Failed to load analytics data. Please try again.');
            }
            return;
        }
    }

    if (analyticsData.length === 0) {
        showEmptyState();
        return;
    }

    // Update UI
    updateMetrics();
    renderCharts();
    updateTable();
}

/**
 * Update metrics cards
 */
function updateMetrics() {
    if (analyticsData.length === 0) return;

    const latest = analyticsData[analyticsData.length - 1];
    const first = analyticsData[0];

    // Update values
    document.getElementById('metric-stars').textContent = latest.stars.toLocaleString();
    document.getElementById('metric-followers').textContent = latest.followers.toLocaleString();
    document.getElementById('metric-repos').textContent = latest.public_repos.toLocaleString();
    document.getElementById('metric-commits').textContent = latest.total_commits.toLocaleString();

    // Calculate and display changes
    updateMetricChange('stars', first.stars, latest.stars);
    updateMetricChange('followers', first.followers, latest.followers);
    updateMetricChange('repos', first.public_repos, latest.public_repos);
    updateMetricChange('commits', first.total_commits, latest.total_commits);
}

/**
 * Update metric change indicator
 */
function updateMetricChange(metric, oldValue, newValue) {
    const changeEl = document.getElementById(`metric-${metric}-change`);
    const change = newValue - oldValue;
    const percentChange = oldValue > 0 ? ((change / oldValue) * 100).toFixed(1) : 0;

    let className = 'neutral';
    let symbol = '';

    if (change > 0) {
        className = 'positive';
        symbol = '↑';
    } else if (change < 0) {
        className = 'negative';
        symbol = '↓';
    } else {
        symbol = '→';
    }

    changeEl.className = `metric-change ${className}`;
    changeEl.textContent = `${symbol} ${Math.abs(change).toLocaleString()} (${percentChange}%)`;
}

/**
 * Render all charts
 */
function renderCharts() {
    renderStarsChart();
    renderFollowersChart();
    renderReposChart();
    renderCommitsChart();
    renderLanguageChart();
    renderContributionChart();
}

/**
 * Render stars growth chart
 */
function renderStarsChart() {
    const ctx = document.getElementById('stars-chart').getContext('2d');
    const chartType = document.getElementById('stars-chart-type').value;

    if (charts.stars) {
        charts.stars.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.stars);

    charts.stars = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: 'Total Stars',
                data,
                backgroundColor: chartType === 'bar' ? COLORS.primary : `${COLORS.primary}20`,
                borderColor: COLORS.primary,
                borderWidth: 2,
                fill: chartType === 'line',
                tension: 0.4,
            }],
        },
        options: getChartOptions('Stars'),
    });
}

/**
 * Render followers growth chart
 */
function renderFollowersChart() {
    const ctx = document.getElementById('followers-chart').getContext('2d');
    const chartType = document.getElementById('followers-chart-type').value;

    if (charts.followers) {
        charts.followers.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const followersData = analyticsData.map(d => d.followers);
    const followingData = analyticsData.map(d => d.following);

    charts.followers = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [
                {
                    label: 'Followers',
                    data: followersData,
                    backgroundColor: chartType === 'bar' ? COLORS.success : `${COLORS.success}20`,
                    borderColor: COLORS.success,
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                },
                {
                    label: 'Following',
                    data: followingData,
                    backgroundColor: chartType === 'bar' ? COLORS.info : `${COLORS.info}20`,
                    borderColor: COLORS.info,
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                },
            ],
        },
        options: getChartOptions('Followers'),
    });
}

/**
 * Render repositories chart
 */
function renderReposChart() {
    const ctx = document.getElementById('repos-chart').getContext('2d');

    if (charts.repos) {
        charts.repos.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.public_repos);

    charts.repos = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Public Repositories',
                data,
                backgroundColor: `${COLORS.secondary}20`,
                borderColor: COLORS.secondary,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }],
        },
        options: getChartOptions('Repositories'),
    });
}

/**
 * Render commits chart
 */
function renderCommitsChart() {
    const ctx = document.getElementById('commits-chart').getContext('2d');

    if (charts.commits) {
        charts.commits.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.total_commits);

    charts.commits = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Total Commits',
                data,
                backgroundColor: COLORS.warning,
                borderColor: COLORS.warning,
                borderWidth: 1,
            }],
        },
        options: getChartOptions('Commits'),
    });
}

/**
 * Render language distribution chart
 */
function renderLanguageChart() {
    const ctx = document.getElementById('language-chart').getContext('2d');

    if (charts.language) {
        charts.language.destroy();
    }

    // Aggregate language stats from latest snapshot
    const latest = analyticsData[analyticsData.length - 1];
    const languageStats = latest.language_stats || {};

    const labels = Object.keys(languageStats);
    const data = Object.values(languageStats);

    if (labels.length === 0) {
        // Show empty state
        ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Language Data</h3><p>Language statistics will appear here once available.</p></div>';
        return;
    }

    charts.language = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: COLORS.gradient,
                borderWidth: 2,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${percentage}%`;
                        }
                    }
                }
            },
        },
    });
}

/**
 * Render contribution velocity chart
 */
function renderContributionChart() {
    const ctx = document.getElementById('contribution-chart').getContext('2d');

    if (charts.contribution) {
        charts.contribution.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.contribution_count || 0);

    charts.contribution = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Contributions',
                data,
                backgroundColor: `${COLORS.danger}20`,
                borderColor: COLORS.danger,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }],
        },
        options: getChartOptions('Contributions'),
    });
}

/**
 * Get common chart options
 */
function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                },
            },
        },
    };
}

/**
 * Update chart type
 */
function updateChartType(chartName, type) {
    if (chartName === 'stars') {
        renderStarsChart();
    } else if (chartName === 'followers') {
        renderFollowersChart();
    }
}

/**
 * Update data table
 */
function updateTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    analyticsData.forEach(snapshot => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${new Date(snapshot.snapshot_date).toLocaleDateString()}</td>
      <td>${snapshot.stars.toLocaleString()}</td>
      <td>${snapshot.followers.toLocaleString()}</td>
      <td>${snapshot.following.toLocaleString()}</td>
      <td>${snapshot.public_repos.toLocaleString()}</td>
      <td>${snapshot.total_commits.toLocaleString()}</td>
      <td>${(snapshot.contribution_count || 0).toLocaleString()}</td>
    `;
        tbody.appendChild(row);
    });
}

/**
 * Toggle table visibility
 */
function toggleTable() {
    const container = document.getElementById('table-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

/**
 * Show export modal
 */
function showExportModal() {
    document.getElementById('export-modal').style.display = 'flex';
}

/**
 * Hide export modal
 */
function hideExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}


/**
 * Export data - updated for better error handling
 */
async function exportData(format) {
    // Hide modal immediately to prevent double-clicks
    hideExportModal();

    if (format === 'pdf') {
        await exportToPDF();
        return;
    }

    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const token = window.XAYTHEON_AUTH ? window.XAYTHEON_AUTH.getAccessToken() : null;

        if (!token) {
            showError('Please sign in to export data');
            return;
        }

        showToast(`Exporting as ${format.toUpperCase()}...`, 'info');

        const response = await fetch(
            `${API_BASE_URL}/analytics/export?format=${format}&startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Export failed with status: ${response.status}`);
        }

        // Get filename from header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `analytics-export-${Date.now()}.${format}`;

        if (contentDisposition) {
            const matches = contentDisposition.match(/filename="?(.+?)"?$/);
            if (matches && matches[1]) {
                filename = matches[1];
            }
        }

        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        showSuccess(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
        ErrorHandler.handle('Export error:', error);
        showError(`Failed to export ${format.toUpperCase()}. ${error.message}`);
    }
}

/**
 * Export dashboard as PDF - Enhanced with chart images
 */
async function exportToPDF() {
    try {
        showToast('Generating PDF report with charts... Please wait.', 'info');

        // Wait a moment for toast to show
        await new Promise(resolve => setTimeout(resolve, 100));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 60;

        // Add title
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('GitHub Analytics Report', 40, yPosition);
        yPosition += 30;

        // Add date range
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Date Range: ${startDate || 'N/A'} to ${endDate || 'N/A'}`, 40, yPosition);
        yPosition += 20;
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, yPosition);
        yPosition += 30;

        // Add summary metrics
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Summary Metrics:', 40, yPosition);
        yPosition += 20;

        const metrics = [
            `Total Stars: ${document.getElementById('metric-stars').textContent}`,
            `Followers: ${document.getElementById('metric-followers').textContent}`,
            `Public Repos: ${document.getElementById('metric-repos').textContent}`,
            `Total Commits: ${document.getElementById('metric-commits').textContent}`
        ];

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        metrics.forEach((metric) => {
            doc.text(metric, 40, yPosition);
            yPosition += 18;
        });

        yPosition += 20;

        // Capture and add charts
        const chartIds = ['stars-chart', 'followers-chart', 'repos-chart', 'commits-chart', 'language-chart', 'contribution-chart'];
        const chartTitles = ['Stars Growth', 'Followers Growth', 'Repository Growth', 'Commit Activity', 'Language Distribution', 'Contribution Velocity'];

        for (let i = 0; i < chartIds.length; i++) {
            const canvas = document.getElementById(chartIds[i]);
            if (!canvas) continue;

            // Check if we need a new page
            if (yPosition > pageHeight - 250) {
                doc.addPage();
                yPosition = 40;
            }

            // Add chart title
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(chartTitles[i], 40, yPosition);
            yPosition += 15;

            // Convert canvas to image
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - 80; // 40px margin on each side
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Add image to PDF
            doc.addImage(imgData, 'PNG', 40, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 20;
        }

        // Add data table on new page if available
        if (analyticsData && analyticsData.length > 0) {
            doc.addPage();
            yPosition = 40;

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Historical Data:', 40, yPosition);
            yPosition += 25;

            // Table headers
            const headers = ['Date', 'Stars', 'Followers', 'Repos', 'Commits'];

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            headers.forEach((header, i) => {
                doc.text(header, 40 + (i * 100), yPosition);
            });

            // Draw header line
            doc.setLineWidth(1);
            doc.line(40, yPosition + 5, 40 + (headers.length * 100), yPosition + 5);
            yPosition += 20;

            // Table rows
            doc.setFont(undefined, 'normal');
            analyticsData.slice(0, 25).forEach((snapshot) => { // Limit to 25 rows
                if (yPosition > pageHeight - 40) { // New page if needed
                    doc.addPage();
                    yPosition = 40;
                }

                const rowData = [
                    new Date(snapshot.snapshot_date).toLocaleDateString(),
                    snapshot.stars.toString(),
                    snapshot.followers.toString(),
                    snapshot.public_repos.toString(),
                    snapshot.total_commits.toString()
                ];

                rowData.forEach((data, i) => {
                    doc.text(data, 40 + (i * 100), yPosition);
                });
                yPosition += 18;
            });
        }

        // Add footer to all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Page ${i} of ${pageCount}`, 40, pageHeight - 20);
            doc.text('Generated by XAYTHEON Analytics', pageWidth - 200, pageHeight - 20);
        }

        // Generate filename
        const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;

        // Save the PDF
        doc.save(filename);

        showToast('PDF Report with charts downloaded successfully!', 'success');

    } catch (error) {
        ErrorHandler.handle('PDF Generation Error:', error);
        showError(`Failed to generate PDF: ${error.message}`);
    }
}

/**
 * Fallback PDF export using server-side endpoint
 */
async function fallbackPDFExport() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const token = window.XAYTHEON_AUTH ? window.XAYTHEON_AUTH.getAccessToken() : null;

        if (!token) {
            throw new Error('No authentication token');
        }

        showToast('Using server-side PDF export...', 'info');

        const response = await fetch(
            `${API_BASE_URL}/analytics/export?format=pdf&startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/pdf'
                },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server export failed: ${response.status} - ${errorText}`);
        }

        // Get the blob
        const blob = await response.blob();

        // Check blob type
        if (blob.size === 0) {
            throw new Error('Server returned empty PDF');
        }

        // Create blob URL for download
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        }, 100);

        showToast('PDF exported via server!', 'success');

    } catch (fallbackError) {
        ErrorHandler.handle('Fallback export failed:', fallbackError);
        showError('Both PDF export methods failed. Try exporting as CSV or JSON instead.');
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    const metricsGrid = document.getElementById('metrics-grid');
    metricsGrid.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">📊</div>
      <h3>No Analytics Data Available</h3>
      <p>Start tracking your GitHub analytics by creating your first snapshot from the GitHub Dashboard.</p>
    </div>
  `;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-in forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 4000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    console.log('✅', message);
    showToast(message, 'success');
}

/**
 * Show error message
 */
function showError(message) {
    console.error('❌', message);
    showToast(message, 'error');
}
/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
    if (socket) return;

    if (socket) return;

    const token = window.XAYTHEON_AUTH ? window.XAYTHEON_AUTH.getAccessToken() : null;
    if (!token) return;

    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
    socket = io(socketUrl, {
        auth: {
            token: token
        },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('🔌 Connected to WebSocket server');
        socket.emit('join_analytics');

        // Show live indicator
        const liveIndicator = document.getElementById('live-indicator');
        if (liveIndicator) {
            liveIndicator.style.display = 'flex';
        }
    });

    socket.on('analytics_update', (update) => {
        // console.log('📡 Real-time update received:', update);
        handleRealTimeUpdate(update);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
        const liveIndicator = document.getElementById('live-indicator');
        if (liveIndicator) {
            liveIndicator.style.display = 'none';
        }
    });

    socket.on('connect_error', (err) => {
        ErrorHandler.handle('WebSocket connection error:', err);
    });
}

/**
 * Handle real-time analytics update
 * @param {Object} update 
 */
function handleRealTimeUpdate(update) {
    if (!update || !update.data) return;

    // Flash live indicator
    const liveDot = document.querySelector('.live-dot');
    if (liveDot) {
        liveDot.style.color = '#fff';
        setTimeout(() => {
            liveDot.style.color = 'currentColor';
        }, 300);
    }

    // Update "Last updated" to "LIVE"
    const lastUpdatedInfo = document.getElementById('last-updated-time');
    if (lastUpdatedInfo) {
        lastUpdatedInfo.textContent = 'LIVE';
    }

    // Apply incremental updates to the latest data point
    // In a real app, we might push a new data point or update the existing one
    // Here we'll update existing latest point for visual effect or push if needed

    if (analyticsData.length > 0) {
        const latest = analyticsData[analyticsData.length - 1];

        // Apply changes
        latest.stars += (update.data.stars_change || 0);
        latest.followers += (update.data.followers_change || 0);
        latest.total_commits += (update.data.commits_change || 0);

        // Only re-render if visible
        requestAnimationFrame(() => {
            updateMetrics();

            // Only update charts occasionally or if significant change to avoid performance hit
            // For this demo, we'll update charts too to show movement
            charts.stars.data.datasets[0].data[analyticsData.length - 1] = latest.stars;
            charts.stars.update('none'); // efficient update

            charts.followers.data.datasets[0].data[analyticsData.length - 1] = latest.followers;
            charts.followers.update('none');

            charts.commits.data.datasets[0].data[analyticsData.length - 1] = latest.total_commits;
            charts.commits.update('none');
        });
    }
}

/**
 * Show/Hide Export Modal
 */
function showExportModal() {
    document.getElementById('export-modal').style.display = 'flex';
}

function hideExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

/**
 * Fetch and download export data
 */
async function exportData(format) {
    hideExportModal();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const token = window.XAYTHEON_AUTH ? window.XAYTHEON_AUTH.getAccessToken() : null;

    if (!token) {
        showToast('Please sign in to export data', 'error');
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/analytics/export?format=${format}&startDate=${startDate}&endDate=${endDate}`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showToast(`Exported as ${format.toUpperCase()} successfully`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export data', 'error');
    }
}
