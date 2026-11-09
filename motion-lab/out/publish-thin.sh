#!/bin/bash
set -euo pipefail
mv /tmp/estudio.glb /opt/Gym/gym-web/public/models/motion-studio/estudio.glb
mv /tmp/models.ts /opt/Gym/gym-web/lib/motion-studio/models.ts
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
