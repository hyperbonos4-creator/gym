#!/bin/bash
set -eu
mv /tmp/MotionStudioAvatar.tsx /opt/Gym/gym-web/components/motion-studio/MotionStudioAvatar.tsx
mv /tmp/MannequinClip.tsx /opt/Gym/gym-web/components/motion-studio/MannequinClip.tsx
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
