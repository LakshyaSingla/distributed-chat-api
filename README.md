# ⚡ ChatPulse — Distributed Real-Time Chat API

A production-grade real-time messaging backend built with **Node.js**, **Socket.io**, **PostgreSQL**, **MongoDB**, and **OAuth 2.0** (Google + GitHub).

---

## 🏗 Architecture

```
Browser (Demo UI)
      │ REST (Express)  + WSS (Socket.io)
      ▼
┌──────────────────────────────────────────┐
│              Node.js Server              │
│  REST Routes │ OAuth Callbacks │ WS Gate │
│  ─────────────────────────────────────── │
│              Service Layer               │
│  AuthService │ ChatService │ RoomService │
│  ─────────────────────────────────────── │
│  PostgreSQL (Sequelize)  MongoDB         │
│  Users, Rooms, Tokens    Messages        │
└──────────────────────────────────────────┘
        │                    │
   Google OAuth         GitHub OAuth
```

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🔐 OAuth 2.0 | Google + GitHub via Passport.js |
| 🔑 JWT Auth | Access (15m) + Refresh (7d) with token rotation & reuse detection |
| 🔄 Real-time | Socket.io with rooms, auto-reconnect |
| 💬 Messaging | Persisted to MongoDB, cursor-based pagination |
| 👥 Presence | Live online/offline status per room |
| ⌨️ Typing | Real-time typing indicators with debounce |
| 🏠 Rooms | Public/private rooms with role-based membership |
| 🛡 Security | Rate limiting, JWT guard, input validation (Joi), bcrypt token hashing |
| 🐳 Docker | Optional Docker Compose for containerized DB setup |

---

## 📋 Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **PostgreSQL** v15+ — [postgresql.org/download](https://www.postgresql.org/download/)
- **MongoDB** v7+ — [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/LakshyaSingla/distributed-chat-api.git
cd distributed-chat-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

After installing PostgreSQL, open **SQL Shell (psql)** and run:

```sql
CREATE USER chatuser WITH PASSWORD 'chatpassword';
CREATE DATABASE chatdb OWNER chatuser;
GRANT ALL PRIVILEGES ON DATABASE chatdb TO chatuser;
\q
```

### 4. Set up MongoDB

Install MongoDB Community Server and ensure it's running as a service.
No configuration needed — the app connects to `localhost:27017` without auth by default.

```bash
# Verify MongoDB is running (Windows)
Get-Service -Name MongoDB

# macOS/Linux
sudo systemctl status mongod
```

### 5. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your OAuth credentials (see below for how to get them):

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Optional — change if your DB credentials differ
POSTGRES_USER=chatuser
POSTGRES_PASSWORD=chatpassword
POSTGRES_DB=chatdb
MONGO_URI=mongodb://localhost:27017/chatdb
JWT_SECRET=any_long_random_string_at_least_32_chars
```

### 6. Get OAuth credentials (free)

**Google:**
1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth client ID → Web application
3. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Secret → paste into `.env`

**GitHub:**
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App
2. Authorization callback URL: `http://localhost:3000/auth/github/callback`
3. Copy Client ID and Secret → paste into `.env`

### 7. Start the server

```bash
npm run dev
```

Expected output:
```
✅ PostgreSQL connected
✅ PostgreSQL models synced
✅ MongoDB connected
🚀 Server running at http://localhost:3000
🎮 Demo UI:       http://localhost:3000/demo
❤️  Health check: http://localhost:3000/health
```

> Sequelize automatically creates all database tables on first run.

### 8. Open the demo UI

Navigate to **[http://localhost:3000/demo](http://localhost:3000/demo)**, sign in with Google or GitHub, create a room, and open a second tab to chat in real time.

---

## 🐳 Alternative: Docker Setup

If you have Docker Desktop installed, you can run the databases without a native install:

```bash
docker-compose up -d   # starts PostgreSQL + MongoDB
npm run dev
```

```bash
docker-compose down    # stop databases (keeps data)
docker-compose down -v # stop and wipe all data
```

---

## 📡 REST API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Redirect to Google consent |
| GET | `/auth/github` | Redirect to GitHub consent |
| POST | `/auth/refresh` | Rotate refresh token → new access token |
| POST | `/auth/logout` | Revoke all sessions |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/me` | JWT | Current user profile |
| GET | `/api/users/:id` | JWT | Public profile |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rooms` | JWT | List visible rooms |
| POST | `/api/rooms` | JWT | Create room |
| GET | `/api/rooms/:id` | JWT | Room + members |
| POST | `/api/rooms/:id/join` | JWT | Join room |
| POST | `/api/rooms/:id/leave` | JWT | Leave room |

### Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rooms/:id/messages?before=&limit=` | JWT | Paginated history |

---

## 🔌 WebSocket Events

Connect with Socket.io using your access token:
```js
const socket = io('http://localhost:3000', {
  auth: { token: '<access_token>' }
});
```

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId }` | Subscribe to room |
| `leave_room` | `{ roomId }` | Unsubscribe |
| `send_message` | `{ roomId, content, type? }` | Send message |
| `edit_message` | `{ messageId, roomId, content }` | Edit a message |
| `delete_message` | `{ messageId, roomId }` | Soft-delete |
| `typing_start` | `{ roomId }` | Broadcast typing |
| `typing_stop` | `{ roomId }` | Clear typing |

### Server → Client

| Event | Description |
|-------|-------------|
| `new_message` | Incoming message broadcast to room |
| `message_edited` | Updated message object |
| `message_deleted` | Tombstone `{ messageId }` |
| `room_joined` | Confirmation + current online users |
| `user_joined` | User entered room |
| `user_left` | User left room |
| `presence_update` | Online/offline status change |
| `user_typing` | Typing indicator relay |
| `error` | Auth or validation error |

---

## 🗄 Data Models

### PostgreSQL (Sequelize)

| Model | Key Fields |
|-------|-----------|
| `User` | id, username, email, avatarUrl, provider, providerId, providerKey |
| `Room` | id, name, description, isPrivate, createdBy |
| `RoomMember` | userId, roomId, role (admin/member), joinedAt |
| `RefreshToken` | userId, tokenHash (bcrypt), expiresAt, revokedAt |

### MongoDB (Mongoose)

| Model | Key Fields |
|-------|-----------|
| `Message` | roomId, senderId, senderUsername, content, type, editedAt, deleted |

---

## 📁 Project Structure

```
distributed-chat-api/
├── src/
│   ├── config/          # DB connections, env validation
│   ├── auth/            # Passport.js (Google + GitHub), JWT utils
│   ├── middleware/      # Auth guard, WS auth, rate limiter, error handler
│   ├── models/
│   │   ├── pg/          # Sequelize models + associations
│   │   └── mongo/       # Mongoose models
│   ├── routes/          # Express REST routes
│   ├── services/        # Business logic
│   ├── websocket/       # Socket.io gateway, handlers, presence
│   └── app.js           # Entry point
├── demo/                # Browser chat UI (vanilla JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml   # Optional: containerized DB setup
├── .env.example         # Environment variable template
└── README.md
```

---

## 🛠 Tech Stack

| Concern | Library |
|---------|---------|
| HTTP Framework | Express.js |
| WebSockets | Socket.io |
| Google OAuth | passport-google-oauth20 |
| GitHub OAuth | passport-github2 |
| JWT | jsonwebtoken |
| Token hashing | bcryptjs |
| PostgreSQL ORM | Sequelize + pg |
| MongoDB ODM | Mongoose |
| Validation | Joi |
| Rate limiting | express-rate-limit |
| Env validation | envalid |

---

## 📄 License

MIT
