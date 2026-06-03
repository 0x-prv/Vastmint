export function shortAddress(address: string): string {
  if (!address) return "";
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function formatRitual(wei: bigint): string {
  return (Number(wei) / 1e18).toString();
}