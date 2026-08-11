const https = require('https');
const http = require('http');

/**
 * Periodically pings the server's /api/health endpoint to prevent cold starts on hosting platforms (Render, Railway, Fly.io, Heroku).
 * @param {string} targetUrl - The public server URL (e.g., 'https://nomi-api.onrender.com')
 * @param {number} intervalMinutes - Time in minutes between pings (default: 14)
 */
const startPingBot = (targetUrl, intervalMinutes = 14) => {
  if (!targetUrl) {
    console.log('[Ping Bot] Notice: SERVER_URL not set in .env. Auto-ping disabled.');
    return;
  }

  const pingEndpoint = targetUrl.endsWith('/api/health')
    ? targetUrl
    : `${targetUrl.replace(/\/$/, '')}/api/health`;

  const intervalMs = intervalMinutes * 60 * 1000;
  const httpClient = pingEndpoint.startsWith('https') ? https : http;

  console.log(`[Ping Bot] Initialized. Target: ${pingEndpoint} | Interval: ${intervalMinutes} minutes`);

  const pingServer = () => {
    httpClient
      .get(pingEndpoint, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          console.log(`[Ping Bot Success] [${new Date().toLocaleTimeString()}] Status: ${res.statusCode} (Server Awake)`);
        });
      })
      .on('error', (err) => {
        console.error(`[Ping Bot Error] [${new Date().toLocaleTimeString()}]: ${err.message}`);
      });
  };

  // Trigger initial ping after 30 seconds, then loop every intervalMinutes
  setTimeout(pingServer, 30 * 1000);
  setInterval(pingServer, intervalMs);
};

module.exports = startPingBot;
