/**
 * AI Test Lab - 3D Interface
 * Handles logic tree rendering and AI interaction.
 */

class TestLab {
    constructor() {
        this.container = document.getElementById('logic-tree-viewport');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.nodes = [];
        this.links = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedNode = null;

        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        this.container.addEventListener('click', (e) => this.onMouseClick(e));
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05050a);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(100, 100, 100);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambient);

        const point1 = new THREE.PointLight(0x6366f1, 1, 500);
        point1.position.set(50, 50, 50);
        this.scene.add(point1);

        const point2 = new THREE.PointLight(0x8b5cf6, 0.6, 400);
        point2.position.set(-30, 80, -40);
        this.scene.add(point2);
    }

    async analyze(filePath) {
        try {
            const res = await fetch(`/api/test-lab/analyze?filePath=${filePath}`);
            const result = await res.json();
            if (result.success) {
                this.renderTree(result.data.logicTree);
            }
        } catch (e) {
            console.warn('API not available, using demo data:', e.message);
            this.renderTree(this.getDemoTree(filePath));
        }
    }

    getDemoTree(filePath) {
        const name = filePath.replace(/\.\w+$/, '');
        return {
            nodes: [
                { x: 40, y: 20, z: -10, status: 'tested', metadata: { condition: `${name}.isAuthenticated()`, boundaries: [{ type: 'null check', value: 'null', reason: 'Missing auth token' }, { type: 'type check', value: 'undefined', reason: 'Session expired' }] } },
                { x: -30, y: 50, z: 20, status: 'untested', metadata: { condition: `${name}.validateInput(data)`, boundaries: [{ type: 'boundary', value: '""', reason: 'Empty string input' }, { type: 'edge case', value: 'MAX_INT', reason: 'Integer overflow' }] } },
                { x: 60, y: -20, z: 40, status: 'tested', metadata: { condition: `${name}.hasPermission(role)`, boundaries: [{ type: 'role check', value: '"guest"', reason: 'Unauthenticated role' }] } },
                { x: -50, y: -30, z: -30, status: 'untested', metadata: { condition: `${name}.rateLimit(req)`, boundaries: [{ type: 'threshold', value: '1000', reason: 'Max requests per minute' }, { type: 'timing', value: '0ms', reason: 'Zero delay between requests' }] } },
                { x: 20, y: 60, z: -50, status: 'tested', metadata: { condition: `data.length > 0`, boundaries: [{ type: 'array', value: '[]', reason: 'Empty array' }, { type: 'size', value: '10000', reason: 'Large dataset performance' }] } },
                { x: -60, y: 10, z: 50, status: 'untested', metadata: { condition: `try { parse(json) }`, boundaries: [{ type: 'format', value: '"{invalid"', reason: 'Malformed JSON' }, { type: 'encoding', value: '"\\u0000"', reason: 'Null byte injection' }] } },
                { x: 70, y: 40, z: 30, status: 'tested', metadata: { condition: `timeout < MAX_TIMEOUT`, boundaries: [{ type: 'timing', value: '0', reason: 'Zero timeout' }, { type: 'timing', value: 'Infinity', reason: 'Infinite wait' }] } },
            ]
        };
    }

    renderTree(treeData) {
        // Clear previous tree
        this.nodes.forEach(n => this.scene.remove(n));
        this.links.forEach(l => this.scene.remove(l));
        this.nodes = [];
        this.links = [];

        // Root Node
        const rootGeo = new THREE.SphereGeometry(4, 32, 32);
        const rootMat = new THREE.MeshPhongMaterial({
            color: 0x6366f1,
            emissive: 0x6366f1,
            emissiveIntensity: 0.5
        });
        const root = new THREE.Mesh(rootGeo, rootMat);
        root.position.set(0, 0, 0);
        this.scene.add(root);

        // Pulse animation on root
        const pulseRoot = () => {
            gsap.to(rootMat, {
                emissiveIntensity: 0.9,
                duration: 1.5,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });
        };
        pulseRoot();

        // Branch Nodes
        treeData.nodes.forEach((node, i) => {
            const geo = new THREE.SphereGeometry(3, 32, 32);
            const color = node.status === 'tested' ? 0x10b981 : 0xef4444;
            const mat = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.85
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(node.x, node.y, node.z);
            mesh.userData = node;
            this.scene.add(mesh);
            this.nodes.push(mesh);

            // Line from root to node
            const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(node.x, node.y, node.z)];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineColor = node.status === 'tested' ? 0x10b981 : 0xef4444;
            const lineMat = new THREE.LineBasicMaterial({
                color: lineColor,
                transparent: true,
                opacity: 0.15
            });
            const line = new THREE.Line(lineGeo, lineMat);
            this.scene.add(line);
            this.links.push(line);

            // Staggered animation entry
            mesh.scale.set(0, 0, 0);
            gsap.to(mesh.scale, {
                x: 1, y: 1, z: 1,
                duration: 1,
                delay: i * 0.1,
                ease: 'elastic.out(1, 0.5)'
            });
        });
    }

    onMouseClick(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes);

        if (intersects.length > 0) {
            const node = intersects[0].object;
            this.selectNode(node);
        }
    }

    selectNode(node) {
        if (this.selectedNode) {
            this.selectedNode.material.emissiveIntensity = 0.5;
            gsap.to(this.selectedNode.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
        }

        this.selectedNode = node;
        node.material.emissiveIntensity = 1.0;
        gsap.to(node.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 0.3 });

        // Update UI
        const data = node.userData;
        document.getElementById('branch-card').classList.remove('hidden');
        document.getElementById('branch-condition').innerText = data.metadata.condition;

        const badge = document.getElementById('coverage-status');
        badge.innerText = data.status.toUpperCase();
        badge.className = `status-badge ${data.status}`;

        this.renderBoundaries(data.metadata.boundaries);

        // Zoom camera
        gsap.to(this.camera.position, {
            x: node.position.x + 40,
            y: node.position.y + 40,
            z: node.position.z + 40,
            duration: 1,
            ease: 'expo.inOut'
        });
    }

    renderBoundaries(boundaries) {
        const list = document.getElementById('boundary-list');
        list.innerHTML = boundaries.map(b => `
            <div class="boundary-item">
                <span class="type">${b.type}</span>
                <span class="value">Value: ${b.value}</span>
                <span class="reason">${b.reason}</span>
            </div>
        `).join('');
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Global integration
let lab;
document.addEventListener('DOMContentLoaded', () => {
    lab = new TestLab();
});

async function analyzeCode() {
    const filePath = document.getElementById('file-input').value;
    if (!filePath.trim()) return;
    await lab.analyze(filePath);
}

async function generateTest() {
    if (!lab.selectedNode) return;

    const filePath = document.getElementById('file-input').value;
    const branch = lab.selectedNode.userData.metadata;

    try {
        const res = await fetch('/api/test-lab/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, branches: [branch] })
        });

        const result = await res.json();
        if (result.success) {
            showTestResults(result.data[0].code);
        }
    } catch (e) {
        console.warn('API not available, generating demo test:', e.message);
        const demoCode = generateDemoTest(filePath, branch);
        showTestResults(demoCode);
    }
}

function showTestResults(code) {
    document.getElementById('test-results').classList.remove('hidden');
    document.getElementById('generated-code').innerText = code;
}

function generateDemoTest(filePath, branch) {
    const name = filePath.replace(/\.\w+$/, '');
    return `// Auto-generated edge-case test for: ${branch.condition}
// File: ${filePath}

describe('${name} — Edge Cases', () => {
${branch.boundaries.map((b, i) => `
    test('should handle ${b.type}: ${b.value}', () => {
        // Reason: ${b.reason}
        const input = ${b.value.startsWith('"') ? b.value : `"${b.value}"`};
        const result = ${name}.evaluate(input);
        expect(result).toBeDefined();
        expect(result.error).toBeNull();
    });`).join('\n')}

    test('should satisfy condition: ${branch.condition}', () => {
        // Integration test for the branch condition
        const context = createTestContext();
        const outcome = evaluateCondition(context);
        expect(outcome).toBe(true);
    });
});`;
}

function hideResults() {
    document.getElementById('test-results').classList.add('hidden');
}

function copyCode() {
    const code = document.getElementById('generated-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Code copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Code copied to clipboard!');
    });
}

function showToast(message) {
    // Remove any existing toast
    const existing = document.querySelector('.test-lab-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'test-lab-toast';
    toast.innerHTML = `<i class="ri-checkbox-circle-fill"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(16, 185, 129, 0.95);
        color: #fff;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10000;
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
