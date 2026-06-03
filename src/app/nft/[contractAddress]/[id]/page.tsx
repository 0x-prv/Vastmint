"use client";

import { getLogsInSafeChunks } from "@/lib/blockchain/listings";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { parseAbiItem } from "viem";
import {
  VASTMINT_FACTORY_ADDRESS,
  VASTMINT_MARKETPLACE_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import {
  VASTMINT_NFT_ABI,
  VASTMINT_FACTORY_ABI,
  VASTMINT_MARKETPLACE_ABI,
} from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

async function fetchMetadata(uri: string): Promise<{
  name: string;
  description: string;
  image: string;
}> {
  try {
    const url = resolveIpfs(uri);
    if (!url) return { name: "", description: "", image: "" };
    const res = await fetch(url);
    const json = await res.json();
    return {
      name: json.name ?? "",
      description: json.description ?? "",
      image: resolveIpfs(json.image ?? ""),
    };
  } catch {
    return { name: "", description: "", image: "" };
  }
}

interface CollectionInfo {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
  createdAt: bigint;
  slug: string;
}

interface ActivityItem {
  event: string;
  from: string;
  to: string;
  time: string;
  txHash: string;
}

export default function NFTDetailPage() {
  const { contractAddress, id } = useParams<{ contractAddress: string; id: string }>();

  // #23 fix — invalid token ID shows error instead of silently becoming 0
  const tokenId = (() => {
    try {
      const parsed = BigInt(id ?? "");
      if (parsed < 0n) throw new Error("negative");
      return parsed;
    } catch {
      return null;
    }
  })();

  const { address: connectedAddress } = useAccount();
  // #14 fix — explicitly scoped to Ritual chain
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [copied, setCopied] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenImage, setTokenImage] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
 const [buyState, setBuyState] = useState<
  "idle" | "switching" | "pending" | "confirming" | "success" | "error"
  >("idle");
  const [buyTxHash, setBuyTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [buyError, setBuyError] = useState<string | null>(null);

  const { isSuccess: buyConfirmed } = useWaitForTransactionReceipt({
    hash: buyTxHash,
    query: { enabled: !!buyTxHash && buyState === "confirming" },
  });

  useEffect(() => {
    if (buyConfirmed && buyState === "confirming") {
      setBuyState("success");
    }
  }, [buyConfirmed, buyState]);

  async function handleBuy() {
    if (!activeListing || !connectedAddress) return;
    setBuyError(null);
    try {
      if (chainId !== RITUAL_CHAIN_ID) {
        setBuyState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }
      setBuyState("pending");
      const tx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "buyNFT",
        args: [activeListing.listingId],
        value: activeListing.price,
      });
      setBuyTxHash(tx);
      setBuyState("confirming");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Buy failed";
      setBuyError(
        msg.includes("rejected") || msg.includes("denied")
          ? "Transaction rejected."
          : "Buy failed. Try again."
      );
      setBuyState("error");
    }
  }

  const { data: allCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const collectionInfo = (allCollections as CollectionInfo[] | undefined)?.find(
    (c) => c.contractAddress.toLowerCase() === contractAddress?.toLowerCase()
  );

  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "totalSupply",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) },
  });

  const { data: tokenURIData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "tokenURI",
    args: [tokenId ?? 0n],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) && tokenId !== null },
  });

  const { data: ownerOf, isLoading: ownerLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "ownerOf",
    args: [tokenId ?? 0n],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) && tokenId !== null },
  });

  const { data: contractListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsByContract",
    args: [contractAddress as `0x${string}`],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) },
  });

  const activeListing = contractListings?.find(
    (l) => l.active && l.tokenId === (tokenId ?? 0n)
  );

  useEffect(() => {
    if (!tokenURIData) return;
    setMetaLoading(true);
    fetchMetadata(tokenURIData as string).then(({ name, description, image }) => {
      setTokenName(name);
      setTokenDescription(description);
      setTokenImage(image);
      setMetaLoading(false);
    });
  }, [tokenURIData]);

  useEffect(() => {
    if (!publicClient || !contractAddress || !id || tokenId === null) return;
    setActivityLoading(true);

    getLogsInSafeChunks(publicClient, {
      address: contractAddress as `0x${string}`,
      event: parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
      ),
      args: { tokenId },
    })
      .then((logs: { args: { from: unknown; to: unknown; tokenId: unknown }; transactionHash?: string }[]) => {
        const items: ActivityItem[] = logs
          .slice()
          .reverse()
          .slice(0, 10)
          .map((log: { args: { from: unknown; to: unknown }; transactionHash?: string }) => {
            const from = log.args.from as string;
            const to = log.args.to as string;
            const isMint = from === "0x0000000000000000000000000000000000000000";
            return {
              event: isMint ? "Mint" : "Transfer",
              from: isMint ? "—" : `${from.slice(0, 6)}…${from.slice(-4)}`,
              to: `${to.slice(0, 6)}…${to.slice(-4)}`,
              time: "On-chain",
              txHash: log.transactionHash ?? "",
            };
          });
        setActivity(items);
        setActivityLoading(false);
      })
      .catch(() => setActivityLoading(false));
  }, [publicClient, contractAddress, id, tokenId]);

  const minted = totalSupply ? Number(totalSupply) : 0;
  const maxSupply = collectionInfo
    ? Number(collectionInfo.maxSupply).toLocaleString()
    : "—";
  const owner = ownerOf as string | undefined;
  const shortOwner = owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : null;
  const isOwner =
    connectedAddress && owner
      ? owner.toLowerCase() === connectedAddress.toLowerCase()
      : false;

  const mintPrice = collectionInfo
    ? collectionInfo.mintPrice === 0n
      ? "Free"
      : `${Number(collectionInfo.mintPrice) / 1e18} RITUAL`
    : "—";

  const collectionImageUrl = collectionInfo ? resolveIpfs(collectionInfo.image) : "";
  const displayImage = tokenImage || collectionImageUrl;
  const displayName =
    tokenName || (collectionInfo ? `${collectionInfo.name} #${id}` : `Token #${id}`);
  const displayDescription = tokenDescription || collectionInfo?.description || "";

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // #23 — Invalid token ID guard
  if (tokenId === null) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Invalid token ID.</p>
          <a
            href="/collections"
            className="mt-4 inline-flex rounded-xl bg-[#077345] px-5 py-3 text-sm font-bold text-white"
          >
            Back to Collections
          </a>
        </div>
      </main>
    );
  }

  if (!allCollections) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <svg className="animate-spin w-5 h-5 text-[#077345]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading collection…</span>
        </div>
      </main>
    );
  }

  if (!collectionInfo) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Collection not found.</p>
          <a
            href="/collections"
            className="mt-4 inline-flex rounded-xl bg-[#077345] px-5 py-3 text-sm font-bold text-white"
          >
            Back to Collections
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#077345]/6 rounded-full blur-[160px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
          <a href="/collections" className="hover:text-zinc-400 transition">Collections</a>
          <span>/</span>
          <a href={`/collections/${collectionInfo.slug}`} className="hover:text-zinc-400 transition">
            {collectionInfo.name}
          </a>
          <span>/</span>
          <span className="text-zinc-400">#{id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-[#077345]/20 bg-[#0b1f17] aspect-square relative group flex items-center justify-center">
              {metaLoading ? (
                <div className="w-full h-full bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] animate-pulse" />
              ) : displayImage ? (
                <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#077345" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}
              {displayImage && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={displayImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center hover:bg-black/80 transition"
                  >
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                    </svg>
                  </a>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] p-5">
              <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Details</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Contract</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${EXPLORER_URL}/address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#077345] hover:text-emerald-400 transition font-mono text-xs"
                    >
                      {contractAddress?.slice(0, 6)}…{contractAddress?.slice(-4)}
                    </a>
                    <button onClick={copyAddress} className="text-zinc-600 hover:text-zinc-300 transition" title="Copy address">
                      {copied ? "✓" : "⧉"}
                    </button>
                  </div>
                </div>
                {[
                  ["Token ID", `#${id}`],
                  ["Token Standard", "ERC-721"],
                  ["Network", "Ritual Testnet"],
                  ["Chain ID", "1979"],
                  ["Total Minted", `${minted.toLocaleString()} / ${maxSupply}`],
                  ["Symbol", collectionInfo.symbol],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-mono text-xs text-zinc-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[#077345] uppercase tracking-[0.2em] text-xs font-bold mb-2">
                {collectionInfo.name}
              </p>
              <h1 className="text-5xl sm:text-6xl font-black leading-none">
                {metaLoading ? (
                  <span className="inline-block w-48 h-12 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  displayName
                )}
              </h1>
              {displayDescription && (
                <p className="text-zinc-500 mt-4 leading-relaxed text-sm">{displayDescription}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#077345]/20 border border-[#077345]/30 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#077345]">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1a6 6 0 00-6 6h12a6 6 0 00-6-6z" />
                </svg>
              </div>
              <div>
                <p className="text-zinc-600 text-xs">Owned by</p>
                {ownerLoading ? (
                  <span className="inline-block w-24 h-4 bg-zinc-800 rounded animate-pulse mt-1" />
                ) : owner ? (
                  <a
                    href={`${EXPLORER_URL}/address/${owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-zinc-300 hover:text-emerald-400 transition"
                  >
                    {isOwner ? "You" : shortOwner}
                  </a>
                ) : (
                  <span className="text-sm font-bold text-zinc-500">—</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-6 space-y-5">
              {activeListing ? (
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Listed Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-emerald-400">
                      {(Number(activeListing.price) / 1e18).toFixed(4)}
                    </span>
                    <span className="text-zinc-400 text-sm">RITUAL</span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Mint Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-emerald-400">{mintPrice}</span>
                    {mintPrice !== "Free" && (
                      <span className="text-zinc-600 text-sm">RITUAL</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {activeListing && !isOwner && buyState !== "success" && (
                  <>
                    {buyError && (
                      <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
                        <p className="text-red-400 text-sm">{buyError}</p>
                      </div>
                    )}
                    <button
                      onClick={handleBuy}
                      disabled={buyState !== "idle" && buyState !== "error"}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold transition ${
                        buyState !== "idle" && buyState !== "error"
                          ? "bg-[#077345]/60 text-white/70 cursor-not-allowed"
                          : "bg-[#077345] hover:bg-[#066039] text-white"
                      }`}
                    >
                      {(buyState === "pending" || buyState === "confirming" || buyState === "switching") && (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      )}
                      {buyState === "switching"
                        ? "Switching Network..."
                        : buyState === "pending"
                        ? "Confirm in Wallet..."
                        : buyState === "confirming"
                        ? "Confirming..."
                        : `Buy for ${(Number(activeListing.price) / 1e18).toFixed(4)} RITUAL`}
                    </button>
                  </>
                )}

                {activeListing && isOwner && (
                  <div className="rounded-xl border border-emerald-700/20 bg-emerald-900/10 px-4 py-3">
                    <p className="text-emerald-400 text-sm text-center">
                      You own this NFT — listed for sale
                    </p>
                  </div>
                )}

                {buyState === "success" && (
                  <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/20 px-4 py-3 text-center">
                    <p className="text-emerald-400 font-bold">Purchase successful! 🎉</p>
                  </div>
                )}

                {!activeListing && (
                  <a
                    href={`/collections/${collectionInfo.slug}/mint`}
                    className="w-full flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-4 text-sm font-bold text-white"
                  >
                    Mint from Collection
                  </a>
                )}

                <a
                  href={`${EXPLORER_URL}/token/${contractAddress}?a=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 transition px-4 py-4 text-sm font-bold text-zinc-400 hover:text-zinc-200"
                >
                  View on Explorer
                </a>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Supply", maxSupply],
                ["Minted", minted.toLocaleString()],
                ["Listed", activeListing ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-[#0b1f17] border border-[#077345]/10 px-4 py-4 text-center"
                >
                  <p className="text-zinc-600 text-xs">{label}</p>
                  <p className="font-black mt-1 text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#077345]/10">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Activity</p>
              </div>
              {activityLoading ? (
                <div className="px-5 py-8 flex items-center justify-center gap-3 text-zinc-600">
                  <svg className="animate-spin w-4 h-4 text-[#077345]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-xs">Loading activity…</span>
                </div>
              ) : activity.length === 0 ? (
                <div className="px-5 py-8 text-center text-zinc-600 text-xs">
                  No activity found for this token.
                </div>
              ) : (
                <div className="divide-y divide-[#077345]/10">
                  {activity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full border border-emerald-700/30 bg-emerald-900/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                          {item.event}
                        </span>
                        <span className="text-zinc-500 text-xs">
                          To <span className="font-mono text-zinc-300">{item.to}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        {item.txHash ? (
                          <a
                            href={`${EXPLORER_URL}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#077345] hover:text-emerald-400 text-xs transition"
                          >
                            View Tx ↗
                          </a>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          <a
              href={`${EXPLORER_URL}/token/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/5 hover:bg-white/5 transition px-4 py-3 text-xs font-bold text-zinc-600 hover:text-zinc-400"
            >
              View collection on Ritual Explorer
              <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}