import { TelemetryRecord } from "./types";

/**
 * Realistic sensor simulation engine for Arduino UNO Q demo mode.
 * Simulates physical dynamics:
 * - NEO-6M GPS walking/driving drift with altitude variations
 * - MPU6050 accelerometer with gravity Z-axis vector + hand vibration jitter
 * - MPU6050 gyroscope with dynamic angular rate noise
 * - On-die temperature sensor drift
 */

class DemoSimulator {
  private baseLat = 17.385044;
  private baseLng = 78.486671;
  private baseAlt = 542.0;
  private step = 0;
  private satCount = 8;
  private tempBase = 29.4;

  public generateReading(deviceId = "uno-q-demo"): TelemetryRecord {
    this.step += 1;

    // Simulate gentle circular wander for GPS
    const radius = 0.0008; // ~80 meters
    const angle = (this.step * 0.05) % (2 * Math.PI);
    const latNoise = (Math.random() - 0.5) * 0.00005;
    const lngNoise = (Math.random() - 0.5) * 0.00005;

    const currentLat = Number((this.baseLat + Math.sin(angle) * radius + latNoise).toFixed(6));
    const currentLng = Number((this.baseLng + Math.cos(angle) * radius + lngNoise).toFixed(6));
    const currentAlt = Number((this.baseAlt + Math.sin(this.step * 0.08) * 3.5 + (Math.random() - 0.5) * 0.4).toFixed(1));

    // Simulate IMU accelerometer (Z is ~1.0g with small noise, X/Y tilt back and forth)
    const tiltX = Math.sin(this.step * 0.15) * 0.12;
    const tiltY = Math.cos(this.step * 0.12) * 0.09;
    const accelNoiseX = (Math.random() - 0.5) * 0.04;
    const accelNoiseY = (Math.random() - 0.5) * 0.04;
    const accelNoiseZ = (Math.random() - 0.5) * 0.03;

    const accel_x_g = Number((tiltX + accelNoiseX).toFixed(3));
    const accel_y_g = Number((tiltY + accelNoiseY).toFixed(3));
    const accel_z_g = Number((0.98 + Math.cos(this.step * 0.1) * 0.03 + accelNoiseZ).toFixed(3));

    // Simulate raw gyro counts (MPU6050 raw LSB: typical +/- 131 LSB/(deg/s) on +/-250 dps range)
    const gyro_x_raw = Math.round(tiltX * 800 + (Math.random() - 0.5) * 90);
    const gyro_y_raw = Math.round(-tiltY * 750 + (Math.random() - 0.5) * 85);
    const gyro_z_raw = Math.round(Math.sin(this.step * 0.2) * 240 + (Math.random() - 0.5) * 60);

    // Temperature drift
    const temperature_c = Number((this.tempBase + Math.sin(this.step * 0.02) * 1.2 + (Math.random() - 0.5) * 0.2).toFixed(1));

    // Dynamic satellite count fluctuating between 7 and 11
    if (this.step % 20 === 0) {
      this.satCount = Math.max(6, Math.min(12, this.satCount + (Math.random() > 0.5 ? 1 : -1)));
    }

    const now = new Date().toISOString();

    return {
      device_id: deviceId,
      timestamp: now,
      server_received_at: now,
      gps: {
        latitude: currentLat,
        longitude: currentLng,
        altitude_m: currentAlt,
        satellites: this.satCount,
        fix: true,
      },
      imu: {
        accel_x_g,
        accel_y_g,
        accel_z_g,
        gyro_x_raw,
        gyro_y_raw,
        gyro_z_raw,
        temperature_c,
      },
    };
  }

  public generateNoFixReading(deviceId = "uno-q-demo"): TelemetryRecord {
    this.step += 1;
    const now = new Date().toISOString();
    return {
      device_id: deviceId,
      timestamp: now,
      server_received_at: now,
      gps: {
        latitude: null,
        longitude: null,
        altitude_m: null,
        satellites: 2,
        fix: false, // Explicitly no fix
      },
      imu: {
        accel_x_g: 0.012,
        accel_y_g: -0.015,
        accel_z_g: 0.998,
        gyro_x_raw: 14,
        gyro_y_raw: -22,
        gyro_z_raw: 8,
        temperature_c: 28.6,
      },
    };
  }
}

export const demoSimulator = new DemoSimulator();
