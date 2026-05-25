// ============================================================
// js/community.js — Trending GitHub Repositories
//
// Imports safeHtml, timeAgo, setStatus from utils.js.
// The trending/scoring logic is specific to this page so it stays here.
// ============================================================

import { safeHtml, timeAgo, setStatus } from './Modules/utils.js';

window.addEventListener('DOMContentLoaded', function() {

  var form        = document.getElementById('trend-form');
  if (!form) return;

  var langInput   = document.getElementById('trend-lang');
  var topicInput  = document.getElementById('trend-topic');
  var windowInput = document.getElementById('trend-window');
  var kInput      = document.getElementById('trend-k');
  var resultsEl   = document.getElementById('trend-results');
  var resetBtn    = document.getElementById('trend-reset');

  var searchCache   = {};
  var CACHE_MINUTES = 5;

  function status(msg, err) { setStatus('trend-status', msg, err); }

  // ---- scoring ----

  function scoreRepo(repo) {
    var stars = repo.stargazers_count || 0;
    var forks = repo.forks_count      || 0;
    var daysSinceUpdate = (Date.now() - new Date(repo.pushed_at)) / 86400000;
    return (stars * 0.5) + (forks * 0.3) + (Math.max(0, 14 - daysSinceUpdate) * 5);
  }

  // ---- rendering ----

  function buildRepoCard(repo) {
    var description = repo.description ? '<div class="repo-desc">' + safeHtml(repo.description) + '</div>' : '';
    var language    = repo.language    ? '<span>' + safeHtml(repo.language) + '</span>' : '';
    return (
      '<div class="repo-item">' +
        '<div class="repo-name"><a href="' + repo.html_url + '" target="_blank" rel="noopener">' + safeHtml(repo.full_name) + '</a></div>' +
        description +
        '<div class="repo-meta">' +
          '<span>★ ' + (repo.stargazers_count || 0) + '</span>' +
          '<span>⑂ ' + (repo.forks_count || 0) + '</span>' +
          language +
          '<span>Updated ' + timeAgo(repo.pushed_at) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function showResults(repos) {
    if (!repos || repos.length === 0) {
      resultsEl.innerHTML = '<div class="muted">No repos matched your filters.</div>';
      return;
    }
    resultsEl.innerHTML = repos.map(buildRepoCard).join('');
  }

  // ---- data fetching ----

  async function fetchRepos(language, topic, days) {
    var since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    var query = 'pushed:>=' + since;
    if (language) query += ' language:' + language;
    if (topic)    query += ' topic:'    + topic;

    var response = await fetch(
      'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=100',
      { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'XAYTHEON' } }
    );
    if (response.status === 403) throw new Error('GitHub rate limit reached. Please wait a few minutes and try again.');
    if (!response.ok) throw new Error('GitHub API error: ' + response.status);
    var data = await response.json();
    return data.items || [];
  }

  function pickTopK(repos, k) {
    repos.forEach(function(r) { r._score = scoreRepo(r); });
    repos.sort(function(a, b) { return b._score - a._score; });
    return repos.slice(0, k);
  }

  // ---- main ----

  async function loadTrending() {
    var language = langInput.value.trim();
    var topic    = topicInput.value.trim();
    var days     = parseInt(windowInput.value) || 30;
    var k        = Math.min(20, parseInt(kInput.value) || 10);
    var cacheKey = language + '|' + topic + '|' + days + '|' + k;

    if (searchCache[cacheKey]) {
      var age = (Date.now() - searchCache[cacheKey].time) / 60000;
      if (age < CACHE_MINUTES) { showResults(searchCache[cacheKey].results); status('Done (from cache)'); return; }
    }

    status('Loading trending repositories…');
    resultsEl.innerHTML = '<div class="muted">Loading…</div>';

    try {
      var repos    = await fetchRepos(language, topic, days);
      var topRepos = pickTopK(repos, k);
      searchCache[cacheKey] = { time: Date.now(), results: topRepos };
      showResults(topRepos);
      status('Done');
    } catch (error) {
      status(error.message || 'Failed to load repos', true);
      resultsEl.innerHTML = '<div class="muted">Could not load repositories right now.</div>';
    }
  }

  // ---- wire up ----

  form.addEventListener('submit', function(e) { e.preventDefault(); loadTrending(); });
  resetBtn.addEventListener('click', function() {
    langInput.value = ''; topicInput.value = ''; windowInput.value = '30'; kInput.value = '10';
    loadTrending();
  });

  loadTrending();
});
