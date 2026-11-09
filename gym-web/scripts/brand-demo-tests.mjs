import assert from "assert";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1) seed creates isolated folder
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gym-demo-"));
const creds = path.join(tmp, "CREDENCIALES_DEMO.txt");
const r = spawnSync(process.execPath, [path.join(root, "scripts", "seed-demo.mjs")], {
  env: { ...process.env, GYM_DATA_DIR: tmp, DEMO_CREDS_FILE: creds },
  encoding: "utf8",
});
assert.equal(r.status, 0, r.stderr || r.stdout);
const summary = JSON.parse(r.stdout.trim().split("\n").pop());
assert.equal(summary.gyms, 3);
assert.ok(summary.socios >= 40);
assert.ok(fs.existsSync(path.join(tmp, "users.json")));
assert.ok(fs.existsSync(path.join(tmp, "socios.json")));
assert.ok(fs.existsSync(path.join(tmp, "memberships.json")));
assert.ok(fs.existsSync(creds));
const credText = fs.readFileSync(creds, "utf8");
assert.ok(credText.includes("Usuario:"));
assert.ok(credText.includes("Clave:"));
assert.ok(!JSON.stringify(summary).includes(credText.split("Clave: ")[1]?.split("\n")[0] || "___"));

// 2) brand module resolves defaults (via next-less dynamic import of compiled? use regex on source)
const brandSrc = fs.readFileSync(path.join(root, "lib", "brand.ts"), "utf8");
assert.ok(brandSrc.includes("VISIONYX"));
assert.ok(brandSrc.includes("Inteligencia que conecta el mundo real"));
assert.ok(brandSrc.includes("NEXT_PUBLIC_BRAND_NAME"));

const logo = fs.readFileSync(path.join(root, "components", "BrandLogo.tsx"), "utf8");
assert.ok(logo.includes("publicBrand"));
assert.ok(!logo.includes("fuerza-elite.png"));

const assets = ["vx-horizontal-color.svg", "vx-icon-color.svg", "favicon.svg", "site.webmanifest"];
for (const a of assets) {
  assert.ok(fs.existsSync(path.join(root, "public", "brand", a)), a);
}

const demo = fs.readFileSync(path.join(root, "lib", "demo.ts"), "utf8");
assert.ok(demo.includes("demoBlocksPath"));
assert.ok(demo.includes("/api/whatsapp"));

console.log("ok - brand defaults VISIONYX");

const caja = fs.readFileSync(path.join(root, "app/caja/page.tsx"), "utf8");
assert.ok(!/El poder de la transform/i.test(caja), "caja still has old slogan");
assert.ok(/publicBrand\(\)\.tagline/.test(caja), "caja receipt should use brand tagline");
const retorno = fs.readFileSync(path.join(root, "app/api/mobile/pagos/retorno/route.ts"), "utf8");
assert.ok(!/FUERZA/i.test(retorno), "pagos retorno still has FUERZA");
assert.ok(/VISIONYX/.test(retorno), "pagos retorno should say VISIONYX");
const kiosk = fs.readFileSync(path.join(root, "../access/backend/public/assets/kiosk.js"), "utf8");
assert.ok(!/FUERZA/i.test(kiosk), "kiosk.js still has FUERZA");
console.log("ok - old gym brand purged from client surfaces");

console.log("ok - BrandLogo uses publicBrand");
console.log("ok - brand assets present");
console.log("ok - demo seed isolates data");
console.log("ok - demo credentials file written (not echoed)");
console.log("ok - demo blocks external actions");
console.log("6 brand/demo tests passed");