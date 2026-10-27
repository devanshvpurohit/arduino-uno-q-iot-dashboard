"use client";

import React, { useState, useMemo } from "react";
import { ImuData, ChartDataPoint, AxisStats } from "@/lib/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Gauge,
  Activity,
  Thermometer,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";

interface ImuPanelProps {
  imu: ImuData | null | undefined;
  chartHistory: ChartDataPoint[];
}

export const ImuPanel: React.FC<ImuPanelProps> = ({ imu, chartHistory }) => {
  const [activeTab, setActiveTab] = useState<"accel" | "gyro">("accel");

  // Compute aggregate statistics over the browser's temporary chart history buffer
  const stats = useMemo(() => {
    const calc = (key: keyof ChartDataPoint): AxisStats => {
      if (chartHistory.length === 0) {
        return { current: 0, min: 0, max: 0, avg: 0 };
      }
      const values = chartHistory.map((d) => Number(d[key]) || 0);
      const current = values[values.length - 1];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = sum / values.length;
      return { current, min, max, avg };
    };

    return {
      accelX: calc("accel_x"),
      accelY: calc("accel_y"),
      accelZ: calc("accel_z"),
      gyroX: calc("gyro_x"),
      gyroY: calc("gyro_y"),
      gyroZ: calc("gyro_z"),
    };
  }, [chartHistory]);

  // Compute total acceleration magnitude: |a| = sqrt(x^2 + y^2 + z^2)
  const accelMag = useMemo(() => {
    if (!imu) return 0;
    const { accel_x_g, accel_y_g, accel_z_g } = imu;
    return Math.sqrt(
      accel_x_g * accel_x_g + accel_y_g * accel_y_g + accel_z_g * accel_z_g
    );
  }, [imu]);

  const tempC = imu?.temperature_c;
  const tempF = tempC != null ? (tempC * 9) / 5 + 32 : null;

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              MPU6050 6-DoF Inertial Measurement Unit
            </h3>
            <p className="text-xs text-slate-400">
              3-Axis Accelerometer (g) & 3-Axis Gyroscope (raw counts)
            </p>
          </div>
        </div>

        {/* Temperature Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
            <Thermometer className="w-4 h-4 text-rose-400" />
            <span className="text-slate-400">Die Temp:</span>
            {tempC != null ? (
              <span className="text-slate-100 font-bold">
                {tempC.toFixed(1)}°C{" "}
                <span className="text-slate-400 font-normal">({tempF?.toFixed(1)}°F)</span>
              </span>
            ) : (
              <span className="text-slate-500 italic">Not provided</span>
            )}
          </div>
        </div>
      </div>

      {/* Axis Value Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Accel X */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-500/20">
          <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400">
            <span>Accel X</span>
            <span className="text-slate-500 font-sans text-[10px]">g</span>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-cyan-300">
            {imu ? `${imu.accel_x_g >= 0 ? "+" : ""}${imu.accel_x_g.toFixed(3)}` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono flex justify-between">
            <span>Avg: {stats.accelX.avg.toFixed(2)}</span>
            <span>[{stats.accelX.min.toFixed(2)}, {stats.accelX.max.toFixed(2)}]</span>
          </div>
        </div>

        {/* Accel Y */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/20">
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <span>Accel Y</span>
            <span className="text-slate-500 font-sans text-[10px]">g</span>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-emerald-300">
            {imu ? `${imu.accel_y_g >= 0 ? "+" : ""}${imu.accel_y_g.toFixed(3)}` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono flex justify-between">
            <span>Avg: {stats.accelY.avg.toFixed(2)}</span>
            <span>[{stats.accelY.min.toFixed(2)}, {stats.accelY.max.toFixed(2)}]</span>
          </div>
        </div>

        {/* Accel Z */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/20">
          <div className="flex items-center justify-between text-[11px] font-mono text-amber-400">
            <span>Accel Z (1g Earth)</span>
            <span className="text-slate-500 font-sans text-[10px]">g</span>
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-amber-300">
            {imu ? `${imu.accel_z_g >= 0 ? "+" : ""}${imu.accel_z_g.toFixed(3)}` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono flex justify-between">
            <span>Avg: {stats.accelZ.avg.toFixed(2)}</span>
            <span>[{stats.accelZ.min.toFixed(2)}, {stats.accelZ.max.toFixed(2)}]</span>
          </div>
        </div>

        {/* Net Magnitude */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Magnitude |a|</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1 text-lg font-bold font-mono text-purple-300">
            {imu ? `${accelMag.toFixed(3)} g` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            {accelMag > 1.2 ? "Active Motion/Jitter" : "Nominal 1g Resting"}
          </div>
        </div>
      </div>

      {/* Gyroscope Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
          <div className="text-[11px] font-mono text-purple-400 flex items-center justify-between">
            <span>Gyro X (Raw Counts)</span>
            <RotateCcw className="w-3 h-3 text-slate-500" />
          </div>
          <div className="mt-1 text-base font-bold font-mono text-purple-300">
            {imu ? `${imu.gyro_x_raw >= 0 ? "+" : ""}${imu.gyro_x_raw} LSB` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Avg: {Math.round(stats.gyroX.avg)}</span>
            <span>[{stats.gyroX.min}, {stats.gyroX.max}]</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
          <div className="text-[11px] font-mono text-blue-400 flex items-center justify-between">
            <span>Gyro Y (Raw Counts)</span>
            <RotateCcw className="w-3 h-3 text-slate-500" />
          </div>
          <div className="mt-1 text-base font-bold font-mono text-blue-300">
            {imu ? `${imu.gyro_y_raw >= 0 ? "+" : ""}${imu.gyro_y_raw} LSB` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Avg: {Math.round(stats.gyroY.avg)}</span>
            <span>[{stats.gyroY.min}, {stats.gyroY.max}]</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
          <div className="text-[11px] font-mono text-pink-400 flex items-center justify-between">
            <span>Gyro Z (Raw Counts)</span>
            <RotateCcw className="w-3 h-3 text-slate-500" />
          </div>
          <div className="mt-1 text-base font-bold font-mono text-pink-300">
            {imu ? `${imu.gyro_z_raw >= 0 ? "+" : ""}${imu.gyro_z_raw} LSB` : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>Avg: {Math.round(stats.gyroZ.avg)}</span>
            <span>[{stats.gyroZ.min}, {stats.gyroZ.max}]</span>
          </div>
        </div>
      </div>

      {/* Raw counts label reminder */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/40">
        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>
          <strong>Sensor Notice:</strong> Gyroscope axes are displayed as <em>raw sensor counts (LSB)</em> directly as acquired from MPU6050 registers (sensitivity ±250°/s default = 131 LSB/°/s).
        </span>
      </div>

      {/* Live Graph Section */}
      <div className="mt-2 rounded-xl bg-slate-950/80 border border-slate-800/80 p-4">
        {/* Chart Selector Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("accel")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === "accel"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Accelerometer Live (g)
            </button>
            <button
              onClick={() => setActiveTab("gyro")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === "gyro"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              Gyroscope Live (Raw Counts)
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Buffer: {chartHistory.length} / 60 points (In-Memory)
          </div>
        </div>

        {/* Live Recharts Graph */}
        <div className="h-[220px] w-full">
          {chartHistory.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
              Awaiting telemetry data to plot live sensor waveforms...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "accel" ? (
                <LineChart data={chartHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    unit="g"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#090d16",
                      borderColor: "#334155",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accel_x"
                    name="Accel X (g)"
                    stroke="#06b6d4"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="accel_y"
                    name="Accel Y (g)"
                    stroke="#10b981"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="accel_z"
                    name="Accel Z (g)"
                    stroke="#f59e0b"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <LineChart data={chartHistory} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    unit=""
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#090d16",
                      borderColor: "#334155",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", paddingTop: "8px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gyro_x"
                    name="Gyro X (Raw)"
                    stroke="#a855f7"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="gyro_y"
                    name="Gyro Y (Raw)"
                    stroke="#3b82f6"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="gyro_z"
                    name="Gyro Z (Raw)"
                    stroke="#ec4899"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
