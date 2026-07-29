require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.warn('[config] TELEGRAM_BOT_TOKEN missing — initData validation will reject every request.');
}
if (ADMIN_IDS.length === 0) {
  console.warn('[config] No ADMIN_IDS set — nobody will be able to generate keys, ban, or unban.');
}

module.exports = { BOT_TOKEN, ADMIN_IDS, PORT };
