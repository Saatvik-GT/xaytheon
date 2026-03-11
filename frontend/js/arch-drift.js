/**
 * XAYTHEON — Architecture Drift Auditor JavaScript
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
            socket.emit('join_arch_auditor');
            socket.on('drift_update', (data) => {
                reports.unshift(data);
                render();
                showToast('🏛️ Architecture Alert', `Drift detected in ${data.file}`, 'warning');
            });
        }
    }

    async function fetchHistory() {
        const res = await fetch('/api/arch/history');
        const json = await res.json();
        if (json.success) reports = json.history.reverse();
    }

    async function runAudit() {
        const file = document.getElementById('audit-file').value;
        const content = document.getElementById('audit-content').value;

        const res = await fetch('/api/arch/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, content })
        });
        const json = await res.json();
        if (json.success && socket) {
            socket.emit('arch_drift_broadcast', json.audit);
        }
    }

    function render() {
        const el = document.getElementById('drift-reports');
        if (!el) return;

        if (reports.length === 0) {
            el.innerHTML = '<p class="muted" style="padding:2rem;">Codebase structural integrity verified. Alignment optimal.</p>';
            return;
        }

        el.innerHTML = reports.map(r => `
            <div class="drift-card ${r.findings.length > 0 ? 'drift' : 'stable'}">
                <div class="header">
                    <strong>${r.file}</strong>
                    <span class="score">Score: ${r.architectureScore}%</span>
                </div>
                <div class="findings">
                    ${r.findings.map(f => `
                        <div class="finding-item ${f.severity.toLowerCase()}">
                            <strong>${f.severity}:</strong> ${f.message}
                            <p>Rec: ${f.recommendation}</p>
                        </div>
                    `).join('')}
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

    window.runAudit = runAudit;
});
