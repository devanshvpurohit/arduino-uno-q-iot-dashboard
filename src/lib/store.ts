import { TelemetryRecord } from "./types";

/**
 * In-Memory Telemetry Store (No Database, No Filesystem, No Redis).
 * Holds strictly the SINGLE latest reading.
 * Provides pub/sub for real-time Server-Sent Events (SSE).
 */

type TelemetryListener = (record: TelemetryRecord) => void;

interface TelemetryStoreState {
  latestReading: TelemetryRecord | null;
  subscribers: Set<TelemetryListener>;
  requestCount: number;
  lastClientIps: Map<string, { count: number; windowStart: number }>;
}

// Attach to globalThis so Next.js dev reloads and route handlers share the same process memory in Node.js
declare global {
  // eslint-disable-next-line no-var
  var __telemetryStore: TelemetryStoreState | undefined;
}

if (!globalThis.__telemetryStore) {
  globalThis.__telemetryStore = {
    latestReading: null,
    subscribers: new Set<TelemetryListener>(),
    requestCount: 0,
    lastClientIps: new Map(),
  };
}

const store = globalThis.__telemetryStore;

/**
 * Save the latest telemetry reading in memory only.
 * Overwrites the previous value (only 1 reading kept in memory).
 * Notifies all active SSE subscribers.
 */
export function setLatestTelemetry(data: TelemetryRecord): void {
  store.latestReading = data;
  store.requestCount += 1;

  // Notify all connected SSE client streams
  store.subscribers.forEach((listener) => {
    try {
      listener(data);
    } catch (err) {
      console.error("[Store] Error dispatching to SSE listener:", err);
    }
  });
}

/**
 * Get the latest telemetry reading currently stored in memory.
 */
export function getLatestTelemetry(): TelemetryRecord | null {
  return store.latestReading;
}

/**
 * Subscribe a connected client to incoming telemetry events.
 * Returns an unsubscribe callback.
 */
export function subscribeTelemetry(listener: TelemetryListener): () => void {
  store.subscribers.add(listener);
  return () => {
    store.subscribers.delete(listener);
  };
}

/**
 * Returns the count of active SSE client subscribers.
 */
export function getSubscriberCount(): number {
  return store.subscribers.size;
}

/**
 * Basic in-memory rate limiting check (e.g. max 20 requests per second per IP).
 * Window is 1000ms.
 */
export function checkRateLimit(clientIp: string, maxPerSecond = 20): boolean {
  const now = Date.now();
  const entry = store.lastClientIps.get(clientIp);

  if (!entry || now - entry.windowStart > 1000) {
    store.lastClientIps.set(clientIp, { count: 1, windowStart: now });
    // Clean up old entries if map grows
    if (store.lastClientIps.size > 2000) {
      for (const [key, val] of store.lastClientIps.entries()) {
        if (now - val.windowStart > 5000) {
          store.lastClientIps.delete(key);
        }
      }
    }
    return true;
  }

  if (entry.count >= maxPerSecond) {
    return false;
  }

  entry.count += 1;
  return true;
}
