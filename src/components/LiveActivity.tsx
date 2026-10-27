"use client";

import React, { useState } from "react";
import { TelemetryRecord } from "@/lib/types";
import {
  Code,
  Terminal,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  HardDriveDownload,
} from "lucide-react";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

interface LiveActivityProps {
  latestTelemetry: TelemetryRecord | null;
  logs: LogEntry[];
  onClearLogs: () => void;
  onClearChartHistory: () => void;
  chartBufferSize: number;
}

export const LiveActivity: React.FC<LiveActivityProps> = ({
  latestTelemetry,
  logs,
  onClearLogs,
  onClearChartHistory,
  chartBufferSize,
}) => {
  const [activeTab, setActiveTab] = useState<"json" | "logs">("json");
  const [copied, setCopied] = useState(false);

  const jsonString = latestTelemetry
    ? JSON.stringify(latestTelemetry, null, 2)
    : '{\n  "status": "awaiting_telemetry",\n  "hint": "Start Arduino UNO Q or toggle Simulated Demo Mode above"\n}';

  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-lg backdrop-blur-md flex flex-col gap-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === "json"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Latest Ingested Payload (JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              activeTab === "logs"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Browser Event Logs ({logs.length})</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeTab === "json" ? (
            <button
              onClick={copyJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors border border-slate-700/60"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors border border-slate-700/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          )}

          <button
            onClick={onClearChartHistory}
            title="Reset browser chart buffer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs font-mono transition-colors border border-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Buffer ({chartBufferSize})</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === "json" ? (
        <div className="relative rounded-xl bg-slate-950 border border-slate-800/90 p-4 font-mono text-xs overflow-x-auto max-h-[280px]">
          <pre className="text-emerald-400/95 leading-relaxed selection:bg-emerald-500/30">
            {jsonString}
          </pre>
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Storage: Strict in-memory only (overwritten on each POST)</span>
            {latestTelemetry?.server_received_at && (
              <span>Receipt: {latestTelemetry.server_received_at}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-950 border border-slate-800/90 p-3 font-mono text-xs overflow-y-auto max-h-[280px] space-y-1.5">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              No browser events recorded. Telemetry and network events appear here in memory.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-900/60 transition-colors text-[11px]"
              >
                <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                {log.type === "success" && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {log.type === "warn" && (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                {log.type === "error" && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                )}
                {log.type === "info" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                )}
                <span
                  className={
                    log.type === "error"
                      ? "text-rose-300"
                      : log.type === "warn"
                      ? "text-amber-300"
                      : log.type === "success"
                      ? "text-emerald-300"
                      : "text-slate-300"
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Memory storage notice footer */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
        <HardDriveDownload className="w-3.5 h-3.5 text-slate-600" />
        <span>
          Zero-persistence policy: Chart history & logs reside exclusively in volatile browser RAM and are purged upon page reload.
        </span>
      </div>
    </div>
  );
};
