"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TelemetryRecord, ChartDataPoint } from "@/lib/types";
import { demoSimulator } from "@/lib/demo-simulator";
import { Navbar } from "@/components/Navbar";
import { DeviceStatus } from "@/components/DeviceStatus";
import { GpsPanel } from "@/components/GpsPanel";
import { ImuPanel } from "@/components/ImuPanel";
import { LiveActivity, LogEntry } from "@/components/LiveActivity";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";

const MAX_CHART_POINTS = 60;
const MAX_TRAIL_POINTS = 30;

export default function DashboardPage() {
  // Telemetry state strictly held in browser React memory (wiped on page refresh)
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryRecord | null>(null);
  const [chartHistory, setChartHistory] = useState<ChartDataPoint[]>([]);
  const [trailPoints, setTrailPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalPackets, setTotalPackets] = useState(0);

  // Connection & frequency metrics
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "reconnecting" | "disconnected" | "fallback_polling"
  >("connecting");
  const [updateRateHz, setUpdateRateHz] = useState(0);
  const lastPacketTimeRef = useRef<number | null>(null);

  // Demo simulation state
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulationMode, setSimulationMode] = useState<"nominal" | "no_fix">("nominal");

  // Helper to add transient browser logs
  const addLog = useCallback(
    (type: LogEntry["type"], message: string) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 50));
    },
    []
  );

  // Ingest incoming packet into transient browser memory
  const processTelemetryPacket = useCallback(
    (data: TelemetryRecord, source: "SSE" | "Poll" | "Sim") => {
      const now = Date.now();

      // Compute rolling frequency (Hz)
      if (lastPacketTimeRef.current) {
        const deltaSec = (now - lastPacketTimeRef.current) / 1000;
        if (deltaSec > 0.05) {
          const instantHz = 1 / deltaSec;
          setUpdateRateHz((prev) => Number((prev * 0.7 + instantHz * 0.3).toFixed(1)));
        }
      }
      lastPacketTimeRef.current = now;

      // Update latest state
      setLatestTelemetry(data);
      setTotalPackets((prev) => prev + 1);

      // Create chart data point
      const timeLabel = new Date(data.timestamp || now).toLocaleTimeString([], {
        hour12: false,
        minute: "2-digit",
        second: "2-digit",
      });

      const newPoint: ChartDataPoint = {
        timeLabel,
        timestamp: now,
        accel_x: data.imu.accel_x_g,
        accel_y: data.imu.accel_y_g,
        accel_z: data.imu.accel_z_g,
        gyro_x: data.imu.gyro_x_raw,
        gyro_y: data.imu.gyro_y_raw,
        gyro_z: data.imu.gyro_z_raw,
        temp: data.imu.temperature_c,
      };

      // Append to rolling chart buffer (max 60 points in RAM)
      setChartHistory((prev) => [...prev.slice(-MAX_CHART_POINTS + 1), newPoint]);

      // Append to GPS trail if fix and coordinates are valid
      if (
        data.gps.fix &&
        data.gps.latitude != null &&
        data.gps.longitude != null &&
        !isNaN(data.gps.latitude) &&
        !isNaN(data.gps.longitude)
      ) {
        setTrailPoints((prev) => [
          ...prev.slice(-MAX_TRAIL_POINTS + 1),
          { lat: data.gps.latitude!, lng: data.gps.longitude! },
        ]);
      }
    },
    []
  );

  // Setup Server-Sent Events (SSE) and fallback HTTP polling
  useEffect(() => {
    if (isSimulated) return; // When simulated, pause network stream

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const connectSse = () => {
      try {
        setConnectionState("connecting");
        eventSource = new EventSource("/api/stream");

        eventSource.onopen = () => {
          if (isCancelled) return;
          setConnectionState("connected");
          addLog("success", "Connected to Server-Sent Events stream (/api/stream)");
        };

        eventSource.addEventListener("telemetry", (e: MessageEvent) => {
          if (isCancelled) return;
          try {
            const data: TelemetryRecord = JSON.parse(e.data);
            processTelemetryPacket(data, "SSE");
          } catch (err) {
            addLog("warn", "Received unparseable SSE telemetry packet.");
          }
        });

        eventSource.addEventListener("ping", () => {
          // Heartbeat ping received
        });

        eventSource.onerror = () => {
          if (isCancelled) return;
          // In serverless environments, SSE might close after execution limit
          setConnectionState("fallback_polling");
          addLog("warn", "SSE stream interrupted. Initiating dual-mode HTTP fallback.");
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPolling();
        };
      } catch (err) {
        setConnectionState("fallback_polling");
        startPolling();
      }
    };

    const fetchLatestTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.status === "success" && json.data) {
            processTelemetryPacket(json.data, "Poll");
          }
        }
      } catch {
        // Network error during poll
      }
    };

    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      fetchLatestTelemetry();
      pollInterval = setInterval(fetchLatestTelemetry, 2000);
    };

    // Initial connection
    connectSse();

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isSimulated, processTelemetryPacket, addLog]);

  // Demo Simulation interval (1 Hz)
  useEffect(() => {
    if (!isSimulated) return;

    addLog("info", "Simulated Arduino UNO Q demo mode active (1.0 Hz)");
    setConnectionState("connected");

    const timer = setInterval(() => {
      const simulatedData =
        simulationMode === "nominal"
          ? demoSimulator.generateReading("uno-q-01-sim")
          : demoSimulator.generateNoFixReading("uno-q-01-sim");

      processTelemetryPacket(simulatedData, "Sim");
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isSimulated, simulationMode, processTelemetryPacket, addLog]);

  // Handler to send a live test POST packet to /api/telemetry
  const handleSendTestPacket = async () => {
    try {
      addLog("info", "Dispatching test HTTPS POST to /api/telemetry...");
      const testData = demoSimulator.generateReading("uno-q-manual-test");

      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer arduino-uno-q-secret-key-2026",
        },
        body: JSON.stringify(testData),
      });

      const json = await res.json();
      if (res.ok) {
        addLog(
          "success",
          `POST 200 OK — Ingested into memory. Receipt: ${json.server_received_at}`
        );
      } else {
        addLog("error", `POST failed: ${res.status} ${json.message || json.error}`);
      }
    } catch (err: unknown) {
      addLog("error", `POST network failure: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClearChartHistory = () => {
    setChartHistory([]);
    setTrailPoints([]);
    addLog("info", "Transient chart memory buffer reset by user.");
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        isSimulated={isSimulated}
        onToggleSimulated={setIsSimulated}
        simulationMode={simulationMode}
        onChangeSimulationMode={setSimulationMode}
        onSendTestPacket={handleSendTestPacket}
      />

      {/* Simulated Demo Mode Banner */}
      {isSimulated && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>
            <strong>DEMO MODE ACTIVE:</strong> Generating synthetic physical sensor readings
            (NEO-6M GPS drift &amp; MPU6050 dynamics) in browser memory. Toggle off in navbar to
            listen for live Arduino hardware.
          </span>
        </div>
      )}

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Row 1: Device Status Cards */}
        <DeviceStatus
          deviceId={latestTelemetry?.device_id || null}
          lastReceivedAt={latestTelemetry?.server_received_at || latestTelemetry?.timestamp || null}
          connectionState={connectionState}
          updateRateHz={updateRateHz}
          isSimulated={isSimulated}
          totalPackets={totalPackets}
        />

        {/* Row 2: GPS Panel & IMU Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GPS Panel */}
          <GpsPanel gps={latestTelemetry?.gps} trailPoints={trailPoints} />

          {/* IMU Panel */}
          <ImuPanel imu={latestTelemetry?.imu} chartHistory={chartHistory} />
        </div>

        {/* Row 3: Live Activity, Formatted JSON, Logs & Buffer Controls */}
        <LiveActivity
          latestTelemetry={latestTelemetry}
          logs={logs}
          onClearLogs={handleClearLogs}
          onClearChartHistory={handleClearChartHistory}
          chartBufferSize={chartHistory.length}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Arduino UNO Q • NEO-6M • MPU6050 • SSD1306 OLED</span>
          <span className="text-slate-600">
            Strict Zero-Persistence Policy • Volatile Memory Only
          </span>
        </div>
      </footer>
    </div>
  );
}
