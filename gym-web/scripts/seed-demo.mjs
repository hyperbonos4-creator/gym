/**
 * Genera data-demo/ aislada con sedes, socios, membresias, rutinas, ventas y accesos.
 * Escribe CREDENCIALES_DEMO.txt (DEMO_CREDS_FILE). Nunca imprime la clave.
 * Credenciales estables (demo-auth.json); reset no las rota salvo DEMO_ROTATE_CREDS=1.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scryptSync, randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = process.env.GYM_DATA_DIR
  ? path.resolve(process.env.GYM_DATA_DIR)
  : path.join(root, "data-demo");

const credsFile =
  process.env.DEMO_CREDS_FILE ||
  path.join(
    process.env.USERPROFILE || process.env.HOME || root,
    "Documents",
    "Desktop",
    "Gym_respaldo_20261108_2155",
    "CREDENCIALES_DEMO.txt",
  );

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return "scrypt:" + salt + ":" + hash;
}

function uuid() {
  return crypto.randomUUID();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

const first = ["Ana","Luis","Camila","Andres","Valentina","Santiago","Laura","Diego","Mariana","Juan","Sofia","Carlos","Isabella","Mateo","Daniela","Felipe","Juliana","Sebastian","Paula","Nicolas","Gabriela","Tomas","Lucia","Esteban","Sara","David","Elena","Miguel","Catalina","Oscar","Natalia","Ricardo","Andrea","Pablo","Manuela","Hector","Diana","Ivan","Carolina","Jorge"];
const last = ["Garcia","Rodriguez","Martinez","Lopez","Gonzalez","Perez","Ramirez","Torres","Vargas","Castro","Morales","Rojas","Jimenez","Herrera","Medina","Aguilar","Suarez","Reyes","Cruz","Ortiz"];

const gyms = [
  { id: "visionyx-norte", name: "VISIONYX Norte", city: "Bogota · Norte", whatsapp: "desconectado", waInstance: "demo-norte", short: "VN", brandName: "VISIONYX Norte" },
  { id: "visionyx-centro", name: "VISIONYX Centro", city: "Bogota · Centro", whatsapp: "desconectado", waInstance: "demo-centro", short: "VC", brandName: "VISIONYX Centro" },
  { id: "visionyx-sur", name: "VISIONYX Sur", city: "Bogota · Sur", whatsapp: "desconectado", waInstance: "demo-sur", short: "VS", brandName: "VISIONYX Sur" },
];

const planeDefs = [
  { id: "plan-dia", name: "Pase del dia", price: 15000, durationDays: 1 },
  { id: "plan-mensual", name: "Mensual", price: 120000, durationDays: 30 },
  { id: "plan-trimestral", name: "Trimestral", price: 320000, durationDays: 90 },
  { id: "plan-anual", name: "Anual", price: 990000, durationDays: 365 },
];

const ejercicios = [
  { id: "ex-sentadilla", nombre: "Sentadilla", grupo: "Piernas" },
  { id: "ex-press", nombre: "Press banca", grupo: "Pecho" },
  { id: "ex-remo", nombre: "Remo con barra", grupo: "Espalda" },
  { id: "ex-peso", nombre: "Peso muerto", grupo: "Posterior" },
  { id: "ex-pressm", nombre: "Press militar", grupo: "Hombros" },
  { id: "ex-dominada", nombre: "Dominadas", grupo: "Espalda" },
  { id: "ex-fondo", nombre: "Fondos", grupo: "Triceps" },
  { id: "ex-curl", nombre: "Curl biceps", grupo: "Biceps" },
];

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(credsFile), { recursive: true });

const demoUser = "demo";
/** Auth estable entre resets. Solo rota si DEMO_ROTATE_CREDS=1. */
const authFile =
  process.env.DEMO_AUTH_FILE ||
  path.join(path.dirname(credsFile), "demo-auth.json");
const rotateCreds = String(process.env.DEMO_ROTATE_CREDS || "").trim() === "1";

function phoneFriendlyPass() {
  // Sin i/l/1/o/0 ni simbolos: facil de teclear en celular.
  const words = [
    "cancha",
    "fuerza",
    "marca",
    "sala",
    "meta",
    "ruta",
    "caja",
    "pares",
    "redes",
    "pesas",
  ];
  const digits = "23456789";
  const w1 = words[Math.floor(Math.random() * words.length)];
  let w2 = words[Math.floor(Math.random() * words.length)];
  if (w2 === w1) w2 = words[(words.indexOf(w1) + 1) % words.length];
  let d = "";
  for (let i = 0; i < 3; i++) d += digits[Math.floor(Math.random() * digits.length)];
  return w1 + d + w2;
}

let demoPass = "";
if (!rotateCreds && fs.existsSync(authFile)) {
  try {
    const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
    if (auth && auth.password) demoPass = String(auth.password);
  } catch {
    /* ignore */
  }
}
if (!demoPass) demoPass = phoneFriendlyPass();
fs.mkdirSync(path.dirname(authFile), { recursive: true });
fs.writeFileSync(
  authFile,
  JSON.stringify({ username: demoUser, password: demoPass }, null, 2) + "\n",
  { encoding: "utf8", mode: 0o600 },
);

const users = [
  {
    username: demoUser,
    password: hashPassword(demoPass),
    nombre: "Demo VISIONYX",
    role: "admin",
    gymIds: gyms.map((g) => g.id),
    sessionVersion: 1,
  },
];

const socios = [];
const membershipRows = [];
const accessLog = [];
const now = Date.now();

for (let i = 0; i < 42; i++) {
  const gym = gyms[i % gyms.length];
  const id = uuid();
  const nombre = pick(first) + " " + pick(last);
  const doc = String(10000000 + randInt(100000, 8999999));
  const emailLocal = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  socios.push({
    id,
    gymId: gym.id,
    createdAt: new Date(now - randInt(5, 200) * 86400000).toISOString(),
    docTipo: "CC",
    docNumero: doc,
    nombre,
    fechaNac: randInt(1985, 2004) + "-" + String(randInt(1, 12)).padStart(2, "0") + "-" + String(randInt(1, 28)).padStart(2, "0"),
    genero: pick(["F", "M", "O", ""]),
    codigoPais: "57",
    celular: "3" + String(randInt(100000000, 199999999)),
    email: emailLocal + "@demo.visionyx.local",
    enviarEmails: false,
    direccion: "Calle " + randInt(1, 140) + " # " + randInt(1, 90) + "-" + randInt(1, 50),
    prospecto: false,
    empresa: "",
    contactoRespaldoNombre: "",
    contactoRespaldoTel: "",
    observaciones: "Socio de demostracion",
    estado: pick(["enrolado", "enrolado", "enrolado", "pendiente_enrolamiento"]),
    enrollLink: "",
    rol: "miembro",
  });
  const plan = pick(planeDefs);
  const startMs = now - randInt(0, 40) * 86400000;
  const endMs = startMs + plan.durationDays * 86400000;
  const startsOn = new Date(startMs).toISOString().slice(0, 10);
  const endsOn = new Date(endMs).toISOString().slice(0, 10);
  membershipRows.push({
    id: uuid(),
    gymId: gym.id,
    socioId: id,
    planId: plan.id + "-" + gym.id,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    startsOn,
    endsOn,
    validUntil: endsOn,
    accessWindow: null,
    status: endMs > now ? "active" : "expired",
    createdAt: new Date(startMs).toISOString(),
  });
  for (let a = 0; a < randInt(2, 8); a++) {
    accessLog.push({
      id: uuid(),
      gymId: gym.id,
      socioId: id,
      nombre,
      at: new Date(now - randInt(1, 20) * 86400000 - randInt(0, 86400000)).toISOString(),
      decision: pick(["GRANTED", "GRANTED", "GRANTED", "DENIED"]),
      reason: pick(["MATCHED", "MATCHED", "OUT_OF_SCHEDULE", "MEMBERSHIP_EXPIRED"]),
      simulated: true,
    });
  }
}

const plans = planeDefs.flatMap((p) =>
  gyms.map((g) => ({
    ...p,
    id: p.id + "-" + g.id,
    gymId: g.id,
    active: true,
    createdAt: new Date().toISOString(),
    priceHistory: [{ price: p.price, from: new Date().toISOString().slice(0, 10) }],
    renewal: "manual",
  })),
);

function demoDays(exerciseIds, reps, sets) {
  const mkItem = (exerciseId) => ({
    id: uuid(),
    exerciseId,
    sets,
    reps,
    restSec: 90,
    load: "",
    effort: "",
    tempo: "",
    alternativeId: "",
    note: "",
  });
  const mkDay = (label, title, ids, rest) => ({
    id: uuid(),
    label,
    title,
    rest: Boolean(rest),
    blocks: rest
      ? []
      : ids.map((exerciseId) => ({
          id: uuid(),
          kind: "ejercicio",
          items: [mkItem(exerciseId)],
        })),
  });
  return [
    mkDay("Lunes", "Sesion A", exerciseIds.slice(0, Math.ceil(exerciseIds.length / 2)), false),
    mkDay("Miercoles", "Sesion B", exerciseIds.slice(Math.ceil(exerciseIds.length / 2)), false),
    mkDay("Viernes", "Descanso", [], true),
  ];
}

const nowIso = new Date().toISOString();
const routines = [
  {
    id: "rut-full",
    gymId: "visionyx-norte",
    name: "Full body principiante",
    goal: "Hipertrofia",
    level: "Inicio",
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: "demo",
    versions: [
      {
        id: "ver-full-1",
        number: 1,
        status: "publicada",
        createdAt: nowIso,
        publishedAt: nowIso,
        days: demoDays(["sentadilla", "press-banca", "remo-barra", "plancha", "zancadas"], "10-12", 3),
      },
    ],
  },
  {
    id: "rut-fuerza",
    gymId: "visionyx-centro",
    name: "Fuerza intermedia",
    goal: "Fuerza",
    level: "Intermedio",
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: "demo",
    versions: [
      {
        id: "ver-fuerza-1",
        number: 1,
        status: "publicada",
        createdAt: nowIso,
        publishedAt: nowIso,
        days: demoDays(["sentadilla", "press-banca", "peso-muerto-rumano", "press-militar", "remo-barra", "fondos"], "6-8", 4),
      },
    ],
  },
];

const retail = {
  productos: [
    { id: "p-proteina", nombre: "Proteina 2lb", precio: 145000, stock: 24 },
    { id: "p-creatina", nombre: "Creatina 300g", precio: 89000, stock: 40 },
    { id: "p-botella", nombre: "Botella VISIONYX", precio: 35000, stock: 60 },
  ],
  ventas: Array.from({ length: 28 }).map((_, i) => ({
    id: uuid(),
    gymId: gyms[i % 3].id,
    at: new Date(now - i * 86400000).toISOString(),
    total: pick([35000, 89000, 145000, 180000]),
    items: [{ productoId: pick(["p-proteina", "p-creatina", "p-botella"]), qty: 1 }],
    medio: pick(["efectivo", "transferencia", "tarjeta"]),
    demo: true,
  })),
};

const files = {
  "users.json": users,
  "gyms.json": gyms,
  "socios.json": socios,
  "memberships.json": { plans, memberships: membershipRows },
  "routines.json": routines,
  "routine-assignments.json": socios.slice(0, 20).map((s, i) => {
    const tpl = routines[i % routines.length];
    const ver = tpl.versions[0];
    return {
      id: uuid(),
      gymId: s.gymId,
      socioId: s.id,
      templateId: tpl.id,
      versionId: ver.id,
      versionNumber: ver.number,
      startDate: new Date().toISOString().slice(0, 10),
      status: "vigente",
      note: "Asignacion demo",
      assignedAt: new Date().toISOString(),
      assignedBy: "demo",
      closedAt: null,
    };
  }),
  "exercise-assignments.json": [],
  "ejercicios.json": ejercicios,
  "retail.json": retail,
  "turnstiles.json": {
    devices: gyms.map((g, i) => ({
      id: "DEMOCHIP" + i + "00FF0A4",
      gymId: g.id,
      name: "Torniquete demo " + g.short,
      token: crypto.randomBytes(16).toString("hex"),
      pointId: null,
      ssid: "DEMO-WIFI",
      lastIp: "192.168.10." + (10 + i),
      lastSeen: new Date().toISOString(),
      fw: "5.1.0",
      rssi: -55,
      syncedIp: "192.168.10." + (10 + i),
      keyInvalidAt: null,
    })),
    seen: [],
  },
  "demo-access-events.json": accessLog,
  "invitations.json": [],
  "enroll-codes.json": [],
  "demo-meta.json": {
    generatedAt: new Date().toISOString(),
    brand: "VISIONYX",
    tagline: "Inteligencia que conecta el mundo real",
    note: "Datos ficticios. Entorno de demostracion.",
  },
};

for (const [name, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

const creds = [
  "CREDENCIALES DEMO VISIONYX",
  "Generado: " + new Date().toISOString(),
  "Entorno: demostracion aislada (no es produccion)",
  "Usuario: " + demoUser,
  "Clave: " + demoPass,
  "Rol: admin (limitado en demo: sin WhatsApp, Wompi, DIAN ni hardware real)",
  "Sedes: VISIONYX Norte / Centro / Sur",
  "Guarda esto y borra el archivo cuando el cliente ya tenga acceso.",
  "",
].join("\n");
fs.writeFileSync(credsFile, creds, { encoding: "utf8", mode: 0o600 });

console.log(
  JSON.stringify({
    ok: true,
    outDir,
    gyms: gyms.length,
    socios: socios.length,
    memberships: membershipRows.length,
    accessEvents: accessLog.length,
    ventas: retail.ventas.length,
    credsFile,
    user: demoUser,
  }),
);
