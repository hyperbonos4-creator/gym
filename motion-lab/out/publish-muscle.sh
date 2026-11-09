#!/bin/bash
set -eu
mv /tmp/estudio.glb /opt/Gym/gym-web/public/models/motion-studio/estudio.glb
mv /tmp/models.ts /opt/Gym/gym-web/lib/motion-studio/models.ts
mv /tmp/muscles.ts /opt/Gym/gym-web/lib/motion-studio/muscles.ts
mv /tmp/MotionStudioAvatar.tsx /opt/Gym/gym-web/components/motion-studio/MotionStudioAvatar.tsx
mv /tmp/MannequinClip.tsx /opt/Gym/gym-web/components/motion-studio/MannequinClip.tsx
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
