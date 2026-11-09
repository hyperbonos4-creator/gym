/**
 * Deja el GLB del estudio listo para la web: quita datos que el maniquí no usa,
 * cuantiza y comprime con meshopt. No toca licencias ajenas ni otros ejercicios.
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, resample, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error("uso: node optimize_glbs.mjs entrada.glb salida.glb");
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

const before = statSync(input).size;
const document = await io.read(input);
await document.transform(
  prune({ keepAttributes: false }),
  dedup(),
  weld({ tolerance: 0.0001 }),
  resample({ tolerance: 0.0001 }),
  quantize({
    quantizePosition: 14,
    quantizeNormal: 8,
    quantizeTexcoord: 12,
    quantizeWeight: 8,
    quantizeGeneric: 12,
  }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

const root = document.getRoot();
const names = root.listAnimations().map((clip) => clip.getName());
console.log("skins", root.listSkins().length);
console.log("anims", names.length);
console.log(names.join(" | "));
const glb = await io.writeBinary(document);
writeFileSync(output, glb);
console.log(`antes ${before} despues ${glb.byteLength}`);
