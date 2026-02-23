/**
 * XAYTHEON - Risk Detector Logic
 */

import ErrorHandler from './js/errorHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const repoInput = document.getElementById('repo-input');

    const activePrsEl = document.getElementById('active-prs');
    const potentialConflictsEl = document.getElementById('potential-conflicts');
    const highRiskPrsEl = document.getElementById('high-risk-prs');

    const prTableBody = document.getElementById('pr-table-body');
    const conflictMap = document.getElementById('conflict-map');

    analyzeBtn.addEventListener('click', handleAnalyze);

    // Initial load
    handleAnalyze();

    async function handleAnalyze() {
        const repo = repoInput.value.trim() || 'SatyamPandey-07/xaytheon';

        analyzeBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Scanning...';
        analyzeBtn.disabled = true;

        try {
            const res = await fetch(`/api/risk/analyze?repo=${repo}`);
            const data = await res.json();

            renderDashboard(data);
        } catch (err) {
            ErrorHandler.handle(err);
            alert('Failed to analyze repository risks.');
        } finally {
            analyzeBtn.innerText = 'Scan Repository';
            analyzeBtn.disabled = false;
        }
    }

    function renderDashboard(data) {
        try{
        // Update Stats
        activePrsEl.textContent = data.stats.totalActivePrs;
        potentialConflictsEl.textContent = data.stats.potentialConflicts;
        highRiskPrsEl.textContent = data.stats.highRiskPrs;

        // Render Table
        prTableBody.innerHTML = '';
        data.analyzedPrs.forEach(pr => {
            const tr = document.createElement('tr');
            const riskClass = pr.riskScore > 70 ? 'risk-high' : pr.riskScore > 30 ? 'risk-med' : 'risk-low';
            const riskLabel = pr.riskScore > 70 ? 'Critical' : pr.riskScore > 30 ? 'Moderate' : 'Safe';

            tr.innerHTML = `
                <td>#${pr.id}</td>
                <td><strong>${pr.title}</strong></td>
                <td>@${pr.author}</td>
                <td>${pr.files.map(f => `<span class="file-badge">${f.split('/').pop()}</span>`).join('')}</td>
                <td>
                    <div class="risk-pill ${riskClass}">${pr.riskScore}%</div>
                </td>
                <td>${riskLabel}</td>
            `;
            prTableBody.appendChild(tr);
        });

        // Render Conflict Map (Visual)
        renderMap(data.conflicts);
            } catch (err) {
        ErrorHandler.handle('Error rendering risk dashboard', err);
    }

    function renderMap(conflicts) {
        try{
        if (conflicts.length === 0) {
            conflictMap.innerHTML = '<div class="empty-map">No overlapping file changes detected. Your PRs are clean! 🎉</div>';
            return;
        }

        conflictMap.innerHTML = '<div class="conflict-cluster"></div>';
        const cluster = conflictMap.querySelector('.conflict-cluster');

        conflicts.forEach(conflict => {
            const node = document.createElement('div');
            node.className = 'conflict-node active';
            node.innerHTML = `
                <div class="file-label">${conflict.file}</div>
                <div class="conflict-details">
                    <p>Conflict between:</p>
                    <strong>PR #${conflict.prIds.join(' & #')}</strong>
                </div>
            `;
            cluster.appendChild(node);
        });
             } catch (err) {
        ErrorHandler.handle('Error rendering conflict map', err);
    }
});
