import { getAddress, isAddress, encodeAbiParameters, parseAbiParameters } from "viem";

const PINATA_GATEWAY = `https://${process.env.PINATA_GATEWAY_DOMAIN}/ipfs`;

export async function GET(request: Request) {
  const apiKey = process.env.ALLOWLIST_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Allowlist API key is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${apiKey}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const walletParam = searchParams.get("wallet");

  if (!cid) {
    return Response.json({ error: "Missing 'cid' parameter." }, { status: 400 });
  }
  if (!walletParam || !isAddress(walletParam)) {
    return Response.json({ error: "Missing or invalid 'wallet' parameter." }, { status: 400 });
  }

  const wallet = getAddress(walletParam);

  const pinataResponse = await fetch(`${PINATA_GATEWAY}/${cid}`, {
    headers: { Accept: "application/json" },
  });

  if (!pinataResponse.ok) {
    return Response.json({ error: "Could not fetch allowlist data." }, { status: 502 });
  }

  const data = await pinataResponse.json().catch(() => null);
  if (!data || !Array.isArray(data.addresses)) {
    return Response.json({ error: "Invalid allowlist data format." }, { status: 502 });
  }

  const normalizedList: string[] = data.addresses
    .filter((a: unknown): a is string => typeof a === "string" && isAddress(a))
    .map((a: string) => getAddress(a));

  const allowed = normalizedList.includes(wallet);

  // IMPORTANT: the on-chain contract does abi.decode(body, (bool)),
  // so the response body must be raw ABI-encoded bytes, not JSON text.
  const encoded = encodeAbiParameters(parseAbiParameters("bool"), [allowed]);
  const bytes = Buffer.from(encoded.slice(2), "hex");

  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" },
  });
}