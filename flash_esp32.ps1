# Flashea el firmware API al ESP32 en COM3
# IMPORTANTE: Manten presionado el boton BOOT del ESP32 mientras corre este script

$ErrorActionPreference = "Stop"
$cli = "C:\Program Files\Arduino CLI\arduino-cli.exe"
$sketch = "$PSScriptRoot\esp32_torniquete_api"
$port = "COM3"

Write-Host "=== Flash ESP32 Torniquete API ===" -ForegroundColor Cyan
Write-Host "1. Manten presionado BOOT en el ESP32"
Write-Host "2. Pulsa EN (reset) una vez"
Write-Host "3. Suelta BOOT cuando veas 'Connecting....'"
Write-Host "Manten BOOT, pulsa EN, suelta BOOT al ver Connecting...." -ForegroundColor Yellow
Write-Host ""

& $cli compile --fqbn esp32:esp32:esp32 --output-dir "$sketch\build" $sketch
if ($LASTEXITCODE -ne 0) { exit 1 }

& $cli upload -p $port --fqbn esp32:esp32:esp32 $sketch

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nFlash OK. Leyendo IP del ESP32..." -ForegroundColor Green
    python "$PSScriptRoot\discover_ip.py"
} else {
    Write-Host "`nFlash fallo. Repite manteniendo BOOT durante la subida." -ForegroundColor Red
    exit 1
}
