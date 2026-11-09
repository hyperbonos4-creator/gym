#!/bin/bash
set -e
docker exec gym_web ls -l /app/public/models/motion-studio/estudio.glb
docker exec gym_web grep -R -l "20261013c" /app/.next /app/lib /app/public 2>/dev/null | head -n 20