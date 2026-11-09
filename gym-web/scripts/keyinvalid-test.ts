import fs from "fs";
import os from "os";
import path from "path";

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gym-keyinvalid-"));
  process.env.GYM_DATA_DIR = tmp;
  fs.writeFileSync(
    path.join(tmp, "turnstiles.json"),
    JSON.stringify({
      devices: [
        {
          id: "085B900FF0A4",
          gymId: "fuerza-elite",
          name: "Torniquete Santo Domingo",
          token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          pointId: "c52914b4-32da-497c-85a0-0355f6806dd9",
          ssid: "AVE FENIX",
          lastIp: "192.168.1.34",
          lastSeen: new Date().toISOString(),
          fw: "5.1.0",
          rssi: -50,
          syncedIp: "192.168.1.34",
          keyInvalidAt: null,
        },
      ],
      seen: [],
    }),
  );

  const { announceDevice, listTurnstiles, noteKeyInvalid } = await import("../lib/turnstiles");
  const gym = "fuerza-elite";
  if (!noteKeyInvalid("085B900FF0A4")) throw new Error("noteKeyInvalid should find device");
  let d = listTurnstiles(gym)[0];
  if (!d.keyInvalidAt) throw new Error("expected keyInvalidAt set");
  if (!announceDevice({ id: "085B900FF0A4", token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ip: "192.168.1.34", fw: "5.1.0", rssi: -40 })) {
    throw new Error("announce with good token should work");
  }
  d = listTurnstiles(gym)[0];
  if (d.keyInvalidAt) throw new Error("keyInvalidAt should clear on good announce");
  if (announceDevice({ id: "085B900FF0A4", token: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", ip: "192.168.1.34" })) {
    throw new Error("bad token should not announce");
  }
  noteKeyInvalid("085B900FF0A4");
  d = listTurnstiles(gym)[0];
  if (!d.keyInvalidAt) throw new Error("keyInvalidAt should set after bad token");
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("keyinvalid-test ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
