import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  GYM_DEMO_MODE: "1",
  NEXT_PUBLIC_GYM_DEMO_MODE: "1",
  GYM_DATA_DIR: path.join(root, "data-demo"),
  NEXT_PUBLIC_BRAND_NAME: "VISIONYX",
  NEXT_PUBLIC_BRAND_TAGLINE: "Inteligencia que conecta el mundo real",
  NEXT_PUBLIC_BRAND_LOGO: "/brand/vx-horizontal-color.svg",
  NEXT_PUBLIC_BRAND_MARK: "/brand/vx-icon-color.svg",
  NEXT_PUBLIC_BRAND_FAVICON: "/brand/favicon.svg",
  PORT: "3101",
  SESSION_SECRET: process.env.SESSION_SECRET || "demo-local-session-secret-visionyx-only",
  GYM_SESSION_SECRET: process.env.GYM_SESSION_SECRET || "demo-local-session-secret-visionyx-only",
};

await new Promise((resolve, reject) => {
  const seed = spawn(process.execPath, [path.join(root, "scripts", "seed-demo.mjs")], { cwd: root, env, stdio: "inherit" });
  seed.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("seed"))));
});

const child = spawn("npx", ["next", "dev", "-p", "3101"], { cwd: root, env, stdio: "inherit", shell: true });
child.on("exit", (c) => process.exit(c || 0));