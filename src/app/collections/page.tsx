"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";

const HIDDEN_COLLECTIONS = [
  "0x19Ddd5Ad30114BB7728D546E71Af6dc747FE89c9",
].map(a => a.toLowerCase());

export default function CollectionsPage() {
  const { data: factoryCollections, isLoading: factoryLoading } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const visibleCollections = (factoryCollections ?? []).filter(
    col => !HIDDEN_COLLECTIONS.includes(col.contractAddress.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#077345]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div className="mb-10">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black">Collections</h1>
          <p className="text-zinc-500 text-sm mt-2">Explore NFT collections deployed on Ritual Testnet.</p>
        </div>

        <div className="space-y-4">
          {factoryLoading && (
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] h-48 animate-pulse" />
          )}

          {visibleCollections.map((col) => {
            const imageUrl = col.image?.startsWith("ipfs://")
              ? `https://ipfs.io/ipfs/${col.image.replace("ipfs://", "")}`
              : col.image;
            const isFree = col.mintPrice === 0n;

            return (
              <div key={col.contractAddress} className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden hover:border-[#077345]/40 transition-all duration-300">
                <div className="flex flex-col sm:flex-row gap-0">
                  <div className="sm:w-56 sm:h-auto h-48 bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center relative flex-shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border border-[#077345]/10 animate-ping" style={{ animationDuration: "4s" }} />
                    </div>
                    <div className="relative z-10 w-28 h-28 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
                      {imageUrl ? (
                        <img src={imageUrl} alt={col.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#077345]/20 flex items-center justify-center">
                          <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
                            <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" stroke="#077345" strokeWidth="1.5" fill="none" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/40 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h2 className="text-xl font-black">{col.name}</h2>
                          <p className="text-zinc-600 text-xs mt-0.5">by {col.creator.slice(0, 6)}...{col.creator.slice(-4)} · ERC-721 · Ritual Testnet</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 border border-emerald-700/30 bg-emerald-900/20 rounded-full px-3 py-1">
                          {col.symbol}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-sm mt-3 leading-relaxed line-clamp-2">{col.description}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-center">
                        <p className="text-zinc-600 text-xs">Supply</p>
                        <p className="text-white font-black mt-0.5">{Number(col.maxSupply).toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-center">
                        <p className="text-zinc-600 text-xs">Price</p>
                        <p className={`font-black mt-0.5 ${isFree ? "text-emerald-400" : "text-white"}`}>
                          {isFree ? "Free" : `${Number(col.mintPrice) / 1e18} RITUAL`}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-center">
                        <p className="text-zinc-600 text-xs">Deployed</p>
                        <p className="text-white font-black mt-0.5 text-xs">
                          {new Date(Number(col.createdAt) * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <Link
                        href={`/collections/${col.slug}/mint`}
                        className="flex-1 flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-3 text-sm font-bold text-white"
                      >
                        Mint Now
                      </Link>
                      <a
                        href={`${EXPLORER_URL}/address/${col.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-xl border border-white/5 hover:bg-white/5 transition px-4 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-300 gap-1.5"
                      >
                        Explorer
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-8">
          Showing all collections on Ritual Testnet · Chain ID 1979
        </p>
      </div>
    </main>
  );
}