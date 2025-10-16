// Global variables
let scene, camera, renderer, controls;
let currentMesh; // for primitives
let currentModel; // for GLTF/GLB models
let autoRotationSpeed = 0.01;
let isAutoRotating = true;
let parallaxEnabled = true;
let targetOrbitOffset = { x: 0, y: 0 };
let currentOrbitOffset = { x: 0, y: 0 };

// Geometric shapes collection
const shapes = {
    cube: () => new THREE.BoxGeometry(2, 2, 2),
    sphere: () => new THREE.SphereGeometry(1.5, 32, 32),
    torus: () => new THREE.TorusGeometry(1.5, 0.5, 16, 100),
    cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
    octahedron: () => new THREE.OctahedronGeometry(1.5)
};

// Initialize the 3D scene
function init() {
    // Get canvas element
    const canvas = document.getElementById('three-canvas');
    const container = document.querySelector('.canvas-container');
    
    // Create scene
    scene = new THREE.Scene();
    // Keep scene background transparent so the site stays white
    // renderer will composite over the white page background
    
    // Create camera
    const aspectRatio = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(5, 5, 5);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true // allow DOM/page background to show through
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lighting
    setupLighting();
    
    // Load model: allow page to specify a different model via data-model
    const modelPath = canvas && canvas.dataset.model ? canvas.dataset.model : 'assets/models/prism.glb';
    loadGltfFromUrl(modelPath, undefined, () => {
        console.warn('Falling back to primitive shape because prism.glb failed to load.');
        safeCreatePrimitiveFallback();
    });
    
    // Setup controls
    setupControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 1000);
    
    // Start animation loop
    animate();
}

// Setup lighting
function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);
    
    // Point light for extra highlights
    const pointLight = new THREE.PointLight(0xff9999, 0.5, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
}

// Setup camera controls
function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
}

// Create a 3D shape
function createShape(shapeType) {
    // Remove existing mesh
    if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh.geometry.dispose();
        currentMesh.material.dispose();
    }
    // Hide/remove model if present when switching to primitive
    if (currentModel) {
        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
    }
    
    // Create new geometry
    const geometry = shapes[shapeType]();
    
    // Create material with current settings (guard optional controls)
    const colorEl = document.getElementById('color-picker');
    const wireEl = document.getElementById('wireframe-toggle');
    const color = colorEl ? colorEl.value : '#66ccff';
    const isWireframe = wireEl ? !!wireEl.checked : false;
    
    const material = new THREE.MeshPhongMaterial({
        color: color,
        wireframe: isWireframe,
        shininess: 100,
        transparent: true,
        opacity: 0.9
    });
    
    // Create mesh
    currentMesh = new THREE.Mesh(geometry, material);
    currentMesh.castShadow = true;
    currentMesh.receiveShadow = true;
    
    // Add to scene
    scene.add(currentMesh);
    
    console.log(`Created ${shapeType} shape`);
}

// Setup event listeners
function setupEventListeners() {
    // Guard optional controls if they exist in DOM
    const shapeSel = document.getElementById('shape-selector');
    if (shapeSel) shapeSel.addEventListener('change', (e) => createShape(e.target.value));

    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) colorPicker.addEventListener('input', (e) => {
        if (currentMesh) currentMesh.material.color.set(e.target.value);
    });

    const wireframeToggle = document.getElementById('wireframe-toggle');
    if (wireframeToggle) wireframeToggle.addEventListener('change', (e) => {
        if (currentMesh) currentMesh.material.wireframe = e.target.checked;
    });

    const rotationSpeed = document.getElementById('rotation-speed');
    if (rotationSpeed) rotationSpeed.addEventListener('input', (e) => {
        autoRotationSpeed = parseFloat(e.target.value);
        isAutoRotating = autoRotationSpeed > 0;
    });

    const resetBtn = document.getElementById('reset-camera');
    if (resetBtn) resetBtn.addEventListener('click', () => {
        camera.position.set(5, 5, 5);
        controls.reset();
    });

    const fileInput = document.getElementById('model-file');
    if (fileInput) fileInput.addEventListener('change', handleModelUpload);

    const sampleBtn = document.getElementById('load-sample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
        loadGltfFromUrl('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb');
    });

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

// Handle window resize
function onWindowResize() {
    const container = document.querySelector('.canvas-container');
    const aspectRatio = container.clientWidth / container.clientHeight;
    
    camera.aspect = aspectRatio;
    camera.updateProjectionMatrix();
    
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Auto rotation
    if (currentMesh && isAutoRotating) {
        currentMesh.rotation.x += autoRotationSpeed;
        currentMesh.rotation.y += autoRotationSpeed * 1.5;
    }
    
    // Update tweens
    if (typeof TWEEN !== 'undefined') {
        TWEEN.update();
    }
    
    // Update controls
    // Parallax: subtly nudge controls target toward mouse-based offset
    if (parallaxEnabled && controls) {
        // ease offsets
        currentOrbitOffset.x += (targetOrbitOffset.x - currentOrbitOffset.x) * 0.05;
        currentOrbitOffset.y += (targetOrbitOffset.y - currentOrbitOffset.y) * 0.05;
        controls.target.set(currentOrbitOffset.x, currentOrbitOffset.y, 0);
    }
    controls.update();
    
    // Rotate the loaded model around its Y axis continuously
    if (currentModel && isAutoRotating) {
        currentModel.rotation.y += autoRotationSpeed;
    }

    // Render scene
    renderer.render(scene, camera);
}

// ---------- GLTF MODEL LOADING ----------
function handleModelUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    loadGltfFromUrl(url, () => URL.revokeObjectURL(url));
}

function loadGltfFromUrl(url, onDone, onError) {
    showLoading(true, 'Loading Model...');
    const loader = new THREE.GLTFLoader();
    loader.load(
        url,
        (gltf) => {
            if (currentMesh) {
                scene.remove(currentMesh);
                currentMesh.geometry.dispose();
                currentMesh.material.dispose();
                currentMesh = null;
            }

            // Remove existing model
            if (currentModel) {
                scene.remove(currentModel);
                disposeObject(currentModel);
            }

            currentModel = gltf.scene;
            preprocessModel(currentModel);
            scene.add(currentModel);
            frameObject(currentModel);
            showLoading(false);
            if (onDone) onDone();
            console.log('✅ Model loaded:', url);
        },
        undefined,
        (err) => {
            console.error('Model load error:', err);
            showLoading(false);
            if (onError) onError(err);
            if (onDone) onDone();
        }
    );
}

function safeCreatePrimitiveFallback() {
    try {
        createShape('octahedron');
    } catch (e) {
        console.warn('Fallback primitive creation failed:', e);
    }
}

function preprocessModel(object3d) {
    object3d.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                // Ensure standard material for consistency
                if (!child.material.isMeshStandardMaterial && !child.material.isMeshPhysicalMaterial) {
                    child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
                }
            }
        }
    });
    // Center & scale to fit (larger to cover hero/dashboard)
    const canvas = document.getElementById('three-canvas');
    const isDashboard = canvas && canvas.dataset.model && canvas.dataset.model.includes('github');
    centerAndScale(object3d, isDashboard ? 20 : 16);
}

function centerAndScale(object3d, targetSize = 3) {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Recenter at origin
    object3d.position.sub(center);

    // Scale uniformly to target size
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
        const scale = targetSize / maxDim;
        object3d.scale.setScalar(scale);
    }
}

function frameObject(object3d) {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Bring camera even closer for a larger on-screen presence
    const canvas = document.getElementById('three-canvas');
    const isDashboard = canvas && canvas.dataset.model && canvas.dataset.model.includes('github');
    const fitDist = maxDim * (isDashboard ? 0.8 : 0.95);
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    camera.position.copy(direction.multiplyScalar(fitDist));
    // Slightly narrow field of view to keep model large without clipping
    camera.fov = 60;
    camera.near = fitDist / 100;
    camera.far = fitDist * 100;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
}
function disposeObject(object3d) {
    object3d.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose && m.dispose());
                } else if (child.material.dispose) {
                    child.material.dispose();
                }
            }
        }
    });
}

function showLoading(visible, text) {
    const el = document.getElementById('loading-screen');
    if (!el) return;
    if (text) {
        const p = el.querySelector('p');
        if (p) p.textContent = text;
    }
    el.classList.toggle('hidden', !visible);
}

// Add some interactive effects
function addInteractiveEffects() {
    // Mouse interaction with the mesh
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    function onMouseMove(event) {
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        if (currentMesh) {
            const intersects = raycaster.intersectObject(currentMesh);
            
            if (intersects.length > 0) {
                // Highlight effect on hover
                currentMesh.material.emissive.setHex(0x111111);
                canvas.style.cursor = 'pointer';
            } else {
                currentMesh.material.emissive.setHex(0x000000);
                canvas.style.cursor = 'default';
            }
        }
    }
    
    function onMouseClick(event) {
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        if (currentMesh) {
            const intersects = raycaster.intersectObject(currentMesh);
            
            if (intersects.length > 0) {
                // Add click animation
                animateClick();
            }
        }
    }
    
    function animateClick() {
        if (!currentMesh) return;
        if (typeof TWEEN === 'undefined') return; // only if tween lib available

        const originalScale = currentMesh.scale.clone();
        const targetScale = originalScale.clone().multiplyScalar(1.2);
        
        // Scale up
        const scaleUp = new TWEEN.Tween(currentMesh.scale)
            .to(targetScale, 150)
            .easing(TWEEN.Easing.Quadratic.Out);
        
        // Scale back down
        const scaleDown = new TWEEN.Tween(currentMesh.scale)
            .to(originalScale, 150)
            .easing(TWEEN.Easing.Quadratic.Out);
        
        scaleUp.chain(scaleDown);
        scaleUp.start();
    }
    
    // Add event listeners
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onMouseClick);

    // Parallax: track mouse position relative to viewport
    window.addEventListener('mousemove', (e) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
        const ny = (e.clientY / window.innerHeight) * 2 - 1; // -1..1
        targetOrbitOffset.x = nx * 0.5; // subtle
        targetOrbitOffset.y = -ny * 0.3; // subtle
    });

    // Adjust canvas opacity slightly by scroll position for depth
    const canvas = renderer.domElement;
    const setOpacityByScroll = () => {
        const top = window.scrollY;
        const max = 600; // after hero
        // Allow per-page override for base/max opacity
        const baseAttr = canvas.getAttribute('data-baseopacity');
        const maxAttr = canvas.getAttribute('data-maxopacity');
        const base = baseAttr ? parseFloat(baseAttr) : 0.18;
        const maxOpacity = maxAttr ? parseFloat(maxAttr) : 0.35;
        const extra = Math.min(top / max, 1) * (maxOpacity - base);
        canvas.style.opacity = Math.min(base + extra, maxOpacity).toFixed(2);
    };
    window.addEventListener('scroll', setOpacityByScroll);
    setOpacityByScroll();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // If the 3D canvas exists, we're on the home page; otherwise, dashboard-only page.
    const hasThree = !!document.getElementById('three-canvas');
    if (hasThree) {
        console.log('🎯 Initializing 3D Demo...');
        init();
        addInteractiveEffects();
        console.log('✅ 3D Demo ready!');
    }
    // Initialize GitHub dashboard UI if present on the page
    initGithubDashboard();
    // Initialize the mini 3D viewer on github.html if present
    initMiniViewer();
});

// Add some console instructions for developers
console.log(`
🎯 Interactive 3D Demo - Developer Console
==========================================

Available global variables:
- scene: Three.js scene object
- camera: Perspective camera
- renderer: WebGL renderer
- controls: Orbit controls
- currentMesh: Current 3D shape

Try these commands:
- scene.children: See all objects in scene
- currentMesh.rotation.set(0, 0, 0): Reset rotation
- camera.position.set(10, 10, 10): Change camera position

Have fun exploring! 🚀
`);

// ===================== GitHub Dashboard =====================
function initGithubDashboard() {
    const form = document.getElementById('github-form');
    if (!form) return; // section not present

    const usernameInput = document.getElementById('gh-username');
    const clearBtn = document.getElementById('gh-clear');
    const status = document.getElementById('github-status');

    // Restore saved creds
    try {
        const saved = JSON.parse(localStorage.getItem('xaytheon:ghCreds') || 'null');
        if (saved && saved.username) {
            usernameInput.value = saved.username;
            loadGithubDashboard(saved.username);
        }
    } catch {}

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (!username) {
            setStatus('Please enter a GitHub username.', 'error');
            return;
        }
        // Save only username
        localStorage.setItem('xaytheon:ghCreds', JSON.stringify({ username }));
        loadGithubDashboard(username);
    });

    clearBtn.addEventListener('click', () => {
        // Remove saved username
        localStorage.removeItem('xaytheon:ghCreds');
        // Clear input field
        const usernameInput = document.getElementById('gh-username');
        if (usernameInput) usernameInput.value = '';

        // Clear all visible dashboard panels
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
        const avatar = document.getElementById('gh-avatar');
        if (avatar) avatar.removeAttribute('src');
        set('gh-name', '—');
        set('gh-login', '—');
        set('gh-bio', '');
        set('gh-followers', '0');
        set('gh-following', '0');
        set('gh-repos-count', '0');
        setHtml('gh-repo-list', '');
        setHtml('gh-activity-list', '');
        setHtml('gh-contrib-svg', '');
        const note = document.getElementById('gh-contrib-note');
        if (note) note.textContent = 'Enter a username and press Load Dashboard.';
        setStatus('Cleared saved username and dashboard.');
    });

    function setStatus(msg, level = 'info') {
        if (!status) return;
        status.textContent = msg;
        status.style.opacity = 1;
        status.style.color = level === 'error' ? '#b91c1c' : '#111827';
        setTimeout(() => { status.style.opacity = 0.8; }, 2500);
    }
}

async function loadGithubDashboard(username) {
    const headers = {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    const setDisplay = (id, disp) => { const el = document.getElementById(id); if (el) el.style.display = disp; };
    const avatar = document.getElementById('gh-avatar');

    // Status
    const status = document.getElementById('github-status');
    const statusMsg = (m, level = 'info') => { if (status) { status.textContent = m; status.style.color = level==='error'?'#b91c1c':'#111827'; } };

    try {
        statusMsg('Loading profile…');
        // Profile
        const user = await ghJson(`https://api.github.com/users/${encodeURIComponent(username)}`, headers);
        if (avatar) avatar.src = user.avatar_url;
        set('gh-name', user.name || '—');
        set('gh-login', `@${user.login}`);
        set('gh-bio', user.bio || '');
        set('gh-followers', user.followers ?? 0);
        set('gh-following', user.following ?? 0);

        // Repos (public) - paginated, we fetch top 100 then sort by stargazers
        statusMsg('Loading repositories…');
        const repos = await ghJson(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, headers);
        set('gh-repos-count', (user.public_repos ?? repos.length) + '');
        const top = [...repos]
            .filter(r => !r.fork)
            .sort((a,b) => (b.stargazers_count||0) - (a.stargazers_count||0))
            .slice(0, 8);
        renderRepos(top);

        // Activity (public events)
        statusMsg('Loading activity…');
        const events = await ghJson(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=25`, headers);
        renderActivity(events.slice(0, 10));

        // Contributions: tokenless path — try third-party full-year chart, fallback to approximate heatmap
            const contribNote = document.getElementById('gh-contrib-note');
            const container = document.getElementById('gh-contrib-svg');
            if (contribNote) contribNote.textContent = 'Full-year chart via third-party (ghchart.rshah.org). If it fails, we will show an approximate heatmap.';
            setDisplay('gh-contrib-note', 'block');
            if (container) {
                container.innerHTML = '<div class="muted">Loading public contributions…</div>';
                const img = new Image();
                img.src = `https://ghchart.rshah.org/${encodeURIComponent(username)}`;
                img.alt = `${username}'s contributions (third-party chart)`;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.referrerPolicy = 'no-referrer';
                img.onload = () => {
                    container.innerHTML = '';
                    container.appendChild(img);
                };
                img.onerror = () => {
                    try {
                        const svg = renderEventHeatmap(events);
                        container.innerHTML = svg;
                        if (contribNote) contribNote.textContent = 'Approximate heatmap based on recent public activity.';
                    } catch (e) {
                        console.warn('Event heatmap failed', e);
                        container.innerHTML = '<div class="muted">No activity found to render a heatmap.</div>';
                    }
                };
            }
        

        statusMsg('Done');
    } catch (e) {
        console.error(e);
        statusMsg(e.message || 'Failed to load GitHub data', 'error');
    }
}

async function ghJson(url, headers={}) {
    const res = await fetch(url, { headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'XAYTHEON-GitHub-Dashboard',
        ...headers
    }});
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
}

function renderRepos(repos) {
    const list = document.getElementById('gh-repo-list');
    if (!list) return;
    if (!repos || repos.length === 0) {
        list.innerHTML = '<div class="muted">No repositories found.</div>';
        return;
    }
    list.innerHTML = repos.map(r => `
        <div class="repo-item">
            <div class="repo-name"><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.full_name)}</a></div>
            ${r.description ? `<div class="repo-desc">${escapeHtml(r.description)}</div>` : ''}
            <div class="repo-meta">
                <span>★ ${r.stargazers_count || 0}</span>
                <span>⑂ ${r.forks_count || 0}</span>
                ${r.language ? `<span>${r.language}</span>` : ''}
                <span>Updated ${timeAgo(r.updated_at)}</span>
            </div>
        </div>
    `).join('');
}

function renderActivity(events) {
    const list = document.getElementById('gh-activity-list');
    if (!list) return;
    if (!events || events.length === 0) {
        list.innerHTML = '<li class="activity-item muted">No recent public activity.</li>';
        return;
    }
    list.innerHTML = events.map(ev => {
        const type = ev.type || 'Event';
        const repo = ev.repo?.name || '';
        const when = timeAgo(ev.created_at);
        const what = describeEvent(ev);
        return `<li class="activity-item"><div>${escapeHtml(what || type)}${repo ? ` in <a href="https://github.com/${repo}" target="_blank" rel="noopener">${escapeHtml(repo)}</a>` : ''}</div><div class="activity-time">${when}</div></li>`;
    }).join('');
}

function describeEvent(ev) {
    switch (ev.type) {
        case 'PushEvent':
            return `Pushed ${ev.payload?.commits?.length || 0} commit(s)`;
        case 'CreateEvent':
            return `Created ${ev.payload?.ref_type || 'item'} ${ev.payload?.ref || ''}`;
        case 'IssuesEvent':
            return `Issue ${ev.payload?.action} #${ev.payload?.issue?.number}`;
        case 'PullRequestEvent':
            return `Pull request ${ev.payload?.action} #${ev.payload?.pull_request?.number}`;
        case 'WatchEvent':
            return `Starred`;
        case 'ForkEvent':
            return `Forked`;
        default:
            return ev.type;
    }
}

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    const units = [
        ['year', 365*24*3600],
        ['month', 30*24*3600],
        ['day', 24*3600],
        ['hour', 3600],
        ['minute', 60]
    ];
    for (const [name, secs] of units) {
        const v = Math.floor(s / secs);
        if (v >= 1) return `${v} ${name}${v>1?'s':''} ago`;
    }
    return 'just now';
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
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
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, variables: { login: username } })
    });
    const json = await res.json();
    if (!res.ok || json.errors) {
        throw new Error(json.errors?.[0]?.message || `GraphQL error ${res.status}`);
    }
    // Build a simple SVG calendar from the data (compact)
    const cal = json.data.user.contributionsCollection.contributionCalendar;
    const cell = 10, gap = 2;
    const rows = 7, cols = cal.weeks.length;
    const width = cols * (cell + gap) + gap;
    const height = rows * (cell + gap) + gap + 20;
    let rects = '';
    cal.weeks.forEach((w, x) => {
        w.contributionDays.forEach((d, y) => {
            const cx = gap + x * (cell + gap);
            const cy = gap + y * (cell + gap);
            rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${d.color || '#ebedf0'}">
                <title>${d.date}: ${d.contributionCount} contributions</title>
            </rect>`;
        });
    });
    const label = `<text x="${gap}" y="${height-4}" font-size="10" fill="#666">Total: ${cal.totalContributions}</text>`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// Build an approximate heatmap from public events (tokenless fallback)
function renderEventHeatmap(events) {
    if (!Array.isArray(events) || events.length === 0) return '<div class="muted">No recent public activity.</div>';

    // Count events per day for the past ~90 days (limited by API)
    const today = new Date();
    const daysBack = 90;
    const start = new Date(today.getTime() - daysBack * 24 * 3600 * 1000);

    // Normalize to midnight UTC for consistency
    const toKey = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
    const counts = new Map();

    // Seed zero counts for all days in range
    for (let i = 0; i <= daysBack; i++) {
        const d = new Date(start.getTime() + i * 24 * 3600 * 1000);
        counts.set(toKey(new Date(d.toISOString())), 0);
    }

    // Tally events by created_at date
    for (const ev of events) {
        if (!ev.created_at) continue;
        const d = new Date(ev.created_at);
        if (d < start || d > today) continue;
        const k = toKey(new Date(d.toISOString()));
        counts.set(k, (counts.get(k) || 0) + 1);
    }

    // Prepare grid data by weeks (columns) and weekdays (rows)
    const cell = 10, gap = 2;
    const dates = Array.from(counts.keys()).sort();
    if (dates.length === 0) return '<div class="muted">No recent public activity.</div>';

    // Align start to Sunday for calendar style
    const firstDate = new Date(dates[0] + 'T00:00:00Z');
    const offset = firstDate.getUTCDay(); // 0=Sun
    const totalDays = dates.length + offset;
    const cols = Math.ceil(totalDays / 7);

    const values = dates.map(d => counts.get(d) || 0);
    const max = Math.max(1, ...values);
    const colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
    const colorFor = (v) => {
        if (v <= 0) return colors[0];
        const idx = Math.min(4, Math.ceil((v / max) * 4));
        return colors[idx];
    };

    const width = cols * (cell + gap) + gap;
    const height = 7 * (cell + gap) + gap + 20;
    let rects = '';

    // Iterate by column/week
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < 7; y++) {
            const dayIndex = x * 7 + y - offset;
            if (dayIndex < 0 || dayIndex >= dates.length) continue;
            const d = dates[dayIndex];
            const v = counts.get(d) || 0;
            const cx = gap + x * (cell + gap);
            const cy = gap + y * (cell + gap);
            rects += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${colorFor(v)}">
                <title>${d}: ${v} event(s)</title>
            </rect>`;
        }
    }
    const label = `<text x="${gap}" y="${height-4}" font-size="10" fill="#666">Approx. last ${daysBack} days</text>`;
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">${rects}${label}</svg>`;
}

// ===================== Mini 3D viewer (github.html) =====================
function initMiniViewer() {
    const canvas = document.getElementById('mini-3d-canvas');
    if (!canvas) return;
    // If libs missing, show a friendly message instead of hanging
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
        const loadingEl = canvas.parentElement?.querySelector('.mini-3d-loading');
        if (loadingEl) loadingEl.textContent = '3D unavailable';
        return;
    }

    const container = canvas.parentElement;
    const loadingEl = container?.querySelector('.mini-3d-loading');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // transparent
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2.2, 1.8, 2.2);
    camera.lookAt(0, 0, 0);

    // size helper
    function resize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 2);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    // Load model
    const loader = new THREE.GLTFLoader();
    loader.load('assets/models/github.glb', (gltf) => {
        const model = gltf.scene;
        // Normalize size and center at origin
        centerAndScale(model, 3.0);
        // Ensure visibility: if materials are transparent or very dark, replace with a neutral white standard material
        model.traverse((child) => {
            if (child.isMesh) {
                const m = child.material;
                const needsReplace = !m || (m.transparent && (m.opacity == null || m.opacity < 0.2));
                if (needsReplace) {
                    child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7 });
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

    if (loadingEl) loadingEl.style.display = 'none';

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
    }, undefined, (err) => {
        console.warn('Mini viewer model load failed:', err);
        if (loadingEl) loadingEl.textContent = '3D failed to load';
    });
}