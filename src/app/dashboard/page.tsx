"use client";

import { useState } from "react";
import Link from "next/link";
import { parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useChainId,
  useSwitchChain,
} from "wagmi";
import {
  VASTMINT_NFT_ADDRESS,
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
const tabs = ["My NFTs", "My Listings", "My Collections"];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [activeTab, setActiveTab] = useState("My NFTs");
  const [listingTokenId, setListingTokenId] = useState<bigint | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listingState, setListingState] = useState<"idle" | "approving" | "listing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;

  // Fetch NFT balance
  const { data: nftBalance } = useReadContract({
    address: VASTMINT_NFT_ADDRESS as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "balanceOf",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Fetch my listings
  const { data: myListings, refetch: refetchListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsBySeller",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Fetch my deployed collections
  const { data: myCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getCreatorCollections",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  const balance = nftBalance ? Number(nftBalance) : 0;

  async function handleList(tokenId: bigint) {
    if (!address || !listPrice || parseFloat(listPrice) <= 0) return;
    setErrorMsg(null);
    setListingState("approving");

    try {
      if (isWrongNetwork) {
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      // Step 1: Approve marketplace
      await writeContractAsync({
        address: VASTMINT_NFT_ADDRESS as `0x${string}`,
        abi: VASTMINT_NFT_ABI,
        functionName: "approve",
        args: [VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`, tokenId],
      });

      // Step 2: List NFT
      setListingState("listing");
      const priceWei = parseEther(listPrice);
      await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "listNFT",
        args: [
          VASTMINT_NFT_ADDRESS as `0x${string}`,
          tokenId,
          priceWei,
        ],
      });

      setListingState("success");
      setListingTokenId(null);
      setListPrice("");
      refetchListings();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Listing failed";
      const short = message.includes("rejected") || message.includes("denied")
        ? "Transaction rejected."
        : "Listing failed. Try again.";
      setErrorMsg(short);
      setListingState("error");
    }
  }

  async function handleCancel(listingId: bigint) {
    try {
      await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listingId],
      });
      refetchListings();
    } catch (err) {
      console.error(err);
    }
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
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black">Your Portfolio</h1>
          <p className="text-zinc-500 text-sm mt-1 font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "NFTs Owned", value: balance.toString() },
            { label: "Active Listings", value: myListings?.length.toString() ?? "0" },
            { label: "Collections Created", value: myCollections?.length.toString() ?? "0" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] px-5 py-4 text-center">
              <p className="text-zinc-600 text-xs">{label}</p>
              <p className="text-white font-black text-2xl mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
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

        {/* MY NFTs TAB */}
        {activeTab === "My NFTs" && (
          <div>
            {balance === 0 ? (
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
                <p className="text-zinc-500 text-sm">You own {balance} NFT{balance > 1 ? "s" : ""} from Ritual Genesis Pass.</p>

                {/* List for sale UI */}
                {listingTokenId !== null && (
                  <div className="rounded-2xl border border-[#077345]/30 bg-[#0b1f17] p-5 space-y-4">
                    <p className="text-white font-bold">List Token #{listingTokenId.toString()} for Sale</p>
                    <input
                      value={listPrice}
                      onChange={(e) => setListPrice(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                      placeholder="Price in RITUAL (e.g. 0.05)"
                    />
                    {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleList(listingTokenId)}
                        disabled={listingState === "approving" || listingState === "listing"}
                        className="flex-1 rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-50 transition px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                      >
                        {listingState === "approving" && (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                        {listingState === "approving" ? "Approving..." : listingState === "listing" ? "Listing..." : "List for Sale"}
                      </button>
                      <button
                        onClick={() => { setListingTokenId(null); setListPrice(""); setListingState("idle"); setErrorMsg(null); }}
                        className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400 hover:text-white transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: balance }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden">
                      <div className="h-40 bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center relative">
                        <img
                          src="https://ipfs.io/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4"
                          alt="NFT"
                          className="w-20 h-20 rounded-xl object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-white font-bold text-sm">Ritual Genesis Pass</p>
                        <p className="text-zinc-600 text-xs mt-0.5">Token #{i}</p>
                        <button
                          onClick={() => { setListingTokenId(BigInt(i)); setListingState("idle"); setErrorMsg(null); }}
                          className="mt-3 w-full rounded-xl border border-[#077345]/30 hover:bg-[#077345]/10 transition px-4 py-2 text-sm font-bold text-emerald-400"
                        >
                          List for Sale
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MY LISTINGS TAB */}
        {activeTab === "My Listings" && (
          <div>
            {!myListings || myListings.length === 0 ? (
              <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-12 text-center">
                <p className="text-zinc-500 text-sm">You have no active listings.</p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                >
                  List an NFT
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((listing) => (
                  <div
                    key={listing.listingId.toString()}
                    className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-5 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#077345]/20 flex items-center justify-center flex-shrink-0">
                        <img
                          src="https://ipfs.io/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4"
                          alt="NFT"
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Token #{listing.tokenId.toString()}</p>
                        <p className="text-zinc-600 text-xs mt-0.5">
                          {listing.nftContract.slice(0, 6)}...{listing.nftContract.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-zinc-600 text-xs">Price</p>
                        <p className="text-emerald-400 font-black">{(Number(listing.price) / 1e18).toFixed(4)} RITUAl</p>
                      </div>
                      <div>
                        <p className="text-zinc-600 text-xs">Listed</p>
                        <p className="text-zinc-400 text-xs">{new Date(Number(listing.createdAt) * 1000).toLocaleDateString()}</p>
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
                          className="rounded-xl border border-red-800/40 hover:bg-red-900/15 transition px-3 py-2 text-xs font-bold text-red-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MY COLLECTIONS TAB */}
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
                {myCollections.map((col) => {
                  const imageUrl = col.image?.startsWith("ipfs://")
                    ? `https://ipfs.io/ipfs/${col.image.replace("ipfs://", "")}`
                    : col.image;
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
                          <p className="text-zinc-600 text-xs mt-0.5">{col.symbol} · {Number(col.maxSupply).toLocaleString()} supply</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-zinc-600 text-xs">Price</p>
                          <p className="text-emerald-400 font-bold text-sm">
                            {col.mintPrice === 0n ? "Free" : `${Number(col.mintPrice) / 1e18} RITUAL`}
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