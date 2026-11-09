/*
 * Fuerza Élite · Torniquete 5.0
 * Sin red, clave ni token en el programa. Eso queda en la memoria del chip.
 * Si la red cambia y no entra, abre un Wi-Fi propio FE-xxxx para configurarlo.
 * GPIO25 ingreso · GPIO26 volver al medio · GPIO27 no se toca.
 * Al arrancar los pines quedan en entrada: no mueve el torniquete.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <Preferences.h>
#include "config.h"

static const char* FW = "5.0.0";
static const uint16_t BEACON_PORT = 42100;

WebServer server(80);
WiFiUDP beacon;
Preferences prefs;

String chipId;
String wifiSsid;
String wifiPass;
String deviceName;
String apiToken;
String setupPass;
int pinEntry = PIN_ENTRY_DEFAULT;
int pinReset = PIN_RESET_DEFAULT;
bool configured = false;
bool apOn = false;
bool mdnsOn = false;
unsigned long lastMs = 0;
unsigned long lastBeacon = 0;
unsigned long disconnectedSince = 0;
bool busy = false;
String serialLine;
volatile int lastDiscReason = 0;

String jsonGet(const String& src, const char* key) {
  String pat = String("\"") + key + "\":\"";
  int i = src.indexOf(pat);
  if (i < 0) return "";
  i += pat.length();
  int j = src.indexOf('"', i);
  if (j < 0) return "";
  return src.substring(i, j);
}

String chipMac() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[13];
  snprintf(buf, sizeof(buf), "%012llX", (unsigned long long)mac);
  return String(buf);
}

String apName() {
  return "FE-" + chipId.substring(chipId.length() - 4);
}

String hostName() {
  String h = "fe-" + chipId.substring(chipId.length() - 6);
  h.toLowerCase();
  return h;
}

void loadConfig() {
  prefs.begin("fe", true);
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  deviceName = prefs.getString("name", "Torniquete");
  apiToken = prefs.getString("token", "");
  setupPass = prefs.getString("setup", "");
  pinEntry = prefs.getInt("pinEntry", PIN_ENTRY_DEFAULT);
  pinReset = prefs.getInt("pinReset", PIN_RESET_DEFAULT);
  prefs.end();
  configured = wifiSsid.length() > 0;
  if (setupPass.length() < 8) {
    setupPass = chipId.substring(0, 4) + chipId.substring(8);
    prefs.begin("fe", false);
    prefs.putString("setup", setupPass);
    prefs.end();
  }
}

void saveConfig() {
  prefs.begin("fe", false);
  prefs.putString("ssid", wifiSsid);
  prefs.putString("pass", wifiPass);
  prefs.putString("name", deviceName);
  prefs.putString("token", apiToken);
  prefs.putString("setup", setupPass);
  prefs.putInt("pinEntry", pinEntry);
  prefs.putInt("pinReset", pinReset);
  prefs.end();
  configured = wifiSsid.length() > 0;
}

void allInput() {
  pinMode(pinEntry, INPUT);
  pinMode(pinReset, INPUT);
  pinMode(PIN_BUZZER, INPUT);
}

void say(const String& line) {
  Serial.println(line);
}

String readyJson() {
  String ip = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  String mode = WiFi.status() == WL_CONNECTED ? "red" : "config";
  return String("{\"evt\":\"ready\",\"id\":\"") + chipId +
         "\",\"fw\":\"" + FW +
         "\",\"name\":\"" + deviceName +
         "\",\"mode\":\"" + mode +
         "\",\"ip\":\"" + ip +
         "\",\"ap\":\"" + apName() +
         "\",\"setup\":\"" + setupPass +
         "\",\"ssid\":\"" + wifiSsid + "\"}";
}

void startAp() {
  if (apOn) return;
  WiFi.mode(WIFI_AP_STA);
  delay(100);
  WiFi.softAP(apName().c_str(), setupPass.c_str());
  apOn = true;
}

void stopAp() {
  if (!apOn) return;
  WiFi.softAPdisconnect(true);
  apOn = false;
}

void startMdns() {
  if (mdnsOn || WiFi.status() != WL_CONNECTED) return;
  if (MDNS.begin(hostName().c_str())) mdnsOn = true;
}

bool connectSta() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setHostname(hostName().c_str());
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 12000) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    stopAp();
    WiFi.mode(WIFI_STA);
    startMdns();
    disconnectedSince = 0;
    return true;
  }
  startAp();
  disconnectedSince = millis();
  return false;
}

void pulse(int pin, const char* label) {
  Serial.printf("%s GPIO%d\n", label, pin);
  allInput();
  pinMode(pin, OUTPUT);
  digitalWrite(pin, HIGH);
  delay(100);
  digitalWrite(pin, LOW);
  delay(PULSE_MS);
  digitalWrite(pin, HIGH);
  delay(PULSE_MS);
  pinMode(pin, INPUT);
  delay(200);
}

bool authorized() {
  if (apiToken.length() < 8) return false;
  if (!server.hasHeader("Authorization")) return false;
  return server.header("Authorization") == (String("Bearer ") + apiToken);
}

bool canRun() {
  return !busy && (millis() - lastMs >= COOLDOWN_MS);
}

void sendBeacon() {
  if (WiFi.status() != WL_CONNECTED) return;
  int rssi = WiFi.RSSI();
  String body = String("{\"id\":\"") + chipId +
                "\",\"name\":\"" + deviceName +
                "\",\"ip\":\"" + WiFi.localIP().toString() +
                "\",\"fw\":\"" + FW +
                "\",\"rssi\":" + String(rssi) + "}";
  beacon.beginPacket(IPAddress(255, 255, 255, 255), BEACON_PORT);
  beacon.print(body);
  beacon.endPacket();
}

void handleHealth() {
  String ip = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String mode = WiFi.status() == WL_CONNECTED ? "red" : "config";
  String body = String("{\"status\":\"ok\",\"fw\":\"") + FW +
                "\",\"id\":\"" + chipId +
                "\",\"name\":\"" + deviceName +
                "\",\"mode\":\"" + mode +
                "\",\"ip\":\"" + ip +
                "\",\"ap\":\"" + apName() +
                "\",\"rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0) + "}";
  server.send(200, "application/json", body);
}

void handleStop() {
  if (!authorized()) { server.send(401, "application/json", "{\"ok\":false}"); return; }
  allInput();
  busy = false;
  server.send(200, "application/json", "{\"ok\":true,\"action\":\"stop\"}");
}

void handleOpen() {
  if (!authorized()) { server.send(401, "application/json", "{\"ok\":false}"); return; }
  if (!canRun()) { server.send(429, "application/json", "{\"ok\":false,\"error\":\"cooldown\"}"); return; }
  server.send(200, "application/json", String("{\"ok\":true,\"action\":\"entry\",\"gpio\":") + pinEntry + "}");
  busy = true;
  lastMs = millis();
  pulse(pinEntry, "ENTRY");
  busy = false;
}

void handleClose() {
  if (!authorized()) { server.send(401, "application/json", "{\"ok\":false}"); return; }
  if (!canRun()) { server.send(429, "application/json", "{\"ok\":false,\"error\":\"cooldown\"}"); return; }
  server.send(200, "application/json", String("{\"ok\":true,\"action\":\"reset\",\"gpio\":") + pinReset + "}");
  busy = true;
  lastMs = millis();
  pulse(pinReset, "RESET");
  busy = false;
}

bool applyProvision(const String& body, bool fromSerial) {
  if (configured && !fromSerial && !authorized()) return false;
  String ssid = jsonGet(body, "ssid");
  String pass = jsonGet(body, "pass");
  String name = jsonGet(body, "name");
  String token = jsonGet(body, "token");
  if (ssid.length() < 1) return false;
  wifiSsid = ssid;
  wifiPass = pass;
  if (name.length() >= 2) deviceName = name;
  if (token.length() >= 8) apiToken = token;
  else if (apiToken.length() < 8) apiToken = String("fe") + String((uint32_t)esp_random(), HEX) + chipId.substring(0, 6);
  saveConfig();
  return true;
}

void handleProvision() {
  if (configured && !authorized()) {
    server.send(401, "application/json", "{\"ok\":false}");
    return;
  }
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"json\"}");
    return;
  }
  if (!applyProvision(server.arg("plain"), false)) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"ssid\"}");
    return;
  }
  server.send(200, "application/json", String("{\"ok\":true,\"id\":\"") + chipId + "\",\"token\":\"" + apiToken + "\"}");
  delay(300);
  ESP.restart();
}

void handlePortal() {
  String page =
    "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\">"
    "<title>Torniquete</title></head><body style=\"font-family:sans-serif;background:#070b14;color:#e8eefc;padding:24px\">"
    "<h1>" + apName() + "</h1><p>Este torniquete no tiene red. Elige la del gimnasio.</p>"
    "<form method=POST action=/guardar>"
    "<label>Nombre<br><input name=name value=\"" + deviceName + "\"></label><br><br>"
    "<label>Wi-Fi<br><input name=ssid></label><br><br>"
    "<label>Clave<br><input name=pass type=password></label><br><br>"
    "<button type=submit>Guardar y arrancar</button></form>"
    "<p>Id " + chipId + " · firmware " + FW + "</p></body></html>";
  server.send(200, "text/html", page);
}

void handleGuardar() {
  if (configured) { server.send(403, "text/plain", "ya configurado"); return; }
  String body = String("{\"ssid\":\"") + server.arg("ssid") + "\",\"pass\":\"" + server.arg("pass") + "\",\"name\":\"" + server.arg("name") + "\"}";
  if (!applyProvision(body, true)) { server.send(400, "text/plain", "falta la red"); return; }
  server.send(200, "text/html", "<body style=\"font-family:sans-serif;background:#070b14;color:#fff;padding:24px\"><p>Guardado. El torniquete se reinicia y entra a la red.</p></body>");
  delay(400);
  ESP.restart();
}

String netsJson(int limit) {
  int n = WiFi.scanNetworks();
  String body = "[";
  int shown = 0;
  for (int i = 0; i < n && shown < limit; i++) {
    String s = WiFi.SSID(i);
    if (!s.length()) continue;
    s.replace("\"", "");
    s.replace("\\", "");
    if (shown) body += ",";
    body += "{\"ssid\":\"" + s + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
    shown++;
  }
  body += "]";
  WiFi.scanDelete();
  return body;
}

void handleWifiScan() {
  if (configured && !authorized()) { server.send(401, "application/json", "{\"ok\":false}"); return; }
  server.send(200, "application/json", String("{\"ok\":true,\"nets\":") + netsJson(12) + "}");
}

void handleNotFound() {
  if (apOn && server.method() == HTTP_GET) { handlePortal(); return; }
  server.send(404, "application/json", "{\"ok\":false}");
}

void onWifiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    lastDiscReason = info.wifi_sta_disconnected.reason;
  }
}

bool claveMala(int reason) {
  return reason == 2 || reason == 14 || reason == 15 || reason == 23 || reason == 202 || reason == 204 || reason == 205;
}

void restoreRadio() {
  WiFi.disconnect(false, false);
  delay(150);
  if (!configured) {
    apOn = false;
    startAp();
  }
}

void tryWifi(const String& line) {
  String ssid = jsonGet(line, "ssid");
  String pass = jsonGet(line, "pass");
  if (ssid.length() < 1) {
    say("{\"ok\":false,\"evt\":\"try\",\"result\":\"ssid\"}");
    return;
  }
  lastDiscReason = 0;
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 14000) {
    delay(200);
    if (claveMala(lastDiscReason) || lastDiscReason == 201) break;
  }
  if (WiFi.status() == WL_CONNECTED) {
    String ip = WiFi.localIP().toString();
    int rssi = WiFi.RSSI();
    restoreRadio();
    say(String("{\"ok\":true,\"evt\":\"try\",\"result\":\"ok\",\"ip\":\"") + ip + "\",\"rssi\":" + String(rssi) + "}");
    return;
  }
  String result = claveMala(lastDiscReason) ? "clave" : (lastDiscReason == 201 ? "no_red" : "no_alcanza");
  restoreRadio();
  say(String("{\"ok\":false,\"evt\":\"try\",\"result\":\"") + result + "\"}");
}

void onSerial(const String& line) {
  String cmd = jsonGet(line, "cmd");
  if (cmd == "status") { say(readyJson()); return; }
  if (cmd == "stop") { allInput(); busy = false; say("{\"ok\":true,\"evt\":\"stop\"}"); return; }
  if (cmd == "wifi") {
    say(String("{\"ok\":true,\"evt\":\"wifi\",\"nets\":") + netsJson(15) + "}");
    return;
  }
  if (cmd == "try") { tryWifi(line); return; }
  if (cmd == "provision") {
    if (!applyProvision(line, true)) { say("{\"ok\":false,\"error\":\"ssid\"}"); return; }
    say(String("{\"ok\":true,\"evt\":\"saved\",\"id\":\"") + chipId + "\",\"token\":\"" + apiToken + "\"}");
    delay(250);
    ESP.restart();
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);
  chipId = chipMac();
  loadConfig();
  allInput();
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.onEvent(onWifiEvent);
  delay(100);
  say("{\"evt\":\"boot\",\"fw\":\"5.0.0\"}");
  const char* headers[] = {"Authorization"};
  server.collectHeaders(headers, 1);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/", HTTP_GET, handlePortal);
  server.on("/guardar", HTTP_POST, handleGuardar);
  server.on("/api/provision", HTTP_POST, handleProvision);
  server.on("/api/wifi", HTTP_GET, handleWifiScan);
  server.on("/api/stop", HTTP_POST, handleStop);
  server.on("/api/open", HTTP_POST, handleOpen);
  server.on("/api/entry", HTTP_POST, handleOpen);
  server.on("/api/close", HTTP_POST, handleClose);
  server.on("/api/reset", HTTP_POST, handleClose);
  server.onNotFound(handleNotFound);
  if (configured) connectSta();
  else startAp();
  server.begin();
  say(readyJson());
}

void loop() {
  server.handleClient();
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLine.length()) onSerial(serialLine);
      serialLine = "";
    } else if (serialLine.length() < 480) {
      serialLine += c;
    }
  }
  if (configured && WiFi.status() == WL_CONNECTED) {
    if (!mdnsOn) startMdns();
    if (apOn) stopAp();
    disconnectedSince = 0;
    if (millis() - lastBeacon > 5000) {
      lastBeacon = millis();
      sendBeacon();
    }
  } else if (configured) {
    mdnsOn = false;
    if (!disconnectedSince) disconnectedSince = millis();
    if (!apOn && millis() - disconnectedSince > 20000) startAp();
    static unsigned long lastRetry = 0;
    if (millis() - lastRetry > 30000) {
      lastRetry = millis();
      WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
    }
  }
  delay(5);
}
