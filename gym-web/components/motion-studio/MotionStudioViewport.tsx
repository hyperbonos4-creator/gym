"use client";

import { Component, Suspense, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import MotionStudioAvatar from "./MotionStudioAvatar";
import { MOTION_STUDIO_SOURCES, sceneCamera, type MotionAngles, type MotionCamera, type MotionRigReport } from "../../lib/motion-studio/models";

type BoundaryProps = { children: ReactNode; resetKey: string };
type BoundaryState = { hasError: boolean; message?: string };

class ModelLoadBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "No se pudo cargar el GLB.",
    };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("[Motion Studio] Error cargando el modelo GLB:", error);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="font-semibold text-white">Este archivo no se pudo leer como GLB</p>
            <p className="mt-2 max-w-md text-sm text-gym-muted">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RigReportPanel({ report }: { report: MotionRigReport | null }) {
  if (!report) return <p className="text-sm text-gym-muted">Leyendo esqueleto…</p>;
  const hasRig = report.boneCount > 0 && report.skinnedMeshCount > 0;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Mallas" value={report.meshCount} />
        <Metric label="Articuladas" value={report.skinnedMeshCount} />
        <Metric label="Huesos" value={report.boneCount} />
        <Metric label="Clips" value={report.clips.length} />
      </div>
      <p className={`rounded-lg border px-3 py-2 text-[12px] leading-snug ${hasRig ? "border-emerald-400/30 text-emerald-100" : "border-rose-400/30 text-rose-100"}`}>
        {hasRig
          ? "Hay una malla unida a un esqueleto. Eso confirma la estructura. No confirma que una sentadilla, un press o un curl se deformen bien."
          : "Este archivo no pasó la comprobación básica. No lo uses como avatar todavía."}
      </p>
      {report.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 px-3 py-2 text-[12px] text-amber-100">
          {report.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      <details className="rounded-lg border border-gym-border/70 px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-gym-silver">Huesos ({report.boneCount})</summary>
        <p className="mt-2 text-[11px] text-gym-muted">Altura aproximada: {report.heightInSceneUnits ?? "no disponible"} unidades</p>
        <div className="mt-2 max-h-40 overflow-auto font-mono text-[11px] text-gym-silver">
          {report.boneNames.length ? report.boneNames.map((bone) => <div key={bone}>{bone}</div>) : "Sin huesos."}
        </div>
      </details>
      <details className="rounded-lg border border-gym-border/70 px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-gym-silver">Clips ({report.clips.length})</summary>
        <div className="mt-2 space-y-1 text-[11px] text-gym-muted">
          {report.clips.length === 0
            ? <p>El GLB no trae animaciones. Las poses de la ficha pueden estar fuera de este archivo.</p>
            : report.clips.map((clip) => (
              <p key={clip.name}>{clip.name} · {clip.durationSeconds.toFixed(2)} s · {clip.trackCount} pistas · {clip.tracksMatchingBones} coinciden con huesos</p>
            ))}
        </div>
      </details>
    </div>
  );
}

function Angle({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-lg border border-gym-border/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gym-muted">{label}</div>
      <div className="text-lg font-extrabold text-white">{value == null ? "—" : `${value}°`}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gym-border/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gym-muted">{label}</div>
      <div className="text-xl font-extrabold text-white">{value}</div>
    </div>
  );
}

function MissingFile({ src }: { src: string }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-semibold text-white">Falta el personaje</p>
        <p className="mt-2 text-sm leading-snug text-gym-muted">
          El zip de 12 KB es el módulo de diagnóstico, no el modelo de Fab. Copia el GLB licenciado a <span className="text-gym-silver">public{src}</span>.
        </p>
      </div>
    </div>
  );
}

const VIEWS = [
  { id: "frente", label: "Frente" },
  { id: "perfil", label: "Perfil" },
  { id: "tres", label: "Tres cuartos" },
] as const;

function CameraBookmark({ shot, nonce }: { shot: MotionCamera; nonce: number }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { target?: Vector3; update?: () => void } | null;
  useEffect(() => {
    const framed = sceneCamera(shot);
    camera.up.set(0, 1, 0);
    camera.position.set(framed.position[0], framed.position[1], framed.position[2]);
    camera.lookAt(framed.target[0], framed.target[1], framed.target[2]);
    if (controls?.target) {
      controls.target.set(framed.target[0], framed.target[1], framed.target[2]);
      controls.update?.();
    }
  }, [camera, controls, nonce, shot]);
  return null;
}

function formatClock(time: number, duration: number) {
  const left = Math.max(0, time);
  const total = Math.max(0.1, duration);
  return `${left.toFixed(1)} s / ${total.toFixed(1)} s`;
}

export default function MotionStudioViewport() {
  const [modelKey, setModelKey] = useState(MOTION_STUDIO_SOURCES[0].key);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("modelo");
    if (key && MOTION_STUDIO_SOURCES.some((item) => item.key === key)) setModelKey(key);
  }, []);
  const [present, setPresent] = useState<boolean | null>(null);
  const [report, setReport] = useState<MotionRigReport | null>(null);
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [clock, setClock] = useState({ time: 0, duration: 5 });
  const [ghost, setGhost] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("tres");
  const [viewNonce, setViewNonce] = useState(0);
  const [angles, setAngles] = useState<MotionAngles | null>(null);
  const dragging = useRef(false);
  const model = MOTION_STUDIO_SOURCES.find((item) => item.key === modelKey) ?? MOTION_STUDIO_SOURCES[0];
  const reportCallback = useCallback((next: MotionRigReport) => setReport(next), []);
  const errorCallback = useCallback((message: string) => setLoadError(message), []);
  const progressCallback = useCallback((ratio: number | null) => setProgress(ratio), []);
  const clockCallback = useCallback((time: number, duration: number) => {
    if (dragging.current) return;
    setClock({ time, duration });
  }, []);
  const anglesCallback = useCallback((next: MotionAngles) => setAngles(next), []);

  useEffect(() => {
    let dead = false;
    setPresent(null);
    setReport(null);
    setPlaying(true);
    setScrub(null);
    setLoadError(null);
    setProgress(0);
    fetch(model.src, { method: "HEAD" })
      .then((res) => { if (!dead) setPresent(res.ok); })
      .catch(() => { if (!dead) setPresent(false); });
    return () => { dead = true; };
  }, [model.src]);

  useEffect(() => {
    setScrub(null);
    setPlaying(true);
    setViewNonce((value) => value + 1);
  }, [model.key]);

  useEffect(() => {
    if (!present) return;
    const kick = () => window.dispatchEvent(new Event("resize"));
    const frame = requestAnimationFrame(kick);
    const timer = window.setTimeout(kick, 60);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [present, model.src]);

  return (
    <section className="overflow-hidden rounded-2xl border border-gym-border/80 bg-black">
      <header className="flex flex-col gap-3 border-b border-gym-border/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h3 className="font-extrabold text-white">Ejercicios del maniquí</h3>
          <p className="text-[12px] leading-snug text-gym-muted">{model.note}</p>
          <p className="text-[11px] leading-snug text-gym-muted">Los {MOTION_STUDIO_SOURCES.length} ejercicios del catálogo tienen ciclo en el maniquí. El recorrido es una demostración y no certifica la técnica.</p>
        </div>
        <label className="block text-[12px] text-gym-muted sm:shrink-0">
          Ejercicio
          <select value={model.key} onChange={(event) => setModelKey(event.target.value)} className="mt-1 block w-full rounded-xl border border-gym-border bg-gym-navy px-3 py-2.5 text-base text-white sm:ml-2 sm:mt-0 sm:inline sm:w-auto sm:py-1.5 sm:text-sm">
            {MOTION_STUDIO_SOURCES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="relative h-[min(68svh,420px)] border-b border-gym-border/70 sm:h-[480px] lg:border-b-0 lg:border-r">
          {present === null && <div className="grid h-full place-items-center text-sm text-gym-muted">Buscando el archivo…</div>}
          {present === false && <MissingFile src={model.src} />}
          {present && (
            <ModelLoadBoundary resetKey={model.src}>
              <Canvas key={model.src} resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }} camera={{ position: sceneCamera({ position: model.camera, target: model.target }).position, fov: 36 }} gl={{ antialias: true }}>
                <color attach="background" args={["#0c1018"]} />
                <ambientLight intensity={0.55} />
                <directionalLight position={[3, 5, 3]} intensity={1.5} />
                <directionalLight position={[-2, 2, -2]} intensity={0.4} />
                <Suspense fallback={null}>
                  <MotionStudioAvatar
                    src={model.src}
                    scale={model.scale}
                    y={model.y}
                    play={model.play}
                    show={model.show}
                    playing={playing}
                    playbackRate={playbackRate}
                    scrub={scrub}
                    ghost={ghost}
                    onRigReport={reportCallback}
                    onLoadError={errorCallback}
                    onProgress={progressCallback}
                    onClock={clockCallback}
                    onAngles={anglesCallback}
                  />
                </Suspense>
                <CameraBookmark shot={model.views[view]} nonce={viewNonce} />
                <Grid position={[0, 0, 0]} args={[8, 8]} cellSize={0.25} cellThickness={0.5} sectionSize={1} sectionThickness={1} fadeDistance={8} infiniteGrid />
                <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={4} blur={2.2} far={2} />
                <OrbitControls makeDefault target={model.target} minDistance={1.2} maxDistance={8} maxPolarAngle={Math.PI * 0.92} />
              </Canvas>
              {progress !== null && progress < 1 && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
                  <div className="h-full bg-gym-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
            </ModelLoadBoundary>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((item) => (
              <button key={item.id} type="button" onClick={() => { setView(item.id); setViewNonce((value) => value + 1); }} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${view === item.id ? "bg-white text-gym-navy" : "border border-gym-border text-gym-silver"}`}>{item.label}</button>
            ))}
          </div>
          <label className="block text-[11px] text-gym-muted">
            Línea de tiempo
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((scrub ?? (clock.duration > 0 ? clock.time / clock.duration : 0)) * 1000)}
              onPointerDown={() => { dragging.current = true; setPlaying(false); }}
              onPointerUp={() => { dragging.current = false; }}
              onChange={(event) => setScrub(Number(event.target.value) / 1000)}
              className="mt-1 w-full accent-gym-primary"
            />
            <span className="mt-1 block text-[11px] text-gym-silver">{formatClock(scrub === null ? clock.time : scrub * clock.duration, clock.duration)} · bajada 3 s, subida 1,5 s</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setPlaying((value) => !value); setScrub(null); }} className="rounded-full bg-gym-primary px-3 py-1 text-[11px] font-bold text-gym-navy">{playing && scrub === null ? "Pausa" : "Reproducir"}</button>
            <select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} className="rounded-lg border border-gym-border bg-gym-navy px-2 py-1 text-[11px] text-white">
              <option value={0.25}>0,25×</option>
              <option value={0.5}>0,5×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1,5×</option>
            </select>
            <button type="button" onClick={() => setGhost((value) => !value)} className={`rounded-full px-3 py-1 text-[11px] font-bold ${ghost ? "bg-white text-gym-navy" : "border border-gym-border text-gym-silver"}`}>Rastro</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Angle label="Rodilla izq" value={angles?.kneeL} />
            <Angle label="Rodilla der" value={angles?.kneeR} />
            <Angle label="Codo izq" value={angles?.elbowL} />
            <Angle label="Codo der" value={angles?.elbowR} />
          </div>
          <p className="text-[11px] leading-snug text-gym-muted">Ángulos del maniquí, en grados. Sirven para comparar el recorrido. No son una medición de un atleta ni certifican la técnica.</p>
          {present && loadError && <p className="text-sm text-rose-100">{loadError}</p>}
          {present && !loadError && <RigReportPanel report={report} />}
          {present === false && (
            <p className="text-[12px] leading-snug text-gym-muted">
              Rutas esperadas: public/models/motion-studio/fitness-man.glb y fitness-woman.glb. El .blend no va en public.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
