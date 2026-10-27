"use client";

import React, { useEffect, useRef, useState } from "react";
import { LocateFixed, AlertTriangle } from "lucide-react";
import type L from "leaflet";

interface MapViewProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  fix: boolean;
  satellites: number;
  altitudeM: number | null | undefined;
  trailPoints?: Array<{ lat: number; lng: number }>;
}

export const MapView: React.FC<MapViewProps> = ({
  latitude,
  longitude,
  fix,
  satellites,
  altitudeM,
  trailPoints = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const hasInitializedCenter = useRef(false);
  const [leafletLib, setLeafletLib] = useState<typeof L | null>(null);

  const hasValidCoords =
    fix &&
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  // Dynamically load Leaflet on the client side only
  useEffect(() => {
    let isMounted = true;
    import("leaflet").then((mod) => {
      if (isMounted) {
        setLeafletLib(mod.default || mod);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Leaflet map instance once leafletLib and DOM are ready
  useEffect(() => {
    if (!mapContainerRef.current || !leafletLib) return;

    if (!mapInstanceRef.current) {
      const initialLat = hasValidCoords ? latitude! : 20.0;
      const initialLng = hasValidCoords ? longitude! : 0.0;
      const initialZoom = hasValidCoords ? 15 : 2;

      const map = leafletLib.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      leafletLib
        .tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
          }
        )
        .addTo(map);

      leafletLib.control.zoom({ position: "topright" }).addTo(map);

      // Custom pulsing green dot marker
      const customIcon = leafletLib.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(16, 185, 129, 0.35); animation: radar-pulse 1.8s infinite;"></div>
            <div style="position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 10px #10b981;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (hasValidCoords) {
        markerRef.current = leafletLib
          .marker([latitude!, longitude!], { icon: customIcon })
          .addTo(map);
        hasInitializedCenter.current = true;
      }

      polylineRef.current = leafletLib
        .polyline([], {
          color: "#06b6d4",
          weight: 3,
          opacity: 0.85,
          dashArray: "4, 6",
        })
        .addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        polylineRef.current = null;
        hasInitializedCenter.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletLib]);

  // Update marker position and breadcrumb trail
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !leafletLib) return;

    if (hasValidCoords) {
      const latLng: [number, number] = [latitude!, longitude!];

      if (markerRef.current) {
        markerRef.current.setLatLng(latLng);
      } else {
        const customIcon = leafletLib.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(16, 185, 129, 0.35); animation: radar-pulse 1.8s infinite;"></div>
              <div style="position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 10px #10b981;"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        markerRef.current = leafletLib.marker(latLng, { icon: customIcon }).addTo(map);
      }

      if (!hasInitializedCenter.current) {
        map.setView(latLng, 16, { animate: true });
        hasInitializedCenter.current = true;
      }

      if (polylineRef.current && trailPoints.length > 0) {
        const latLngs: L.LatLngExpression[] = trailPoints.map((p) => [p.lat, p.lng]);
        polylineRef.current.setLatLngs(latLngs);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [hasValidCoords, latitude, longitude, trailPoints, leafletLib]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && hasValidCoords) {
      mapInstanceRef.current.setView([latitude!, longitude!], 16, { animate: true });
    }
  };

  return (
    <div className="relative w-full h-[320px] md:h-[380px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Overlay when fix is false or missing */}
      {!hasValidCoords && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 animate-pulse" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            GPS Fix Searching
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
            NEO-6M receiver is acquiring satellite locks ({satellites} sat
            {satellites === 1 ? "" : "s"} visible). Coordinates will render once 3D fix is acquired.
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-amber-400/90 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-800/50">
            <span>Status: FIX_PENDING</span>
          </div>
        </div>
      )}

      {/* Floating map status bar */}
      {hasValidCoords && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-medium text-emerald-300">
            {latitude?.toFixed(5)}°, {longitude?.toFixed(5)}°
          </span>
          {altitudeM != null && (
            <span className="text-[11px] font-mono text-slate-400 border-l border-slate-700 pl-2">
              Alt: {altitudeM.toFixed(1)}m
            </span>
          )}
        </div>
      )}

      {/* Re-center button */}
      {hasValidCoords && (
        <button
          onClick={handleRecenter}
          title="Re-center onto current GPS coordinates"
          className="absolute bottom-3 right-3 z-10 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white p-2 rounded-lg border border-slate-700/60 shadow-lg transition-all flex items-center gap-1.5 text-xs"
        >
          <LocateFixed className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-[11px]">Center</span>
        </button>
      )}

      {/* Map watermark badge */}
      <div className="absolute bottom-1 left-2 z-10 pointer-events-none text-[10px] text-slate-500 font-mono">
        CartoDB / OpenStreetMap
      </div>
    </div>
  );
};

export default MapView;
