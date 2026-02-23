// ===================== ERROR SYSTEM INIT =====================
import ErrorHandler from "./errorHandler.js";

ErrorHandler.configure({
  environment: "development",
});

ErrorHandler.attachGlobalListeners();

// ===================== SAFE FETCH ABSTRACTION =====================
async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} - ${response.statusText}`);
      error.status = response.status;
      throw error;
    }
    return response;
  } catch (err) {
    ErrorHandler.handle(err, {
      source: "safeFetch",
      url,
      options,
    });
    throw err;
  }
}

// ===================== API REQUEST DEDUPLICATION =====================
const IN_FLIGHT_REQUESTS = new Map();

// ===================== GLOBAL VARIABLES =====================
let scene, camera, renderer, controls;
let currentMesh;
let currentModel;
let autoRotationSpeed = 0.01;
let isAutoRotating = true;
let parallaxEnabled = true;
let targetOrbitOffset = { x: 0, y: 0 };
let currentOrbitOffset = { x: 0, y: 0 };
// Lifecycle flags and handles
let _isInitialized = false; // ensure init runs once
let _listenersAttached = false; // ensure listeners attach once
let _interactiveAttached = false; // ensure interactive effects attach once
let _animationId = null;
let _lastRaycast = 0; // timestamp for throttlin raycast
const RAYCAST_MIN_INTERVAL = 60;
let lastCanvasRect = null;
let lastCursorState = "default";

// ===================== SHAPES =====================
const shapes = {
  cube: () => new THREE.BoxGeometry(2, 2, 2),
  sphere: () => new THREE.SphereGeometry(1.5, 32, 32),
  torus: () => new THREE.TorusGeometry(1.5, 0.5, 16, 100),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
  octahedron: () => new THREE.OctahedronGeometry(1.5),
};

// ===================== INIT =====================
function init() {
  const canvas = document.getElementById("three-canvas");
  const container = document.querySelector(".canvas-container");

  scene = new THREE.Scene();

  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0); // keep transparent

  setupLighting();

  const modelPath =
    canvas?.dataset.model || "assets/models/prism.glb";
  loadGltfFromUrl(modelPath, undefined, safeCreatePrimitiveFallback);

  setupControls();
  setupEventListeners();

  setTimeout(() => {
    document.getElementById("loading-screen")?.classList.add("hidden");
  }, 1000);

  animate();
}

// ===================== LIGHTING =====================
function setupLighting() {
  scene.add(new THREE.AmbientLight(0x404040, 0.6));

  const d = new THREE.DirectionalLight(0xffffff, 1);
  d.position.set(10, 10, 5);
  d.castShadow = true;
  scene.add(d);
}

// ===================== CONTROLS =====================
function setupControls() {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
}

// ===================== ANIMATION =====================
function animate() {
  requestAnimationFrame(animate);

  if (currentMesh && isAutoRotating) {
    currentMesh.rotation.y += autoRotationSpeed;
  }

  if (currentModel && isAutoRotating) {
    currentModel.rotation.y += autoRotationSpeed;
  }

  controls.update();
  renderer.render(scene, camera);
}

// ===================== MODEL LOADING =====================
function loadGltfFromUrl(url, onDone, onError) {
  const loader = new THREE.GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (currentModel) disposeObject(currentModel);
      currentModel = gltf.scene;
      scene.add(currentModel);
      if (onDone) onDone();
    },
    undefined,
    onError
  );
}

function safeCreatePrimitiveFallback() {
  createShape("octahedron");
}

// ===================== SHAPES =====================
function createShape(type) {
  if (currentMesh) disposeObject(currentMesh);
  const mat = new THREE.MeshPhongMaterial({ color: "#66ccff" });
  currentMesh = new THREE.Mesh(shapes[type](), mat);
  scene.add(currentMesh);
}

// ===================== UTIL =====================
function disposeObject(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.geometry?.dispose();
      c.material?.dispose();
    }
  });
  scene.remove(obj);
}

// ===================== THEME =====================
function saveTheme(theme) {
  try {
    localStorage.setItem("xaytheon:theme", theme);

    // Sync with backend if logged in
    if (window.XAYTHEON_AUTH && window.XAYTHEON_AUTH.isAuthenticated()) {
      window.XAYTHEON_AUTH.savePreferences({ theme });
    }
  } catch (e) {
    console.warn("Could not save theme:", e);
  }
}

// ===================== GITHUB API =====================
async function ghJson(url, headers = {}) {
  const key = `GET:${url}`;

  if (IN_FLIGHT_REQUESTS.has(key)) {
    return IN_FLIGHT_REQUESTS.get(key);
  }

  const promise = (async () => {
    const res = await safeFetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "XAYTHEON",
        ...headers,
      },
    });

    // Extract Rate Limit Headers
    const limit = res.headers.get("X-RateLimit-Limit");
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (limit && remaining) {
      updateRateLimitUI(remaining, limit);
    }

    // Check for rate limiting
    if (res.status === 403 || res.status === 429) {
      const resetTime = res.headers.get("X-RateLimit-Reset");
      const remainingVal = res.headers.get("X-RateLimit-Remaining");
      if (remainingVal === "0" || res.status === 429) {
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        const waitTime = resetDate ? Math.ceil((resetDate - Date.now()) / 60000) : "unknown";
        throw new Error(`⚠️ GitHub API rate limit exceeded. Retry in ${waitTime} minutes.`);
      }
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }

    return res.json();
  })();

  IN_FLIGHT_REQUESTS.set(key, promise);
  return promise;
}

function updateRateLimitUI(remaining, limit) {
  const badge = document.getElementById("gh-rate-limit-badge");
  const remEl = document.getElementById("gh-rate-remaining");
  const limEl = document.getElementById("gh-rate-limit");

  if (badge && remEl && limEl) {
    badge.style.display = "inline-block";
    remEl.textContent = remaining;
    limEl.textContent = limit;

    if (parseInt(remaining) < 5) {
      badge.style.background = "rgba(239, 68, 68, 0.15)";
      badge.style.color = "#ef4444";
    } else {
      badge.style.background = "rgba(99, 102, 241, 0.1)";
      badge.style.color = "#6366f1";
    }
  }
}

function renderRepos(repos) {
  const list = document.getElementById("gh-repo-list");
  if (!list) return;
  if (!repos || repos.length === 0) {
    list.innerHTML = '<div class="muted">No repositories found.</div>';
    return;
  }
  list.innerHTML = repos
    .map((r) => {
      const safeRepo = JSON.stringify({
        full_name: r.full_name,
        language: r.language,
        html_url: r.html_url
      }).replace(/"/g, "&quot;");

      const isFavorited = window.favoritesManager && window.favoritesManager.isFavorited(r.id);
      const starIcon = isFavorited ? '⭐' : '☆';

      return `
        <div class="repo-item">
            <div class="repo-name">
              <a href="${r.html_url}" target="_blank" rel="noopener" onclick='trackRepoView(${safeRepo})'>${escapeHtml(r.full_name)}</a>
              <button class="favorite-btn" data-repo-id="${r.id}" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}" style="background:none;border:none;font-size:18px;cursor:pointer;margin-left:8px;vertical-align:middle;">
                ${starIcon}
              </button>
            </div>
            ${r.description ? `<div class="repo-desc">${escapeHtml(r.description)}</div>` : ""}
            <div class="repo-meta">
                <span>★ ${r.stargazers_count || 0}</span>
                <span>⑂ ${r.forks_count || 0}</span>
                ${r.language ? `<span>${r.language}</span>` : ""}
                <span>Updated ${timeAgo(r.updated_at)}</span>
                <span><a href="health.html?repo=${r.full_name}" style="text-decoration:none; color:inherit;" title="Check Sustainability">🩺 Health</a></span>
            </div>
        </div>
    `;
    })
    .join("");

  // Add event listeners to favorite buttons
  if (window.favoritesManager) {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const repoId = btn.getAttribute('data-repo-id');
        const repo = repos.find(r => r.id == repoId);

        if (!repo) return;

        if (window.favoritesManager.isFavorited(repo.id)) {
          window.favoritesManager.removeFavorite(repo.id);
          btn.textContent = '☆';
          btn.title = 'Add to favorites';
        } else {
          window.favoritesManager.addFavorite({
            id: repo.id,
            name: repo.name,
            owner: repo.owner?.login || 'Unknown',
            url: repo.html_url,
            description: repo.description,
            stars: repo.stargazers_count,
            language: repo.language
          });
          btn.textContent = '⭐';
          btn.title = 'Remove from favorites';
        }
      });
    });
  }
}

function renderActivity(events) {
  const list = document.getElementById("gh-activity-list");
  if (!list) return;
  if (!events || events.length === 0) {
    list.innerHTML = '<li class="activity-item muted">No recent public activity.</li>';
    return;
  }
  list.innerHTML = events
    .map((ev) => {
      const type = ev.type || "Event";
      const repo = ev.repo?.name || "";
      const when = timeAgo(ev.created_at);
      const what = describeEvent(ev);
      return `<li class="activity-item"><div>${escapeHtml(what || type)}${repo ? ` in <a href="https://github.com/${repo}" target="_blank" rel="noopener">${escapeHtml(repo)}</a>` : ""}</div><div class="activity-time">${when}</div></li>`;
    })
    .join("");
}

function describeEvent(ev) {
  switch (ev.type) {
    case "PushEvent":
      return `Pushed ${ev.payload?.commits?.length || 0} commit(s)`;
    case "CreateEvent":
      return `Created ${ev.payload?.ref_type || "item"} ${ev.payload?.ref || ""}`;
    case "IssuesEvent":
      return `Issue ${ev.payload?.action} #${ev.payload?.issue?.number}`;
    case "PullRequestEvent":
      return `Pull request ${ev.payload?.action} #${ev.payload?.pull_request?.number}`;
    case "WatchEvent":
      return `Starred`;
    case "ForkEvent":
      return `Forked`;
    default:
      return ev.type;
  }
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  const units = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(
    /[&<>"']/g,
    (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s])
  );
}

async function fetchContributionSvg(username, token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays { color contributionCount date }
            }
            colors
            totalContributions
          }
        }
      }
    }`;
  const res = await safeFetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || `GraphQL error ${res.status}`);
  }
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const cell = 10, gap = 2;
  const rows = 7, cols = cal.weeks.length;
  const width = cols * (cell + gap) + gap;
  const height = rows * (cell + gap) + gap + 20;
  let rects = "";
  cal.weeks.forEach((w, x) => {
    w.contributionDays.forEach((d, y) => {
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${d.color || "#ebedf0"}"><title>${d.date}: ${d.contributionCount} contributions</title></rect>`;
    });
  });
  const label = `<text x="${gap}" y="${height - 4}" font-size="10" fill="#666">Total: ${cal.totalContributions}</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

function renderEventHeatmap(events) {
  if (!Array.isArray(events) || events.length === 0)
    return '<div class="muted">No recent public activity.</div>';

  const today = new Date();
  const daysBack = 90;
  const start = new Date(today.getTime() - daysBack * 24 * 3600 * 1000);

  const toKey = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
  const counts = new Map();

  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
    counts.set(toKey(new Date(d.toISOString())), 0);
  }

  for (const ev of events) {
    if (!ev.created_at) continue;
    const d = new Date(ev.created_at);
    if (d < start || d > today) continue;
    const k = toKey(new Date(d.toISOString()));
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const cell = 10, gap = 2;
  const dates = Array.from(counts.keys()).sort();
  if (dates.length === 0) return '<div class="muted">No recent public activity.</div>';

  const firstDate = new Date(dates[0] + "T00:00:00Z");
  const offset = firstDate.getUTCDay();
  const totalDays = dates.length + offset;
  const cols = Math.ceil(totalDays / 7);

  const values = dates.map((d) => counts.get(d) || 0);
  const max = Math.max(1, ...values);
  const colors = ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"];
  const colorFor = (v) => {
    if (v <= 0) return colors[0];
    const idx = Math.min(4, Math.ceil((v / max) * 4));
    return colors[idx];
  };

  const width = cols * (cell + gap) + gap;
  const height = 7 * (cell + gap) + gap + 20;
  let rects = "";

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 7; y++) {
      const dayIndex = x * 7 + y - offset;
      if (dayIndex < 0 || dayIndex >= dates.length) continue;
      const d = dates[dayIndex];
      const v = counts.get(d) || 0;
      const cx = gap + x * (cell + gap);
      const cy = gap + y * (cell + gap);
      rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${colorFor(v)}"><title>${d}: ${v} event(s)</title></rect>`;
    }
  }
  const label = `<text x="${gap}" y="${height - 4}" font-size="10" fill="#666">Approx. last ${daysBack} days</text>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// ===================== Mini 3D viewer (github.html) =====================
function initMiniViewer() {
  const canvas = document.getElementById("mini-3d-canvas");
  if (!canvas) return;
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    const loadingEl = canvas.parentElement?.querySelector(".mini-3d-loading");
    if (loadingEl) loadingEl.textContent = "3D unavailable";
    return;
  }

  const container = canvas.parentElement;
  const loadingEl = container?.querySelector(".mini-3d-loading");

  const miniRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  miniRenderer.setClearColor(0x000000, 0);
  const miniScene = new THREE.Scene();
  const miniCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  miniCamera.position.set(2.2, 1.8, 2.2);
  miniCamera.lookAt(0, 0, 0);

  // size helper
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    miniRenderer.setSize(w, h);
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Lighting
  miniScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 2);
  miniScene.add(dir);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-2, 1, -2);
  miniScene.add(fill);

  // Load model
  const loader = new THREE.GLTFLoader();
  loader.load(
    "assets/models/github.glb",
    (gltf) => {
      const model = gltf.scene;
      // Normalize size and center at origin
      centerAndScale(model, 3.0);
      // Ensure visibility: if materials are transparent or very dark, replace with a neutral white standard material
      model.traverse((child) => {
        if (child.isMesh) {
          const m = child.material;
          const needsReplace = !m || (m.transparent && (m.opacity == null || m.opacity < 0.2));
          if (needsReplace) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              metalness: 0.1,
              roughness: 0.7,
            });
          }
        }
      });

      // Create a pivot at origin so rotation is about a fixed axis
      const pivot = new THREE.Object3D();
      scene.add(pivot);
      pivot.add(model);

      // Extra centering pass to be safe
      const box = new THREE.Box3().setFromObject(model);
      const c = new THREE.Vector3();
      box.getCenter(c);
      model.position.sub(c); // ensure model mass center is at pivot

      if (loadingEl) loadingEl.style.display = "none";

      // Axis rotation (change axis vector as needed)
      const axis = new THREE.Vector3(0, 1, 0).normalize(); // Y-axis spin
      const speed = 0.012;

      function animate() {
        requestAnimationFrame(animate);
        pivot.rotateOnAxis(axis, speed);
        renderer.render(scene, camera);
      }
      // Reframe camera lightly to model bounds in the mini viewer
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.8;
      camera.position.set(dist, dist * 0.8, dist);
      camera.lookAt(0, 0, 0);
      animate();
    },
    undefined,
    (err) => {
      console.warn("Mini viewer model load failed:", err);
      if (loadingEl) loadingEl.textContent = "3D failed to load";
    }
  );
}

const dots = document.querySelectorAll(".cursor-dot");

const historyLength = dots.length;
const mouseHistory = Array.from({ length: historyLength }, () => ({
  x: 0,
  y: 0,
}));

let mouseX = 0;
let mouseY = 0;

// Current visual positions (for smoothing)
const visualPositions = Array.from({ length: historyLength }, () => ({
  x: 0,
  y: 0,
}));

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursorTrail() {
  // Add current mouse position to history
  mouseHistory.unshift({ x: mouseX, y: mouseY });
  mouseHistory.pop();

  dots.forEach((dot, index) => {
    const target = mouseHistory[index];
    const current = visualPositions[index];

    // Smooth easing (THIS controls speed)
    current.x += (target.x - current.x) * 0.18;
    current.y += (target.y - current.y) * 0.18;

    dot.style.left = current.x + "px";
    dot.style.top = current.y + "px";
  });

  requestAnimationFrame(animateCursorTrail);
}

animateCursorTrail();

//navbar
const menuIcon = document.querySelector(".menu-icon");
const menuCloseIcon = document.querySelector(".menu-close-icon");
const navMenu = document.querySelector(".nav-menu");

if (menuIcon && menuCloseIcon && navMenu) {
  menuIcon.addEventListener("click", () => {
    navMenu.classList.add("active");
    menuIcon.style.display = "none";
    menuCloseIcon.style.display = "block";
  });

  menuCloseIcon.addEventListener("click", () => {
    navMenu.classList.remove("active");
    menuIcon.style.display = "block";
    menuCloseIcon.style.display = "none";
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 890) {
      navMenu.classList.remove("active");
      menuIcon.style.display = "none";
      menuCloseIcon.style.display = "none";
    } else if (!navMenu.classList.contains("active")) {
      menuIcon.style.display = "block";
    }
  });
}



// ===================== Recommendation Engine =====================

const HISTORY_KEY = "xaytheon:view_history";
const SEARCH_HISTORY_KEY = "xaytheon:search_history";

// Track a repository view
window.trackRepoView = async function (repo) {
  try {
    let history = [];

    const isAuthed = window.XAYTHEON_AUTH?.isAuthenticated?.();

    // Try backend fetch first
    if (isAuthed) {
      try {
        const res = await safeFetch(
          `${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.XAYTHEON_AUTH.getToken()}`
            },
          }
        );
        history = await res.json();
      } catch (e) {
        console.warn("Failed to fetch fresh history", e);
      }
    }

    // Fallback to localStorage
    if (!history || history.length === 0) {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    }

    // Move repo to top
    const filtered = history.filter(h => h.full_name !== repo.full_name);
    filtered.unshift({
      full_name: repo.full_name,
      language: repo.language,
      html_url: repo.html_url,
      visited_at: Date.now()
    });

    // Limit history
    if (filtered.length > 50) filtered.length = 50;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));

    // Save to backend if authenticated
    if (isAuthed) {
      try {
        await safeFetch(
          `${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${window.XAYTHEON_AUTH.getToken()}`
            },
            body: JSON.stringify({ history: filtered })
          }
        );
      } catch (e) {
        console.warn("Failed to sync history to backend", e);
      }

      // Refresh recommendations
      initRecommendations();
    }

  } catch (e) {
    console.warn("Tracking failed", e);
    ErrorHandler.handle(e, { source: "trackRepoView", repo });
  }
};

// Initialize Recommendations

async function initRecommendations() {
  const recArea = document.getElementById("recommendations-area");
  const emptyArea = document.getElementById("rec-empty");
  const list = document.getElementById("rec-list");

  if (!recArea || !list) return;

  if (!window.XAYTHEON_AUTH?.isAuthenticated?.()) {
    recArea.classList.add("hidden");
    emptyArea?.classList.add("hidden");
    document.querySelector("[data-requires-auth]")?.style.display = "none";
    return;
  } else {
    document.querySelector("[data-requires-auth]")?.style.display = "block";
  }

  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  // Fetch backend history via ghJson and merge
  try {
    const remoteHistory = await ghJson(
      `${window.location.protocol === "https:" ? "https://your-api-domain.com/api/user" : "http://localhost:5000/api/user"}/history`,
      { Authorization: `Bearer ${window.XAYTHEON_AUTH.getToken()}` }
    );

    const map = new Map();
    remoteHistory?.forEach(h => map.set(h.full_name, h));
    history.forEach(h => { if (!map.has(h.full_name)) map.set(h.full_name, h); });
    history = Array.from(map.values()).sort((a,b) => (b.visited_at||0) - (a.visited_at||0)).slice(0,50);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn("Could not fetch remote history, falling back to local", e);
    ErrorHandler.handle(e, { source: "initRecommendations" });
  }

  // Analyze clicks + search
  const languages = {}, topics = {};
  const searchHistory = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");

  history.forEach(h => { if(h.language) languages[h.language] = (languages[h.language]||0)+2; });
  searchHistory.forEach(s => { if(s.language) languages[s.language] = (languages[s.language]||0)+1; if(s.topic) topics[s.topic] = (topics[s.topic]||0)+1; });

  const topLangs = Object.entries(languages).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
  const topTopics = Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);

  let q = topLangs.length+topTopics.length === 0 ? "stars:>1000" : [...topLangs.map(l=>`language:${l}`), ...topTopics.map(t=>`topic:${t}`)].join(" ");

  recArea.classList.remove("hidden");
  emptyArea?.classList.add("hidden");

  try {
    const encodedQ = encodeURIComponent(q);
    const url = `https://api.github.com/search/repositories?q=${encodedQ}&sort=stars&order=desc&per_page=20`;

    const data = await ghJson(url);

    const viewedNames = new Set(history.map(h=>h.full_name));
    const recommendations = (data.items||[]).filter(r=>!viewedNames.has(r.full_name)).slice(0,6);

    if (recommendations.length === 0 && q !== "stars:>500") {
      const fallbackUrl = `https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=10`;
      const fallbackData = await ghJson(fallbackUrl);
      renderRecommendationCards(fallbackData.items.slice(0,6));
      return;
    }

    if(recommendations.length===0){
      renderRecommendationCards([
        { full_name:"facebook/react", name:"react", description:"Fallback", language:"JavaScript", stargazers_count:200000, owner:{login:"facebook"}, html_url:"https://github.com/facebook/react"},
        { full_name:"vuejs/vue", name:"vue", description:"Fallback", language:"JavaScript", stargazers_count:180000, owner:{login:"vuejs"}, html_url:"https://github.com/vuejs/vue"}
      ]);
      return;
    }

    renderRecommendationCards(recommendations);

  } catch (e) {
    console.error("Recommendations failed", e);
    ErrorHandler.handle(e, { source: "initRecommendations" });
    renderRecommendationCards([
      { full_name:"facebook/react", name:"react", description:"Fallback Error", language:"JavaScript", stargazers_count:200000, owner:{login:"facebook"}, html_url:"https://github.com/facebook/react"},
      { full_name:"vuejs/vue", name:"vue", description:"Fallback Error", language:"JavaScript", stargazers_count:180000, owner:{login:"vuejs"}, html_url:"https://github.com/vuejs/vue"}
    ]);
  }
}

  renderRecommendationCards(recommendations);

} catch (e) {
  console.error("Recommendations failed", e);
  ErrorHandler.handle(e, { source: "initRecommendations" });
  renderRecommendationCards([
    { full_name:"facebook/react", name:"react", description:"Fallback Error", language:"JavaScript", stargazers_count:200000, owner:{login:"facebook"}, html_url:"https://github.com/facebook/react"},
    { full_name:"vuejs/vue", name:"vue", description:"Fallback Error", language:"JavaScript", stargazers_count:180000, owner:{login:"vuejs"}, html_url:"https://github.com/vuejs/vue"}
  ]);
}

  renderRecommendationCards(recommendations);

} catch (e) {
  console.error("Recommendations failed", e);
  ErrorHandler.handle(e, { source: "initRecommendations" });
  renderRecommendationCards([
    { full_name:"facebook/react", name:"react", description:"Fallback Error", language:"JavaScript", stargazers_count:200000, owner:{login:"facebook"}, html_url:"https://github.com/facebook/react"},
    { full_name:"vuejs/vue", name:"vue", description:"Fallback Error", language:"JavaScript", stargazers_count:180000, owner:{login:"vuejs"}, html_url:"https://github.com/vuejs/vue"}
  ]);
}
    renderRecommendationCards(recommendations);

  } catch (e) {
    console.error("Recommendations failed", e);
    ErrorHandler.handle(e, { source: "initRecommendations" });
    renderRecommendationCards([
      { full_name:"facebook/react", name:"react", description:"Fallback Error", language:"JavaScript", stargazers_count:200000, owner:{login:"facebook"}, html_url:"https://github.com/facebook/react"},
      { full_name:"vuejs/vue", name:"vue", description:"Fallback Error", language:"JavaScript", stargazers_count:180000, owner:{login:"vuejs"}, html_url:"https://github.com/vuejs/vue"}
    ]);
  }
}

// Track a search interest safely
window.trackSearchInterest = function(topic, language){
  if(!topic && !language) return;
  let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)||"[]");
  history.unshift({ topic: topic||"", language: language||"", ts: Date.now() });
  if(history.length>20) history.length=20;
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
};

  // Analyze history (clicks)
  const languages = {};
  const topics = {};

  history.forEach(h => {
    if (h.language) languages[h.language] = (languages[h.language] || 0) + 2; // Weight clicks higher
    // We don't strictly track topics in repo view history yet, but we could if we stored them.
  });

  // Analyze search history
  const searchHistory = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  searchHistory.forEach(s => {
    if (s.language) languages[s.language] = (languages[s.language] || 0) + 1;
    if (s.topic) topics[s.topic] = (topics[s.topic] || 0) + 1;
  });

  const topLangs = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  const topTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  // Fallback query if no data
  let q = "";
  if (topLangs.length === 0 && topTopics.length === 0) {
    q = "stars:>1000";
    recArea.classList.remove("hidden");
    if (emptyArea) emptyArea.classList.add("hidden");
  } else {
    // Build complex query
    const parts = [];
    topLangs.forEach(l => parts.push(`language:${l}`));
    topTopics.forEach(t => parts.push(`topic:${t}`));
    q = parts.join(" ");
  }

  // Fetch recommendations
  recArea.classList.remove("hidden");
  emptyArea.classList.add("hidden");

  if (!list.hasChildNodes() || list.innerText.includes("Loading")) {
    list.innerHTML = '<div class="muted">Loading personal recommendations...</div>';
  }

  try {
    const encodedQ = encodeURIComponent(q);
    const url = `https://api.github.com/search/repositories?q=${encodedQ}&sort=stars&order=desc&per_page=20`;

    const data = await ghJson(url);

    // Client side filter
    const viewedNames = new Set(history.map(h => h.full_name));
    const recommendations = (data.items || [])
      .filter(r => !viewedNames.has(r.full_name))
      .slice(0, 6);

    if (recommendations.length === 0) {
      // Retry with broader query if specific failed
      if (q !== "stars:>500") {
        const fallbackUrl = `https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=10`;
        const fallbackData = await ghJson(fallbackUrl);
        if (fallbackData && fallbackData.items) {
          renderRecommendationCards(fallbackData.items.slice(0, 6));
          return;
        }
      }

      // HARD FALLBACK
      const hardcoded = [
        { full_name: "facebook/react", name: "react", description: "Hardcoded Fallback 1", language: "JavaScript", stargazers_count: 200000, owner: { login: "facebook" }, html_url: "https://github.com/facebook/react" },
        { full_name: "vuejs/vue", name: "vue", description: "Hardcoded Fallback 2", language: "JavaScript", stargazers_count: 180000, owner: { login: "vuejs" }, html_url: "https://github.com/vuejs/vue" }
      ];
      renderRecommendationCards(hardcoded);
      return;
    }

    renderRecommendationCards(recommendations);

  } catch (e) {
    console.error("Recs failed", e);
    // HARD FALLBACK on error
    const hardcoded = [
      { full_name: "facebook/react", name: "react", description: "Error Fallback 1", language: "JavaScript", stargazers_count: 200000, owner: { login: "facebook" }, html_url: "https://github.com/facebook/react" },
      { full_name: "vuejs/vue", name: "vue", description: "Error Fallback 2", language: "JavaScript", stargazers_count: 180000, owner: { login: "vuejs" }, html_url: "https://github.com/vuejs/vue" }
    ];
    renderRecommendationCards(hardcoded);
  }
}

function renderRecommendationCards(repos) {
  const list = document.getElementById("rec-list");
  if (!list) return;

  list.innerHTML = ""; // clear existing cards

  repos.forEach(r => {
    const card = document.createElement("div");
    card.className = "card repo-card";

    const repoName = document.createElement("a");
    repoName.href = r.html_url;
    repoName.target = "_blank";
    repoName.textContent = r.name;
    repoName.addEventListener("click", () => trackRepoView(r));

    const header = document.createElement("div");
    header.className = "repo-header";
    header.innerHTML = `<span class="repo-lang">${r.language || ''}</span>`;
    header.prepend(repoName);

    const desc = document.createElement("div");
    desc.className = "repo-desc";
    desc.textContent = r.description || 'No description';

    const meta = document.createElement("div");
    meta.className = "repo-meta";
    meta.innerHTML = `<span>★ ${r.stargazers_count}</span> <span class="repo-owner">by ${r.owner.login}</span>`;

    card.append(header, desc, meta);
    list.appendChild(card);
  });
}

// Example usage with fetch
function fetchRepos(key) {
  const promise = safeFetch(url, {
  headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": "XAYTHEON",
    ...headers,
  },
}).then(async (res) => {
  const limit = res.headers.get("X-RateLimit-Limit");
  const remaining = res.headers.get("X-RateLimit-Remaining");

  if (limit && remaining) {
    updateRateLimitUI(remaining, limit);
  }

  if (res.status === 403 || res.status === 429) {
    const resetTime = res.headers.get("X-RateLimit-Reset");
    const waitTime = resetTime
      ? Math.ceil((resetTime * 1000 - Date.now()) / 60000)
      : "some time";
    throw new Error(`GitHub rate limit exceeded. Try again in ${waitTime} min`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}`);
  }

  return res.json();
});

IN_FLIGHT_REQUESTS.set(key, promise);
return promise;






