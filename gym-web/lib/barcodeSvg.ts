/** Barras para la etiqueta de góndola. EAN-13 si el código lo es; si no, CODE128. */

const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** 106 símbolos CODE128 + stop. Cada dígito es el ancho en módulos. */
const C128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

function checkDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const fromRight = payload.length - 1 - i;
    sum += Number(payload[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function isEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return checkDigit(code.slice(0, 12)) === Number(code[12]);
}

function barsFromBits(bits: string, module: number, quiet: number): string {
  let x = quiet;
  let out = "";
  let i = 0;
  while (i < bits.length) {
    const on = bits[i] === "1";
    let w = 0;
    while (i < bits.length && (bits[i] === "1") === on) {
      w += 1;
      i += 1;
    }
    if (on) out += `<rect x="${x}" y="0" width="${w * module}" height="70" fill="#000"/>`;
    x += w * module;
  }
  return out;
}

function ean13Bits(code: string): string {
  const parity = EAN_PARITY[Number(code[0])];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = Number(code[i + 1]);
    bits += parity[i] === "L" ? EAN_L[d] : EAN_G[d];
  }
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += EAN_R[Number(code[i])];
  bits += "101";
  return bits;
}

function code128Bits(code: string): string {
  const values: number[] = [104];
  for (const ch of code) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 94) throw new Error("caracter");
    values.push(v);
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(106);
  let bits = "";
  let bar = true;
  for (const v of values) {
    for (const w of C128[v]) {
      bits += (bar ? "1" : "0").repeat(Number(w));
      bar = !bar;
    }
  }
  return bits;
}

export function barcodeSvg(raw: string, opts?: { digits?: boolean }): string {
  const code = String(raw || "").replace(/[\s-]/g, "");
  if (code.length < 4) return "";
  const module = 2;
  const quiet = 20;
  let bits = "";
  try {
    bits = isEan13(code) ? ean13Bits(code) : code128Bits(code);
  } catch {
    return "";
  }
  const digits = opts?.digits !== false;
  const width = bits.length * module + quiet * 2;
  const alto = digits ? 86 : 70;
  const bars = barsFromBits(bits, module, quiet);
  const texto = digits
    ? `<text x="${width / 2}" y="84" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#111">${code}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${alto}" width="100%" height="100%" role="img" aria-label="Código ${code}"><rect width="100%" height="100%" fill="#fff"/>${bars}${texto}</svg>`;
}
