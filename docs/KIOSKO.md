# Vinculación de kiosko (tablet) por código

## Qué resuelve

La tablet de la sede **no usa** el email/contraseña del administrador de access.
Se vincula una sola vez con un código de 6 dígitos generado en el panel, y queda
atada a **esa sede** y a **su puerta** (`access_point`).

## Flujo

1. En el panel: **Torniquetes → Vincular kiosko**.
2. Elige la puerta de la sede (si no hay, se crea “Entrada principal”).
3. Se muestra un código de 6 dígitos + QR. El QR apunta a la URL pública del kiosko con el código en el **fragmento** (`…/kiosk/index.html?source=webcam#code=######`), válido **10 minutos**, **un solo uso**. El fragmento no se envía al servidor ni queda en logs.
4. Al escanear el QR, la tablet abre el kiosko, canjea el código sola, guarda el token y borra `#code=` del historial. También se puede escribir el código a mano.
5. El backend guarda un dispositivo (`kiosk_devices`) y emite un JWT largo (`purpose=kiosk`)
   con `deviceId`, `gymId`, `accessPointId` y `jti`.
6. La tablet guarda el token en `localStorage` (`kiosk_device_token`).

## Permisos del token de kiosko

Solo puede:

- listar **su** punto de acceso
- reconocer / snapshot / stream-token / door-status de **ese** punto
- leer eventos filtrados a ese punto
- apertura manual de un evento de ese punto
- heartbeat de su dispositivo

No puede: admin, otras sedes, sujetos, plantillas, diagnósticos, otras puertas.

Si el panel **Revoca** la tablet, el `jti` queda invalidado y las peticiones fallan con 401.

## Endpoints (access)

| Método | Ruta | Auth |
|---|---|---|
| POST | `/api/v1/access/kiosk/pairing-codes` | Admin JWT |
| POST | `/api/v1/access/kiosk/pair` | Público (rate limit) |
| GET | `/api/v1/access/kiosk/devices?gymId=` | Admin JWT |
| DELETE | `/api/v1/access/kiosk/devices/:id` | Admin JWT |

Panel (gym-web): `GET/POST /api/kiosk` (sesión del panel + sede).

## Migración

`1794200000001-KioskPairing.ts` crea `kiosk_devices` y `kiosk_pairing_codes`.
Tras baseline de InitialSchema: `npm run migration:run` en `access/backend`.

## Variables

| Variable | Default | Notas |
|---|---|---|
| `KIOSK_DEVICE_TTL` | `365d` | TTL del JWT de tablet |
| `KIOSK_PAIRING_PEPPER` | (JWT secret) | Pepper del hash del código |
| `KIOSK_AUTO_ENABLED` | off | No reactivar el auto-login con admin salvo demo controlado |

## Legacy

- `POST /access/kiosk/session` (email+password) sigue existiendo por compatibilidad de herramientas,
  pero la UI del kiosko **ya no lo ofrece**.
- `POST /access/kiosk/auto` requiere `KIOSK_AUTO_ENABLED=true` (apagado por defecto).
- El panel server-side usa `/auth/login` para hablar con access (no el token de kiosko).


## URL pública del QR

El panel arma el QR con `resolvePublicBase()` (prioridad `ENROLL_PUBLIC_BASE`). En producción debe ser la HTTPS pública (p. ej. `https://gym.198-199-82-161.sslip.io`), nunca `localhost`.
