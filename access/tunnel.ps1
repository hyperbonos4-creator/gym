$ErrorActionPreference = "Continue"

# ==============================
# CONFIGURACION (solo desde entorno)
# ==============================
# Tunel inverso: publica el panel de la camara de casa en el servidor del gym.
#   Panel local 127.0.0.1:8092 -> gym 127.0.0.1:8092 -> nginx HTTPS
#
# Variables obligatorias (ver .env.example / docs/SEGURIDAD.md):
#   GYM_TUNNEL_SERVER   ej. root@TU_SERVIDOR_O_IP
#   GYM_CAMERA_HOST     ej. 192.168.1.10  (IP LAN de la camara)
# Opcionales:
#   GYM_TUNNEL_SSH_KEY  ruta a la llave privada SSH
#   GYM_CAM_PUBLIC_URL  URL HTTPS publica del panel (sslip/nginx)

$Server     = [string]$env:GYM_TUNNEL_SERVER
$CameraHost = [string]$env:GYM_CAMERA_HOST
$KeyPath    = [string]$env:GYM_TUNNEL_SSH_KEY
$PublicUrl  = [string]$env:GYM_CAM_PUBLIC_URL

$CameraPort = 80               # pagina web de la camara
$RemotePort = 18080            # puerto en el gym al que llega la camara

if ([string]::IsNullOrWhiteSpace($Server)) {
    Write-Host "[ERROR] Falta GYM_TUNNEL_SERVER (ej. root@TU_SERVIDOR)." -ForegroundColor Red
    Write-Host "Definela en el entorno o en un .env local (no versionado)." -ForegroundColor Yellow
    exit 1
}
if ([string]::IsNullOrWhiteSpace($CameraHost)) {
    Write-Host "[ERROR] Falta GYM_CAMERA_HOST (IP LAN de la camara)." -ForegroundColor Red
    Write-Host "Definela en el entorno o en un .env local (no versionado)." -ForegroundColor Yellow
    exit 1
}
if ([string]::IsNullOrWhiteSpace($KeyPath)) {
    Write-Host "[ERROR] Falta GYM_TUNNEL_SSH_KEY (ruta a la llave privada SSH)." -ForegroundColor Red
    exit 1
}

# ==============================
# VALIDACION DE LLAVE
# ==============================
if (!(Test-Path $KeyPath)) {
    Write-Host "[ERROR] No se encontro la llave SSH:" -ForegroundColor Red
    Write-Host $KeyPath -ForegroundColor Yellow
    exit 1
}

# ==============================
# HEADER
# ==============================
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "     CAMARA CASA - TUNEL" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Camara local  : $CameraHost`:$CameraPort"
Write-Host "Servidor      : $Server"
Write-Host "Puerto remoto : $RemotePort"
Write-Host ""
if ($PublicUrl) {
    Write-Host "Ver en el celular: $PublicUrl"
} else {
    Write-Host "Define GYM_CAM_PUBLIC_URL si quieres mostrar el enlace HTTPS del panel."
}
Write-Host "Manten esta ventana abierta. Ctrl+C para detener."
Write-Host ""

# ==============================
# LOOP DE RECONEXION
# ==============================
while ($true) {

    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] Conectando tunel SSH..." -ForegroundColor Cyan

    ssh -i $KeyPath -N `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 `
        -o ExitOnForwardFailure=yes `
        -o StrictHostKeyChecking=accept-new `
        -R "127.0.0.1:${RemotePort}:${CameraHost}:${CameraPort}" `
        -R "127.0.0.1:8092:127.0.0.1:8092" `
        $Server

    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host ""
    Write-Host "[$ts] Tunel caido. Reintentando en 5s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}
