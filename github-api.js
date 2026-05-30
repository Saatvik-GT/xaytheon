// Centralized GitHub API helper: adds global error handling and rate-limit detection
(function() {
  async function fetchFromGitHub(url, options) {
    options = options || {};
    var headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'XAYTHEON'
    }, options.headers || {});

    var resp;
    try {
      resp = await fetch(url, Object.assign({}, options, { headers: headers }));
    } catch (err) {
      throw new Error('Network error while contacting GitHub API.');
    }

    // Rate limit / throttling handling
    if (resp.status === 429) {
      var ra = resp.headers.get('retry-after');
      throw new Error('Too many requests (429). Retry after ' + (ra || 'a few seconds') + '.');
    }

    if (resp.status === 403) {
      var remaining = resp.headers.get('x-ratelimit-remaining');
      var reset = resp.headers.get('x-ratelimit-reset');
      var retryAfter = resp.headers.get('retry-after');

      if (remaining === '0') {
        var resetMsg = reset ? (' Rate limit resets at ' + new Date(parseInt(reset, 10) * 1000).toLocaleTimeString()) : '';
        throw new Error('GitHub rate limit reached.' + resetMsg + ' Please wait and try again.');
      }

      if (retryAfter) {
        throw new Error('GitHub rate limited. Retry after ' + retryAfter + ' seconds.');
      }

      // Generic 403
      throw new Error('GitHub API access forbidden (403).');
    }

    if (!resp.ok) {
      var txt = '';
      try { txt = await resp.text(); } catch (e) { txt = resp.statusText || ''; }
      throw new Error('GitHub API ' + resp.status + ': ' + (txt || resp.statusText));
    }

    // Try to parse JSON; some endpoints may return non-JSON
    try {
      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  // Expose globally so page scripts can reuse the same logic
  window.fetchFromGitHub = fetchFromGitHub;
})();
