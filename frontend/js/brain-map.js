/**
 * XAYTHEON — Neural Brain Map JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    let brainData = { nodes: [], edges: [] };
    let socket;

    init();

    async function init() {
        initSocket();
        await fetchTopology();
        render();
    }

    function initSocket() {
        if (typeof io !== 'undefined') {
            socket = io();
            socket.emit('join_neural_brain');
            socket.on('brain_map_update', (data) => {
                brainData = data;
                render();
                showToast('🧠 Synaptic Sync', 'Knowledge graph synchronized with server state.', 'success');
            });
        }
    }

    async function fetchTopology() {
        const res = await fetch('/api/brain/topology');
        const json = await res.json();
        if (json.success) brainData = json.brain;
    }

    function render() {
        const canvas = document.getElementById('brain-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Simple Circle Layout
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.7;

        const nodePositions = {};

        // Draw Edges
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.2)';
        ctx.lineWidth = 1;

        brainData.nodes.forEach((node, i) => {
            const angle = (i / brainData.nodes.length) * Math.PI * 2;
            nodePositions[node.id] = {
                x: centerX + Math.cos(angle) * (node.type === 'domain' ? radius : radius * 1.3),
                y: centerY + Math.sin(angle) * (node.type === 'domain' ? radius : radius * 1.3)
            };
        });

        brainData.edges.forEach(edge => {
            const start = nodePositions[edge.from];
            const end = nodePositions[edge.to];
            if (start && end) {
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
        });

        // Draw Nodes
        brainData.nodes.forEach(node => {
            const pos = nodePositions[node.id];
            ctx.fillStyle = node.type === 'domain' ? '#c084fc' : '#a1a1aa';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, node.type === 'domain' ? 8 : 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '10px Inter';
            ctx.fillText(node.id, pos.x + 10, pos.y + 3);
        });
    }

    function showToast(title, msg, type) {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<strong>${title}</strong><p>${msg}</p>`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('visible'), 100);
        setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 4000);
    }
});
