// ============================================================
// js/Modules/github.js — GitHub Dashboard + Mini 3D Viewer
//
// WHY THIS FILE EXISTS:
//   Previously this logic was tangled inside script.js alongside
//   the 3D background code. Separating it means:
//   - You can fix a GitHub API bug without touching 3D code
//   - github.html can load ONLY this file (no 3D background needed)
//
// WHAT IT DOES:
//   - Renders the GitHub profile, repos, activity, contributions chart
//   - Runs the small spinning 3D model in the corner of github.html
//
// IMPORTS:
//   - safeHtml, timeAgo, setText, setHtml, setStatus from utils.js
//   - centerAndScaleModel from background.js (reuses the same helper)
// ============================================================

import { safeHtml, timeAgo, setText, setHtml, setStatus } from './utils.js';
import { centerAndScaleModel } from './background.js';


// ============================================================
// PUBLIC API
// ============================================================

/**
 * Sets up the GitHub Dashboard search form on github.html.
 * Safe to call on any page — exits immediately if the form isn't found.
 */
export function initGithubDashboard() {
  var form = document.getElementById('github-form');
  if (!form) return;

  var usernameInput = document.getElementById('gh-username');
  var clearBtn      = document.getElementById('gh-clear');

  // Restore last searched username from localStorage
  var saved = localStorage.getItem('xaytheon:ghUsername');
  if (saved) {
    usernameInput.value = saved;
    loadGithubDashboard(saved);
  }

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    if (!username) { setStatus('github-status', 'Please enter a GitHub username.', true); return; }
    localStorage.setItem('xaytheon:ghUsername', username);
    loadGithubDashboard(username);
  });

  clearBtn.addEventListener('click', function() {
    localStorage.removeItem('xaytheon:ghUsername');
    usernameInput.value = '';
    setText('gh-name',        '—');
    setText('gh-login',       '—');
    setText('gh-bio',         '');
    setText('gh-followers',   '0');
    setText('gh-following',   '0');
    setText('gh-repos-count', '0');
    setHtml('gh-repo-list',     '');
    setHtml('gh-activity-list', '');
    setHtml('gh-contrib-svg',   '');
    var noteEl = document.getElementById('gh-contrib-note');
    if (noteEl) noteEl.textContent = 'Enter a username and press Load Dashboard.';
    setStatus('github-status', 'Dashboard cleared.');
  });
}

/**
 * Initialises the small spinning 3D model in the corner of github.html.
 * Safe to call on any page — exits if the canvas isn't found.
 */
export function initMiniViewer() {
  var canvas = document.getElementById('mini-3d-canvas');
  if (!canvas) return;

  if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
    var loadingEl = canvas.parentElement.querySelector('.mini-3d-loading');
    if (loadingEl) loadingEl.textContent = '3D unavailable';
    return;
  }

  var container = canvas.parentElement;
  var loadingEl = container.querySelector('.mini-3d-loading');

  var miniScene    = new THREE.Scene();
  var miniCamera   = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var miniRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  miniRenderer.setClearColor(0x000000, 0);

  miniCamera.position.set(2.2, 1.8, 2.2);
  miniCamera.lookAt(0, 0, 0);

  function resizeMini() {
    var w = container.clientWidth;
    var h = container.clientHeight;
    miniRenderer.setSize(w, h);
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
  }
  resizeMini();
  window.addEventListener('resize', resizeMini);

  miniScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(3, 5, 2);
  miniScene.add(dirLight);

  var loader = new THREE.GLTFLoader();
  loader.load('assets/models/github.glb', function(gltf) {
    var model = gltf.scene;
    centerAndScaleModel(model, 3.0);

    var pivot = new THREE.Object3D();
    miniScene.add(pivot);
    pivot.add(model);

    if (loadingEl) loadingEl.style.display = 'none';

    var box  = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var dist   = maxDim * 1.8;
    miniCamera.position.set(dist, dist * 0.8, dist);
    miniCamera.lookAt(0, 0, 0);

    (function animateMini() {
      requestAnimationFrame(animateMini);
      pivot.rotation.y += 0.012;
      miniRenderer.render(miniScene, miniCamera);
    })();
  }, undefined, function(err) {
    console.warn('Mini viewer: model failed to load', err);
    if (loadingEl) loadingEl.textContent = '3D not found';
  });
}


// ============================================================
// PRIVATE — DATA FETCHING
// ============================================================

async function fetchFromGitHub(url) {
  var response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'XAYTHEON-Dashboard' }
  });
  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('GitHub API ' + response.status + ': ' + errorText);
  }
  return response.json();
}

async function loadGithubDashboard(username) {
  setStatus('github-status', 'Loading profile…');
  try {
    var user = await fetchFromGitHub('https://api.github.com/users/' + encodeURIComponent(username));

    var avatarEl = document.getElementById('gh-avatar');
    if (avatarEl) avatarEl.src = user.avatar_url;

    setText('gh-name',      user.name  || '—');
    setText('gh-login',     '@' + user.login);
    setText('gh-bio',       user.bio   || '');
    setText('gh-followers', user.followers || 0);
    setText('gh-following', user.following || 0);

    setStatus('github-status', 'Loading repositories…');
    var repos = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=updated'
    );

    setText('gh-repos-count', user.public_repos || repos.length);

    var ownRepos = repos.filter(function(r) { return !r.fork; });
    ownRepos.sort(function(a, b) { return (b.stargazers_count || 0) - (a.stargazers_count || 0); });
    renderRepos(ownRepos.slice(0, 8));

    setStatus('github-status', 'Loading activity…');
    var events = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) + '/events/public?per_page=25'
    );
    renderActivity(events.slice(0, 10));
    showContributionsChart(username, events);

    setStatus('github-status', 'Done');
  } catch (error) {
    setStatus('github-status', error.message || 'Failed to load GitHub data', true);
  }
}


// ============================================================
// PRIVATE — RENDERING
// ============================================================

function renderRepos(repos) {
  var list = document.getElementById('gh-repo-list');
  if (!list) return;

  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found.</div>';
    return;
  }

  var html = '';
  repos.forEach(function(repo) {
    var description = repo.description ? '<div class="repo-desc">' + safeHtml(repo.description) + '</div>' : '';
    var language    = repo.language    ? '<span>' + safeHtml(repo.language) + '</span>' : '';
    html +=
      '<div class="repo-item">' +
        '<div class="repo-name"><a href="' + repo.html_url + '" target="_blank" rel="noopener">' + safeHtml(repo.full_name) + '</a></div>' +
        description +
        '<div class="repo-meta">' +
          '<span>★ ' + (repo.stargazers_count || 0) + '</span>' +
          '<span>⑂ ' + (repo.forks_count || 0) + '</span>' +
          language +
          '<span>Updated ' + timeAgo(repo.updated_at) + '</span>' +
        '</div>' +
      '</div>';
  });
  list.innerHTML = html;
}

function renderActivity(events) {
  var list = document.getElementById('gh-activity-list');
  if (!list) return;

  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No recent public activity.</li>';
    return;
  }

  var html = '';
  events.forEach(function(ev) {
    var repoName = ev.repo ? ev.repo.name : '';
    var repoLink = repoName
      ? ' in <a href="https://github.com/' + repoName + '" target="_blank" rel="noopener">' + safeHtml(repoName) + '</a>'
      : '';
    html +=
      '<li class="activity-item">' +
        '<div>' + safeHtml(describeEvent(ev)) + repoLink + '</div>' +
        '<div class="activity-time">' + timeAgo(ev.created_at) + '</div>' +
      '</li>';
  });
  list.innerHTML = html;
}

function describeEvent(ev) {
  if (ev.type === 'PushEvent')       return 'Pushed ' + (ev.payload && ev.payload.commits ? ev.payload.commits.length : 0) + ' commit(s)';
  if (ev.type === 'CreateEvent')     return 'Created ' + (ev.payload ? ev.payload.ref_type || '' : '') + ' ' + (ev.payload ? ev.payload.ref || '' : '');
  if (ev.type === 'IssuesEvent')     return 'Issue ' + (ev.payload ? ev.payload.action || '' : '') + ' #' + (ev.payload && ev.payload.issue ? ev.payload.issue.number : '');
  if (ev.type === 'PullRequestEvent') return 'Pull request ' + (ev.payload ? ev.payload.action || '' : '') + ' #' + (ev.payload && ev.payload.pull_request ? ev.payload.pull_request.number : '');
  if (ev.type === 'WatchEvent')      return 'Starred a repository';
  if (ev.type === 'ForkEvent')       return 'Forked a repository';
  return ev.type;
}

function showContributionsChart(username, events) {
  var container = document.getElementById('gh-contrib-svg');
  var noteEl    = document.getElementById('gh-contrib-note');
  if (!container) return;

  container.innerHTML = '<div class="muted">Loading contributions chart…</div>';

  var chartImg = new Image();
  chartImg.alt            = username + "'s contributions";
  chartImg.style.maxWidth = '100%';
  chartImg.referrerPolicy = 'no-referrer';

  chartImg.onload = function() {
    container.innerHTML = '';
    container.appendChild(chartImg);
    if (noteEl) noteEl.textContent = 'Full-year contribution chart.';
  };
  chartImg.onerror = function() {
    container.innerHTML = buildHeatmapFromEvents(events);
    if (noteEl) noteEl.textContent = 'Approximate heatmap based on recent public activity.';
  };

  chartImg.src = 'https://ghchart.rshah.org/' + encodeURIComponent(username);

  if (chartImg.complete) {
    if (chartImg.naturalWidth > 0) chartImg.onload();
    else chartImg.onerror();
  }
}

function buildHeatmapFromEvents(events) {
  if (!events || events.length === 0) return '<div class="muted">No recent public activity.</div>';

  var today     = new Date();
  var daysBack  = 90;
  var startDate = new Date(today.getTime() - daysBack * 86400000);
  var dayCounts = {};

  for (var d = 0; d <= daysBack; d++) {
    var key = new Date(startDate.getTime() + d * 86400000).toISOString().slice(0, 10);
    dayCounts[key] = 0;
  }
  events.forEach(function(ev) {
    if (!ev.created_at) return;
    var k = new Date(ev.created_at).toISOString().slice(0, 10);
    if (dayCounts[k] !== undefined) dayCounts[k]++;
  });

  var days     = Object.keys(dayCounts).sort();
  var maxCount = Math.max(1, Math.max.apply(null, days.map(function(d) { return dayCounts[d]; })));
  var colors   = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
  var cellSize = 10, gap = 2;
  var firstDay    = new Date(days[0] + 'T00:00:00Z');
  var startOffset = firstDay.getUTCDay();
  var numCols     = Math.ceil((days.length + startOffset) / 7);
  var svgWidth    = numCols * (cellSize + gap) + gap;
  var svgHeight   = 7 * (cellSize + gap) + gap + 20;

  var rects = '';
  for (var col = 0; col < numCols; col++) {
    for (var row = 0; row < 7; row++) {
      var dayIndex = col * 7 + row - startOffset;
      if (dayIndex < 0 || dayIndex >= days.length) continue;
      var count    = dayCounts[days[dayIndex]] || 0;
      var colorIdx = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      rects +=
        '<rect x="' + (gap + col * (cellSize + gap)) + '" y="' + (gap + row * (cellSize + gap)) + '"' +
        ' width="' + cellSize + '" height="' + cellSize + '" rx="2" fill="' + colors[colorIdx] + '">' +
          '<title>' + days[dayIndex] + ': ' + count + ' event(s)</title>' +
        '</rect>';
    }
  }

  return '<svg width="' + svgWidth + '" height="' + svgHeight + '" viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" xmlns="http://www.w3.org/2000/svg">' +
    rects +
    '<text x="' + gap + '" y="' + (svgHeight - 4) + '" font-size="10" fill="#666">Last ' + daysBack + ' days (approx.)</text>' +
  '</svg>';
}
