/**
 * XAYTHEON | Semantic Repo Search — Smart Search Dashboard Logic
 *
 * Handles semantic search, filter controls, autocomplete,
 * and result rendering for the Semantic Repo Search page.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── UI Elements ──
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('search-results');
    const loadingState = document.getElementById('loading-state');
    const resultsCount = document.getElementById('results-count');
    const activeFiltersRow = document.getElementById('active-filters');
    const autocompletePanel = document.getElementById('autocomplete-results');

    // Filter Elements
    const langFilter = document.getElementById('lang-filter');
    const starsFilter = document.getElementById('stars-filter');
    const updatedFilter = document.getElementById('updated-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');

    // Hint Buttons
    const hintButtons = document.querySelectorAll('.hint-btn');

    // State
    let currentFilters = {};
    let searchResults = [];

    // ── Event Listeners ──
    if (searchBtn) searchBtn.addEventListener('click', performSearch);
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        searchInput.addEventListener('input', handleAutocomplete);
        searchInput.addEventListener('focus', () => searchInput.select());
    }
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);
    hintButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (searchInput) searchInput.value = btn.textContent.trim();
            performSearch();
        });
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (autocompletePanel && !autocompletePanel.contains(e.target) && e.target !== searchInput) {
            autocompletePanel.classList.add('hidden');
        }
    });

    /**
     * Apply selected filters and re-search
     */
    function applyFilters() {
        currentFilters = {};
        if (langFilter && langFilter.value) currentFilters.language = langFilter.value;
        if (starsFilter && parseInt(starsFilter.value) > 0) currentFilters.minStars = parseInt(starsFilter.value);
        if (updatedFilter && updatedFilter.value) currentFilters.updated = updatedFilter.value;

        renderActiveFilters();
        performSearch();
    }

    /**
     * Show active filter chips
     */
    function renderActiveFilters() {
        if (!activeFiltersRow) return;
        const chips = [];
        if (currentFilters.language) {
            chips.push(`<span class="active-filter-chip">${currentFilters.language} <span class="remove-filter" data-key="language">×</span></span>`);
        }
        if (currentFilters.minStars) {
            chips.push(`<span class="active-filter-chip">★ ≥ ${currentFilters.minStars} <span class="remove-filter" data-key="minStars">×</span></span>`);
        }
        if (currentFilters.updated) {
            chips.push(`<span class="active-filter-chip">Updated: ${currentFilters.updated} <span class="remove-filter" data-key="updated">×</span></span>`);
        }
        activeFiltersRow.innerHTML = chips.join('');

        // Bind remove handlers
        activeFiltersRow.querySelectorAll('.remove-filter').forEach(el => {
            el.addEventListener('click', () => {
                const key = el.dataset.key;
                delete currentFilters[key];
                // Reset corresponding filter control
                if (key === 'language' && langFilter) langFilter.value = '';
                if (key === 'minStars' && starsFilter) starsFilter.value = '';
                if (key === 'updated' && updatedFilter) updatedFilter.value = '';
                renderActiveFilters();
                performSearch();
            });
        });
    }

    /**
     * Perform search (calls backend API or uses mock data)
     */
    async function performSearch() {
        const query = searchInput ? searchInput.value.trim() : '';
        if (!query) return;

        // UI feedback
        if (loadingState) loadingState.classList.remove('hidden');
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (autocompletePanel) autocompletePanel.classList.add('hidden');

        try {
            const params = new URLSearchParams({ q: query });
            if (currentFilters.language) params.append('language', currentFilters.language);
            if (currentFilters.minStars) params.append('minStars', currentFilters.minStars);
            if (currentFilters.updated) params.append('updated', currentFilters.updated);

            const res = await fetch(`/api/search/smart?${params.toString()}`);
            const data = await res.json();

            if (data.success && data.results) {
                searchResults = data.results;
                renderResults(data.results);
            } else {
                renderResults([]);
            }
        } catch (err) {
            // Fallback: generate mock results for demo/offline use
            console.warn('API unreachable, using generated results.');
            const mockResults = generateMockResults(query);
            searchResults = mockResults;
            renderResults(mockResults);
        } finally {
            if (loadingState) loadingState.classList.add('hidden');
        }
    }

    /**
     * Generate mock results when API is unavailable
     */
    function generateMockResults(query) {
        const words = query.toLowerCase().split(/\s+/);
        const langs = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby'];
        const adjectives = ['awesome', 'fast', 'modern', 'lightweight', 'powerful', 'simple'];
        const topics = ['framework', 'toolkit', 'library', 'engine', 'cli', 'dashboard', 'starter'];

        const results = [];
        const count = 5 + Math.floor(Math.random() * 6);

        for (let i = 0; i < count; i++) {
            const lang = currentFilters.language || langs[Math.floor(Math.random() * langs.length)];
            const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
            const topic = topics[Math.floor(Math.random() * topics.length)];
            const stars = Math.floor(Math.random() * 20000) + (currentFilters.minStars || 50);
            const forks = Math.floor(stars * (0.05 + Math.random() * 0.15));
            const relevance = Math.max(0.4, 1 - (i * 0.08) + (Math.random() * 0.1 - 0.05));

            results.push({
                name: `${words[0] || 'repo'}-${adj}-${topic}`,
                fullName: `xaytheon/${words[0] || 'repo'}-${adj}-${topic}`,
                description: `A ${adj} ${lang} ${topic} for ${query}. Built with modern best practices and production-ready architecture.`,
                language: lang,
                stars,
                forks,
                updatedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 86400000)).toISOString(),
                relevance: parseFloat(relevance.toFixed(2)),
                url: `https://github.com/xaytheon/${words[0] || 'repo'}-${adj}-${topic}`
            });
        }

        // Filter by minStars if set
        let filtered = results;
        if (currentFilters.minStars) {
            filtered = filtered.filter(r => r.stars >= currentFilters.minStars);
        }

        return filtered.sort((a, b) => b.relevance - a.relevance);
    }

    /**
     * Render search results into the DOM
     */
    function renderResults(results) {
        if (!resultsContainer) return;

        // Show count
        if (resultsCount) {
            resultsCount.textContent = results.length > 0
                ? `${results.length} repositor${results.length === 1 ? 'y' : 'ies'} found`
                : '';
        }

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-results">
                    <i class="ri-compass-discover-line"></i>
                    <p>No repositories matched your search. Try different keywords or adjust your filters.</p>
                </div>`;
            return;
        }

        // Language color map
        const langColors = {
            JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
            Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
            'C++': '#f34b7d', Ruby: '#701516', 'C#': '#178600',
            PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF'
        };

        resultsContainer.innerHTML = results.map((repo, idx) => {
            const langColor = langColors[repo.language] || '#808080';
            const timeAgo = getTimeAgo(new Date(repo.updatedAt));
            const relevancePct = Math.round((repo.relevance || 0.5) * 100);

            return `
                <div class="result-card" style="animation-delay: ${idx * 60}ms">
                    <div class="repo-name">
                        <i class="ri-git-repository-line"></i>
                        <a href="${repo.url || '#'}" target="_blank" rel="noopener">${repo.fullName || repo.name}</a>
                    </div>
                    <p class="repo-description">${repo.description || 'No description provided.'}</p>
                    <div class="repo-meta">
                        <span><span class="lang-dot" style="background:${langColor}"></span> ${repo.language || 'Unknown'}</span>
                        <span><i class="ri-star-line"></i> ${formatNumber(repo.stars || 0)}</span>
                        <span><i class="ri-git-fork-line"></i> ${formatNumber(repo.forks || 0)}</span>
                        <span><i class="ri-time-line"></i> ${timeAgo}</span>
                    </div>
                    <div class="relevance-bar"><div class="bar-fill" style="width:${relevancePct}%"></div></div>
                </div>`;
        }).join('');

        // Animate cards in
        resultsContainer.querySelectorAll('.result-card').forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, i * 60);
        });
    }

    /**
     * Autocomplete handler (basic keyword suggestions)
     */
    function handleAutocomplete() {
        const value = searchInput.value.trim();
        if (!autocompletePanel) return;

        if (value.length < 2) {
            autocompletePanel.classList.add('hidden');
            return;
        }

        const suggestions = [
            'React component libraries',
            'Python machine learning',
            'TypeScript state management',
            'Rust web frameworks',
            'Go microservices',
            'JavaScript testing tools',
            'Node.js REST API boilerplate',
            'Vue.js UI kit',
            'Kubernetes operators',
            'DevOps automation tools'
        ].filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 5);

        if (suggestions.length === 0) {
            autocompletePanel.classList.add('hidden');
            return;
        }

        autocompletePanel.innerHTML = suggestions.map(s =>
            `<div class="autocomplete-item" role="option">
                <i class="ri-search-2-line"></i>
                <span>${highlightMatch(s, value)}</span>
            </div>`
        ).join('');

        autocompletePanel.classList.remove('hidden');

        autocompletePanel.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                searchInput.value = item.textContent.trim();
                autocompletePanel.classList.add('hidden');
                performSearch();
            });
        });
    }

    /**
     * Highlight matching text in autocomplete suggestions
     */
    function highlightMatch(text, query) {
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx < 0) return text;
        return text.slice(0, idx) + '<strong>' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
    }

    /**
     * Format numbers (e.g., 1500 → 1.5k)
     */
    function formatNumber(num) {
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return num.toString();
    }

    /**
     * Human-readable time ago
     */
    function getTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        return `${Math.floor(months / 12)}y ago`;
    }
});
