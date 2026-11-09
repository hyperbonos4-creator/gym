# Gym — guía del sistema

Esta guía es para quien llega sin conocer el proyecto. Explica qué es, dónde está, cómo se entra y qué hace cada parte.

> **Seguridad:** lee `docs/SEGURIDAD.md` antes de desplegar. El panel usa sesión firmada; no hay credenciales por defecto en el código.

El panel de recepción se publica en la URL que configures (`ENROLL_PUBLIC_BASE` / DNS del servidor).

---

## Qué es

Es el sistema del gimnasio. Reemplaza el software viejo (NETGYM). Desde un solo panel se manejan los clientes, la caja, los planes y la puerta.

Hay dos mundos:

1. **La nube.** Un servidor guarda el panel, las fichas, WhatsApp y el motor que reconoce caras.
2. **El local.** El torniquete, la cámara y el lector facial están en la red del gimnasio. El servidor les habla cuando el computador del gym está encendido.

---

## Cómo entra una persona

1. En recepción se crea el cliente: documento, nombre, celular, contacto.
2. El sistema arma un enlace de enrolamiento y se lo puede mandar por WhatsApp.
3. La persona abre el enlace en el celular, sigue las indicaciones de la cara y queda su rostro guardado.
4. Para pasar la puerta, la cámara lo reconoce. Si tiene rostro enrolado y la membresía está al día, el torniquete abre.

El enlace de enrolamiento usa un **token acotado al socio** (no el token de administrador).

---

## Accesos (placeholders)

### Panel del gym

| Campo | Valor |
|---|---|
| Dirección | `https://<TU_DOMINIO>/login` |
| Usuario | el que definiste en bootstrap / `users.json` |
| Contraseña | **nunca** se documenta en el repo |

### Motor de la puerta (access)

Usa `ACCESS_ADMIN_EMAIL` / `ACCESS_ADMIN_PASS` del `.env` (sin defaults en código).

### Servidor

Documenta IP, SSH y rutas **fuera** del repositorio (gestor de secretos / notas privadas). No publiques rutas de llaves SSH ni correos de la cuenta cloud en el README.

### Aparatos dentro del gym

Están en la red local. No se abren desde la calle. Las IPs y tokens viven en `.env`.

---

## Variables de entorno

Copia `.env.example` a `.env` y completa. Ver `docs/SEGURIDAD.md` para la lista completa y la migración.

Arranque típico en el PC del gym:

```powershell
.\start.cmd
```

---

## App móvil

El login pide documento + WhatsApp y luego un **OTP por WhatsApp** (`MOBILE_OTP_REQUIRED=true` por defecto).
Para una transición temporal: `MOBILE_OTP_REQUIRED=false` (solo mientras actualizas la app).

---

## Qué hay dentro del servidor

Todo corre en Docker. Si se reinicia la máquina, los contenedores vuelven solos. Detalle operativo: notas privadas del operador, no este README.
