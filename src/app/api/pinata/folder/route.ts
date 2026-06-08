const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

const MAX_FILES = 10000;                        // was 100 → now supports 10k supply
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;   // 10MB per file
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // was 100MB → now 500MB total
const MAX_METADATA_LENGTH = 1000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;           // was 3 → now 10 per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

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

  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Too many folder uploads. Please wait and try again." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const pinataMetadata = formData.get("pinataMetadata");

    if (typeof pinataMetadata === "string" && pinataMetadata.length > MAX_METADATA_LENGTH) {
      return Response.json({ error: "Metadata too large." }, { status: 400 });
    }

    const pinataData = new FormData();
    const entries = Array.from(formData.entries());

    let fileCount = 0;
    let totalSize = 0;

    for (const [key, value] of entries) {
      if (key === "pinataMetadata" || key === "pinataOptions") continue;

      if (value instanceof File) {
        fileCount++;
        totalSize += value.size;

        if (fileCount > MAX_FILES) {
          return Response.json(
            { error: `Too many files. Maximum is ${MAX_FILES} files per folder upload.` },
            { status: 400 }
          );
        }

        if (value.size > MAX_FILE_SIZE_BYTES) {
          return Response.json(
            { error: `Each file must be 10MB or smaller.` },
            { status: 400 }
          );
        }

        if (totalSize > MAX_TOTAL_SIZE_BYTES) {
          return Response.json(
            { error: `Total upload size must be 500MB or smaller.` },
            { status: 400 }
          );
        }

        const allowedTypes = ["image/", "application/json", "text/plain"];
        const isAllowed = allowedTypes.some((type) => value.type.startsWith(type));

        if (!isAllowed) {
          return Response.json(
            { error: "Only images, JSON, or text metadata files are allowed." },
            { status: 400 }
          );
        }

        pinataData.append("file", value, value.name);
      }
    }

    if (fileCount === 0) {
      return Response.json({ error: "No files found for folder upload." }, { status: 400 });
    }

    if (typeof pinataMetadata === "string") {
      pinataData.append("pinataMetadata", pinataMetadata);
    }

    pinataData.append(
      "pinataOptions",
      JSON.stringify({ wrapWithDirectory: true })
    );

    const response = await fetch(PINATA_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(
        { error: "Pinata folder upload failed.", details: data },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}