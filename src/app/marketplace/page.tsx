"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { VASTMINT_MARKETPLACE_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_MARKETPLACE_ABI } from "@/lib/blockchain/abi";
import { useSearchParams } from "next/navigation";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const filters = ["All", "Cheapest", "Most Recent"];

type BuyState = "idle" | "switching" | "pending" | "confirming" | "success" | "error";

function MarketplacePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [activeFilter, setActiveFilter] = useState("All");
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [buyState, setBuyState] = useState<BuyState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.toLowerCase() ?? "";

  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;

  const { data: listings, isLoading, refetch } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getActiveListings",
    chainId: RITUAL_CHAIN_ID,
  });

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && buyState === "confirming" },
  });

  const displayBuyState = txConfirmed && buyState === "confirming" ? "success" : buyState;

  useEffect(() => {
    if (txConfirmed && buyState === "confirming") {
      void refetch();
    }
  }, [txConfirmed, buyState, refetch]);

  async function handleBuy(listingId: bigint, price: bigint) {
    if (!address || !isConnected) return;
    setErrorMsg(null);
    setBuyingId(listingId);

    try {
      if (isWrongNetwork) {
        setBuyState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      setBuyState("pending");
      const tx = await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "buyNFT",
        args: [listingId],
        value: price,
      });

      setTxHash(tx);
      setBuyState("confirming");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Buy failed";
      const short = message.includes("rejected") || message.includes("denied")
        ? "Transaction rejected."
        : "Buy failed. Try again.";
      setErrorMsg(short);
      setBuyState("error");
      setBuyingId(null);
    }
  }

  const sortedListings = listings ? [...listings]
    .filter((l) =>
      searchQuery
        ? `token #${l.tokenId.toString()}`.includes(searchQuery) ||
          l.seller.toLowerCase().includes(searchQuery) ||
          l.nftContract.toLowerCase().includes(searchQuery)
        : true
    )
    .sort((a, b) => {
      if (activeFilter === "Cheapest") return Number(a.price - b.price);
      if (activeFilter === "Most Recent") return Number(b.createdAt - a.createdAt);
      return 0;
    }) : [];

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#077345]/8 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-5xl md:text-6xl font-black leading-tight">
            Buy and sell<br />VastMint NFTs.
          </h1>
          <p className="text-zinc-500 mt-4 max-w-xl text-sm leading-relaxed">
            Explore live listings from VastMint collections deployed on Ritual Testnet.
          </p>
        </div>

        {/* Search indicator */}
        {searchQuery && (
          <div className="mb-6 flex items-center gap-3">
            <p className="text-zinc-400 text-sm">
              Search results for: <span className="text-white font-bold">&ldquo;{searchQuery}&rdquo;</span>
            </p>
            <Link
              href="/marketplace"
              className="text-xs text-zinc-600 hover:text-zinc-400 transition underline"
            >
              Clear
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Active Listings", value: listings ? listings.length.toString() : "—" },
            { label: "Platform Fee", value: "2%" },
            { label: "Creator Royalty", value: "5%" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] px-5 py-4 text-center">
              <p className="text-zinc-600 text-xs">{label}</p>
              <p className="text-white font-black text-xl mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium transition border ${
                activeFilter === f
                  ? "border-[#077345] bg-[#077345]/20 text-white"
                  : "border-[#077345]/20 text-zinc-500 hover:border-[#077345]/40 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}

          {isConnected && (
            <Link
              href="/dashboard"
              className="ml-auto rounded-xl px-5 py-2.5 text-sm font-medium border border-[#077345]/30 text-emerald-400 hover:bg-[#077345]/10 transition"
            >
              My NFTs / List
            </Link>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-800/40 bg-red-900/15 px-4 py-3">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] h-72 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && sortedListings.length === 0 && (
          <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-16 text-center">
            <p className="text-zinc-500 text-sm">
              {searchQuery ? `No listings found for "${searchQuery}".` : "No active listings yet."}
            </p>
            <p className="text-zinc-700 text-xs mt-2">
              {searchQuery ? "Try a different search term." : "Mint an NFT and list it for sale from your dashboard."}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              {searchQuery ? (
                <Link
                  href="/marketplace"
                  className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                >
                  View All Listings
                </Link>
              ) : (
                <>
                  <Link
                    href="/collections"
                    className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-5 py-3 text-sm font-bold text-white"
                  >
                    Mint NFT
                  </Link>
                  {isConnected && (
                    <Link
                      href="/dashboard"
                      className="rounded-xl border border-[#077345]/30 hover:bg-[#077345]/10 transition px-5 py-3 text-sm font-bold text-emerald-400"
                    >
                      My Dashboard
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Listings Grid */}
        {!isLoading && sortedListings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedListings.map((listing) => {
              const isMine = address?.toLowerCase() === listing.seller.toLowerCase();
              const isBuying = buyingId === listing.listingId && displayBuyState !== "idle" && displayBuyState !== "error" && displayBuyState !== "success";
              const priceInRitual = Number(listing.price) / 1e18;

              return (
                <div
                  key={listing.listingId.toString()}
                  className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden hover:border-[#077345]/40 transition-all duration-300"
                >
                  {/* NFT Image */}
                
     <Link href={`/nft/${listing.nftContract}/${listing.tokenId}`}>
  <div className="h-52 relative overflow-hidden bg-[#0d2518]">
    <img
      src="https://ipfs.io/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4"
      alt={`Token #${listing.tokenId.toString()}`}
      className="w-full h-full object-cover"
    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05150f] via-transparent to-transparent" />
                    {isMine && (
                      <div className="absolute top-3 right-3">
                        <span className="rounded-full border border-emerald-700/30 bg-emerald-900/40 px-2 py-0.5 text-xs font-bold text-emerald-400">
                          Yours
                        </span>
                      </div>
                    )}
                  </div>
                  </Link>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-white font-bold text-sm">Token #{listing.tokenId.toString()}</p>
                        <p className="text-zinc-600 text-xs mt-0.5">
                          {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                        </p>
                      </div>
                      <a
                        href={`${EXPLORER_URL}/address/${listing.nftContract}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 hover:text-emerald-400 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                        </svg>
                      </a>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-zinc-600 text-xs">Price</p>
                        <p className="text-emerald-400 font-black text-lg">{priceInRitual.toFixed(4)} RITUAL</p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-600 text-xs">Listed</p>
                        <p className="text-zinc-400 text-xs">
                          {new Date(Number(listing.createdAt) * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {isMine ? (
                      <CancelButton listingId={listing.listingId} onSuccess={() => refetch()} />
                    ) : (
                      <button
                        onClick={() => handleBuy(listing.listingId, listing.price)}
                        disabled={!isConnected || isBuying}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                          !isConnected
                            ? "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5"
                            : isBuying
                            ? "bg-[#077345]/60 text-white/70 cursor-not-allowed"
                            : "bg-[#077345] hover:bg-[#066039] text-white"
                        }`}
                      >
                        {isBuying && (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        )}
                        {!isConnected
                          ? "Connect Wallet"
                          : isBuying
                          ? displayBuyState === "switching" ? "Switching..." : displayBuyState === "pending" ? "Confirm..." : "Confirming..."
                          : `Buy for ${priceInRitual.toFixed(4)} RITUAL`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-zinc-700 text-xs mt-10">
          VastMint Marketplace · Ritual Testnet · Chain ID 1979 · 2% platform fee · 5% creator royalty
        </p>
      </div>
    </main>
  );
}

function CancelButton({ listingId, onSuccess }: { listingId: bigint; onSuccess: () => void }) {
  const { writeContractAsync } = useWriteContract();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await writeContractAsync({
        address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
        abi: VASTMINT_MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [listingId],
      });
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="w-full py-3 rounded-xl font-bold text-sm transition border border-red-800/40 text-red-400 hover:bg-red-900/15 disabled:opacity-50"
    >
      {cancelling ? "Cancelling..." : "Cancel Listing"}
    </button>
  );
}

export default function MarketplacePageWrapper() {
  return (
    <Suspense>
      <MarketplacePage />
    </Suspense>
  );
}