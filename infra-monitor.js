/**
 * XAYTHEON - Health Monitor Frontend with Self-Healing CI/CD
 */

import ErrorHandler from './js/errorHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const buildFeed = document.getElementById('build-feed');
    const repoFleet = document.getElementById('repo-fleet');
    const diagnosisContent = document.getElementById('diagnosis-content');
    const triggerDemoBtn = document.getElementById('trigger-demo');

    const lightRed = document.getElementById('light-red');
    const lightYellow = document.getElementById('light-yellow');
    const lightGreen = document.getElementById('light-green');
    const statusText = document.getElementById('status-text');

    // Remediation panel elements
    const remediationPanel = document.getElementById('remediation-panel');
    const confidenceBadge = document.getElementById('confidence-badge');
    const rootCauseDesc = document.getElementById('root-cause-desc');
    const affectedFiles = document.getElementById('affected-files');
    const patchCode = document.getElementById('patch-code');
    const applyPatchBtn = document.getElementById('apply-patch-btn');
    const createPRBtn = document.getElementById('create-pr-btn');
    const dismissRemediationBtn = document.getElementById('dismiss-remediation-btn');

    let currentRemediation = null;

    // Socket.io initialization
    const socket = io('/', {
        auth: { token: localStorage.getItem('xaytheon_token') }
    });

    socket.on('connect', () => {
        console.log('Connected to health monitor stream');
    });

    socket.on('build_update', (data) => {
        addBuildToFeed(data);
        updateTrafficLight(data.status);
        if (data.aiAnalysis) {
            showAiDiagnosis(data);
        }
        if (data.remediation) {
            showRemediation(data.remediation);
        }
        refreshSummary();
    });

    // Listen for remediation available event
    socket.on('remediation_available', (data) => {
        console.log('Remediation available:', data);
        showRemediation(data.remediation);
    });

    triggerDemoBtn.addEventListener('click', async () => {
        const errorTypes = ['lint', 'dependency', 'test', 'syntax'];
        const randomType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

        try {
            await fetch('/api/ai/simulate-failure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repoName: 'Saatvik-GT/xaytheon',
                    errorType: randomType
                })
            });
        } catch (err) {
            ErrorHandler.handle('Demo trigger failed', err);
        }
    });

    // Remediation button handlers
    applyPatchBtn.addEventListener('click', async () => {
        if (!currentRemediation) return;

        try {
            applyPatchBtn.disabled = true;
            applyPatchBtn.innerHTML = '<i class="ri-loader-4-line"></i> Applying...';

            const response = await fetch(`/api/ai/remediation/${currentRemediation.buildId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ createPR: false })
            });

            const result = await response.json();

            if (result.success) {
                showSuccessNotification('Auto-fix applied successfully!');
                remediationPanel.style.display = 'none';
            } else {
                showErrorNotification('Failed to apply auto-fix');
            }
        } catch (err) {
            ErrorHandler.handle('Apply patch error', err);
            showErrorNotification('Failed to apply auto-fix');
        } finally {
            applyPatchBtn.disabled = false;
            applyPatchBtn.innerHTML = '<i class="ri-magic-fill"></i> Apply Auto-Fix';
        }
    });

    createPRBtn.addEventListener('click', async () => {
        if (!currentRemediation) return;

        try {
            createPRBtn.disabled = true;
            createPRBtn.innerHTML = '<i class="ri-loader-4-line"></i> Creating PR...';

            const response = await fetch(`/api/ai/remediation/${currentRemediation.buildId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ createPR: true })
            });

            const result = await response.json();

            if (result.success && result.data.prUrl) {
                showSuccessNotification('Pull request created!');
                window.open(result.data.prUrl, '_blank');
                remediationPanel.style.display = 'none';
            } else {
                showErrorNotification('Failed to create PR');
            }
        } catch (err) {
            ErrorHandler.handle('Create PR error', err);
            showErrorNotification('Failed to create PR');
        } finally {
            createPRBtn.disabled = false;
            createPRBtn.innerHTML = '<i class="ri-git-pull-request-fill"></i> Create PR';
        }
    });

    dismissRemediationBtn.addEventListener('click', () => {
        remediationPanel.style.display = 'none';
        currentRemediation = null;
    });

    function showRemediation(remediation) {
        currentRemediation = remediation;

        // Show panel
        remediationPanel.style.display = 'block';

        // Update confidence badge
        const confidence = Math.round(remediation.confidence * 100);
        confidenceBadge.textContent = `${confidence}% Confidence`;
        confidenceBadge.className = 'confidence-badge';
        if (confidence >= 80) {
            confidenceBadge.classList.add('high');
        } else if (confidence >= 50) {
            confidenceBadge.classList.add('medium');
        } else {
            confidenceBadge.classList.add('low');
        }

        // Update root cause
        rootCauseDesc.textContent = remediation.rootCause.description;

        // Update affected files
        if (remediation.rootCause.affectedFiles && remediation.rootCause.affectedFiles.length > 0) {
            affectedFiles.innerHTML = '<strong>Affected Files:</strong><ul>' +
                remediation.rootCause.affectedFiles.map(file => `<li>${file}</li>`).join('') +
                '</ul>';
        } else {
            affectedFiles.innerHTML = '';
        }

        // Update patch preview
        if (remediation.patch.script) {
            patchCode.textContent = remediation.patch.script;
        } else if (remediation.patch.command) {
            patchCode.textContent = `# Command to run:\n${remediation.patch.command}\n\n# ${remediation.patch.description}`;
        } else {
            patchCode.textContent = remediation.patch.suggestion || 'Manual fix required';
        }

        // Animate panel entrance
        remediationPanel.style.animation = 'slideInRight 0.5s ease-out';
    }

    function showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.innerHTML = `<i class="ri-checkbox-circle-fill"></i> ${message}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `<i class="ri-error-warning-fill"></i> ${message}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    async function refreshSummary() {
        try {
            const res = await fetch('/api/health/summary');
            const data = await res.json();
            renderFleet(data.repos);
        } catch (err) {
            ErrorHandler.handle('Failed to load fleet summary', err);
        }
    }

    function renderFleet(repos) {
        if (repos.length === 0) return;
        repoFleet.innerHTML = '';
        repos.forEach(repo => {
            const card = document.createElement('div');
            card.className = 'card repo-card';
            const statusClass = repo.status === 'healthy' ? 'status-healthy' :
                repo.status === 'error' ? 'status-error' : 'status-warning';

            card.innerHTML = `
                <div class="repo-info">
                    <h4>${repo.name}</h4>
                    <p>Default Branch: main</p>
                </div>
                <div class="status-indicator ${statusClass}"></div>
            `;
            repoFleet.appendChild(card);
        });
    }

    function addBuildToFeed(data) {
        const empty = buildFeed.querySelector('.empty-feed');
        if (empty) empty.remove();

        const item = document.createElement('div');
        item.className = 'build-item';

        const time = new Date(data.timestamp).toLocaleTimeString();
        const icon = data.status === 'success' ? 'ri-checkbox-circle-line success' :
            data.status === 'failure' ? 'ri-error-warning-line failure' :
                'ri-loader-4-line running';

        item.innerHTML = `
            <i class="build-icon ${icon}"></i>
            <div class="build-details">
                <h5>${data.repoName}</h5>
                <p>Build #${data.buildId.split('-').pop()} • ${data.status}</p>
            </div>
            <div class="build-time">${time}</div>
        `;

        buildFeed.prepend(item);

        // Keep only last 10
        if (buildFeed.children.length > 10) {
            buildFeed.lastElementChild.remove();
        }
    }

    function updateTrafficLight(status) {
        lightRed.classList.remove('active');
        lightYellow.classList.remove('active');
        lightGreen.classList.remove('active');

        if (status === 'failure') {
            lightRed.classList.add('active');
            statusText.textContent = "Immediate Action Required: Build Failed";
        } else if (status === 'in_progress') {
            lightYellow.classList.add('active');
            statusText.textContent = "Deployment in Progress...";
        } else {
            lightGreen.classList.add('active');
            statusText.textContent = "All Systems Operational";
        }
    }

    function showAiDiagnosis(data) {
        diagnosisContent.style.opacity = '0';
        setTimeout(() => {
            diagnosisContent.innerHTML = `
                <div class="diagnosis-header" style="margin-bottom: 12px; color: #ef4444; display: flex; align-items: center; gap: 8px;">
                    <i class="ri-alert-fill"></i>
                    <strong>Diagnosis: Build #${data.buildId.split('-').pop()}</strong>
                </div>
                <div class="diagnosis-text" style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 12px; border-left: 4px solid #ef4444;">
                    ${data.aiAnalysis}
                </div>
            `;
            diagnosisContent.style.transition = 'opacity 0.5s ease-in';
            diagnosisContent.style.opacity = '1';
        }, 100);
    }

    // Initial load
    refreshSummary();
});
