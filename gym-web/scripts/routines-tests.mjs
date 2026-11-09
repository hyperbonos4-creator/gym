import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function safeVersions(t) {
  return Array.isArray(t?.versions) ? t.versions : [];
}
function latestPublished(t) {
  return [...safeVersions(t)].reverse().find((v) => v.status === "publicada") || null;
}
function draftOf(t) {
  return safeVersions(t).find((v) => v.status === "borrador") || null;
}

for (const bad of [undefined, null, {}, { versions: null }, { versions: {} }, { versions: "x" }, { versions: [] }]) {
  assert.doesNotThrow(() => latestPublished(bad));
  assert.doesNotThrow(() => draftOf(bad));
  assert.ok(Array.isArray(safeVersions(bad)));
}
assert.equal(latestPublished({ versions: [{ id: "1", status: "publicada", number: 1 }] })?.id, "1");
assert.equal(draftOf({ versions: [{ id: "d", status: "borrador", number: 2 }] })?.id, "d");
console.log("ok - client helpers tolerate missing versions");

const types = fs.readFileSync(path.join(root, "lib/routineTypes.ts"), "utf8");
assert.ok(types.includes("export function safeVersions"));
assert.ok(types.includes("Array.isArray(t?.versions)"));
const store = fs.readFileSync(path.join(root, "lib/routinesStore.ts"), "utf8");
assert.ok(store.includes("export function normalizeTemplate"));
assert.ok(store.includes("if (!Array.isArray((row as any)?.versions)) dirty = true"));
const seed = fs.readFileSync(path.join(root, "scripts/seed-demo.mjs"), "utf8");
assert.ok(seed.includes('status: "publicada"'));
assert.ok(seed.includes("versions:"));
assert.ok(!seed.includes('nombre: "Full body principiante"'));
assert.ok(seed.includes("templateId:"));
assert.ok(fs.existsSync(path.join(root, "app/rutinas/error.tsx")));
console.log("ok - source contracts");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gym-routines-"));
const creds = path.join(tmp, "CREDENCIALES_DEMO.txt");
const r = spawnSync(process.execPath, [path.join(root, "scripts", "seed-demo.mjs")], {
  env: {
    ...process.env,
    GYM_DATA_DIR: tmp,
    DEMO_CREDS_FILE: creds,
    DEMO_AUTH_FILE: path.join(tmp, "demo-auth.json"),
  },
  encoding: "utf8",
});
assert.equal(r.status, 0, r.stderr || r.stdout);
const routines = JSON.parse(fs.readFileSync(path.join(tmp, "routines.json"), "utf8"));
assert.ok(Array.isArray(routines) && routines.length >= 1);
for (const row of routines) {
  assert.ok(Array.isArray(row.versions), "seed routine missing versions array");
  assert.ok(row.name, "seed routine missing name");
  assert.ok(!row.nombre, "seed still uses legacy nombre");
}
const assigns = JSON.parse(fs.readFileSync(path.join(tmp, "routine-assignments.json"), "utf8"));
assert.ok(assigns.length >= 1);
assert.ok(assigns[0].templateId);
assert.ok(assigns[0].versionId);
assert.equal(assigns[0].status, "vigente");
console.log("ok - seed writes versioned routines");

const ts = require(path.join(root, "node_modules/typescript"));
const storeSrc = fs.readFileSync(path.join(root, "lib/routinesStore.ts"), "utf8");
const typesSrc = fs.readFileSync(path.join(root, "lib/routineTypes.ts"), "utf8");
const catalogSrc = fs.readFileSync(path.join(root, "lib/exercisesCatalog.ts"), "utf8");
const dataDirSrc =
  'export function dataDir() { return process.env.GYM_DATA_DIR || "' +
  tmp.replace(/\\/g, "/") +
  '"; }\n';
const harnessDir = path.join(tmp, "harness");
fs.mkdirSync(harnessDir, { recursive: true });
function emit(name, source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: name,
  });
  fs.writeFileSync(path.join(harnessDir, name.replace(/\.tsx?$/, ".js")), outputText);
}
emit("dataDir.ts", dataDirSrc);
emit("routineTypes.ts", typesSrc);
emit("exercisesCatalog.ts", catalogSrc);
emit("routinesStore.ts", storeSrc);

fs.writeFileSync(
  path.join(tmp, "routines.json"),
  JSON.stringify([
    {
      id: "legacy-1",
      gymId: "visionyx-norte",
      nombre: "Legacy",
      nivel: "inicio",
      dias: ["L", "M"],
      bloques: [{ ejercicioId: "ex-sentadilla", series: 3, reps: "10" }],
    },
    { id: "broken-2", gymId: "visionyx-norte", name: "Broken", versions: null },
  ]),
  "utf8",
);
process.env.GYM_DATA_DIR = tmp;
const { listRoutines, normalizeTemplate } = require(path.join(harnessDir, "routinesStore.js"));
const legacy = normalizeTemplate({
  id: "x",
  gymId: "g",
  nombre: "N",
  nivel: "medio",
  bloques: [{ ejercicioId: "ex-press", series: 4, reps: "6" }],
});
assert.ok(Array.isArray(legacy.versions));
assert.equal(legacy.name, "N");
assert.equal(legacy.level, "Intermedio");
assert.doesNotThrow(() => latestPublished(legacy));
const listed = listRoutines("visionyx-norte");
assert.ok(listed.length >= 1);
for (const row of listed) {
  assert.ok(Array.isArray(row.versions));
  assert.doesNotThrow(() => latestPublished(row));
}
const healed = JSON.parse(fs.readFileSync(path.join(tmp, "routines.json"), "utf8"));
assert.ok(healed.every((row) => Array.isArray(row.versions)));
console.log("ok - normalizeTemplate + heal-on-read");
console.log("routines regression tests passed");
