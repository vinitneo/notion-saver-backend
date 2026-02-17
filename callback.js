// api/callback.js
// Notion redirects here after the user approves access.
// This file exchanges the temporary "code" for a real access token,
// then stores the token temporarily so the extension can pick it up.

// In-memory store for tokens (keyed by the state UUID from the extension)
// Note: This is fine for personal use. Tokens are only stored for a few seconds.
global.tokenStore = global.tokenStore || {};

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  // If the user declined access on Notion's page
  if (error) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Login Cancelled</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 60px; color: #333;">
          <h2>Login cancelled</h2>
          <p>You declined access. You can close this tab and try again.</p>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = `https://${req.headers.host}/api/callback`;

  // Create the Basic auth header: Base64 encode "clientId:clientSecret"
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Login Failed</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 60px; color: #333;">
            <h2>Login failed</h2>
            <p>Something went wrong during login. Please close this tab and try again.</p>
            <p style="font-size: 12px; color: #999;">Error: ${tokenData.error || 'Unknown error'}</p>
          </body>
        </html>
      `);
    }

    // Store the token temporarily (the extension will poll /api/token to retrieve it)
    global.tokenStore[state] = {
      token: tokenData.access_token,
      createdAt: Date.now(),
    };

    // Show a success page to the user — they can close this tab
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Login Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f7f6f3;
            }
            .card {
              background: white;
              border-radius: 12px;
              padding: 48px 56px;
              text-align: center;
              box-shadow: 0 4px 24px rgba(0,0,0,0.08);
              max-width: 380px;
            }
            .checkmark { font-size: 48px; margin-bottom: 16px; }
            h2 { margin: 0 0 8px; font-size: 22px; color: #1a1a1a; }
            p { margin: 0; color: #666; font-size: 15px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="checkmark">✓</div>
            <h2>You're logged in!</h2>
            <p>You can close this tab and return to the extension.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Internal server error. Please try again.');
  }
}
