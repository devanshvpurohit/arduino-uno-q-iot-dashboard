"use client";

import React, { useState } from "react";
import {
  Server,
  Cloud,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle,
  X,
  ExternalLink,
} from "lucide-react";

export const ArchitectureModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono border border-slate-700/80 transition-all shadow-sm"
      >
        <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Vercel & Real-Time Architecture</span>
        <span className="sm:hidden">Architecture</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Hosting Architecture & Vercel Serverless Analysis
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time telemetry without persistent databases: In-memory concurrency trade-offs
                </p>
              </div>
            </div>

            {/* Core Warning Box */}
            <div className="mt-4 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>The Serverless Ephemeral Memory Constraint</span>
              </div>
              <p className="leading-relaxed">
                Vercel Serverless Functions execute on isolated AWS Lambda micro-containers.
                Each invocation (e.g. an Arduino <code>POST /api/telemetry</code> vs a browser{" "}
                <code>GET /api/stream</code>) may run on completely separate isolated virtual
                instances that <strong>do not share memory</strong>.
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Continuous Node.js Server */}
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Recommended Production</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">
                    Continuous Node.js Server
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Hosted on a long-running Node container (Docker, Railway, Render, Fly.io, or self-hosted VPS) via{" "}
                    <code className="text-emerald-300">npm start</code>.
                  </p>
                  <ul className="mt-3 text-[11px] text-slate-300 space-y-1.5 font-mono list-disc list-inside">
                    <li>Single resident process in RAM</li>
                    <li>Sub-millisecond SSE broadcast</li>
                    <li>Zero database needed</li>
                    <li>Persistent client SSE streams</li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-emerald-400 font-mono">
                  ✓ 100% Shared In-Memory State
                </div>
              </div>

              {/* Option 2: Vercel Serverless */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <Cloud className="w-4 h-4" />
                    <span>Vercel Serverless</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">
                    Serverless Edge & Lambdas
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Deployed to Vercel without a persistent storage layer. Function memory is ephemeral and instance-scoped.
                  </p>
                  <ul className="mt-3 text-[11px] text-slate-300 space-y-1.5 font-mono list-disc list-inside">
                    <li>Multiple instances spin up/down</li>
                    <li>SSE connections timeout at limits</li>
                    <li>POST & GET may hit different lambdas</li>
                    <li>Dashboard uses hybrid polling fallback</li>
                  </ul>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-amber-400 font-mono">
                  ⚠ Requires External PubSub for Multi-Lambda
                </div>
              </div>
            </div>

            {/* How this dashboard handles it */}
            <div className="mt-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>Dual-Mode Resilient Client Architecture</span>
              </h4>
              <p className="text-slate-400 leading-relaxed">
                This dashboard connects via <strong>Server-Sent Events (SSE)</strong> for instant push updates.
                If deployed to a platform where serverless memory isolates instances, the client automatically
                initiates smart background synchronization to guarantee the dashboard remains updated without requiring
                any persistent database.
              </p>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
