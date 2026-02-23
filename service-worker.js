/**
 * XAYTHEON Service Worker
 * Provides offline support, caching strategies, and push notifications
 */

importScripts('/js/errorHandler.js');

const CACHE_NAME = 'xaytheon-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install (App Shell)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/github.html',
    '/analytics.html',
    '/achievements.html',
    '/watchlist.html',
    '/community.html',
    '/explore.html',
    '/contributions.html',
    '/offline.html',
    '/style.css',
    '/script.js',
    '/auth.js',
    '/pwa.js',
    '/manifest.json',
    '/assets/logo/thelogo.png',
    '/assets/favicon.svg'
];

// API endpoints to cache with network-first strategy
const API_CACHE_NAME = 'xaytheon-api-v1';
const API_ENDPOINTS = [
    '/api/achievements',
    '/api/achievements/leaderboard'
];

// ==================== INSTALL EVENT ====================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] App shell cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((err) => {
                ErrorHandler.handle('[SW] Failed to cache app shell', err);
            })
    );
});

// ==================== ACTIVATE EVENT ====================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                return self.clients.claim(); // Take control immediately
            })
            .catch((err) => {
                ErrorHandler.handle('[SW] Activation failed', err);
            })
    );
});

// ==================== FETCH EVENT ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests (except for CDN assets)
    if (url.origin !== location.origin && !isTrustedCDN(url.origin)) return;

    // API requests - Network First, fallback to cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, API_CACHE_NAME));
        return;
    }

    // Static assets - Cache First, fallback to network
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // HTML pages - Network First with offline fallback
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstWithOffline(request));
        return;
    }

    // Default - Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request));
});

// ==================== CACHING STRATEGIES ====================

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        ErrorHandler.handle('[SW] Cache first failed', error);
        throw error;
    }
}

async function networkFirst(request, cacheName = CACHE_NAME) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache...');
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        ErrorHandler.handle('[SW] Network and cache both failed', error);
        throw error;
    }
}

async function networkFirstWithOffline(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Offline, serving cached page or offline page...');
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        return caches.match(OFFLINE_URL);
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) cache.put(request, networkResponse.clone());
            return networkResponse;
        })
        .catch((err) => ErrorHandler.handle('[SW] Stale while revalidate failed', err));

    return cachedResponse || fetchPromise;
}

// ==================== HELPER FUNCTIONS ====================
function isStaticAsset(pathname) {
    return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(pathname);
}

function isTrustedCDN(origin) {
    const trustedCDNs = [
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
    ];
    return trustedCDNs.includes(origin);
}

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    let data = {
        title: 'XAYTHEON',
        body: 'You have a new notification!',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        tag: 'xaytheon-notification',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            vibrate: [100, 50, 100],
            actions: [
                { action: 'open', title: 'Open' },
                { action: 'close', title: 'Dismiss' }
            ]
        }).catch((err) => ErrorHandler.handle('[SW] Push notification failed', err))
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
                }
                if (clients.openWindow) return clients.openWindow(urlToOpen);
            }).catch((err) => ErrorHandler.handle('[SW] Notification click handling failed', err))
    );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-pending-requests') {
        event.waitUntil(syncPendingRequests());
    }
});

async function syncPendingRequests() {
    const pendingRequests = await getPendingRequests();

    for (const request of pendingRequests) {
        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body
            });

            if (response.ok) {
                await removePendingRequest(request.id);
                console.log('[SW] Synced request:', request.url);
            }
        } catch (error) {
            ErrorHandler.handle('[SW] Failed to sync request', error);
        }
    }
}

// IndexedDB helpers for pending requests
async function getPendingRequests() {
    return [];
}

async function removePendingRequest(id) {}

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') self.skipWaiting();

    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

console.log('[SW] Service Worker loaded');
