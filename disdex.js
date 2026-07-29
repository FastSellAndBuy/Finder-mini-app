const DISDEX_BASE = 'https://disdex.io/api/v1';

function buildUrl(pathname, params = {}) {
  const url = new URL(`${DISDEX_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function disdexGet(pathname, params = {}) {
  const url = buildUrl(pathname, params);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    let message = `disdex API returned ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  return res.json();
}

function searchServers(params) {
  return disdexGet('/servers', params);
}

function searchUsers(params) {
  return disdexGet('/users', params);
}

module.exports = { searchServers, searchUsers };
