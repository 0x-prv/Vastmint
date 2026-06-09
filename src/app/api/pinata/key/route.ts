export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      error:
        "Pinata credentials are no longer exposed. Use the server-side upload routes instead.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
