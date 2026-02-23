import ErrorHandler from './js/errorhandler.js';

function initTheme() {
    const theme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
})();

class GitHubDashboard {
    constructor() {
        this.form = document.getElementById('github-form');
        this.usernameInput = document.getElementById('gh-username');
        this.clearBtn = document.getElementById('clear-btn');
        this.dashboard = document.getElementById('dashboard');
        this.statusEl = document.getElementById('status-message');

        this.userData = null;
        this.reposData = null;
        this.eventsData = null;
        this.primaryLanguage = null;

        this.init();
    }

    init() {
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));
        this.clearBtn?.addEventListener('click', () => this.clearDashboard());

        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });
        const urlParams = new URLSearchParams(window.location.search);
        const urlUser = urlParams.get('user');

        if (urlUser) {
            this.usernameInput.value = urlUser;
            this.fetchAllData(urlUser);
        } else {
            setTimeout(() => {
                if (window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated()) {
                    const session = window.XAYTHEON_AUTH.getSession();
                    // If we had the github username in session we would use it
                }

                if (!this.usernameInput.value) {
                  
                    const defaultUser = 'torvalds';
                    this.usernameInput.value = defaultUser;
                    this.showStatus(`✨ Loading smart default profile: ${defaultUser}...`, 'info');
                    this.fetchAllData(defaultUser);
                }
            }, 500);
        }
    }

    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    }

    showStatus(message, type = 'info') {
        if (!this.statusEl) return;

        this.statusEl.textContent = message;
        this.statusEl.classList.add('show');

        const colors = {
            error: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: '#ef4444' },
            success: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: '#22c55e' },
            info: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1', border: '#6366f1' }
        };

        const color = colors[type] || colors.info;
        Object.assign(this.statusEl.style, {
            background: color.bg,
            color: color.text,
            border: `1px solid ${color.border}`
        });

        setTimeout(() => {
            this.statusEl.classList.remove('show');
        }, 5000);
    }

    async handleSubmit(e) {
        e.preventDefault();
        const username = this.usernameInput?.value.trim();

        if (!username) {
            this.showStatus('Please enter a GitHub username', 'error');
            return;
        }

        await this.fetchAllData(username);
    }

    async fetchAllData(username) {
        try {
            this.showStatus('🔍 Analyzing GitHub profile...', 'info');

            // Fetch user data
            const userResponse = await fetch(`https://api.github.com/users/${username}`);
            if (!userResponse.ok) throw new Error('User not found');
            this.userData = await userResponse.json();

            // Fetch all repositories
            const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`);
            this.reposData = await reposResponse.json();

            // Fetch events
            const eventsResponse = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`);
            this.eventsData = await eventsResponse.json();

            this.displayProfile();
            this.displaySocialMetrics();

            // Detect primary language first
            this.detectPrimaryLanguage(this.reposData);

            this.displayRepositoryStats();
            this.displayContributionActivity();

            // Fetch personalized suggestions
            if (this.primaryLanguage) {
                await this.fetchSuggestedRepos(this.primaryLanguage);
            }

            // Show dashboard
            this.dashboard?.classList.remove('dashboard-hidden');

            this.showStatus('✅ Profile analysis complete!', 'success');

        } catch (error) {
            this.showStatus(`❌ Error: ${error.message}`, 'error');
            ErrorHandler.handle('GitHub API Error:', error);
        }
    }
    displayProfile() {
        const user = this.userData;

        // Avatar
        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.src = user.avatar_url;

        // Name
        const name = document.getElementById('profile-name');
        if (name) name.textContent = user.name || user.login;

        // Username
        const username = document.getElementById('profile-username');
        if (username) username.textContent = `@${user.login}`;

        // Bio
        const bio = document.getElementById('profile-bio');
        if (bio) bio.textContent = user.bio || 'No bio available';

        // Company
        const company = document.getElementById('profile-company');
        if (company) company.textContent = user.company || 'No company';

        // Location
        const location = document.getElementById('profile-location');
        if (location) location.textContent = user.location || 'No location';
    }

    displaySocialMetrics() {
        const user = this.userData;

        // Followers
        const followersEl = document.getElementById('followers-count');
        if (followersEl) followersEl.textContent = this.formatNumber(user.followers);

        // Following
        const followingEl = document.getElementById('following-count');
        if (followingEl) followingEl.textContent = this.formatNumber(user.following);

        // Network Ratio
        const ratio = user.followers / Math.max(user.following, 1);
        const ratioFill = document.getElementById('ratio-fill');
        const ratioText = document.getElementById('ratio-text');

        if (ratioFill && ratioText) {
            const percentage = Math.min(ratio * 50, 100);
            ratioFill.style.width = `${percentage}%`;
            ratioText.textContent = `${ratio.toFixed(2)}:1 ratio`;
        }
    }
    displayRepositoryStats() {
        const repos = this.reposData;

        // Highlight Primary Language in UI if detected
        if (this.primaryLanguage) {
            const langLabel = document.getElementById('primary-lang-label');
            if (langLabel) langLabel.textContent = this.primaryLanguage;
        }

        // Public Repos Count
        const publicRepos = document.getElementById('public-repos');
        if (publicRepos) publicRepos.textContent = this.formatNumber(this.userData.public_repos);

        // Calculate total stars
        const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const starsEl = document.getElementById('total-stars');
        if (starsEl) starsEl.textContent = this.formatNumber(totalStars);

        // Calculate total forks
        const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
        const forksEl = document.getElementById('total-forks');
        if (forksEl) forksEl.textContent = this.formatNumber(totalForks);

        // Calculate total size
        const totalSize = repos.reduce((sum, repo) => sum + repo.size, 0);
        const sizeEl = document.getElementById('total-size');
        if (sizeEl) sizeEl.textContent = this.formatSize(totalSize);

        // Language breakdown
        this.displayLanguageBreakdown(repos);

        // Top repositories
        this.displayTopRepositories(repos);
    }

    detectPrimaryLanguage(repos) {
        if (!repos || repos.length === 0) return;

        const languages = {};
        let totalReposWithLang = 0;

        repos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
                totalReposWithLang++;
            }
        });

        // Find language with max count
        let maxCount = 0;
        let primary = null;

        Object.entries(languages).forEach(([lang, count]) => {
            if (count > maxCount) {
                maxCount = count;
                primary = lang;
            }
        });

        this.primaryLanguage = primary;

        // Update Insight Text
        if (this.primaryLanguage && totalReposWithLang > 0) {
            const percentage = Math.round((maxCount / totalReposWithLang) * 100);
            const insightEl = document.getElementById('primary-lang-insight');
            if (insightEl) {
                insightEl.innerHTML = `
                    <span style="color: var(--accent-primary); font-weight: 700;">${this.primaryLanguage}</span> 
                    appears to be your dominant language, used in 
                    <span style="font-weight: 600;">${percentage}%</span> 
                    of your repositories.
                `;
            }
        }

        ErrorHandler.log('Detected Primary Language:', this.primaryLanguage);
    }

    displayLanguageBreakdown(repos) {
        const languages = {};
        repos.forEach(repo => {
            if (repo.language) {
                languages[repo.language] = (languages[repo.language] || 0) + 1;
            }
        });

        const total = Object.values(languages).reduce((a, b) => a + b, 0);
        const chartEl = document.getElementById('language-chart');

        if (!chartEl) return;
        chartEl.innerHTML = '';

        if (total === 0) {
            chartEl.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No language data available</p>';
            return;
        }

        // Sort and get top 7
        const topLanguages = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7);

        topLanguages.forEach(([lang, count]) => {
            const percent = ((count / total) * 100).toFixed(1);

            const item = document.createElement('div');
            item.className = 'language-item';
            item.innerHTML = `
                <div class="language-name">${lang}</div>
                <div class="language-bar-container">
                    <div class="language-bar" style="width: ${percent}%"></div>
                </div>
                <div class="language-percentage">${percent}%</div>
            `;

            chartEl.appendChild(item);
        });
    }
    displayTopRepositories(repos) {
        const listEl = document.getElementById('top-repos-list');
        if (!listEl) return;

        listEl.innerHTML = '';

        // Sort by stars and get top 5
        const topRepos = [...repos]
            .sort((a, b) => b.stargazers_count - a.stargazers_count)
            .slice(0, 5);

        if (topRepos.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No repositories found</p>';
            return;
        }

        topRepos.forEach(repo => {
            const item = document.createElement('div');
            item.className = 'repo-item';
            item.onclick = () => window.open(repo.html_url, '_blank');

            // Build stats HTML with SVG icons
            let statsHTML = '';

            // Language with code icon
            if (repo.language) {
                statsHTML += `
                <div class="repo-stat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    <span>${repo.language}</span>
                </div>`;
            }

            // Stars with star icon
            statsHTML += `
            <div class="repo-stat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span>${this.formatNumber(repo.stargazers_count)}</span>
            </div>`;

            // Forks with fork icon
            statsHTML += `
            <div class="repo-stat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="18" r="3"/>
                    <circle cx="6" cy="6" r="3"/>
                    <circle cx="18" cy="6" r="3"/>
                    <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
                    <path d="M12 12v3"/>
                </svg>
                <span>${this.formatNumber(repo.forks_count)}</span>
            </div>`;

            // Size with package icon
            statsHTML += `
            <div class="repo-stat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                <span>${this.formatSize(repo.size)}</span>
            </div>`;

            item.innerHTML = `
            <div class="repo-header">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-visibility">${repo.private ? 'Private' : 'Public'}</div>
            </div>
            <div class="repo-description">${repo.description || 'No description available'}</div>
            <div class="repo-stats">
                ${statsHTML}
            </div>
        `;

            listEl.appendChild(item);
        });
    }
    async fetchSuggestedRepos(language) {
        const container = document.getElementById('suggested-repos-container');
        const listEl = document.getElementById('suggested-repos-list');

        if (!container || !listEl) return;

        try {
            // Find popularity based query
            const query = `language:${language} sort:stars`;
            const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=3&order=desc`);

            if (!response.ok) return;

            const data = await response.json();
            const suggestions = data.items || [];

            if (suggestions.length === 0) return;

            // Show container
            container.style.display = 'block';
            listEl.innerHTML = '';

            suggestions.forEach(repo => {
                const item = document.createElement('div');
                item.className = 'repo-item suggestion-item'; // Add class for specific styling if needed
                item.style.borderLeft = '4px solid var(--accent-primary)'; // Visual distinction
                item.onclick = () => window.open(repo.html_url, '_blank');

                // Build stats HTML with SVG icons
                let statsHTML = '';

                // Language
                if (repo.language) {
                    statsHTML += `
                        <div class="repo-stat">
                            <span class="stat-icon">●</span>
                            <span>${repo.language}</span>
                        </div>`;
                }

                // Stars
                statsHTML += `
                    <div class="repo-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span>${this.formatNumber(repo.stargazers_count)}</span>
                    </div>`;

                item.innerHTML = `
                    <div class="repo-header">
                        <div class="repo-name">${repo.full_name}</div>
                        <div class="repo-visibility">Recommended</div>
                    </div>
                    <div class="repo-description">${repo.description ? repo.description.substring(0, 100) + '...' : 'No description'}</div>
                    <div class="repo-stats">
                        ${statsHTML}
                    </div>
                `;

                listEl.appendChild(item);
            });

        } catch (error) {
            ErrorHandler.handle('Failed to fetch suggestions:', error);
            container.style.display = 'none';
        }
    }
    displayContributionActivity() {
        const events = this.eventsData;

        // Calculate streaks
        const streaks = this.calculateStreaks(events);

        const currentStreak = document.getElementById('current-streak');
        if (currentStreak) currentStreak.textContent = streaks.current;

        const longestStreak = document.getElementById('longest-streak');
        if (longestStreak) longestStreak.textContent = streaks.longest;

        // Total contributions
        const totalContrib = document.getElementById('total-contributions');
        if (totalContrib) totalContrib.textContent = this.formatNumber(events.length);

        // Average per day
        const avgDaily = document.getElementById('avg-daily');
        if (avgDaily) {
            const avg = (events.length / 365).toFixed(1);
            avgDaily.textContent = avg;
        }

        // Render heatmap
        this.renderContributionHeatmap(events);

        // Render activity chart
        this.renderActivityChart(events);
    }

    calculateStreaks(events) {
        if (!events || events.length === 0) return { current: 0, longest: 0 };

        // Get unique dates
        const dates = events.map(e => new Date(e.created_at).toDateString());
        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));

        let current = 0;
        let longest = 0;
        let tempStreak = 1;

        // Calculate current streak
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
            current = 1;
            for (let i = 1; i < uniqueDates.length; i++) {
                const diff = (new Date(uniqueDates[i - 1]) - new Date(uniqueDates[i])) / (1000 * 60 * 60 * 24);
                if (diff <= 1) {
                    current++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak
        for (let i = 1; i < uniqueDates.length; i++) {
            const diff = (new Date(uniqueDates[i - 1]) - new Date(uniqueDates[i])) / (1000 * 60 * 60 * 24);
            if (diff <= 1) {
                tempStreak++;
                longest = Math.max(longest, tempStreak);
            } else {
                tempStreak = 1;
            }
        }

        return { current, longest: Math.max(longest, current) };
    }
    renderContributionHeatmap(events) {
        const gridEl = document.getElementById('contribution-heatmap');
        const tooltipEl = document.getElementById('heatmap-tooltip');
        const monthLabelsEl = document.getElementById('month-labels');

        if (!gridEl) {
            ErrorHandler.handle('Heatmap grid element not found!');
            return;
        }

        ErrorHandler.log('Rendering heatmap with', events.length, 'events');

        // Clear grid and month labels
        gridEl.innerHTML = '';
        if (monthLabelsEl) monthLabelsEl.innerHTML = '';

        // Create contribution map
        const contributionMap = {};
        events.forEach(event => {
            const date = new Date(event.created_at).toDateString();
            contributionMap[date] = (contributionMap[date] || 0) + 1;
        });

        ErrorHandler.log('Contribution map:', Object.keys(contributionMap).length, 'unique days');

        // Calculate date range (52 weeks back from today)
        const today = new Date();
        const weeksToShow = 52;
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (weeksToShow * 7));

        // Adjust to start from Sunday
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);

        ErrorHandler.log('Date range:', startDate.toDateString(), 'to', today.toDateString());

        // Calculate contribution levels
        const counts = Object.values(contributionMap).filter(c => c > 0);
        const maxCount = Math.max(...counts, 1);

        const getLevel = (count) => {
            if (count === 0) return 0;
            const quartile = maxCount / 4;
            if (count >= quartile * 3) return 4;
            if (count >= quartile * 2) return 3;
            if (count >= quartile) return 2;
            return 1;
        };

        // Track months for labels - FIXED OVERLAP LOGIC
        const monthPositions = [];
        let lastMonth = -1;
        let lastMonthWeek = -1;

        // Generate weeks
        for (let week = 0; week < weeksToShow; week++) {
            const weekDiv = document.createElement('div');
            weekDiv.className = 'contribution-week';

            // Check for month change on first day of week (Sunday)
            const firstDayOfWeek = new Date(startDate);
            firstDayOfWeek.setDate(startDate.getDate() + (week * 7));
            const month = firstDayOfWeek.getMonth();

         
            if (month !== lastMonth && (week - lastMonthWeek >= 2 || lastMonthWeek === -1)) {
                lastMonth = month;
                lastMonthWeek = week;
                monthPositions.push({
                    month: firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' }),
                    weekIndex: week
                });
            }

            // Generate 7 days for this week
            for (let day = 0; day < 7; day++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + (week * 7) + day);

                const dateStr = date.toDateString();
                const count = contributionMap[dateStr] || 0;
                const level = getLevel(count);

                const dayDiv = document.createElement('div');

                // Don't render future dates
                if (date > today) {
                    dayDiv.className = 'contribution-day empty';
                    weekDiv.appendChild(dayDiv);
                    continue;
                }

                dayDiv.className = `contribution-day level-${level}`;
                dayDiv.setAttribute('data-date', dateStr);
                dayDiv.setAttribute('data-count', count);
                dayDiv.setAttribute('data-level', level);

                // Tooltip events
                dayDiv.addEventListener('mouseenter', function (e) {
                    if (!tooltipEl) return;

                    const formatted = date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });

                    const contributionText = count === 0 ? 'No contributions' :
                        count === 1 ? '1 contribution' :
                            `${count} contributions`;

                    tooltipEl.innerHTML = `<strong>${contributionText}</strong>${formatted}`;
                    tooltipEl.style.display = 'block';

                    // Position tooltip
                    const rect = this.getBoundingClientRect();
                    const tooltipRect = tooltipEl.getBoundingClientRect();

                    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
                    let top = rect.top + window.scrollY - tooltipRect.height - 8;

                    // Keep tooltip on screen
                    if (left < 10) left = 10;
                    if (left + tooltipRect.width > window.innerWidth - 10) {
                        left = window.innerWidth - tooltipRect.width - 10;
                    }
                    if (top < 10) {
                        top = rect.bottom + window.scrollY + 8;
                    }

                    tooltipEl.style.left = left + 'px';
                    tooltipEl.style.top = top + 'px';
                });

                dayDiv.addEventListener('mouseleave', function () {
                    if (tooltipEl) tooltipEl.style.display = 'none';
                });

                weekDiv.appendChild(dayDiv);
            }

            gridEl.appendChild(weekDiv);
        }

        // Generate month labels - FIXED POSITIONING
        if (monthLabelsEl && monthPositions.length > 0) {
            monthPositions.forEach(({ month, weekIndex }) => {
                const label = document.createElement('span');
                label.className = 'month-label';
                label.textContent = month;
                // Position based on week index (17px = 13px cell + 4px gap)
                label.style.left = (weekIndex * 17) + 'px';
                monthLabelsEl.appendChild(label);
            });
        }

        console.log('Heatmap rendered:', weeksToShow, 'weeks,', monthPositions.length, 'month labels');
    }
  
    renderActivityChart(events) {
        const canvasEl = document.getElementById('activity-chart');
        if (!canvasEl) return;

        // IMPORTANT: Destroy previous chart instance to prevent growth
        if (window.activityChart instanceof Chart) {
            window.activityChart.destroy();
            window.activityChart = null;
        }

        // Clear canvas
        const ctx = canvasEl.getContext('2d');
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

        // Prepare data for last 30 days
        const days = [];
        const counts = [];

        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();

            days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

            const count = events.filter(e => {
                return new Date(e.created_at).toDateString() === dateStr;
            }).length;

            counts.push(count);
        }

        // Get theme
        const theme = document.documentElement.getAttribute('data-theme');
        const isDark = theme === 'dark' || !theme;

        // Create new chart with fixed configuration
        window.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Daily Activity',
                    data: counts,
                    borderColor: isDark ? '#ffffff' : '#000000',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: isDark ? '#ffffff' : '#000000',
                    pointBorderColor: isDark ? '#ffffff' : '#000000',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                        titleColor: isDark ? '#ffffff' : '#000000',
                        bodyColor: isDark ? '#b0b0b0' : '#4a4a4a',
                        borderColor: isDark ? '#2a2a2a' : '#e0e0e0',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: isDark ? '#b0b0b0' : '#4a4a4a',
                            font: {
                                size: 11
                            },
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: isDark ? '#b0b0b0' : '#4a4a4a',
                            font: {
                                size: 10
                            },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatSize(kb) {
        if (kb >= 1024 * 1024) return (kb / (1024 * 1024)).toFixed(1) + ' GB';
        if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
        return kb + ' KB';
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
            }
        }

        return 'Just now';
    }
    clearDashboard() {
        this.usernameInput.value = '';
        this.dashboard?.classList.add('dashboard-hidden');

        // Reset data
        this.userData = null;
        this.reposData = null;
        this.eventsData = null;

        // Destroy chart properly
        if (window.activityChart instanceof Chart) {
            window.activityChart.destroy();
            window.activityChart = null;
        }

        // Clear canvas
        const canvas = document.getElementById('activity-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Clear heatmap
        const heatmap = document.getElementById('contribution-heatmap');
        if (heatmap) {
            heatmap.innerHTML = '';
        }

        this.showStatus('Dashboard cleared', 'info');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new GitHubDashboard();
});
