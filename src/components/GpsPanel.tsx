"use client";

import React from "react";
import dynamic from "next/dynamic";
import { GpsData } from "@/lib/types";
import {
  Compass,
  Satellite,
  Mountain,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

// Dynamically import MapView with SSR disabled for Leaflet client-only rendering
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] md:h-[380px] rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center text-slate-500 font-mono text-xs">
      Initializing interactive GPS map...
    </div>
  ),
});

interface GpsPanelProps {
  gps: GpsData | null | undefined;
  trailPoints?: Array<{ lat: number; lng: number }>;
}

export const GpsPanel: React.FC<GpsPanelProps> = ({ gps, trailPoints = [] }) => {
  const [copied, setCopied] = React.useState(false);

  const fixAcquired = Boolean(gps?.fix);
  const lat = gps?.latitude;
  const lng = gps?.longitude;
  const alt = gps?.altitude_m;
  const sats = gps?.satellites ?? 0;

  const copyCoordinates = () => {
    if (lat != null && lng != null) {
      navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Format cardinal directions (e.g., 17.385000° N, 78.486700° E)
  const formatCoord = (val: number | null | undefined, posSuffix: string, negSuffix: string) => {
    if (val == null || !fixAcquired || isNaN(val)) return "—";
    const dir = val >= 0 ? posSuffix : negSuffix;
    return `${Math.abs(val).toFixed(6)}° ${dir}`;
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              NEO-6M GPS Telemetry
            </h3>
            <p className="text-xs text-slate-400">Positioning, altitude & satellite tracking</p>
          </div>
        </div>

        {/* Fix status badge */}
        <div>
          {fixAcquired ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              3D FIX ACQUIRED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              NO FIX / SEARCHING
            </span>
          )}
        </div>
      </div>

      {/* GPS Numeric Data Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Latitude */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Latitude</span>
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="mt-1.5 text-base md:text-lg font-bold font-mono text-slate-100">
            {formatCoord(lat, "N", "S")}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {fixAcquired && lat != null ? `${lat.toFixed(6)}` : "Invalid fix"}
          </div>
        </div>

        {/* Longitude */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Longitude</span>
            <Crosshair className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="mt-1.5 text-base md:text-lg font-bold font-mono text-slate-100">
            {formatCoord(lng, "E", "W")}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {fixAcquired && lng != null ? `${lng.toFixed(6)}` : "Invalid fix"}
          </div>
        </div>

        {/* Altitude */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Altitude</span>
            <Mountain className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1.5 text-base md:text-lg font-bold font-mono text-cyan-300">
            {fixAcquired && alt != null ? `${alt.toFixed(1)} m` : "—"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {fixAcquired && alt != null ? `${(alt * 3.28084).toFixed(1)} ft MSL` : "No lock"}
          </div>
        </div>

        {/* Satellites */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
            <span>Satellites</span>
            <Satellite className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-base md:text-lg font-bold font-mono text-emerald-400 flex items-baseline gap-1">
            <span>{gps?.satellites != null ? sats : "—"}</span>
            <span className="text-xs font-normal text-slate-400">tracked</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {gps?.satellites == null
              ? "Receiver unattached"
              : sats >= 4
              ? "3D Trilateration OK"
              : sats > 0
              ? "Insufficient (needs 4+)"
              : "No satellites"}
          </div>
        </div>
      </div>

      {/* Copy coordinates action strip */}
      {fixAcquired && lat != null && lng != null && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800/50 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Raw Coordinates:</span>
            <span className="text-slate-200">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
          <button
            onClick={copyCoordinates}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Interactive Map View */}
      <MapView
        latitude={lat}
        longitude={lng}
        fix={fixAcquired}
        satellites={sats}
        altitudeM={alt}
        trailPoints={trailPoints}
      />
    </div>
  );
};
