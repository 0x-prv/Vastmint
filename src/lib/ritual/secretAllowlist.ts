import { decodeEventLog, parseAbiItem, type Log } from "viem";

export const SECRET_ALLOWLIST_ABI = [
  { type: "function", name: "collectionAllowlist", stateMutability: "view", inputs: [{ name: "collection", type: "address" }], outputs: [{ type: "tuple", components: [{ name: "configured", type: "bool" }, { name: "secretOwner", type: "address" }, { name: "secretsHash", type: "bytes32" }, { name: "allowlistCid", type: "string" }, { name: "endpointBase", type: "string" }, { name: "active", type: "bool" }, { name: "validitySeconds", type: "uint64" }, { name: "version", type: "uint64" }, { name: "encryptedSecrets", type: "bytes[]" }, { name: "secretSignatures", type: "bytes[]" }] }] },
  { type: "function", name: "getAllowlistStatus", stateMutability: "view", inputs: [{ name: "collection", type: "address" }, { name: "wallet", type: "address" }], outputs: [{ type: "tuple", components: [{ name: "configured", type: "bool" }, { name: "pending", type: "bool" }, { name: "resolved", type: "bool" }, { name: "allowed", type: "bool" }, { name: "checkedAt", type: "uint64" }, { name: "expiresAt", type: "uint64" }, { name: "currentlyValid", type: "bool" }, { name: "requestHash", type: "bytes32" }, { name: "configVersion", type: "uint64" }] }] },
  { type: "function", name: "requestVerification", stateMutability: "nonpayable", inputs: [{ name: "collection", type: "address" }, { name: "executor", type: "address" }], outputs: [{ name: "allowed", type: "bool" }] },
  { type: "event", name: "AllowlistCheckSubmitted", inputs: [{ indexed: true, name: "requestHash", type: "bytes32" }, { indexed: true, name: "collection", type: "address" }, { indexed: true, name: "wallet", type: "address" }, { indexed: false, name: "configVersion", type: "uint64" }, { indexed: false, name: "submittedAt", type: "uint64" }] },
  { type: "event", name: "AllowlistCheckResolved", inputs: [{ indexed: true, name: "requestHash", type: "bytes32" }, { indexed: true, name: "collection", type: "address" }, { indexed: true, name: "wallet", type: "address" }, { indexed: false, name: "allowed", type: "bool" }, { indexed: false, name: "httpStatus", type: "uint16" }, { indexed: false, name: "checkedAt", type: "uint64" }, { indexed: false, name: "expiresAt", type: "uint64" }] },
  { type: "event", name: "AllowlistCheckFailed", inputs: [{ indexed: true, name: "requestHash", type: "bytes32" }, { indexed: true, name: "collection", type: "address" }, { indexed: true, name: "wallet", type: "address" }, { indexed: false, name: "reason", type: "string" }, { indexed: false, name: "httpStatus", type: "uint16" }] },
] as const;

export const RITUAL_WALLET_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lockUntilOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const TEE_SERVICE_REGISTRY = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as const;
export const RITUAL_WALLET = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const;

export const TEE_SERVICE_REGISTRY_ABI = [{ type: "function", name: "getServicesByCapability", stateMutability: "view", inputs: [{ name: "capability", type: "uint8" }, { name: "checkValidity", type: "bool" }], outputs: [{ type: "tuple[]", components: [{ name: "node", type: "tuple", components: [{ name: "paymentAddress", type: "address" }, { name: "teeAddress", type: "address" }, { name: "teeType", type: "uint8" }, { name: "publicKey", type: "bytes" }, { name: "endpoint", type: "string" }, { name: "certPubKeyHash", type: "bytes32" }, { name: "capability", type: "uint8" }] }, { name: "isValid", type: "bool" }, { name: "workloadId", type: "bytes32" }] }] }] as const;

export const allowlistResolvedEvent = parseAbiItem("event AllowlistCheckResolved(bytes32 indexed requestHash,address indexed collection,address indexed wallet,bool allowed,uint16 httpStatus,uint64 checkedAt,uint64 expiresAt)");
export const allowlistFailedEvent = parseAbiItem("event AllowlistCheckFailed(bytes32 indexed requestHash,address indexed collection,address indexed wallet,string reason,uint16 httpStatus)");

export type ParsedAllowlistEvent = { kind: "resolved"; allowed: boolean; httpStatus: number } | { kind: "failed"; reason: string; httpStatus: number } | null;

export function parseAllowlistEvent(logs: Log[]): ParsedAllowlistEvent {
  for (const log of logs) {
    if (log.topics[0] !== allowlistResolvedEvent.signature && log.topics[0] !== allowlistFailedEvent.signature) continue;
    try {
      const decoded = decodeEventLog({ abi: SECRET_ALLOWLIST_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === "AllowlistCheckResolved") {
        return { kind: "resolved", allowed: Boolean(decoded.args.allowed), httpStatus: Number(decoded.args.httpStatus) };
      }
      if (decoded.eventName === "AllowlistCheckFailed") {
        return { kind: "failed", reason: decoded.args.reason, httpStatus: Number(decoded.args.httpStatus) };
      }
    } catch {
      continue;
    }
  }
  return null;
}
