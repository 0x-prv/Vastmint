const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Simple in-memory rate limiter — resets on server restart
// Para sa production, gamitin ang Redis o Upstash
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // max requests
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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file upload." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Only image uploads are allowed." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({ error: "Image must be 10MB or smaller." }, { status: 400 });
  }

  const pinataData = new FormData();
  pinataData.append("file", file);

  const metadata = formData.get("pinataMetadata");
  if (typeof metadata === "string") {
    // Validate metadata length
    if (metadata.length > 1000) {
      return Response.json({ error: "Metadata too large." }, { status: 400 });
    }
    pinataData.append("pinataMetadata", metadata);
  }

  const response = await fetch(PINATA_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: pinataData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return Response.json({ error: "Pinata file upload failed.", details: data }, { status: response.status });
  }

  return Response.json(data);
}