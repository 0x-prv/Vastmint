import { getAddress, isAddress, encodeAbiParameters, parseAbiParameters } from "viem";
import { randomUUID } from "crypto";

const PINATA_GATEWAY = `https://${process.env.PINATA_GATEWAY_DOMAIN}/ipfs`;

export async function GET(request: Request) {
  const requestId = randomUUID();
  const apiKey = process.env.ALLOWLIST_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Allowlist API key is not configured." }, { status: 500, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${apiKey}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  }

  const { searchParams } = new URL(request.url);
  const cid = searchParams.get("cid");
  const walletParam = searchParams.get("wallet");
  const collectionParam = searchParams.get("collection");
  const correlationId = searchParams.get("requestId") ?? requestId;

  if (!cid) {
    return Response.json({ error: "Missing 'cid' parameter." }, { status: 400, headers: { "Cache-Control": "no-store", "X-Request-Id": correlationId } });
  }
  if (!walletParam || !isAddress(walletParam)) {
    return Response.json({ error: "Missing or invalid 'wallet' parameter." }, { status: 400, headers: { "Cache-Control": "no-store", "X-Request-Id": correlationId } });
  }
  if (collectionParam && !isAddress(collectionParam)) {
    return Response.json({ error: "Invalid 'collection' parameter." }, { status: 400, headers: { "Cache-Control": "no-store", "X-Request-Id": correlationId } });
  }

  const wallet = getAddress(walletParam);
  const collection = collectionParam ? getAddress(collectionParam) : null;
  console.info("allowlist.verify.request", { requestId: correlationId, cid, wallet, collection });

  const pinataResponse = await fetch(`${PINATA_GATEWAY}/${cid}`, {
    headers: { Accept: "application/json" },
  });

  if (!pinataResponse.ok) {
    console.warn("allowlist.verify.pinata_failed", { requestId: correlationId, cid, status: pinataResponse.status });
    return Response.json({ error: "Could not fetch allowlist data." }, { status: 502, headers: { "Cache-Control": "no-store", "X-Request-Id": correlationId } });
  }

  const data = await pinataResponse.json().catch(() => null);
  if (!data || !Array.isArray(data.addresses)) {
    console.warn("allowlist.verify.invalid_format", { requestId: correlationId, cid });
    return Response.json({ error: "Invalid allowlist data format." }, { status: 502, headers: { "Cache-Control": "no-store", "X-Request-Id": correlationId } });
  }

  const normalizedList: string[] = data.addresses
    .filter((a: unknown): a is string => typeof a === "string" && isAddress(a))
    .map((a: string) => getAddress(a));

  const allowed = normalizedList.includes(wallet);

  // IMPORTANT: the on-chain contract does abi.decode(body, (bool)),
  // so the response body must be raw ABI-encoded bytes, not JSON text.
  const encoded = encodeAbiParameters(parseAbiParameters("bool"), [allowed]);
  const bytes = Buffer.from(encoded.slice(2), "hex");

  console.info("allowlist.verify.result", { requestId: correlationId, cid, wallet, collection, allowed });
  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Request-Id": correlationId },
  });
}