# Gym — guía del sistema

Esta guía es para quien llega sin conocer el proyecto. Explica qué es, dónde está, cómo se entra y qué hace cada parte.

El panel que usa la recepción está en internet:

**https://gym.198-199-82-161.sslip.io**

Usuario: `admin`  
Contraseña: `admin`

Esa misma dirección abre el ingreso. Si pide login, esos son los datos.

---

## Qué es

Es el sistema del gimnasio. Reemplaza el software viejo (NETGYM). Desde un solo panel se manejan los clientes, la caja, los planes y la puerta.

Hay dos mundos:

1. **La nube.** Un servidor en DigitalOcean guarda el panel, las fichas, WhatsApp y el motor que reconoce caras. Está prendido aunque el computador del gym esté apagado.
2. **El local.** El torniquete, la cámara y el lector facial están en la red del gimnasio (`192.168.100.x`). Esos aparatos no se mudaron a internet. El servidor de la nube les habla cuando el computador del gym está encendido y conectado.

El gimnasio de prueba que ya viene cargado se llama **Fuerza Élite Madera Silvestre**. Cada sede se ve por separado.

---

## Cómo entra una persona

1. En recepción se crea el cliente: documento, nombre, celular, contacto.
2. El sistema arma un enlace de enrolamiento y se lo puede mandar por WhatsApp.
3. La persona abre el enlace en el celular, sigue las indicaciones de la cara (gira, parpadea, mira al frente) y queda su rostro guardado, ligado a su ficha. No se usa foto de carnet.
4. Para pasar la puerta, la cámara lo reconoce. Si tiene rostro enrolado y la membresía está al día, el torniquete abre. Si no, no abre.

El enlace de enrolamiento sale con la dirección pública del servidor, para que el celular lo abra fuera del WiFi del gym.

---

## Direcciones

| Para qué | Dirección |
|---|---|
| Panel (recepción, caja, clientes) | https://gym.198-199-82-161.sslip.io |
| Login del panel | https://gym.198-199-82-161.sslip.io/login |
| Kiosko de la puerta (cámara del navegador) | https://gym.198-199-82-161.sslip.io/kiosk/index.html?source=webcam |
| Enrolamiento | sale desde Clientes o Enrolamiento; el socio lo abre en el celular |
| Servidor, por IP | http://198.199.82.161 no se usa. Todo entra por la dirección de arriba, con HTTPS |
| Panel de vigilancia de servidores (Flota) | https://flota.147-182-222-236.sslip.io |

En el computador del gym, si se levanta el proyecto en local, el panel también está en http://localhost:3100. Eso es una copia de trabajo. La que ve el personal por internet es la de la nube.

---

## Accesos

### Panel del gym

| Campo | Valor |
|---|---|
| Dirección | https://gym.198-199-82-161.sslip.io/login |
| Usuario | `admin` |
| Contraseña | `admin` |

Ese usuario ve todo el menú.

### Motor de la puerta (kiosko viejo)

El kiosko y el motor facial tienen otro ingreso, distinto al del panel:

| Campo | Valor |
|---|---|
| Usuario | `admin@office.local` |
| Contraseña | `ChangeMe123!` |

La recepción no necesita entrar ahí. El panel nuevo ya muestra la puerta, los clientes y el enrolamiento.

### Servidor

| Dato | Valor |
|---|---|
| Nombre | `gym` |
| Cuenta DigitalOcean | valejo9519@gmail.com |
| Número del droplet | `607482550` |
| IP | `198.199.82.161` |
| Tamaño | 1 CPU, 2 GB de memoria, disco 50 GB. Cuesta **14 dólares al mes** |
| Región | Nueva York (`nyc1`) |
| Sistema | Ubuntu 24.04 |
| Carpeta del proyecto | `/opt/Gym` |
| Usuario SSH | `root` |
| Llave SSH | `C:\Users\Hide\Desktop\Flota-llaves\do-caseta-nyc1-flota` |

Para entrar al servidor desde el computador de quien lo administra:

```powershell
ssh -i "$env:USERPROFILE\Desktop\Flota-llaves\do-caseta-nyc1-flota" root@198.199.82.161
```

El certificado HTTPS se renueva solo. Vence el 7 de enero de 2027 y Certbot lo renueva antes.

### Aparatos dentro del gym

Están en la red local. No se abren desde la calle.

| Aparato | IP | Para qué |
|---|---|---|
| Computador principal del gym | `192.168.100.56` | Ahí vivía el sistema antes de subirlo. Sigue siendo el puente con el torniquete |
| Lector facial de la entrada | `192.168.100.200` | Panel en el puerto 80. Avisa por el puerto 8787 cuando ve una cara |
| ESP32 del torniquete | `192.168.100.119` | Abre la puerta. Puerto 80 |
| Cámara Hikvision del torniquete | `192.168.100.120` | Video. Puertos 80 y 554 |
| Punto de acceso "Puerta empleados" | id `b5293962-35fb-45d6-ba2c-23ba6dee9ef9` | La puerta que el sistema ya conoce |

La clave del torniquete y la de la cámara están en `C:\Users\Hide\Desktop\Gym\.env` y en las notas viejas del local. No van en este texto porque abren el aparato físico.

---

## Qué hay dentro del servidor

Todo corre en Docker, en `/opt/Gym`. Si se reinicia la máquina, los contenedores vuelven solos.

| Contenedor | Qué es | Quién lo ve |
|---|---|---|
| `gym_web` | El panel (Next.js). Puerto interno 3100 | El navegador, a través de nginx |
| `office_backend` | Motor de fichas, consentimiento y puerta | Solo el panel, por dentro |
| `office_vision` | Reconocimiento de caras | Solo el motor, por dentro |
| `office_postgres` | Base de datos de las fichas y los accesos | Solo el motor |
| `office_qdrant` | Donde quedan guardados los rostros | Solo el motor de visión |
| `gym-evolution` | WhatsApp (el QR para vincular el número) | Solo el panel |
| `gym-evolution-db` | Base de datos de WhatsApp | Solo Evolution |
| `gym-evolution-redis` | Memoria de WhatsApp | Solo Evolution |

nginx escucha en el puerto 443 y entrega el panel. Los demás puertos no están abiertos a internet.

El código en el servidor salió de `C:\Users\Hide\Desktop\Gym`. La app del celular (`gym-mobile`) no se subió: es el proyecto Flutter, no el panel.

Datos que no se borran al reiniciar:

- Fichas y rostros: volúmenes `access_pg_data`, `access_qdrant_data`, `access_vision_models`
- Socios del panel: `/opt/Gym/gym-web/data`
- Sesión de WhatsApp: volumen `gym-wa_evolution_instances`

---

## Menú del panel

Después de entrar, el menú tiene cuatro grupos.

### Operación

| Pantalla | Dirección | Qué se hace |
|---|---|---|
| Dashboard | `/` | Resumen del día: socios, caja, accesos, si la puerta y WhatsApp responden |
| Control de acceso | `/torniquetes` | Cada puerta, si está en línea, y la prueba del torniquete |
| Enrolamiento | `/acceso` | Registro de la cara y el estado del rostro |

### Gimnasio

| Pantalla | Dirección | Qué se hace |
|---|---|---|
| Clientes | `/clientes` | Ficha completa, enlace de enrolamiento y si ya tiene rostro. `/socios` redirige aquí |
| Membresías | `/membresias` | Vigencia, renovación y si puede entrar |
| Planes | `/planes` | Precios y condiciones |
| Ejercicios | `/ejercicios` | Atlas de ejercicios |

### Finanzas

| Pantalla | Dirección | Qué se hace |
|---|---|---|
| Catálogo | `/productos` | Productos del gym y de la bodega |
| Proveedores | `/proveedores` | A quién se le compra |
| Caja | `/caja` | Cobro en mostrador |
| Egresos | `/egresos` | Gastos del día |

### Sistema

| Pantalla | Dirección | Qué se hace |
|---|---|---|
| Gimnasios | `/gimnasios` | Sedes. Solo lo ve el superadmin |
| WhatsApp | `/whatsapp` | Muestra el QR. Se escanea con el celular del gym y queda el número vinculado |

Estas pantallas existen en el menú pero todavía no operan (salen como próximas): prospectos, empresas, rutinas, valoraciones, nutrición, clases, lockers, empleados, roles, reportes y configuración.

Otras páginas sueltas:

| Dirección | Qué es |
|---|---|
| `/ingreso` | Pantalla de ingreso |
| `/invitar` | Invitación |
| `/instalar` | Ayuda para instalar |
| `/e/…` y `/x/…` | Enlaces que se le mandan a una persona |

---

## Un día normal en recepción

1. Abrir https://gym.198-199-82-161.sslip.io e ingresar con `admin` / `admin`.
2. En Dashboard mirar si la puerta y WhatsApp figuran bien.
3. Cliente nuevo: **Clientes** → crear la ficha → copiar o enviar el enlace de enrolamiento.
4. El cliente abre el enlace, hace el recorrido de la cara y vuelve a Clientes como enrolado.
5. Cobro del plan: **Membresías** o **Caja**.
6. Si la puerta no abre: **Control de acceso**. El torniquete tiene que estar prendido en el local (`192.168.100.119`) y el computador del gym encendido si el puente USB está ahí.

WhatsApp, la primera vez: **WhatsApp** → escanear el QR con el celular del número del gym. Mientras el contenedor `gym-evolution` siga vivo, no hay que escanear de nuevo.

---

## Si algo se cae

Entrar por SSH y revisar:

```bash
docker ps
```

Tiene que verse `gym_web`, `office_backend`, `office_vision`, `office_postgres`, `office_qdrant`, `gym-evolution`, `gym-evolution-db` y `gym-evolution-redis`.

Volver a levantar sin borrar datos:

```bash
cd /opt/Gym/access && docker compose up -d
cd /opt/Gym/evolution && docker compose up -d
cd /opt/Gym && docker compose up -d gym-web
```

Eso no borra socios, rostros ni la sesión de WhatsApp.

Ver el panel por dentro del servidor:

```bash
curl -I http://127.0.0.1:3100/login
```

Tiene que responder 200.

Si la página pública no abre, revisar nginx:

```bash
nginx -t && systemctl reload nginx
```

El archivo del sitio es `/etc/nginx/sites-available/gym.conf`.

---

## Computador del gym (copia local)

La carpeta de trabajo es `C:\Users\Hide\Desktop\Gym`.

Para levantarla ahí, con Docker Desktop abierto:

```powershell
cd C:\Users\Hide\Desktop\Gym
.\start.ps1
```

Eso prende el motor facial, WhatsApp, el panel en http://localhost:3100 y el puente del torniquete en el puerto 3190. No borra datos y no desconecta WhatsApp.

La copia de la nube no usa el túnel ngrok. La dirección pública es la del servidor. El ngrok (`sappy-drool-monument.ngrok-free.dev`) era solo para cuando el panel corría en el computador del gym.

---

## Qué no es este servidor

- No es la ferretería ni la cancha. Esas viven en `147.182.222.236`.
- No es Zora. Zora vive en `165.22.178.47`.
- No cobra solo la mensualidad de los clientes de Visionyx. Eso lo vigila Flota.
- Apagar este droplet apaga el panel del gym. No apaga los otros negocios.
