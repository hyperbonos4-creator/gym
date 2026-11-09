# Levanta access + proxy camara facial + bootstrap gym
# Uso: .\start_gym.ps1

$ErrorActionPreference = "Stop"
$Gym = "C:\Users\Hide\Desktop\Gym"
$Access = Join-Path $Gym "access"

Write-Host "=== 1/4 Docker access ===" -ForegroundColor Cyan
Set-Location $Access
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose fallo" }

Write-Host "`n=== 2/4 Seed admin (si hace falta) ===" -ForegroundColor Cyan
docker compose run --rm backend npm run seed 2>$null

Write-Host "`n=== 3/4 Esperando backend :3010 ===" -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 120; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3010/api/v1/auth/login" -Method POST `
            -ContentType "application/json" -Body '{"email":"x","password":"x"}' `
            -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    } catch {
        if ($_.Exception.Response.StatusCode -in 400,401,405) { $ok = $true; break }
    }
    Start-Sleep -Seconds 2
    if ($i % 10 -eq 0) { Write-Host "  ... $($i*2)s" }
}
if (-not $ok) { Write-Warning "Backend lento; prueba manual en http://localhost:3010" }

Write-Host "`n=== 4/4 Bootstrap torniquete ===" -ForegroundColor Cyan
Set-Location $Gym
python gym_bootstrap.py

Write-Host "`n=== LISTO ===" -ForegroundColor Green
Write-Host "Admin:    http://localhost:3010/kiosk/admin.html"
Write-Host "Enroll:   http://localhost:3010/kiosk/enroll.html"
Write-Host "Kiosk:    http://localhost:3010/kiosk/?source=webcam"
Write-Host ""
Write-Host "Camara facial (tras activar RTSP en Image Service):"
Write-Host "  python facial_snapshot_server.py"
Write-Host "  (en otra terminal)"
