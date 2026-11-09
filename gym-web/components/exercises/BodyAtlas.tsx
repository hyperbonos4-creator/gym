"use client";

import { ATLAS_STRUCTURES, type AtlasView } from "../../lib/anatomy";
import type { MuscleId } from "../../lib/muscles";

type Role = "idle" | "hot" | "sec" | "warm" | "dim";

function tone(role: Role, picked: boolean) {
  if (picked) return "ring-2 ring-white bg-gym-primary/45 shadow-[0_0_18px_rgba(56,189,248,0.75)]";
  if (role === "hot") return "ring-2 ring-gym-primary bg-gym-primary/35 shadow-[0_0_18px_rgba(56,189,248,0.65)]";
  if (role === "sec") return "ring-2 ring-gym-violet bg-gym-violet/30 shadow-[0_0_14px_rgba(124,58,237,0.55)]";
  if (role === "warm") return "ring-2 ring-status-warn bg-status-warn/30 animate-pulse";
  if (role === "dim") return "bg-black/25";
  return "hover:bg-gym-primary/15 hover:ring-1 hover:ring-gym-primary/50";
}

export default function BodyAtlas({
  view,
  roleOf,
  onPick,
  selectedId,
}: {
  view: AtlasView;
  roleOf: (id: MuscleId) => Role;
  onPick: (structureId: string) => void;
  selectedId?: string | null;
}) {
  const zones = ATLAS_STRUCTURES.filter((s) => s.view === view);
  return (
    <div className="relative z-10 mx-auto w-full max-w-[320px]">
      <img
        src={view === "front" ? "/atlas/front.png" : "/atlas/back.png"}
        alt={view === "front" ? "Atlas muscular frontal" : "Atlas muscular posterior"}
        className={`w-full select-none ${view === "back" ? "atlas-invert" : ""}`}
        draggable={false}
      />
      {zones.map((z, i) => (
        <button
          key={`${z.id}-${i}`}
          type="button"
          aria-label={z.name}
          title={z.name}
          onClick={() => onPick(z.id)}
          className={`absolute rounded-lg transition-all ${tone(roleOf(z.group), selectedId === z.id)}`}
          style={{ top: `${z.box.t}%`, left: `${z.box.l}%`, width: `${z.box.w}%`, height: `${z.box.h}%` }}
        />
      ))}
    </div>
  );
}
