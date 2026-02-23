/**
 * Watchlist JavaScript
 * Handles WebSocket connections, real-time updates, and watchlist management
 */

// Configuration

import ErrorHandler from './js/errorHandler.js';

const API_BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
let socket = null;
let currentWatchlistId = null;
let currentUser = null;
let watchlists = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        showAuthWarning();
        return;
    }

    try {
        // Authenticate user
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentUser = await response.json();
            // Connect WebSocket
            connectWebSocket(token);
            // Load watchlists
            loadWatchlists();
            // Load notifications
            loadNotifications();
        } else {
            showAuthWarning();
        }
    } catch (error) {
        ErrorHandler.handle('Initialization error:', error);
        showAuthWarning();
    }

    // Event Listeners
    setupEventListeners();
});

/**
 * Connect WebSocket
 */
function connectWebSocket(token) {
    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        ErrorHandler.log('🔌 WebSocket connected');
        updateConnectionStatus(true);

        // Join current watchlist room if selected
        if (currentWatchlistId) {
            socket.emit('join_watchlist', currentWatchlistId);
        }
    });

    socket.on('disconnect', () => {
        ErrorHandler.log('🔌 WebSocket disconnected');
        updateConnectionStatus(false);
    });

    socket.on('notification', (notification) => {
        showToast(notification.title, notification.type);
        addNotification(notification);
        updateNotificationBadge(true);
    });

    socket.on('repo_update', (data) => {
        if (currentWatchlistId === data.watchlistId) {
            updateRepoCard(data.repo);
        }
    });

    socket.on('user_joined', (data) => {
        if (currentWatchlistId === data.watchlistId) {
            showToast('A user joined viewing this watchlist', 'info');
            // Request presence update
        }
    });

    socket.on('presence_update', (data) => {
        if (currentWatchlistId === data.watchlistId) {
            updatePresence(data.viewers);
        }
    });
}

/**
 * Load watchlists
 */
async function loadWatchlists() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/watchlists`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        watchlists = data.watchlists || [];

        renderWatchlistSidebar();

        // Select first watchlist if available
        if (watchlists.length > 0) {
            selectWatchlist(watchlists[0].id);
        } else {
            showEmptyState();
        }
    } catch (error) {
        ErrorHandler.handle('Error loading watchlists:', error);
        showToast('Failed to load watchlists', 'error');
    }
}

/**
 * Select a watchlist
 */
async function selectWatchlist(id) {
    // Leave previous room
    if (socket && currentWatchlistId) {
        socket.emit('leave_watchlist', currentWatchlistId);
    }

    currentWatchlistId = id;

    // Join new room
    if (socket) {
        socket.emit('join_watchlist', id);
    }

    // Update sidebar UI
    document.querySelectorAll('.watchlist-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.id == id) el.classList.add('active');
    });

    // Show loading state
    // ...

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/watchlists/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        const watchlist = data.watchlist;

        renderWatchlistContent(watchlist);
    } catch (error) {
        ErrorHandler.handle('Error loading watchlist details:', error);
        showToast('Failed to load watchlist details', 'error');
    }
}

/**
 * Render watchlist sidebar
 */
function renderWatchlistSidebar() {
    const list = document.getElementById('watchlist-list');
    list.innerHTML = '';

    watchlists.forEach(watchlist => {
        const item = document.createElement('div');
        item.className = 'watchlist-item';
        item.dataset.id = watchlist.id;
        item.onclick = () => selectWatchlist(watchlist.id);

        item.innerHTML = `
            <div class="watchlist-item-name">${watchlist.name}</div>
            <div class="watchlist-item-meta">
                <span>${watchlist.repo_count || 0} repos</span>
                <span>${watchlist.is_public ? 'Public' : 'Private'}</span>
            </div>
        `;
        list.appendChild(item);
    });
}

/**
 * Render watchlist content
 */
function renderWatchlistContent(watchlist) {
    // Hide empty state, show content
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('watchlist-content').style.display = 'block';

    // Update header
    document.getElementById('watchlist-title').textContent = watchlist.name;
    document.getElementById('watchlist-description').textContent = watchlist.description || 'No description';

    // Render repositories
    const grid = document.getElementById('repo-grid');
    grid.innerHTML = '';

    if (watchlist.repositories && watchlist.repositories.length > 0) {
        watchlist.repositories.forEach(repo => {
            grid.appendChild(createRepoCard(repo));
        });
    } else {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <h3>No repositories yet</h3>
                <p>Add repositories to start tracking them in real-time.</p>
                <button class="btn btn-primary" onclick="document.getElementById('add-repo-btn').click()" style="margin-top: 16px;">
                    Add Repository
                </button>
            </div>
        `;
    }
}

/**
 * Create repository card
 */
function createRepoCard(repo) {
    const card = document.createElement('div');
    card.className = 'repo-card';
    card.id = `repo-${repo.repo_full_name.replace('/', '-')}`;

    const data = repo.repo_data || {};

    card.innerHTML = `
        <div class="live-indicator"></div>
        <div class="repo-card-header">
            <a href="https://github.com/${repo.repo_full_name}" target="_blank" class="repo-name">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                ${repo.repo_full_name}
            </a>
            <div class="repo-actions">
                <button class="btn-icon text-danger" onclick="removeRepo('${repo.repo_full_name}')" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="repo-desc">${data.description || 'No description available'}</div>
        <div class="repo-stats">
            <div class="repo-stat" title="Stars">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                ${(data.stargazers_count || 0).toLocaleString()}
            </div>
            <div class="repo-stat" title="Forks">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="6" y1="3" x2="6" y2="15"></line>
                    <circle cx="18" cy="6" r="3"></circle>
                    <circle cx="6" cy="18" r="3"></circle>
                    <path d="M18 9a9 9 0 0 1-9 9"></path>
                </svg>
                ${(data.forks_count || 0).toLocaleString()}
            </div>
            <div class="repo-stat" title="Issues">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                ${(data.open_issues_count || 0).toLocaleString()}
            </div>
            <div class="repo-stat" style="margin-left: auto;">
                ${data.language || 'Unknown'}
            </div>
        </div>
    `;

    return card;
}

/**
 * Update repository card with animation
 */
function updateRepoCard(repo) {
    const cardId = `repo-${repo.repo_full_name.replace('/', '-')}`;
    const oldCard = document.getElementById(cardId);

    if (oldCard) {
        const newCard = createRepoCard(repo);
        newCard.classList.add('updated');
        oldCard.replaceWith(newCard);

        setTimeout(() => {
            newCard.classList.remove('updated');
        }, 1000);
    }
}

/**
 * Update presence indicators
 */
function updatePresence(viewers) {
    // This assumes viewer IDs. In a real app we'd need user details
    // For now, let's just show count
    const avatars = document.getElementById('presence-avatars');
    const text = document.getElementById('presence-text');

    avatars.innerHTML = '';

    // Mock user avatars for demo
    viewers.forEach((userId, index) => {
        if (index < 3) {
            const avatar = document.createElement('div');
            avatar.className = 'presence-avatar';
            avatar.textContent = `U${userId}`; // Simulating user initials
            avatars.appendChild(avatar);
        }
    });

    if (viewers.length > 3) {
        const more = document.createElement('div');
        more.className = 'presence-avatar';
        more.textContent = `+${viewers.length - 3}`;
        more.style.background = '#6b7280';
        avatars.appendChild(more);
    }

    text.textContent = viewers.length === 1
        ? 'Only you'
        : `${viewers.length} people viewing`;
}

/**
 * Create new watchlist
 */
async function createWatchlist(event) {
    event.preventDefault();

    const name = document.getElementById('watchlist-name').value;
    const description = document.getElementById('watchlist-desc').value;
    const isPublic = document.getElementById('watchlist-public').checked;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/watchlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description, isPublic })
        });

        if (response.ok) {
            document.getElementById('create-watchlist-modal').style.display = 'none';
            document.getElementById('create-watchlist-form').reset();
            showToast('Watchlist created successfully', 'success');
            loadWatchlists(); // Refresh list
        } else {
            showToast('Failed to create watchlist', 'error');
        }
    } catch (error) {
        ErrorHandler.handle('Error creating watchlist:', error);
        showToast('Error creating watchlist', 'error');
    }
}

/**
 * Add repository
 */
async function addRepository(event) {
    event.preventDefault();

    if (!currentWatchlistId) return;

    const repoFullName = document.getElementById('repo-name').value;

    try {
        const token = localStorage.getItem('authToken');

        // First fetch repo data from GitHub API (simulated here)
        // In real app, backend service would do this
        const repoData = {
            stars: 0,
            description: "Loading...",
            language: "Unknown"
        };

        const response = await fetch(`${API_BASE_URL}/watchlists/${currentWatchlistId}/repositories`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ repoFullName, repoData })
        });

        if (response.ok) {
            document.getElementById('add-repo-modal').style.display = 'none';
            document.getElementById('add-repo-form').reset();
            showToast('Repository added successfully', 'success');
            selectWatchlist(currentWatchlistId); // Refresh content
        } else {
            showToast('Failed to add repository', 'error');
        }
    } catch (error) {
        ErrorHandler.handle('Error adding repository:', error);
        showToast('Error adding repository', 'error');
    }
}

/**
 * Remove repository
 */
async function removeRepo(repoName) {
    if (!confirm(`Are you sure you want to remove ${repoName}?`)) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/watchlists/${currentWatchlistId}/repositories/${encodeURIComponent(repoName)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showToast('Repository removed', 'success');
            const card = document.getElementById(`repo-${repoName.replace('/', '-')}`);
            if (card) card.remove();
        } else {
            showToast('Failed to remove repository', 'error');
        }
    } catch (error) {
        ErrorHandler.handle('Error removing repository:', error);
        showToast('Error removing repository', 'error');
    }
}

/**
 * Notifications
 */
let notifications = [];

async function loadNotifications() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/notifications?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        notifications = data.notifications || [];
        const unreadCount = data.unreadCount || 0;

        renderNotifications();
        updateNotificationBadge(unreadCount > 0, unreadCount);
    } catch (error) {
        ErrorHandler.handle('Error loading notifications:', error);
    }
}

function renderNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = '';

    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No notifications</div>';
        return;
    }

    notifications.forEach(notif => {
        const item = document.createElement('div');
        item.className = `notification-item ${notif.is_read ? '' : 'unread'}`;
        item.innerHTML = `
            <div class="notification-icon">🔔</div>
            <div class="notification-content">
                <h4>${notif.title}</h4>
                <p>${notif.message}</p>
                <div class="notification-time">${new Date(notif.created_at).toLocaleString()}</div>
            </div>
        `;
        list.appendChild(item);
    });
}

function updateNotificationBadge(show, count) {
    const badge = document.getElementById('notification-badge');
    if (show) {
        badge.style.display = 'flex';
        if (count) badge.textContent = count > 9 ? '9+' : count;
    } else {
        badge.style.display = 'none';
    }
}

function addNotification(notification) {
    notifications.unshift(notification);
    renderNotifications();
}

/**
 * UI Utilities
 */
function updateConnectionStatus(connected) {
    const status = document.getElementById('connection-status');
    if (connected) {
        status.classList.remove('disconnected');
        status.querySelector('.status-text').textContent = 'Connected';
    } else {
        status.classList.add('disconnected');
        status.querySelector('.status-text').textContent = 'Disconnected';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showAuthWarning() {
    document.getElementById('auth-warning').style.display = 'flex';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('watchlist-content').style.display = 'none';
}

function showEmptyState() {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('watchlist-content').style.display = 'none';
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Modal controls
    document.getElementById('create-watchlist-btn').addEventListener('click', () => {
        document.getElementById('create-watchlist-modal').style.display = 'flex';
    });

    document.getElementById('add-repo-btn').addEventListener('click', () => {
        document.getElementById('add-repo-modal').style.display = 'flex';
    });

    // Forms
    document.getElementById('create-watchlist-form').addEventListener('submit', createWatchlist);
    document.getElementById('add-repo-form').addEventListener('submit', addRepository);

    // Notification bell
    document.getElementById('notification-bell').addEventListener('click', () => {
        const panel = document.getElementById('notification-panel');
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });

    // Mark all read
    document.getElementById('mark-all-read').addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`${API_BASE_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            notifications.forEach(n => n.is_read = 1);
            renderNotifications();
            updateNotificationBadge(false);
        } catch (error) {
            ErrorHandler.handle('Error marking read:', error);
        }
    });

    // Close modals on outside click
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Global scope for onclick handlers
window.removeRepo = removeRepo;
window.selectWatchlist = selectWatchlist;
// window.manageCollaborators ... to be implemented
