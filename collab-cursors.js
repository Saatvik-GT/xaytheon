import ErrorHandler from './js/errorHandler.js';

/**
 * Collab Cursors Management
 * Handles rendering and updating remote user cursors.
 */
class CollabCursors {
    constructor(containerId) {
        try {
            this.container = document.getElementById(containerId) || document.body;
            this.cursors = new Map(); // userId -> element
        } catch (err) {
            ErrorHandler.handle('Failed to initialize CollabCursors', err);
        }
    }

    updateCursor(userId, x, y, metadata) {
        try {
            if (!this.cursors.has(userId)) {
                this.createCursor(userId, metadata);
            }

            const cursor = this.cursors.get(userId);
            const { label, dot } = cursor;

            // Smooth translation
            dot.style.transform = `translate(${x}px, ${y}px)`;
            label.style.transform = `translate(${x}px, ${y}px)`;

            // Update label name if changed
            if (metadata.name) label.innerText = metadata.name;
        } catch (err) {
            ErrorHandler.handle(`Failed to update cursor for ${userId}`, err);
        }
    }

    createCursor(userId, metadata) {
        try {
            const color = this.getRandomColor();

            const dot = document.createElement('div');
            dot.className = 'remote-cursor-dot';
            dot.style.backgroundColor = color;

            const label = document.createElement('div');
            label.className = 'remote-cursor-label';
            label.style.backgroundColor = color;
            label.innerText = metadata.name || userId.slice(-4);

            this.container.appendChild(dot);
            this.container.appendChild(label);

            this.cursors.set(userId, { dot, label, color });
        } catch (err) {
            ErrorHandler.handle(`Failed to create cursor for ${userId}`, err);
        }
    }

    removeCursor(userId) {
        try {
            if (this.cursors.has(userId)) {
                const { dot, label } = this.cursors.get(userId);
                dot.remove();
                label.remove();
                this.cursors.delete(userId);
            }
        } catch (err) {
            ErrorHandler.handle(`Failed to remove cursor for ${userId}`, err);
        }
    }

    getRandomColor() {
        try {
            const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'];
            return colors[Math.floor(Math.random() * colors.length)];
        } catch (err) {
            ErrorHandler.handle('Failed to generate random color', err);
            return '#000000'; // fallback color
        }
    }
}

// Global instance or export
window.CollabCursors = CollabCursors;
