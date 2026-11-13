import type { GemeloSim } from "./sim";
import { Tour } from "./tour";

export type CamPreset = "hero" | "general" | "entrada" | "pesas" | "cardio" | "funcional" | "recepcion" | "follow" | "tour" | "torniquete";

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
  /** zoom del usuario (rueda / pellizco): multiplica la distancia de cámara */
  zoom = 1;
  /** modo explorar: arrastre libre + zoom sin pantalla completa */
  explore = false;
  tour = new Tour();
  constructor(public sim: GemeloSim) {}
  startTour(compact = false, chapter: 1 | 2 = 1) {
    this.tour.start(this.sim, { compact, chapter });
    this.selected = -1;
    this.follow = -1;
    this.go("tour", 0.9);
  }
  stopTour() {
    this.tour.stop();
  }
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
