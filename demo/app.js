'use strict';

/* ─── Constants ───────────────────────────────────────────────────────────── */
const API = '';                       // Same origin
const TYPING_DEBOUNCE_MS = 1500;

/* ─── State ───────────────────────────────────────────────────────────────── */
let socket = null;
let currentUser = null;
let accessToken = null;
let refreshToken = null;
let currentRoomId = null;
let rooms = [];
let onlineUsers = {};          // userId → { username, avatarUrl }
let typingTimers = {};         // userId → timeout ID (receive)
let sendTypingTimer = null;    // debounce outgoing typing
let isTyping = false;
let messageCursors = {};       // roomId → cursor ISO string
let lastMessageGroupId = null; // for visual grouping
let lastMsgSenderId = null;

/* ─── DOM Refs ────────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const authScreen   = $('auth-screen');
const appScreen    = $('app-screen');
const userAvatar   = $('user-avatar');
const userName     = $('user-name');
const roomList     = $('room-list');
const onlineList   = $('online-list');
const onlineCount  = $('online-count');
const noRoom       = $('no-room');
const roomView     = $('room-view');
const messagesEl   = $('messages');
const msgForm      = $('msg-form');
const msgInput     = $('msg-input');
const typingEl     = $('typing-indicator');
const typingText   = $('typing-text');
const roomNameH    = $('room-name-header');
const roomDescH    = $('room-desc-header');
const memberAvsEl  = $('member-avatars');
const modalOverlay = $('modal-overlay');
const authError    = $('auth-error');
const toastCont    = $('toast-container');
const createRoomForm = $('create-room-form');

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  INIT                                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
(async function init() {
  // Check for OAuth redirect tokens in URL fragment
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (params.get('access') && params.get('refresh')) {
    accessToken  = params.get('access');
    refreshToken = params.get('refresh');
    sessionStorage.setItem('access',  accessToken);
    sessionStorage.setItem('refresh', refreshToken);
    // Clean URL
    history.replaceState(null, '', '/demo');
  } else {
    accessToken  = sessionStorage.getItem('access');
    refreshToken = sessionStorage.getItem('refresh');
  }

  // Check for auth error
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error')) {
    showAuthError('OAuth sign-in failed. Please try again.');
    history.replaceState(null, '', '/demo');
  }

  if (!accessToken) return showAuth();
  await tryLoadApp();
})();

/* ─── Auth ────────────────────────────────────────────────────────────────── */
function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

async function tryLoadApp() {
  try {
    currentUser = await apiFetch('/api/users/me');
    showApp();
    connectSocket();
    await loadRooms();
  } catch (err) {
    if (err.code === 'TOKEN_EXPIRED') {
      // Try refresh
      try {
        const data = await apiFetch('/auth/refresh', { method: 'POST', body: { refreshToken } });
        accessToken  = data.accessToken;
        refreshToken = data.refreshToken;
        sessionStorage.setItem('access',  accessToken);
        sessionStorage.setItem('refresh', refreshToken);
        await tryLoadApp();
      } catch {
        clearSession();
        showAuth();
      }
    } else {
      clearSession();
      showAuth();
    }
  }
}

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userAvatar.src = currentUser.avatarUrl || '';
  userAvatar.onerror = () => { userAvatar.style.display = 'none'; };
  userName.textContent = currentUser.username;
}

function clearSession() {
  sessionStorage.removeItem('access');
  sessionStorage.removeItem('refresh');
  accessToken = refreshToken = null;
  currentUser = null;
}

/* ─── Logout ──────────────────────────────────────────────────────────────── */
$('btn-logout').addEventListener('click', async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  if (socket) socket.disconnect();
  clearSession();
  showAuth();
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  API HELPER                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function apiFetch(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (accessToken) opts.headers['Authorization'] = `Bearer ${accessToken}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'API error');
    err.code = data.code;
    throw err;
  }
  return data;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SOCKET.IO                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */
function connectSocket() {
  socket = io({ auth: { token: accessToken }, transports: ['websocket', 'polling'] });

  socket.on('connect', () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', (r) => console.warn('🔌 Socket disconnected:', r));

  socket.on('new_message',    handleNewMessage);
  socket.on('message_edited', handleEditedMessage);
  socket.on('message_deleted',handleDeletedMessage);
  socket.on('user_joined',    handleUserJoined);
  socket.on('user_left',      handleUserLeft);
  socket.on('presence_update',handlePresence);
  socket.on('user_typing',    handleTyping);
  socket.on('room_joined',    handleRoomJoined);
  socket.on('error',          ({ message }) => toast(message, 'error'));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ROOMS                                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function loadRooms() {
  rooms = await apiFetch('/api/rooms');
  renderRoomList();
}

function renderRoomList() {
  roomList.innerHTML = '';
  rooms.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'room-item' + (r.id === currentRoomId ? ' active' : '');
    li.dataset.roomId = r.id;
    li.innerHTML = `<span class="room-item-hash">#</span><span>${escHtml(r.name)}</span>`;
    li.addEventListener('click', () => selectRoom(r));
    roomList.appendChild(li);
  });
}

async function selectRoom(room) {
  if (currentRoomId === room.id) return;

  // Leave old room
  if (currentRoomId) socket.emit('leave_room', { roomId: currentRoomId });

  currentRoomId = room.id;
  lastMsgSenderId = null;

  // Update sidebar
  renderRoomList();

  // Update header
  roomNameH.textContent = `#${room.name}`;
  roomDescH.textContent = room.description || '';

  // Show chat view
  noRoom.classList.add('hidden');
  roomView.classList.remove('hidden');

  // Clear messages
  messagesEl.innerHTML = '';
  typingEl.classList.add('hidden');

  // Join room via socket (auto-persists membership)
  socket.emit('join_room', { roomId: room.id });

  // Load message history
  await loadMessageHistory(room.id);
}

function handleRoomJoined({ roomId, onlineUsers: users }) {
  if (roomId !== currentRoomId) return;
  users.forEach((u) => {
    onlineUsers[u.userId] = u;
  });
  renderOnlineUsers();

  // Update member avatars in header
  renderMemberAvatars(users);
}

function renderMemberAvatars(users) {
  memberAvsEl.innerHTML = '';
  users.slice(0, 5).forEach((u) => {
    const img = document.createElement('img');
    img.className = 'avatar avatar-sm';
    img.src = u.avatarUrl || '';
    img.title = u.username;
    img.onerror = () => { img.style.display = 'none'; };
    memberAvsEl.appendChild(img);
  });
}

/* ─── Create room ─────────────────────────────────────────────────────────── */
$('btn-create-room').addEventListener('click', () => modalOverlay.classList.remove('hidden'));
$('btn-close-modal').addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });

createRoomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name      = $('room-name-input').value.trim();
  const description = $('room-desc-input').value.trim();
  const isPrivate = $('room-private-input').checked;
  try {
    const room = await apiFetch('/api/rooms', { method: 'POST', body: { name, description, isPrivate } });
    rooms.unshift(room);
    renderRoomList();
    modalOverlay.classList.add('hidden');
    createRoomForm.reset();
    toast(`Room #${room.name} created!`, 'success');
    selectRoom(room);
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MESSAGES                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
async function loadMessageHistory(roomId, before = null) {
  const qs = before ? `?before=${encodeURIComponent(before)}&limit=40` : '?limit=40';
  const { messages, cursor, hasMore } = await apiFetch(`/api/rooms/${roomId}/messages${qs}`);

  // Remove existing "load more" button
  const existingBtn = messagesEl.querySelector('.load-more-btn');
  if (existingBtn) existingBtn.remove();

  // Prepend historical messages
  if (hasMore) {
    const btn = document.createElement('button');
    btn.className = 'load-more-btn';
    btn.textContent = '⬆  Load earlier messages';
    btn.addEventListener('click', () => loadMessageHistory(roomId, cursor));
    messagesEl.prepend(btn);
  }

  // Insert messages AFTER the load-more button
  const fragment = document.createDocumentFragment();
  let prevSenderId = null;
  messages.forEach((msg) => {
    const continued = prevSenderId === msg.senderId;
    fragment.appendChild(buildMessageEl(msg, continued));
    prevSenderId = msg.senderId;
  });
  messagesEl.insertBefore(fragment, messagesEl.querySelector('.load-more-btn')?.nextSibling || null);

  // Save cursor
  if (cursor) messageCursors[roomId] = cursor;

  // Scroll to bottom on initial load
  if (!before) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function handleNewMessage(msg) {
  if (msg.roomId !== currentRoomId) return;
  const continued = lastMsgSenderId === msg.senderId;
  lastMsgSenderId = msg.senderId;
  const el = buildMessageEl(msg, continued);
  messagesEl.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function handleEditedMessage(msg) {
  const el = document.querySelector(`[data-msg-id="${msg._id}"] .msg-bubble`);
  if (!el) return;
  el.textContent = msg.content;
  const tag = document.querySelector(`[data-msg-id="${msg._id}"] .msg-edited-tag`);
  if (!tag) el.insertAdjacentHTML('afterend', '<span class="msg-edited-tag">(edited)</span>');
}

function handleDeletedMessage({ messageId }) {
  const el = document.querySelector(`[data-msg-id="${messageId}"] .msg-bubble`);
  if (el) { el.classList.add('msg-deleted'); el.textContent = 'This message was deleted.'; }
}

function buildMessageEl(msg, continued = false) {
  const isOwn = msg.senderId === currentUser?.id;
  const group = document.createElement('div');
  group.className = `msg-group${isOwn ? ' own' : ''}${continued ? ' continued' : ''}`;
  group.dataset.msgId = msg._id;

  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (msg.type === 'system') {
    group.className = 'msg-system';
    group.textContent = msg.content;
    return group;
  }

  const avatarSrc = msg.senderAvatar || '';
  const initials = (msg.senderUsername || '?')[0].toUpperCase();

  group.innerHTML = `
    <div class="msg-avatar">
      ${avatarSrc
        ? `<img class="avatar avatar-sm" src="${escHtml(avatarSrc)}" alt="${escHtml(msg.senderUsername)}" onerror="this.style.display='none'" />`
        : `<div class="avatar avatar-sm avatar-placeholder">${escHtml(initials)}</div>`
      }
    </div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-username">${escHtml(msg.senderUsername)}</span>
        <span class="msg-time">${time}</span>
      </div>
      <span class="msg-bubble${msg.deleted ? ' msg-deleted' : ''}">${escHtml(msg.content)}${msg.editedAt ? '<span class="msg-edited-tag">(edited)</span>' : ''}</span>
    </div>
  `;
  return group;
}

/* ─── Send message ────────────────────────────────────────────────────────── */
msgForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = msgInput.value.trim();
  if (!content || !currentRoomId) return;
  socket.emit('send_message', { roomId: currentRoomId, content });
  msgInput.value = '';
  msgInput.style.height = 'auto';
  stopTyping();
});

// Auto-grow textarea + typing events
msgInput.addEventListener('input', () => {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 150) + 'px';
  handleTypingStart();
});

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    msgForm.dispatchEvent(new Event('submit'));
  }
});

function handleTypingStart() {
  if (!currentRoomId) return;
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing_start', { roomId: currentRoomId });
  }
  clearTimeout(sendTypingTimer);
  sendTypingTimer = setTimeout(stopTyping, TYPING_DEBOUNCE_MS);
}

function stopTyping() {
  if (isTyping && currentRoomId) {
    isTyping = false;
    socket.emit('typing_stop', { roomId: currentRoomId });
  }
  clearTimeout(sendTypingTimer);
}

/* ─── Typing indicator (receive) ──────────────────────────────────────────── */
const typingUsers = new Set();

function handleTyping({ userId, username, roomId, typing }) {
  if (roomId !== currentRoomId || userId === currentUser?.id) return;
  if (typing) {
    typingUsers.add(username);
  } else {
    typingUsers.delete(username);
    clearTimeout(typingTimers[userId]);
  }
  // Auto-clear after 3s
  clearTimeout(typingTimers[userId]);
  if (typing) typingTimers[userId] = setTimeout(() => { typingUsers.delete(username); updateTypingUI(); }, 3000);
  updateTypingUI();
}

function updateTypingUI() {
  const names = [...typingUsers];
  if (names.length === 0) { typingEl.classList.add('hidden'); return; }
  typingEl.classList.remove('hidden');
  typingText.textContent =
    names.length === 1 ? `${names[0]} is typing…`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing…`
    : `${names[0]} and ${names.length - 1} others are typing…`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PRESENCE                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
function handlePresence({ userId, username, avatarUrl, status }) {
  if (status === 'online') {
    onlineUsers[userId] = { username, avatarUrl };
  } else {
    delete onlineUsers[userId];
  }
  renderOnlineUsers();
}

function handleUserJoined({ userId, username, avatarUrl, roomId }) {
  if (roomId !== currentRoomId) return;
  onlineUsers[userId] = { username, avatarUrl };
  renderOnlineUsers();
  appendSystemMessage(`${username} joined the room`);
}

function handleUserLeft({ userId, username, roomId }) {
  if (roomId !== currentRoomId) return;
  delete onlineUsers[userId];
  renderOnlineUsers();
  appendSystemMessage(`${username} left the room`);
}

function renderOnlineUsers() {
  const entries = Object.entries(onlineUsers);
  onlineCount.textContent = entries.length;
  onlineList.innerHTML = '';
  entries.forEach(([uid, u]) => {
    const li = document.createElement('li');
    li.className = 'online-item';
    const initials = (u.username || '?')[0].toUpperCase();
    li.innerHTML = `
      ${u.avatarUrl
        ? `<img class="avatar avatar-sm" src="${escHtml(u.avatarUrl)}" alt="" onerror="this.style.display='none'" />`
        : `<div class="avatar avatar-sm avatar-placeholder">${escHtml(initials)}</div>`}
      <span class="online-item-name">${escHtml(u.username)}</span>
      <span class="status-dot online"></span>
    `;
    onlineList.appendChild(li);
  });
}

/* ─── System message ──────────────────────────────────────────────────────── */
function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = text;
  messagesEl.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  TOASTS                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */
function toast(message, type = 'info', duration = 4000) {
  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
  toastCont.appendChild(t);

  setTimeout(() => {
    t.classList.add('leaving');
    t.addEventListener('animationend', () => t.remove());
  }, duration);
}

/* ─── Utils ───────────────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
