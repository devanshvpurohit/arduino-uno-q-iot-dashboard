# Arduino UNO Q — Firmware & Python Bridge Integration Guide

This directory contains the production-grade integration for streaming real-time GPS, 6-DoF IMU, and OLED telemetry from the **Arduino UNO Q** to the Next.js / Vercel cloud dashboard.

---

## 1. Dual-Core Architecture Overview

The Arduino UNO Q features a hybrid architecture combining a high-speed real-time microcontroller (MCU) with an onboard Linux MPU environment.

```
┌───────────────────────────────────────────────┐
│              Arduino UNO Q Hardware           │
│                                               │
│  ┌────────────────────────┐                   │
│  │  Sensors & Display     │                   │
│  │  - NEO-6M GPS (UART)   │                   │
│  │  - MPU6050 IMU (I2C)   │                   │
│  │  - SSD1306 OLED (I2C)  │                   │
│  └───────────┬────────────┘                   │
│              │ Real-time sampling             │
│              ▼                                │
│  ┌────────────────────────┐                   │
│  │  Microcontroller Core  │                   │
│  │  (C++ Sketch)          │                   │
│  └───────────┬────────────┘                   │
│              │ Bridge.notify("receiveTelemetry")
│              ▼                                │
│  ┌────────────────────────┐                   │
│  │  Onboard Linux MPU     │                   │
│  │  (Python Bridge)       │                   │
│  │  uno_q_bridge.py       │                   │
│  └───────────┬────────────┘                   │
└──────────────┼────────────────────────────────┘
               │ HTTPS POST (requests.Session)
               │ Bearer UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d
               ▼
┌───────────────────────────────────────────────┐
│   https://arduino-uno-q-iot-dashboard.vercel.app  │
│   (Server-Sent Events -> Real-Time Dashboard) │
└───────────────────────────────────────────────┘
```

---

## 2. Option 1: Arduino App Lab (Recommended for UNO Q)

In Arduino App Lab, the Python bridge runs on the Linux core, receiving data from the sketch and uploading it via HTTPS.

### Step 1: Upload the C++ Sketch
Open `arduino/arduino_uno_q_telemetry/arduino_uno_q_telemetry.ino` in the Arduino IDE and upload it to the **Arduino UNO Q**.
Leave `#define USE_UNO_Q_BRIDGE 1` enabled.

### Step 2: Run the Python Bridge
In the Arduino App Lab Linux terminal (or via App Lab runner):
```bash
python3 uno_q_bridge.py
```

#### What `uno_q_bridge.py` does:
1. Listens for `Bridge.notify("receiveTelemetry", ...)` events from the sketch.
2. Accepts both nested (`{"imu": {...}, "gps": {...}}`) and flat sensor keys.
3. Automatically attaches ISO 8601 UTC timestamps.
4. Handles GPS placeholders (`satellites: null`, `fix: false`) until a satellite lock is acquired.
5. Reuses TCP connections via `requests.Session()` with 15-second timeouts.
6. Authenticates with:
   ```python
   API_KEY = "UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d"
   URL = "https://arduino-uno-q-iot-dashboard.vercel.app/api/telemetry"
   ```

---

## 3. Hardware Pinout & Wiring Table

| Peripheral | Peripheral Pin | Arduino UNO Q Pin | Notes |
| :--- | :--- | :--- | :--- |
| **MPU6050 IMU** | VCC | 3.3V or 5V | Regulated supply |
| | GND | GND | Ground |
| | SDA | **SDA** (or A4) | Hardware I2C data |
| | SCL | **SCL** (or A5) | Hardware I2C clock (400 kHz fast mode) |
| | AD0 | GND | Sets I2C address to `0x68` |
| **SSD1306 OLED** | VCC | 3.3V or 5V | 128x64 I2C display |
| | GND | GND | Ground |
| | SDA | **SDA** | Shared hardware I2C data bus (0x3C) |
| | SCL | **SCL** | Shared hardware I2C clock bus |
| **NEO-6M GPS** | VCC | 5V | Requires active 5V for antenna LNA |
| | GND | GND | Common ground |
| | TX | **Pin 0 (RX / Serial1)** | GPS output to Arduino input |
| | RX | **Pin 1 (TX / Serial1)** | Optional |

---

## 4. Option 2: Standalone Wi-Fi Mode (Without App Lab)

If running the Arduino sketch without the Linux bridge:
1. In `arduino_uno_q_telemetry.ino`, set:
   ```cpp
   #define USE_UNO_Q_BRIDGE 0
   ```
2. Set your Wi-Fi credentials:
   ```cpp
   const char* WIFI_SSID     = "Your_SSID";
   const char* WIFI_PASSWORD = "Your_Password";
   ```
3. Upload to the board. The sketch connects directly to Wi-Fi and performs direct HTTPS POST requests.
