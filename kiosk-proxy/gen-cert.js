/*
 * Genera una CA propia + un certificado de servidor para el proxy HTTPS.
 * El cert incluye SAN con la(s) IP(s) del PC y localhost, para que Chrome
 * en la tablet lo acepte (tras instalar la CA) y habilite la camara.
 *
 * Uso:  node gen-cert.js [ip1] [ip2] ...
 *   Si no se pasan IPs, detecta las IPv4 privadas de la maquina.
 */
const forge = require('node-forge');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OUT = path.join(__dirname, 'certs');
fs.mkdirSync(OUT, { recursive: true });

function privateIPv4s() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

const ips = process.argv.slice(2).length ? process.argv.slice(2) : privateIPv4s();
console.log('IPs incluidas en el certificado:', ips.join(', ') || '(ninguna)');

const pki = forge.pki;

// ── 1) CA raiz ────────────────────────────────────────────────────────────
const caKeys = pki.rsa.generateKeyPair(2048);
const caCert = pki.createCertificate();
caCert.publicKey = caKeys.publicKey;
caCert.serialNumber = '01';
caCert.validity.notBefore = new Date();
caCert.validity.notAfter = new Date();
caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 10);
const caAttrs = [
  { name: 'commonName', value: 'Gym Access Local CA' },
  { name: 'organizationName', value: 'VisionYX Access' },
];
caCert.setSubject(caAttrs);
caCert.setIssuer(caAttrs);
caCert.setExtensions([
  { name: 'basicConstraints', cA: true },
  { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true },
]);
caCert.sign(caKeys.privateKey, forge.md.sha256.create());

// ── 2) Certificado de servidor (firmado por la CA) ─────────────────────────
const srvKeys = pki.rsa.generateKeyPair(2048);
const srvCert = pki.createCertificate();
srvCert.publicKey = srvKeys.publicKey;
srvCert.serialNumber = '02';
srvCert.validity.notBefore = new Date();
srvCert.validity.notAfter = new Date();
srvCert.validity.notAfter.setFullYear(srvCert.validity.notBefore.getFullYear() + 5);
srvCert.setSubject([{ name: 'commonName', value: ips[0] || 'localhost' }]);
srvCert.setIssuer(caAttrs);

const altNames = [
  { type: 2, value: 'localhost' }, // DNS
  { type: 7, ip: '127.0.0.1' },    // IP
];
for (const ip of ips) altNames.push({ type: 7, ip });

srvCert.setExtensions([
  { name: 'basicConstraints', cA: false },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
  { name: 'extKeyUsage', serverAuth: true },
  { name: 'subjectAltName', altNames },
]);
srvCert.sign(caKeys.privateKey, forge.md.sha256.create());

// ── 3) Guardar en disco ────────────────────────────────────────────────────
fs.writeFileSync(path.join(OUT, 'ca.crt'), pki.certificateToPem(caCert));
fs.writeFileSync(path.join(OUT, 'server.crt'), pki.certificateToPem(srvCert));
fs.writeFileSync(path.join(OUT, 'server.key'), pki.privateKeyToPem(srvKeys.privateKey));

console.log('Certificados escritos en', OUT);
console.log('  ca.crt      -> instalar en la tablet (CA de confianza)');
console.log('  server.crt  -> lo usa el proxy');
console.log('  server.key  -> lo usa el proxy');
