function safeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeAttr(url) {
  try {
    return encodeURI(url);
  } catch {
    return "#";
  }
}
// ============================================================
// script.js - 3D Background + GitHub Dashboard
// ============================================================

var scene, camera, renderer;
var currentMesh, currentModel;
var lastFetchedEvents = null;
var lastFetchedRepos  = null;
var autoRotationSpeed = 0.005;
var isAutoRotating    = true;
var targetOrbitOffset  = { x: 0, y: 0 };
var currentOrbitOffset = { x: 0, y: 0 };
var baseCameraPos = { x: 5, y: 5, z: 5 };

// ── Date-range filter state (GitHub Dashboard) ──────────────
var ghDateFilter = { start: null, end: null };  // null = no filter

var shapes = {
  cube:       function() { return new THREE.BoxGeometry(2, 2, 2); },
  sphere:     function() { return new THREE.SphereGeometry(1.5, 32, 32); },
  torus:      function() { return new THREE.TorusGeometry(1.5, 0.5, 16, 100); },
  cylinder:   function() { return new THREE.CylinderGeometry(1, 1, 2, 32); },
  octahedron: function() { return new THREE.OctahedronGeometry(1.5); }
};

// ============================================================
// PART 1 — 3D BACKGROUND
// ============================================================

function init() {
  var canvas    = document.getElementById('three-canvas');
  var container = document.querySelector('.canvas-container');

  scene = new THREE.Scene();
  var aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  canvas.style.pointerEvents = 'none';

  addLights();
  loadModel('assets/models/prism.glb', function() {
    console.log('prism.glb failed, showing octahedron instead');
    createShape('octahedron');
  });

  window.addEventListener('resize', onWindowResize);

  setTimeout(function() {
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, 1000);

  animate();
}

function addLights() {
  var ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  var mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(10, 10, 5);
  mainLight.castShadow = true;
  scene.add(mainLight);
  var fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
  fillLight.position.set(-5, 0, -5);
  scene.add(fillLight);
  var pointLight = new THREE.PointLight(0xff9999, 0.5, 50);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
}

function createShape(shapeType) {
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh.material.dispose();
    currentMesh = null;
  }
  if (currentModel) {
    scene.remove(currentModel);
    disposeModel(currentModel);
    currentModel = null;
  }
  var colorEl = document.getElementById('color-picker');
  var color   = colorEl ? colorEl.value : '#66ccff';
  var geometry = shapes[shapeType]();
  var material = new THREE.MeshPhongMaterial({ color: color, shininess: 100, transparent: true, opacity: 0.9 });
  currentMesh = new THREE.Mesh(geometry, material);
  currentMesh.castShadow = true;
  scene.add(currentMesh);
}

function animate() {
  requestAnimationFrame(animate);
  if (currentModel && isAutoRotating) currentModel.rotation.y += autoRotationSpeed;
  if (currentMesh  && isAutoRotating) {
    currentMesh.rotation.x += autoRotationSpeed;
    currentMesh.rotation.y += autoRotationSpeed * 1.5;
  }
  currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
  currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
  camera.position.x = baseCameraPos.x + currentOrbitOffset.x * 1.5;
  camera.position.y = baseCameraPos.y + currentOrbitOffset.y * 1.0;
  camera.position.z = baseCameraPos.z;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

function onWindowResize() {
  var container = document.querySelector('.canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function loadModel(url, onError) {
  var loader = new THREE.GLTFLoader();
  loader.load(url,
    function(gltf) {
      if (currentMesh) { scene.remove(currentMesh); currentMesh.geometry.dispose(); currentMesh.material.dispose(); currentMesh = null; }
      if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); }
      currentModel = gltf.scene;
      prepareModel(currentModel);
      scene.add(currentModel);
      zoomCameraToFit(currentModel);
      console.log('Model loaded:', url);
    },
    undefined,
    function(err) { console.warn('Model failed to load:', url, err); if (onError) onError(err); }
  );
}

function prepareModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });
  centerAndScaleModel(model, 16);
}

function centerAndScaleModel(model, targetSize) {
  var box    = new THREE.Box3().setFromObject(model);
  var size   = new THREE.Vector3();
  var center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  model.position.sub(center);
  var maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) model.scale.setScalar(targetSize / maxDimension);
}

function zoomCameraToFit(model) {
  var box  = new THREE.Box3().setFromObject(model);
  var size = new THREE.Vector3();
  box.getSize(size);
  var maxDimension = Math.max(size.x, size.y, size.z);
  var distance  = maxDimension * 0.95;
  var direction = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(direction.multiplyScalar(distance));
  camera.fov = 60;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  baseCameraPos.x = camera.position.x;
  baseCameraPos.y = camera.position.y;
  baseCameraPos.z = camera.position.z;
}

function disposeModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (var i = 0; i < child.material.length; i++) child.material[i].dispose();
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

function addMouseEffects() {
  window.addEventListener('mousemove', function(event) {
    var normalizedX = (event.clientX / window.innerWidth)  * 2 - 1;
    var normalizedY = (event.clientY / window.innerHeight) * 2 - 1;
    targetOrbitOffset.x =  normalizedX * 0.5;
    targetOrbitOffset.y = -normalizedY * 0.3;
  });

  var canvas = renderer.domElement;
  function updateOpacity() {
    var scrollY     = window.scrollY;
    var maxScroll   = 600;
    var baseOpacity = 0.18;
    var maxOpacity  = 0.35;
    var extra = Math.min(scrollY / maxScroll, 1) * (maxOpacity - baseOpacity);
    canvas.style.opacity = (baseOpacity + extra).toFixed(2);
  }
  window.addEventListener('scroll', updateOpacity);
  updateOpacity();
}


// ============================================================
// PART 2 — DATE-RANGE FILTER UI
// ============================================================
 
/**
 * Inject the date-range filter bar into the GitHub Dashboard section.
 * Called once from initGithubDashboard() after the form is found.
 */
function injectDateFilterStyles() {
  if (document.getElementById('xaytheon-filter-styles')) return;
  var style = document.createElement('style');
  style.id = 'xaytheon-filter-styles';
  style.textContent = [
    '#gh-date-filter-bar, #contrib-date-filter-bar {',
    '  width: 100%; margin: 0 0 24px 0; position: relative; z-index: 2;',
    '}',
 
    '#gh-date-filter-bar .xf-bar, #contrib-date-filter-bar .xf-bar {',
    '  display: flex !important; flex-wrap: wrap !important; align-items: center !important;',
    '  gap: 10px !important; padding: 14px 20px 14px 24px !important;',
    '  border-radius: 14px !important; position: relative !important;',
    '  border-left: 3px solid #0ea5e9 !important;',
    '}',
 
    '#gh-date-filter-bar .xf-label, #contrib-date-filter-bar .xf-label {',
    '  font-size: 11px !important; font-weight: 800 !important; letter-spacing: 1.2px !important;',
    '  text-transform: uppercase !important; color: #0ea5e9 !important;',
    '  white-space: nowrap !important; flex-shrink: 0 !important;',
    '  background: none !important; border: none !important; padding: 0 !important;',
    '  box-shadow: none !important; margin: 0 !important; opacity: 1 !important;',
    '}',
 
    '#gh-date-filter-bar .xf-div, #contrib-date-filter-bar .xf-div {',
    '  width: 1px !important; height: 20px !important; opacity: 0.3 !important; flex-shrink: 0 !important;',
    '}',
 
    '#gh-date-filter-bar .xf-presets, #contrib-date-filter-bar .xf-presets {',
    '  display: flex !important; flex-wrap: wrap !important; gap: 5px !important; align-items: center !important;',
    '}',
 
    '#gh-date-filter-bar .xf-btn, #contrib-date-filter-bar .xf-btn {',
    '  display: inline-block !important; padding: 6px 14px !important;',
    '  font-size: 12.5px !important; font-family: inherit !important; font-weight: 700 !important;',
    '  border-radius: 8px !important; cursor: pointer !important;',
    '  white-space: nowrap !important; line-height: 1.4 !important;',
    '  opacity: 1 !important; text-decoration: none !important;',
    '  background: transparent !important; color: inherit !important;',
    '  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s !important;',
    '}',
    '#gh-date-filter-bar .xf-btn::before, #contrib-date-filter-bar .xf-btn::before {',
    '  display: none !important;',
    '}',
    '#gh-date-filter-bar .xf-btn:hover, #contrib-date-filter-bar .xf-btn:hover {',
    '  background: rgba(14,165,233,0.12) !important; color: #0ea5e9 !important;',
    '  border-color: rgba(14,165,233,0.6) !important; transform: translateY(-1px) !important;',
    '  box-shadow: 0 2px 8px rgba(14,165,233,0.2) !important; opacity: 1 !important;',
    '}',
    '#gh-date-filter-bar .xf-btn.xf-active, #contrib-date-filter-bar .xf-btn.xf-active {',
    '  background: #0ea5e9 !important; border-color: #0ea5e9 !important;',
    '  color: #fff !important; box-shadow: 0 2px 10px rgba(14,165,233,0.4) !important;',
    '  transform: translateY(-1px) !important; opacity: 1 !important;',
    '}',
 
    '#gh-date-filter-bar .xf-badge, #contrib-date-filter-bar .xf-badge {',
    '  display: inline-flex !important; align-items: center !important; gap: 6px !important;',
    '  padding: 5px 12px !important; font-size: 12px !important; font-weight: 700 !important;',
    '  background: rgba(14,165,233,0.12) !important; border: 1px solid rgba(14,165,233,0.35) !important;',
    '  border-radius: 999px !important; color: #0ea5e9 !important; white-space: nowrap !important;',
    '}',
 
    '#gh-date-filter-bar .xf-clear, #contrib-date-filter-bar .xf-clear {',
    '  display: inline-flex !important; align-items: center !important; justify-content: center !important;',
    '  width: 16px !important; height: 16px !important; border-radius: 50% !important;',
    '  background: rgba(14,165,233,0.22) !important; border: none !important;',
    '  color: #0ea5e9 !important; cursor: pointer !important; font-size: 10px !important;',
    '  padding: 0 !important; opacity: 1 !important; flex-shrink: 0 !important;',
    '}',
    '#gh-date-filter-bar .xf-clear::before, #contrib-date-filter-bar .xf-clear::before {',
    '  display: none !important;',
    '}',
 
    '#gh-date-filter-bar .xf-custom, #contrib-date-filter-bar .xf-custom {',
    '  width: 100% !important; display: flex !important; flex-wrap: wrap !important;',
    '  align-items: flex-end !important; gap: 10px !important;',
    '  padding-top: 12px !important; border-top: 1px dashed rgba(14,165,233,0.3) !important;',
    '}',
 
    '#gh-date-filter-bar .xf-inp-wrap, #contrib-date-filter-bar .xf-inp-wrap {',
    '  display: flex !important; flex-direction: column !important; gap: 4px !important;',
    '}',
    '#gh-date-filter-bar .xf-inp-wrap label, #contrib-date-filter-bar .xf-inp-wrap label {',
    '  font-size: 11px !important; font-weight: 800 !important; letter-spacing: 1px !important;',
    '  text-transform: uppercase !important; color: #0ea5e9 !important;',
    '}',
    '#gh-date-filter-bar .xf-inp-wrap input, #contrib-date-filter-bar .xf-inp-wrap input {',
    '  padding: 8px 12px !important; font-size: 13px !important; font-family: inherit !important;',
    '  border-radius: 8px !important; outline: none !important;',
    '  min-width: 148px !important; line-height: 1.4 !important; opacity: 1 !important;',
    '}',
 
    '#gh-date-filter-bar .xf-apply, #contrib-date-filter-bar .xf-apply {',
    '  padding: 8px 20px !important; font-size: 13px !important; font-family: inherit !important;',
    '  font-weight: 800 !important; border-radius: 8px !important; border: none !important;',
    '  background: #0ea5e9 !important; color: #fff !important; cursor: pointer !important;',
    '  align-self: flex-end !important; opacity: 1 !important; white-space: nowrap !important;',
    '  box-shadow: 0 2px 10px rgba(14,165,233,0.32) !important;',
    '}',
    '#gh-date-filter-bar .xf-apply::before, #contrib-date-filter-bar .xf-apply::before {',
    '  display: none !important;',
    '}',
    '#gh-date-filter-bar .xf-apply:hover, #contrib-date-filter-bar .xf-apply:hover {',
    '  opacity: 0.85 !important; transform: translateY(-1px) !important;',
    '}',
 
    '#gh-filtered-count, #contrib-filter-count {',
    '  font-size: 12px !important; opacity: 0.5 !important; text-align: right !important;',
    '  margin: -16px 0 16px !important; font-style: italic !important;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}
 
function injectDateFilterBar() {
  var form = document.getElementById('github-form');
  if (!form) return;
 
  // Inject styles via JS — bypasses all CSS file loading issues
  injectDateFilterStyles();
 
  // Detect theme for dynamic colors
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bgColor     = isDark ? '#0d1117' : '#ffffff';
  var borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  var textColor   = isDark ? '#ffffff' : '#000000';
  var divColor    = isDark ? '#ffffff' : '#000000';
 
  var bar = document.createElement('div');
  bar.id = 'gh-date-filter-bar';
 
  var barDiv = document.createElement('div');
  barDiv.className = 'xf-bar';
  barDiv.style.cssText = [
    'background:' + bgColor,
    'border:1px solid ' + borderColor,
    'box-shadow: 0 2px 12px rgba(0,0,0,0.08)',
  ].join(';');
 
  barDiv.innerHTML = [
    '<span class="xf-label">Filter range</span>',
    '<div class="xf-div" style="background:' + divColor + '"></div>',
    '<div class="xf-presets">',
    '  <button class="xf-btn xf-active" style="border:1px solid ' + borderColor + '" data-days="0">All time</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="7">7 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="30">30 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="90">3 months</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="365">1 year</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="custom">Custom ↓</button>',
    '</div>',
    '<div class="xf-badge" id="gh-filter-badge" style="display:none">',
    '  <span id="gh-filter-badge-text"></span>',
    '  <button class="xf-clear" id="gh-date-clear-filter">✕</button>',
    '</div>',
    '<div class="xf-custom" id="gh-custom-range" style="display:none">',
    '  <div class="xf-inp-wrap">',
    '    <label>From</label>',
    '    <input type="date" id="gh-date-start" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <div class="xf-inp-wrap">',
    '    <label>To</label>',
    '    <input type="date" id="gh-date-end" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <button class="xf-apply" id="gh-date-apply">Apply</button>',
    '</div>',
  ].join('\n');
 
  bar.appendChild(barDiv);
 
  // Insert BEFORE the github-grid
  var grid = document.querySelector('.github-grid');
  if (grid) {
    grid.parentNode.insertBefore(bar, grid);
  } else {
    form.parentNode.insertBefore(bar, form.nextSibling);
  }
 
  // Wire up preset buttons
  bar.querySelectorAll('.xf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background = 'transparent'; b.style.color = 'inherit'; b.style.borderColor = ''; });
      btn.classList.add('xf-active');
      btn.style.background = '#0ea5e9';
      btn.style.color = '#fff';
      btn.style.borderColor = '#0ea5e9';
 
      var days = btn.getAttribute('data-days');
      var customRange = document.getElementById('gh-custom-range');
 
      if (days === 'custom') {
        customRange.style.display = 'flex';
        return;
      }
 
      customRange.style.display = 'none';
 
      if (days === '0') {
        ghDateFilter = { start: null, end: null };
        updateFilterBadge(null, null);
      } else {
        var end   = new Date();
        var start = new Date(Date.now() - parseInt(days) * 86400000);
        ghDateFilter = { start: start, end: end };
        updateFilterBadge(start, end);
      }
 
      applyDateFilterAndRender();
    });
  });
 
  // Wire up custom range apply
  document.getElementById('gh-date-apply').addEventListener('click', function() {
    var startVal = document.getElementById('gh-date-start').value;
    var endVal   = document.getElementById('gh-date-end').value;
 
    if (!startVal && !endVal) {
      ghDateFilter = { start: null, end: null };
      updateFilterBadge(null, null);
    } else {
      var start = startVal ? new Date(startVal + 'T00:00:00') : null;
      var end   = endVal   ? new Date(endVal   + 'T23:59:59') : new Date();
      if (start && end && start > end) {
        alert('Start date must be before end date.');
        return;
      }
      ghDateFilter = { start: start, end: end };
      updateFilterBadge(start, end);
    }
 
    applyDateFilterAndRender();
  });
 
  // Wire up clear button
  document.getElementById('gh-date-clear-filter').addEventListener('click', function() {
    ghDateFilter = { start: null, end: null };
    updateFilterBadge(null, null);
    bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background='transparent'; b.style.color='inherit'; b.style.borderColor=''; });
    var allTime = bar.querySelector('[data-days="0"]');
    if (allTime) { allTime.classList.add('xf-active'); allTime.style.background='#0ea5e9'; allTime.style.color='#fff'; allTime.style.borderColor='#0ea5e9'; }
    document.getElementById('gh-custom-range').style.display = 'none';
    applyDateFilterAndRender();
  });
}
 
/** Update the "active filter" badge text */
function updateFilterBadge(start, end) {
  var badge    = document.getElementById('gh-filter-badge');
  var badgeTxt = document.getElementById('gh-filter-badge-text');
  if (!badge || !badgeTxt) return;
 
  if (!start && !end) {
    badge.style.display = 'none';
    badgeTxt.textContent = '';
    return;
  }
 
  var fmt = function(d) {
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '…';
  };
  badgeTxt.textContent = fmt(start) + ' → ' + fmt(end);
  badge.style.display = 'inline-flex';
}
 
/** Filter an array of GitHub events by the current ghDateFilter */
function filterEventsByDate(events) {
  if (!events) return [];
  if (!ghDateFilter.start && !ghDateFilter.end) return events;
 
  return events.filter(function(ev) {
    if (!ev.created_at) return true;
    var d = new Date(ev.created_at);
    if (ghDateFilter.start && d < ghDateFilter.start) return false;
    if (ghDateFilter.end   && d > ghDateFilter.end)   return false;
    return true;
  });
}
 
/** Filter an array of repos by the current ghDateFilter (uses updated_at) */
function filterReposByDate(repos) {
  if (!repos) return [];
  if (!ghDateFilter.start && !ghDateFilter.end) return repos;
 
  return repos.filter(function(repo) {
    var d = new Date(repo.updated_at || repo.pushed_at || repo.created_at);
    if (ghDateFilter.start && d < ghDateFilter.start) return false;
    if (ghDateFilter.end   && d > ghDateFilter.end)   return false;
    return true;
  });
}
 
/** Re-render dashboard cards using cached data + current filter */
function applyDateFilterAndRender() {
  if (!lastFetchedEvents && !lastFetchedRepos) return;
 
  var filteredEvents = filterEventsByDate(lastFetchedEvents || []);
  var filteredRepos  = filterReposByDate(lastFetchedRepos  || []);
 
  // Update activity count badge
  var countBadge = document.getElementById('gh-filtered-count');
  if (countBadge) {
    var total    = (lastFetchedEvents || []).length;
    var filtered = filteredEvents.length;
    countBadge.textContent = (ghDateFilter.start || ghDateFilter.end)
      ? filtered + ' / ' + total + ' events in range'
      : '';
  }

  
  renderRepos(filteredRepos.slice(0, 8));
  renderActivity(filteredEvents.slice(0, 10));
  showContributionsChart(
    localStorage.getItem('xaytheon:ghUsername') || '',
    filteredEvents
  );
}


// ============================================================
// PART 3 — GITHUB DASHBOARD
// ============================================================

function initGithubDashboard() {
  var form = document.getElementById('github-form');
  if (!form) return;

  var usernameInput = document.getElementById('gh-username');
  var clearBtn      = document.getElementById('gh-clear');

  // Inject the date filter bar
  injectDateFilterBar();

  // Add event count info element (injected below the grid later)
  var grid = document.querySelector('.github-grid');
  if (grid) {
    var infoEl = document.createElement('div');
    infoEl.id = 'gh-filtered-count';
    infoEl.style.cssText = 'grid-column:1/-1; text-align:right; font-size:0.82em; opacity:0.6; margin-top:-8px;';
    grid.parentNode.insertBefore(infoEl, grid);
  }

  var savedUsername = localStorage.getItem('xaytheon:ghUsername');
  if (savedUsername) {
    usernameInput.value = savedUsername;
    loadGithubDashboard(savedUsername);
  }

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    var username = usernameInput.value.trim();
    if (!username) { setGithubStatus('Please enter a GitHub username.', true); return; }
    localStorage.setItem('xaytheon:ghUsername', username);
    loadGithubDashboard(username);
  });

  clearBtn.addEventListener('click', function() {
    localStorage.removeItem('xaytheon:ghUsername');
    usernameInput.value = '';
    lastFetchedEvents = null;
    lastFetchedRepos  = null;
    ghDateFilter      = { start: null, end: null };

    setText('gh-name',         '—');
    setText('gh-login',        '—');
    setText('gh-bio',          '');
    setText('gh-followers',    '0');
    setText('gh-following',    '0');
    setText('gh-repos-count',  '0');
    setHtml('gh-repo-list',    '');
    setHtml('gh-activity-list','');
    setHtml('gh-contrib-svg',  '');

    var noteEl = document.getElementById('gh-contrib-note');
    if (noteEl) noteEl.textContent = 'Enter a username and press Load Dashboard.';

    var countEl = document.getElementById('gh-filtered-count');
    if (countEl) countEl.textContent = '';

    // Reset filter UI
    var bar = document.getElementById('gh-date-filter-bar');
    if (bar) {
      bar.querySelectorAll('.date-preset-btn').forEach(function(b) { b.classList.remove('active'); });
      var allTimeBtn = bar.querySelector('[data-days="0"]');
      if (allTimeBtn) allTimeBtn.classList.add('active');
      var customRange = document.getElementById('gh-custom-range');
      if (customRange) customRange.style.display = 'none';
      updateFilterBadge(null, null);
    }

    setGithubStatus('Dashboard cleared.');
  });
}

async function loadGithubDashboard(username) {
  setGithubStatus('Loading profile…');

  try {
    var user = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username)
    );

    var avatarEl = document.getElementById('gh-avatar');
    if (avatarEl) avatarEl.src = user.avatar_url;

    setText('gh-name',      user.name  || '—');
    document.getElementById("gh-login").innerHTML =
    '@' + user.login +
    '<button class="copy-btn" onclick="copyLink(\'' +
    user.html_url +
    '\')">📋</button>';
    setText('gh-bio',       user.bio   || '');
    setText('gh-followers', user.followers || 0);
    setText('gh-following', user.following || 0);

    setGithubStatus('Loading repositories…');
    var repos = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/repos?per_page=100&sort=updated'
    );

    setText('gh-repos-count', user.public_repos || repos.length);

    var ownRepos = [];
    for (var i = 0; i < repos.length; i++) {
      if (!repos[i].fork) ownRepos.push(repos[i]);
    }
    ownRepos.sort(function(a, b) {
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    });

    // Cache all repos before filtering
    lastFetchedRepos = ownRepos;

    setGithubStatus('Loading activity…');
    var events = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/events/public?per_page=100'
    );

    // Cache all events before filtering
    lastFetchedEvents = events;

    // Apply current filter (may be "all time") and render
    applyDateFilterAndRender();

    setGithubStatus('Done');

  } catch (error) {
    setGithubStatus(error.message || 'Failed to load GitHub data', true);
  }
}

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

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    alert("Copied!");
  } catch (err) {
    console.error(err);
  }
}

function renderRepos(repos) {
  var list = document.getElementById('gh-repo-list');
  if (!list) return;

  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found in this date range.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];
    var description = repo.description
      ? '<div class="repo-desc">' + safeHtml(repo.description) + '</div>' : '';
    var language = repo.language
      ? '<span>' + safeHtml(repo.language) + '</span>' : '';

    html +=
    '<div class="repo-name">' +
    '<a href="' + repo.html_url + '" target="_blank" rel="noopener">' +
    safeHtml(repo.full_name) +
    '</a>' +

    '<button class="copy-btn" onclick="copyLink(\'' +
    repo.html_url +
    '\')">📋</button>' +
    '</div>' +
        
        description +
        '<div class="repo-meta">' +
          '<span>★ ' + (repo.stargazers_count || 0) + '</span>' +
          '<span>⑂ ' + (repo.forks_count     || 0) + '</span>' +
          language +
          '<span>Updated ' + timeAgo(repo.updated_at) + '</span>' +
        '</div>' +
      '</div>';
  }
  list.innerHTML = html;
}

function renderActivity(events) {
  var list = document.getElementById('gh-activity-list');
  if (!list) return;

  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No activity in this date range.</li>';
    return;
  }

  var html = '';
  for (var i = 0; i < events.length; i++) {
    var ev       = events[i];
    var repoName = ev.repo ? ev.repo.name : '';
    var desc     = describeEvent(ev);
    var time     = timeAgo(ev.created_at);
    var repoLink = repoName
      ? ' in <a href="https://github.com/' + repoName + '" target="_blank" rel="noopener">' +
          safeHtml(repoName) + '</a>' : '';

    html +=
      '<li class="activity-item">' +
        '<div>' + safeHtml(desc) + repoLink + '</div>' +
        '<div class="activity-time">' + time + '</div>' +
      '</li>';
  }
  list.innerHTML = html;
}

function describeEvent(ev) {
  if (ev.type === 'PushEvent') {
    var count = ev.payload && ev.payload.commits ? ev.payload.commits.length : 0;
    return 'Pushed ' + count + ' commit(s)';
  }
  if (ev.type === 'CreateEvent') {
    var refType = ev.payload ? (ev.payload.ref_type || '') : '';
    var ref     = ev.payload ? (ev.payload.ref      || '') : '';
    return 'Created ' + refType + ' ' + ref;
  }
  if (ev.type === 'IssuesEvent') {
    var action = ev.payload ? (ev.payload.action || '') : '';
    var num    = ev.payload && ev.payload.issue ? ev.payload.issue.number : '';
    return 'Issue ' + action + ' #' + num;
  }
  if (ev.type === 'PullRequestEvent') {
    var action = ev.payload ? (ev.payload.action || '') : '';
    var num    = ev.payload && ev.payload.pull_request ? ev.payload.pull_request.number : '';
    return 'Pull request ' + action + ' #' + num;
  }
  if (ev.type === 'WatchEvent') return 'Starred a repository';
  if (ev.type === 'ForkEvent')  return 'Forked a repository';
  return ev.type;
}

function showContributionsChart(username, events) {
  var container = document.getElementById('gh-contrib-svg');
  var noteEl    = document.getElementById('gh-contrib-note');
  if (!container) return;

  // If a date filter is active, skip the third-party image and use local heatmap
  if (ghDateFilter.start || ghDateFilter.end) {
    var svgHtml = buildHeatmapFromEvents(events);
    container.innerHTML = svgHtml;
    if (noteEl) noteEl.textContent = 'Filtered heatmap based on selected date range.';
    return;
  }

  container.innerHTML = '<div class="muted">Loading contributions chart…</div>';

  var chartImg = new Image();
  chartImg.alt            = username + "'s contributions";
  chartImg.style.maxWidth = '100%';
  chartImg.referrerPolicy = 'no-referrer';

  chartImg.onload = function() {
    container.innerHTML = '';
    container.appendChild(chartImg);
    var btn = document.createElement("button");
    btn.innerHTML = "📋";
    btn.className = "copy-btn";
    // GitHub doesn't provide a dedicated public contributions page.
    // A user's contribution history is displayed on their GitHub profile,
    // including contributions across their own repositories and repositories
    // where they've contributed via issues or pull requests.
    // Therefore, we copy the profile URL instead.
    btn.onclick = function () {
        copyLink("https://github.com/users/" + username);
    };

    container.appendChild(btn);
    if (noteEl) noteEl.textContent = 'Full-year contribution chart.';
  };

  chartImg.onerror = function() {
    var svgHtml = buildHeatmapFromEvents(events);
    container.innerHTML = svgHtml;
    if (noteEl) noteEl.textContent = 'Approximate heatmap based on recent public activity.';
  };

  var theme = document.documentElement.getAttribute('data-theme') || 'light';
  chartImg.src = 'https://kusa-image.deno.dev/' + encodeURIComponent(username) + '?theme=' + theme;

  if (chartImg.complete) {
    if (chartImg.naturalWidth > 0) chartImg.onload();
    else chartImg.onerror();
  }
}

function buildHeatmapFromEvents(events) {
  if (!events || events.length === 0) {
    return '<div class="muted">No activity in this range.</div>';
  }

  // Determine the date window: filter range or last 90 days
  var endDate, startDate, daysBack;

  if (ghDateFilter.start || ghDateFilter.end) {
    endDate   = ghDateFilter.end   || new Date();
    startDate = ghDateFilter.start || new Date(endDate.getTime() - 90 * 86400000);
    daysBack  = Math.ceil((endDate - startDate) / 86400000);
  } else {
    daysBack  = 90;
    endDate   = new Date();
    startDate = new Date(Date.now() - daysBack * 86400000);
  }

  // Build day map
  var dayCounts = {};
  for (var d = 0; d <= daysBack; d++) {
    var dayDate = new Date(startDate.getTime() + d * 86400000);
    var key = dayDate.toISOString().slice(0, 10);
    dayCounts[key] = 0;
  }

  for (var i = 0; i < events.length; i++) {
    if (!events[i].created_at) continue;
    var eventDate = new Date(events[i].created_at);
    var key = eventDate.toISOString().slice(0, 10);
    if (dayCounts[key] !== undefined) dayCounts[key]++;
  }

  var days = Object.keys(dayCounts).sort();
  if (days.length === 0) return '<div class="muted">No activity data.</div>';

  var maxCount = 1;
  for (var i = 0; i < days.length; i++) {
    if (dayCounts[days[i]] > maxCount) maxCount = dayCounts[days[i]];
  }

  var colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
  if (document.documentElement.getAttribute('data-theme') === 'dark') colors[0] = '#2d333b';

  var cellSize   = 10;
  var gap        = 2;
  var firstDay   = new Date(days[0] + 'T00:00:00Z');
  var startOffset = firstDay.getUTCDay();
  var totalCells  = days.length + startOffset;
  var numCols     = Math.ceil(totalCells / 7);
  var svgWidth    = numCols * (cellSize + gap) + gap;
  var svgHeight   = 7 * (cellSize + gap) + gap + 20;

  var rects = '';
  for (var col = 0; col < numCols; col++) {
    for (var row = 0; row < 7; row++) {
      var dayIndex = col * 7 + row - startOffset;
      if (dayIndex < 0 || dayIndex >= days.length) continue;
      var day      = days[dayIndex];
      var count    = dayCounts[day] || 0;
      var colorIdx = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      var x        = gap + col * (cellSize + gap);
      var y        = gap + row * (cellSize + gap);
      rects +=
        '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '"' +
        ' rx="2" fill="' + colors[colorIdx] + '">' +
          '<title>' + day + ': ' + count + ' event(s)</title>' +
        '</rect>';
    }
  }

  var labelText = (ghDateFilter.start || ghDateFilter.end)
    ? 'Filtered range (' + daysBack + ' days)'
    : 'Last ' + daysBack + ' days (approx.)';

  var label =
    '<text x="' + gap + '" y="' + (svgHeight - 4) + '" font-size="10" fill="#666">' +
      labelText +
    '</text>';

  return '<svg width="' + svgWidth + '" height="' + svgHeight + '"' +
         ' viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '"' +
         ' xmlns="http://www.w3.org/2000/svg">' +
           rects + label +
         '</svg>';
}


// ============================================================
// PART 4 — MINI 3D VIEWER
// ============================================================

function initMiniViewer() {
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
  loader.load(
    'assets/models/github.glb',
    function(gltf) {
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

      function animateMini() {
        requestAnimationFrame(animateMini);
        pivot.rotation.y += 0.012;
        miniRenderer.render(miniScene, miniCamera);
      }
      animateMini();
    },
    undefined,
    function(err) {
      console.warn('Mini viewer: model failed to load', err);
      if (loadingEl) loadingEl.textContent = '3D not found';
    }
  );
}


// ============================================================
// PART 5 — SHARED UTILITIES
// ============================================================

function safeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function setGithubStatus(message, isError) {
  var el = document.getElementById('github-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}

function timeAgo(dateString) {
  var secondsAgo = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (secondsAgo < 60)       return 'just now';
  if (secondsAgo < 3600)     return Math.floor(secondsAgo / 60)      + ' minutes ago';
  if (secondsAgo < 86400)    return Math.floor(secondsAgo / 3600)    + ' hours ago';
  if (secondsAgo < 2592000)  return Math.floor(secondsAgo / 86400)   + ' days ago';
  if (secondsAgo < 31536000) return Math.floor(secondsAgo / 2592000) + ' months ago';
  return Math.floor(secondsAgo / 31536000) + ' years ago';
}


// ============================================================
// PART 6 — DEVELOPER COMPARISON MODE
// ============================================================

var cmpData = { left: null, right: null };  // cached fetched data for both sides

function injectCompareStyles() {
  if (document.getElementById('xaytheon-compare-styles')) return;
  var s = document.createElement('style');
  s.id = 'xaytheon-compare-styles';
  s.textContent = [
    /* ── Toggle button ─────────────────────────────────────── */
    '#gh-compare-toggle { display:inline-flex !important; align-items:center !important; gap:7px !important; padding:9px 18px !important; font-size:13px !important; font-family:inherit !important; font-weight:700 !important; border-radius:10px !important; cursor:pointer !important; border:1.5px solid rgba(14,165,233,0.5) !important; background:transparent !important; color:#0ea5e9 !important; opacity:1 !important; transition:all 0.15s !important; margin-top:12px !important; }',
    '#gh-compare-toggle::before { display:none !important; }',
    '#gh-compare-toggle:hover { background:rgba(14,165,233,0.08) !important; border-color:#0ea5e9 !important; }',
    '#gh-compare-toggle.cmp-active { background:#0ea5e9 !important; color:#fff !important; border-color:#0ea5e9 !important; box-shadow:0 2px 12px rgba(14,165,233,0.3) !important; }',

    /* ── Second input row ──────────────────────────────────── */
    '#gh-compare-input-row { display:none; margin-top:14px; gap:12px; align-items:flex-end; flex-wrap:wrap; padding:16px 20px; border-radius:12px; border:1px dashed rgba(14,165,233,0.3); background:rgba(14,165,233,0.04); }',
    '#gh-compare-input-row.cmp-visible { display:flex !important; }',
    '#gh-compare-input-row label { font-size:11px !important; font-weight:800 !important; letter-spacing:1px !important; text-transform:uppercase !important; color:#0ea5e9 !important; display:block !important; margin-bottom:5px !important; }',
    '#gh-compare-input-row input { padding:11px 14px !important; font-size:14px !important; font-family:inherit !important; border-radius:9px !important; outline:none !important; min-width:220px !important; opacity:1 !important; transition:border-color 0.15s, box-shadow 0.15s !important; }',
    '#gh-compare-input-row input:focus { border-color:#0ea5e9 !important; box-shadow:0 0 0 3px rgba(14,165,233,0.15) !important; }',
    '#gh-compare-btn { padding:11px 22px !important; font-size:13px !important; font-family:inherit !important; font-weight:800 !important; border-radius:9px !important; border:none !important; background:linear-gradient(135deg,#0ea5e9,#38bdf8) !important; color:#fff !important; cursor:pointer !important; opacity:1 !important; white-space:nowrap !important; box-shadow:0 2px 10px rgba(14,165,233,0.3) !important; transition:opacity 0.15s,transform 0.1s !important; }',
    '#gh-compare-btn::before { display:none !important; }',
    '#gh-compare-btn:hover { opacity:0.88 !important; transform:translateY(-1px) !important; }',

    /* ── Compare panel ─────────────────────────────────────── */
    '#gh-compare-panel { display:none; margin-bottom:32px; }',
    '#gh-compare-panel.cmp-visible { display:block !important; }',

    /* ── Header ────────────────────────────────────────────── */
    '#gh-compare-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid rgba(14,165,233,0.15); }',
    '#gh-compare-header h3 { font-size:16px; font-weight:900; letter-spacing:0.5px; margin:0; }',
    '#gh-compare-vs-badge { display:inline-flex; align-items:center; justify-content:center; padding:4px 10px; border-radius:999px; background:linear-gradient(135deg,#0ea5e9,#f59e0b); color:#fff; font-size:11px; font-weight:900; letter-spacing:1px; }',

    /* ── Grid ──────────────────────────────────────────────── */
    '#gh-compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }',
    '@media(max-width:700px){ #gh-compare-grid { grid-template-columns:1fr; } }',

    /* ── Cards ─────────────────────────────────────────────── */
    '.cmp-card { border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); transition:box-shadow 0.2s; }',
    '.cmp-card:hover { box-shadow:0 8px 30px rgba(0,0,0,0.12); }',
    '[data-theme="light"] .cmp-card { background:#ffffff; border:1px solid rgba(0,0,0,0.08); }',
    '[data-theme="dark"]  .cmp-card { background:#0d1117; border:1px solid rgba(255,255,255,0.08); }',
    '.cmp-card-left  { border-top:3px solid #0ea5e9; }',
    '.cmp-card-right { border-top:3px solid #f59e0b; }',

    /* ── Card header ───────────────────────────────────────── */
    '.cmp-card-head { display:flex; align-items:flex-start; gap:14px; padding:18px 18px 12px; }',
    '.cmp-avatar-wrap { position:relative; flex-shrink:0; }',
    '.cmp-avatar { width:58px; height:58px; border-radius:50%; display:block; }',
    '.cmp-avatar-ring-left  { border:3px solid #0ea5e9; }',
    '.cmp-avatar-ring-right { border:3px solid #f59e0b; }',
    '.cmp-name { font-size:15px; font-weight:900; line-height:1.2; margin-top:2px; }',
    '.cmp-login { font-size:12px; margin-top:3px; }',
    '.cmp-login a { text-decoration:none; }',
    '.cmp-login a:hover { text-decoration:underline; }',
    '.cmp-bio { font-size:12px; opacity:0.65; margin-top:5px; line-height:1.5; }',

    /* ── Stat pills ────────────────────────────────────────── */
    '.cmp-stats { display:flex; flex-wrap:wrap; gap:7px; padding:0 14px 14px; }',
    '[data-theme="light"] .cmp-stat { background:#f8fafc; border:1px solid #e2e8f0; }',
    '[data-theme="dark"]  .cmp-stat { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); }',
    '.cmp-stat { display:flex; flex-direction:column; align-items:center; padding:9px 13px; border-radius:10px; min-width:60px; }',
    '.cmp-stat-val { font-size:17px; font-weight:900; line-height:1.1; }',
    '.cmp-stat-lbl { font-size:9.5px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; margin-top:3px; opacity:0.5; }',
    '.cmp-stat-val.cmp-winner { color:#16a34a; }',
    '.cmp-stat-val.cmp-loser  { color:#dc2626; }',
    '[data-theme="light"] .cmp-stat-val { color:#0f172a; }',
    '[data-theme="light"] .cmp-stat-val.cmp-winner { color:#15803d; }',
    '[data-theme="light"] .cmp-stat-val.cmp-loser  { color:#dc2626; }',

    /* ── Section label ─────────────────────────────────────── */
    '[data-theme="light"] .cmp-section-label { color:#64748b; background:#f1f5f9; }',
    '[data-theme="dark"]  .cmp-section-label { color:#94a3b8; background:rgba(255,255,255,0.04); }',
    '.cmp-section-label { font-size:10px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; padding:6px 16px; margin:0; }',

    /* ── Banner ────────────────────────────────────────────── */
    '.cmp-banner { display:flex; align-items:center; justify-content:center; gap:8px; padding:9px 16px; font-size:12px; font-weight:800; border-radius:10px; margin:0 14px 14px; }',
    '.cmp-banner-win  { background:rgba(21,128,61,0.1);  color:#15803d; border:1px solid rgba(21,128,61,0.25); }',
    '.cmp-banner-lose { background:rgba(220,38,38,0.08); color:#dc2626; border:1px solid rgba(220,38,38,0.2); }',
    '.cmp-banner-tie  { background:rgba(14,165,233,0.08); color:#0369a1; border:1px solid rgba(14,165,233,0.25); }',

    /* ── Repo list ─────────────────────────────────────────── */
    '.cmp-repo-list { padding:6px 12px 12px; display:grid; gap:6px; }',
    '[data-theme="light"] .cmp-repo-item { background:#fafafa; border:1px solid #e2e8f0; }',
    '[data-theme="dark"]  .cmp-repo-item { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); }',
    '.cmp-repo-item { padding:9px 11px; border-radius:9px; font-size:12px; }',
    '.cmp-repo-name { font-weight:800; }',
    '.cmp-repo-name a { text-decoration:none; color:inherit; }',
    '.cmp-repo-name a:hover { color:#0ea5e9; }',
    '[data-theme="light"] .cmp-repo-meta { color:#475569; }',
    '.cmp-repo-meta { display:flex; gap:8px; margin-top:4px; font-size:11px; opacity:0.7; }',

    /* ── Activity list ─────────────────────────────────────── */
    '.cmp-activity-list { list-style:none; padding:6px 12px 14px; display:grid; gap:5px; margin:0; }',
    '[data-theme="light"] .cmp-activity-item { background:#fafafa; border:1px solid #e2e8f0; color:#1e293b; }',
    '[data-theme="dark"]  .cmp-activity-item { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); }',
    '.cmp-activity-item { padding:8px 11px; border-radius:9px; font-size:12px; }',
    '[data-theme="light"] .cmp-activity-time { color:#64748b; }',
    '.cmp-activity-time { font-size:11px; margin-top:3px; opacity:0.6; }',

    /* ── Loading ───────────────────────────────────────────── */
    '.cmp-loading { padding:32px 16px; text-align:center; font-size:13px; font-style:italic; opacity:0.45; }',

    /* ── Head-to-head bars container ───────────────────────── */
    '[data-theme="light"] #gh-compare-bars .cmp-h2h-wrap { background:#ffffff; border:1px solid #e2e8f0; box-shadow:0 2px 12px rgba(0,0,0,0.06); }',
    '[data-theme="dark"]  #gh-compare-bars .cmp-h2h-wrap { background:#0d1117; border:1px solid rgba(255,255,255,0.08); box-shadow:0 2px 12px rgba(0,0,0,0.3); }',
    '.cmp-h2h-wrap { border-radius:16px; padding:20px 24px; margin-top:4px; }',
    '.cmp-h2h-title { font-size:11px; font-weight:900; letter-spacing:1.2px; text-transform:uppercase; opacity:0.4; margin-bottom:16px; }',

    /* Legend */
    '.cmp-h2h-legend { display:flex; gap:20px; margin-bottom:20px; }',
    '.cmp-h2h-legend-item { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:700; }',
    '.cmp-h2h-dot { width:13px; height:13px; border-radius:4px; flex-shrink:0; }',

    /* Stat row */
    '.cmp-h2h-row { margin-bottom:18px; }',
    '.cmp-h2h-row:last-child { margin-bottom:0; }',
    '[data-theme="light"] .cmp-h2h-row-label { color:#475569; }',
    '[data-theme="dark"]  .cmp-h2h-row-label { color:#94a3b8; }',
    '.cmp-h2h-row-label { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.7px; margin-bottom:7px; display:flex; justify-content:space-between; align-items:center; }',
    '.cmp-h2h-row-label span { font-size:12px; font-weight:900; letter-spacing:0; text-transform:none; }',
    '[data-theme="light"] .cmp-h2h-row-label span { color:#0f172a; }',
    '[data-theme="dark"]  .cmp-h2h-row-label span { color:#f8fafc; }',

    /* Bar tracks */
    '.cmp-h2h-bars { display:flex; flex-direction:column; gap:5px; }',
    '[data-theme="light"] .cmp-h2h-track { background:#f1f5f9; }',
    '[data-theme="dark"]  .cmp-h2h-track { background:rgba(255,255,255,0.07); }',
    '.cmp-h2h-track { border-radius:999px; height:10px; overflow:hidden; position:relative; }',
    '.cmp-h2h-fill { height:100%; border-radius:999px; width:0%; transition:width 0.7s cubic-bezier(0.4,0,0.2,1); }',
    '.cmp-h2h-fill-left  { background:linear-gradient(90deg,#0ea5e9,#38bdf8); }',
    '.cmp-h2h-fill-right { background:linear-gradient(90deg,#f59e0b,#fbbf24); }',
  ].join('\n');
  document.head.appendChild(s);
}

function injectCompareUI() {
  var form = document.getElementById('github-form');
  if (!form) return;

  injectCompareStyles();

  var isDark      = document.documentElement.getAttribute('data-theme') === 'dark';
  var bgColor     = isDark ? '#0d1117' : '#ffffff';
  var borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  var textColor   = isDark ? '#ffffff' : '#000000';

  // ── Toggle button (sits after the form's existing buttons) ──
  var toggle = document.createElement('button');
  toggle.id = 'gh-compare-toggle';
  toggle.innerHTML = '⇄ Compare Mode';
  form.parentNode.insertBefore(toggle, form.nextSibling);

  // ── Second username input row ──
  var inputRow = document.createElement('div');
  inputRow.id = 'gh-compare-input-row';
  inputRow.innerHTML = [
    '<div>',
    '  <label>Compare with</label>',
    '  <input id="gh-compare-username" type="text" placeholder="e.g. torvalds"',
    '    style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '</div>',
    '<button id="gh-compare-btn">Compare ⇄</button>',
  ].join('');
  form.parentNode.insertBefore(inputRow, toggle.nextSibling);

  // ── Compare results panel (full-width, above the existing grid) ──
  var panel = document.createElement('div');
  panel.id = 'gh-compare-panel';
  panel.innerHTML = [
    '<div id="gh-compare-header">',
    '  <h3>Developer Comparison</h3>',
    '  <div id="gh-compare-vs-badge" class="cmp-vs-badge">VS</div>',
    '</div>',
    '<div id="gh-compare-grid">',
    '  <div id="cmp-left"  class="cmp-card cmp-card-left"><div class="cmp-loading">Enter a username above and click Compare ⇄</div></div>',
    '  <div id="cmp-right" class="cmp-card cmp-card-right"><div class="cmp-loading">—</div></div>',
    '</div>',
  ].join('');

  var grid = document.querySelector('.github-grid');
  if (grid) grid.parentNode.insertBefore(panel, grid);

  // ── Wire toggle ──
  var compareActive = false;
  toggle.addEventListener('click', function() {
    compareActive = !compareActive;
    toggle.classList.toggle('cmp-active', compareActive);
    toggle.innerHTML = compareActive ? '✕ Exit Compare' : '⇄ Compare Mode';
    inputRow.classList.toggle('cmp-visible', compareActive);
    if (!compareActive) {
      panel.classList.remove('cmp-visible');
      cmpData = { left: null, right: null };
    }
  });

  // ── Wire compare button ──
  document.getElementById('gh-compare-btn').addEventListener('click', function() {
    var u1 = (document.getElementById('gh-username').value || '').trim();
    var u2 = (document.getElementById('gh-compare-username').value || '').trim();
    if (!u1) { alert('Please load a primary profile first.'); return; }
    if (!u2) { alert('Please enter a username to compare with.'); return; }
    runComparison(u1, u2);
  });

  // Also allow Enter key in the compare input
  document.getElementById('gh-compare-username').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('gh-compare-btn').click();
  });
}

async function fetchCompareData(username) {
  var user  = await fetchFromGitHub('https://api.github.com/users/' + encodeURIComponent(username));
  var repos = await fetchFromGitHub('https://api.github.com/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=updated');
  var events = await fetchFromGitHub('https://api.github.com/users/' + encodeURIComponent(username) + '/events/public?per_page=30');

  var ownRepos = repos.filter(function(r) { return !r.fork; });
  ownRepos.sort(function(a, b) { return (b.stargazers_count || 0) - (a.stargazers_count || 0); });

  var totalStars = ownRepos.reduce(function(sum, r) { return sum + (r.stargazers_count || 0); }, 0);
  var totalForks = ownRepos.reduce(function(sum, r) { return sum + (r.forks_count || 0); }, 0);

  return { user: user, repos: ownRepos, events: events, totalStars: totalStars, totalForks: totalForks };
}

async function runComparison(u1, u2) {
  var panel = document.getElementById('gh-compare-panel');
  var leftEl  = document.getElementById('cmp-left');
  var rightEl = document.getElementById('cmp-right');

  panel.classList.add('cmp-visible');
  leftEl.innerHTML  = '<div class="cmp-loading">Loading ' + safeHtml(u1) + '…</div>';
  rightEl.innerHTML = '<div class="cmp-loading">Loading ' + safeHtml(u2) + '…</div>';

  // Scroll panel into view
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    var results = await Promise.all([ fetchCompareData(u1), fetchCompareData(u2) ]);
    cmpData.left  = results[0];
    cmpData.right = results[1];
    renderCompareCards(cmpData.left, cmpData.right);
  } catch (err) {
    leftEl.innerHTML  = '<div class="cmp-loading" style="color:#f87171">' + safeHtml(err.message) + '</div>';
    rightEl.innerHTML = '';
  }
}

function renderCompareCards(L, R) {
  var leftEl  = document.getElementById('cmp-left');
  var rightEl = document.getElementById('cmp-right');
  if (!leftEl || !rightEl) return;

  leftEl.innerHTML  = buildCompareCard(L, R, 'left');
  rightEl.innerHTML = buildCompareCard(R, L, 'right');

  // Inject stat bars below the grid
  var existing = document.getElementById('gh-compare-bars');
  if (existing) existing.remove();
  var barsEl = document.createElement('div');
  barsEl.id = 'gh-compare-bars';
  barsEl.style.cssText = 'margin-top:16px;';
  barsEl.innerHTML = buildStatBars(L, R);
  document.getElementById('gh-compare-grid').after(barsEl);

  // Animate bars after paint
  setTimeout(function() {
    document.querySelectorAll('.cmp-h2h-fill[data-pct]').forEach(function(el) {
      el.style.width = el.getAttribute('data-pct') + '%';
    });
  }, 60);
}

function buildCompareCard(mine, theirs, side) {
  var u = mine.user;
  var accentColor = side === 'left' ? '#0ea5e9' : '#f59e0b';

  // Stat comparison: win = green, lose = red
  function statClass(myVal, theirVal) {
    if (myVal > theirVal) return 'cmp-winner';
    if (myVal < theirVal) return 'cmp-loser';
    return '';
  }

  var followers  = u.followers  || 0;
  var repos      = u.public_repos || mine.repos.length;
  var stars      = mine.totalStars;
  var forks      = mine.totalForks;

  var html = '';

  // Avatar + name
  html += '<div class="cmp-card-head">';
  html += '<div class="cmp-avatar-wrap">';
  html += '<img class="cmp-avatar cmp-avatar-ring-' + side + '" src="' + safeHtml(u.avatar_url) + '" alt="' + safeHtml(u.login) + '" />';
  html += '</div>';
  html += '<div style="min-width:0;">';
  html += '<div class="cmp-name">' + safeHtml(u.name || u.login) + '</div>';
  html += '<div class="cmp-login"><a href="https://github.com/' + safeHtml(u.login) + '" target="_blank" rel="noopener" style="color:' + accentColor + '">@' + safeHtml(u.login) + '</a></div>';
  if (u.bio) html += '<div class="cmp-bio">' + safeHtml(u.bio.slice(0, 80)) + (u.bio.length > 80 ? '…' : '') + '</div>';
  html += '</div></div>';

  // Stat pills
  html += '<div class="cmp-stats">';
  var statItems = [
    { val: followers,         lbl: 'Followers', other: theirs.user.followers  || 0 },
    { val: u.following || 0,  lbl: 'Following', other: theirs.user.following  || 0 },
    { val: repos,             lbl: 'Repos',     other: theirs.user.public_repos || theirs.repos.length },
    { val: stars,             lbl: 'Stars',     other: theirs.totalStars },
    { val: forks,             lbl: 'Forks',     other: theirs.totalForks },
  ];
  statItems.forEach(function(s) {
    html += '<div class="cmp-stat">';
    html += '<span class="cmp-stat-val ' + statClass(s.val, s.other) + '">' + fmtNum(s.val) + '</span>';
    html += '<span class="cmp-stat-lbl">' + s.lbl + '</span>';
    html += '</div>';
  });
  html += '</div>';

  // Win/lose banner
  var myScore    = followers + stars * 3 + forks * 2 + repos;
  var theirScore = (theirs.user.followers || 0) + theirs.totalStars * 3 + theirs.totalForks * 2 + (theirs.user.public_repos || theirs.repos.length);
  if (myScore > theirScore) {
    html += '<div class="cmp-banner cmp-banner-win">🏆 Leading overall</div>';
  } else if (myScore < theirScore) {
    html += '<div class="cmp-banner cmp-banner-lose">📉 Trailing overall</div>';
  } else {
    html += '<div class="cmp-banner cmp-banner-tie">🤝 Tied overall</div>';
  }

  // Top repos
  html += '<div class="cmp-section-label">Top Repositories</div>';
  html += '<div class="cmp-repo-list">';
  var topRepos = mine.repos.slice(0, 4);
  if (topRepos.length === 0) {
    html += '<div style="padding:8px 4px;opacity:0.5;font-size:12px;">No public repos</div>';
  } else {
    topRepos.forEach(function(r) {
      html += '<div class="cmp-repo-item">';
      html += '<div class="cmp-repo-name"><a href="' + safeHtml(r.html_url) + '" target="_blank" rel="noopener">' + safeHtml(r.name) + '</a></div>';
      html += '<div class="cmp-repo-meta"><span>★ ' + (r.stargazers_count||0) + '</span><span>⑂ ' + (r.forks_count||0) + '</span>' + (r.language ? '<span>' + safeHtml(r.language) + '</span>' : '') + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Recent activity
  html += '<div class="cmp-section-label">Recent Activity</div>';
  html += '<ul class="cmp-activity-list">';
  var topEvents = mine.events.slice(0, 5);
  if (topEvents.length === 0) {
    html += '<li style="padding:8px 4px;opacity:0.5;font-size:12px;">No recent public activity</li>';
  } else {
    topEvents.forEach(function(ev) {
      html += '<li class="cmp-activity-item">';
      html += '<div>' + safeHtml(describeEvent(ev)) + (ev.repo ? ' in <strong>' + safeHtml(ev.repo.name) + '</strong>' : '') + '</div>';
      html += '<div class="cmp-activity-time">' + timeAgo(ev.created_at) + '</div>';
      html += '</li>';
    });
  }
  html += '</ul>';

  return html;
}

function buildStatBars(L, R) {
  var stats = [
    { lbl: 'Followers', lv: L.user.followers||0,                        rv: R.user.followers||0 },
    { lbl: 'Repos',     lv: L.user.public_repos||L.repos.length,        rv: R.user.public_repos||R.repos.length },
    { lbl: 'Stars',     lv: L.totalStars,                                rv: R.totalStars },
    { lbl: 'Forks',     lv: L.totalForks,                                rv: R.totalForks },
  ];

  var html = '<div class="cmp-h2h-wrap">';

  html += '<div class="cmp-h2h-title">Head-to-Head</div>';

  // Legend
  html += '<div class="cmp-h2h-legend">';
  html += '<div class="cmp-h2h-legend-item"><div class="cmp-h2h-dot" style="background:#0ea5e9"></div>' + safeHtml(L.user.login) + '</div>';
  html += '<div class="cmp-h2h-legend-item"><div class="cmp-h2h-dot" style="background:#f59e0b"></div>' + safeHtml(R.user.login) + '</div>';
  html += '</div>';

  stats.forEach(function(s) {
    var maxVal = Math.max(s.lv, s.rv, 1);
    var lPct   = Math.round((s.lv / maxVal) * 100);
    var rPct   = Math.round((s.rv / maxVal) * 100);
    var winner = s.lv > s.rv ? 'left' : s.rv > s.lv ? 'right' : 'tie';

    html += '<div class="cmp-h2h-row">';
    html += '<div class="cmp-h2h-row-label">';
    html += s.lbl;
    html += '<span>' + fmtNum(s.lv) + ' <span style="opacity:0.35;font-weight:500;font-size:11px;">vs</span> ' + fmtNum(s.rv) + (winner !== 'tie' ? ' ' + (winner === 'left' ? '🔵' : '🟡') : '') + '</span>';
    html += '</div>';
    html += '<div class="cmp-h2h-bars">';
    // Left bar
    html += '<div class="cmp-h2h-track"><div class="cmp-h2h-fill cmp-h2h-fill-left" data-pct="' + lPct + '" style="width:0%"></div></div>';
    // Right bar
    html += '<div class="cmp-h2h-track"><div class="cmp-h2h-fill cmp-h2h-fill-right" data-pct="' + rPct + '" style="width:0%"></div></div>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  return html;
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
  return String(n);
}


// ============================================================
// PART 7 — START EVERYTHING
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('three-canvas');
  if (canvas) { init(); addMouseEffects(); }

  initGithubDashboard();
  initMiniViewer();
  injectCompareUI();
});
/* ==========================================
   XAI OOD Validation Layer
   Fix for Issue #1041
========================================== */

function isOutOfDistribution(input) {

    if (input === null || input === undefined) {
        return true;
    }

    if (typeof input !== "number") {
        return true;
    }

    // Example training distribution bounds
    if (input < 0 || input > 100) {
        return true;
    }

    return false;
}

function generateExplanation(input) {

    if (isOutOfDistribution(input)) {

        return {
            warning:
                "⚠ Input outside training distribution. Explanation may be unreliable.",
            confidence: "low"
        };
    }

    return {
        explanation: "Normal explanation generated.",
        confidence: "high"
    };
}

function runPrediction() {

    // Test value
    const input = 50; // <-- TEST VALUE

    const result = generateExplanation(input);

    const warningBox =
        document.getElementById("xai-warning");

    if (result.warning) {

        console.warn(result.warning);

        if (warningBox) {

            warningBox.style.display = "block";

            warningBox.innerText =
                `${result.warning} (Confidence: ${result.confidence})`;
        }

    } else {

        console.log(result.explanation);

        if (warningBox) {
            warningBox.style.display = "none";
        }
    }
}
