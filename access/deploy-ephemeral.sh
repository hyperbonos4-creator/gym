#!/usr/bin/env bash
# Despliegue de la multi-tenencia efímera del demo (N0): nuevo código backend +
# vision, actualización de .env (DEMO_* + CORS) y rebuild. NO regenera secretos.
set -euo pipefail
cd ~/access-demo
TS=$(date +%Y%m%d-%H%M%S)

echo "== 1) Backend src =="
[ -d backend/src ] && mv backend/src "backend/src.bak.$TS"
cp -r /tmp/newsrc backend/src

echo "== 2) Vision app =="
[ -d vision/app ] && mv vision/app "vision/app.bak.$TS"
cp -r /tmp/newvisionapp vision/app

echo "== 3) Public (UI, volumen read-only) =="
cp /tmp/admin.html backend/public/admin.html
cp /tmp/index.html backend/public/index.html
cp /tmp/enroll.html backend/public/enroll.html
cp /tmp/demo-banner.js backend/public/assets/demo-banner.js
# Auto-login por token (sin copiar/pegar) + mismo `ds` enroll↔kiosko.
cp /tmp/api.js    backend/public/assets/api.js
cp /tmp/kiosk.js  backend/public/assets/kiosk.js
cp /tmp/admin.js  backend/public/assets/admin.js
cp /tmp/enroll.js backend/public/assets/enroll.js
# Sitio público (visionyx.lat): demo.html pasa la sesión por #token a la app.
# Ajusta WEBROOT si tu raíz del sitio es otra.
WEBROOT=${WEBROOT:-/var/www/visionyx}
[ -f /tmp/demo.html ] && [ -d "$WEBROOT" ] && cp /tmp/demo.html "$WEBROOT/demo.html" && echo "demo.html → $WEBROOT"

echo "== 4) .env (CORS + DEMO_*), conservando secretos =="
ENV=backend/.env
# Quita líneas que vamos a redefinir.
sed -i -E '/^(CORS_ORIGIN|DEMO_MODE|DEMO_TTL_MINUTES|DEMO_MAX_ACTIVE_SESSIONS|DEMO_SWEEP_SECONDS|DEMO_EMAIL_DOMAIN)=/d' "$ENV"
cat >> "$ENV" <<'EOF'
CORS_ORIGIN=https://demo.visionyx.lat,https://visionyx.lat,https://www.visionyx.lat
DEMO_MODE=true
DEMO_TTL_MINUTES=60
DEMO_MAX_ACTIVE_SESSIONS=40
DEMO_SWEEP_SECONDS=60
DEMO_EMAIL_DOMAIN=demo.visionyx.lat
EOF
# Asegura el flag de liveness pasivo del demo (si no existe, lo añade en false).
grep -q '^LIVENESS_REQUIRE_PASSIVE=' "$ENV" || echo 'LIVENESS_REQUIRE_PASSIVE=false' >> "$ENV"

echo "== 5) Rebuild backend + restart vision =="
docker compose up -d --build backend
docker compose restart vision

echo "== 6) Estado =="
sleep 6
docker compose ps
echo "DONE"
