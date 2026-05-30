### Summary
Centralize client-side GitHub API access and improve resilience by detecting rate limits and returning consistent, user-friendly error messages.

### Changes
- Add `xaytheon/github-api.js` — global `fetchFromGitHub(url, opts)` helper with:
  - Rate-limit detection (`X-RateLimit-*` / `Retry-After` / 429)
  - Network and JSON parsing fallbacks
- Update `community.js`, `explore.js`, and `script.js` to use the helper.
- Update HTML pages to load the helper before page scripts.

### How to test
1. Start a static server (or use Live Server) and open the pages.
2. Simulate 403/429 responses (via network devtools or a proxy) to confirm friendly rate-limit messages display in the UI.
3. Verify normal searches/load still work.

### Checklist
- [ ] Follows `CONTRIBUTION.md`
- [ ] No user-visible regressions
- [ ] `Fixes #929` included in the title

Fixes #929
