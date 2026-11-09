#!/bin/bash
set -eu
stat -c %s /opt/Gym/gym-web/public/models/motion-studio/estudio.glb
docker exec gym_web stat -c %s /app/public/models/motion-studio/estudio.glb
grep -l 20261014a /opt/Gym/gym-web/lib/motion-studio/models.ts
docker exec gym_web grep -l 20261014a /app/.next/static/chunks -r | head -n 5
