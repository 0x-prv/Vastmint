const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const MAX_PAYLOAD_SIZE_BYTES = 512 * 1024; // 512KB max

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // max requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // per 1 minute

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) return true;

  entry.count++;
  return false;
}

function isValidMetadataPayload(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const obj = body as Record<string, unknown>;

  // Dapat may pinataContent or direct metadata fields
  const hasContent = "pinataContent" in obj || "name" in obj || "image" in obj;
  return hasContent;
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return Response.json({ error: "Pinata JWT is not configured." }, { status: 500 });
  }

  // Rate limiting
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  // Payload size check
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE_BYTES) {
    return Response.json({ error: "Payload too large. Maximum 512KB." }, { status: 413 });
  }

  const rawBody = await request.text().catch(() => null);
  if (!rawBody) {
    return Response.json({ error: "Empty request body." }, { status: 400 });
  }

  // Payload size check (actual)
  if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_SIZE_BYTES) {
    return Response.json({ error: "Payload too large. Maximum 512KB." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // Schema validation
  if (!isValidMetadataPayload(body)) {
    return Response.json({ error: "Invalid metadata structure." }, { status: 400 });
  }

  const response = await fetch(PINATA_JSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return Response.json({ error: "Pinata metadata upload failed.", details: data }, { status: response.status });
  }

  return Response.json(data);
}