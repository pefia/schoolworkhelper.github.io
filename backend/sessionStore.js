const crypto = require('crypto');

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function makeId() {
  return crypto.randomBytes(10).toString('hex');
}

function createSession(url) {
  const id = makeId();
  const now = Date.now();
  sessions.set(id, {
    baseUrl: url,
    cookies: {},
    lastPath: '/',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function updateSession(id, data) {
  const session = getSession(id);
  if (!session) return null;
  Object.assign(session, data, { updatedAt: Date.now() });
  sessions.set(id, session);
  return session;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

setInterval(cleanupExpiredSessions, 5 * 60 * 1000); // every 5 minutes

module.exports = {
  createSession,
  getSession,
  updateSession,
};
