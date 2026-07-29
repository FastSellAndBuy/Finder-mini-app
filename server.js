const express = require('express');
const path = require('path');
const { PORT, BOT_TOKEN } = require('./config');
const { validateInitData } = require('./telegramAuth');
const { searchServers, searchUsers } = require('./disdex');
const {
  hasAccess,
  isAdmin,
  isBanned,
  createKey,
  redeemKey,
  banUser,
  unbanUser,
} = require('./keystore');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth middleware -------------------------------------------------

function requireTelegramUser(req, res, next) {
  const initData = req.header('X-Telegram-Init-Data');
  const result = validateInitData(initData, BOT_TOKEN);

  if (!result.ok) {
    res.status(401).json({ error: { message: `Unauthorized (${result.reason})` } });
    return;
  }

  req.tgUser = result.user;
  req.userId = String(result.user.id);
  next();
}

function requireAccess(req, res, next) {
  if (isBanned(req.userId) && !isAdmin(req.userId)) {
    res.status(403).json({ error: { message: 'You are banned from using this app.' } });
    return;
  }
  if (!hasAccess(req.userId)) {
    res.status(403).json({ error: { message: 'access_required' } });
    return;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.userId)) {
    res.status(403).json({ error: { message: 'Admins only.' } });
    return;
  }
  next();
}

// --- Session / access -------------------------------------------------

app.get('/api/me', requireTelegramUser, (req, res) => {
  res.json({
    id: req.userId,
    isAdmin: isAdmin(req.userId),
    isBanned: isBanned(req.userId) && !isAdmin(req.userId),
    hasAccess: hasAccess(req.userId),
  });
});

app.post('/api/redeem', requireTelegramUser, (req, res) => {
  const key = String(req.body?.key || '').trim();
  if (!key) {
    res.status(400).json({ error: { message: 'Missing key.' } });
    return;
  }

  const result = redeemKey(key, req.userId);
  if (result.ok) {
    res.json({ ok: true });
    return;
  }

  const message =
    result.reason === 'already_redeemed'
      ? 'That key has already been redeemed by someone else.'
      : "That key doesn't exist.";
  res.status(400).json({ error: { message } });
});

// --- Finder endpoints -------------------------------------------------

app.get('/api/servers', requireTelegramUser, requireAccess, async (req, res) => {
  try {
    const { q, sort, tag, tag_status, nsfw, vanity, offset, limit } = req.query;
    const result = await searchServers({
      q,
      sort,
      tag,
      tag_status,
      nsfw,
      vanity,
      offset,
      limit: limit || 20,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: { message: err.message } });
  }
});

app.get('/api/users', requireTelegramUser, requireAccess, async (req, res) => {
  try {
    const { q, type, sort, offset, limit } = req.query;
    const result = await searchUsers({ q, type, sort, offset, limit: limit || 20 });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: { message: err.message } });
  }
});

// --- Admin endpoints ---------------------------------------------------

app.post('/api/admin/keygen', requireTelegramUser, requireAdmin, (req, res) => {
  const assignTo = req.body?.targetUserId ? String(req.body.targetUserId) : null;
  const key = createKey(req.userId, assignTo);
  res.json({ key, assignedTo: assignTo });
});

app.post('/api/admin/ban', requireTelegramUser, requireAdmin, (req, res) => {
  const targetUserId = String(req.body?.targetUserId || '').trim();
  if (!targetUserId) {
    res.status(400).json({ error: { message: 'Missing targetUserId.' } });
    return;
  }
  if (isAdmin(targetUserId)) {
    res.status(400).json({ error: { message: "Can't ban another admin." } });
    return;
  }
  banUser(targetUserId);
  res.json({ ok: true });
});

app.post('/api/admin/unban', requireTelegramUser, requireAdmin, (req, res) => {
  const targetUserId = String(req.body?.targetUserId || '').trim();
  if (!targetUserId) {
    res.status(400).json({ error: { message: 'Missing targetUserId.' } });
    return;
  }
  const wasBanned = unbanUser(targetUserId);
  res.json({ ok: true, wasBanned });
});

app.listen(PORT, () => {
  console.log(`disdex mini app server listening on port ${PORT}`);
});
