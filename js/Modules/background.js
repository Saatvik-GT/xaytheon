// ============================================================
// js/Modules/background.js — 3D Background Scene
//
// WHY THIS FILE EXISTS:
//   Previously all 3D logic lived inside script.js mixed together
//   with GitHub API code. That made it hard to touch one without
//   accidentally breaking the other.
//   This file owns ONLY the spinning 3D background on index.html.
//
// WHAT IT DOES:
//   - Creates a Three.js scene with lights
//   - Loads assets/models/prism.glb (falls back to octahedron)
//   - Spins the model and adds a subtle mouse-parallax effect
//   - Fades the canvas opacity as the user scrolls
//
// DEPENDENCIES (loaded via <script> tags in index.html BEFORE this file):
//   - three.min.js
//   - OrbitControls.js
//   - GLTFLoader.js
// ============================================================

// --- Module-level state ---
// These variables are shared across all functions in this file.
// They are NOT exported because nothing outside needs them directly.

var scene, camera, renderer;
var currentMesh  = null;
var currentModel = null;
var autoRotationSpeed = 0.005;
var isAutoRotating    = true;
var targetOrbitOffset  = { x: 0, y: 0 };
var currentOrbitOffset = { x: 0, y: 0 };
var baseCameraPos = { x: 5, y: 5, z: 5 };

// Built-in fallback shapes (used if the .glb model fails to load)
var shapes = {
  cube:       function() { return new THREE.BoxGeometry(2, 2, 2); },
  sphere:     function() { return new THREE.SphereGeometry(1.5, 32, 32); },
  torus:      function() { return new THREE.TorusGeometry(1.5, 0.5, 16, 100); },
  cylinder:   function() { return new THREE.CylinderGeometry(1, 1, 2, 32); },
  octahedron: function() { return new THREE.OctahedronGeometry(1.5); }
};


// ============================================================
// PUBLIC API — called from index.html
// ============================================================

/**
 * Entry point. Call this once when the page loads.
 * Sets up the scene, loads the model, starts the animation loop.
 */
export function initBackground() {
  var canvas    = document.getElementById('three-canvas');
  var container = document.querySelector('.canvas-container');
  if (!canvas || !container) return;

  scene = new THREE.Scene();

  var aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;

  // Let mouse/scroll events pass through to the page underneath
  canvas.style.pointerEvents = 'none';

  addLights();

  // Try loading the 3D model; fall back to a simple shape on failure
  loadModel('assets/models/prism.glb', function() {
    createShape('octahedron');
  });

  window.addEventListener('resize', onWindowResize);

  setTimeout(function() {
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, 1000);

  animate();
}

/**
 * Adds mouse-parallax and scroll-opacity effects.
 * Call this after initBackground().
 */
export function addMouseEffects() {
  window.addEventListener('mousemove', function(event) {
    var nx = (event.clientX / window.innerWidth)  * 2 - 1;
    var ny = (event.clientY / window.innerHeight) * 2 - 1;
    targetOrbitOffset.x =  nx * 0.5;
    targetOrbitOffset.y = -ny * 0.3;
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
// PRIVATE HELPERS
// ============================================================

function addLights() {
  scene.add(new THREE.AmbientLight(0x404040, 0.6));

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

  var geometry = shapes[shapeType]();
  var material = new THREE.MeshPhongMaterial({ color: '#66ccff', shininess: 100, transparent: true, opacity: 0.9 });
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

  // Smooth parallax: camera gently follows the mouse
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
  loader.load(url, function(gltf) {
    if (currentMesh)  { scene.remove(currentMesh);  currentMesh.geometry.dispose(); currentMesh.material.dispose(); currentMesh = null; }
    if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); }
    currentModel = gltf.scene;
    prepareModel(currentModel);
    scene.add(currentModel);
    zoomCameraToFit(currentModel);
  }, undefined, function(err) {
    console.warn('Model failed to load:', url, err);
    if (onError) onError(err);
  });
}

function prepareModel(model) {
  model.traverse(function(child) {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });
  centerAndScaleModel(model, 16);
}

// Exported so github.js can reuse it for the mini viewer
export function centerAndScaleModel(model, targetSize) {
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
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    }
  });
}
