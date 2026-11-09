"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { MOTION_STUDIO_SOURCES, sceneCamera, type MotionCamera } from "../../lib/motion-studio/models";
import MotionStudioAvatar from "./MotionStudioAvatar";
import { muscleCueFor, muscleName, type AnatomyMode } from "../../lib/motion-studio/muscles";

const VIEWS = [
  { id: "frente", label: "Frente" },
  { id: "perfil", label: "Perfil" },
  { id: "tres", label: "Tres cuartos" },
  { id: "atras", label: "Atrás" },
] as const;

const MODES = [
  { id: "superficie", label: "Superficie" },
  { id: "anatomia", label: "Anatomía" },
] as const;

function CameraBookmark({ shot }: { shot: MotionCamera }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } | null;
  const mark = `${shot.position.join(",")}:${shot.target.join(",")}`;
  const placed = useRef("");
  useEffect(() => {
    if (placed.current === mark) return;
    camera.up.set(0, 1, 0);
    camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    if (!controls?.target) return;
    controls.target.set(shot.target[0], shot.target[1], shot.target[2]);
    controls.update?.();
    placed.current = mark;
  }, [camera, controls, mark, shot]);
  return null;
}

/** Reproduce el ciclo del maniquí GLB. No usa las fotos del catálogo ni el muñeco de poses. */
export function MannequinClip({
  clipKey,
  compact = false,
  bare = false,
  frameClassName,
}: {
  clipKey: string;
  compact?: boolean;
  /** Solo el ciclo, sin botones. Lo usa la app del celular. */
  bare?: boolean;
  frameClassName?: string;
}) {
  const model = MOTION_STUDIO_SOURCES.find((item) => item.key === clipKey);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("frente");
  const [anatomyMode, setAnatomyMode] = useState<AnatomyMode>("superficie");
  const [picked, setPicked] = useState<string | null>(null);
  const [elbow, setElbow] = useState<number | null>(null);
  const [knee, setKnee] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [scrub, setScrub] = useState<number | null>(null);
  const [ghost, setGhost] = useState(false);
  const duration = useRef(1);
  const [progress, setProgress] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlaying(true);
    setProgress(0);
    setError(null);
    setPicked(null);
    setElbow(null);
    setKnee(null);
    setScrub(null);
    setRate(1);
    setGhost(false);
  }, [clipKey]);

  const shot = useMemo(() => {
    const fallback = { position: [0, 1.4, 3.2] as [number, number, number], target: [0, 1.0, 0] as [number, number, number] };
    if (!model) return sceneCamera(fallback);
    return sceneCamera(model.views[view]);
  }, [model, view]);

  if (!model) {
    return (
      <div className="grid h-52 place-items-center rounded-2xl border border-dashed border-gym-border px-4 text-center text-sm text-gym-muted">
        Este ejercicio no tiene ciclo 3D.
      </div>
    );
  }

  const cue = muscleCueFor(clipKey);
  const rows = cue
    ? [
        ...cue.primary.map((id) => ({ id, role: "Principal" as const })),
        ...cue.secondary.map((id) => ({ id, role: "Secundario" as const })),
      ]
    : [];
  const frame = frameClassName || (compact ? "h-52" : "h-80");
  const stepFrame = (direction: number) => {
    setPlaying(false);
    const fraction = 1 / 30 / Math.max(duration.current, 0.01);
    setScrub((current) => Math.max(0, Math.min(0.999, (current ?? 0) + direction * fraction)));
  };

  return (
    <div className={compact ? "w-full" : "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-gym-border/80 bg-[#0b0e14]"}>
      <div className={`relative min-h-0 w-full overflow-hidden bg-black ${frame}`}>
        <Canvas camera={{ position: shot.position, fov: compact ? 32 : 36 }} gl={{ antialias: true, toneMappingExposure: anatomyMode === "anatomia" ? 1.05 : 1.12 }}>
          <color attach="background" args={[anatomyMode === "anatomia" ? "#07060e" : "#e6e9ee"]} />
          <hemisphereLight args={[anatomyMode === "anatomia" ? "#8eb4d4" : "#f4f6f8", anatomyMode === "anatomia" ? "#1a1030" : "#c5ccd4", anatomyMode === "anatomia" ? 0.35 : 0.45]} />
          <ambientLight intensity={anatomyMode === "anatomia" ? 0.08 : 0.22} />
          <directionalLight position={[2.4, 5.2, 3.2]} intensity={anatomyMode === "anatomia" ? 1.6 : 1.35} color="#f4f7ff" />
          <directionalLight position={[-3.2, 2.2, 1.6]} intensity={anatomyMode === "anatomia" ? 2.2 : 0.55} color={anatomyMode === "anatomia" ? "#3ec8ff" : "#ffffff"} />
          <directionalLight position={[0.6, 1.2, -3.8]} intensity={anatomyMode === "anatomia" ? 1.4 : 0.4} color={anatomyMode === "anatomia" ? "#7a5cff" : "#d5dde6"} />
          {anatomyMode === "anatomia" && <directionalLight position={[0, 1.2, 2.8]} intensity={0.45} color="#ffd0dc" />}
          <Suspense fallback={null}>
            <MotionStudioAvatar
              src={model.src}
              scale={model.scale}
              y={model.y}
              play={model.play}
              show={model.show}
              clipKey={model.key}
              anatomyMode={anatomyMode}
              atlas
              playing={playing}
              playbackRate={rate}
              scrub={scrub}
              ghost={ghost}
              onClock={(_time, length) => {
                duration.current = length;
              }}
              onAngles={(angles) => {
                const nextElbow = angles.elbowL ?? angles.elbowR;
                const nextKnee = angles.kneeL ?? angles.kneeR;
                setElbow((current) => (current === nextElbow ? current : nextElbow));
                setKnee((current) => (current === nextKnee ? current : nextKnee));
              }}
              onMuscleSelect={setPicked}
              onLoadError={setError}
              onProgress={setProgress}
            />
          </Suspense>
          <CameraBookmark shot={shot} />
          <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={4} blur={2.2} far={2} />
          <OrbitControls makeDefault target={shot.target} minDistance={1.2} maxDistance={8} maxPolarAngle={Math.PI * 0.92} />
        </Canvas>
        {progress !== null && progress < 1 && !error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div className="h-full bg-gym-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-4 text-center text-sm text-rose-100">{error}</div>
        )}
      </div>
      {!bare && (
        <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#0c1016] px-2.5 py-2">
          {(rows.length > 0 || elbow !== null || knee !== null) && (
            <div className="flex gap-1.5 overflow-x-auto">
              {rows.map((row) => (
                <span
                  key={row.id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                    picked === row.id ? "border-white/40 text-white" : "border-white/10 text-white/75"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: row.role === "Principal" ? "#d15548" : "#c48980" }} />
                  {muscleName(row.id)}
                </span>
              ))}
              {elbow !== null && <span className="inline-flex shrink-0 items-center rounded-full bg-[#3e8fb3]/15 px-2 py-1 text-[10px] font-semibold text-[#9fd0e8]">Codo {elbow}°</span>}
              {knee !== null && <span className="inline-flex shrink-0 items-center rounded-full bg-[#3e8fb3]/15 px-2 py-1 text-[10px] font-semibold text-[#9fd0e8]">Rodilla {knee}°</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (playing && scrub === null) {
                  setPlaying(false);
                  return;
                }
                setScrub(null);
                setPlaying(true);
              }}
              className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-[#10141c]"
            >
              {playing && scrub === null ? "Pausa" : "Seguir"}
            </button>
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${view === item.id ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80"}`}
              >
                {item.label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAnatomyMode(item.id)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${anatomyMode === item.id ? "bg-[#d15548] text-white" : "text-white/45 hover:text-white/80"}`}
              >
                {item.label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/10" />
            <button
              type="button"
              onClick={() => setRate((value) => (value === 1 ? 0.35 : 1))}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${rate < 1 ? "bg-[#3e8fb3] text-white" : "text-white/45"}`}
            >
              Lenta
            </button>
            <button type="button" onClick={() => stepFrame(-1)} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-white/55">
              −1
            </button>
            <button type="button" onClick={() => stepFrame(1)} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-white/55">
              +1
            </button>
            <button
              type="button"
              onClick={() => setGhost((value) => !value)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${ghost ? "bg-[#3e8fb3] text-white" : "text-white/45"}`}
            >
              Comparar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
