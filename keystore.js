const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ADMIN_IDS } = require('./config');

const STORE_PATH = path.join(__dirname, 'data', 'store.json');

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) {
    return { keys: {}, authorized: {}, banned: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (err) {
    console.error('[keystore] Failed to parse store.json, starting fresh:', err);
    return { keys: {}, authorized: {}, banned: {} };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function generateKeyString() {
  return `fk_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * @param {string} createdBy - admin's Telegram user ID (as a string)
 * @param {string|null} assignTo - if given, immediately grants access to this user ID
 */
function createKey(createdBy, assignTo = null) {
  const store = loadStore();
  const key = generateKeyString();

  store.keys[key] = {
    createdBy,
    createdAt: new Date().toISOString(),
    redeemedBy: assignTo,
    redeemedAt: assignTo ? new Date().toISOString() : null,
  };

  if (assignTo) {
    store.authorized[assignTo] = { key, grantedAt: new Date().toISOString() };
    delete store.banned[assignTo];
  }

  saveStore(store);
  return key;
}

function redeemKey(key, userId) {
  const store = loadStore();
  const entry = store.keys[key];

  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.redeemedBy) return { ok: false, reason: 'already_redeemed' };

  entry.redeemedBy = userId;
  entry.redeemedAt = new Date().toISOString();
  store.authorized[userId] = { key, grantedAt: entry.redeemedAt };
  delete store.banned[userId];

  saveStore(store);
  return { ok: true };
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

function isBanned(userId) {
  const store = loadStore();
  return Boolean(store.banned[userId]);
}

function hasAccess(userId) {
  if (isAdmin(userId)) return true;
  const store = loadStore();
  if (store.banned[userId]) return false;
  return Boolean(store.authorized[userId]);
}

function banUser(userId) {
  const store = loadStore();
  store.banned[userId] = { bannedAt: new Date().toISOString() };
  saveStore(store);
}

function unbanUser(userId) {
  const store = loadStore();
  const wasBanned = Boolean(store.banned[userId]);
  delete store.banned[userId];
  saveStore(store);
  return wasBanned;
}

module.exports = {
  createKey,
  redeemKey,
  isAdmin,
  isBanned,
  hasAccess,
  banUser,
  unbanUser,
};
