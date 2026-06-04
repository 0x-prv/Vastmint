"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useAccount,
  useWriteContract,
  useChainId,
  useSwitchChain,
  usePublicClient,
} from "wagmi";
import { useState, useEffect } from "react";
import {
  VASTMINT_FACTORY_ADDRESS,
  VASTMINT_MARKETPLACE_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import {
  VASTMINT_FACTORY_ABI,
  VASTMINT_NFT_ABI,
  VASTMINT_MARKETPLACE_ABI,
} from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

function resolveIpfs(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

// Cache para hindi paulit-ulit mag-fetch ng same metadata
const metadataCache = new Map<string, TokenMeta>();

type TokenMeta = {
  name: string;
  image: string | null;
};

async function fetchTokenMeta(tokenURI: string): Promise<TokenMeta> {
  if (metadataCache.has(tokenURI)) return metadataCache.get(tokenURI)!;
  try {
    const url = resolveIpfs(tokenURI) ?? tokenURI;
    const res = await fetch(url);
    const json = await res.json();
    const meta: TokenMeta = {
      name: json.name ?? "",
      image: resolveIpfs(json.image ?? null),
    };
    metadataCache.set(tokenURI, meta);
    return meta;
  } catch {
    return { name: "", image: null };
  }
}

type Collection = {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
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

type Filter = "all" | "listed" | "cheapest";

// Component para sa individual NFT card — nag-fe-fetch ng sariling tokenURI + metadata
function NFTCard({
  collection,
  tokenId,
  listing,
  address,
  buying,
  onBuy,
  onCancelSuccess,
}: {
  collection: Collection;
  tokenId: number;
  listing?: Listing;
  address?: string;
  buying: bigint | null;
  onBuy: (listingId: bigint, price: bigint) => void;
  onCancelSuccess: () => void;
}) {
  const [meta, setMeta] = useState<TokenMeta | null>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });
  const [cancelling, setCancelling] = useState(false);

  const { data: tokenURIData } = useReadContract({
    address: collection.contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
    chainId: RITUAL_CHAIN_ID,
  });

  useEffect(() => {
    if (!tokenURIData) return;
    let cancelled = false;
    fetchTokenMeta(tokenURIData as string).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => { cancelled = true; };
  }, [tokenURIData]);

  const isListed = !!listing;
  const isMine = listing && address?.toLowerCase() === listing.seller.toLowerCase();
  const isBuying = listing && buying === listing.listingId;
  const priceInRitual = listing ? Number(listing.price) / 1e18 : null;
  const collectionImageUrl = resolveIpfs(collection.image);
  const displayImage = meta?.image ?? collectionImageUrl;
  const displayName = meta?.name || `#${tokenId}`;

  async function handleCancel() {
    if (!publicClient || !listing) return;
    setCancelling(true);
    try {
      const tx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listing.listingId],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      onCancelSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] overflow-hidden hover:border-[#077345]/40 transition-all duration-200 group">
      <Link href={`/nft/${collection.contractAddress}/${tokenId}`}>
        <div className="aspect-square relative overflow-hidden bg-[#0d2518]">
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
          ) : (
            <div className="w-full h-full bg-[#077345]/10 flex items-center justify-center">
              <span className="text-zinc-700 text-xs font-mono">#{tokenId}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
          {isListed && (
            <div className="absolute top-2 left-2">
              <span className="rounded-full border border-emerald-700/40 bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                Listed
              </span>
            </div>
          )}
          {isMine && (
            <div className="absolute top-2 right-2">
              <span className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                Yours
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        <Link href={`/nft/${collection.contractAddress}/${tokenId}`}>
          <p className="text-white font-bold text-sm truncate hover:text-emerald-400 transition">
            {displayName}
          </p>
        </Link>

        {isListed && priceInRitual !== null ? (
          <div className="mt-2">
            <p className="text-emerald-400 font-black text-sm">
              {priceInRitual.toFixed(4)} RITUAL
            </p>
            {isMine ? (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-2 w-full py-2.5 rounded-xl font-bold text-xs transition border border-red-800/40 text-red-400 hover:bg-red-900/15 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Listing"}
              </button>
            ) : (
              <button
                onClick={() => onBuy(listing.listingId, listing.price)}
                disabled={!address || !!isBuying}
                className="mt-2 w-full py-2 rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-50 transition text-xs font-bold text-white flex items-center justify-center gap-1.5"
              >
                {isBuying && (
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {isBuying ? "Buying..." : "Buy Now"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-zinc-600 text-xs mt-1">Not listed</p>
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [buying, setBuying] = useState<bigint | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getCollectionBySlug",
    args: [slug],
    chainId: RITUAL_CHAIN_ID,
  });

  const collection = data as Collection | undefined;

  const { data: totalSupply } = useReadContract({
    address: collection?.contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "totalSupply",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!collection?.contractAddress },
  });

  const { data: listings, refetch: refetchListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsByContract",
    args: [
      collection?.contractAddress ?? "0x0000000000000000000000000000000000000000",
    ],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!collection?.contractAddress },
  });

  const minted = totalSupply ? Number(totalSupply) : 0;
  const maxSupply = collection ? Number(collection.maxSupply) : 0;
  const imageUrl = resolveIpfs(collection?.image);
  const isFree = collection?.mintPrice === BigInt(0);

  const activeListings = ((listings as Listing[] | undefined) ?? []).filter(
    (l) => l.active
  );
  const floorPrice =
    activeListings.length > 0
      ? Math.min(...activeListings.map((l) => Number(l.price) / 1e18))
      : null;

  const tokenIds = Array.from({ length: minted }, (_, i) => i);
  const listingByTokenId = new Map(
    activeListings.map((l) => [Number(l.tokenId), l])
  );

  let displayTokens = tokenIds;
  if (filter === "listed") {
    displayTokens = tokenIds.filter((id) => listingByTokenId.has(id));
  } else if (filter === "cheapest") {
    displayTokens = tokenIds
      .filter((id) => listingByTokenId.has(id))
      .sort((a, b) => {
        const priceA = Number(listingByTokenId.get(a)?.price ?? 0);
        const priceB = Number(listingByTokenId.get(b)?.price ?? 0);
        return priceA - priceB;
      });
  }

  async function handleBuy(listingId: bigint, price: bigint) {
    if (!address) return;
    setBuying(listingId);
    try {
      if (chainId !== RITUAL_CHAIN_ID) {
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }
      const tx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "buyNFT",
        args: [listingId],
        value: price,
      });
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      refetchListings();
    } catch (err) {
      console.error(err);
    } finally {
      setBuying(null);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#077345] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading collection...</p>
        </div>
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Collection not found.</p>
          <Link
            href="/collections"
            className="mt-4 inline-flex rounded-xl bg-[#077345] px-5 py-3 text-sm font-bold text-white"
          >
            Back to Collections
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05150f] text-white pb-24">
      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] overflow-hidden">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={collection.name}
            className="w-full h-full object-cover opacity-20 blur-sm scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05150f] via-transparent to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Collection header */}
        <div className="relative -mt-16 mb-8 flex items-end gap-5 flex-wrap">
          <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-[#05150f] bg-[#0b1f17] flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={collection.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#077345]/20" />
            )}
          </div>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-black">{collection.name}</h1>
              <span className="text-xs font-bold text-emerald-400 border border-emerald-700/30 bg-emerald-900/20 rounded-full px-3 py-1">
                {collection.symbol}
              </span>
            </div>
            <p className="text-zinc-500 text-sm mt-1">
              by {collection.creator.slice(0, 6)}...{collection.creator.slice(-4)} · ERC-721 · Ritual Testnet
            </p>
          </div>

          <div className="flex gap-3 pb-2">
            <Link
              href={`/collections/${slug}/mint`}
              className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-2.5 text-sm font-bold text-white"
            >
              Mint NFT
            </Link>
            <a
              href={`${EXPLORER_URL}/address/${collection.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/10 hover:bg-white/5 transition px-5 py-2.5 text-sm font-bold text-zinc-400 flex items-center gap-1.5"
            >
              Explorer
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
              </svg>
            </a>
          </div>
        </div>

        {collection.description && (
          <p className="text-zinc-500 text-sm max-w-2xl mb-8 leading-relaxed">
            {collection.description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Floor Price", value: floorPrice !== null ? `${floorPrice.toFixed(4)} RITUAL` : "—" },
            { label: "Listed", value: activeListings.length.toString() },
            { label: "Minted", value: `${minted} / ${maxSupply}` },
            { label: "Mint Price", value: isFree ? "Free" : `${Number(collection.mintPrice) / 1e18} RITUAL` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] px-5 py-4 text-center">
              <p className="text-zinc-600 text-xs">{label}</p>
              <p className={`font-black text-lg mt-1 ${label === "Floor Price" || label === "Mint Price" ? "text-emerald-400" : "text-white"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(
            [
              { key: "all", label: "All" },
              { key: "listed", label: "Listed" },
              { key: "cheapest", label: "Cheapest First" },
            ] satisfies { key: Filter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition border ${
                filter === key
                  ? "border-[#077345] bg-[#077345]/20 text-white"
                  : "border-[#077345]/20 text-zinc-500 hover:text-white hover:border-[#077345]/40"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-zinc-600 text-sm self-center">
            {displayTokens.length} items
          </span>
        </div>

        {/* NFT Grid */}
        {minted === 0 ? (
          <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-16 text-center">
            <p className="text-zinc-500 text-sm">No NFTs minted yet.</p>
            <Link
              href={`/collections/${slug}/mint`}
              className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
            >
              Be the First to Mint
            </Link>
          </div>
        ) : displayTokens.length === 0 ? (
          <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-16 text-center">
            <p className="text-zinc-500 text-sm">No listed NFTs found.</p>
            <button
              onClick={() => setFilter("all")}
              className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
            >
              View All
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayTokens.map((tokenId) => (
              <NFTCard
                key={tokenId}
                collection={collection}
                tokenId={tokenId}
                listing={listingByTokenId.get(tokenId)}
                address={address}
                buying={buying}
                onBuy={handleBuy}
                onCancelSuccess={refetchListings}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}