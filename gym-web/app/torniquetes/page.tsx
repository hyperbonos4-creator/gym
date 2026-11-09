"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GymShell from "../../components/GymShell";
import KioskPairingPanel from "../../components/KioskPairingPanel";
import { getActiveGymId } from "../../lib/session";

const AGENT = "http://127.0.0.1:3190";
const FIRMWARE = "5.1.0";

type Port = { port: string; name: string; usb: boolean };
type Point = { id: string; name: string; kind: string };
type Device = {
  id: string;
  name: string;
  pointId: string | null;
  ssid: string;
  lastIp: string | null;
  lastSeen: string | null;
  fw: string | null;
  rssi: number | null;
  hasToken: boolean;
};
type Ready = { id?: string; fw?: string; name?: string; mode?: string; ip?: string; ap?: string; setup?: string; ssid?: string; token?: string };
type Net = { ssid: string; rssi: number | null };
type Activity = { at: string; name: string; subjectId?: string | null; ok: boolean; reason?: string; title: string; why: string; kind: "ok" | "rechazo" | "problema" };
type Group = { key: string; items: Activity[] };

function fuerza(rssi: number | null) {
  if (rssi == null) return "";
  if (rssi >= -55) return "Fuerte";
  if (rssi >= -72) return "Media";
  return "Débil";
}

function hace(iso: string | null, now: number) {
  if (!iso) return "aún no";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return `hace ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(t));
}

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date(iso));
}

function reloj(iso: string | null) {
  if (!iso) return "sin contacto";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function diaBogota(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function agrupar(list: Activity[]): Group[] {
  const sorted = [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const chunks: Activity[][] = [];
  for (const ev of sorted) {
    const bucket = chunks[chunks.length - 1];
    const last = bucket?.[bucket.length - 1];
    const gap = last ? Date.parse(ev.at) - Date.parse(last.at) : Infinity;
    if (last && last.name === ev.name && last.why === ev.why && gap <= 3 * 60 * 1000) bucket.push(ev);
    else chunks.push([ev]);
  }
  return chunks.reverse().map((items) => ({ key: `${items[items.length - 1].at}-${items.length}-${items[0].why}`, items }));
}

function enLinea(iso: string | null, now: number) {
  return !!iso && now - Date.parse(iso) < 45000;
}

export default function TorniquetesPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [gymName, setGymName] = useState("esta sede");
  const [agent, setAgent] = useState<boolean | null>(null);
  const [ports, setPorts] = useState<Port[]>([]);
  const [port, setPort] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [today, setToday] = useState({ total: 0, granted: 0, denied: 0 });
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const [recognition, setRecognition] = useState<boolean | null>(null);
  const [nets, setNets] = useState<Net[]>([]);
  const scannedPort = useRef("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [claveOk, setClaveOk] = useState(false);
  const [name, setName] = useState("Entrada");
  const [doorName, setDoorName] = useState("Entrada principal");
  const [pointId, setPointId] = useState("");
  const [usb, setUsb] = useState<Ready | null>(null);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [zona, setZona] = useState<"chip" | "red" | "clave" | "puerta" | "sede">("chip");
  const notaRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState("");
  const [tech, setTech] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [prueba, setPrueba] = useState<string | null>(null);
  const [pruebaResult, setPruebaResult] = useState<"ok" | "fail" | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pasosInc, setPasosInc] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/turnstiles?gym=${encodeURIComponent(id)}`, { cache: "no-store" });
    const d = await r.json();
    setDevices(d.devices || []);
    setPoints(d.points || []);
    setActivity(d.activity || []);
    setToday(d.today || { total: 0, granted: 0, denied: 0 });
    setLoadedAt(Date.now());
    setListo(true);
    setRecognition(typeof d.recognition === "boolean" ? d.recognition : null);
  }, []);

  const detect = useCallback(async (manual = false) => {
    if (manual) setBusy("detect");
    try {
      const h = await fetch(`${AGENT}/health`, { cache: "no-store" });
      setAgent(h.ok);
      if (!h.ok) return;
      const r = await fetch(`${AGENT}/ports`, { cache: "no-store" });
      const d = await r.json();
      const list: Port[] = d.ports || [];
      setPorts(list);
      const usbPort = list.find((p) => p.usb) || list[0];
      if (usbPort) setPort((prev) => prev || usbPort.port);
    } catch {
      setAgent(false);
    } finally {
      if (manual) setBusy((b) => (b === "detect" ? "" : b));
    }
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    fetch("/api/gyms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const g = (d.items || []).find((x: { id: string }) => x.id === id);
        if (g?.name) setGymName(g.name);
      })
      .catch(() => {});
    load(id);
    detect();
    const dataTimer = setInterval(() => load(id), 8000);
    const usbTimer = setInterval(() => detect(), 4000);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      clearInterval(dataTimer);
      clearInterval(usbTimer);
      clearInterval(clock);
    };
  }, [load, detect]);

  async function crearPuerta() {
    const nombre = doorName.trim();
    if (nombre.length < 2) return;
    setZona("puerta");
    setBusy("puerta");
    setMsg("");
    setMsgOk(true);
    try {
      const r = await fetch("/api/turnstiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: gymId, action: "create-door", name: nombre }),
      });
      const d = await r.json();
      if (!d.ok || !d.point?.id) {
        setMsgOk(false);
        setMsg("No se pudo crear la puerta. Revisa que el control de acceso esté en línea.");
      } else {
        setPointId(d.point.id);
        setMsgOk(true);
        setMsg(`Puerta “${d.point.name}” creada. Ya puedes asignarle el dispositivo.`);
        await load(gymId);
      }
    } catch {
      setMsgOk(false);
      setMsg("No se pudo crear la puerta.");
    }
    setBusy("");
  }

  async function leer() {
    if (!port) return;
    setZona("chip");
    setBusy("leer");
    setMsgOk(true);
    setMsg("Leyendo el chip…");
    try {
      const r = await fetch(`${AGENT}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port }) });
      const d = await r.json();
      if (!d.ok) {
        setMsgOk(false);
        setMsg("El chip se está reiniciando por el cable. Espera un momento y pulsa Identificar otra vez.");
      }
      else {
        setUsb(d.device);
        if (d.device?.name) setName(d.device.name);
        if (d.device?.ssid) setSsid(d.device.ssid);
        setClaveOk(false);
        if (d.device?.fw && d.device.fw !== FIRMWARE) {
          setMsg(`Identificado. El chip tiene ${d.device.fw} y hace falta ${FIRMWARE}. Instala el sistema antes de probar la red.`);
        } else {
          setMsg(d.device?.ip ? "Dispositivo identificado y en red." : `Identificado. Está esperando red por el Wi-Fi ${d.device?.ap || "FE"}.`);
        }
      }
    } catch {
      setMsg("No pude hablar con el puente USB.");
    }
    setBusy("");
  }

  const redes = useCallback(async (which: string) => {
    if (!which) return;
    setZona("red");
    setBusy("redes");
    setMsgOk(true);
    setMsg("Buscando redes cerca del torniquete…");
    try {
      const r = await fetch(`${AGENT}/wifi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: which }) });
      const d = await r.json();
      const list: Net[] = (d.nets || []).map((item: Net | string) => (
        typeof item === "string" ? { ssid: item, rssi: null } : { ssid: item.ssid, rssi: item.rssi ?? null }
      )).filter((item: Net) => item.ssid);
      setNets(list);
      setClaveOk(false);
      setSsid((prev) => (list.some((item) => item.ssid === prev) ? prev : ""));
      setMsg(list.length ? "Elige la red y prueba la clave antes de guardarla." : typeof d.scan === "number" && d.scan < 0 ? "La radio no alcanzó a buscar. Pulsa Actualizar otra vez." : "No hay redes de 2.4 GHz cerca del torniquete. Una red solo de 5 GHz no aparece.");
    } catch {
      setMsg("No pude hablar con el puente USB.");
    }
    setBusy("");
  }, []);

  useEffect(() => {
    if (!port || agent !== true || usb?.fw !== FIRMWARE || scannedPort.current === port) return;
    scannedPort.current = port;
    redes(port);
  }, [port, agent, usb?.fw, redes]);

  async function probarClave() {
    if (!port || !ssid) return;
    setZona("clave");
    setBusy("probar");
    setMsgOk(true);
    setMsg("Probando la clave, sin guardarla…");
    try {
      const r = await fetch(`${AGENT}/try`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, ssid, password }),
      });
      const d = await r.json();
      if (d.result === "ok") {
        setClaveOk(true);
        setMsgOk(true);
        setMsg("La clave es correcta. Ya puedes conectar el dispositivo a la red.");
      } else if (d.result === "clave") {
        setClaveOk(false);
        setMsgOk(false);
        setMsg("La clave no es correcta. No se guardó nada.");
      } else if (d.result === "no_red") {
        setClaveOk(false);
        setMsgOk(false);
        setMsg("El torniquete ya no ve esa red. Actualiza la lista.");
      } else {
        setClaveOk(false);
        setMsgOk(false);
        setMsg("No se pudo comprobar. Acerca el torniquete a la red e inténtalo otra vez.");
      }
    } catch {
      setMsgOk(false);
      setMsg("No pude hablar con el puente USB.");
    }
    setBusy("");
  }

  async function flashear() {
    if (!port) return;
    if (!window.confirm("El torniquete quedará fuera de línea unos segundos mientras se instala el sistema en el chip. No desconectes el cable.")) return;
    setZona("chip");
    setBusy("flash");
    setMsgOk(true);
    setMsg("Preparando el sistema. Todavía no pulses los botones.");
    try {
      const prep = await fetch(`${AGENT}/flash`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port, stage: "prepare" }) });
      const prepared = await prep.json();
      if (prepared.ok && !prepared.needBoot) {
        setUsb(prepared.ready || null);
        setMsg(prepared.ready?.id ? "Sistema instalado. Elige la red y conéctalo." : "Sistema instalado. Pulsa Identificar.");
      } else if (!prepared.needBoot) {
        setMsgOk(false);
        setMsg(prepared.detail || "No se pudo instalar el sistema.");
      } else {
        setMsg("Ahora sí, en este orden: mantén BOOT. Sin soltarlo, pulsa EN y suelta EN. Después suelta BOOT. No pita. Tienes unos 45 segundos.");
        const sent = await fetch(`${AGENT}/flash`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port, stage: "send" }) });
        const d = await sent.json();
        if (!d.ok) {
          setMsgOk(false);
          setMsg(d.detail || "No se pudo instalar el sistema.");
        } else {
          setUsb(d.ready || null);
          setMsgOk(true);
          setMsg(d.ready?.id ? "Sistema instalado. Elige la red y conéctalo." : "Sistema instalado. Pulsa Identificar.");
        }
      }
    } catch {
      setMsgOk(false);
      setMsg("La instalación tardó demasiado o el puente se cayó.");
    }
    setBusy("");
    load(gymId);
  }

  async function grabar() {
    if (!claveOk) {
      setZona("clave");
      setMsgOk(false);
      setMsg("Primero prueba la clave. Si no entra, no se guarda.");
      return;
    }
    setZona("puerta");
    if (!port || ssid.trim().length < 1 || name.trim().length < 2 || !pointId) {
      setMsg("Ponle nombre, elige la red y asigna la puerta.");
      return;
    }
    setBusy("grabar");
    setMsg("Enviando la red al dispositivo…");
    try {
      const r = await fetch(`${AGENT}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, ssid: ssid.trim(), password, name: name.trim() }),
      });
      const d = await r.json();
      const saved: Ready | undefined = d.saved;
      const ready: Ready | undefined = d.ready;
      if (!d.ok || !saved?.id || !saved?.token) {
        setClaveOk(false);
        setZona("clave");
        setMsgOk(false);
        setMsg("El dispositivo no guardó la red. Prueba la clave otra vez.");
        setBusy("");
        return;
      }
      if (!ready?.ip) {
        setUsb(ready || saved);
        setClaveOk(false);
        setZona("clave");
        setMsgOk(false);
        setMsg("La clave no coincidió. No se dejó guardada en la sede. Corrígelas y pulsa Probar clave.");
        setBusy("");
        return;
      }
      const save = await fetch("/api/turnstiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym: gymId,
          id: saved.id,
          token: saved.token,
          name: name.trim(),
          pointId: pointId || null,
          ssid: ssid.trim(),
          ip: ready?.ip || null,
          fw: ready?.fw || saved.fw || FIRMWARE,
        }),
      });
      const savedGym = await save.json();
      setUsb(ready || saved);
      setPassword("");
      if (!savedGym.door) setMsg("En línea. Falta confirmar la puerta cuando el acceso responda.");
      else setMsg("Conectado. El dispositivo conserva su identidad aunque mañana cambie de red.");
    } catch {
      setMsg("No se pudo conectar. El cable tiene que seguir puesto.");
    }
    setBusy("");
    load(gymId);
  }

  async function quitar(id: string, puerta: string) {
    if (!window.confirm(`${puerta} deja de tener controlador. El chip no se borra y la red del dispositivo sigue igual.`)) return;
    setZona("sede");
    setMsg("");
    setMsgOk(true);
    try {
      const r = await fetch("/api/turnstiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forget", gym: gymId, id }),
      });
      const d = await r.json();
      if (!d.ok) {
        setMsgOk(false);
        setMsg("No se pudo quitar de esta sede.");
        return;
      }
      setSetupOpen(true);
      setMsg(d.door === false
        ? "Salió de la sede, pero la puerta no confirmó que quedó sin controlador."
        : "Esta sede ya no usa ese torniquete. Conecta el USB-C y sigue el asistente para enrolarlo otra vez.");
    } catch {
      setMsgOk(false);
      setMsg("No se pudo quitar de esta sede.");
    }
    load(gymId);
  }

  async function probarAcceso(id: string) {
    setBusy("abrir");
    setPruebaResult(null);
    setMsgOk(true);
    setMsg("");
    try {
      const r = await fetch(`/api/access/test-open?point=${encodeURIComponent(id)}`, { method: "POST" });
      const d = await r.json();
      setPruebaResult(d.ok ? "ok" : "fail");
    } catch {
      setPruebaResult("fail");
    }
    setBusy("");
  }

  const offline = devices.filter((d) => !enLinea(d.lastSeen, now));
  const puertas = new Set(devices.map((d) => d.pointId).filter(Boolean)).size;
  const recientesPreview = activity.slice(0, 5);
  const recientes = activity.filter((a) => now - Date.parse(a.at) <= 24 * 60 * 60 * 1000);
  const rafagas = agrupar(recientes).filter((g) => g.items.length >= 5 && g.items[0].kind === "problema");
  const showSetup = setupOpen || (listo && devices.length === 0);
  const detectado = agent === true && !!port;
  const identificado = !!usb?.id;
  const sistemaOk = usb?.fw === FIRMWARE;
  const enRed = usb?.mode === "red" && !!usb?.ip;
  const pasos = [
    { n: "1", t: "Detectar", d: port ? "Dispositivo encontrado" : "Conecta el cable", ok: detectado },
    { n: "2", t: "Identificar", d: usb?.id || "Lee el chip", ok: identificado },
    { n: "3", t: "Sistema", d: !usb?.fw ? `Instalar ${FIRMWARE}` : sistemaOk ? `Versión ${usb.fw}` : `${usb.fw} · falta ${FIRMWARE}`, ok: sistemaOk },
    { n: "4", t: "Red", d: !sistemaOk ? "Después del sistema" : claveOk ? `${ssid} · clave probada` : ssid ? "Prueba la clave" : "Elige la red", ok: claveOk },
    { n: "5", t: "Puerta", d: !claveOk ? "Después de la clave" : (points.find((p) => p.id === pointId)?.name || "Elige la puerta"), ok: !!pointId && enRed },
  ];

  useEffect(() => {
    if (!msg) return;
    notaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msg, zona]);

  function nota(z: "chip" | "red" | "clave" | "puerta" | "sede") {
    if (!msg || zona !== z) return null;
    return (
      <p ref={notaRef} role="status" className={`mt-2 rounded-xl border px-3 py-2 text-sm font-medium ${msgOk ? "border-status-ok/40 bg-status-ok/10 text-status-ok" : "border-status-err/40 bg-status-err/10 text-status-err"}`}>
        {msg}
      </p>
    );
  }

  return (
    <GymShell active="torniquetes">
      <div className="px-6 py-6">
        <p className={`text-sm font-bold ${offline.length || recognition === false ? "text-status-warn" : devices.length ? "text-status-ok" : "text-gym-muted"}`}>
          {!listo
            ? "Leyendo la sede…"
            : devices.length === 0
            ? "Sin controlador asignado"
            : offline.length
              ? `⚠ ${offline.length === 1 ? "Controlador desconectado" : `${offline.length} controladores desconectados`}`
              : "● Controlador en línea"}
        </p>
        <p className="mt-1 text-xs text-gym-muted">
          {gymName} · {loadedAt ? `actualizado ${hace(new Date(loadedAt).toISOString(), now)}` : "cargando"}
          {devices.length > 0 ? " · El brazo del torniquete no avisa si está enchufado." : ""}
        </p>

        <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass px-4 py-3">
            <div className="text-lg font-extrabold text-white">{puertas}</div>
            <div className="text-[11px] uppercase tracking-wider text-gym-muted">{puertas === 1 ? "puerta" : "puertas"}</div>
          </div>
          <a href="/accesos?dia=hoy" className="glass px-4 py-3 ring-1 ring-transparent transition hover:ring-gym-primary/60">
            <div className="text-lg font-extrabold text-white">{today.total}</div>
            <div className="text-[11px] uppercase tracking-wider text-gym-primary">{today.total === 1 ? "acceso hoy" : "accesos hoy"}</div>
          </a>
          <a href="/accesos?dia=hoy&resultado=concedido" className="glass px-4 py-3 ring-1 ring-transparent transition hover:ring-gym-primary/60">
            <div className="text-lg font-extrabold text-white">{today.granted}</div>
            <div className="text-[11px] uppercase tracking-wider text-gym-muted">{today.granted === 1 ? "aprobado" : "aprobados"}</div>
          </a>
          <div className={`glass px-4 py-3 ${offline.length ? "border-status-warn/50" : ""}`}>
            <div className={`text-lg font-extrabold ${offline.length ? "text-status-warn" : "text-white"}`}>{offline.length ? offline.length : Math.max(devices.length - offline.length, 0)}</div>
            <div className="text-[11px] uppercase tracking-wider text-gym-muted">{offline.length ? (offline.length === 1 ? "desconectado" : "desconectados") : "en línea"}</div>
          </div>
        </div>
        <p className="mb-4 text-xs text-gym-muted">
          <a href="/accesos?dia=hoy&resultado=denegado" className="font-semibold text-gym-primary">{today.denied} {today.denied === 1 ? "rechazado" : "rechazados"} hoy</a>
          . Una cara desconocida es un evento; solo se vuelve incidencia si se repite.
        </p>

                <KioskPairingPanel gymId={gymId} points={points} />

<section className="mb-5 space-y-2">
          {offline.map((d) => (
            <div key={d.id} className="rounded-2xl border border-status-warn/40 bg-status-warn/10 px-4 py-3">
              <div className="text-sm font-bold text-status-warn">Torniquete sin comunicación</div>
              <div className="mt-1 text-sm font-semibold text-white">{d.ssid || d.name}</div>
              <div className="text-xs text-gym-silver">Último contacto: {reloj(d.lastSeen)} · {hace(d.lastSeen, now)}</div>
              {pasosInc === d.id && (
                <div className="mt-2 text-xs text-gym-silver">
                  <p>Qué significa: el sistema no recibe respuesta de ese controlador.</p>
                  <p className="mt-1">Qué hacer: revisa la alimentación, la red {d.ssid || "en la que estaba"} y, si hay que reconfigurarlo, la conexión USB.</p>
                </div>
              )}
              <button type="button" onClick={() => setPasosInc(pasosInc === d.id ? null : d.id)} className="mt-2 text-xs font-semibold text-gym-primary">{pasosInc === d.id ? "Ocultar" : "Diagnosticar"}</button>
            </div>
          ))}
          {recognition === false && (
            <div className="rounded-2xl border border-status-warn/40 bg-status-warn/10 px-4 py-3">
              <div className="text-sm font-bold text-status-warn">Reconocimiento sin respuesta</div>
              <p className="mt-1 text-xs text-gym-silver">La puerta no puede identificar un rostro hasta que el reconocimiento vuelva.</p>
            </div>
          )}
          {rafagas.map((g) => (
            <div key={g.key} className="rounded-2xl border border-status-warn/40 bg-status-warn/10 px-4 py-3">
              <div className="text-sm font-bold text-status-warn">Actividad inusual</div>
              <div className="mt-1 text-sm text-white">{g.items[0].name} · {g.items.length} veces</div>
              <div className="text-xs text-gym-silver">{hora(g.items[0].at)} – {hora(g.items[g.items.length - 1].at)}</div>
              <button type="button" onClick={() => setAbierto(abierto === g.key ? null : g.key)} className="mt-2 text-xs font-semibold text-gym-primary">{abierto === g.key ? "Ocultar" : "Ver actividad"}</button>
              {abierto === g.key && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-gym-muted">
                  {g.items.map((ev) => <li key={ev.at}>{hora(ev.at)}</li>)}
                </ul>
              )}
            </div>
          ))}
        </section>

        <section className="mb-5 space-y-3">
          {listo && devices.length === 0 && <p className="glass p-4 text-sm text-gym-muted">Todavía no hay un torniquete en esta sede. Conéctalo por USB y sigue el asistente.</p>}
          {devices.map((d) => {
            const on = enLinea(d.lastSeen, now);
            const door = points.find((p) => p.id === d.pointId);
            const senal = d.rssi != null ? `${fuerza(d.rssi)} · ${d.rssi} dBm` : "Sin lectura de señal";
            const vias = [
              {
                k: "Controlador",
                v: on ? "En línea" : "Desconectado",
                d: on
                  ? `${hace(d.lastSeen, now)} · ${d.ssid || "red sin nombre"} · ${d.lastIp || "sin IP"} · ${senal}`
                  : `Último aviso ${hace(d.lastSeen, now)}. Si pasa de un minuto sin avisar, está fuera.`,
                ok: on,
              },
              {
                k: "Reconocimiento",
                v: recognition == null ? "Sin dato" : recognition ? "En línea" : "Sin respuesta",
                d: recognition ? "La cámara puede identificar un rostro." : recognition === false ? "Sin esto la puerta no sabe quién llega." : "Todavía no hay lectura del reconocimiento.",
                ok: recognition === true,
              },
              {
                k: "Brazo",
                v: "Sin confirmación",
                d: "Este equipo no dice si el torniquete está enchufado. En línea solo significa que el controlador habla.",
                ok: null as boolean | null,
              },
            ];
            return (
              <article key={d.id} id={`dispositivo-${d.id}`} className={`glass p-5 ${on ? "" : "border-status-warn/50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Puerta</div>
                    <h3 className="mt-1 text-2xl font-extrabold text-white">{door?.name || "Sin puerta asignada"}</h3>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-status-ok/15 text-status-ok" : "bg-status-warn/15 text-status-warn"}`}>
                    {on ? `En línea · ${hace(d.lastSeen, now)}` : `Desconectado · ${hace(d.lastSeen, now)}`}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {vias.map((item) => (
                    <div key={item.k} className="rounded-xl border border-gym-border/60 bg-gym-navy/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{item.k}</span>
                        <span className={`text-xs font-bold ${item.ok === true ? "text-status-ok" : item.ok === false ? "text-status-warn" : "text-gym-muted"}`}>{item.v}</span>
                      </div>
                      <p className="mt-1 text-xs text-gym-muted">{item.d}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gym-muted">
                  <span>Firmware {d.fw === FIRMWARE ? d.fw : d.fw ? `${d.fw} · falta ${FIRMWARE}` : "desconocido"}</span>
                  {agent && port && !on ? <span>El cable {port} no cuenta como torniquete en línea.</span> : null}
                </div>
                {!on && (
                  <p className="mt-2 text-sm text-gym-silver">Revisa la corriente del controlador y que siga unido a {d.ssid || "la red del gimnasio"}.</p>
                )}

                <details className="mt-4 text-xs text-gym-muted">
                  <summary className="cursor-pointer font-semibold text-gym-silver">Información del dispositivo</summary>
                  <p className="mt-2 max-w-xl">Este modelo no reporta el estado físico del brazo. El sistema puede ordenar una apertura, pero no confirmar si el paso quedó abierto o cerrado.</p>
                </details>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={!d.pointId} onClick={() => { setPrueba(d.pointId); setPruebaResult(null); }} className="btn-gym px-4 py-2 text-xs disabled:opacity-40">Probar acceso</button>
                  <button type="button" onClick={() => setTech((v) => !v)} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">{tech ? "Ocultar técnica" : "Información técnica"}</button>
                  <button type="button" onClick={() => quitar(d.id, door?.name || "Esta puerta")} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-muted">Quitar de esta sede</button>
                </div>
                {nota("sede")}

                {prueba === d.pointId && (
                  <div className="mt-3 rounded-xl border border-gym-border/70 bg-gym-navy/40 p-3">
                    <div className="text-sm font-bold text-white">Ejecutar prueba</div>
                    <p className="mt-1 text-xs text-gym-muted">Enviar la orden mueve el brazo. Hazlo solo si estás junto a la puerta.</p>
                    <ol className="mt-2 space-y-1 text-sm text-gym-silver">
                      <li>Conexión {on ? "✓" : "⚠"}</li>
                      <li>Reconocimiento {recognition ? "✓" : recognition === false ? "⚠" : "—"}</li>
                      <li>Autorización ●</li>
                      <li>Comando de apertura {pruebaResult === "ok" ? "✓" : pruebaResult === "fail" ? "✕" : "·"}</li>
                      <li>Respuesta física —</li>
                    </ol>
                    {pruebaResult === "ok" && <p className="mt-2 text-sm font-semibold text-status-ok">La orden llegó. El brazo no confirma si se movió.</p>}
                    {pruebaResult === "fail" && <p className="mt-2 text-sm font-semibold text-status-err">La respuesta no se guardó. Si el brazo se movió, la orden sí salió.</p>}
                    <div className="mt-3 flex gap-2">
                      <button type="button" disabled={!!busy} onClick={() => d.pointId && probarAcceso(d.pointId)} className="btn-gym px-3 py-1.5 text-xs disabled:opacity-40">{busy === "abrir" ? "Enviando…" : "Enviar orden"}</button>
                      <button type="button" onClick={() => setPrueba(null)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-muted">Cerrar</button>
                    </div>
                  </div>
                )}

                {tech && (
                  <dl className="mt-3 grid gap-2 rounded-xl border border-gym-border/60 bg-gym-navy/40 p-3 text-xs text-gym-silver sm:grid-cols-2">
                    <div><dt className="text-gym-muted">Identidad</dt><dd className="font-mono">{d.id}</dd></div>
                    <div><dt className="text-gym-muted">Última IP conocida</dt><dd>{d.lastIp || "—"}</dd></div>
                    <div><dt className="text-gym-muted">Firmware</dt><dd>{d.fw || "—"}</dd></div>
                    <div><dt className="text-gym-muted">Señal</dt><dd>{d.rssi != null ? `${d.rssi} dBm · ${fuerza(d.rssi)}` : "Sin lectura"}</dd></div>
                    <div><dt className="text-gym-muted">Última red</dt><dd>{d.ssid || "—"}</dd></div>
                    <div><dt className="text-gym-muted">Último contacto</dt><dd>{hace(d.lastSeen, now)}</dd></div>
                  </dl>
                )}
              </article>
            );
          })}
        </section>

        <section className="glass mb-5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Configurar dispositivo</div>
              <div className="text-sm text-gym-silver">Conexión local por USB</div>
            </div>
            {devices.length > 0 && (
              <button type="button" onClick={() => setSetupOpen((v) => !v)} className="text-xs font-semibold text-gym-primary">{showSetup ? "Ocultar" : "Configurar"}</button>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gym-border/60 px-3 py-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Conexión local</div>
              <div className="text-sm font-semibold text-white">{busy === "detect" ? "Buscando puente…" : agent === null ? "Buscando el puente…" : agent ? `● Puente listo${port ? ` · ${port}` : ""}` : "○ Puente apagado"}</div>
              <div className="text-xs text-gym-muted">{agent ? (port ? "El computador ve el dispositivo por USB. Este equipo solo hace falta mientras dura el cable." : "El puente está listo, pero no ve el cable. Revisa el USB-C.") : agent === null ? "Comprobando el computador de esta sede…" : "Para instalar hace falta el puente en el computador que tiene el cable. Después el torniquete habla solo con el servidor."}</div>
            </div>
            <button type="button" onClick={() => detect(true)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Detectar dispositivos</button>
          </div>

          {showSetup && (
            <>
              <ol className="mb-4 grid gap-2 sm:grid-cols-5">
                {pasos.map((p, i) => {
                  const bloqueado = pasos.slice(0, i).some((prev) => !prev.ok);
                  return (
                    <li key={p.n} className={`rounded-xl border px-3 py-2 ${p.ok ? "border-status-ok/40 bg-status-ok/10" : bloqueado ? "border-gym-border/40 opacity-50" : "border-gym-border/60"}`}>
                      <div className="text-[11px] text-gym-muted">{p.n} · {p.t}</div>
                      <div className="text-xs font-semibold text-white">{p.ok ? "✓ " : bloqueado ? "○ " : ""}{p.d}</div>
                    </li>
                  );
                })}
              </ol>

              <label className="text-xs text-gym-muted">Puerto
                <select value={port} onChange={(e) => { setPort(e.target.value); setUsb(null); setClaveOk(false); setNets([]); scannedPort.current = ""; }} className="mt-1 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white">
                  <option value="">Ninguno</option>
                  {ports.map((p) => <option key={p.port} value={p.port}>{p.port} · {p.name}</option>)}
                </select>
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={!!busy || !detectado} onClick={leer} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver disabled:opacity-40">Identificar</button>
                <button type="button" disabled={!!busy || !identificado} onClick={flashear} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver disabled:opacity-40">{busy === "flash" ? "Instalando…" : sistemaOk ? "Reinstalar sistema" : "Instalar sistema"}</button>
              </div>
              {nota("chip")}

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gym-silver">Red inalámbrica</span>
                  <button type="button" disabled={!!busy || !sistemaOk} onClick={() => redes(port)} className="text-[11px] font-semibold text-gym-primary disabled:opacity-40">Actualizar</button>
                </div>
                {nota("red")}
                {!sistemaOk && <p className="mb-2 text-sm text-gym-muted">{usb?.fw ? `El chip tiene ${usb.fw}. Instala ${FIRMWARE} antes de buscar redes o probar la clave.` : "Identifica el chip e instala el sistema antes de la red."}</p>}
                {sistemaOk && busy === "redes" && <p className="mb-2 text-sm text-gym-silver">Buscando redes…</p>}
                {sistemaOk && busy !== "redes" && nets.length === 0 && zona !== "red" && <p className="mb-2 text-sm text-gym-muted">Pulsa Actualizar para ver las redes de 2.4 GHz.</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {nets.map((n) => (
                    <button key={n.ssid} type="button" disabled={!sistemaOk} onClick={() => { setSsid(n.ssid); setClaveOk(false); }} className={`rounded-xl border px-3 py-2 text-left disabled:opacity-40 ${ssid === n.ssid ? "border-gym-primary bg-gym-primary/10" : "border-gym-border/70 bg-gym-navy/30"}`}>
                      <div className="text-sm font-semibold text-white">{n.ssid}</div>
                      {fuerza(n.rssi) && <div className="text-[11px] text-gym-muted">{fuerza(n.rssi)}</div>}
                    </button>
                  ))}
                </div>
              </div>

              {sistemaOk && ssid && (
                <div className="mt-3">
                  <label className="text-xs text-gym-muted">Clave de {ssid}
                    <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setClaveOk(false); if (zona === "clave") setMsg(""); }} autoComplete="new-password" className={`mt-1 w-full rounded-xl border bg-gym-navy/80 px-3 py-2 text-sm text-white ${claveOk ? "border-status-ok" : zona === "clave" && msg && !msgOk ? "border-status-err" : "border-gym-border"}`} placeholder="Solo se escribe en el dispositivo" />
                  </label>
                  <button type="button" disabled={!!busy || password.length < 1} onClick={probarClave} className="mt-2 rounded-xl border border-gym-primary/50 px-3 py-2 text-xs font-semibold text-gym-primary disabled:opacity-40">
                    {busy === "probar" ? "Probando clave…" : "Probar clave"}
                  </button>
                  {nota("clave")}
                </div>
              )}

              <p className="mt-3 text-xs text-gym-muted">La clave no se guarda en esta consola. Primero se prueba en el chip y, si entra, se envía otra vez al conectarlo.</p>

              {claveOk && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-gym-muted sm:col-span-2">Nombre en el sistema
                    <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white" />
                  </label>
                  <div className="text-xs text-gym-muted sm:col-span-2">Puerta de esta sede
                    <select value={pointId} onChange={(e) => setPointId(e.target.value)} className="mt-1 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white">
                      <option value="">Sin asignar</option>
                      {points.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="mt-2 flex gap-2">
                      <input value={doorName} onChange={(e) => setDoorName(e.target.value)} placeholder="Nombre de la puerta" className="min-w-0 flex-1 rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white" />
                      <button type="button" disabled={!!busy || doorName.trim().length < 2} onClick={crearPuerta} className="rounded-xl border border-gym-primary/50 px-3 py-2 text-xs font-semibold text-gym-primary disabled:opacity-40">{busy === "puerta" ? "Creando…" : "Crear puerta"}</button>
                    </div>
                  </div>
                  <button type="button" disabled={!!busy || name.trim().length < 2 || !pointId} onClick={grabar} className="btn-gym px-4 py-2 text-xs disabled:opacity-40 sm:col-span-2 sm:w-fit">{busy === "grabar" ? "Conectando…" : "Conectar a la red"}</button>
                  <div className="sm:col-span-2">{nota("puerta")}</div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Últimos intentos</h3>
            <a href="/accesos?dia=hoy" className="text-[11px] font-semibold text-gym-primary">Ver historial completo</a>
          </div>
          {recientesPreview.length === 0 && <p className="mt-3 text-sm text-gym-muted">Todavía no hay intentos en la puerta.</p>}
          <ul className="mt-3 space-y-2">
            {recientesPreview.map((a) => (
              <li key={`${a.at}-${a.subjectId || a.name}`} className="rounded-xl border border-gym-border/50 bg-gym-navy/30 px-3 py-2">
                <div className="text-[11px] text-gym-muted">{hora(a.at)} · {a.name}</div>
                <div className={`text-sm font-semibold ${a.ok ? "text-status-ok" : "text-status-err"}`}>{a.title}</div>
                <div className="text-xs text-gym-silver">{a.why}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </GymShell>
  );
}
