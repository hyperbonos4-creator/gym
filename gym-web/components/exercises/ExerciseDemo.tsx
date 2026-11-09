"use client";

import type { MotionClip } from "../../lib/motionModel";
import { MovementPlayer } from "./MovementPlayer";

export default function ExerciseDemo({ exerciseId, motion }: { exerciseId: string; motion?: MotionClip | null }) {
  return <MovementPlayer exerciseId={exerciseId} motion={motion} />;
}
