# Gym — reconocimiento facial propio + torniquete

## Arquitectura

```
RECEPCIÓN                          ENTRADA (torniquete)
  webcam + enroll.html                 facial RTSP → snapshot proxy
         │                                      │
         └────────► access (Docker) ◄───────────┘
                    vision + Qdrant
                         │ GRANTED
                         ▼
              ESP32 192.168.100.119 /api/open (GPIO 25)
Salida: no-touch → placa roja (sin software)
```

## Fase 1 — puesta en marcha

### 1. Facial — activar cámara (panel web)

En `http://192.168.100.200/` (admin):

1. **Image Service** → habilitar RTSP / stream (puerto suele ser **8090**)
2. **Opening Conditions** → cuando uses solo `access`, desactiva relay KZ OUT
3. Anota usuario/contraseña web (default suele ser `admin` / `admin`)

### 2. Probar cámara del facial

```powershell
cd C:\Users\Hide\Desktop\Gym
python probe_facial_camera.py --http-only    # rápido
python probe_facial_camera.py                # incluye RTSP (lento si RTSP off)
```

Si RTSP funciona:

```powershell
python facial_snapshot_server.py
# http://localhost:8888/snapshot
```

### 3. Levantar access (Docker)

```powershell
cd C:\Users\Hide\Desktop\Gym\access
copy backend\.env.example backend\.env   # si no existe
copy vision\.env.example vision\.env
docker compose up -d --build
docker compose run --rm backend npm run seed
```

Espera ~2–5 min la primera vez (descarga modelos vision).

- Admin: http://localhost:3010/kiosk/admin.html
- Enrolamiento: http://localhost:3010/kiosk/enroll.html
- Kiosk ingreso (webcam prueba): http://localhost:3010/kiosk/?source=webcam

Login: `admin@office.local` / `ChangeMe123!`

### 4. Configurar torniquete + cámara

```powershell
cd C:\Users\Hide\Desktop\Gym
python gym_bootstrap.py
```

Crea punto **Torniquete Gym** → `POST http://192.168.100.119/api/open` con Bearer.

### 5. Flujo de prueba

1. **Enrolar** en recepción: `enroll.html` (webcam del PC)
2. **Ingreso:** kiosk con punto torniquete + cámara facial (snapshot proxy)
3. Si reconoce → torniquete abre (GPIO 25)

## Scripts útiles

| Script | Uso |
|--------|-----|
| `probe_facial_camera.py` | Detecta RTSP/HTTP del facial |
| `facial_snapshot_server.py` | RTSP → JPEG para access |
| `gym_bootstrap.py` | Configura access point + ESP32 |
| `torniquete_cli.py open` | Abrir torniquete manual |
| `facial_webhook.py` | Puente HTTP del facial (alternativa) |

## IPs del gym

| Equipo | IP |
|--------|-----|
| Facial | 192.168.100.200 |
| ESP32 torniquete | 192.168.100.119 |
| PC gym (ejemplo) | 192.168.100.56 |

## Recomendación operativa

- **Enrolamiento:** recepción + webcam (`enroll.html`)
- **Ingreso:** cámara del facial vía RTSP (o IP cam si RTSP falla)
- **Salida:** no-touch físico
