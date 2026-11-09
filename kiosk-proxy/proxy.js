/*
 * Proxy HTTPS -> backend de Access (http://127.0.0.1:3010).
 *
 * Sirve TODO el kiosko (HTML, assets, API y stream MJPEG) bajo un unico
 * origen HTTPS, para que Chrome en la tablet lo trate como contexto seguro
 * y permita getUserMedia (camara de la tablet) por WiFi.
 *
 *   Tablet ->  https://<IP-del-PC>:3443/kiosk/?source=webcam
 *
 * Requiere haber corrido antes:  node gen-cert.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const TARGET = process.env.TARGET || 'http://127.0.0.1:3010';
const PORT = Number(process.env.PORT || 3443);
const CERTS = path.join(__dirname, 'certs');

for (const f of ['server.crt', 'server.key']) {
  if (!fs.existsSync(path.join(CERTS, f))) {
    console.error(`Falta ${f}. Corre primero:  node gen-cert.js`);
    process.exit(1);
  }
}

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  ws: true,          // websockets si el backend los usa
  xfwd: true,
  proxyTimeout: 0,   // sin timeout: el stream MJPEG es de larga duracion
  timeout: 0,
});

proxy.on('error', (err, req, res) => {
  console.error('proxy error:', err.message);
  try {
    if (res && res.writeHead) { res.writeHead(502); res.end('backend no disponible'); }
  } catch { /* noop */ }
});

const server = https.createServer(
  {
    cert: fs.readFileSync(path.join(CERTS, 'server.crt')),
    key: fs.readFileSync(path.join(CERTS, 'server.key')),
  },
  (req, res) => proxy.web(req, res),
);

server.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy HTTPS escuchando en https://0.0.0.0:${PORT}  ->  ${TARGET}`);
  console.log(`Tablet:  https://<IP-del-PC>:${PORT}/kiosk/?source=webcam`);
});
