#!/bin/bash
set -eu
mv /tmp/MotionStudioAvatar.tsx /opt/Gym/gym-web/components/motion-studio/MotionStudioAvatar.tsx
mv /tmp/MannequinClip.tsx /opt/Gym/gym-web/components/motion-studio/MannequinClip.tsx
mv /tmp/muscles.ts /opt/Gym/gym-web/lib/motion-studio/muscles.ts
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
