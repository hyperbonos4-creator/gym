# Torniquete + Facial ID + ESP32

## Como funciona (segun tu cableado)

```
Facial ID  --[KZ OUT contacto seco]-->  ESP32 (entrada GPIO)
ESP32      --[Relay NO/COM]----------->  Placa roja torniquete (SW1 + GND)
Placa roja --[motor 12V/24V]---------->  Torniquete
```

**KZ OUT** = salida de relay del facial. Cuando reconoce una cara, cierra un contacto (como un interruptor) durante ~0.5-1 segundo. **No es un comando por USB ni por WiFi.**

Por eso `OPEN` por COM3 **no abrio** el torniquete: el firmware actual espera la senal fisica KZ OUT, no texto serial.

## Prueba 1: Con el facial (sin PC)

1. Deja el ESP32 alimentado (USB o fuente).
2. Pasa una cara registrada frente al facial.
3. Observa:
   - ¿Suena el buzzer del ESP32?
   - ¿Parpadea el LED azul?
   - ¿Hace *click* el relay azul?
   - ¿Se mueve el torniquete?

Si el relay hace click pero el torniquete no se mueve → problema entre relay y placa roja (cable gris / terminales SW1-GND).

Si no hay click → el ESP32 no recibe KZ OUT o el firmware esta colgado en WiFi.

## Prueba 2: Simular KZ OUT manualmente

En el terminal verde del ESP32 donde entra **KZ OUT** (2 hilos):

1. Con el ESP32 encendido, une momentaneamente los 2 tornillos con un destornillador o cable (~1 s).
2. Eso simula lo que hace el facial al reconocer una cara.

Si con eso abre → el facial o su cable KZ OUT es el problema.

## Prueba 3: Firmware de test (recomendado)

El firmware actual se reinicia en bucle por WiFi. Sube el sketch de prueba:

1. Instala [Arduino IDE](https://www.arduino.cc/en/software)
2. Agrega ESP32: *Archivo > Preferencias > URLs* → `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Herramientas > Placa > ESP32 Dev Module*
4. *Puerto > COM3*
5. Abre `esp32_torniquete_test/esp32_torniquete_test.ino` y sube.
6. Al arrancar, hace un pulso automatico al relay a los 3 s → **debe intentar abrir el torniquete**.

Si no abre, edita en el `.ino`:

- `RELAY_PIN` → prueba: `2`, `4`, `5`, `16`, `17`, `25`
- `INPUT_KZ` → prueba: `35`, `36`, `39`

## Placa roja del torniquete

Los terminales tipicos son:

- **SW1** + **GND** = entrada apertura (contacto seco desde relay ESP32)
- El cable gris del ESP32 deberia ir ahi

Consulta el manual de tu placa roja; muchas usan etiquetas `SW1`, `IN`, `START`, `OPEN`.

## Problema actual del firmware

Por serial se ve:

```
Conectando a WiFi............
E task_wdt: Task watchdog got triggered
Rebooting...
```

El ESP32 **no termina de arrancar** porque no conecta al WiFi y se reinicia. Eso puede impedir que procese KZ OUT.

El sketch de prueba **no usa WiFi** y evita ese problema.

---

## Control desde tu software

Para abrir el torniquete desde tu app (Python, web, etc.) usa el firmware **`esp32_torniquete_api`**.

### Paso 1: Configurar WiFi

Edita `esp32_torniquete_api/config.h`:

```cpp
#define WIFI_SSID     "TuRedWiFi"
#define WIFI_PASSWORD "TuPassword"
#define API_TOKEN     "gym-secret-token"
```

### Paso 2: Flashear el ESP32

Arduino IDE → Placa **ESP32 Dev Module** → Puerto **COM3** → Subir `esp32_torniquete_api.ino`.

En el monitor serial (115200) veras la IP, por ejemplo: `WiFi OK IP=192.168.1.100`

**Importante:** El facial y el boton no-touch siguen funcionando (entrada KZ OUT). Solo agregamos API HTTP + serial.

### Paso 3: Probar la API

```powershell
curl http://192.168.1.100/health
curl http://192.168.1.100/api/status
curl -X POST http://192.168.1.100/api/open -H "Authorization: Bearer gym-secret-token"
```

O por USB (sin WiFi):

```powershell
python C:\Users\Hide\Desktop\Gym\test_torniquete.py OPEN
```

(con el firmware API instalado, `OPEN` por serial si abre el torniquete)

### Paso 4: Usar desde Python

```python
from gym_torniquete import TurnstileClient

client = TurnstileClient(host="192.168.1.100", token="gym-secret-token")
client.open()
```

Ejemplos en `examples/demo_abrir.py` y `examples/demo_fastapi.py`.

### Endpoints HTTP

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/health` | Estado basico |
| GET | `/api/status` | WiFi, IP, uptime |
| POST | `/api/open` | Abre el torniquete (requiere token si configurado) |
