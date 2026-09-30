// Writes mobile-shell/config.js with the server the Android app opens first.
// Uses POLARIS_SERVER_URL (or APP_URL) when set, otherwise this PC's Wi-Fi address on port 3000.
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { networkInterfaces } from 'os';

function lanUrl() {
  const port = process.env.PORT || '3000';
  const addrs = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  // Prefer home/office routers (192.168.0.x / 192.168.1.x / 10.x) over virtual adapters.
  const ip = addrs.find((a) => /^192\.168\.(0|1)\./.test(a)) || addrs.find((a) => a.startsWith('10.')) || addrs[0] || 'localhost';
  return `http://${ip}:${port}`;
}

const isUrl = (v) => (v && /^https?:\/\//i.test(v) ? v : null);
const url = (isUrl(process.env.POLARIS_SERVER_URL) || isUrl(process.env.APP_URL) || lanUrl()).replace(/\/+$/, '');
writeFileSync(new URL('../mobile-shell/config.js', import.meta.url), `window.POLARIS_DEFAULT_SERVER = ${JSON.stringify(url)};\n`);
console.log(`Android app will open ${url} by default`);
