const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { startRealTimeSimulation } = require("../services/analytics.socket.service");
const WarRoomSocket = require("./war-room.socket");
const globeController = require("../controllers/globe.controller");

let io;
const userSockets = new Map(); // userId -> Set of socket IDs
const watchlistRooms = new Map(); // watchlistId -> Set of userIds

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:8080",
            credentials: true,
        },
    });

    // Initialize War-Room socket handler
    // warRoomSocketHandler = new WarRoomSocket(io);

    // Authentication middleware for main namespace
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch (err) {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(`✅ User ${socket.userId} connected: ${socket.id}`);

        // Track user socket
        if (!userSockets.has(socket.userId)) {
            userSockets.set(socket.userId, new Set());
        }
        userSockets.get(socket.userId).add(socket.id);

        // Join collaboration room
        socket.on("join_collab", ({ roomId, userMetadata }) => {
            socket.join(`collab:${roomId}`);
            socket.userMetadata = userMetadata || { name: `User ${socket.userId.slice(-4)}` };

            if (!watchlistRooms.has(roomId)) {
                watchlistRooms.set(roomId, new Set());
            }
            watchlistRooms.get(roomId).add(socket.userId);

            socket.to(`collab:${roomId}`).emit("user_joined_collab", {
                userId: socket.userId,
                metadata: socket.userMetadata
            });

            const viewers = Array.from(watchlistRooms.get(roomId)).map(id => ({
                userId: id,
                metadata: { name: `User ${id.slice(-4)}` }
            }));
            socket.emit("presence_update", { roomId, viewers });
        });

        // Live Cursor Tracking
        socket.on("cursor_move", ({ roomId, x, y }) => {
            socket.to(`collab:${roomId}`).emit("cursor_update", {
                userId: socket.userId,
                x,
                y,
                metadata: socket.userMetadata
            });
        });

        // Typing Indicators
        socket.on("typing_status", ({ roomId, isTyping }) => {
            socket.to(`collab:${roomId}`).emit("user_typing", {
                userId: socket.userId,
                isTyping,
                metadata: socket.userMetadata
            });
        });

        // Leave collaboration
        socket.on("leave_collab", (roomId) => {
            socket.leave(`collab:${roomId}`);
            if (watchlistRooms.has(roomId)) {
                watchlistRooms.get(roomId).delete(socket.userId);
            }
            socket.to(`collab:${roomId}`).emit("user_left_collab", { userId: socket.userId });
        });

        // WAR ROOM: Join incident war room
        socket.on("join_war_room", (incidentId) => {
            const roomName = `war_room:${incidentId}`;
            socket.join(roomName);
            socket.currentWarRoom = incidentId;
            console.log(`🚨 User ${socket.userId} joined War Room: ${incidentId}`);

            socket.to(roomName).emit("war_room_user_joined", {
                userId: socket.userId,
                incidentId,
                timestamp: Date.now()
            });
        });

        // WAR ROOM: Sync 3D cursor position
        socket.on("war_room_cursor_move", (data) => {
            if (socket.currentWarRoom) {
                const roomName = `war_room:${socket.currentWarRoom}`;
                socket.to(roomName).emit("war_room_cursor_update", {
                    userId: socket.userId,
                    position: data.position,
                    color: data.color || '#60a5fa',
                    timestamp: Date.now()
                });
            }
        });

        // WAR ROOM: Sync camera position
        socket.on("war_room_camera_move", (data) => {
            if (socket.currentWarRoom) {
                const roomName = `war_room:${socket.currentWarRoom}`;
                socket.to(roomName).emit("war_room_camera_update", {
                    userId: socket.userId,
                    position: data.position,
                    target: data.target,
                    timestamp: Date.now()
                });
            }
        });

        // WAR ROOM: Create incident pin
        socket.on("war_room_create_pin", (data) => {
            if (socket.currentWarRoom) {
                const roomName = `war_room:${socket.currentWarRoom}`;
                const pin = {
                    id: `pin_${Date.now()}_${socket.userId}`,
                    userId: socket.userId,
                    position: data.position,
                    nodeId: data.nodeId,
                    message: data.message,
                    severity: data.severity || 'medium',
                    timestamp: Date.now()
                };
                io.to(roomName).emit("war_room_pin_created", pin);
            }
        });

        // WAR ROOM: Broadcast status update
        socket.on("war_room_status_update", (data) => {
            if (socket.currentWarRoom) {
                const roomName = `war_room:${socket.currentWarRoom}`;
                io.to(roomName).emit("war_room_status_broadcast", {
                    userId: socket.userId,
                    status: data.status,
                    message: data.message,
                    timestamp: Date.now()
                });
            }
        });

        // SECURITY WAR ROOM: Join security room
        socket.on("join_security_warroom", () => {
            socket.join("security_war_room");
            console.log(`🛡️ User ${socket.userId} joined Security War Room`);
        });

        // SECURITY WAR ROOM: Broadcast threat detection
        socket.on("security_broadcast", (threat) => {
            io.to("security_war_room").emit("new_threat_detected", {
                ...threat,
                detectedBy: socket.userId,
                timestamp: Date.now()
            });
        });

        // TRAFFIC OPS: Join traffic monitoring
        socket.on("join_traffic_ops", () => {
            socket.join("traffic_ops_room");
            console.log(`📡 User ${socket.userId} joined Global Traffic Ops`);
        });

        // TRAFFIC OPS: Broadcast orchestration shift
        socket.on("traffic_shift_broadcast", (event) => {
            io.to("traffic_ops_room").emit("global_traffic_rerouted", {
                ...event,
                orchestratedBy: 'AI_AUTONOMOUS_ENGINE',
                timestamp: Date.now()
            });
        });

        // QUANTUM ANOMALY: Join radar
        socket.on("join_quantum_radar", () => {
            socket.join("quantum_radar_room");
            console.log(`📡 User ${socket.userId} joined Quantum Anomaly Radar`);
        });

        // QUANTUM ANOMALY: Broadcast detection
        socket.on("quantum_anomaly_detected", (anomaly) => {
            io.to("quantum_radar_room").emit("anomaly_alert", anomaly);
        });

        // GOVERNANCE: Join governance monitors
        socket.on("join_governance", () => {
            socket.join("governance_room");
            console.log(`⚖️ User ${socket.userId} joined Governance Hub`);
        });

        // GOVERNANCE: Broadcast new proposal
        socket.on("proposal_created", (proposal) => {
            io.to("governance_room").emit("new_resolution", {
                ...proposal,
                serverTime: Date.now()
            });
        });

        // GOVERNANCE: Vote update
        socket.on("vote_cast", (data) => {
            io.to("governance_room").emit("resolution_vote_update", {
                proposalId: data.proposalId,
                currentVotes: data.currentVotes,
                totalNeeded: data.totalNeeded
            });
        });

        // Server → Client: push a single realtime notification directly to a user room
        // Called internally: io.to(`user:${userId}`).emit("notification_push", payload)
        // Exposed here as a broadcast relay from server logic
        socket.on("notification_send", ({ targetUserId, notification }) => {
            if (!targetUserId || !notification) return;
            io.to(`user:${targetUserId}`).emit("notification_push", {
                ...notification,
                sentAt: Date.now(),
                sentBy: socket.userId
            });
        });

        // ─── Issue #616: Burnout Detection ─────────────────────────────────
        // Join the team burnout monitoring room
        socket.on("join_burnout_monitor", ({ teamId }) => {
            const room = `burnout_monitor:${teamId || 'global'}`;
            socket.join(room);
            console.log(`🧠 User ${socket.userId} joined Burnout Monitor (${room})`);
        });

        // Broadcast a burnout alert to all monitors for this team
        socket.on("burnout_alert", ({ teamId, alert }) => {
            const room = `burnout_monitor:${teamId || 'global'}`;
            io.to(room).emit("burnout_alert", {
                ...alert,
                sentBy: socket.userId,
                timestamp: Date.now()
            });
            console.log(`🚨 Burnout alert broadcast to ${room}:`, alert?.username);
        });

        // Broadcast rebalance proposal to team lead monitors
        socket.on("rebalance_proposal", ({ teamId, proposal }) => {
            const room = `burnout_monitor:${teamId || 'global'}`;
            io.to(room).emit("rebalance_proposal", {
                ...proposal,
                proposedBy: 'BURNOUT_ENGINE',
                timestamp: Date.now()
            });
        });

        // DEPENDENCY RISK: Join CVE propagation monitoring room
        socket.on("join_cve_propagation", () => {
            socket.join("cve_propagation_room");
            console.log(`🔍 User ${socket.userId} joined CVE Propagation Monitor`);
        });

        // DEPENDENCY RISK: Broadcast new CVE propagation alert to all subscribers
        // Emitted server-side when a new vulnerable package scan completes.
        socket.on("cve_propagation_alert", (alertPayload) => {
            io.to("cve_propagation_room").emit("cve_propagation_alert", {
                ...alertPayload,
                detectedAt: Date.now(),
                source: 'PROPAGATION_ENGINE_v1'
            });
            console.log(`🚨 CVE propagation alert broadcast: ${alertPayload.vulnerablePackage}`);
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            console.log(`❌ User ${socket.userId} disconnected: ${socket.id}`);

            if (socket.currentWarRoom) {
                const roomName = `war_room:${socket.currentWarRoom}`;
                socket.to(roomName).emit("war_room_user_left", {
                    userId: socket.userId,
                    incidentId: socket.currentWarRoom,
                    timestamp: Date.now()
                });
            }

            if (userSockets.has(socket.userId)) {
                userSockets.get(socket.userId).delete(socket.id);
                if (userSockets.get(socket.userId).size === 0) {
                    userSockets.delete(socket.userId);
                }
            }

            watchlistRooms.forEach((viewers, roomId) => {
                if (viewers.has(socket.userId)) {
                    viewers.delete(socket.userId);
                    io.to(`collab:${roomId}`).emit("user_left_collab", { userId: socket.userId });
                }
            });
        });
    });

    console.log("🔌 WebSocket server initialized");

    // \u2500\u2500 Issue #615: Notification Engine \u2014 Late hook wired to io directly \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // These are global io-level hooks (not per-socket) for server-originated pushes.
    // Individual socket events (notification_ack, digest_flush) are handled per-socket above.

    startRealTimeSimulation(io);
    return io;
}

function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
}

function emitToUser(userId, event, data) {
    if (userSockets.has(userId)) {
        userSockets.get(userId).forEach((socketId) => {
            io.to(socketId).emit(event, data);
        });
    }
}

module.exports = {
    initializeSocket,
    getIO,
    emitToUser
};
