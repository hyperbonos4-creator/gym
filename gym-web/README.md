# GYM · Plataforma

Aplicación única (Next.js) desde la que se controla el gimnasio: socios, WhatsApp por sede y control de acceso facial. Reemplaza el software viejo (NETGYM) y centraliza lo que antes estaba suelto (`access`, Evolution, kiosko).

- **URL local:** http://localhost:3100
- **Login de prueba:** `admin` / `admin`
- **Gimnasio de prueba:** Fuerza Élite Madera Silvestre (multi-tenant: cada gym se ve por separado)

## Qué está activo

| Módulo | Qué hace |
|---|---|
| Dashboard | KPIs reales de socios (registrados / enrolados / pendientes) |
| Control de acceso | Ficha de socio + kiosko facial + prueba de torniquete |
| Socios | Listado y ficha completa. El rostro del enrolamiento queda ligado al ID |
| WhatsApp | QR para conectar/desconectar el número del gym (Evolution) |

El resto de módulos (membresías, rutinas, caja, etc.) se ven en el menú con badge **Pronto**.

## Registro de socio (mejor que NETGYM)

Se guarda ficha, **no foto de carnet**. La captura facial ocurre en el enrolamiento y se asocia al mismo ID.

**Se pide:** documento (CC/TI/CE/PAS/NIT), nombre, fecha de nacimiento, género, celular WhatsApp, email, dirección, prospecto, empresa/convenio, contacto de respaldo, observaciones.

**Se quitó:** foto/tomar foto (redundante con el enrolamiento).

Flujo: registrar → crea identidad en el backend de acceso + consentimiento → genera link `/kiosk/enroll.html` → envía por WhatsApp → el socio enrola el rostro → en Socios aparece **Enrolado** con plantillas asociadas a su ID.

## Cómo levantar

```bash
# 1) Backend de acceso (Docker, puerto 3010) — desde /access
# 2) Evolution API (WhatsApp) — docker compose en /evolution  → 127.0.0.1:8080
# 3) Plataforma
cd gym-web
npm install
npm run dev
```

Kiosko (tablet): http://localhost:3100/kiosk/index.html  
Enrolamiento: se abre desde el link enviado por WhatsApp.

## Integraciones

- **Access** (`127.0.0.1:3010`): sujetos, consentimiento, kiosko, torniquete. Proxy `/kiosk/*` y `/api/v1/*`.
- **Evolution** (`127.0.0.1:8080`): instancia `gym`, apikey `gym-evolution-key`.
- Fichas de socios: `gym-web/data/socios.json` (etapa actual; luego BD del gym).
