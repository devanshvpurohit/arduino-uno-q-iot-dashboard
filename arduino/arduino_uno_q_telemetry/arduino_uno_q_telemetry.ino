/**
 * ==============================================================================
 * Project: Real-Time IoT Telemetry for Arduino UNO Q
 * Target:   Arduino UNO Q / UNO R4 / Zephyr / Renesas Core
 * Sensors:  u-blox NEO-6M GPS (UART), MPU6050 6-DoF IMU (I2C), SSD1306 OLED (I2C)
 * Uplink:   HTTPS POST /api/telemetry (Bearer Token Authenticated)
 * Cadence:  1 Hz (1 reading per second) with Exponential Backoff on Failure
 * ==============================================================================
 * 
 * Hardware Wiring:
 * ----------------
 * 1. MPU6050 IMU (I2C Address 0x68):
 *    - VCC  -> 3.3V or 5V (board regulated)
 *    - GND  -> GND
 *    - SDA  -> UNO Q Hardware SDA pin
 *    - SCL  -> UNO Q Hardware SCL pin
 * 
 * 2. SSD1306 128x64 OLED Display (I2C Address 0x3C):
 *    - VCC  -> 3.3V or 5V
 *    - GND  -> GND
 *    - SDA  -> UNO Q Hardware SDA pin (shared I2C bus)
 *    - SCL  -> UNO Q Hardware SCL pin (shared I2C bus)
 * 
 * 3. NEO-6M GPS (UART 9600 Baud):
 *    - VCC  -> 5V (or 3.3V)
 *    - GND  -> GND
 *    - TX   -> UNO Q Serial1 RX (Pin 0 / RX)
 *    - RX   -> UNO Q Serial1 TX (Pin 1 / TX) [Optional]
 * 
 * Note on Architecture:
 * - GPS character ingestion runs continuously on every iteration of loop()
 *   to prevent hardware UART FIFO buffer overflow.
 * - Sensor acquisition is strictly decoupled from network transmission.
 * - I2C uses standard hardware Wire bus (no unsupported SoftwareI2C assumptions).
 */

#include <Wire.h>
#include <TinyGPSPlus.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// WiFi & SSL Client Selection:
// Compatible with Arduino UNO Q / UNO R4 WiFi / ESP32 Co-processor architecture
#if defined(ARDUINO_UNOR4_WIFI) || defined(ARDUINO_UNO_Q)
  #include <WiFiS3.h>
  #include <WiFiSSLClient.h>
#else
  #include <WiFi.h>
  #include <WiFiClientSecure.h>
  #define WiFiSSLClient WiFiClientSecure
#endif

// ==============================================================================
// USER CONFIGURATION (Fill with your network & server details)
// ==============================================================================
const char* WIFI_SSID       = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD   = "YOUR_WIFI_PASSWORD";

// Server endpoint configuration (Replace with your deployed domain or local IP)
// For local testing on LAN: e.g. "192.168.1.100" and port 3000 (HTTP)
// For Vercel production: e.g. "your-app.vercel.app" and port 443 (HTTPS)
const char* SERVER_HOST     = "your-iot-dashboard.vercel.app";
const int   SERVER_PORT     = 443;
const char* TELEMETRY_PATH  = "/api/telemetry";

// Device Identification and Security Key
const char* DEVICE_ID       = "uno-q-01";
const char* DEVICE_API_KEY  = "arduino-uno-q-secret-key-2026";

// Default upload interval (1000 ms = 1 Hz)
const unsigned long UPLOAD_INTERVAL_MS = 1000;

// ==============================================================================
// HARDWARE INSTANCES & PERIPHERALS
// ==============================================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_I2C_ADDR 0x3C
#define MPU_I2C_ADDR  0x68

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
TinyGPSPlus gps;
WiFiSSLClient sslClient;

// Hardware Serial for NEO-6M GPS (UNO Q / R4 uses Serial1 for D0/D1 UART)
#define GPSSerial Serial1

// Timing & Exponential Backoff Variables
unsigned long lastSendTime = 0;
unsigned long currentBackoffMs = 0;
const unsigned long MAX_BACKOFF_MS = 16000; // Cap backoff at 16 seconds

// Sensor Data Struct
struct SensorReadings {
  // GPS
  bool   gps_fix;
  double latitude;
  double longitude;
  double altitude_m;
  uint8_t satellites;

  // IMU MPU6050
  float accel_x_g;
  float accel_y_g;
  float accel_z_g;
  int16_t gyro_x_raw;
  int16_t gyro_y_raw;
  int16_t gyro_z_raw;
  float temperature_c;
};

SensorReadings currentReadings;

// ==============================================================================
// FUNCTION DECLARATIONS
// ==============================================================================
void initMPU6050();
void readMPU6050(SensorReadings &readings);
void feedGpsSerial();
void updateGpsReadings(SensorReadings &readings);
void updateOledDisplay(const SensorReadings &readings, const char* statusMsg);
bool connectWiFi();
bool sendTelemetryPayload(const SensorReadings &readings);

// ==============================================================================
// SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1500); // Allow serial monitor to open
  Serial.println(F("\n=================================================="));
  Serial.println(F("     Arduino UNO Q Real-Time IoT Telemetry Node    "));
  Serial.println(F("=================================================="));

  // Initialize Standard Hardware I2C Bus (Fast Mode 400kHz for real-time reads)
  Wire.begin();
  Wire.setClock(400000);

  // Initialize SSD1306 OLED Display
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println(F("[WARN] SSD1306 OLED not detected at 0x3C, continuing..."));
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("Arduino UNO Q"));
    display.println(F("Initializing sensors..."));
    display.display();
    Serial.println(F("[OK] SSD1306 OLED Initialized (128x64)."));
  }

  // Initialize MPU6050 IMU
  initMPU6050();

  // Initialize Hardware UART for NEO-6M GPS (9600 Baud default)
  GPSSerial.begin(9600);
  Serial.println(F("[OK] NEO-6M GPS UART Serial1 started at 9600 baud."));

  // Connect to WiFi
  connectWiFi();

  Serial.println(F("[OK] Sensor acquisition loop active. Uplink cadence: 1 Hz."));
}

// ==============================================================================
// MAIN LOOP
// ==============================================================================
void loop() {
  // 1. NON-BLOCKING GPS INGESTION: Feed characters on EVERY pass
  // This must never be blocked by network delays to prevent UART FIFO overrun
  feedGpsSerial();

  // 2. Uplink timer check (1 Hz with exponential backoff if failed)
  unsigned long now = millis();
  unsigned long effectiveInterval = UPLOAD_INTERVAL_MS + currentBackoffMs;

  if (now - lastSendTime >= effectiveInterval) {
    lastSendTime = now;

    // Separate Sensor Acquisition from Network Transmission
    updateGpsReadings(currentReadings);
    readMPU6050(currentReadings);

    // Update Local OLED Display
    updateOledDisplay(currentReadings, currentBackoffMs > 0 ? "RETRYING" : "UPLOADING");

    // Perform HTTPS POST Transmission
    bool success = sendTelemetryPayload(currentReadings);

    if (success) {
      currentBackoffMs = 0; // Reset backoff upon success
      updateOledDisplay(currentReadings, "POST 200 OK");
    } else {
      // Exponential backoff: 1s -> 2s -> 4s -> 8s -> 16s
      if (currentBackoffMs == 0) {
        currentBackoffMs = 1000;
      } else {
        currentBackoffMs = min(currentBackoffMs * 2, MAX_BACKOFF_MS);
      }
      Serial.print(F("[BACKOFF] Upload failed. Next retry in "));
      Serial.print(currentBackoffMs);
      Serial.println(F(" ms. GPS acquisition continuing uninterrupted."));
      updateOledDisplay(currentReadings, "NET ERR - BACKOFF");
    }
  }
}

// ==============================================================================
// SENSOR ACQUISITION ROUTINES
// ==============================================================================

/**
 * Feeds incoming bytes from GPS UART into TinyGPSPlus parser.
 * Non-blocking, runs on every loop iteration.
 */
void feedGpsSerial() {
  while (GPSSerial.available() > 0) {
    char c = GPSSerial.read();
    gps.encode(c);
  }
}

/**
 * Updates currentReadings with parsed GPS information.
 */
void updateGpsReadings(SensorReadings &readings) {
  readings.satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  
  if (gps.location.isValid() && gps.location.age() < 2000) {
    readings.gps_fix    = true;
    readings.latitude   = gps.location.lat();
    readings.longitude  = gps.location.lng();
    readings.altitude_m = gps.altitude.isValid() ? gps.altitude.meters() : 0.0;
  } else {
    readings.gps_fix    = false;
    readings.latitude   = 0.0;
    readings.longitude  = 0.0;
    readings.altitude_m = 0.0;
  }
}

/**
 * Initializes MPU6050 by waking it from sleep mode (Register 0x6B = 0x00).
 * Configures Accelerometer to +/- 2g and Gyroscope to +/- 250 deg/sec.
 */
void initMPU6050() {
  Wire.beginTransmission(MPU_I2C_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0x00); // Wake up device
  byte error = Wire.endTransmission();

  if (error == 0) {
    Serial.println(F("[OK] MPU6050 initialized successfully at I2C 0x68."));
  } else {
    Serial.print(F("[ERROR] MPU6050 not responding at 0x68. Wire error code: "));
    Serial.println(error);
  }
}

/**
 * Reads 14 contiguous registers from MPU6050 in a single burst:
 * 0x3B..0x40: Accel X, Y, Z (int16_t)
 * 0x41..0x42: Temperature (int16_t)
 * 0x43..0x48: Gyro X, Y, Z (int16_t)
 */
void readMPU6050(SensorReadings &readings) {
  Wire.beginTransmission(MPU_I2C_ADDR);
  Wire.write(0x3B); // Starting at ACCEL_XOUT_H
  byte err = Wire.endTransmission(false); // Repeated start

  if (err != 0) {
    // If I2C communication failed, zero out readings
    readings.accel_x_g = 0;
    readings.accel_y_g = 0;
    readings.accel_z_g = 1.0;
    readings.gyro_x_raw = 0;
    readings.gyro_y_raw = 0;
    readings.gyro_z_raw = 0;
    readings.temperature_c = 25.0;
    return;
  }

  Wire.requestFrom(MPU_I2C_ADDR, 14, true);

  if (Wire.available() >= 14) {
    int16_t raw_ax = (Wire.read() << 8) | Wire.read();
    int16_t raw_ay = (Wire.read() << 8) | Wire.read();
    int16_t raw_az = (Wire.read() << 8) | Wire.read();
    int16_t raw_temp = (Wire.read() << 8) | Wire.read();
    int16_t raw_gx = (Wire.read() << 8) | Wire.read();
    int16_t raw_gy = (Wire.read() << 8) | Wire.read();
    int16_t raw_gz = (Wire.read() << 8) | Wire.read();

    // Sensitivity scale factor for +/- 2g: 16384 LSB/g
    readings.accel_x_g = (float)raw_ax / 16384.0f;
    readings.accel_y_g = (float)raw_ay / 16384.0f;
    readings.accel_z_g = (float)raw_az / 16384.0f;

    // Raw gyro readings preserved directly as raw counts (LSB)
    readings.gyro_x_raw = raw_gx;
    readings.gyro_y_raw = raw_gy;
    readings.gyro_z_raw = raw_gz;

    // Formula from MPU-6000/MPU-6050 Register Map: Temp in deg C = (raw_temp / 340.0) + 36.53
    readings.temperature_c = ((float)raw_temp / 340.0f) + 36.53f;
  }
}

// ==============================================================================
// SSD1306 OLED VISUALIZATION
// ==============================================================================
void updateOledDisplay(const SensorReadings &readings, const char* statusMsg) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Line 1: Device Header & Uplink Status
  display.setCursor(0, 0);
  display.print(F("UNO-Q ["));
  display.print(statusMsg);
  display.println(F("]"));

  // Line 2: GPS Fix & Sats
  display.setCursor(0, 12);
  display.print(F("GPS: "));
  if (readings.gps_fix) {
    display.print(F("3D FIX ("));
    display.print(readings.satellites);
    display.println(F("s)"));
  } else {
    display.print(F("SEARCH ("));
    display.print(readings.satellites);
    display.println(F("s)"));
  }

  // Line 3: Coordinates / Altitude
  display.setCursor(0, 24);
  if (readings.gps_fix) {
    display.print(readings.latitude, 4);
    display.print(F(","));
    display.println(readings.longitude, 4);
  } else {
    display.println(F("Lat/Lng: Searching"));
  }

  // Line 4: Accelerometer
  display.setCursor(0, 36);
  display.print(F("A(g): "));
  display.print(readings.accel_x_g, 2);
  display.print(F(" "));
  display.print(readings.accel_y_g, 2);
  display.print(F(" "));
  display.println(readings.accel_z_g, 2);

  // Line 5: Gyro Raw
  display.setCursor(0, 48);
  display.print(F("G(raw): "));
  display.print(readings.gyro_x_raw);
  display.print(F(" "));
  display.print(readings.gyro_y_raw);

  display.display();
}

// ==============================================================================
// NETWORK TRANSMISSION & RETRY LOGIC
// ==============================================================================

/**
 * Connects to WiFi network if not connected.
 */
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.print(F("[WIFI] Connecting to "));
  Serial.print(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startAttempt = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
    feedGpsSerial(); // Keep feeding GPS while waiting for WiFi
    delay(250);
    Serial.print(F("."));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\n[WIFI] Connected!"));
    Serial.print(F("[WIFI] IP Address: "));
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println(F("\n[WIFI] Connection failed. Will retry on next cycle."));
    return false;
  }
}

/**
 * Constructs JSON payload and transmits HTTPS POST to /api/telemetry.
 * Returns true if server returns 200 OK.
 */
bool sendTelemetryPayload(const SensorReadings &readings) {
  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWiFi()) return false;
  }

  unsigned long requestStart = millis();

  // Attempt SSL Connection to server
  if (!sslClient.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.print(F("[HTTPS] Connection to "));
    Serial.print(SERVER_HOST);
    Serial.print(F(":"));
    Serial.print(SERVER_PORT);
    Serial.println(F(" failed."));
    return false;
  }

  // Build JSON body string
  char jsonBuffer[512];
  if (readings.gps_fix) {
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
      readings.latitude, readings.longitude, readings.altitude_m, readings.satellites,
      readings.accel_x_g, readings.accel_y_g, readings.accel_z_g,
      readings.gyro_x_raw, readings.gyro_y_raw, readings.gyro_z_raw,
      readings.temperature_c
    );
  } else {
    // When GPS fix is false, coordinates are null and fix is explicitly false
    snprintf(jsonBuffer, sizeof(jsonBuffer),
      "{"
        "\"device_id\":\"%s\","
        "\"gps\":{"
          "\"latitude\":null,"
          "\"longitude\":null,"
          "\"altitude_m\":null,"
          "\"satellites\":%d,"
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
      readings.satellites,
      readings.accel_x_g, readings.accel_y_g, readings.accel_z_g,
      readings.gyro_x_raw, readings.gyro_y_raw, readings.gyro_z_raw,
      readings.temperature_c
    );
  }

  int contentLength = strlen(jsonBuffer);

  // Send HTTP POST headers
  sslClient.print(F("POST "));
  sslClient.print(TELEMETRY_PATH);
  sslClient.println(F(" HTTP/1.1"));

  sslClient.print(F("Host: "));
  sslClient.println(SERVER_HOST);

  sslClient.println(F("User-Agent: ArduinoUNOQ/1.0"));
  sslClient.println(F("Content-Type: application/json"));
  sslClient.println(F("Connection: close"));

  // Authorization: Bearer <DEVICE_API_KEY>
  sslClient.print(F("Authorization: Bearer "));
  sslClient.println(DEVICE_API_KEY);

  sslClient.print(F("Content-Length: "));
  sslClient.println(contentLength);
  sslClient.println(); // Header separator

  // Send JSON body
  sslClient.print(jsonBuffer);

  // Read response status line with timeout
  unsigned long timeout = millis();
  int httpStatusCode = 0;
  bool statusFound = false;

  while (sslClient.connected() && millis() - timeout < 3000) {
    feedGpsSerial(); // Keep feeding GPS while awaiting network bytes
    if (sslClient.available()) {
      String line = sslClient.readStringUntil('\n');
      line.trim();

      if (!statusFound && line.startsWith("HTTP/1.")) {
        // Format: HTTP/1.1 200 OK
        int spaceIdx = line.indexOf(' ');
        if (spaceIdx > 0) {
          httpStatusCode = line.substring(spaceIdx + 1, spaceIdx + 4).toInt();
          statusFound = true;
        }
      }

      if (line.length() == 0) {
        // Headers ended
        break;
      }
    }
  }

  sslClient.stop();
  unsigned long latency = millis() - requestStart;

  // Print diagnostics to Serial Monitor
  Serial.print(F("[HTTPS POST] Status: "));
  Serial.print(httpStatusCode);
  Serial.print(F(" | Round-trip: "));
  Serial.print(latency);
  Serial.print(F(" ms | Fix: "));
  Serial.print(readings.gps_fix ? F("YES") : F("NO"));
  Serial.print(F(" | Sats: "));
  Serial.print(readings.satellites);
  Serial.print(F(" | Accel Z: "));
  Serial.println(readings.accel_z_g);

  return (httpStatusCode == 200);
}
