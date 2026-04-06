/**
 * Gmail OAuth2 helper — handles authentication and token management.
 *
 * First run: opens browser for consent → saves token.json
 * Subsequent runs: reuses token.json (auto-refreshes if expired)
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.compose'];

async function getAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing ${CREDENTIALS_PATH}\nDownload OAuth credentials from Google Cloud Console.`);
  }

  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret } = creds.installed || creds.web || {};

  if (!client_id || !client_secret) {
    throw new Error('Invalid credentials.json — must be a Desktop app OAuth client.');
  }

  const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:9876');

  // Try loading existing token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2.setCredentials(token);

    // Check if token needs refresh
    if (token.expiry_date && token.expiry_date < Date.now()) {
      try {
        const { credentials } = await oauth2.refreshAccessToken();
        oauth2.setCredentials(credentials);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
      } catch (e) {
        console.log('Token expired and refresh failed. Re-authenticating...');
        return await authenticateInteractive(oauth2);
      }
    }

    return oauth2;
  }

  // No token — need interactive auth
  return await authenticateInteractive(oauth2);
}

async function authenticateInteractive(oauth2) {
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Gmail Authorization Required (one-time setup)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Opening browser for authorization...\n');

  // Open browser
  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);

  // Wait for callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const query = url.parse(req.url, true).query;
      if (query.code) {
        res.end('Authorization successful! You can close this tab.');
        server.close();
        resolve(query.code);
      } else if (query.error) {
        res.end('Authorization failed: ' + query.error);
        server.close();
        reject(new Error(query.error));
      }
    });
    server.listen(9876, () => {
      console.log('Waiting for authorization callback on http://localhost:9876 ...');
    });
    setTimeout(() => { server.close(); reject(new Error('Auth timeout — no callback received in 120s')); }, 120000);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Token saved to scripts/token.json ✓\n');

  return oauth2;
}

module.exports = { getAuthClient };
