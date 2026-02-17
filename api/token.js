// api/token.js
// The extension polls this endpoint every 2 seconds after starting the OAuth flow.
// When the token is ready (stored by /api/callback), this returns it once and deletes it.

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export default function handler(req, res) {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const store = global.tokenStore || {};
  const entry = store[key];

  // No token yet — still waiting for the user to complete OAuth
  if (!entry) {
    return res.json({ pending: true });
  }

  // Token has expired (user took too long or something went wrong)
  if (Date.now() - entry.createdAt > TOKEN_EXPIRY_MS) {
    delete global.tokenStore[key];
    return res.json({ error: 'expired' });
  }

  // Token found! Return it and delete it (one-time use)
  const token = entry.token;
  delete global.tokenStore[key];

  return res.json({ token });
}
