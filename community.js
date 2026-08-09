// ============================================================
// community.js - Find Trending GitHub Repositories
//
// This page lets you search for trending repos on GitHub
// by language, topic, and how recently they were updated.
//
// No login needed — uses GitHub's free public Search API.
// ============================================================

// Wait for the HTML to finish loading before running any code
window.addEventListener('DOMContentLoaded', function() {

  // --- Get references to all the elements we'll use ---
  var form        = document.getElementById('trend-form');
  if (!form) return;  // safety check: only run on the community page

  var langInput   = document.getElementById('trend-lang');    // language filter input
  var topicInput  = document.getElementById('trend-topic');   // topic filter input
  var windowInput = document.getElementById('trend-window');  // time window (days) input
  var kInput      = document.getElementById('trend-k');       // "how many results" input
  var statusEl    = document.getElementById('trend-status');  // status message area
  var resultsEl   = document.getElementById('trend-results'); // where cards appear
  var resetBtn    = document.getElementById('trend-reset');   // reset button

  // --- Cache ---
  // Instead of fetching the same data over and over, we remember recent results.
  // Format: { "cacheKey": { time: timestamp, results: [repo, repo, ...] } }
  var searchCache       = {};
  var CACHE_MINUTES     = 5;  // how long to keep cached results


  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  // Show a status message to the user (red text if it's an error)
  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#b91c1c' : '#111827';
  }

  // Make text safe to put in HTML (prevents code injection attacks)
  function safeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Convert a date string to "X days ago" text
  function timeAgo(dateString) {
    var seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60)    return 'just now';
    if (seconds < 3600)  return Math.floor(seconds / 60)   + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    var days = Math.floor(seconds / 86400);
    if (days < 30) return days + ' days ago';
    return Math.floor(days / 30) + ' months ago';
  }

  // Calculate how "trending" a repo is.
  // The higher the score, the more trending.
  // Formula: stars are most important, forks second, recently updated gets a bonus.
  function scoreRepo(repo) {
    var stars = repo.stargazers_count || 0;
    var forks = repo.forks_count      || 0;

    // Days since the repo was last pushed to
    var daysSinceUpdate = (Date.now() - new Date(repo.pushed_at)) / (1000 * 60 * 60 * 24);

    // Recency bonus: 0 if updated 14+ days ago, up to 14 if updated today
    var recencyBonus = Math.max(0, 14 - daysSinceUpdate);

    return (stars * 0.5) + (forks * 0.3) + (recencyBonus * 5);
  }

  // Build the HTML for one repo card
  function buildRepoCard(repo) {
    // Optional description line
    var description = '';
    if (repo.description) {
      description = '<div class="repo-desc">' + safeHtml(repo.description) + '</div>';
    }

    // Optional language tag
    var language = '';
    if (repo.language) {
      language = '<span>' + safeHtml(repo.language) + '</span>';
    }

    return (
      '<div class="repo-item">' +
        '<div class="repo-name">' +
          '<a href="' + repo.html_url + '" target="_blank" rel="noopener">' +
            safeHtml(repo.full_name) +
          '</a>' +
        '</div>' +
        description +
        '<div class="repo-meta">' +
          '<span>★ ' + (repo.stargazers_count || 0) + '</span>' +
          '<span>⑂ ' + (repo.forks_count      || 0) + '</span>' +
          language +
          '<span>Updated ' + timeAgo(repo.pushed_at) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  // Render a list of repos onto the page
  function showResults(repos) {
    if (!repos || repos.length === 0) {
      resultsEl.innerHTML = '<div class="muted">No repos matched your filters.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < repos.length; i++) {
      html += buildRepoCard(repos[i]);
    }
    resultsEl.innerHTML = html;
  }


  // ============================================================
  // DATA FUNCTIONS
  // ============================================================

  // Fetch repos from the GitHub Search API
  // "async" means this talks to the internet and waits for a reply
  async function fetchRepos(language, topic, days) {
    // Build a date string for "X days ago": e.g. "2025-01-01"
    var since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 10);

    // Build the GitHub search query string
    var query = 'pushed:>=' + since;
    if (language) query += ' language:' + language;
    if (topic)    query += ' topic:'    + topic;

    var url =
      'https://api.github.com/search/repositories' +
      '?q=' + encodeURIComponent(query) +
      '&sort=stars&order=desc&per_page=100';

    var response = await fetch(url, {
      headers: {
        'Accept':     'application/vnd.github+json',
        'User-Agent': 'XAYTHEON'
      }
    });

    // Check for GitHub rate limit (403 = too many requests)
    if (response.status === 403) {
      throw new Error('GitHub rate limit reached. Please wait a few minutes and try again.');
    }
    if (!response.ok) {
      throw new Error('GitHub API error: ' + response.status);
    }

    var data = await response.json();
    return data.items || [];
  }

  // From a list of repos, pick the top K by trending score
  function pickTopK(repos, k) {
    // Add a _score property to each repo
    for (var i = 0; i < repos.length; i++) {
      repos[i]._score = scoreRepo(repos[i]);
    }

    // Sort by score: highest first
    repos.sort(function(a, b) {
      return b._score - a._score;
    });

    // Return only the first K results
    return repos.slice(0, k);
  }


  // ============================================================
  // MAIN FUNCTION
  // ============================================================

  // Fetch and display trending repos based on the current filter settings
  async function loadTrending() {
    var language = langInput.value.trim();
    var topic    = topicInput.value.trim();
    var days     = parseInt(windowInput.value) || 30;
    var k        = Math.min(20, parseInt(kInput.value) || 10);

    // Check if we have recent cached results for these exact filters
    var cacheKey = language + '|' + topic + '|' + days + '|' + k;

    if (searchCache[cacheKey]) {
      var ageInMinutes = (Date.now() - searchCache[cacheKey].time) / (1000 * 60);
      if (ageInMinutes < CACHE_MINUTES) {
        // Use the cached results instead of fetching again
        showResults(searchCache[cacheKey].results);
        setStatus('Done (from cache)');
        return;
      }
    }

    // No valid cache — fetch fresh data
    setStatus('Loading trending repositories…');
    resultsEl.innerHTML = '<div class="muted">Loading…</div>';

    try {
      var repos    = await fetchRepos(language, topic, days);
      var topRepos = pickTopK(repos, k);

      // Save to cache for next time
      searchCache[cacheKey] = { time: Date.now(), results: topRepos };

      showResults(topRepos);
      setStatus('Done');

    } catch (error) {
      setStatus(error.message || 'Failed to load repos', true);
      resultsEl.innerHTML = '<div class="muted">Could not load repositories right now.</div>';
    }
  }


  // ============================================================
  // WIRE UP THE PAGE
  // ============================================================

  // Search when the form is submitted
  form.addEventListener('submit', function(event) {
    event.preventDefault();  // stop the browser from reloading the page
    loadTrending();
  });

  // Reset filters and reload when the reset button is clicked
  resetBtn.addEventListener('click', function() {
    langInput.value   = '';
    topicInput.value  = '';
    windowInput.value = '30';
    kInput.value      = '10';
    loadTrending();
  });

  // Load results immediately when the page opens
  loadTrending();

});  // end DOMContentLoaded
