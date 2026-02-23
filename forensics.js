/**
 * XAYTHEON | Forensic Engine Dashboard Logic
 * 
 * Manages playback, time-travel queries, and synchronization 
 * between the UI and the 3D renderer.
 */

import ErrorHandler from './js/errorHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new window.ForensicRenderer('forensic-3d-view');

    // State
    const topology = [
        { id: 'gateway', pos: [0, 15, 0] },
        { id: 'auth', pos: [-20, 5, -15] },
        { id: 'user', pos: [20, 5, -15] },
        { id: 'payment', pos: [0, 5, 25] },
        { id: 'db', pos: [0, -15, 0] },
        { id: 'redis', pos: [25, 0, 25] }
    ];

    let isPlaying = true;
    let playbackSpeed = 1;
    let timelineBlocks = [];
    let currentBlockIndex = 299; // Start at "live"

    // UI Elements
    const timeSlider = document.getElementById('time-traveller');
    const clockDisplay = document.getElementById('forensic-clock');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const anomalyViz = document.getElementById('anomaly-viz');
    const simulateBtn = document.getElementById('simulate-incident');

    // Initialize
    renderer.createTopology(topology);
    init();

    async function init() {
        try {
            // Inject some initial data
            await fetch('/api/analytics/forensic/high-res/simulate', { method: 'POST' });
            await refreshTimeline();
            startPlaybackLoop();
        } catch (err) {
            ErrorHandler.handle('Initialization failed', err);
        }
    }

    async function refreshTimeline() {
        try {
            const res = await fetch('/api/analytics/forensic/high-res/timeline');
            const data = await res.json();
            if (data.success) {
                timelineBlocks = data.timeline;
                renderAnomalyHeatmap(timelineBlocks);
            }
        } catch (err) {
            ErrorHandler.handle("Timeline API offline.", err);
        }
    }

    function renderAnomalyHeatmap(blocks) {
        anomalyViz.innerHTML = blocks.map(b => {
            const opacity = b.anomalyScore;
            return `<div class="anomaly-segment" style="background: rgba(239, 68, 68, ${opacity})"></div>`;
        }).join('');
    }

    /**
     * The heart of the Forensic Engine: The Playback Loop
     */
    function startPlaybackLoop() {
        setInterval(() => {
            if (isPlaying && timelineBlocks.length > 0) {
                currentBlockIndex = (currentBlockIndex + 1) % timelineBlocks.length;
                timeSlider.value = currentBlockIndex;
                updateViewToBlock(timelineBlocks[currentBlockIndex]);
            }
        }, 1000 / playbackSpeed);
    }

    function updateViewToBlock(block) {
        if (!block) return;

        renderer.applySnapshot(block.state);

        const date = new Date(block.t);
        clockDisplay.textContent = date.toLocaleTimeString() + '.' + date.getMilliseconds();

        // Update stats if card is open
        updateInfoPanel(block.state);
    }

    function updateInfoPanel(state) {
        const panel = document.getElementById('node-info-panel');
        if (!panel.classList.contains('hidden')) {
            const nodeId = 'auth'; // Default for demo
            const load = Math.round(state[nodeId] || 0);
            document.getElementById('node-load').textContent = load + '%';
            document.getElementById('node-status').textContent = load > 85 ? 'CRITICAL' : 'HEALTHY';
        }
    }

    // Event Listeners
    timeSlider.addEventListener('input', (e) => {
        isPlaying = false;
        playPauseBtn.textContent = 'RESUME';
        currentBlockIndex = parseInt(e.target.value);
        updateViewToBlock(timelineBlocks[currentBlockIndex]);
    });

    playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playPauseBtn.textContent = isPlaying ? 'PAUSE' : 'RESUME';
    });

    simulateBtn.addEventListener('click', async () => {
        simulateBtn.disabled = true;
        simulateBtn.textContent = 'Simulating...';
        try {
            await fetch('/api/analytics/forensic/high-res/simulate', { method: 'POST' });
            await refreshTimeline();
        } catch (err) {
            ErrorHandler.handle('Simulation failed', err);
        } finally {
            simulateBtn.disabled = false;
            simulateBtn.textContent = 'Simulate Incident';
        }
    });

    // Window Resize
    window.addEventListener('resize', () => renderer.onResize());

    // Mock Selection logic
    document.getElementById('forensic-3d-view').addEventListener('click', () => {
        document.getElementById('node-info-panel').classList.remove('hidden');
    });
});
