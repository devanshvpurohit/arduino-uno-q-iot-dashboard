# Real-Time IoT Dashboard for Arduino UNO Q

A deployable, real-time web telemetry dashboard for an **Arduino UNO Q** connected to a **u-blox NEO-6M GPS**, **MPU6050 6-DoF IMU**, and **SSD1306 OLED display**.

Built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, **Recharts**, and **Server-Sent Events (SSE)**.

---

## 1. System Architecture

```mermaid
flowchart LR
    subgraph Edge ["Hardware Node (Edge)"]
        Sensors["NEO-6M GPS & MPU6050 IMU"] --> MCU["Arduino UNO Q + SSD1306 OLED"]
        MCU -->|"HTTPS POST (1 Hz)<br/>Bearer Token Auth"| Endpoint["POST /api/telemetry"]
    end

    subgraph Server ["Server Execution (In-Memory Only)"]
        Endpoint --> Store[("Volatile Memory Singleton<br/>Latest Reading Only<br/>(ZERO Database / Filesystem)")]
        Store -->|"Pub/Sub Event Dispatch"| SSE["GET /api/stream<br/>(Server-Sent Events)"]
        Store --> Poll["GET /api/telemetry<br/>(Sync Fallback)"]
    end

    subgraph Client ["Client Browser (Dashboard)"]
        SSE --> UI["Live Dashboard UI"]
        Poll -.->|"Dual-Mode Fallback"| UI
        UI --> Map["Interactive GPS Map"]
        UI --> Charts["Live IMU Recharts"]
        UI --> RAM["Browser RAM Buffer<br/>(Latest 60 Pkts - Purged on Reload)"]
    end
```

### Strict Zero-Persistence Policy
> **STRICT COMPLIANCE:** This application contains **no database**, **no Supabase**, **no Firebase**, **no MongoDB**, **no PostgreSQL**, **no Redis**, **no localStorage**, and **no file-based logging**.
> Historical sensor logs are never committed to disk. The server stores only the single latest reading in volatile RAM, and the browser maintains a transient rolling buffer (60 points) in React memory that is purged upon page reload.

---

## 2. Important Vercel Serverless Architecture & Limitations

### The Serverless Concurrency Constraint
Vercel serverless functions run on ephemeral AWS Lambda containers:
- Invocations do not guarantee persistent shared in-memory state across requests.
- An Arduino `POST /api/telemetry` hitting Instance $A$ will not modify the in-memory state of an SSE stream connected to Instance $B$.
- Serverless execution timeouts interrupt continuous long-lived HTTP streams.

### Recommended Deployment Options

| Feature | Continuous Node.js Server (Recommended) | Vercel Serverless (With Dual-Mode) |
| :--- | :--- | :--- |
| **Hosting Target** | Docker, Railway, Render, Fly.io, Self-Hosted VPS | Vercel Edge / Serverless Lambdas |
| **Command** | `npm run build && npm start` | `git push vercel main` |
| **In-Memory Concurrency**| **100% Shared Memory** in single resident process | Instance-scoped ephemeral memory |
| **Real-Time Streaming** | Native sub-millisecond SSE push to all clients | Hybrid SSE with automatic polling sync |
| **Database Required?** | **No database needed** | **No database needed** |

The dashboard UI includes a **Dual-Mode Sync Engine**: it connects via Server-Sent Events for instant streaming, and if hosted in an ephemeral serverless environment, automatically engages background HTTP polling to ensure the dashboard remains updated without requiring an external database.

---

## 3. Telemetry API Specification

### `POST /api/telemetry`
Ingests sensor readings from the Arduino UNO Q.

- **Authentication:** `Authorization: Bearer <DEVICE_API_KEY>`
- **Content-Type:** `application/json`
- **Rate Limit:** 20 requests/second per IP
- **Payload Limit:** 16 KB

#### Example Request Payload:
```json
{
  "device_id": "uno-q-01",
  "timestamp": "2026-10-27T15:00:00.000Z",
  "gps": {
    "latitude": 17.385000,
    "longitude": 78.486700,
    "altitude_m": 542.0,
    "satellites": 8,
    "fix": true
  },
  "imu": {
    "accel_x_g": 0.012,
    "accel_y_g": -0.024,
    "accel_z_g": 0.998,
    "gyro_x_raw": 120,
    "gyro_y_raw": -45,
    "gyro_z_raw": 60,
    "temperature_c": 29.5
  }
}
```

*Note on Gyroscope:* Readings are raw sensor counts (LSB) unless calibrated units are provided.

#### Response Codes:
- `200 OK`: Telemetry received and updated in server memory. Returns `server_received_at` timestamp.
- `400 Bad Request`: Invalid JSON syntax or validation failure.
- `401 Unauthorized`: Missing or invalid Bearer token.
- `413 Payload Too Large`: Payload exceeds 16 KB.
- `429 Too Many Requests`: Rate limit exceeded.

---

### `GET /api/telemetry`
Returns the single latest reading available in server memory.

#### Response:
```json
{
  "status": "success",
  "data": { ... }
}
```

---

### `GET /api/stream`
Server-Sent Events (SSE) stream pushing updates whenever new telemetry arrives.
- Headers: `Content-Type: text/event-stream`
- Dispatches `event: telemetry` on new packets.
- Dispatches `event: ping` heartbeat every 15 seconds to prevent proxy timeouts.
- Cleans up subscribers on client disconnect.

---

## 4. Hardware Wiring Diagram

| Sensor / Module | Pin | Arduino UNO Q Pin | Description |
| :--- | :--- | :--- | :--- |
| **MPU6050** | VCC | 3.3V / 5V | Regulated power |
| | GND | GND | Ground |
| | SDA | **SDA** (Pin A4) | Hardware I2C Data (0x68) |
| | SCL | **SCL** (Pin A5) | Hardware I2C Clock |
| **SSD1306 OLED**| VCC | 3.3V / 5V | Display power |
| | GND | GND | Ground |
| | SDA | **SDA** | Shared Hardware I2C Data (0x3C) |
| | SCL | **SCL** | Shared Hardware I2C Clock |
| **NEO-6M GPS** | VCC | 5V | Active antenna power |
| | GND | GND | Ground |
| | TX | **Pin 0 (RX / Serial1)** | Hardware UART RX (9600 Baud) |
| | RX | **Pin 1 (TX / Serial1)** | Optional configuration |

---

## 5. Local Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- npm or pnpm

### 1. Clone & Install Dependencies
```bash
cd arduino-uno-q-iot-dashboard
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your secret device key:
```env
DEVICE_API_KEY=arduino-uno-q-secret-key-2026
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Production Build (Continuous Node Server)
```bash
npm run build
npm start
```

---

## 6. Testing & Simulation

### A. Simulated Demo Mode (In-Browser)
Toggle the **Demo Mode** switch in the top navigation bar. The simulator generates realistic physical dynamics:
- NEO-6M GPS circular wander, satellite fluctuations, and altitude variations.
- MPU6050 1g gravity vector, tilt dynamics, and raw gyroscope noise.
- Toggle between **3D GPS Fix** and **No Fix / Searching** mode to verify error handling.

### B. Automated Integration Test Suite
With the server running on port 3000, run:
```bash
node -e '
async function test() {
  const base = "http://localhost:3000";
  // Test Unauthorized
  const resAuth = await fetch(`${base}/api/telemetry`, { method: "POST" });
  console.log("Auth Check:", resAuth.status === 401 ? "PASS (401)" : "FAIL");

  // Test Valid Ingestion
  const resPost = await fetch(`${base}/api/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer arduino-uno-q-secret-key-2026"
    },
    body: JSON.stringify({
      device_id: "uno-q-test",
      gps: { latitude: 17.385, longitude: 78.4867, altitude_m: 540, satellites: 8, fix: true },
      imu: { accel_x_g: 0.01, accel_y_g: -0.02, accel_z_g: 1.0, gyro_x_raw: 120, gyro_y_raw: -45, gyro_z_raw: 60, temperature_c: 29.5 }
    })
  });
  console.log("POST Check:", resPost.status === 200 ? "PASS (200 OK)" : "FAIL");
}
test();'
```

### C. Manual cURL Ingestion Test
```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer arduino-uno-q-secret-key-2026" \
  -d '{
    "device_id": "uno-q-01",
    "timestamp": "2026-10-27T15:00:00.000Z",
    "gps": {
      "latitude": 17.385,
      "longitude": 78.4867,
      "altitude_m": 542.0,
      "satellites": 8,
      "fix": true
    },
    "imu": {
      "accel_x_g": 0.012,
      "accel_y_g": -0.024,
      "accel_z_g": 0.998,
      "gyro_x_raw": 120,
      "gyro_y_raw": -45,
      "gyro_z_raw": 60,
      "temperature_c": 29.5
    }
  }'
```

---

## 7. Arduino Firmware Upload

1. Open `arduino/arduino_uno_q_telemetry/arduino_uno_q_telemetry.ino` in the Arduino IDE.
2. Select board **Arduino UNO Q** (or **Arduino UNO R4 WiFi**).
3. Update `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_HOST`.
4. Upload to the board.
5. Open Serial Monitor at **115200 baud** to view real-time diagnostics and HTTP status codes.
