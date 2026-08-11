const https = require('https');
const http = require('http');
require('dotenv').config();

const TARGET_URL = process.env.SERVER_URL || process.argv[2] || 'http://localhost:5000';
const INTERVAL_MINS = parseInt(process.env.PING_INTERVAL_MINS) || 14;

const pingEndpoint = TARGET_URL.endsWith('/api/health')
  ? TARGET_URL
  : `${TARGET_URL.replace(/\/$/, '')}/api/health`;

const httpClient = pingEndpoint.startsWith('https') ? https : http;

console.log('====================================================');
console.log('🤖 Nomi Cold-Start Prevention Ping Bot');
console.log(`🎯 Target URL: ${pingEndpoint}`);
console.log(`⏱️  Frequency:  Every ${INTERVAL_MINS} minutes`);
console.log('====================================================\n');

const ping = () => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] Pinging ${pingEndpoint}...`);
  
  httpClient
    .get(pingEndpoint, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`[${new Date().toLocaleTimeString()}] ✅ Ping Success (Status ${res.statusCode}) - Server is Awake!`);
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Server responded with status: ${res.statusCode}`);
        }
      });
    })
    .on('error', (err) => {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Ping Failed: ${err.message}`);
    });
};

// Execute immediate ping on start
ping();

// Repeat ping every interval
setInterval(ping, INTERVAL_MINS * 60 * 1000);
