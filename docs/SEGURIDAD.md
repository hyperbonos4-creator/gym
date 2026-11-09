# Seguridad — migración y despliegue

## Variables nuevas (obligatorias en producción)

Configúralas en `.env` (raíz) y/o `gym-web` / `access/backend` según corresponda. **No uses los valores de ejemplo en producción.**

| Variable | Dónde | Notas |
|---|---|---|
| `SESSION_SECRET` | gym-web | ≥32 caracteres. Sin ella el panel no arranca en production. |
| `SESSION_TTL_HOURS` | gym-web | Opcional (default 24). |
| `COOKIE_SECURE` | gym-web | `true` fuerza Secure; `false` lo apaga. Por defecto: solo si el request es HTTPS. |
| `GYM_BOOTSTRAP_ADMIN_USER` | gym-web | Solo para crear el primer admin si no existe `data/users.json`. |
| `GYM_BOOTSTRAP_ADMIN_PASSWORD` | gym-web | ≥8 caracteres. Solo bootstrap. |
| `GYM_BOOTSTRAP_ADMIN_NAME` | gym-web | Opcional. |
| `ACCESS_ADMIN_EMAIL` | gym-web | Sin default. Credencial del backend access. |
| `ACCESS_ADMIN_PASS` | gym-web | Sin default. |
| `ALLOW_PUBLIC_REGISTRO` | gym-web | `true` para habilitar `/registro`. Default: desactivado. |
| `MOBILE_OTP_REQUIRED` | gym-web | Default `true`. Pon `false` solo en transición. |
| `ENROLL_CODE_TTL_HOURS` | gym-web | Default 24. |
| `ENROLL_TOKEN_TTL` | access | Default `15m` (JWT acotado al sujeto). |
| `FACIAL_WEBHOOK_TOKEN` | facial_webhook | Header `X-Webhook-Token` o `Authorization: Bearer`. |
| `FACIAL_WEBHOOK_ALLOW_IPS` | facial_webhook | Lista CSV de IPs del lector facial. |
| `FACIAL_WEBHOOK_HOST` | facial_webhook | Default `127.0.0.1` (no `0.0.0.0`). |
| `ESP_AGENT_KEY` | esp-agent / gym-web | Obligatoria para operar el puente (salvo `/health`). |
| `ESP_AGENT_CORS_ORIGIN` | esp-agent | Orígenes permitidos (CSV). |
| `ESP_AGENT_HOST` | esp-agent | Default loopback. |
| `DB_PASSWORD` | access compose | Ya no acepta default débil. |
| `DB_SYNCHRONIZE` | access | Default `false`. Solo `true` en desarrollo. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | access seed | Obligatorias para `npm run seed` (≥12). |
| `EVOLUTION_KEY` | evolution / gym-web | Sin default débil en producción. |

## Pasos de migración

1. Copia `.env.example` → `.env` y completa secretos nuevos.
2. Genera `SESSION_SECRET` (p. ej. 32+ bytes hex).
3. Si `gym-web/data/users.json` tiene contraseñas en texto plano, el **primer login exitoso** las rehashea a scrypt. No hace falta borrar usuarios.
4. Si no hay usuarios, define `GYM_BOOTSTRAP_ADMIN_*` una vez, arranca, luego quita esas variables.
5. Access: pon `DB_SYNCHRONIZE=false` en producción. Usa migraciones TypeORM (ver docs/MIGRACIONES.md). Si la DB ya tiene tablas por synchronize, baselinea InitialSchema antes de migration:run. No dejes synchronize activo.
6. Rotar **todas** las credenciales que alguna vez estuvieron en el README público o en `.env.example` con valores reales (panel, access, torniquete, SSH, Evolution, Wompi si filtraron).
7. Redeploy gym-web + access backend (endpoint nuevo `POST /api/v1/access/enroll-session`).
8. App móvil: actualizar a la build con OTP. Mientras tanto `MOBILE_OTP_REQUIRED=false` mantiene el login doc+tel (solo transición).
9. Configura el facial para enviar `FACIAL_WEBHOOK_TOKEN` o restringe por IP.
10. Pon `ESP_AGENT_KEY` en el agente local y en quien lo llame.

## Qué se corrigió

- Sesión del panel firmada (HMAC), HttpOnly, Secure en prod, invalidación por `sessionVersion`.
- Enrolamiento: JWT acotado al sujeto; el admin token no viaja en `#token=`.
- Seed/admin sin defaults débiles; scrypt obligatorio.
- Escrituras JSON atómicas + cola `door-outbox` para la puerta.
- Registro público off por defecto; OTP WhatsApp en app móvil.
- Webhook facial y esp-agent con auth; `job_loop` arranca.
- Cabeceras de seguridad básicas; rate limit en login.

## Credenciales a rotar (por haber estado en docs/repo público)

No se listan valores. Rota y regenera:

- Usuario/contraseña del panel web documentados como admin de demostración.
- Usuario/contraseña del motor de acceso (`admin@office.local` / clave de ejemplo).
- Token del torniquete ESP32.
- Claves Evolution / API keys de ejemplo.
- Llave SSH del droplet si la ruta o el acceso se publicaron.
- Cualquier secreto que haya vivido en `.env.example` con valor no vacío (ngrok domain, etc. según tu criterio).
- Considera hacer **privado** el repositorio GitHub `gym`.

## Arranque que falla sin secretos

En `NODE_ENV=production`:

- Sin `SESSION_SECRET` (≥32): falla al firmar/verificar sesión.
- Sin usuarios y sin `GYM_BOOTSTRAP_ADMIN_*`: falla al cargar el store de usuarios.
- Sin `ACCESS_ADMIN_EMAIL`/`ACCESS_ADMIN_PASS`: fallan llamadas al backend de acceso.
- Access seed sin `SEED_ADMIN_*`: el seed aborta.
- Compose access sin `DB_PASSWORD`: el compose no arranca.

## Tunel de camara (access/tunnel.ps1)

No dejes IPs ni rutas de llaves en el script. Configura en el entorno (o .env local no versionado):

| Variable | Obligatoria | Ejemplo placeholder |
|---|---|---|
| GYM_TUNNEL_SERVER | si | root@TU_SERVIDOR_O_IP |
| GYM_CAMERA_HOST | si | 192.168.1.10 |
| GYM_TUNNEL_SSH_KEY | si | ruta a tu llave privada |
| GYM_CAM_PUBLIC_URL | no | https://cam.ejemplo.sslip.io/ |

Si falta GYM_TUNNEL_SERVER o GYM_CAMERA_HOST, el script imprime error y sale.

## Despliegue en el servidor (droplet)

- Puertos: `gym-web` (3100) y `access` backend (3010) publican solo en `127.0.0.1` por defecto; nginx hace de proxy HTTPS. Para exponerlos en la LAN de un PC local usa `GYM_WEB_BIND=0.0.0.0` / `ACCESS_BIND=0.0.0.0` (nunca en un VPS: Docker salta UFW).
- Compose lee la interpolacion del `.env` del directorio del proyecto: crea `access/.env` con `DB_PASSWORD` (y `DB_SYNCHRONIZE=false`) y `evolution/.env` con `EVOLUTION_API_KEY` (igual a `EVOLUTION_KEY` de la raiz). Sin ellos el compose no arranca.
- `COOKIE_SECURE=true` en el `.env` raiz cuando el panel va detras de HTTPS.
- Recrear solo el servicio cambiado: `docker compose up -d --no-deps <servicio>` (raiz: `gym-web`; `access`: `backend`; `evolution`: `-p gym-wa ... evolution-api`). En la raiz no levantes `ngrok` en el servidor.
- Rotar `EVOLUTION_KEY`: cambia `EVOLUTION_KEY` (raiz) y `EVOLUTION_API_KEY` (evolution/.env), recrea `evolution-api` y luego `gym-web`. La sesion de WhatsApp se conserva (se guarda en la base de Evolution).
- Rotar `DB_PASSWORD`: `ALTER USER access WITH PASSWORD ...`, actualiza `access/backend/.env` y `access/.env`, recrea `backend`.
- Antes de cada cambio: copia de los `.env`, `pg_dump -Fc` de `access_control` y etiqueta de las imagenes actuales (`:pre-<fecha>`) para poder volver atras.
