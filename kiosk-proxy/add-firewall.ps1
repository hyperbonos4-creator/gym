# Abre el puerto del proxy HTTPS del kiosko en el Firewall de Windows.
# Se ejecuta elevado (UAC).
$ErrorActionPreference = 'Stop'
$name = 'Gym Kiosk HTTPS 3443'
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3443 -Profile Any | Out-Null
Set-Content -Path "$PSScriptRoot\firewall_done.txt" -Value ("OK " + (Get-Date))
