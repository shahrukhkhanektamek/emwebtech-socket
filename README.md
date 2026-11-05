# EM Web Tech Dedicated Socket Server (WebSockets / WebRTC)

Dedicated self-hosted real-time WebSocket server for **EM Web Tech CRM & WhatsApp Team Inbox**.

---

## 🚀 Quick Start (Local Development)

### 1. Install dependencies
```bash
cd socket-server
npm install
```

### 2. Start server
```bash
node server.js
```
The server runs on `http://localhost:6001`.

---

## 🌐 Deploying to VPS (Production)

### 1. Run with PM2 (Auto-restart & Background Service)
```bash
npm install -g pm2
pm2 start server.js --name "emwebtech-socket"
pm2 save
pm2 startup
```

### 2. Nginx Reverse Proxy with SSL (Optional / Recommended)
If your site uses HTTPS (`https://lead.emwebandappsolution.com`), configure Nginx on your VPS to proxy WebSocket connections:

```nginx
server {
    server_name socket.emwebandappsolution.com;

    location / {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    listen 443 ssl;
    # ssl_certificate ...
}
```

### 3. Change URL in CRM `.env`
When deployed on VPS, simply update in `emwebtechlead/.env`:
```env
SOCKET_SERVER_URL=https://socket.emwebandappsolution.com
VITE_SOCKET_SERVER_URL=https://socket.emwebandappsolution.com
```
And in `socket-server/.env`:
```env
PORT=6001
SOCKET_SECRET=sec_socket_emwebtech_984288
CORS_ORIGIN=*
```
Nothing else needs to be changed!

---

## 📡 API Endpoints

- `GET /health` -> Server status & connected clients count
- `POST /api/broadcast` -> Broadcast event from Laravel backend:
  - Header: `X-Socket-Secret: sec_socket_emwebtech_984288`
  - Body:
    ```json
    {
      "event": "message:received",
      "room": "vendor_1",
      "data": { ... }
    }
    ```
