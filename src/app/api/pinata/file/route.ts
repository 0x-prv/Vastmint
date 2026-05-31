const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return Response.json({ error: "Pinata JWT is not configured." }, { status: 500 });
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
