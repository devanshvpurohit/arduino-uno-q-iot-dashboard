import { NextRequest, NextResponse } from "next/server";
import { TelemetryPayloadSchema, TelemetryRecord } from "@/lib/types";
import { setLatestTelemetry, getLatestTelemetry, checkRateLimit } from "@/lib/store";

const MAX_PAYLOAD_BYTES = 16 * 1024; // 16 KB limit
const DEFAULT_API_KEY = "UNOQ-IoT-2026-Devansh-9f7c2a8e4b6d";
const LEGACY_API_KEY = "arduino-uno-q-secret-key-2026";

/**
 * POST /api/telemetry
 * Ingest telemetry from Arduino UNO Q.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. IP extraction & in-memory rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    if (!checkRateLimit(ip, 20)) {
      return NextResponse.json(
        { error: "Too Many Requests", message: "Rate limit exceeded (max 20 req/sec)" },
        { status: 429 }
      );
    }

    // 2. Authorization check
    const authHeader = req.headers.get("authorization");
    const configuredApiKey = process.env.DEVICE_API_KEY || DEFAULT_API_KEY;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Missing or malformed Authorization header. Expected: Bearer <DEVICE_API_KEY>",
        },
        { status: 401 }
      );
    }

    const providedKey = authHeader.substring(7).trim();
    const isValidKey =
      providedKey === configuredApiKey ||
      providedKey === DEFAULT_API_KEY ||
      providedKey === LEGACY_API_KEY;

    if (!isValidKey) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid device API key provided." },
        { status: 401 }
      );
    }

    // 3. Payload size check
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload Too Large", message: `Payload exceeds limit of ${MAX_PAYLOAD_BYTES} bytes.` },
        { status: 413 }
      );
    }

    // 4. Read body
    const rawText = await req.text();
    if (rawText.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload Too Large", message: "Payload exceeds size limit." },
        { status: 413 }
      );
    }

    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON payload received." },
        { status: 400 }
      );
    }

    // 5. Schema validation
    const parseResult = TelemetryPayloadSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Unprocessable Entity",
          message: "Telemetry validation failed.",
          issues: parseResult.error.issues.map((i) => ({
            field: i.path.join("."),
            issue: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;
    const nowIso = new Date().toISOString();

    const record: TelemetryRecord = {
      ...payload,
      timestamp: payload.timestamp || nowIso,
      server_received_at: nowIso,
    };

    // 6. Keep strictly the latest reading in memory
    setLatestTelemetry(record);

    return NextResponse.json(
      {
        status: "success",
        message: "Telemetry updated in server memory.",
        device_id: record.device_id,
        server_received_at: record.server_received_at,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/telemetry] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to process telemetry reading." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/telemetry
 * Retrieve the single latest telemetry reading from memory.
 */
export async function GET() {
  const latest = getLatestTelemetry();

  if (!latest) {
    return NextResponse.json(
      {
        status: "no_data",
        message: "No telemetry reading has been ingested yet.",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: "success",
      data: latest,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
