export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
export const EXPLORER_URL = "https://explorer.ritualfoundation.org";
export const MAX_FILE_SIZE_MB = 10;
export const MARKETPLACE_POLL_INTERVAL_MS = 10_000;

export function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return ${"$"}{IPFS_GATEWAY}{uri.slice(7)};
  return uri;
}
