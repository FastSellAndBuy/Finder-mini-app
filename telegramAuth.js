const crypto = require('crypto');

const MAX_AGE_SECONDS = 24 * 60 * 60; // reject stale sessions after a day

/**
 * Verifies the initData string a Telegram Mini App sends on every request
 * really was issued by Telegram for this bot, per:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @returns {{ ok: true, user: { id: number, username?: string, first_name?: string } } | { ok: false, reason: string }}
 */
function validateInitData(initData, botToken) {
  if (!initData) return { ok: false, reason: 'missing_init_data' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return { ok: false, reason: 'bad_signature' };

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return { ok: false, reason: 'expired' };
  }

  let user;
  try {
    user = JSON.parse(params.get('user'));
  } catch {
    return { ok: false, reason: 'bad_user_payload' };
  }

  if (!user?.id) return { ok: false, reason: 'missing_user' };

  return { ok: true, user };
}

module.exports = { validateInitData };
