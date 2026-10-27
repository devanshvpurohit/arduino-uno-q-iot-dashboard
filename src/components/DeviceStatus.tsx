"use client";

import React, { useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  Radio,
  Cpu,
  Clock,
  Activity,
  Layers,
  ShieldCheck,
} from "lucide-react";

interface DeviceStatusProps {
  deviceId: string | null;
  lastReceivedAt: string | null;
  connectionState: "connected" | "connecting" | "reconnecting" | "disconnected" | "fallback_polling";
  updateRateHz: number;
  isSimulated: boolean;
  totalPackets: number;
}

export const DeviceStatus: React.FC<DeviceStatusProps> = ({
  deviceId,
  lastReceivedAt,
  connectionState,
  updateRateHz,
  isSimulated,
  totalPackets,
}) => {
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  // Compute live elapsed seconds since last message received
  useEffect(() => {
    if (!lastReceivedAt) {
      setSecondsAgo(null);
      return;
    }

    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(lastReceivedAt).getTime()) / 1000));
      setSecondsAgo(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 500);
    return () => clearInterval(interval);
  }, [lastReceivedAt]);

  // Offline rule: marked offline when no new reading arrives for 10 seconds (or if never received)
  const isDeviceOnline = secondsAgo !== null && secondsAgo < 10;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 1. Device Presence & Online State */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Device Status
          </span>
          {isDeviceOnline ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <div className="text-xl font-bold font-mono tracking-tight text-slate-100 flex items-center gap-1.5">
            {isDeviceOnline ? (
              <span className="text-emerald-400">ONLINE</span>
            ) : (
              <span className="text-rose-400">OFFLINE</span>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate flex items-center gap-1 font-mono">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            {deviceId || "uno-q-waiting"}
          </span>
          {isSimulated && (
            <span className="bg-amber-500/10 text-amber-400 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30">
              SIMULATED
            </span>
          )}
        </div>
      </div>

      {/* 2. Last Message Time */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Last Message
          </span>
          <Clock className="w-4 h-4 text-slate-500" />
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-xl font-bold font-mono text-slate-100">
            {secondsAgo === null ? "—" : secondsAgo === 0 ? "Just now" : `${secondsAgo}s ago`}
          </span>
        </div>

        <div className="mt-2 text-[11px] text-slate-500 font-mono truncate" title={lastReceivedAt || ""}>
          {lastReceivedAt ? new Date(lastReceivedAt).toLocaleTimeString() : "Awaiting transmission"}
        </div>
      </div>

      {/* 3. Telemetry Update Frequency */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Update Frequency
          </span>
          <Activity className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono text-cyan-400">
            {isDeviceOnline ? updateRateHz.toFixed(1) : "0.0"}
          </span>
          <span className="text-xs font-mono text-slate-400">Hz (pkt/s)</span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Packets: {totalPackets}</span>
          <span className="text-slate-500">10s timeout</span>
        </div>
      </div>

      {/* 4. Stream / Realtime Connection */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Stream Channel
          </span>
          {connectionState === "connected" ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-400" />
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span
            className={`text-sm md:text-base font-bold font-mono uppercase ${
              connectionState === "connected"
                ? "text-emerald-400"
                : connectionState === "fallback_polling"
                ? "text-sky-400"
                : "text-amber-400"
            }`}
          >
            {connectionState === "connected"
              ? "SSE STREAM ACTIVE"
              : connectionState === "fallback_polling"
              ? "HTTP POLLING ACTIVE"
              : connectionState === "connecting"
              ? "CONNECTING..."
              : "RECONNECTING"}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <Radio className="w-3.5 h-3.5 text-slate-500" />
          <span>Server-Sent Events / GET API</span>
        </div>
      </div>
    </div>
  );
};
