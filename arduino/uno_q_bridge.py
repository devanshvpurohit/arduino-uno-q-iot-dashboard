"""
Arduino UNO Q — App Lab Telemetry Bridge
=========================================
Runs on the onboard Linux environment of the Arduino UNO Q.
Listens for Bridge messages dispatched from the C++ microcontroller sketch,
formats the telemetry payload, and transmits HTTPS POST requests
to the Next.js / Vercel cloud dashboard.

Usage in Arduino App Lab:
    python3 uno_q_bridge.py
"""

import json
import time
import os
import requests
from datetime import datetime, timezone

try:
    from arduino.app_utils import App, Bridge
except ImportError:
    # Standalone mock bridge for testing off-board
    class MockBridge:
        def provide(self, name, func):
            print(f"[MockBridge] Registered provider for '{name}'")
        def notify(self, name, payload):
            print(f"[MockBridge] Notify '{name}'")

    class MockApp:
        def run(self, user_loop=None):
            print("[MockApp] Running user loop. Press Ctrl+C to stop.")
            try:
                while True:
                    if user_loop:
                        user_loop()
                    else:
                        time.sleep(1)
            except KeyboardInterrupt:
                print("[MockApp] Stopped.")

    Bridge = MockBridge()
    App = MockApp()

# Vercel Production API Endpoint
URL = os.environ.get(
    "TELEMETRY_URL",
    "https://arduino-uno-q-iot-dashboard.vercel.app/api/telemetry"
)

# Device Authentication Key (Must match DEVICE_API_KEY in Vercel environment)
API_KEY = os.environ.get(
    "DEVICE_API_KEY",
    "UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d"
)

# Default Device Identifier
DEVICE_ID = os.environ.get("DEVICE_ID", "arduino-uno-q")

# Persistent HTTP session for efficient TCP / SSL connection reuse
session = requests.Session()


def receiveTelemetry(payload):
    """
    Callback invoked whenever the Arduino C++ sketch calls:
        Bridge.notify("receiveTelemetry", jsonString)
    """
    try:
        # Parse data received from Arduino Sketch (handles JSON string or dictionary)
        raw = json.loads(payload) if isinstance(payload, str) else payload

        # Support either nested or flat IMU data
        imu = raw.get("imu", {
            "accel_x_g": float(raw.get("accel_x_g", 0.0)),
            "accel_y_g": float(raw.get("accel_y_g", 0.0)),
            "accel_z_g": float(raw.get("accel_z_g", 1.0)),
            "gyro_x_raw": int(raw.get("gyro_x_raw", 0)),
            "gyro_y_raw": int(raw.get("gyro_y_raw", 0)),
            "gyro_z_raw": int(raw.get("gyro_z_raw", 0)),
            "temperature_c": raw.get("temperature_c", None)
        })

        # Support either nested or flat GPS data (graceful placeholders until GPS lock acquired)
        gps = raw.get("gps", {
            "latitude": raw.get("latitude", None),
            "longitude": raw.get("longitude", None),
            "altitude_m": raw.get("altitude_m", None),
            "satellites": raw.get("satellites", None),
            "fix": bool(raw.get("fix", False))
        })

        data = {
            "device_id": raw.get("device_id", DEVICE_ID),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "gps": gps,
            "imu": imu
        }

        headers = {
            "Authorization": "Bearer " + API_KEY.strip(),
            "Content-Type": "application/json"
        }

        response = session.post(
            URL,
            json=data,
            headers=headers,
            timeout=15
        )

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Vercel HTTP: {response.status_code}")

        if response.status_code == 200:
            res_data = response.json() if response.text else {}
            receipt = res_data.get("server_received_at", "OK")
            print(f" -> Telemetry ingested into memory successfully. Receipt: {receipt}")
        else:
            print(" -> API response:", response.text[:500])

    except json.JSONDecodeError:
        print("ERROR: Invalid JSON received from Sketch")
    except requests.RequestException as e:
        print("Network error:", e)
    except Exception as e:
        print("Telemetry error:", e)


# Receive messages sent by Bridge.notify() in the Arduino Sketch
Bridge.provide("receiveTelemetry", receiveTelemetry)


def loop():
    time.sleep(1)


if __name__ == "__main__":
    print("=" * 60)
    print("Arduino UNO Q Telemetry Bridge to Vercel")
    print(f"Endpoint: {URL}")
    print(f"Device:   {DEVICE_ID}")
    print("=" * 60)
    App.run(user_loop=loop)
