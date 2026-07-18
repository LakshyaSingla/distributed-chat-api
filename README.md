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
| 🔑 JWT Auth | Access (15m) + Refresh (7d) with token rotation |
| 🔄 Real-time | Socket.io with auto-reconnect |
| 💬 Messaging | Persist to MongoDB, cursor-based pagination |
| 👥 Presence | Live online/offline status per room |
| ⌨️ Typing | Real-time typing indicators |
| 🏠 Rooms | Public/private rooms with role-based membership |
| 🛡 Security | Rate limiting, JWT guard, input validation (Joi) |
| 🐳 Docker | One-command database startup |

---

## 📋 Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Docker Desktop** ([docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)) — free

---

## 🚀 Quick Start

### 1. Clone / open the project

```bash
cd distributed-chat-api
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Then edit `.env` with your OAuth credentials (see below).

### 3. Create OAuth credentials (free)

#### Google

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:3000/auth/google/callback`
5. Copy **Client ID** and **Client Secret** → paste into `.env`

#### GitHub

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:3000/auth/github/callback`
4. Copy **Client ID** and generate a **Client Secret** → paste into `.env`

### 4. Start databases

```bash
docker-compose up -d
```

This starts PostgreSQL 15 and MongoDB 7 with persistent volumes.

### 5. Start the server

```bash
npm run dev
```

### 6. Open the demo UI

Navigate to **[http://localhost:3000/demo](http://localhost:3000/demo)**

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

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | Message object | Incoming message |
| `message_edited` | Updated message | Message updated |
| `message_deleted` | `{ messageId }` | Tombstone |
| `room_joined` | `{ roomId, onlineUsers }` | Confirmation |
| `user_joined` | `{ roomId, userId, username }` | User entered room |
| `user_left` | `{ roomId, userId, username }` | User left room |
| `presence_update` | `{ userId, status }` | Online/offline |
| `user_typing` | `{ roomId, userId, username, typing }` | Typing indicator |
| `error` | `{ message }` | Error event |

---

## 🗄 Data Models

### PostgreSQL (relational)

- **User** — id, username, email, avatarUrl, provider, providerId
- **Room** — id, name, description, isPrivate, createdBy
- **RoomMember** — userId, roomId, role (admin/member)
- **RefreshToken** — userId, tokenHash (bcrypt), expiresAt, revokedAt

### MongoDB (unstructured)

- **Message** — roomId, senderId, senderUsername, content, type, editedAt, deleted

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
├── demo/                # Browser chat UI
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🛑 Stopping

```bash
# Stop the server: Ctrl+C
# Stop databases:
docker-compose down
# Stop and remove all data:
docker-compose down -v
```
