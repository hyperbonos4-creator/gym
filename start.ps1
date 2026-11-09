# Arranca TODO el gym con Docker: access + WhatsApp + plataforma + tunel fijo.
# Doble clic: start.cmd   |   PowerShell: .\start.ps1
#
# No borra volumenes. No desconecta WhatsApp. No toca el torniquete.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Need-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "No esta instalado: $name"
  }
}

Need-Cmd docker

Write-Host ""
Write-Host "=== Gym: un solo arranque ===" -ForegroundColor Cyan

$dockerOk = $false
for ($i = 0; $i -lt 60; $i++) {
  docker info 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
  if ($i -eq 0) { Write-Host "Esperando a Docker Desktop..." -ForegroundColor Yellow }
  Start-Sleep -Seconds 2
}
if (-not $dockerOk) { throw "Docker Desktop no responde. Abre Docker y vuelve a ejecutar start.cmd" }

Write-Host "`n[1/3] Access (facial + torniquete)..." -ForegroundColor Cyan
docker compose -p access -f (Join-Path $Root "access\docker-compose.yml") up -d
if ($LASTEXITCODE -ne 0) { throw "Fallo access" }

Write-Host "`n[2/3] WhatsApp (Evolution, misma sesion)..." -ForegroundColor Cyan
docker compose -p gym-wa -f (Join-Path $Root "evolution\docker-compose.yml") up -d
if ($LASTEXITCODE -ne 0) { throw "Fallo Evolution" }

Write-Host "`n[3/4] Plataforma + tunel fijo..." -ForegroundColor Cyan
docker compose -f (Join-Path $Root "docker-compose.yml") up -d --build
if ($LASTEXITCODE -ne 0) { throw "Fallo gym-web/ngrok. Si el puerto 3100 esta ocupado, cierra el npm run dev de gym-web." }

Write-Host "`n[4/4] Puente USB de torniquetes..." -ForegroundColor Cyan
$bridge = Get-NetTCPConnection -LocalPort 3190 -State Listen -ErrorAction SilentlyContinue
if (-not $bridge) {
  Start-Process -WindowStyle Hidden -WorkingDirectory $Root -FilePath "python" -ArgumentList "`"$(Join-Path $Root 'esp-agent\agent.py')`""
  Write-Host "  Puente en http://127.0.0.1:3190"
} else {
  Write-Host "  Puente ya estaba escuchando."
}

Write-Host ""
Write-Host "=== LISTO (queda en marcha con Docker) ===" -ForegroundColor Green
Write-Host "  Admin / plataforma:  http://localhost:3100"
Write-Host "  Publico (tablet):    https://sappy-drool-monument.ngrok-free.dev"
Write-Host "  Kiosko puerta:       https://sappy-drool-monument.ngrok-free.dev/kiosk/index.html?source=webcam"
Write-Host "  Login plataforma:    admin / admin"
Write-Host "  Login kiosko:        admin@office.local / ChangeMe123!"
Write-Host ""
Write-Host "Para parar (sin borrar datos):  docker compose -f docker-compose.yml down"
Write-Host "                                 docker compose -p access -f access\docker-compose.yml stop"
Write-Host "                                 docker compose -p gym-wa -f evolution\docker-compose.yml stop"
Write-Host ""
