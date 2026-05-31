const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return Response.json({ error: "Pinata JWT is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
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
