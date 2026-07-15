// src/lib/passkey.ts
// Phase 1 frontend helper — creates/authenticates a WebAuthn passkey and
// extracts the raw P-256 public key coordinates needed by
// VastMintPasskeyAuth.registerPasskey() / derivePasskeyAddress().
//
// Requires: a P-256-capable authenticator (built into modern browsers/phones).
// No extra npm package needed — this uses the native navigator.credentials API.

export interface PasskeyPubKey {
  pubKeyX: `0x${string}`;
  pubKeyY: `0x${string}`;
}

/**
 * Create a new passkey for the connecting user (e.g. shown as an alternative
 * to the RainbowKit "Connect Wallet" button).
 */
export async function createPasskey(username: string): Promise<PasskeyPubKey> {
  const challenge = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer;

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "VastMint" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // -7 = ES256 (P-256)
      authenticatorSelection: { userVerification: "required" },
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAttestationResponse;
  const attestationObject = response.attestationObject;

  // The raw P-256 X/Y coordinates live inside the CBOR-encoded attestationObject's
  // authData -> COSE public key. Parsing CBOR/COSE by hand is out of scope here —
  // use a small helper lib (e.g. `cbor-x` or `@simplewebauthn/browser`'s
  // parseAuthenticatorData) to pull out coordinates 32/33 (x) and 55/56 (y) of
  // the COSE key map. Once parsed:
  const { pubKeyX, pubKeyY } = parseCoseP256PublicKey(attestationObject);

  return { pubKeyX, pubKeyY };
}

/**
 * Sign a message with an existing passkey — used for mint-auth checks and
 * for producing the (r, s) pair VastMintPasskeyAuth.verifyPasskeySignature() expects.
 */
export async function signWithPasskey(
  credentialId: BufferSource,
  messageHash: ArrayBuffer
): Promise<{ r: `0x${string}`; s: `0x${string}` }> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: messageHash,
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  const response = assertion.response as AuthenticatorAssertionResponse;
  // response.signature is DER-encoded ECDSA (r, s) — decode to raw 32-byte r/s
  return decodeDerEcdsaSignature(response.signature);
}

// --- Helpers you'll wire up with a small CBOR/DER lib ---
// Recommended: npm install @simplewebauthn/browser cbor-x
declare function parseCoseP256PublicKey(
  attestationObject: ArrayBuffer
): { pubKeyX: `0x${string}`; pubKeyY: `0x${string}` };

declare function decodeDerEcdsaSignature(
  sig: ArrayBuffer
): { r: `0x${string}`; s: `0x${string}` };