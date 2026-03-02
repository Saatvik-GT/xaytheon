/**
 * XAYTHEON — Performance Guard & Bundle City
 */

document.addEventListener('DOMContentLoaded', () => {
    let reports = [];
    let socket;

    init();

    async function init() {
        initSocket();
        await fetchHistory();
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_perf_guard');
            socket.on('perf_update', (report) => {
                reports.unshift(report);
                render();
                if (report.alertLevel === 'CRITICAL') {
                    showToast('🚨 Performance Regression', `High complexity detected in ${report.file}`, 'error');
                }
            });
        }
    }

    async function fetchHistory() {
        const res = await fetch('/api/performance/snapshots');
        const json = await res.json();
        if (json.success) reports = json.history.reverse();
    }

    async function analyzeCurrent() {
        const file = document.getElementById('perf-file').value;
        const content = document.getElementById('perf-content').value;

        const res = await fetch('/api/performance/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, content })
        });
        const json = await res.json();
        if (json.success && socket) {
            socket.emit('perf_regression_alert', json.report);
        }
    }

    function render() {
        const el = document.getElementById('perf-feed');
        if (!el) return;

        if (reports.length === 0) {
            el.innerHTML = '<p class="muted" style="padding:2rem;">Waiting for performance audit snapshots...</p>';
            return;
        }

        el.innerHTML = reports.map(r => `
            <div class="perf-card ${r.alertLevel.toLowerCase()}">
                <div class="header">
                    <strong>${r.file}</strong>
                    <span class="badge">${r.alertLevel}</span>
                </div>
                <div class="grid">
                    <div class="stat"><span>Bundle:</span> ${r.metrics.sizeKb} KB</div>
                    <div class="stat"><span>Complexity:</span> ${r.metrics.logicComplexity}</div>
                    <div class="stat"><span>Async Density:</span> ${r.metrics.asyncDensity}</div>
                </div>
                <div class="recommendation">${r.recommendation}</div>
            </div>
        `).join('');
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.analyzeCurrent = analyzeCurrent;
});
