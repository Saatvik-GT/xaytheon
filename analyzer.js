document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const repoInput = document.getElementById('repo-input');
    let isAnalyzing = false;

    analyzeBtn.addEventListener('click', runAnalysis);

    repoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            runAnalysis();
        }
    });

    async function runAnalysis() {
        // 1. VALIDATE INPUT
        const repo = repoInput.value.trim();
        if (!repo) {
            repoInput.focus();
            repoInput.classList.add('error');
            setTimeout(() => repoInput.classList.remove('error'), 1000);
            return;
        }

        // 2. PREVENT SPAM CLICKS
        if (isAnalyzing) return;
        isAnalyzing = true;
        analyzeBtn.disabled = true;
        
        // 3. LOADING STATE
        const originalHTML = analyzeBtn.innerHTML;
        analyzeBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Analyzing...';

        try {
            // 4. ENCODED API CALLS
            const encodedRepo = encodeURIComponent(repo);
            
            // Main analysis
            const res = await fetch(`/api/analyzer/analyze?repo=${encodedRepo}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            renderDashboard(data);

            // Recommendations (sequential)
            const recsRes = await fetch(`/api/analyzer/recommendations?repo=${encodedRepo}`);
            if (!recsRes.ok) {
                throw new Error(`Recommendations failed: ${recsRes.status}`);
            }
            const recsData = await recsRes.json();
            renderRecs(recsData.recommendations);

            // SUCCESS STATE
            analyzeBtn.innerHTML = '<i class="ri-check-line"></i> Updated!';
            setTimeout(() => {
                analyzeBtn.innerHTML = originalHTML;
            }, 1500);

        } catch (error) {
            console.error('Analysis failed:', error);
            analyzeBtn.innerHTML = '<i class="ri-error-warning-line"></i> Failed';
            analyzeBtn.classList.add('error');
            
            // User-friendly error
            alert(`Analysis failed: ${error.message}\n\nPlease check the repository name and try again.`);
            
            setTimeout(() => {
                analyzeBtn.innerHTML = originalHTML;
                analyzeBtn.classList.remove('error');
            }, 2000);
        } finally {
            // RESET
            isAnalyzing = false;
            analyzeBtn.disabled = false;
        }
    }

    function renderDashboard(data) {
        // Validate data
        if (!data || typeof data !== 'object') {
            console.warn('Invalid dashboard data');
            return;
        }

        // Metrics
        document.getElementById('total-files')?.textContent = data.totalFiles || 0;
        document.getElementById('avg-complexity')?.textContent = data.avgComplexity?.toFixed(2) || '0.00';
        document.getElementById('maintainability')?.textContent = data.avgMaintainability ? `${Math.round(data.avgMaintainability)}%` : '0%';
        document.getElementById('total-debt')?.textContent = data.totalDebt ? `${Math.round(data.totalDebt / 60)}h` : '0h';

        // Heatmap
        const heatmap = document.getElementById('debt-heatmap');
        if (heatmap) {
            heatmap.innerHTML = '';
            const files = Array.isArray(data.files) ? data.files : [];
            files.slice(0, 50).forEach(file => { // Limit for performance
                const block = document.createElement('div');
                block.className = `heat-block heat-${(file.rating || 'low').toLowerCase()}`;
                block.title = `${file.path || 'Unknown'}\nComplexity: ${file.cyclomaticComplexity || 0}`;
                block.textContent = file.rating?.slice(0, 3).toUpperCase() || 'LOW';
                heatmap.appendChild(block);
            });
        }

        // Files table
        const tbody = document.getElementById('files-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            const files = Array.isArray(data.files) ? data.files : [];
            files.slice(0, 100).forEach(file => { // Limit rows
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td title="${file.path || ''}">${truncate(file.path || '', 40)}</td>
                    <td>${file.lines || 0}</td>
                    <td>${file.cyclomaticComplexity || 0}</td>
                    <td><span class="rating-badge rating-${(file.rating || 'low').toLowerCase()}">${file.rating || 'LOW'}</span></td>
                    <td>${Math.round((file.debtMinutes || 0) / 60)}h</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Trends chart
        const trendChart = document.getElementById('trend-chart');
        if (trendChart && Array.isArray(data.trends) && data.trends.length) {
            trendChart.innerHTML = '';
            const maxDebt = Math.max(...data.trends.map(t => t.debtHours || 0));
            data.trends.slice(0, 12).forEach(trend => { // Last 12 months
                const bar = document.createElement('div');
                bar.className = 'trend-bar';
                bar.style.height = maxDebt ? `${Math.max((trend.debtHours || 0) / maxDebt * 100, 5)}%` : '5%';
                bar.innerHTML = `<span>${(trend.date || '').slice(5, 10)}</span>`;
                trendChart.appendChild(bar);
            });
        }
    }

    function renderRecs(recommendations) {
        const container = document.getElementById('ai-recs');
        if (!container) return;

        if (!Array.isArray(recommendations)) {
            container.innerHTML = '<p style="color:var(--text-muted);">No recommendations available.</p>';
            return;
        }

        if (recommendations.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">No critical issues detected. 🎉</p>';
            return;
        }

        container.innerHTML = '';
        recommendations.slice(0, 10).forEach(rec => { // Limit for performance
            const item = document.createElement('div');
            item.className = 'rec-item';
            item.innerHTML = `
                <div class="rec-header">
                    <strong title="${rec.file || ''}">${truncate(rec.file || '', 50)}</strong>
                    <span class="rec-priority">${rec.priority || 'MEDIUM'}</span>
                </div>
                <p>${rec.suggestion || ''}</p>
            `;
            container.appendChild(item);
        });
    }

    function truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + '...';
    }
});
