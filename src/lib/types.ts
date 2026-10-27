import { z } from "zod";

// GPS Telemetry Schema
export const GpsDataSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  altitude_m: z.number().nullable().optional(),
  satellites: z.number().int().min(0).max(64).nullable().optional(),
  fix: z.boolean().optional().default(false),
});

export type GpsData = z.infer<typeof GpsDataSchema>;

// IMU Telemetry Schema
export const ImuDataSchema = z.object({
  accel_x_g: z.number().default(0.0),
  accel_y_g: z.number().default(0.0),
  accel_z_g: z.number().default(1.0),
  gyro_x_raw: z.number().default(0),
  gyro_y_raw: z.number().default(0),
  gyro_z_raw: z.number().default(0),
  temperature_c: z.number().optional().nullable(),
});

export type ImuData = z.infer<typeof ImuDataSchema>;

// Ingestion Telemetry Payload Schema
export const TelemetryPayloadSchema = z.object({
  device_id: z.string().min(1, "Device ID must not be empty").max(64).default("arduino-uno-q"),
  timestamp: z.string().optional(),
  gps: GpsDataSchema.optional().default({
    latitude: null,
    longitude: null,
    altitude_m: null,
    satellites: null,
    fix: false,
  }),
  imu: ImuDataSchema,
});

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

// Full in-memory record including server receipt timestamp
export interface TelemetryRecord extends TelemetryPayload {
  server_received_at: string;
}

// Client chart buffer point (transient in browser memory only)
export interface ChartDataPoint {
  timeLabel: string;
  timestamp: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  temp?: number | null;
}

// IMU aggregate statistics
export interface AxisStats {
  current: number;
  min: number;
  max: number;
  avg: number;
}
