"use client";

import dynamic from "next/dynamic";
import GymShell from "../../components/GymShell";

const Studio = dynamic(() => import("../../components/motion/Studio"), { ssr: false });

export default function EstudioPage() {
  return (
    <GymShell active="estudio">
      <Studio />
    </GymShell>
  );
}
