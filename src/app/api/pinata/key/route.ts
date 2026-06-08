export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "Pinata API key and secret are not configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { apiKey, apiSecret },
    { headers: { "Cache-Control": "no-store" } }
  );
}
