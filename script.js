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
    
    // Load user's model by default; fall back to a simple primitive if it fails
    loadGltfFromUrl('assets/models/prism.glb', undefined, () => {
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
    
    // Create material with current settings
    const color = document.getElementById('color-picker').value;
    const isWireframe = document.getElementById('wireframe-toggle').checked;
    
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
    // Center & scale to fit (much larger to cover hero text area)
    centerAndScale(object3d, 16);
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
    const fitDist = maxDim * 0.95;
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
        const base = 0.18; // slightly higher base opacity
        const extra = Math.min(top / max, 1) * 0.12; // a bit more as you scroll
        canvas.style.opacity = Math.min(base + extra, 0.35).toFixed(2);
    };
    window.addEventListener('scroll', setOpacityByScroll);
    setOpacityByScroll();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Initializing 3D Demo...');
    init();
    addInteractiveEffects();
    console.log('✅ 3D Demo ready!');
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