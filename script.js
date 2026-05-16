// ============================================================
// script.js - 3D Background + GitHub Dashboard
//
// This file does two main things:
//   1. Creates the spinning 3D shape in the background
//      using Three.js (a 3D graphics library for the browser)
//   2. Loads GitHub profile data on the GitHub Dashboard page
//
// How to read this file:
//   - PART 1: 3D Background
//   - PART 2: GitHub Dashboard
//   - PART 3: Mini 3D Viewer (small model on github.html)
//   - PART 4: Shared utilities (helper functions used everywhere)
//   - PART 5: Start everything when the page loads
// ============================================================


// ============================================================
// PART 1 — 3D BACKGROUND
// ============================================================

// --- Global variables ---
// Declared here (outside any function) so ALL functions below can use them.
// Think of these as the "shared state" of the 3D scene.

var scene;     // The 3D world — like an empty stage
var camera;    // The virtual eye looking at the scene
var renderer;  // Draws everything onto the HTML canvas
// (no OrbitControls on the background — it was making the page laggy)

var currentMesh;   // The current primitive shape (cube, sphere, etc.)
var currentModel;  // The current loaded 3D model (.glb file)

var autoRotationSpeed = 0.005;  // How fast the shape spins
var isAutoRotating    = true;   // Whether auto-spin is on

// These are used for the subtle parallax effect (scene follows mouse)
var targetOrbitOffset  = { x: 0, y: 0 };  // where we want the camera to aim
var currentOrbitOffset = { x: 0, y: 0 };  // where it currently aims (catches up slowly)

// The camera's "home" position — set once after the model loads.
// The parallax adds a small offset ON TOP of this, so the camera
// never drifts away from where it should be.
var baseCameraPos = { x: 5, y: 5, z: 5 };


// --- Built-in shapes ---
// A collection of functions that each return a Three.js geometry (shape data).
// We pick one of these when we want to show a primitive shape.
var shapes = {
  cube:       function() { return new THREE.BoxGeometry(2, 2, 2); },
  sphere:     function() { return new THREE.SphereGeometry(1.5, 32, 32); },
  torus:      function() { return new THREE.TorusGeometry(1.5, 0.5, 16, 100); },
  cylinder:   function() { return new THREE.CylinderGeometry(1, 1, 2, 32); },
  octahedron: function() { return new THREE.OctahedronGeometry(1.5); }
};


// Set up the entire 3D scene (called once when the page loads)
function init() {
  var canvas    = document.getElementById('three-canvas');
  var container = document.querySelector('.canvas-container');

  // Create the scene (the 3D world — starts empty)
  scene = new THREE.Scene();

  // Create the camera
  // PerspectiveCamera makes things look naturally 3D (farther = smaller)
  var aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);  // position it in front of the scene

  // Create the renderer — this draws the scene onto the canvas element
  renderer = new THREE.WebGLRenderer({
    canvas:    canvas,
    antialias: true,  // smooth edges (anti-aliasing)
    alpha:     true   // transparent background so the white page shows through
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  // Cap at 1.5x pixel ratio — 2x on Retina screens doubles the pixels rendered
  // which makes the background noticeably slower without any visible benefit at 20% opacity
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Shadows are turned off on the background canvas — they're expensive to render
  // and the canvas is at 20% opacity so you wouldn't see them anyway.
  renderer.shadowMap.enabled = false;

  // Make the canvas ignore all mouse/scroll/touch events so they pass through
  // to the page underneath — this is what prevents the page from feeling laggy
  canvas.style.pointerEvents = 'none';

  // Add lights so the shape isn't just a black silhouette
  addLights();

  // Try to load the 3D model file.
  // If it fails to load, fall back to a simple octahedron shape.
  loadModel('assets/models/prism.glb', function() {
    console.log('prism.glb failed, showing octahedron instead');
    createShape('octahedron');
  });

  // Handle the browser window being resized
  window.addEventListener('resize', onWindowResize);

  // Hide the loading spinner after 1 second
  setTimeout(function() {
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }
  }, 1000);

  // Start the animation loop (this runs ~60 times per second)
  animate();
}


// Add light sources to the 3D scene
function addLights() {
  // Ambient light: soft light that hits everything equally (no shadows)
  var ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  // Main directional light: like sunlight coming from one direction (casts shadows)
  var mainLight = new THREE.DirectionalLight(0xffffff, 1);
  mainLight.position.set(10, 10, 5);
  mainLight.castShadow = true;
  scene.add(mainLight);

  // Fill light: a softer light from the opposite side, reduces harsh shadows
  var fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
  fillLight.position.set(-5, 0, -5);
  scene.add(fillLight);

  // Point light: like a lamp, radiates in all directions from one spot
  var pointLight = new THREE.PointLight(0xff9999, 0.5, 50);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
}


// Create a primitive 3D shape and add it to the scene
// shapeType must be one of the keys in the "shapes" object above
function createShape(shapeType) {
  // Remove the old primitive shape if there is one
  if (currentMesh) {
    scene.remove(currentMesh);
    currentMesh.geometry.dispose();  // free GPU memory
    currentMesh.material.dispose();
    currentMesh = null;
  }
  // Also remove any loaded model
  if (currentModel) {
    scene.remove(currentModel);
    disposeModel(currentModel);
    currentModel = null;
  }

  // Get color from a color picker if one exists on this page
  var colorEl = document.getElementById('color-picker');
  var color   = colorEl ? colorEl.value : '#66ccff';

  // Build the shape: geometry = the 3D points, material = the surface appearance
  var geometry = shapes[shapeType]();
  var material = new THREE.MeshPhongMaterial({
    color:       color,
    shininess:   100,
    transparent: true,
    opacity:     0.9
  });

  // A Mesh joins geometry + material into one visible 3D object
  currentMesh = new THREE.Mesh(geometry, material);
  currentMesh.castShadow = true;
  scene.add(currentMesh);
}


// The animation loop — called ~60 times per second by the browser
function animate() {
  // Ask the browser to call this function again next frame
  requestAnimationFrame(animate);

  // Rotate the loaded model around the Y axis
  if (currentModel && isAutoRotating) {
    currentModel.rotation.y += autoRotationSpeed;
  }

  // Rotate the primitive shape on two axes
  if (currentMesh && isAutoRotating) {
    currentMesh.rotation.x += autoRotationSpeed;
    currentMesh.rotation.y += autoRotationSpeed * 1.5;
  }

  // Smooth parallax: gently shift the camera based on mouse position.
  // "currentOrbitOffset" slowly catches up to "targetOrbitOffset" (set by mousemove).
  // We then add that small offset ON TOP of the base camera position —
  // so the camera never drifts far from where it started.
  currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
  currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
  camera.position.x = baseCameraPos.x + currentOrbitOffset.x * 1.5;
  camera.position.y = baseCameraPos.y + currentOrbitOffset.y * 1.0;
  camera.position.z = baseCameraPos.z;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);  // draw the current frame
}


// Update camera and renderer when the window is resized
function onWindowResize() {
  var container = document.querySelector('.canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}


// Load a 3D model from a file URL (e.g. 'assets/models/prism.glb')
// onError is an optional function to call if the load fails
function loadModel(url, onError) {
  var loader = new THREE.GLTFLoader();

  loader.load(
    url,

    // Success: this function runs when the model finishes loading
    function(gltf) {
      // Remove old shape/model if present
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh.geometry.dispose();
        currentMesh.material.dispose();
        currentMesh = null;
      }
      if (currentModel) {
        scene.remove(currentModel);
        disposeModel(currentModel);
      }

      currentModel = gltf.scene;
      prepareModel(currentModel);
      scene.add(currentModel);
      zoomCameraToFit(currentModel);
      console.log('Model loaded:', url);
    },

    undefined,  // progress callback — we don't need to track progress

    // Error: this function runs if the model fails to load
    function(err) {
      console.warn('Model failed to load:', url, err);
      if (onError) onError(err);
    }
  );
}


// Prepare a loaded model: enable shadows and center/scale it in the scene
function prepareModel(model) {
  // Walk through every object inside the model and enable shadows
  model.traverse(function(child) {
    if (child.isMesh) {
      child.castShadow    = true;
      child.receiveShadow = true;
    }
  });

  // Center and scale the model so it fits nicely on screen
  centerAndScaleModel(model, 16);
}


// Center a model at the origin (0,0,0) and scale it to a target size
function centerAndScaleModel(model, targetSize) {
  // A Box3 is an axis-aligned bounding box — it wraps the whole model
  var box    = new THREE.Box3().setFromObject(model);
  var size   = new THREE.Vector3();
  var center = new THREE.Vector3();

  box.getSize(size);      // fills "size" with the model's width/height/depth
  box.getCenter(center);  // fills "center" with the model's center point

  // Move the model so its center is at (0, 0, 0)
  model.position.sub(center);

  // Scale the model so its largest dimension equals targetSize
  var maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) {
    var scale = targetSize / maxDimension;
    model.scale.setScalar(scale);  // scale equally on all axes
  }
}


// Move the camera to a good distance to see the model
function zoomCameraToFit(model) {
  var box  = new THREE.Box3().setFromObject(model);
  var size = new THREE.Vector3();
  box.getSize(size);
  var maxDimension = Math.max(size.x, size.y, size.z);

  // Place camera at a 45-degree angle, far enough to see the whole model
  var distance  = maxDimension * 0.95;
  var direction = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(direction.multiplyScalar(distance));
  camera.fov = 60;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  // Remember this as the "home" position for the parallax effect.
  // The parallax will add small offsets on top of this each frame.
  baseCameraPos.x = camera.position.x;
  baseCameraPos.y = camera.position.y;
  baseCameraPos.z = camera.position.z;
}


// Free the GPU memory used by a 3D model (important to avoid memory leaks)
function disposeModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (var i = 0; i < child.material.length; i++) {
            child.material[i].dispose();
          }
        } else {
          child.material.dispose();
        }
      }
    }
  });
}


// Add mouse-based effects to the background
function addMouseEffects() {
  // Track mouse position for the parallax effect
  window.addEventListener('mousemove', function(event) {
    // Convert mouse position from pixels to a -1 to +1 range
    var normalizedX = (event.clientX / window.innerWidth)  * 2 - 1;
    var normalizedY = (event.clientY / window.innerHeight) * 2 - 1;

    // Subtly shift the camera target toward the mouse position
    targetOrbitOffset.x =  normalizedX * 0.5;
    targetOrbitOffset.y = -normalizedY * 0.3;
  });

  // Adjust the canvas opacity as the user scrolls down
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
  updateOpacity();  // run once on load too
}


// ============================================================
// PART 2 — GITHUB DASHBOARD
// (only active on github.html)
// ============================================================

// Set up the GitHub Dashboard search form
function initGithubDashboard() {
  var form = document.getElementById('github-form');
  if (!form) return;  // we're not on github.html — stop here

  var usernameInput = document.getElementById('gh-username');
  var clearBtn      = document.getElementById('gh-clear');

  // If the user searched before, restore that username automatically
  var savedUsername = localStorage.getItem('xaytheon:ghUsername');
  if (savedUsername) {
    usernameInput.value = savedUsername;
    loadGithubDashboard(savedUsername);
  }

  // When the form is submitted, fetch data for that username
  form.addEventListener('submit', function(event) {
    event.preventDefault();  // prevent the browser from reloading the page

    var username = usernameInput.value.trim();
    if (!username) {
      setGithubStatus('Please enter a GitHub username.', true);
      return;
    }

    localStorage.setItem('xaytheon:ghUsername', username);
    loadGithubDashboard(username);
  });

  // Clear the dashboard when Clear is clicked
  clearBtn.addEventListener('click', function() {
    localStorage.removeItem('xaytheon:ghUsername');
    usernameInput.value = '';

    // Reset all the card fields back to defaults
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

    setGithubStatus('Dashboard cleared.');
  });
}


// Fetch and display GitHub data for a username
// "async" means this function makes network requests and waits for responses
async function loadGithubDashboard(username) {
  setGithubStatus('Loading profile…');

  try {
    // --- Step 1: Load the user's profile ---
    var user = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username)
    );

    var avatarEl = document.getElementById('gh-avatar');
    if (avatarEl) avatarEl.src = user.avatar_url;

    setText('gh-name',      user.name  || '—');
    setText('gh-login',     '@' + user.login);
    setText('gh-bio',       user.bio   || '');
    setText('gh-followers', user.followers || 0);
    setText('gh-following', user.following || 0);

    // --- Step 2: Load repositories ---
    setGithubStatus('Loading repositories…');
    var repos = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/repos?per_page=100&sort=updated'
    );

    setText('gh-repos-count', user.public_repos || repos.length);

    // Filter out forks, sort by stars, show top 8
    var ownRepos = [];
    for (var i = 0; i < repos.length; i++) {
      if (!repos[i].fork) ownRepos.push(repos[i]);
    }
    ownRepos.sort(function(a, b) {
      return (b.stargazers_count || 0) - (a.stargazers_count || 0);
    });
    renderRepos(ownRepos.slice(0, 8));

    // --- Step 3: Load recent activity ---
    setGithubStatus('Loading activity…');
    var events = await fetchFromGitHub(
      'https://api.github.com/users/' + encodeURIComponent(username) +
      '/events/public?per_page=25'
    );
    renderActivity(events.slice(0, 10));

    // --- Step 4: Show contributions chart ---
    showContributionsChart(username, events);

    setGithubStatus('Done');

  } catch (error) {
    setGithubStatus(error.message || 'Failed to load GitHub data', true);
  }
}


// Make a request to the GitHub API and return the parsed JSON
async function fetchFromGitHub(url) {
  var response = await fetch(url, {
    headers: {
      'Accept':     'application/vnd.github+json',
      'User-Agent': 'XAYTHEON-Dashboard'
    }
  });

  if (!response.ok) {
    var errorText = await response.text();
    throw new Error('GitHub API ' + response.status + ': ' + errorText);
  }

  return response.json();  // parse and return the JSON data
}


// Build and display the repository list
function renderRepos(repos) {
  var list = document.getElementById('gh-repo-list');
  if (!list) return;

  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];

    var description = repo.description
      ? '<div class="repo-desc">' + safeHtml(repo.description) + '</div>'
      : '';

    var language = repo.language
      ? '<span>' + safeHtml(repo.language) + '</span>'
      : '';

    html +=
      '<div class="repo-item">' +
        '<div class="repo-name">' +
          '<a href="' + repo.html_url + '" target="_blank" rel="noopener">' +
            safeHtml(repo.full_name) +
          '</a>' +
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


// Build and display the activity list
function renderActivity(events) {
  var list = document.getElementById('gh-activity-list');
  if (!list) return;

  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No recent public activity.</li>';
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
          safeHtml(repoName) + '</a>'
      : '';

    html +=
      '<li class="activity-item">' +
        '<div>' + safeHtml(desc) + repoLink + '</div>' +
        '<div class="activity-time">' + time + '</div>' +
      '</li>';
  }

  list.innerHTML = html;
}


// Turn a GitHub event object into a plain-English description
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


// Show the contributions calendar (green squares chart)
function showContributionsChart(username, events) {
  var container = document.getElementById('gh-contrib-svg');
  var noteEl    = document.getElementById('gh-contrib-note');
  if (!container) return;

  // Show placeholder before anything else so it can't overwrite the result
  container.innerHTML = '<div class="muted">Loading contributions chart…</div>';

  // Try the third-party full-year chart image first
  var chartImg = new Image();
  chartImg.alt              = username + "'s contributions";
  chartImg.style.maxWidth   = '100%';
  chartImg.referrerPolicy   = 'no-referrer';

  // Attach handlers BEFORE setting src to avoid a race condition where a
  // cached image fires onload synchronously before the handler is registered.
  chartImg.onload = function() {
    container.innerHTML = '';
    container.appendChild(chartImg);
    if (noteEl) noteEl.textContent = 'Full-year contribution chart.';
  };

  // If the image fails — build a heatmap from the events we already fetched
  chartImg.onerror = function() {
    var svgHtml = buildHeatmapFromEvents(events);
    container.innerHTML = svgHtml;
    if (noteEl) noteEl.textContent = 'Approximate heatmap based on recent public activity.';
  };

  // Set src last so the browser starts loading only after handlers are in place.
  chartImg.src = 'https://ghchart.rshah.org/' + encodeURIComponent(username);

  // Safety net: if the browser resolved the image from cache synchronously
  // before onload could fire, manually trigger the appropriate handler.
  if (chartImg.complete) {
    if (chartImg.naturalWidth > 0) {
      chartImg.onload();
    } else {
      chartImg.onerror();
    }
  }
}


// Build an SVG heatmap (like the GitHub contribution grid) from events
function buildHeatmapFromEvents(events) {
  if (!events || events.length === 0) {
    return '<div class="muted">No recent public activity.</div>';
  }

  var today    = new Date();
  var daysBack = 90;
  var startDate = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // Count how many events happened on each day
  // dayCounts = { "2025-01-01": 3, "2025-01-02": 0, ... }
  var dayCounts = {};

  // Initialize all days to 0
  for (var d = 0; d <= daysBack; d++) {
    var dayDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    var key = dayDate.toISOString().slice(0, 10);  // "YYYY-MM-DD"
    dayCounts[key] = 0;
  }

  // Count events per day
  for (var i = 0; i < events.length; i++) {
    if (!events[i].created_at) continue;
    var eventDate = new Date(events[i].created_at);
    var key = eventDate.toISOString().slice(0, 10);
    if (dayCounts[key] !== undefined) {
      dayCounts[key]++;
    }
  }

  // Sort the days into an array
  var days = Object.keys(dayCounts).sort();
  if (days.length === 0) return '<div class="muted">No activity data.</div>';

  // Find the max count (for color scaling)
  var maxCount = 1;
  for (var i = 0; i < days.length; i++) {
    if (dayCounts[days[i]] > maxCount) maxCount = dayCounts[days[i]];
  }

  // GitHub-style green color palette: 0 events = light, max events = dark green
  var colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];

  // Calculate grid dimensions
  var cellSize  = 10;
  var gap       = 2;
  var firstDay  = new Date(days[0] + 'T00:00:00Z');
  var startOffset = firstDay.getUTCDay();  // 0 = Sunday
  var totalCells  = days.length + startOffset;
  var numCols     = Math.ceil(totalCells / 7);
  var svgWidth    = numCols * (cellSize + gap) + gap;
  var svgHeight   = 7 * (cellSize + gap) + gap + 20;  // +20 for the label

  // Draw one rectangle per day
  var rects = '';
  for (var col = 0; col < numCols; col++) {
    for (var row = 0; row < 7; row++) {
      var dayIndex = col * 7 + row - startOffset;
      if (dayIndex < 0 || dayIndex >= days.length) continue;

      var day      = days[dayIndex];
      var count    = dayCounts[day] || 0;
      var colorIdx = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
      var color    = colors[colorIdx];
      var x        = gap + col * (cellSize + gap);
      var y        = gap + row * (cellSize + gap);

      rects +=
        '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '"' +
        ' rx="2" fill="' + color + '">' +
          '<title>' + day + ': ' + count + ' event(s)</title>' +
        '</rect>';
    }
  }

  var label =
    '<text x="' + gap + '" y="' + (svgHeight - 4) + '"' +
    ' font-size="10" fill="#666">Last ' + daysBack + ' days (approx.)</text>';

  return '<svg width="' + svgWidth + '" height="' + svgHeight + '"' +
         ' viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '"' +
         ' xmlns="http://www.w3.org/2000/svg">' +
           rects + label +
         '</svg>';
}


// ============================================================
// PART 3 — MINI 3D VIEWER
// (the small spinning model in the corner on github.html)
// ============================================================

function initMiniViewer() {
  var canvas = document.getElementById('mini-3d-canvas');
  if (!canvas) return;  // not on github.html — stop here

  // Make sure Three.js and the GLTF loader are available
  if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
    var loadingEl = canvas.parentElement.querySelector('.mini-3d-loading');
    if (loadingEl) loadingEl.textContent = '3D unavailable';
    return;
  }

  var container = canvas.parentElement;
  var loadingEl = container.querySelector('.mini-3d-loading');

  // Create a separate mini scene for this viewer
  var miniScene    = new THREE.Scene();
  var miniCamera   = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  var miniRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  miniRenderer.setClearColor(0x000000, 0);  // transparent background

  miniCamera.position.set(2.2, 1.8, 2.2);
  miniCamera.lookAt(0, 0, 0);

  // Resize helper
  function resizeMini() {
    var w = container.clientWidth;
    var h = container.clientHeight;
    miniRenderer.setSize(w, h);
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
  }
  resizeMini();
  window.addEventListener('resize', resizeMini);

  // Add lights to the mini scene
  miniScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(3, 5, 2);
  miniScene.add(dirLight);

  // Load the model
  var loader = new THREE.GLTFLoader();
  loader.load(
    'assets/models/github.glb',

    function(gltf) {  // success
      var model = gltf.scene;
      centerAndScaleModel(model, 3.0);

      // Use a pivot so the model rotates around its own center
      var pivot = new THREE.Object3D();
      miniScene.add(pivot);
      pivot.add(model);

      if (loadingEl) loadingEl.style.display = 'none';

      // Position camera based on model size
      var box  = new THREE.Box3().setFromObject(model);
      var size = new THREE.Vector3();
      box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z) || 1;
      var dist   = maxDim * 1.8;
      miniCamera.position.set(dist, dist * 0.8, dist);
      miniCamera.lookAt(0, 0, 0);

      // Mini animation loop
      function animateMini() {
        requestAnimationFrame(animateMini);
        pivot.rotation.y += 0.012;  // spin around Y axis
        miniRenderer.render(miniScene, miniCamera);
      }
      animateMini();
    },

    undefined,  // no progress callback needed

    function(err) {  // error
      console.warn('Mini viewer: model failed to load', err);
      if (loadingEl) loadingEl.textContent = '3D not found';
    }
  );
}


// ============================================================
// PART 4 — SHARED UTILITY FUNCTIONS
// ============================================================

// Make text safe to put inside HTML (prevents XSS injection attacks)
// e.g. "<script>" becomes "&lt;script&gt;" which the browser shows as text, not code
function safeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Set the text content of an element by its id
function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Set the inner HTML of an element by its id
function setHtml(id, value) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

// Show a status message on the GitHub Dashboard
function setGithubStatus(message, isError) {
  var el = document.getElementById('github-status');
  if (!el) return;
  el.textContent  = message;
  el.style.color  = isError ? '#b91c1c' : '#111827';
}

// Convert a date string to "X days ago" format
// e.g. "2025-01-01T00:00:00Z" -> "3 days ago"
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
// PART 5 — START EVERYTHING WHEN THE PAGE IS READY
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // Start the 3D background if there's a canvas on this page
  var canvas = document.getElementById('three-canvas');
  if (canvas) {
    init();
    addMouseEffects();
  }

  // Set up the GitHub Dashboard if we're on github.html
  initGithubDashboard();

  // Set up the mini 3D viewer if we're on github.html
  initMiniViewer();

});
