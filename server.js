require('dotenv').config();
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

const PORT = process.env.PORT || 3004;
const SOCKET_SECRET = process.env.SOCKET_SECRET || 'sec_socket_emwebtech_984288';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// SSL Certificate Paths (Let's Encrypt on Hostinger VPS)
const sslKeyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/srv1250341.hstgr.cloud/privkey.pem';
const sslCertPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/srv1250341.hstgr.cloud/fullchain.pem';

let server;
let protocol = 'http';

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    try {
        server = https.createServer({
            key: fs.readFileSync(sslKeyPath),
            cert: fs.readFileSync(sslCertPath),
        }, app);
        protocol = 'https';
        console.log('[SSL] HTTPS enabled with Let\'s Encrypt certificate');
    } catch (e) {
        console.warn('[SSL] Failed to load SSL, falling back to HTTP:', e.message);
        server = http.createServer(app);
    }
} else {
    server = http.createServer(app);
}

// Middlewares
app.use(cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Socket.io initialization with CORS
const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        server: 'EM Web Tech Real-Time Socket Server',
        protocol: protocol,
        port: PORT,
        uptime_seconds: Math.floor(process.uptime()),
        connected_clients: io.engine.clientsCount,
        timestamp: new Date().toISOString(),
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EM Web Tech Socket Server</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #1e293b; padding: 32px 48px; border-radius: 12px; border: 1px solid #334155; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
                h1 { color: #38bdf8; margin: 0 0 8px 0; font-size: 24px; }
                p { color: #94a3b8; font-size: 14px; margin: 4px 0 16px 0; }
                .badge { background: #10b981; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .meta { font-family: monospace; font-size: 12px; color: #64748b; margin-top: 16px; }
            </style>
        </head>
        <body>
            <div class="box">
                <span class="badge">ONLINE & ACTIVE</span>
                <h1>EM Web Tech Socket Server</h1>
                <p>Real-Time WebSockets Engine for WhatsApp & CRM Notifications</p>
                <div class="meta">Protocol: ${protocol.toUpperCase()} | Port: ${PORT} | Active Clients: ${io.engine.clientsCount}</div>
            </div>
        </body>
        </html>
    `);
});

// Broadcast API: Called by Laravel backend (SocketServerService)
app.post('/api/broadcast', (req, res) => {
    const providedSecret = req.headers['x-socket-secret'];
    if (providedSecret !== SOCKET_SECRET) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid socket broadcast secret.',
        });
    }

    const { event, data, room } = req.body;

    if (!event) {
        return res.status(422).json({
            success: false,
            message: 'Missing required parameter: event',
        });
    }

    try {
        if (room) {
            // Emit to specific room (e.g. 'vendor_1', 'user_548', 'session_12')
            io.to(room).emit(event, data);
        } else {
            // Emit globally
            io.emit(event, data);
        }

        return res.json({
            success: true,
            event,
            room: room || 'global',
            clients_targeted: io.engine.clientsCount,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[Broadcast Error]:', err);
        return res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

// Socket.io Connection & Room Handling
io.on('connection', (socket) => {
    console.log(`[Socket Connected] Client ID: ${socket.id} (Total: ${io.engine.clientsCount})`);

    // Join room event (e.g., 'vendor_1', 'user_548', 'session_12')
    socket.on('join_room', (room) => {
        if (room) {
            socket.join(room);
            console.log(`[Socket] ${socket.id} joined room: ${room}`);
        }
    });

    // Leave room event
    socket.on('leave_room', (room) => {
        if (room) {
            socket.leave(room);
            console.log(`[Socket] ${socket.id} left room: ${room}`);
        }
    });

    // WebRTC Signaling support (for live calling / audio)
    socket.on('webrtc_offer', (data) => {
        if (data && data.room) {
            socket.to(data.room).emit('webrtc_offer', data);
        }
    });

    socket.on('webrtc_answer', (data) => {
        if (data && data.room) {
            socket.to(data.room).emit('webrtc_answer', data);
        }
    });

    socket.on('webrtc_ice_candidate', (data) => {
        if (data && data.room) {
            socket.to(data.room).emit('webrtc_ice_candidate', data);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`[Socket Disconnected] Client ID: ${socket.id} Reason: ${reason} (Remaining: ${io.engine.clientsCount})`);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 EM Web Tech Socket Server Running on Port ${PORT} (${protocol.toUpperCase()})`);
    console.log(`📡 URL: ${protocol}://srv1250341.hstgr.cloud:${PORT}`);
    console.log(`🔒 Secret Configured: ${SOCKET_SECRET.substring(0, 10)}...`);
    console.log('====================================================');
});
