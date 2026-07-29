const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setBackgroundColor('#0b1220');
  tg.setHeaderColor('#0b1220');
}

const initData = tg?.initData || '';

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Request failed (${res.status})`);
  }
  return body;
}

const el = (id) => document.getElementById(id);
const statusPill = el('statusPill');

function setStatus(text) {
  statusPill.textContent = text;
}

// ---------------------------------------------------------------------
// Bootstrapping / access gating
// ---------------------------------------------------------------------

async function bootstrap() {
  if (!initData) {
    setStatus('open in telegram');
    el('lockedPanel').hidden = false;
    el('lockedPanel').querySelector('p').textContent =
      'This app only works when opened inside Telegram.';
    el('redeemForm').hidden = true;
    return;
  }

  try {
    const me = await api('/api/me');
    setStatus(me.isAdmin ? 'admin' : me.hasAccess ? 'authorized' : 'locked');

    if (me.isBanned) {
      el('bannedPanel').hidden = false;
      return;
    }

    if (!me.hasAccess) {
      el('lockedPanel').hidden = false;
      return;
    }

    el('tabs').hidden = false;
    el('serversPanel').hidden = false;
    if (me.isAdmin) el('adminTabBtn').hidden = false;

    loadServers(true);
  } catch (err) {
    setStatus('error');
    el('lockedPanel').hidden = false;
    el('lockedPanel').querySelector('h1').textContent = 'Something went wrong';
    el('lockedPanel').querySelector('p').textContent = err.message;
    el('redeemForm').hidden = true;
  }
}

el('redeemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = el('redeemInput').value.trim();
  el('redeemError').hidden = true;
  if (!key) return;

  try {
    await api('/api/redeem', { method: 'POST', body: JSON.stringify({ key }) });
    location.reload();
  } catch (err) {
    el('redeemError').textContent = err.message;
    el('redeemError').hidden = false;
  }
});

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = true));
    btn.classList.add('active');
    el(`${btn.dataset.tab}Panel`).hidden = false;
  });
});

[['serversFilterToggle', 'serversFilters'], ['usersFilterToggle', 'usersFilters']].forEach(
  ([btnId, panelId]) => {
    el(btnId).addEventListener('click', () => {
      const panel = el(panelId);
      const willShow = panel.hidden;
      panel.hidden = !willShow;
      el(btnId).setAttribute('aria-expanded', String(willShow));
    });
  }
);

// ---------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------

const serverCardTpl = el('serverCardTemplate');
const serverState = { offset: 0, hasMore: true, loading: false, count: 0 };

function currentServerFilters() {
  return {
    q: el('serversQuery').value.trim(),
    sort: el('serversSort').value,
    tag: el('serversTag').value.trim(),
    tag_status: el('serversTagStatus').value,
    nsfw: el('serversNsfw').value,
    vanity: el('serversVanity').value,
  };
}

function renderServerCard(server) {
  const node = serverCardTpl.content.cloneNode(true);
  serverState.count += 1;
  node.querySelector('.card-index').textContent = String(serverState.count).padStart(3, '0');

  const icon = node.querySelector('.card-icon');
  if (server.icon_url) icon.style.backgroundImage = `url(${server.icon_url})`;

  node.querySelector('.card-title').textContent = server.name;
  node.querySelector('.card-desc').textContent = server.description || 'No description';
  node.querySelector('.stat-members').textContent = (server.members ?? 0).toLocaleString();
  node.querySelector('.stat-online').textContent = (server.online ?? 0).toLocaleString();
  node.querySelector('.stat-boosts').textContent = String(server.boosts ?? 0);

  if (server.tag?.name) {
    const tagEl = node.querySelector('.card-tag');
    tagEl.hidden = false;
    tagEl.textContent = `#${server.tag.name}${server.tag.active ? '' : ' · inactive'}`;
  }

  if (server.invite_url) {
    const inviteEl = node.querySelector('.card-invite');
    inviteEl.hidden = false;
    inviteEl.href = server.invite_url;
  }

  return node;
}

async function loadServers(reset) {
  if (serverState.loading) return;
  serverState.loading = true;

  if (reset) {
    serverState.offset = 0;
    serverState.hasMore = true;
    serverState.count = 0;
    el('serversResults').innerHTML = '';
    el('serversEmpty').hidden = true;
  }

  el('serversScan').hidden = false;
  el('serversLoadMore').hidden = true;

  try {
    const params = new URLSearchParams({
      ...currentServerFilters(),
      offset: String(serverState.offset),
      limit: '20',
    });
    const result = await api(`/api/servers?${params.toString()}`);

    for (const server of result.data || []) {
      el('serversResults').appendChild(renderServerCard(server));
    }

    serverState.offset += (result.data || []).length;
    serverState.hasMore = Boolean(result.has_more);

    if (serverState.count === 0) el('serversEmpty').hidden = false;
    el('serversLoadMore').hidden = !serverState.hasMore;
  } catch (err) {
    setStatus('error');
    alert(`disdex lookup failed: ${err.message}`);
  } finally {
    el('serversScan').hidden = true;
    serverState.loading = false;
  }
}

el('serversForm').addEventListener('submit', (e) => e.preventDefault());
el('serversQuery').addEventListener('change', () => loadServers(true));
el('serversApply').addEventListener('click', () => loadServers(true));
el('serversLoadMore').addEventListener('click', () => loadServers(false));

// ---------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------

const userCardTpl = el('userCardTemplate');
const userState = { offset: 0, hasMore: true, loading: false, count: 0 };

function currentUserFilters() {
  return {
    q: el('usersQuery').value.trim(),
    sort: el('usersSort').value,
    type: el('usersType').value,
  };
}

function renderUserCard(user) {
  const node = userCardTpl.content.cloneNode(true);
  userState.count += 1;
  node.querySelector('.card-index').textContent = String(userState.count).padStart(3, '0');

  const icon = node.querySelector('.card-icon');
  if (user.avatar_url) icon.style.backgroundImage = `url(${user.avatar_url})`;

  node.querySelector('.card-title').textContent = user.global_name || user.username;
  node.querySelector('.card-desc').textContent = `@${user.username}${user.is_bot ? ' · bot' : ''}`;
  node.querySelector('.stat-servers').textContent = String(user.server_count ?? 0);
  node.querySelector('.stat-invites').textContent = String(user.invite_count ?? 0);

  return node;
}

async function loadUsers(reset) {
  if (userState.loading) return;
  userState.loading = true;

  if (reset) {
    userState.offset = 0;
    userState.hasMore = true;
    userState.count = 0;
    el('usersResults').innerHTML = '';
    el('usersEmpty').hidden = true;
  }

  el('usersScan').hidden = false;
  el('usersLoadMore').hidden = true;

  try {
    const params = new URLSearchParams({
      ...currentUserFilters(),
      offset: String(userState.offset),
      limit: '20',
    });
    const result = await api(`/api/users?${params.toString()}`);

    for (const user of result.data || []) {
      el('usersResults').appendChild(renderUserCard(user));
    }

    userState.offset += (result.data || []).length;
    userState.hasMore = Boolean(result.has_more);

    if (userState.count === 0) el('usersEmpty').hidden = false;
    el('usersLoadMore').hidden = !userState.hasMore;
  } catch (err) {
    setStatus('error');
    alert(`disdex lookup failed: ${err.message}`);
  } finally {
    el('usersScan').hidden = true;
    userState.loading = false;
  }
}

el('usersForm').addEventListener('submit', (e) => e.preventDefault());
el('usersQuery').addEventListener('change', () => loadUsers(true));
el('usersApply').addEventListener('click', () => loadUsers(true));
el('usersLoadMore').addEventListener('click', () => loadUsers(false));

document.querySelector('[data-tab="users"]').addEventListener('click', () => {
  if (userState.count === 0) loadUsers(true);
});

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

el('keygenForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const target = el('keygenTarget').value.trim();
  const resultEl = el('keygenResult');
  resultEl.hidden = true;

  try {
    const result = await api('/api/admin/keygen', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: target || undefined }),
    });
    resultEl.textContent = result.assignedTo
      ? `Granted to ${result.assignedTo} — key: ${result.key}`
      : `Unassigned key: ${result.key}`;
    resultEl.hidden = false;
    el('keygenTarget').value = '';
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.hidden = false;
  }
});

el('banForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const target = el('banTarget').value.trim();
  const resultEl = el('banResult');
  resultEl.hidden = true;

  try {
    await api('/api/admin/ban', { method: 'POST', body: JSON.stringify({ targetUserId: target }) });
    resultEl.textContent = `${target} banned.`;
    resultEl.hidden = false;
    el('banTarget').value = '';
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.hidden = false;
  }
});

el('unbanForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const target = el('unbanTarget').value.trim();
  const resultEl = el('unbanResult');
  resultEl.hidden = true;

  try {
    await api('/api/admin/unban', { method: 'POST', body: JSON.stringify({ targetUserId: target }) });
    resultEl.textContent = `${target} unbanned.`;
    resultEl.hidden = false;
    el('unbanTarget').value = '';
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.hidden = false;
  }
});

bootstrap();
