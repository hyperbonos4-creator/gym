/*
 * Prueba torniquete - ESP32 + relay (placa custom con HW-394)
 *
 * Entrada:  KZ OUT del facial (contacto seco) -> GPIO 34 + GND
 * Salida:   Relay -> placa roja del torniquete (SW1/GND)
 *
 * Subir con Arduino IDE:
 *   Placa: ESP32 Dev Module
 *   Puerto: COM3
 *   Baud upload: 921600
 */

#define INPUT_KZ   34   // Entrada contacto seco (KZ OUT). Ajustar si no responde.
#define RELAY_PIN  4    // Salida relay. Probar 2, 4, 5, 16, 17, 25 si no abre.

// Muchos relays en estas placas son activos en LOW
#define RELAY_ON   LOW
#define RELAY_OFF  HIGH

const unsigned long PULSE_MS = 800;  // Pulso similar al facial (~0.5-1 s)

void pulseRelay() {
  Serial.println(">>> ACTIVANDO RELAY (abrir torniquete)");
  digitalWrite(RELAY_PIN, RELAY_ON);
  delay(PULSE_MS);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  Serial.println(">>> Relay OFF");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);

  pinMode(INPUT_KZ, INPUT_PULLUP);

  Serial.println();
  Serial.println("=== TEST TORNIQUETE ESP32 ===");
  Serial.println("Entrada KZ OUT: GPIO 34 (contacto a GND = activo)");
  Serial.println("Salida relay:   GPIO 4");
  Serial.println();
  Serial.println("Prueba automatica: pulso relay en 3 segundos...");
  delay(3000);
  pulseRelay();
  Serial.println("Si el torniquete no se movio, cambia RELAY_PIN en el codigo.");
  Serial.println("Esperando senal KZ OUT del facial...");
}

void loop() {
  static bool last = HIGH;

  bool kz = digitalRead(INPUT_KZ);

  // Contacto seco: NO cierra hacia GND -> LOW
  if (last == HIGH && kz == LOW) {
    Serial.println("Senal KZ OUT detectada!");
    pulseRelay();
    delay(300);  // debounce
  }

  last = kz;
  delay(20);
}
