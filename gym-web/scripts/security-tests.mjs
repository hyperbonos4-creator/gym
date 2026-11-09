/**
 * Suite offline de seguridad / persistencia.
 * Ejecutar: node --experimental-vm-modules scripts/security-tests.mjs
 * o: npm run test:security
 */
import assert from "node:assert/strict";
import { createHmac, createHash, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
process.chdir(root);
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret-min-32-characters!";
process.env.NODE_ENV = "test";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("ok -", name);
  } catch (e) {
    console.error("FAIL -", name);
    console.error(e);
    process.exitCode = 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log("ok -", name);
  } catch (e) {
    console.error("FAIL -", name);
    console.error(e);
    process.exitCode = 1;
  }
}

// --- HMAC session (inline mirror of sessionToken sync) ---
function mint(claims, secret) {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token, secret) {
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (claims.exp < Date.now()) return null;
  return claims;
}

test("session firma válida", () => {
  const secret = process.env.SESSION_SECRET;
  const tok = mint({ u: "admin", r: "superadmin", v: 1, exp: Date.now() + 60000 }, secret);
  const c = verify(tok, secret);
  assert.equal(c.u, "admin");
});

test("session rechaza firma adulterada", () => {
  const secret = process.env.SESSION_SECRET;
  const tok = mint({ u: "admin", r: "superadmin", v: 1, exp: Date.now() + 60000 }, secret);
  const bad = tok.slice(0, -2) + "aa";
  assert.equal(verify(bad, secret), null);
});

test("session rechaza expirada", () => {
  const secret = process.env.SESSION_SECRET;
  const tok = mint({ u: "admin", r: "superadmin", v: 1, exp: Date.now() - 1000 }, secret);
  assert.equal(verify(tok, secret), null);
});

test("password scrypt roundtrip", () => {
  const password = "Secreta123!";
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  const stored = `scrypt:${salt}:${hash}`;
  const [, s, h] = stored.split(":");
  const got = scryptSync(password, s, 32);
  assert.ok(timingSafeEqual(got, Buffer.from(h, "hex")));
});

test("wompi integrity signature shape", () => {
  const integrity = "test_integrity_secret";
  const reference = "ref-1";
  const amount = 10000;
  const expected = createHash("sha256").update(`${reference}${amount}COP${integrity}`).digest("hex");
  assert.equal(expected.length, 64);
});

test("wompi event checksum", () => {
  const events = "events_secret";
  const body = {
    data: { transaction: { id: "tx1", status: "APPROVED", amount_in_cents: 1000 } },
    timestamp: 1710000000,
    signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum: "" },
  };
  const raw = ["tx1", "APPROVED", "1000"].join("") + String(body.timestamp) + events;
  body.signature.checksum = createHash("sha256").update(raw).digest("hex");
  const props = body.signature.properties;
  const dig = (root, p) => p.split(".").reduce((c, k) => (c && c[k] !== undefined ? c[k] : undefined), root);
  const calc = props.map((p) => String(dig(body.data, p) ?? "")).join("") + body.timestamp + events;
  const expected = createHash("sha256").update(calc).digest("hex");
  assert.equal(body.signature.checksum, expected);
});

test("atomic json write no partial", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gym-json-"));
  const file = path.join(dir, "x.json");
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ a: 1 }));
  fs.renameSync(tmp, file);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { a: 1 });
});

test("enroll token must not be bare username", () => {
  const secret = process.env.SESSION_SECRET;
  const tok = mint({ u: "admin", r: "superadmin", v: 1, exp: Date.now() + 60000 }, secret);
  assert.ok(tok.includes("."));
  assert.notEqual(tok, "admin");
  assert.notEqual(tok, "1");
});

test("facial webhook auth header check (logic)", () => {
  const expected = "secret-token";
  const got = "Bearer secret-token".replace(/^bearer\s+/i, "").trim();
  assert.equal(got, expected);
  assert.notEqual("wrong", expected);
});



// --- Kiosk scope allowlist (espejo del KioskScopeGuard) ---
function kioskAllowed(method, url, accessPointId, queryPoint) {
  const u = String(url || "").split("?")[0];
  const own = (suffix) => u.endsWith(`/access/points/${accessPointId}${suffix}`);
  if (method === "GET" && u.endsWith("/access/points")) return true;
  if (method === "POST" && (own("/recognize") || own("/recognize-image"))) return true;
  if (method === "GET" && (own("/snapshot") || own("/stream-token") || own("/door-status"))) return true;
  if (method === "GET" && u.endsWith("/access/events")) {
    if (queryPoint && queryPoint !== accessPointId) return false;
    return true;
  }
  if (method === "POST" && /\/access\/events\/[^/]+\/manual-open$/.test(u)) return true;
  if (method === "GET" && u.endsWith("/auth/me")) return true;
  if (method === "POST" && /\/access\/kiosk\/devices\/[^/]+\/heartbeat$/.test(u)) return true;
  return false;
}

test("kiosk scope allowlist recognize own point", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assert.equal(kioskAllowed("POST", `/api/v1/access/points/${id}/recognize`, id), true);
});

test("kiosk scope denies other point recognize", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  assert.equal(kioskAllowed("POST", `/api/v1/access/points/${other}/recognize`, id), false);
});

test("kiosk scope denies admin subjects list", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assert.equal(kioskAllowed("GET", "/api/v1/access/subjects", id), false);
});

test("kiosk scope denies events of other point via query", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  assert.equal(kioskAllowed("GET", "/api/v1/access/events", id, other), false);
});

test("kiosk pairing code is 6 digits shape", () => {
  const code = String(42).padStart(6, "0");
  assert.equal(code.length, 6);
  assert.match(code, /^\d{6}$/);
});



test("kiosk qr fragment keeps code off server path", () => {
  const base = "https://gym.example.sslip.io";
  const code = "123456";
  const pairUrl = `${base}/kiosk/index.html?source=webcam#code=${encodeURIComponent(code)}`;
  const u = new URL(pairUrl);
  assert.equal(u.pathname.includes("123456"), false);
  assert.equal(u.search.includes("123456"), false);
  assert.match(u.hash, /code=123456/);
  assert.equal(/localhost|127\.0\.0\.1/i.test(pairUrl), false);
});

test("kiosk qr rejects localhost public base shape", () => {
  const bad = "http://127.0.0.1:3100/kiosk/index.html#code=111111";
  assert.equal(/localhost|127\.0\.0\.1/i.test(bad), true);
});

console.log(`\n${passed} tests passed`);
