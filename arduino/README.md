# Arduino UNO Q — Firmware & Hardware Integration Guide

This directory contains the production-grade Arduino firmware (`arduino_uno_q_telemetry.ino`) for streaming real-time GPS, 6-DoF IMU, and OLED telemetry to the Next.js IoT Dashboard.

---

## 1. Hardware Pinout & Wiring Diagram

The Arduino UNO Q uses standard hardware I2C (`Wire`) and hardware UART (`Serial1` on pins D0/D1). Both the **MPU6050** and **SSD1306 OLED** share the primary hardware I2C bus at different 7-bit addresses (`0x68` and `0x3C` respectively).

### Complete Wiring Table

| Peripheral | Peripheral Pin | Arduino UNO Q Pin | Notes |
| :--- | :--- | :--- | :--- |
| **MPU6050 IMU** | VCC | 3.3V or 5V | Regulated supply |
| | GND | GND | Ground |
| | SDA | **SDA** (or A4) | Hardware I2C data |
| | SCL | **SCL** (or A5) | Hardware I2C clock (400 kHz fast mode) |
| | AD0 | GND | Sets I2C address to `0x68` |
| **SSD1306 OLED** | VCC | 3.3V or 5V | 128x64 I2C display |
| | GND | GND | Ground |
| | SDA | **SDA** | Shared hardware I2C data bus |
| | SCL | **SCL** | Shared hardware I2C clock bus |
| **NEO-6M GPS** | VCC | 5V | Requires active 5V for antenna LNA |
| | GND | GND | Common ground |
| | TX | **Pin 0 (RX / Serial1)** | GPS output to Arduino input |
| | RX | **Pin 1 (TX / Serial1)** | Optional (for configuration commands) |

> **Important Architecture Rule:**
> Do NOT use `SoftwareSerial` or custom bit-banged I2C implementations. The Arduino UNO Q / Zephyr core provides hardware `Serial1` and verified hardware `Wire` drivers operating at 400 kHz.

---

## 2. Required Arduino Libraries

Install these libraries via the **Arduino IDE Library Manager** (`Ctrl+Shift+I` or `Cmd+Shift+I`):

1. **TinyGPSPlus** by Mikal Hart (v1.0.3+)
2. **Adafruit SSD1306** by Adafruit (v2.5.7+)
3. **Adafruit GFX Library** by Adafruit (v1.11.5+)
4. **WiFiS3** / **WiFiClientSecure** (Bundled with the Arduino core)

---

## 3. Firmware Configuration

Open `arduino_uno_q_telemetry.ino` and configure the top variables:

```cpp
// 1. Wi-Fi Credentials
const char* WIFI_SSID       = "Your_WiFi_Network";
const char* WIFI_PASSWORD   = "Your_WiFi_Password";

// 2. Server Address
// Local testing: "192.168.1.50" with port 3000
// Vercel deployment: "your-dashboard.vercel.app" with port 443
const char* SERVER_HOST     = "your-iot-dashboard.vercel.app";
const int   SERVER_PORT     = 443;
const char* TELEMETRY_PATH  = "/api/telemetry";

// 3. Security Key
// Must match the DEVICE_API_KEY environment variable on the server
const char* DEVICE_API_KEY  = "arduino-uno-q-secret-key-2026";
```

---

## 4. Key Architectural Design Patterns

### A. Non-Blocking GPS Ingestion
GPS NMEA sentences arrive at 9600 baud continuously. If the microcontroller blocks during Wi-Fi transmissions or delays, the 64-byte hardware UART FIFO overflows, causing checksum errors and dropped fixes.
The sketch calls `feedGpsSerial()` on every iteration of `loop()`, and during network waits, guaranteeing zero lost characters.

### B. Decoupled Sensor Acquisition
Sensor registers and GPS coordinates are polled cleanly before network transmission. If network drops or Wi-Fi reconnects, sensor updates and the local SSD1306 OLED refresh continue running smoothly.

### C. Exponential Backoff on Failure
If the server returns a non-200 status or the Wi-Fi connection drops:
1. The firmware prints the error code to Serial.
2. The retry interval doubles: `1s -> 2s -> 4s -> 8s -> 16s` (capped at 16s).
3. The OLED status shows `NET ERR - BACKOFF`.
4. As soon as a transmission succeeds (`200 OK`), backoff instantly resets to 0 ms (1 Hz).

### D. Zero-Persistence Policy
No readings are written to local EEPROM or SD card. The device strictly maintains the current state in volatile microcontroller SRAM.

---

## 5. Serial Monitor Output Sample

Open Serial Monitor at **115200 baud**:

```text
==================================================
     Arduino UNO Q Real-Time IoT Telemetry Node    
==================================================
[OK] SSD1306 OLED Initialized (128x64).
[OK] MPU6050 initialized successfully at I2C 0x68.
[OK] NEO-6M GPS UART Serial1 started at 9600 baud.
[WIFI] Connecting to LabNetwork....
[WIFI] Connected!
[WIFI] IP Address: 192.168.29.187
[OK] Sensor acquisition loop active. Uplink cadence: 1 Hz.
[HTTPS POST] Status: 200 | Round-trip: 78 ms | Fix: YES | Sats: 9 | Accel Z: 1.002
[HTTPS POST] Status: 200 | Round-trip: 64 ms | Fix: YES | Sats: 9 | Accel Z: 0.998
```
