#!/bin/bash
set -eu
cd /opt/Gym
docker compose build gym-web
docker compose up -d --no-deps gym-web
docker compose ps gym-web
