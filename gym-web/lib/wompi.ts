import { createHash, timingSafeEqual } from "crypto";

export function wompiConfig() {
  const publicKey = String(process.env.WOMPI_PUBLIC_KEY || "").trim();
  const integrity = String(process.env.WOMPI_INTEGRITY_SECRET || "").trim();
  const events = String(process.env.WOMPI_EVENTS_SECRET || "").trim();
  const privateKey = String(process.env.WOMPI_PRIVATE_KEY || "").trim();
  const sandbox = publicKey.startsWith("pub_test_");
  return {
    publicKey,
    integrity,
    events,
    privateKey,
    ready: Boolean(publicKey && integrity),
    api: sandbox ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1",
    checkout: "https://checkout.wompi.co/p/",
  };
}

export function integritySignature(reference: string, amountInCents: number, integrity: string) {
  return createHash("sha256").update(`${reference}${amountInCents}COP${integrity}`).digest("hex");
}

export function checkoutUrl(input: { reference: string; amountInCents: number; name: string; phone: string; email: string; redirect: string }) {
  const cfg = wompiConfig();
  if (!cfg.ready) return "";
  const signature = integritySignature(input.reference, input.amountInCents, cfg.integrity);
  const q = new URLSearchParams({
    "public-key": cfg.publicKey,
    currency: "COP",
    "amount-in-cents": String(input.amountInCents),
    reference: input.reference,
    "signature:integrity": signature,
    "redirect-url": input.redirect,
    "customer-data:full-name": input.name,
  });
  if (input.phone) q.set("customer-data:phone-number", input.phone);
  if (input.email) q.set("customer-data:email", input.email);
  return `${cfg.checkout}?${q.toString()}`;
}

function dig(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) return (cur as Record<string, unknown>)[key];
    return undefined;
  }, root);
}

export function eventChecksumOk(body: any): boolean {
  const cfg = wompiConfig();
  if (!cfg.events) return false;
  const props: string[] = Array.isArray(body?.signature?.properties) ? body.signature.properties.map(String) : [];
  const checksum = String(body?.signature?.checksum || "");
  const timestamp = String(body?.timestamp ?? "");
  if (!props.length || !checksum || !timestamp) return false;
  const raw = props.map((p) => String(dig(body?.data, p) ?? "")).join("") + timestamp + cfg.events;
  const expected = createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(checksum);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function lookupTransaction(reference: string): Promise<{ status: string; id: string } | null> {
  const cfg = wompiConfig();
  if (!cfg.privateKey) return null;
  const res = await fetch(`${cfg.api}/transactions?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${cfg.privateKey}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const row = json?.data?.[0];
  if (!row?.status) return null;
  return { status: String(row.status), id: String(row.id || "") };
}
