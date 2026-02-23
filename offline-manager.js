import ErrorHandler from './js/errorHandler.js';

/**
 * OfflineManager - Handles client-side caching using IndexedDB
 */
class OfflineManager {
    constructor(dbName = 'XaytheonDB', storeName = 'analytics_store') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.initPromise = this.initDB();
    }

    /**
     * Initialize the IndexedDB
     */
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (event) => {
                ErrorHandler.handle('IndexedDB error', event.target.error);
                reject('Error opening database');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Create an object store with 'key' as the key path
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Save data to the store
     */
    async saveData(key, data) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const record = {
                key: key,
                data: data,
                timestamp: Date.now()
            };

            const request = store.put(record);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                ErrorHandler.handle('Error saving data', event.target.error);
                reject('Error saving data');
            };
        });
    }

    /**
     * Load data from the store
     */
    async loadData(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject('Database not initialized');
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result : null);
            };

            request.onerror = (event) => {
                ErrorHandler.handle('Error loading data', event.target.error);
                reject('Error loading data');
            };
        });
    }

    /**
     * Get formatted last updated time
     */
    formatTime(timestamp) {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleString();
    }
}
