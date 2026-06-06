"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther, parseAbiItem, parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useChainId,
  useSwitchChain,
} from "wagmi";
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
import {
  fetchMarketplaceListings,
  type MarketplaceListing,
} from "@/lib/blockchain/listings";
import { getLogsInSafeChunks } from "@/lib/blockchain/logs";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const tabs = ["My NFTs", "My Listings", "My Collections"];
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

type Collection = {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
  whitelistPrice: bigint;  // ← dagdag
  maxPerWallet: bigint;    // ← dagdag
  createdAt: bigint;
  slug: string;
};

type Listing = MarketplaceListing;

type OwnedNFT = {
  contractAddress: `0x${string}`;
  tokenId: bigint;
  collection: Collection;
};

type ListingDraft = {
  contractAddress: `0x${string}`;
  tokenId: bigint;
  collectionName: string;
} | null;

type TokenMeta = {
  name: string;
  image: string | null;
};

function resolveIpfs(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

function listingKey(contractAddress: string, tokenId: bigint) {
  return `${contractAddress.toLowerCase()}:${tokenId.toString()}`;
}

const metadataCache = new Map<string, TokenMeta>();

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

function OwnedNFTCard({
  nft,
  activeListing,
  onListClick,
}: {
  nft: OwnedNFT;
  activeListing?: Listing;
  onListClick: () => void;
}) {
  const [meta, setMeta] = useState<TokenMeta | null>(null);

  const { data: tokenURIData } = useReadContract({
    address: nft.contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "tokenURI",
    args: [nft.tokenId],
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

  const collectionImageUrl = resolveIpfs(nft.collection.image);
  const displayImage = meta?.image ?? collectionImageUrl;
  const displayName = meta?.name || `${nft.collection.name} #${nft.tokenId.toString()}`;

  return (
    <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] overflow-hidden">
      <Link href={`/nft/${nft.contractAddress}/${nft.tokenId.toString()}`}>
        <div className="h-40 bg-gradient-to-br from-[#e8e3d8] via-[#e0dbd0] to-[#e0dbd0] flex items-center justify-center relative">
          {displayImage ? (
            <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="text-[#7a9e7a] font-mono text-xs">#{nft.tokenId.toString()}</div>
          )}
          {activeListing && (
            <span className="absolute top-3 right-3 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-2 py-0.5 text-xs font-bold text-[#1a4a2e]">
              Listed
            </span>
          )}
        </div>
      </Link>
      <div className="p-4">
        <p className="text-[#1a2e1a] font-bold text-sm truncate">{displayName}</p>
        <p className="text-[#7a9e7a] text-xs mt-0.5">
          Token #{nft.tokenId.toString()} · {nft.collection.symbol}
        </p>
        {activeListing ? (
          <div className="mt-3 rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/70 px-4 py-2">
            <p className="text-[#7a9e7a] text-xs">Active Listing</p>
            <p className="text-[#1a4a2e] font-black text-sm">{formatEther(activeListing.price)} RITUAL</p>
          </div>
        ) : (
          <button
            onClick={onListClick}
            className="mt-3 w-full rounded-xl border border-[#1a4a2e]/30 hover:bg-[#1a4a2e]/10 transition px-4 py-2 text-sm font-bold text-[#1a4a2e]"
          >
            List for Sale
          </button>
        )}
      </div>
    </div>
  );
}

function CollectionManagerCard({
  col,
  writeContractAsync,
  switchChainAsync,
  isWrongNetwork,
}: {
  col: Collection;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  switchChainAsync: ReturnType<typeof useSwitchChain>["switchChainAsync"];
  isWrongNetwork: boolean;
}){

  const [phaseLoading, setPhaseLoading] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });

  const { data: currentPhase, refetch: refetchPhase } = useReadContract({
    address: col.contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "phase",
    chainId: RITUAL_CHAIN_ID,
  });

  const phaseNumber = Number(currentPhase ?? 0);
  const phaseLabel =
    phaseNumber === 0 ? "Paused" : phaseNumber === 1 ? "Whitelist" : "Public";

  const imageUrl = resolveIpfs(col.image);

  async function handleSetPhase(newPhase: number) {
    if (phaseLoading) return;
    setPhaseError(null);
    setPhaseLoading(true);
    try {
      if (isWrongNetwork) await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      if (!publicClient) throw new Error("No public client");
      const hash = await writeContractAsync({
        address: col.contractAddress,
        abi: VASTMINT_NFT_ABI,
        functionName: "setPhase",
        args: [newPhase],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchPhase();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed";
      setPhaseError(
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected."
          : "Failed to set phase."
      );
    } finally {
      setPhaseLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt={col.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1a4a2e]/20" />
            )}
          </div>
          <div>
            <p className="text-[#1a2e1a] font-bold text-sm">{col.name}</p>
            <p className="text-[#7a9e7a] text-xs mt-0.5">
              {col.symbol} · {Number(col.maxSupply).toLocaleString()} supply
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[#7a9e7a] text-xs">Phase</p>
            <p className={`text-xs font-bold ${
              phaseNumber === 0 ? "text-red-400" :
              phaseNumber === 1 ? "text-yellow-400" :
              "text-[#1a4a2e]"
            }`}>
              {phaseLabel}
            </p>
          </div>
          <Link
            href={`/collections/${col.slug}/mint`}
            className="rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-3 py-2 text-xs font-bold text-[#f5f0e8]"
          >
            Mint Page
          </Link>
          <a
            href={`${EXPLORER_URL}/address/${col.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[#1a4a2e]/15 hover:bg-[#1a4a2e]/10 transition px-3 py-2 text-xs text-[#4a6741]"
          >
            Explorer
          </a>
        </div>
      </div>

      {/* Phase Controls */}
      <div className="border-t border-[#1a4a2e]/10 pt-3">
        <p className="text-xs text-[#7a9e7a] mb-2 font-medium">Set Phase</p>
        <div className="flex gap-2">
          {[
            { label: "Paused", value: 0, color: "border-red-800/40 text-red-400 hover:bg-red-900/10" },
            { label: "Whitelist", value: 1, color: "border-yellow-700/40 text-yellow-500 hover:bg-yellow-900/10" },
            { label: "Public", value: 2, color: "border-[#1a4a2e]/40 text-[#1a4a2e] hover:bg-[#1a4a2e]/10" },
          ].map(({ label, value, color }) => (
            <button
              key={value}
              onClick={() => handleSetPhase(value)}
              disabled={phaseLoading || phaseNumber === value}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition ${color} ${
                phaseNumber === value ? "opacity-30 cursor-not-allowed" : ""
              } ${phaseLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {phaseLoading && phaseNumber !== value ? "..." : label}
            </button>
          ))}
        </div>
        {phaseError && <p className="text-red-400 text-xs mt-2">{phaseError}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: RITUAL_CHAIN_ID });
  const [activeTab, setActiveTab] = useState("My NFTs");
  const [listingDraft, setListingDraft] = useState<ListingDraft>(null);
  const [listPrice, setListPrice] = useState("");
  const [listingState, setListingState] = useState<
    "idle" | "approving" | "listing" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ownedNfts, setOwnedNfts] = useState<OwnedNFT[]>([]);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<Listing[]>([]);

  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;

  const { data: allCollectionsData } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const allCollections = useMemo(
    () => (allCollectionsData as Collection[] | undefined) ?? [],
    [allCollectionsData]
  );

  const collectionByContract = useMemo(() => {
    return new Map(
      allCollections.map((col) => [col.contractAddress.toLowerCase(), col])
    );
  }, [allCollections]);

  const refetchListings = useCallback(async () => {
    if (!address || !publicClient) {
      setMyListings([]);
      return;
    }
    const nextListings = await fetchMarketplaceListings(publicClient, {
      seller: address,
    });
    setMyListings(nextListings);
  }, [address, publicClient]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refetchListings(), 0);
    return () => window.clearTimeout(timeout);
  }, [refetchListings]);

  const { data: myCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  const activeListings = myListings.filter((l) => l.active);
  const activeListingByToken = new Map(
    activeListings.map((l) => [listingKey(l.nftContract, l.tokenId), l])
  );

  useEffect(() => {
    let cancelled = false;

    async function scanOwnedTokens() {
      if (!address || !publicClient || allCollections.length === 0) {
        setOwnedNfts([]);
        return;
      }

      setOwnershipLoading(true);
      setOwnershipError(null);

      try {
        const nextOwned: OwnedNFT[] = [];
        const wallet = address.toLowerCase();
        let failedScans = 0;

        const scanResults = await Promise.allSettled(
          allCollections.map(async (collection) => {
            const [incoming, outgoing] = await Promise.all([
              getLogsInSafeChunks(publicClient, {
                address: collection.contractAddress,
                event: transferEvent,
                args: { to: address },
              }),
              getLogsInSafeChunks(publicClient, {
                address: collection.contractAddress,
                event: transferEvent,
                args: { from: address },
              }),
            ]);

            const events = [...incoming, ...outgoing].sort((a, b) => {
              if (a.blockNumber !== b.blockNumber)
                return a.blockNumber < b.blockNumber ? -1 : 1;
              return a.logIndex < b.logIndex ? -1 : a.logIndex > b.logIndex ? 1 : 0;
            });

            const ownedSet = new Set<string>();
            for (const event of events) {
              const from = typeof event.args.from === "string"
                ? event.args.from.toLowerCase() : undefined;
              const to = typeof event.args.to === "string"
                ? event.args.to.toLowerCase() : undefined;
              const tokenId = event.args.tokenId;
              if (typeof tokenId !== "bigint") continue;
              if (from === wallet) ownedSet.delete(tokenId.toString());
              if (to === wallet) ownedSet.add(tokenId.toString());
            }

            return { collection, ownedSet };
          })
        );

        for (const result of scanResults) {
          if (result.status === "fulfilled") {
            const { collection, ownedSet } = result.value;
            for (const tokenId of ownedSet) {
              nextOwned.push({
                contractAddress: collection.contractAddress,
                tokenId: BigInt(tokenId),
                collection,
              });
            }
          } else {
            failedScans += 1;
            console.error("Unable to scan collection", result.reason);
          }
        }

        nextOwned.sort((a, b) => {
          const cc = a.collection.name.localeCompare(b.collection.name);
          if (cc !== 0) return cc;
          return a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0;
        });

        if (!cancelled) {
          setOwnedNfts(nextOwned);
          if (failedScans > 0) {
            setOwnershipError(
              `Some NFT collections could not be scanned (${failedScans}/${allCollections.length}). Showing available results.`
            );
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setOwnedNfts([]);
          setOwnershipError("Unable to scan owned NFTs.");
        }
      } finally {
        if (!cancelled) setOwnershipLoading(false);
      }
    }

    void scanOwnedTokens();
    return () => { cancelled = true; };
  }, [address, publicClient, allCollections]);

  async function handleList(contractAddress: `0x${string}`, tokenId: bigint) {
    if (!address || !listPrice || parseFloat(listPrice) <= 0) return;
    if (activeListingByToken.has(listingKey(contractAddress, tokenId))) {
      setErrorMsg(`Token #${tokenId.toString()} already has an active listing.`);
      setListingState("error");
      return;
    }

    setErrorMsg(null);
    setListingState("approving");

    try {
      if (isWrongNetwork) await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      if (!publicClient) throw new Error("Ritual public client unavailable");

      const approvalHash = await writeContractAsync({
        address: contractAddress,
        abi: VASTMINT_NFT_ABI,
        functionName: "setApprovalForAll",
        args: [VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`, true],
        chainId: RITUAL_CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });

      setListingState("listing");
      const listingHash = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "listNFT",
        args: [contractAddress, tokenId, parseEther(listPrice)],
        chainId: RITUAL_CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash: listingHash });

      setListingState("success");
      setListingDraft(null);
      setListPrice("");
      await refetchListings();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Listing failed";
      setErrorMsg(
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected."
          : "Listing failed. Try again."
      );
      setListingState("error");
    }
  }

  async function handleCancel(listingId: bigint) {
    try {
      if (!publicClient) return;
      if (chainId !== RITUAL_CHAIN_ID) await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      const hash = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listingId],
        chainId: RITUAL_CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchListings();
    } catch (err) {
      console.error(err);
    }
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] px-4 pt-6 pb-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a4a2e]/20 border border-[#1a4a2e]/30 flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-2xl font-black">Connect Your Wallet</h2>
          <p className="text-[#4a6741] text-sm mt-2">Connect your wallet to view your dashboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#1a4a2e]/5 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-[0.18em] mb-2">Dashboard</p>
            <h1 className="text-4xl font-black">My VastMint</h1>
            <p className="text-[#4a6741] text-sm mt-2">
              Manage NFTs, listings, and deployed collections across VastMint factory collections.
            </p>
          </div>
          <Link
            href="/collections"
            className="rounded-xl border border-[#1a4a2e]/30 hover:bg-[#1a4a2e]/10 transition px-4 py-2 text-sm font-bold text-[#1a4a2e]"
          >
            Mint More
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "NFTs Owned", value: ownershipLoading ? "…" : ownedNfts.length.toString() },
            { label: "Active Listings", value: activeListings.length.toString() },
            { label: "Collections Created", value: myCollections ? myCollections.length.toString() : "0" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] px-5 py-4">
              <p className="text-[#7a9e7a] text-xs">{label}</p>
              <p className="text-[#1a2e1a] font-black text-2xl mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-[#1a4a2e]/20 border border-[#1a4a2e] text-[#1a2e1a]"
                  : "text-[#4a6741] hover:text-[#1a2e1a] border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* My NFTs Tab */}
        {activeTab === "My NFTs" && (
          <div>
            {ownershipError && (
              <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/15 px-4 py-3">
                <p className="text-red-400 text-sm">{ownershipError}</p>
              </div>
            )}
            {ownershipLoading ? (
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-12 text-center">
                <p className="text-[#4a6741] text-sm">Scanning owned NFTs across factory collections…</p>
              </div>
            ) : ownedNfts.length === 0 ? (
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-12 text-center">
                <p className="text-[#4a6741] text-sm">You don&apos;t own any VastMint NFTs yet.</p>
                <Link
                  href="/collections"
                  className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-5 py-3 text-sm font-bold text-[#f5f0e8]"
                >
                  Mint Your First NFT
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[#4a6741] text-sm">
                  You own {ownedNfts.length} NFT{ownedNfts.length > 1 ? "s" : ""} across{" "}
                  {new Set(ownedNfts.map((n) => n.contractAddress)).size} collection
                  {new Set(ownedNfts.map((n) => n.contractAddress)).size > 1 ? "s" : ""}.
                </p>

                {listingDraft && (
                  <div className="rounded-2xl border border-[#1a4a2e]/30 bg-[#ede8df] p-5 space-y-4">
                    <p className="text-[#1a2e1a] font-bold">
                      List {listingDraft.collectionName} #{listingDraft.tokenId.toString()} for Sale
                    </p>
                    <input
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="w-full rounded-xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                      placeholder="Price in RITUAL (e.g. 0.05)"
                    />
                    {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleList(listingDraft.contractAddress, listingDraft.tokenId)}
                        disabled={listingState === "approving" || listingState === "listing"}
                        className="flex-1 rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] disabled:opacity-50 transition px-4 py-3 text-sm font-bold text-[#f5f0e8] flex items-center justify-center gap-2"
                      >
                        {(listingState === "approving" || listingState === "listing") && (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                        {listingState === "approving" ? "Approving..." : listingState === "listing" ? "Listing..." : "List for Sale"}
                      </button>
                      <button
                        onClick={() => {
                          setListingDraft(null);
                          setListPrice("");
                          setListingState("idle");
                          setErrorMsg(null);
                        }}
                        className="rounded-xl border border-[#1a4a2e]/20 px-4 py-3 text-sm text-[#4a6741] hover:text-[#1a2e1a] transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedNfts.map((nft) => {
                    const key = listingKey(nft.contractAddress, nft.tokenId);
                    return (
                      <OwnedNFTCard
                        key={key}
                        nft={nft}
                        activeListing={activeListingByToken.get(key)}
                        onListClick={() => {
                          setListingDraft({
                            contractAddress: nft.contractAddress,
                            tokenId: nft.tokenId,
                            collectionName: nft.collection.name,
                          });
                          setListingState("idle");
                          setErrorMsg(null);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* My Listings Tab */}
        {activeTab === "My Listings" && (
          <div>
            {activeListings.length === 0 ? (
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-12 text-center">
                <p className="text-[#4a6741] text-sm">You have no active listings.</p>
                <button
                  onClick={() => setActiveTab("My NFTs")}
                  className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-5 py-3 text-sm font-bold text-[#f5f0e8]"
                >
                  List an NFT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeListings.map((listing) => {
                  const collection = collectionByContract.get(listing.nftContract.toLowerCase());
                  const imageUrl = resolveIpfs(collection?.image);
                  return (
                    <div
                      key={listing.listingId.toString()}
                      className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-5 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#1a4a2e]/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {imageUrl ? (
                            <img src={imageUrl} alt={collection?.name ?? "NFT"} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#7a9e7a] text-xs">#{listing.tokenId.toString()}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[#1a2e1a] font-bold text-sm">
                            {collection?.name ?? "Unknown Collection"} #{listing.tokenId.toString()}
                          </p>
                          <p className="text-[#7a9e7a] text-xs mt-0.5">
                            {listing.nftContract.slice(0, 6)}...{listing.nftContract.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[#7a9e7a] text-xs">Price</p>
                          <p className="text-[#1a4a2e] font-black">{formatEther(listing.price)} RITUAL</p>
                        </div>
                        <div>
                          <p className="text-[#7a9e7a] text-xs">Listed</p>
                          <p className="text-[#4a6741] text-xs">
                            {new Date(Number(listing.createdAt) * 1000).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/nft/${listing.nftContract}/${listing.tokenId.toString()}`}
                            className="rounded-xl border border-[#1a4a2e]/15 hover:bg-[#1a4a2e]/10 transition px-3 py-2 text-xs text-[#4a6741] hover:text-[#1a2e1a]"
                          >
                            NFT
                          </Link>
                          <a
                            href={`${EXPLORER_URL}/address/${listing.nftContract}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-[#1a4a2e]/15 hover:bg-[#1a4a2e]/10 transition px-3 py-2 text-xs text-[#4a6741] hover:text-[#1a2e1a]"
                          >
                            Explorer
                          </a>
                          <button
                            onClick={() => handleCancel(listing.listingId)}
                            className="rounded-xl border border-red-800/40 hover:bg-red-900/15 transition px-3 py-2 text-xs font-bold text-red-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* My Collections Tab */}
        {activeTab === "My Collections" && (
          <div>
            {!myCollections || myCollections.length === 0 ? (
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-12 text-center">
                <p className="text-[#4a6741] text-sm">
                  You haven&apos;t deployed any collections yet.
                </p>
                <Link
                  href="/launchpad/create"
                  className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-5 py-3 text-sm font-bold text-[#f5f0e8]"
                >
                  Deploy Collection
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(myCollections as Collection[]).map((col) => (
                  <CollectionManagerCard
                    key={col.contractAddress}
                    col={col}
                    writeContractAsync={writeContractAsync}
                    switchChainAsync={switchChainAsync}
                    isWrongNetwork={isWrongNetwork}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}