/**
 * XAYTHEON — Quantum Anomaly Visualization
 */

document.addEventListener('DOMContentLoaded', () => {
    let anomalies = [];
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
            socket.emit('join_quantum_radar');
            socket.on('anomaly_alert', (anomaly) => {
                anomalies.unshift(anomaly);
                if (anomalies.length > 50) anomalies.pop();
                render();
                showToast('🚨 Quantum Shift Detected', `Payload anomaly block on ${anomaly.endpoint}`, 'error');
            });
        }
    }

    async function fetchHistory() {
        const res = await fetch('/api/anomaly/history');
        const json = await res.json();
        if (json.success) anomalies = json.anomalies.reverse();
    }

    async function injectTestAnomaly() {
        const payload = {
            endpoint: '/api/v1/auth/login',
            headers: { 'host': 'localhost', 'X-Hacker-Bot': 'v1', 'Accept': '*/*' },
            payloadString: '<script>alert(1)</script> ' + 'A'.repeat(60000)
        };

        const res = await fetch('/api/anomaly/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success && socket) {
            socket.emit('quantum_anomaly_detected', json.analysis);
        }
    }

    function render() {
        const el = document.getElementById('anomaly-feed');
        if (!el) return;

        if (anomalies.length === 0) {
            el.innerHTML = '<p class="muted" style="padding:2rem;">All clear. Operating parameters optimal.</p>';
            return;
        }

        el.innerHTML = anomalies.map(a => `
            <div class="anomaly-card ${a.status.toLowerCase()}">
                <div class="header">
                    <span class="id">${a.id}</span>
                    <span class="status">${a.status}</span>
                </div>
                <div class="endpoint">Target: <code>${a.endpoint}</code></div>
                <div class="risk">Stochastic Risk: <strong>${a.riskScore}%</strong></div>
                <div class="reasons">
                    ${a.reasons.map(r => `<li>${r}</li>`).join('')}
                </div>
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

    window.injectTestAnomaly = injectTestAnomaly;
});
