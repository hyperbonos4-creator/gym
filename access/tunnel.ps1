$ErrorActionPreference = "Continue"

# ==============================
# CONFIGURACION
# ==============================
# Tunel inverso: publica el panel de la camara de casa en el servidor del gym.
#   Panel local 127.0.0.1:8092 -> gym 127.0.0.1:8092 -> nginx HTTPS
#
# Ver la camara desde el celular:
#   https://cam.198-199-82-161.sslip.io/

$Server     = "root@198.199.82.161"
$KeyPath    = "C:\Users\Hide\Documents\Desktop\Flota-llaves\do-caseta-nyc1-flota"

$CameraHost = "192.168.1.39"   # IP de la camara en la red de casa
$CameraPort = 80               # pagina web de la camara
$RemotePort = 18080            # puerto en el gym al que llega la camara

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
Write-Host "Ver en el celular: https://cam.198-199-82-161.sslip.io/"
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
