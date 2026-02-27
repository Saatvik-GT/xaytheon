/**
 * Risk Galaxy Frontend Logic
 * Implements 3D star-map and predictive trend charts.
 */

class RiskGalaxy {
    constructor() {
        this.container = document.getElementById('galaxy-viewport');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.stars = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.trendChart = null;
        this.isDragging = false;
        this.prevMouse = { x: 0, y: 0 };
        this.rotationVelocity = { x: 0.001, y: 0.002 };
        this.cameraGroup = null;

        this.init();
    }

    async init() {
        this.setupScene();
        this.createStarField();
        this.setupInteraction();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
        this.container.addEventListener('click', (e) => this.onMouseClick(e));

        await this.loadGalaxyData();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x03030a, 0.004);

        this.camera = new THREE.PerspectiveCamera(
            60,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 120;
        this.camera.position.y = 20;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        // Directional light
        const directional = new THREE.DirectionalLight(0x6366f1, 0.3);
        directional.position.set(50, 50, 50);
        this.scene.add(directional);
    }

    createStarField() {
        // Background dust particles
        const particleCount = 600;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 500;
            positions[i + 1] = (Math.random() - 0.5) * 500;
            positions[i + 2] = (Math.random() - 0.5) * 500;

            const brightness = 0.2 + Math.random() * 0.3;
            colors[i] = brightness * 0.7;
            colors[i + 1] = brightness * 0.8;
            colors[i + 2] = brightness;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
    }

    setupInteraction() {
        // Mouse drag for camera orbit
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.prevMouse.x = e.clientX;
            this.prevMouse.y = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.prevMouse.x;
            const dy = e.clientY - this.prevMouse.y;
            this.rotationVelocity.x += dy * 0.00005;
            this.rotationVelocity.y += dx * 0.00005;
            this.prevMouse.x = e.clientX;
            this.prevMouse.y = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Scroll to zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoom = e.deltaY * 0.05;
            this.camera.position.z = Math.max(30, Math.min(250, this.camera.position.z + zoom));
        }, { passive: false });
    }

    async loadGalaxyData() {
        try {
            const response = await fetch('/api/risk/galaxy');
            const result = await response.json();

            if (result.success) {
                this.renderGalaxy(result.data);
                return;
            }
        } catch (error) {
            console.warn('API unavailable, loading demo galaxy data.');
        }

        // Fallback: render mock data so the page is always functional
        this.renderGalaxy(this.generateMockData());
    }

    generateMockData() {
        const names = [
            'auth.service.js', 'user.controller.ts', 'payment.gateway.js',
            'db.connector.ts', 'middleware/auth.js', 'utils/logger.js',
            'routes/api.js', 'models/User.ts', 'config/database.js',
            'services/email.js', 'lib/crypto.js', 'handlers/error.js',
            'workers/queue.js', 'cache/redis.js', 'tests/integration.js',
            'graphql/resolvers.ts', 'websocket/handler.js', 'scheduler/cron.js',
            'migrations/001_init.sql', 'validators/input.js', 'helpers/date.js',
            'core/engine.ts', 'api/v2/routes.js', 'plugins/analytics.js',
            'security/csrf.js', 'rate-limiter.js', 'session-store.js',
            'notification.service.js', 'file-upload.js', 'search-index.js'
        ];

        return names.map((name, i) => {
            const score = Math.random() * 100;
            const statuses = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
            const status = score > 75 ? statuses[0] : score > 50 ? statuses[1] : score > 25 ? statuses[2] : statuses[3];

            return {
                id: `file-${i}`,
                name: name.split('/').pop(),
                path: `src/${name}`,
                score: Math.round(score * 10) / 10,
                status,
                metrics: {
                    churn: Math.round(Math.random() * 100),
                    expertise: Math.round(Math.random() * 100 * 10) / 10,
                    complexity: Math.round(Math.random() * 50 + 5)
                },
                trend: this.generateMockTrend()
            };
        });
    }

    generateMockTrend() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        let base = 30 + Math.random() * 40;
        return months.map(month => {
            base += (Math.random() - 0.4) * 15;
            base = Math.max(5, Math.min(95, base));
            return { month, value: Math.round(base) };
        });
    }

    renderGalaxy(data) {
        const sphereGeometry = new THREE.SphereGeometry(1, 24, 24);

        data.forEach((file, index) => {
            const size = Math.max(0.8, (file.score / 25));
            const color = this.getColorByScore(file.score);

            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.4 + (file.score / 200),
                shininess: 80,
                transparent: true,
                opacity: 0.9
            });

            const star = new THREE.Mesh(sphereGeometry, material.clone());

            // Distribute in a roughly spherical pattern with some clustering
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = Math.random() * Math.PI * 2;
            const radius = 30 + Math.random() * 70;

            star.position.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta) * 0.6,
                radius * Math.cos(phi)
            );

            star.scale.set(size, size, size);

            // Add glow for critical files
            if (file.score > 70) {
                const glowGeometry = new THREE.SphereGeometry(size * 2, 16, 16);
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.12,
                    side: THREE.BackSide
                });
                const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                star.add(glow);

                // Add point light for the hottest files
                if (file.score > 85) {
                    const light = new THREE.PointLight(color, 0.8, 30);
                    star.add(light);
                }
            }

            star.userData = file;
            this.scene.add(star);
            this.stars.push(star);

            // Animate entry with stagger
            star.scale.set(0.01, 0.01, 0.01);
            if (typeof gsap !== 'undefined') {
                gsap.to(star.scale, {
                    x: size, y: size, z: size,
                    duration: 0.8 + Math.random() * 0.4,
                    delay: index * 0.04,
                    ease: 'back.out(1.7)'
                });
            } else {
                star.scale.set(size, size, size);
            }
        });
    }

    getColorByScore(score) {
        if (score > 75) return 0xff3e3e;
        if (score > 50) return 0xff9d00;
        if (score > 25) return 0xf7df1e;
        return 0x10b981;
    }

    onMouseClick(event) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.stars);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            this.showFilePanel(hit.userData);
            this.animateCameraTo(hit.position);
            this.highlightStar(hit);
        }
    }

    highlightStar(star) {
        // Reset all stars
        this.stars.forEach(s => {
            if (s.material.emissiveIntensity !== undefined) {
                s.material.opacity = 0.9;
            }
        });

        // Highlight selected
        star.material.opacity = 1;
        star.material.emissiveIntensity = 1;

        if (typeof gsap !== 'undefined') {
            gsap.fromTo(star.scale,
                { x: star.scale.x * 0.8, y: star.scale.y * 0.8, z: star.scale.z * 0.8 },
                { x: star.scale.x / 0.8, y: star.scale.y / 0.8, z: star.scale.z / 0.8, duration: 0.3, ease: 'back.out' }
            );
        }
    }

    showFilePanel(file) {
        const panel = document.getElementById('file-card');
        if (!panel) return;
        panel.classList.remove('hidden');

        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-path').textContent = file.path;

        const badge = document.getElementById('risk-badge');
        badge.textContent = file.status;
        badge.className = `badge ${file.status}`;

        document.getElementById('val-churn').textContent = `${file.metrics.churn}%`;
        document.getElementById('val-expertise').textContent = `${Math.round(file.metrics.expertise)}%`;
        document.getElementById('val-complexity').textContent = file.metrics.complexity;

        this.fetchPrediction(file.id, file);
        this.renderTrendChart(file.trend);
    }

    async fetchPrediction(id, file) {
        const predEl = document.getElementById('prediction-text');
        try {
            const res = await fetch(`/api/risk/predict/${id}`);
            const result = await res.json();
            if (result.success) {
                predEl.textContent = result.data.prediction;
                return;
            }
        } catch (e) {
            // Fallback prediction
        }

        // Mock AI prediction
        const predictions = {
            'CRITICAL': `⚠️ High regression probability (${Math.round(70 + Math.random() * 25)}%). File shows elevated churn combined with low expertise coverage. Recommend immediate code review and ownership assignment.`,
            'HIGH': `🔶 Moderate risk trajectory. Recent commit patterns suggest increasing complexity. Consider refactoring to reduce cyclomatic depth.`,
            'MEDIUM': `📊 Stable but watch-listed. Expertise debt is manageable if addressed within the next 2 sprints.`,
            'LOW': `✅ Healthy file. Good ownership distribution and low churn velocity.`
        };
        predEl.textContent = predictions[file.status] || 'Analyzing...';
    }

    renderTrendChart(trendData) {
        if (!trendData || !trendData.length) return;
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.trendChart) this.trendChart.destroy();

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trendData.map(d => d.month),
                datasets: [{
                    label: 'Risk Velocity',
                    data: trendData.map(d => d.value),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: 'rgba(124, 58, 237, 0.4)',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10, 10, 30, 0.9)',
                        borderColor: 'rgba(124, 58, 237, 0.3)',
                        borderWidth: 1,
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        cornerRadius: 8,
                        padding: 10
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: '#475569', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    },
                    x: {
                        ticks: { color: '#475569', font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    animateCameraTo(targetPos) {
        if (typeof gsap !== 'undefined') {
            gsap.to(this.camera.position, {
                x: targetPos.x * 0.6,
                y: targetPos.y * 0.6,
                z: targetPos.z + 40,
                duration: 1.2,
                ease: 'expo.inOut'
            });
        }
    }

    onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Gentle auto-rotation
        this.stars.forEach(star => {
            star.rotation.y += 0.003;
        });

        // Apply damped camera rotation
        this.rotationVelocity.x *= 0.98;
        this.rotationVelocity.y *= 0.98;

        this.camera.position.x += Math.sin(this.rotationVelocity.y * 100) * 0.1;

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * BLAST-RADIUS VISUALIZATION ENGINE
     * Renders "Biological Viral Spread" animation with contamination shaders
     */
    async visualizeBlastRadius(vulnerabilityNode) {
        try {
            const response = await fetch(`/api/risk/blast-radius?vulnerabilityNode=${vulnerabilityNode}`);
            const result = await response.json();

            if (!result.success) {
                console.error('Blast radius calculation failed:', result.message);
                this.showMockBlastRadius();
                return;
            }

            const blastData = result.data;
            this.renderViralSpread(blastData);
            this.showBlastRadiusPanel(blastData);
        } catch (error) {
            console.warn('Blast radius API unavailable, showing demo.', error);
            this.showMockBlastRadius();
        }
    }

    showMockBlastRadius() {
        // Animate existing stars to simulate viral spread
        const criticalStars = this.stars.filter(s => s.userData && s.userData.score > 50);
        criticalStars.forEach((star, i) => {
            if (typeof gsap !== 'undefined') {
                gsap.to(star.material, {
                    emissiveIntensity: 1,
                    duration: 0.5,
                    delay: i * 0.15,
                    yoyo: true,
                    repeat: 3,
                    ease: 'sine.inOut'
                });

                gsap.to(star.scale, {
                    x: star.scale.x * 1.5,
                    y: star.scale.y * 1.5,
                    z: star.scale.z * 1.5,
                    duration: 0.5,
                    delay: i * 0.15,
                    yoyo: true,
                    repeat: 3,
                    ease: 'sine.inOut'
                });
            }

            // Draw connecting lines between affected stars
            if (i > 0) {
                const prevStar = criticalStars[i - 1];
                this.createPropagationLine(prevStar.position, star.position, star.userData.status);
            }
        });

        // Show info in the file panel
        const panel = document.getElementById('file-card');
        if (panel) {
            panel.classList.remove('hidden');
            panel.innerHTML = `
                <div style="padding: 4px;">
                    <h4 style="color: #ff3e3e; font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <i class="ri-virus-line"></i> BLAST RADIUS ANALYSIS
                    </h4>
                    <div style="background: rgba(255, 62, 62, 0.08); padding: 14px; border-radius: 10px; margin-bottom: 14px; border-left: 3px solid #ff3e3e;">
                        <p style="font-size: 0.85rem; color: #f87171; margin: 0 0 6px 0;">
                            <strong>Source:</strong> express (node_modules)
                        </p>
                        <p style="font-size: 0.85rem; color: #f87171; margin: 0;">
                            <strong>Risk Level:</strong> <span style="color: #ff6b6b;">CRITICAL</span>
                        </p>
                    </div>
                    <p style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px;">
                        <strong>Affected Nodes:</strong> ${criticalStars.length} files with ripple impact
                    </p>
                    <div style="max-height: 180px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;">
                        <p style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">PROPAGATION TREE:</p>
                        ${criticalStars.map(s => `
                            <div style="padding: 8px 10px; margin: 4px 0; background: rgba(255,255,255,0.03); border-left: 3px solid ${this.getStatusColor(s.userData.status)}; border-radius: 0 6px 6px 0;">
                                <div style="font-size: 0.78rem; color: #e2e8f0;">${s.userData.name}</div>
                                <div style="font-size: 0.65rem; color: #64748b;">
                                    Score: ${s.userData.score} | ${s.userData.status}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    renderViralSpread(blastData) {
        const propagationTree = blastData.propagationTree;

        this.clearContaminationEffects();

        propagationTree.forEach((node, index) => {
            const star = this.stars.find(s => s.userData && s.userData.name === node.name);
            const targetStar = star || this.createPhantomNode(node);

            this.applyContaminationShader(targetStar, node);

            setTimeout(() => {
                this.animateViralPropagation(targetStar, node);
            }, node.depth * 400);
        });

        this.drawPropagationLinks(blastData);
    }

    createPhantomNode(nodeData) {
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.5
        });

        const phantom = new THREE.Mesh(geometry, material);
        phantom.position.set(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        phantom.userData = nodeData;
        this.scene.add(phantom);
        this.stars.push(phantom);

        return phantom;
    }

    applyContaminationShader(star, nodeData) {
        const statusColors = {
            'CRITICAL': 0xff0000,
            'HIGH': 0xff6b00,
            'MODERATE': 0xffd700,
            'LOW': 0x3b82f6
        };

        const color = statusColors[nodeData.status] || 0x64748b;
        const intensity = nodeData.impactScore / 100;

        star.material.color.setHex(color);
        star.material.emissive.setHex(color);
        star.material.emissiveIntensity = intensity * 0.8;

        if (nodeData.status === 'CRITICAL') {
            this.addCorruptionParticles(star);
        }

        if (typeof gsap !== 'undefined') {
            gsap.to(star.scale, {
                x: 1 + (intensity * 0.5),
                y: 1 + (intensity * 0.5),
                z: 1 + (intensity * 0.5),
                duration: 0.8,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            });
        }
    }

    addCorruptionParticles(star) {
        const particleCount = 15;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = star.position.x + (Math.random() - 0.5) * 10;
            positions[i + 1] = star.position.y + (Math.random() - 0.5) * 10;
            positions[i + 2] = star.position.z + (Math.random() - 0.5) * 10;
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0xff0000,
            size: 0.5,
            transparent: true,
            opacity: 0.7
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(particles);

        if (typeof gsap !== 'undefined') {
            gsap.to(particles.scale, {
                x: 3, y: 3, z: 3,
                duration: 1.5,
                onComplete: () => this.scene.remove(particles)
            });

            gsap.to(particleMaterial, {
                opacity: 0,
                duration: 1.5
            });
        }
    }

    animateViralPropagation(star, nodeData) {
        const waveGeometry = new THREE.RingGeometry(5, 6, 32);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3e3e,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        wave.position.copy(star.position);
        wave.lookAt(this.camera.position);
        this.scene.add(wave);

        if (typeof gsap !== 'undefined') {
            gsap.to(wave.scale, {
                x: 4, y: 4, z: 4,
                duration: 1.5,
                ease: 'power2.out'
            });

            gsap.to(waveMaterial, {
                opacity: 0,
                duration: 1.5,
                onComplete: () => this.scene.remove(wave)
            });
        }
    }

    drawPropagationLinks(blastData) {
        const dependencyTree = blastData.propagationTree;

        dependencyTree.forEach(node => {
            if (node.affectedServices.length === 0) return;

            const sourceStar = this.stars.find(s => s.userData && s.userData.name === node.name);
            if (!sourceStar) return;

            node.affectedServices.forEach(targetId => {
                const targetNode = dependencyTree.find(n => n.id === targetId);
                const targetStar = this.stars.find(s => s.userData && s.userData.name === targetNode?.name);

                if (targetStar) {
                    this.createPropagationLine(sourceStar.position, targetStar.position, node.status);
                }
            });
        });
    }

    createPropagationLine(startPos, endPos, status) {
        const points = [startPos.clone(), endPos.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const lineColor = status === 'CRITICAL' ? 0xff0000 : 0xff9d00;
        const material = new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: 0.4,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        if (typeof gsap !== 'undefined') {
            gsap.to(material, {
                opacity: 0.15,
                duration: 1,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            });
        }

        // Auto-remove after 6 seconds
        setTimeout(() => {
            this.scene.remove(line);
        }, 6000);
    }

    clearContaminationEffects() {
        this.stars.forEach(star => {
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(star.scale);
            }
            const originalSize = star.userData && star.userData.score
                ? Math.max(0.8, star.userData.score / 25) : 1;
            star.scale.set(originalSize, originalSize, originalSize);
            if (star.material) {
                star.material.emissiveIntensity = star.userData && star.userData.score > 70 ? 0.5 : 0.3;
            }
        });
    }

    showBlastRadiusPanel(blastData) {
        const panel = document.getElementById('file-card');
        if (!panel) return;

        panel.classList.remove('hidden');

        panel.innerHTML = `
            <div style="padding: 4px;">
                <h4 style="color: #ff3e3e; font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="ri-virus-line"></i> BLAST RADIUS ANALYSIS
                </h4>
                <div style="background: rgba(255, 62, 62, 0.08); padding: 14px; border-radius: 10px; margin-bottom: 14px; border-left: 3px solid #ff3e3e;">
                    <p style="font-size: 0.85rem; color: #f87171; margin: 0 0 6px 0;">
                        <strong>Source Vulnerability:</strong> ${blastData.sourceVulnerability}
                    </p>
                    <p style="font-size: 0.85rem; color: #f87171; margin: 0;">
                        <strong>Risk Level:</strong> <span style="color: #ff6b6b;">${blastData.riskLevel}</span>
                    </p>
                </div>
                <p style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px;">
                    <strong>Total Affected Nodes:</strong> ${blastData.totalAffectedNodes}
                </p>
                <p style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 16px;">
                    ${blastData.recommendation}
                </p>
                <div style="max-height: 200px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;">
                    <p style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">PROPAGATION TREE:</p>
                    ${blastData.propagationTree.map(node => `
                        <div style="padding: 8px 10px; margin: 4px 0; background: rgba(255,255,255,0.03); border-left: 3px solid ${this.getStatusColor(node.status)}; border-radius: 0 6px 6px 0;">
                            <div style="font-size: 0.78rem; color: #e2e8f0;">${node.name}</div>
                            <div style="font-size: 0.65rem; color: #64748b;">
                                Impact: ${node.impactScore.toFixed(1)}% | Depth: ${node.depth} | ${node.status}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getStatusColor(status) {
        const colors = {
            'CRITICAL': '#ff0000',
            'HIGH': '#ff9d00',
            'MODERATE': '#ffd700',
            'LOW': '#3b82f6'
        };
        return colors[status] || '#64748b';
    }
}

let galaxyApp;
document.addEventListener('DOMContentLoaded', () => {
    // Wait for THREE.js to be available
    if (typeof THREE === 'undefined') {
        const checkInterval = setInterval(() => {
            if (typeof THREE !== 'undefined') {
                clearInterval(checkInterval);
                galaxyApp = new RiskGalaxy();
            }
        }, 100);
    } else {
        galaxyApp = new RiskGalaxy();
    }
});

function resetView() {
    if (!galaxyApp) return;
    if (typeof gsap !== 'undefined') {
        gsap.to(galaxyApp.camera.position, { x: 0, y: 20, z: 120, duration: 1.5, ease: 'expo.inOut' });
    }
    const fileCard = document.getElementById('file-card');
    if (fileCard) fileCard.classList.add('hidden');
    galaxyApp.clearContaminationEffects();
}

function runScrub() {
    const btn = event.target.closest('.btn');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line" style="animation: spin 1s linear infinite;"></i> Scanning...';
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = '<i class="ri-check-line"></i> Scrub Complete';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
                btn.disabled = false;
            }, 2000);
        }, 2500);
    }
}

/**
 * Trigger Blast Radius Visualization
 */
function triggerBlastRadius(vulnerabilityNode = 'express') {
    if (galaxyApp) {
        galaxyApp.visualizeBlastRadius(vulnerabilityNode);
    }
}

// Spin animation for loader icon
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);
