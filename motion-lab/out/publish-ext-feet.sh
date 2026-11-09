#!/bin/bash
set -euo pipefail
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
