const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return Response.json({ error: "Pinata JWT is not configured." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const pinataMetadata = formData.get("pinataMetadata");

    // Build a new FormData to forward to Pinata
    const pinataData = new FormData();

    // Get all files from the request
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (key === "pinataMetadata") continue;
      if (value instanceof File) {
        // Preserve the relative path for folder structure
        pinataData.append("file", value, value.name);
      }
    }

    if (typeof pinataMetadata === "string") {
      pinataData.append("pinataMetadata", pinataMetadata);
    }

    // Enable folder/directory upload via pinataOptions
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