"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { parseEther, parseAbiItem } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useChainId,
  useSwitchChain,
  usePublicClient,
} from "wagmi";
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
const tabs = ["My NFTs", "My Listings", "My Collections"];

interface OwnedToken {
  contractAddress: `0x${string}`;
  collectionName: string;
  tokenId: bigint;
  tokenURI: string;
  image: string;
  name: string;
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

function resolveIpfs(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${IPFS_GATEWAY}${uri.slice(7)}`;
  return uri;
}

async function fetchMetadata(uri: string): Promise<{ image: string; name: string }> {
  try {
    const url = resolveIpfs(uri);
    if (!url) return { image: "", name: "" };
    const res = await fetch(url);
    const json = await res.json();
    return {
      image: resolveIpfs(json.image ?? ""),
      name: json.name ?? "",
    };
  } catch {
    return { image: "", name: "" };
  }
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [activeTab, setActiveTab] = useState("My NFTs");
  const [ownedTokens, setOwnedTokens] = useState<OwnedToken[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [listingTokenId, setListingTokenId] = useState<bigint | null>(null);
  const [listingContract, setListingContract] = useState<`0x${string}` | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listingState, setListingState] = useState<"idle" | "approving" | "listing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);

  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;

  const { data: allCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const { data: myListings, refetch: refetchListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsBySeller",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: myCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  const scanOwnedTokens = useCallback(async () => {
    if (!address || !publicClient || !allCollections || allCollections.length === 0) return;

    setScanLoading(true);
    const transferEvent = parseAbiItem(
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
    );

    const results: OwnedToken[] = [];

    // Get latest block once, reuse for all collections
    const latestBlock = await publicClient.getBlockNumber();
    const chunkSize = 99999n;
    const fromBlockStart = latestBlock > 500000n ? latestBlock - 500000n : 0n;

    for (const col of allCollections as CollectionInfo[]) {
      const contractAddress = col.contractAddress as `0x${string}`;

      try {
        type TransferLog = Awaited<ReturnType<typeof publicClient.getLogs>>[number];
        const logsIn: TransferLog[] = [];
        const logsOut: TransferLog[] = [];

        for (let from = fromBlockStart; from <= latestBlock; from += chunkSize) {
          const toBlock = from + chunkSize > latestBlock ? latestBlock : from + chunkSize;
          const [chunkIn, chunkOut] = await Promise.all([
            publicClient.getLogs({
              address: contractAddress,
              event: transferEvent,
              args: { to: address },
              fromBlock: from,
              toBlock,
            }),
            publicClient.getLogs({
              address: contractAddress,
              event: transferEvent,
              args: { from: address },
              fromBlock: from,
              toBlock,
            }),
          ]);
          logsIn.push(...chunkIn);
          logsOut.push(...chunkOut);
        }

        const received = new Map<string, bigint>();
        for (const log of logsIn) {
          const tokenId = log.args?.tokenId as bigint | undefined;
          if (tokenId === undefined) continue;
          received.set(tokenId.toString(), tokenId);
        }

        for (const log of logsOut) {
          const tokenId = log.args?.tokenId as bigint | undefined;
          if (tokenId === undefined) continue;
          received.delete(tokenId.toString());
        }

        if (received.size === 0) continue;

        for (const tokenId of received.values()) {
          try {
            const uri = await publicClient.readContract({
              address: contractAddress,
              abi: VASTMINT_NFT_ABI,
              functionName: "tokenURI",
              args: [tokenId],
            }) as string;

            const { image, name } = await fetchMetadata(uri);

            results.push({
              contractAddress,
              collectionName: col.name,
              tokenId,
              tokenURI: uri,
              image,
              name: name || `${col.name} #${tokenId.toString()}`,
            });
          } catch {
            results.push({
              contractAddress,
              collectionName: col.name,
              tokenId,
              tokenURI: "",
              image: "",
              name: `${col.name} #${tokenId.toString()}`,
            });
          }
        }
      } catch (err) {
        console.error(`Failed scanning ${contractAddress}:`, err);
      }
    }

    setOwnedTokens(results);
    setScanLoading(false);
  }, [address, publicClient, allCollections]);

  useEffect(() => {
    if (activeTab === "My NFTs") {
      scanOwnedTokens();
    }
  }, [activeTab, scanOwnedTokens]);

  const activeListings = (myListings ?? []).filter((l) => l.active);
  const activeListingByKey = new Map(
    activeListings.map((l) => [
      `${l.nftContract.toLowerCase()}-${l.tokenId.toString()}`,
      l,
    ])
  );

  async function handleList(contractAddress: `0x${string}`, tokenId: bigint) {
    if (!address || !listPrice || parseFloat(listPrice) <= 0) return;

    const key = `${contractAddress.toLowerCase()}-${tokenId.toString()}`;
    if (activeListingByKey.has(key)) {
      setErrorMsg(`Token #${tokenId.toString()} already has an active listing.`);
      setListingState("error");
      return;
    }

    setErrorMsg(null);
    setListingState("approving");

    try {
      if (isWrongNetwork) {
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      const approveTx = await writeContractAsync({
   address: contractAddress,
  abi: [
    {
      type: "function",
      name: "setApprovalForAll",
      stateMutability: "nonpayable",
      inputs: [
        { name: "operator", type: "address" },
        { name: "approved", type: "bool" },
      ],
      outputs: [],
    },
  ] as const,
  functionName: "setApprovalForAll",
  args: [VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`, true],
  });

      await publicClient!.waitForTransactionReceipt({ hash: approveTx });

      setListingState("listing");
      const listTx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "listNFT",
        args: [contractAddress, tokenId, parseEther(listPrice)],
      });

      await publicClient!.waitForTransactionReceipt({ hash: listTx });

      setListingState("success");
      setListingTokenId(null);
      setListingContract(null);
      setListPrice("");
      refetchListings();
      scanOwnedTokens();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Listing failed";
      const short =
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected."
          : "Listing failed. Try again.";
      setErrorMsg(short);
      setListingState("error");
    }
  }

  async function handleCancel(listingId: bigint) {
    setCancellingId(listingId);
    try {
      if (isWrongNetwork) {
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }
      const tx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listingId],
      });
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      refetchListings();
    } catch (err) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  }

  function openListUI(contractAddress: `0x${string}`, tokenId: bigint) {
    setListingContract(contractAddress);
    setListingTokenId(tokenId);
    setListingState("idle");
    setErrorMsg(null);
    setListPrice("");
  }

  function closeListUI() {
    setListingContract(null);
    setListingTokenId(null);
    setListingState("idle");
    setErrorMsg(null);
    setListPrice("");
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white px-4 pt-6 pb-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#077345]/20 border border-[#077345]/30 flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#077345" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-2xl font-black">Connect Your Wallet</h2>
          <p className="text-zinc-500 text-sm mt-2">Connect your wallet to view your dashboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#077345]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black">Your Portfolio</h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "NFTs Owned", value: scanLoading ? "…" : ownedTokens.length.toString() },
            { label: "Active Listings", value: activeListings.length.toString() },
            { label: "Collections Created", value: myCollections?.length.toString() ?? "0" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] px-5 py-4 text-center">
              <p className="text-zinc-600 text-xs">{label}</p>
              <p className="text-white font-black text-2xl mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-[#077345]/20 border border-[#077345] text-white"
                  : "text-zinc-500 hover:text-white border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── MY NFTs TAB ── */}
        {activeTab === "My NFTs" && (
          <div>
            {scanLoading ? (
              <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-12 text-center">
                <div className="flex items-center justify-center gap-3 text-zinc-500">
                  <svg className="animate-spin w-5 h-5 text-[#077345]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Scanning your NFTs across all collections…</span>
                </div>
              </div>
            ) : ownedTokens.length === 0 ? (
              <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-12 text-center">
                <p className="text-zinc-500 text-sm">You don&apos;t own any VastMint NFTs yet.</p>
                <Link
                  href="/collections"
                  className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                >
                  Mint Your First NFT
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-zinc-500 text-sm">
                  You own {ownedTokens.length} NFT{ownedTokens.length > 1 ? "s" : ""} across{" "}
                  {new Set(ownedTokens.map((t) => t.contractAddress)).size} collection
                  {new Set(ownedTokens.map((t) => t.contractAddress)).size > 1 ? "s" : ""}.
                </p>

                {listingTokenId !== null && listingContract !== null && (
                  <div className="rounded-2xl border border-[#077345]/30 bg-[#0b1f17] p-5 space-y-4">
                    <p className="text-white font-bold">
                      List Token #{listingTokenId.toString()} for Sale
                    </p>
                    <input
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                      placeholder="Price in RITUAL (e.g. 0.05)"
                    />
                    {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleList(listingContract, listingTokenId)}
                        disabled={listingState === "approving" || listingState === "listing"}
                        className="flex-1 rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-50 transition px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                      >
                        {(listingState === "approving" || listingState === "listing") && (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                        {listingState === "approving"
                          ? "Approving…"
                          : listingState === "listing"
                          ? "Listing…"
                          : "List for Sale"}
                      </button>
                      <button
                        onClick={closeListUI}
                        className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400 hover:text-white transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedTokens.map((token) => {
                    const key = `${token.contractAddress.toLowerCase()}-${token.tokenId.toString()}`;
                    const activeListing = activeListingByKey.get(key);
                    const isListingThis =
                      listingContract === token.contractAddress &&
                      listingTokenId === token.tokenId;

                    return (
                      <div key={key} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden">
                        <div className="h-40 bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center relative">
                          {token.image ? (
                            <img src={token.image} alt={token.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-20 h-20 rounded-xl bg-[#077345]/20 flex items-center justify-center">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#077345" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="3" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="M21 15l-5-5L5 21" />
                              </svg>
                            </div>
                          )}
                          {activeListing && (
                            <span className="absolute top-3 right-3 rounded-full border border-emerald-700/30 bg-emerald-900/40 px-2 py-0.5 text-xs font-bold text-emerald-400">
                              Listed
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-white font-bold text-sm truncate">{token.name}</p>
                          <p className="text-zinc-600 text-xs mt-0.5 truncate">{token.collectionName}</p>
                          {activeListing ? (
                            <div className="mt-3 rounded-xl border border-white/5 bg-black/20 px-4 py-2">
                              <p className="text-zinc-600 text-xs">Active Listing</p>
                              <p className="text-emerald-400 font-black text-sm">
                                {(Number(activeListing.price) / 1e18).toFixed(4)} RITUAL
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => openListUI(token.contractAddress, token.tokenId)}
                              disabled={isListingThis}
                              className="mt-3 w-full rounded-xl border border-[#077345]/30 hover:bg-[#077345]/10 transition px-4 py-2 text-sm font-bold text-emerald-400 disabled:opacity-50"
                            >
                              List for Sale
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MY LISTINGS TAB ── */}
        {activeTab === "My Listings" && (
          <div>
            {activeListings.length === 0 ? (
              <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-12 text-center">
                <p className="text-zinc-500 text-sm">You have no active listings.</p>
                <button
                  onClick={() => setActiveTab("My NFTs")}
                  className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                >
                  List an NFT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeListings.map((listing) => {
                  const token = ownedTokens.find(
                    (t) =>
                      t.contractAddress.toLowerCase() === listing.nftContract.toLowerCase() &&
                      t.tokenId === listing.tokenId
                  );
                  const isCancelling = cancellingId === listing.listingId;

                  return (
                    <div
                      key={listing.listingId.toString()}
                      className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-5 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#077345]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {token?.image ? (
                            <img src={token.image} alt={token.name} className="w-full h-full object-cover" />
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#077345" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="3" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">
                            {token?.name ?? `Token #${listing.tokenId.toString()}`}
                          </p>
                          <p className="text-zinc-600 text-xs mt-0.5">
                            {listing.nftContract.slice(0, 6)}…{listing.nftContract.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-zinc-600 text-xs">Price</p>
                          <p className="text-emerald-400 font-black">
                            {(Number(listing.price) / 1e18).toFixed(4)} RITUAL
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-600 text-xs">Listed</p>
                          <p className="text-zinc-400 text-xs">
                            {new Date(Number(listing.createdAt) * 1000).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`${EXPLORER_URL}/address/${listing.nftContract}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-white/5 hover:bg-white/5 transition px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Explorer
                          </a>
                          <button
                            onClick={() => handleCancel(listing.listingId)}
                            disabled={isCancelling}
                            className="rounded-xl border border-red-800/40 hover:bg-red-900/15 transition px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isCancelling && (
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            )}
                            {isCancelling ? "Cancelling…" : "Cancel"}
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

        {/* ── MY COLLECTIONS TAB ── */}
        {activeTab === "My Collections" && (
          <div>
            {!myCollections || myCollections.length === 0 ? (
              <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-12 text-center">
                <p className="text-zinc-500 text-sm">You haven&apos;t deployed any collections yet.</p>
                <Link
                  href="/launchpad/create"
                  className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                >
                  Deploy Collection
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(myCollections as CollectionInfo[]).map((col) => {
                  const imageUrl = resolveIpfs(col.image);
                  return (
                    <div
                      key={col.contractAddress}
                      className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-5 flex items-center justify-between gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                          {imageUrl ? (
                            <img src={imageUrl} alt={col.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#077345]/20" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{col.name}</p>
                          <p className="text-zinc-600 text-xs mt-0.5">
                            {col.symbol} · {Number(col.maxSupply).toLocaleString()} supply
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-zinc-600 text-xs">Price</p>
                          <p className="text-emerald-400 font-bold text-sm">
                            {col.mintPrice === 0n
                              ? "Free"
                              : `${(Number(col.mintPrice) / 1e18).toString()} RITUAL`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/collections/${col.slug}/mint`}
                            className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-3 py-2 text-xs font-bold text-white"
                          >
                            Mint Page
                          </Link>
                          <a
                            href={`${EXPLORER_URL}/address/${col.contractAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-white/5 hover:bg-white/5 transition px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
                          >
                            Explorer
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}