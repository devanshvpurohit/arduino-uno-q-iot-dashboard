/**
 * ==============================================================================
 * Project: Real-Time IoT Telemetry for Arduino UNO Q
 * Architecture: Arduino UNO Q Hybrid (Microcontroller Core + Linux Python Bridge)
 * Sensors:  u-blox NEO-6M GPS (UART), MPU6050 6-DoF IMU (I2C), SSD1306 OLED (I2C)
 * Uplink:   Arduino App Lab Bridge -> uno_q_bridge.py -> Vercel HTTPS API
 * Cadence:  1 Hz (1 reading per second)
 * ==============================================================================
 * 
 * Hardware Wiring:
 * ----------------
 * 1. MPU6050 IMU (I2C Address 0x68):
 *    - VCC  -> 3.3V or 5V
 *    - GND  -> GND
 *    - SDA  -> UNO Q Hardware SDA pin
 *    - SCL  -> UNO Q Hardware SCL pin
 * 
 * 2. SSD1306 128x64 OLED Display (I2C Address 0x3C):
 *    - VCC  -> 3.3V or 5V
 *    - GND  -> GND
 *    - SDA  -> Shared Hardware SDA
 *    - SCL  -> Shared Hardware SCL
 * 
 * 3. NEO-6M GPS (UART 9600 Baud):
 *    - VCC  -> 5V
 *    - GND  -> GND
 *    - TX   -> UNO Q Serial1 RX (Pin 0 / RX)
 *    - RX   -> UNO Q Serial1 TX (Pin 1 / TX) [Optional]
 * 
 * Mode Selection:
 * - USE_UNO_Q_BRIDGE (Default: 1): Communicates with the onboard Linux Python
 *   script (`uno_q_bridge.py`) via `Bridge.notify("receiveTelemetry", json)`.
 * - Standalone WiFi Mode (USE_UNO_Q_BRIDGE = 0): Transmits directly via WiFiS3.
 */

// Set to 1 for Arduino UNO Q App Lab Bridge (Recommended for UNO Q)
// Set to 0 for Standalone WiFiS3 SSL transmission
#define USE_UNO_Q_BRIDGE 1

#include <Wire.h>
#include <TinyGPSPlus.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#if USE_UNO_Q_BRIDGE
  // Arduino UNO Q App Lab / Linux Bridge
  #if __has_include(<Arduino_AppUtils.h>)
    #include <Arduino_AppUtils.h>
  #elif __has_include(<Bridge.h>)
    #include <Bridge.h>
  #endif
#else
  // Standalone WiFi Fallback
  #if defined(ARDUINO_UNOR4_WIFI) || defined(ARDUINO_UNO_Q)
    #include <WiFiS3.h>
    #include <WiFiSSLClient.h>
  #else
    #include <WiFi.h>
    #include <WiFiClientSecure.h>
    #define WiFiSSLClient WiFiClientSecure
  #endif
#endif

// ==============================================================================
// CONFIGURATION
// ==============================================================================
const char* DEVICE_ID       = "arduino-uno-q";
const char* DEVICE_API_KEY  = "UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d";
const char* SERVER_HOST     = "arduino-uno-q-iot-dashboard.vercel.app";
const int   SERVER_PORT     = 443;
const char* TELEMETRY_PATH  = "/api/telemetry";

// WiFi configuration (Used only if USE_UNO_Q_BRIDGE == 0)
const char* WIFI_SSID       = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD   = "YOUR_WIFI_PASSWORD";

// Telemetry interval (1000 ms = 1 Hz)
const unsigned long UPLOAD_INTERVAL_MS = 1000;

// Hardware Definitions
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_I2C_ADDR 0x3C
#define MPU_I2C_ADDR  0x68

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
TinyGPSPlus gps;

#if !USE_UNO_Q_BRIDGE
WiFiSSLClient sslClient;
#endif

// Hardware Serial for NEO-6M GPS (UNO Q uses Serial1 for D0/D1)
#define GPSSerial Serial1

// Timing variables
unsigned long lastSendTime = 0;
bool oledAvailable = false;
bool mpuAvailable = false;

// Sensor Data Structure
struct SensorData {
  bool   gps_fix;
  bool   gps_connected;
  double latitude;
  double longitude;
  double altitude_m;
  int    satellites;

  float  accel_x_g;
  float  accel_y_g;
  float  accel_z_g;
  int16_t gyro_x_raw;
  int16_t gyro_y_raw;
  int16_t gyro_z_raw;
  float  temperature_c;
};

SensorData sensors;

// ==============================================================================
// FUNCTION DECLARATIONS
// ==============================================================================
void initMPU6050();
void readMPU6050(SensorData &data);
void feedGpsSerial();
void updateGpsData(SensorData &data);
void updateOled(const SensorData &data, const char* status);
bool dispatchTelemetry(const SensorData &data);

// ==============================================================================
// SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1200);

  Serial.println(F("\n========================================================"));
  Serial.println(F("    Arduino UNO Q — Real-Time IoT Telemetry Node        "));
  Serial.print(F("    Mode: "));
#if USE_UNO_Q_BRIDGE
  Serial.println(F("Arduino App Lab Bridge -> Python Service (uno_q_bridge.py)"));
#else
  Serial.println(F("Standalone Hardware WiFiS3 Direct HTTPS"));
#endif
  Serial.println(F("========================================================"));

  // Initialize hardware I2C at 400 kHz fast mode
  Wire.begin();
  Wire.setClock(400000);

  // Initialize SSD1306 OLED
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("Arduino UNO Q"));
    display.println(F("IoT Telemetry Node"));
    display.setCursor(0, 24);
    display.println(F("Initializing bus..."));
    display.display();
    Serial.println(F("[OK] SSD1306 OLED initialized (128x64)."));
  } else {
    Serial.println(F("[WARN] SSD1306 OLED not found at 0x3C, continuing."));
  }

  // Initialize MPU6050 IMU
  initMPU6050();

  // Initialize GPS Hardware UART (9600 baud)
  GPSSerial.begin(9600);
  Serial.println(F("[OK] NEO-6M GPS UART (Serial1) started at 9600 baud."));

#if USE_UNO_Q_BRIDGE
  // Initialize Bridge communication with onboard Linux core
  #if defined(Bridge)
    Bridge.begin();
    Serial.println(F("[OK] Arduino UNO Q IPC Bridge initialized."));
  #endif
#else
  // Standalone WiFi connection
  Serial.print(F("[WIFI] Connecting to "));
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    feedGpsSerial();
    delay(250);
    Serial.print(F("."));
  }
  Serial.println(F("\n[WIFI] Connected!"));
#endif

  Serial.println(F("[OK] Setup complete. Streaming sensor data at 1 Hz..."));
}

// ==============================================================================
// MAIN LOOP
// ==============================================================================
void loop() {
  // Non-blocking GPS feeding runs continuously on every iteration
  feedGpsSerial();

  unsigned long now = millis();
  if (now - lastSendTime >= UPLOAD_INTERVAL_MS) {
    lastSendTime = now;

    // 1. Acquire sensors
    updateGpsData(sensors);
    readMPU6050(sensors);

    // 2. Update local OLED display
    updateOled(sensors, "TRANSMITTING");

    // 3. Dispatch telemetry
    bool success = dispatchTelemetry(sensors);

    // 4. Update OLED with result
    updateOled(sensors, success ? "DISPATCHED" : "ERR");
  }
}

// ==============================================================================
// SENSORS
// ==============================================================================
void feedGpsSerial() {
  while (GPSSerial.available() > 0) {
    char c = GPSSerial.read();
    gps.encode(c);
  }
}

void updateGpsData(SensorData &data) {
  data.gps_connected = (gps.charsProcessed() > 10);
  data.satellites = gps.satellites.isValid() ? (int)gps.satellites.value() : -1;

  if (gps.location.isValid() && gps.location.age() < 2500) {
    data.gps_fix    = true;
    data.latitude   = gps.location.lat();
    data.longitude  = gps.location.lng();
    data.altitude_m = gps.altitude.isValid() ? gps.altitude.meters() : 0.0;
  } else {
    data.gps_fix    = false;
    data.latitude   = 0.0;
    data.longitude  = 0.0;
    data.altitude_m = 0.0;
  }
}

void initMPU6050() {
  Wire.beginTransmission(MPU_I2C_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0x00); // Wake up device
  byte err = Wire.endTransmission();

  if (err == 0) {
    mpuAvailable = true;
    Serial.println(F("[OK] MPU6050 initialized successfully at 0x68."));
  } else {
    mpuAvailable = false;
    Serial.print(F("[WARN] MPU6050 not detected at 0x68 (Error: "));
    Serial.print(err);
    Serial.println(F("). Using fallback IMU values."));
  }
}

void readMPU6050(SensorData &data) {
  if (!mpuAvailable) {
    data.accel_x_g = 0.0;
    data.accel_y_g = 0.0;
    data.accel_z_g = 1.0;
    data.gyro_x_raw = 0;
    data.gyro_y_raw = 0;
    data.gyro_z_raw = 0;
    data.temperature_c = 28.5;
    return;
  }

  Wire.beginTransmission(MPU_I2C_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return;

  Wire.requestFrom(MPU_I2C_ADDR, 14, true);
  if (Wire.available() >= 14) {
    int16_t ax = (Wire.read() << 8) | Wire.read();
    int16_t ay = (Wire.read() << 8) | Wire.read();
    int16_t az = (Wire.read() << 8) | Wire.read();
    int16_t t  = (Wire.read() << 8) | Wire.read();
    int16_t gx = (Wire.read() << 8) | Wire.read();
    int16_t gy = (Wire.read() << 8) | Wire.read();
    int16_t gz = (Wire.read() << 8) | Wire.read();

    data.accel_x_g = (float)ax / 16384.0f;
    data.accel_y_g = (float)ay / 16384.0f;
    data.accel_z_g = (float)az / 16384.0f;
    data.gyro_x_raw = gx;
    data.gyro_y_raw = gy;
    data.gyro_z_raw = gz;
    data.temperature_c = ((float)t / 340.0f) + 36.53f;
  }
}

// ==============================================================================
// OLED DISPLAY
// ==============================================================================
void updateOled(const SensorData &data, const char* status) {
  if (!oledAvailable) return;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Line 1: Header + Status
  display.setCursor(0, 0);
  display.print(F("UNO-Q ["));
  display.print(status);
  display.println(F("]"));

  // Line 2: GPS
  display.setCursor(0, 13);
  if (data.gps_fix) {
    display.print(F("GPS 3D FIX: "));
    display.print(data.satellites);
    display.println(F(" sats"));
  } else if (data.satellites >= 0) {
    display.print(F("GPS SEARCH: "));
    display.print(data.satellites);
    display.println(F(" sats"));
  } else {
    display.println(F("GPS: No Lock"));
  }

  // Line 3: Accel X, Y, Z
  display.setCursor(0, 26);
  display.print(F("A: "));
  display.print(data.accel_x_g, 2);
  display.print(F(" "));
  display.print(data.accel_y_g, 2);
  display.print(F(" "));
  display.println(data.accel_z_g, 2);

  // Line 4: Gyro Raw
  display.setCursor(0, 39);
  display.print(F("G: "));
  display.print(data.gyro_x_raw);
  display.print(F(" "));
  display.print(data.gyro_y_raw);
  display.print(F(" "));
  display.println(data.gyro_z_raw);

  // Line 5: Temperature
  display.setCursor(0, 52);
  display.print(F("Temp: "));
  display.print(data.temperature_c, 1);
  display.println(F(" C"));

  display.display();
}

// ==============================================================================
// TELEMETRY TRANSMISSION (App Lab Bridge or Standalone WiFi)
// ==============================================================================
bool dispatchTelemetry(const SensorData &data) {
  char jsonBuffer[384];

  // Construct JSON payload
  if (data.gps_fix) {
    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{"
        "\"device_id\":\"%s\","
        "\"gps\":{"
          "\"latitude\":%.6f,"
          "\"longitude\":%.6f,"
          "\"altitude_m\":%.1f,"
          "\"satellites\":%d,"
          "\"fix\":true"
        "},"
        "\"imu\":{"
          "\"accel_x_g\":%.3f,"
          "\"accel_y_g\":%.3f,"
          "\"accel_z_g\":%.3f,"
          "\"gyro_x_raw\":%d,"
          "\"gyro_y_raw\":%d,"
          "\"gyro_z_raw\":%d,"
          "\"temperature_c\":%.1f"
        "}"
      "}",
      DEVICE_ID,
      data.latitude, data.longitude, data.altitude_m, data.satellites,
      data.accel_x_g, data.accel_y_g, data.accel_z_g,
      data.gyro_x_raw, data.gyro_y_raw, data.gyro_z_raw,
      data.temperature_c
    );
  } else {
    // When no fix is acquired or GPS receiver is unattached
    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{"
        "\"device_id\":\"%s\","
        "\"gps\":{"
          "\"latitude\":null,"
          "\"longitude\":null,"
          "\"altitude_m\":null,"
          "\"satellites\":%s,"
          "\"fix\":false"
        "},"
        "\"imu\":{"
          "\"accel_x_g\":%.3f,"
          "\"accel_y_g\":%.3f,"
          "\"accel_z_g\":%.3f,"
          "\"gyro_x_raw\":%d,"
          "\"gyro_y_raw\":%d,"
          "\"gyro_z_raw\":%d,"
          "\"temperature_c\":%.1f"
        "}"
      "}",
      DEVICE_ID,
      (data.satellites >= 0 ? String(data.satellites).c_str() : "null"),
      data.accel_x_g, data.accel_y_g, data.accel_z_g,
      data.gyro_x_raw, data.gyro_y_raw, data.gyro_z_raw,
      data.temperature_c
    );
  }

#if USE_UNO_Q_BRIDGE
  // Arduino UNO Q App Lab Bridge: Notify Python service
  #if defined(Bridge)
    Bridge.notify("receiveTelemetry", jsonBuffer);
  #endif
  Serial.print(F("[BRIDGE NOTIFY] Payload: "));
  Serial.println(jsonBuffer);
  return true;

#else
  // Standalone WiFi Direct HTTPS POST
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    return false;
  }

  if (!sslClient.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println(F("[HTTPS] Connection failed."));
    return false;
  }

  int len = strlen(jsonBuffer);
  sslClient.print(F("POST "));
  sslClient.print(TELEMETRY_PATH);
  sslClient.println(F(" HTTP/1.1"));
  sslClient.print(F("Host: "));
  sslClient.println(SERVER_HOST);
  sslClient.println(F("Content-Type: application/json"));
  sslClient.println(F("Connection: close"));
  sslClient.print(F("Authorization: Bearer "));
  sslClient.println(DEVICE_API_KEY);
  sslClient.print(F("Content-Length: "));
  sslClient.println(len);
  sslClient.println();
  sslClient.print(jsonBuffer);

  Serial.println(F("[HTTPS POST] Sent."));
  sslClient.stop();
  return true;
#endif
}
