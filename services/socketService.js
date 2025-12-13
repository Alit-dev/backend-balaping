const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketService {
    constructor() {
        this.io = null;
    }

    init(server) {
        this.io = socketIo(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:5173',
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        this.io.use((socket, next) => {
            if (socket.handshake.query && socket.handshake.query.token) {
                jwt.verify(socket.handshake.query.token, process.env.JWT_SECRET, (err, decoded) => {
                    if (err) return next(new Error('Authentication error'));
                    socket.decoded = decoded;
                    next();
                });
            } else {
                next(new Error('Authentication error'));
            }
        });

        this.io.on('connection', (socket) => {
            console.log('New client connected', socket.id);

            // Join user to their own room
            socket.join(`user:${socket.decoded.id}`);

            socket.on('join_team', (teamId) => {
                // Verify user belongs to team (simplified for now, ideally check DB)
                console.log(`Socket ${socket.id} joined team ${teamId}`);
                socket.join(`team:${teamId}`);
            });

            socket.on('leave_team', (teamId) => {
                console.log(`Socket ${socket.id} left team ${teamId}`);
                socket.leave(`team:${teamId}`);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected', socket.id);
            });
        });

        return this.io;
    }

    getIO() {
        if (!this.io) {
            throw new Error('Socket.io not initialized!');
        }
        return this.io;
    }

    emitToTeam(teamId, event, data) {
        if (this.io) {
            this.io.to(`team:${teamId}`).emit(event, data);
        }
    }

    emitToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user:${userId}`).emit(event, data);
        }
    }
}

module.exports = new SocketService();
