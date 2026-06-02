"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import { useReadContract, useAccount } from "wagmi";
import {
  VASTMINT_FACTORY_ADDRESS,
  VASTMINT_MARKETPLACE_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import {
  VASTMINT_FACTORY_ABI,
  VASTMINT_MARKETPLACE_ABI,
  VASTMINT_NFT_ABI,
} from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";

type Collection = {
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
};

type Listing = {
  listingId: bigint;
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
  createdAt: bigint;
};

type TokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type?: string; value?: string | number }[];
};

function resolveIpfs(uri?: string | null) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  return uri;
}

function parseTokenId(id?: string) {
  try {
    return BigInt(id ?? "0");
  } catch {
    return 0n;
  }
}

export default function NFTDetailPage() {
  const { contractAddress, id } = useParams<{ contractAddress: string; id: string }>();
  const tokenId = parseTokenId(id);
  const normalizedContract = contractAddress?.toLowerCase();
  const { address: connectedAddress } = useAccount();
  const [copied, setCopied] = useState(false);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const { data: allCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const collection = useMemo(() => {
    return ((allCollections as Collection[] | undefined) ?? []).find(
      (item) => item.contractAddress.toLowerCase() === normalizedContract,
    );
  }, [allCollections, normalizedContract]);

  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "totalSupply",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) },
  });

  const { data: tokenURI, isLoading: tokenURILoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "tokenURI",
    args: [tokenId],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) && Boolean(id) },
  });

  const { data: ownerOf, isLoading: ownerLoading, error: ownerError } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "ownerOf",
    args: [tokenId],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) && Boolean(id) },
  });

  const { data: listings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsByContract",
    args: [contractAddress as `0x${string}`],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setMetadata(null);
      setMetadataError(null);

      if (!tokenURI || typeof tokenURI !== "string") return;
      const metadataUrl = resolveIpfs(tokenURI);
      if (!metadataUrl) return;

      try {
        const response = await fetch(metadataUrl);
        if (!response.ok) throw new Error("Unable to load token metadata");
        const data = await response.json();
        if (!cancelled) setMetadata(data as TokenMetadata);
      } catch (err) {
        console.error(err);
        if (!cancelled) setMetadataError("Unable to load token metadata.");
      }
    }

    void loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [tokenURI]);

  const activeListing = ((listings as Listing[] | undefined) ?? []).find(
    (listing) => listing.active && listing.tokenId === tokenId,
  );
  const minted = totalSupply ? Number(totalSupply) : 0;
  const maxSupply = collection ? Number(collection.maxSupply) : undefined;
  const owner = ownerOf as string | undefined;
  const isOwner = connectedAddress && owner ? owner.toLowerCase() === connectedAddress.toLowerCase() : false;
  const shortOwner = owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : null;
  const fallbackName = collection ? `${collection.name} #${id}` : `Token #${id}`;
  const tokenName = metadata?.name ?? fallbackName;
  const tokenDescription = metadata?.description ?? collection?.description ?? "NFT minted on VastMint.";
  const imageUrl = resolveIpfs(metadata?.image) ?? resolveIpfs(collection?.image);

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (ownerError) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">NFT not found or token has not been minted.</p>
          <Link href="/collections" className="mt-4 inline-flex rounded-xl bg-[#077345] px-5 py-3 text-sm font-bold text-white">
            Back to Collections
          </Link>
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
          <Link href="/collections" className="hover:text-zinc-400 transition">Collections</Link>
          {collection && (
            <>
              <span>/</span>
              <Link href={`/collections/${collection.slug}`} className="hover:text-zinc-400 transition">{collection.name}</Link>
            </>
          )}
          <span>/</span>
          <span className="text-zinc-400">#{id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-[#077345]/20 bg-[#0b1f17] aspect-square relative group">
              {imageUrl ? (
                <img src={imageUrl} alt={tokenName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#0d2518] flex items-center justify-center">
                  <span className="text-zinc-700 font-mono text-xs">#{id}</span>
                </div>
              )}
              {activeListing && (
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/40 bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Listed
                  </span>
                </div>
              )}
              {imageUrl && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center hover:bg-black/80 transition">
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" /></svg>
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
                    <a href={`${EXPLORER_URL}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-[#077345] hover:text-emerald-400 transition font-mono text-xs">
                      {contractAddress?.slice(0, 6)}...{contractAddress?.slice(-4)}
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
                  ["Minted", maxSupply ? `${minted.toLocaleString()} / ${maxSupply.toLocaleString()}` : minted.toLocaleString()],
                  ["Collection", collection?.name ?? "Unknown"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-mono text-xs text-zinc-300 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[#077345] uppercase tracking-[0.2em] text-xs font-bold mb-2">{collection?.name ?? "VastMint NFT"}</p>
              <h1 className="text-5xl sm:text-6xl font-black leading-none">{tokenName}</h1>
              <p className="text-zinc-500 mt-4 leading-relaxed text-sm">{tokenDescription}</p>
              {metadataError && <p className="text-red-400 text-xs mt-3">{metadataError}</p>}
              {tokenURILoading && <p className="text-zinc-600 text-xs mt-3">Loading token metadata...</p>}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#077345]/20 border border-[#077345]/30 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#077345]"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1a6 6 0 00-6 6h12a6 6 0 00-6-6z" /></svg>
              </div>
              <div>
                <p className="text-zinc-600 text-xs">Owned by</p>
                {ownerLoading ? (
                  <span className="inline-block w-24 h-4 bg-zinc-800 rounded animate-pulse mt-1" />
                ) : owner ? (
                  <a href={`${EXPLORER_URL}/address/${owner}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-zinc-300 hover:text-emerald-400 transition">
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
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Active Listing</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-emerald-400">{formatEther(activeListing.price)}</span>
                    <span className="text-zinc-600 text-sm">RITUAL</span>
                  </div>
                  <p className="text-zinc-600 text-xs mt-2">Seller {activeListing.seller.slice(0, 6)}...{activeListing.seller.slice(-4)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Listing Status</p>
                  <span className="text-2xl font-black text-zinc-400">Not Listed</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {collection && (
                  <Link href={`/collections/${collection.slug}/mint`} className="w-full flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-4 text-sm font-bold text-white">
                    Mint From Collection
                  </Link>
                )}
                <Link href="/marketplace" className="w-full flex items-center justify-center rounded-xl border border-[#077345]/30 hover:bg-[#077345]/10 transition px-4 py-4 text-sm font-bold text-emerald-400">
                  {activeListing ? "View Marketplace" : "Browse Marketplace"}
                </Link>
                <a href={`${EXPLORER_URL}/token/${contractAddress}?a=${id}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 transition px-4 py-4 text-sm font-bold text-zinc-400 hover:text-zinc-200">
                  View on Explorer
                </a>
              </div>
            </div>

            {metadata?.attributes && metadata.attributes.length > 0 && (
              <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] p-5">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Attributes</p>
                <div className="grid grid-cols-2 gap-3">
                  {metadata.attributes.map((attribute, index) => (
                    <div key={`${attribute.trait_type}-${index}`} className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-center">
                      <p className="text-zinc-600 text-xs">{attribute.trait_type ?? "Trait"}</p>
                      <p className="text-white font-bold text-sm mt-1">{attribute.value ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
