"use client";

import { getLogsInSafeChunks } from "@/lib/blockchain/logs";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
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
  RITUAL_ORACLE_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import {
  VASTMINT_NFT_ABI,
  VASTMINT_FACTORY_ABI,
  VASTMINT_MARKETPLACE_ABI,
  VASTMINT_ORACLE_ABI,
} from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

// ✅ Fixed — kasama na ang attributes
type TokenAttribute = {
  trait_type: string;
  value: string | number;
};

async function fetchMetadata(uri: string): Promise<{
  name: string;
  description: string;
  image: string;
  attributes: TokenAttribute[];
}> {
  try {
    const url = resolveIpfs(uri);
    if (!url) return { name: "", description: "", image: "", attributes: [] };
    const res = await fetch(url);
    const json = await res.json();
    return {
      name: json.name ?? "",
      description: json.description ?? "",
      image: resolveIpfs(json.image ?? ""),
      attributes: Array.isArray(json.attributes) ? json.attributes : [],
    };
  } catch {
    return { name: "", description: "", image: "", attributes: [] };
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

interface MarketplaceListing {
  listingId: bigint;
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
  createdAt: bigint;
}

function normalizeMarketplaceListing(listing: unknown): MarketplaceListing | null {
  if (!listing) return null;

  if (Array.isArray(listing)) {
    const [listingId, seller, nftContract, tokenId, price, active, createdAt] =
      listing;
    return { listingId, seller, nftContract, tokenId, price, active, createdAt };
  }

  return listing as MarketplaceListing;
}

export default function NFTDetailPage() {
  const { contractAddress, id } = useParams<{ contractAddress: string; id: string }>();

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
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [copied, setCopied] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenImage, setTokenImage] = useState("");
  const [tokenAttributes, setTokenAttributes] = useState<TokenAttribute[]>([]); // ✅ Added
  const [metaLoading, setMetaLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [buyState, setBuyState] = useState<
    "idle" | "switching" | "pending" | "confirming" | "success" | "error"
  >("idle");
  const [buyTxHash, setBuyTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState<string>("");

const { data: oracleDescription } = useReadContract({
  address: RITUAL_ORACLE_ADDRESS as `0x${string}`,
  abi: VASTMINT_ORACLE_ABI,
  functionName: "getDescription",
  args: [contractAddress as `0x${string}`, tokenId ?? 0n],
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: Boolean(contractAddress) && tokenId !== null },
});

useEffect(() => {
  if (oracleDescription && typeof oracleDescription === "string" && oracleDescription.trim()) {
    setAiDescription(oracleDescription);
  }
}, [oracleDescription]);

  const { isSuccess: buyConfirmed } = useWaitForTransactionReceipt({
    hash: buyTxHash,
    query: { enabled: !!buyTxHash && buyState === "confirming" },
  });

  useEffect(() => {
    if (buyConfirmed && buyState === "confirming") {
      queueMicrotask(() => setBuyState("success"));
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

  const hasValidListingParams = Boolean(contractAddress) && tokenId !== null;

  const {
    data: directListingId,
    isError: directListingIdError,
  } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "tokenToListingId",
    args: [contractAddress as `0x${string}`, tokenId ?? 0n],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: hasValidListingParams },
  });

  const shouldReadDirectListing =
    hasValidListingParams && typeof directListingId === "bigint" && directListingId > 0n;

  const {
    data: directListingData,
    isError: directListingError,
  } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "listings",
    args: [directListingId ?? 0n],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: shouldReadDirectListing },
  });

  const shouldUseListingFallback =
    hasValidListingParams &&
    (directListingIdError || directListingId === 0n || directListingError);

  const { data: contractListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsByContract",
    args: [contractAddress as `0x${string}`],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: shouldUseListingFallback },
  });

  const directActiveListing = useMemo(() => {
    const listing = normalizeMarketplaceListing(directListingData);
    if (!listing || !listing.active || tokenId === null) return undefined;
    if (listing.tokenId !== tokenId) return undefined;
    if (listing.nftContract.toLowerCase() !== contractAddress?.toLowerCase()) {
      return undefined;
    }
    return listing;
  }, [contractAddress, directListingData, tokenId]);

  const fallbackActiveListing = contractListings?.find(
    (l) => l.active && l.tokenId === (tokenId ?? 0n)
  );

  const activeListing = directActiveListing ?? fallbackActiveListing;

  // ✅ Fixed — kasama na ang attributes sa fetch
  useEffect(() => {
    if (!tokenURIData) return;
    let cancelled = false;
    fetchMetadata(tokenURIData as string).then(({ name, description, image, attributes }) => {
      if (cancelled) return;
      setTokenName(name);
      setTokenDescription(description);
      setTokenImage(image);
      setTokenAttributes(attributes);
      setMetaLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenURIData]);

  useEffect(() => {
    if (!publicClient || !contractAddress || !id || tokenId === null) return;

    getLogsInSafeChunks(publicClient, {
      address: contractAddress as `0x${string}`,
      event: parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
      ),
      args: { tokenId },
    })
      .then((logs) => {
        const items: ActivityItem[] = logs
          .slice()
          .reverse()
          .slice(0, 10)
          .map((log) => {
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

  if (tokenId === null) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#4a6741] text-sm">Invalid token ID.</p>
          <Link href="/collections" className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] px-5 py-3 text-sm font-bold text-[#f5f0e8]">
            Back to Collections
          </Link>
        </div>
      </main>
    );
  }

  if (!allCollections) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#4a6741]">
          <svg className="animate-spin w-5 h-5 text-[#1a4a2e]" viewBox="0 0 24 24" fill="none">
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
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#4a6741] text-sm">Collection not found.</p>
          <Link href="/collections" className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] px-5 py-3 text-sm font-bold text-[#f5f0e8]">
            Back to Collections
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#1a4a2e]/5 rounded-full blur-[160px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-[#7a9e7a] mb-8">
          <Link href="/collections" className="hover:text-[#4a6741] transition">Collections</Link>
          <span>/</span>
          <Link href={`/collections/${collectionInfo.slug}`} className="hover:text-[#4a6741] transition">
            {collectionInfo.name}
          </Link>
          <span>/</span>
          <span className="text-[#4a6741]">#{id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-[#1a4a2e]/20 bg-[#ede8df] aspect-square relative group flex items-center justify-center">
              {metaLoading ? (
                <div className="w-full h-full bg-gradient-to-br from-[#e8e3d8] via-[#e0dbd0] to-[#e0dbd0] animate-pulse" />
              ) : displayImage ? (
                <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#e8e3d8] via-[#e0dbd0] to-[#e0dbd0] flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1">
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
                    className="w-9 h-9 rounded-xl bg-[#e0dbd0]/80 border border-[#1a4a2e]/20 flex items-center justify-center hover:bg-[#e0dbd0]/80 transition"
                  >
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                    </svg>
                  </a>
                </div>
              )}
            </div>

            {/* ✅ Traits/Attributes Section */}
            {!metaLoading && tokenAttributes.length > 0 && (
              <div className="rounded-2xl border border-[#1a4a2e]/15 bg-[#ede8df] p-5">
                <p className="text-xs font-bold text-[#7a9e7a] uppercase tracking-widest mb-4">Traits</p>
                <div className="grid grid-cols-2 gap-2">
                  {tokenAttributes.map((attr, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/50 px-3 py-2.5 text-center"
                    >
                      <p className="text-[#7a9e7a] text-[10px] uppercase tracking-wider truncate">
                        {attr.trait_type}
                      </p>
                      <p className="text-[#1a2e1a] font-bold text-xs mt-0.5 truncate">
                        {String(attr.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[#1a4a2e]/15 bg-[#ede8df] p-5">
              <p className="text-xs font-bold text-[#7a9e7a] uppercase tracking-widest mb-4">Details</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#4a6741]">Contract</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${EXPLORER_URL}/address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1a4a2e] hover:text-[#1a4a2e] transition font-mono text-xs"
                    >
                      {contractAddress?.slice(0, 6)}…{contractAddress?.slice(-4)}
                    </a>
                    <button onClick={copyAddress} className="text-[#7a9e7a] hover:text-[#1a2e1a] transition" title="Copy address">
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
                    <span className="text-[#4a6741]">{label}</span>
                    <span className="font-mono text-xs text-[#1a2e1a]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[#1a4a2e] uppercase tracking-[0.2em] text-xs font-bold mb-2">
                {collectionInfo.name}
              </p>
              <h1 className="text-5xl sm:text-6xl font-black leading-none">
                {metaLoading ? (
                  <span className="inline-block w-48 h-12 bg-[#e0dbd0] rounded animate-pulse" />
                ) : (
                  displayName
                )}
              </h1>
              {displayDescription && (
                <p className="text-[#4a6741] mt-4 leading-relaxed text-sm">{displayDescription}</p>
              )}
            </div>
            {aiDescription && (
  <div className="mt-4 rounded-xl border border-[#1a4a2e]/20 bg-[#1a4a2e]/5 px-4 py-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a4a2e]/60">
        🤖 AI Generated Lore
      </span>
      <span className="text-[10px] text-[#7a9e7a] border border-[#1a4a2e]/20 rounded-full px-2 py-0.5">
        Powered by Ritual
      </span>
    </div>
    <p className="text-[#1a2e1a] text-sm leading-relaxed italic">
      {aiDescription}
    </p>
  </div>
)}

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1a4a2e]/20 border border-[#1a4a2e]/30 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1a4a2e]">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1a6 6 0 00-6 6h12a6 6 0 00-6-6z" />
                </svg>
              </div>
              <div>
                <p className="text-[#7a9e7a] text-xs">Owned by</p>
                {ownerLoading ? (
                  <span className="inline-block w-24 h-4 bg-[#e0dbd0] rounded animate-pulse mt-1" />
                ) : owner ? (
                  <a
                    href={`${EXPLORER_URL}/address/${owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-[#1a2e1a] hover:text-[#1a4a2e] transition"
                  >
                    {isOwner ? "You" : shortOwner}
                  </a>
                ) : (
                  <span className="text-sm font-bold text-[#4a6741]">—</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-6 space-y-5">
              {activeListing ? (
                <div>
                  <p className="text-[#7a9e7a] text-xs uppercase tracking-widest mb-1">Listed Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-[#1a4a2e]">
                      {(Number(activeListing.price) / 1e18).toFixed(4)}
                    </span>
                    <span className="text-[#4a6741] text-sm">RITUAL</span>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[#7a9e7a] text-xs uppercase tracking-widest mb-1">Mint Price</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-[#1a4a2e]">{mintPrice}</span>
                    {mintPrice !== "Free" && (
                      <span className="text-[#7a9e7a] text-sm">RITUAL</span>
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
                          ? "bg-[#1a4a2e]/50 text-[#f5f0e8]/70 cursor-not-allowed"
                          : "bg-[#1a4a2e] hover:bg-[#143d24] text-[#f5f0e8]"
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
                  <div className="rounded-xl border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-4 py-3">
                    <p className="text-[#1a4a2e] text-sm text-center">
                      You own this NFT — listed for sale
                    </p>
                  </div>
                )}

                {buyState === "success" && (
                  <div className="rounded-xl border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-4 py-3 text-center">
                    <p className="text-[#1a4a2e] font-bold">Purchase successful! 🎉</p>
                  </div>
                )}

                {!activeListing && (
                  <Link
                    href={`/collections/${collectionInfo.slug}/mint`}
                    className="w-full flex items-center justify-center rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-4 py-4 text-sm font-bold text-[#f5f0e8]"
                  >
                    Mint from Collection
                  </Link>
                )}

                <a
                 href={`${EXPLORER_URL}/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#1a4a2e]/20 hover:bg-[#1a4a2e]/10 transition px-4 py-4 text-sm font-bold text-[#4a6741] hover:text-[#1a2e1a]"
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
                <div key={label} className="rounded-xl bg-[#ede8df] border border-[#1a4a2e]/10 px-4 py-4 text-center">
                  <p className="text-[#7a9e7a] text-xs">{label}</p>
                  <p className="font-black mt-1 text-[#1a2e1a]">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#1a4a2e]/15 bg-[#ede8df] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1a4a2e]/10">
                <p className="text-xs font-bold text-[#7a9e7a] uppercase tracking-widest">Activity</p>
              </div>
              {activityLoading ? (
                <div className="px-5 py-8 flex items-center justify-center gap-3 text-[#7a9e7a]">
                  <svg className="animate-spin w-4 h-4 text-[#1a4a2e]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-xs">Loading activity…</span>
                </div>
              ) : activity.length === 0 ? (
                <div className="px-5 py-8 text-center text-[#7a9e7a] text-xs">
                  No activity found for this token.
                </div>
              ) : (
                <div className="divide-y divide-[#1a4a2e]/10">
                  {activity.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#1a4a2e]/5 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-2.5 py-0.5 text-xs font-bold text-[#1a4a2e]">
                          {item.event}
                        </span>
                        <span className="text-[#4a6741] text-xs">
                          To <span className="font-mono text-[#1a2e1a]">{item.to}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        {item.txHash ? (
                          <a
                            href={`${EXPLORER_URL}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1a4a2e] hover:text-[#1a4a2e] text-xs transition"
                          >
                            View Tx ↗
                          </a>
                        ) : (
                          <span className="text-[#7a9e7a] text-xs">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <a
              href={`${EXPLORER_URL}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#1a4a2e]/15 hover:bg-[#1a4a2e]/10 transition px-4 py-3 text-xs font-bold text-[#7a9e7a] hover:text-[#4a6741]"
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