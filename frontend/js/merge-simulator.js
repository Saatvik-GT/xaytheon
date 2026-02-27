/**
 * XAYTHEON — Merge Simulator JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    let simulation = null;
    let socket;

    init();

    async function init() {
        initSocket();
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_merge_simulator');
            socket.on('merge_update', (data) => {
                simulation = data;
                render();
                if (data.status === 'CONFLICT_DETECTED') {
                    showToast('⚠️ Merge Conflict Predicted', `Conflicts in ${data.conflicts.length} files. Reviewing solutions...`, 'warning');
                } else {
                    showToast('✅ Clean Merge Predicted', `Zero conflicts between branches.`, 'success');
                }
            });
        }
    }

    async function runSimulation() {
        const source = document.getElementById('source-branch').value;
        const target = document.getElementById('target-branch').value;
        const hasOverlap = document.getElementById('simulate-conflict').checked;

        const payload = {
            source,
            target,
            files: [
                { path: 'src/controllers/user.controller.js', hasOverlappingChanges: hasOverlap, isSemanticConflict: hasOverlap },
                { path: 'src/services/auth.service.js', hasOverlappingChanges: false }
            ]
        };

        const res = await fetch('/api/merge/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success && socket) {
            socket.emit('merge_state_broadcast', json.simulation);
        }
    }

    function render() {
        const el = document.getElementById('simulation-results');
        if (!el || !simulation) return;

        el.innerHTML = `
            <div class="sim-card ${simulation.status.toLowerCase()}">
                <div class="sim-header">
                    <h3>Simulation: ${simulation.sourceBranch} ➔ ${simulation.targetBranch}</h3>
                    <span class="status-badge">${simulation.status}</span>
                </div>
                <div class="confidence-meter">
                    <span>Resolution Confidence:</span>
                    <div class="bar-wrap"><div class="bar-fill" style="width: ${simulation.resolutionConfidence}%"></div></div>
                    <span>${simulation.resolutionConfidence}%</span>
                </div>
                <div class="conflict-list">
                    ${simulation.conflicts.length === 0 ?
                '<p class="clean-msg">Zero conflicts. Branches are semantically compatible.</p>' :
                simulation.conflicts.map(c => `
                            <div class="conflict-item">
                                <strong>${c.file}</strong> [${c.severity}]
                                <p>${c.reason}</p>
                            </div>
                        `).join('')
            }
                </div>
                ${simulation.proposedFixes.length > 0 ? `
                    <div class="fix-panel">
                        <h4>Proposed AI Resolutions:</h4>
                        ${simulation.proposedFixes.map(f => `<li>${f.file}: ${f.description}</li>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    window.runSimulation = runSimulation;
});
