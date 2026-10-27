import { NextRequest } from "next/server";
import { getLatestTelemetry, subscribeTelemetry } from "@/lib/store";
import { TelemetryRecord } from "@/lib/types";

/**
 * GET /api/stream
 * Server-Sent Events (SSE) stream for real-time telemetry updates.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      // Helper to enqueue formatted SSE messages
      const sendEvent = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed or errored
        }
      };

      // 1. Immediately send current latest telemetry if available
      const current = getLatestTelemetry();
      if (current) {
        sendEvent("telemetry", current);
      } else {
        sendEvent("status", { state: "connected", message: "Awaiting first telemetry packet." });
      }

      // 2. Subscribe to newly arrived telemetry packets
      const unsubscribe = subscribeTelemetry((record: TelemetryRecord) => {
        sendEvent("telemetry", record);
      });

      // 3. Heartbeat timer (15s) to keep proxy / browser connections alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`));
          sendEvent("ping", { time: Date.now() });
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // 4. Handle client disconnection cleanly
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disables Nginx buffering for SSE
    },
  });
}
