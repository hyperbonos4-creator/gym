"use client";

import { useEffect, useState } from "react";

export default function EnrollRedirect({ code }: { code: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/e/${encodeURIComponent(code)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.url) throw new Error("fail");
        if (cancelled) return;
        setUrl(data.url);
        location.replace(data.url);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (err) {
    return (
      <p className="mt-4 text-sm text-[#f87171]">
        No pudimos abrir el registro. Pide un enlace nuevo en recepción.
      </p>
    );
  }

  if (url) {
    return (
      <a
        href={url}
        className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Continuar
      </a>
    );
  }

  return <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#6b7a99]">Un momento…</p>;
}
