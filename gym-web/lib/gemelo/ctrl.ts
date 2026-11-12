import type { GemeloSim } from "./sim";

export type CamPreset = "hero" | "general" | "entrada" | "pesas" | "cardio" | "funcional" | "recepcion" | "follow";

/** Puente entre la UI (DOM) y la escena 3D. Sin dependencias de three. */
export class WorldCtrl {
  preset: CamPreset = "hero";
  seq = 0;
  dur = 1.1;
  follow = -1;
  selected = -1;
  fullscreen = false;
  reduced = false;
  orbitBoost = 0;
  constructor(public sim: GemeloSim) {}
  go(preset: CamPreset, dur = 1.1) {
    this.preset = preset;
    this.dur = this.reduced ? 0 : dur;
    if (preset !== "follow") this.follow = -1;
    this.seq++;
  }
  followMember(id: number, dur = 1.0) {
    if (id < 0) return;
    this.follow = id;
    this.selected = id;
    this.preset = "follow";
    this.dur = this.reduced ? 0 : dur;
    this.seq++;
  }
}
