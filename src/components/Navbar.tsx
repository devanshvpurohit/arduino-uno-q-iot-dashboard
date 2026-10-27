"use client";

import React, { useState } from "react";
import { ArchitectureModal } from "./ArchitectureModal";
import {
  Cpu,
  Play,
  Square,
  Key,
  Copy,
  Check,
  Send,
  Sparkles,
} from "lucide-react";

interface NavbarProps {
  isSimulated: boolean;
  onToggleSimulated: (enabled: boolean) => void;
  simulationMode: "nominal" | "no_fix";
  onChangeSimulationMode: (mode: "nominal" | "no_fix") => void;
  onSendTestPacket: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isSimulated,
  onToggleSimulated,
  simulationMode,
  onChangeSimulationMode,
  onSendTestPacket,
}) => {
  const [showCurlModal, setShowCurlModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const curlExample = `curl -X POST https://arduino-uno-q-iot-dashboard.vercel.app/api/telemetry \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d" \\
  -d '{
    "device_id": "arduino-uno-q",
    "timestamp": "2026-10-27T15:00:00.000Z",
    "gps": {
      "latitude": 17.3850,
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
  }'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/90 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  Arduino UNO Q
                  <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    IoT Live
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block font-mono">
                NEO-6M GPS • MPU6050 6-DoF IMU • SSD1306 OLED Telemetry
              </p>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Demo Simulation Switch */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 shadow-inner">
              <button
                onClick={() => onToggleSimulated(!isSimulated)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  isSimulated
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Toggle simulated sensor telemetry stream"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Demo Mode:</span>
                <span className="font-bold">{isSimulated ? "ON" : "OFF"}</span>
              </button>

              {isSimulated && (
                <div className="flex items-center border-l border-slate-800 pl-1">
                  <select
                    value={simulationMode}
                    onChange={(e) =>
                      onChangeSimulationMode(e.target.value as "nominal" | "no_fix")
                    }
                    className="bg-slate-950 text-amber-300 text-[11px] font-mono rounded px-1.5 py-0.5 border border-amber-500/30 focus:outline-none"
                  >
                    <option value="nominal">3D GPS Fix</option>
                    <option value="no_fix">No Fix / Search</option>
                  </select>
                </div>
              )}
            </div>

            {/* Test POST Packet Button */}
            <button
              onClick={onSendTestPacket}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 text-xs font-mono border border-emerald-500/30 transition-all shadow-sm"
              title="Send a sample telemetry packet to /api/telemetry right now"
            >
              <Send className="w-3 h-3 text-emerald-400" />
              <span>Send Sample POST</span>
            </button>

            {/* API Ingestion Helper */}
            <button
              onClick={() => setShowCurlModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono border border-slate-700/80 transition-all"
              title="View Arduino HTTP POST integration & curl command"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">API Ingestion</span>
            </button>

            {/* Architecture Explainer */}
            <ArchitectureModal />
          </div>
        </div>
      </header>

      {/* API Ingestion & Curl Modal */}
      {showCurlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Key className="w-5 h-5 text-amber-400" />
                <span>Ingestion Endpoint & Authentication</span>
              </div>
              <button
                onClick={() => setShowCurlModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-300">
                Your Arduino UNO Q sends data via HTTPS POST to{" "}
                <code className="text-emerald-400 font-mono">/api/telemetry</code> using the
                configured Bearer token:
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-slate-500">Method:</span>{" "}
                  <span className="text-emerald-400 font-bold">POST</span>
                </div>
                <div>
                  <span className="text-slate-500">Header:</span>{" "}
                  <span className="text-cyan-300">Authorization: Bearer &lt;DEVICE_API_KEY&gt;</span>
                </div>
                <div>
                  <span className="text-slate-500">Device API Key:</span>{" "}
                  <span className="text-amber-300 font-mono">UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d</span>
                </div>
                <div>
                  <span className="text-slate-500">Content-Type:</span>{" "}
                  <span className="text-slate-300">application/json</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>Sample Ingestion Command (Terminal):</span>
                  <button
                    onClick={copyCurl}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy cURL"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                  {curlExample}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowCurlModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
