"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";

const HIDDEN_COLLECTIONS = [
  "0x19Ddd5Ad30114BB7728D546E71Af6dc747FE89c9",
  "0x8EBa1c8A529F71e08CB23C0Cda9606eaA1Ac7067",
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
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#1a4a2e]/5 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div className="mb-10">
          <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black">Collections</h1>
          <p className="text-[#4a6741] text-sm mt-2">Explore NFT collections deployed on Ritual Testnet.</p>
        </div>

        <div className="space-y-4">
          {factoryLoading && (
            <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] h-48 animate-pulse" />
          )}

          {visibleCollections.map((col) => {
            const imageUrl = col.image?.startsWith("ipfs://")
              ? `https://gateway.pinata.cloud/ipfs/${col.image.replace("ipfs://", "")}`
              : col.image;
            const isFree = col.mintPrice === 0n;

            return (
              <div key={col.contractAddress} className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] overflow-hidden hover:border-[#1a4a2e]/40 transition-all duration-300">
                <div className="flex flex-col sm:flex-row gap-0">
                  <div className="sm:w-56 sm:h-auto h-48 bg-gradient-to-br from-[#e8e3d8] via-[#e0dbd0] to-[#e0dbd0] flex items-center justify-center relative flex-shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full border border-[#1a4a2e]/10 animate-ping" style={{ animationDuration: "4s" }} />
                    </div>
                    <div className="relative z-10 w-28 h-28 rounded-2xl overflow-hidden shadow-lg shadow-[#1a4a2e]/10">
                      {imageUrl ? (
                        <img src={imageUrl} alt={col.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#1a4a2e]/20 flex items-center justify-center">
                          <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
                            <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" stroke="#1a4a2e" strokeWidth="1.5" fill="none" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-2 py-0.5 text-xs font-bold text-[#1a4a2e]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h2 className="text-xl font-black">{col.name}</h2>
                          <p className="text-[#7a9e7a] text-xs mt-0.5">by {col.creator.slice(0, 6)}...{col.creator.slice(-4)} · ERC-721 · Ritual Testnet</p>
                        </div>
                        <span className="text-xs font-bold text-[#1a4a2e] border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 rounded-full px-3 py-1">
                          {col.symbol}
                        </span>
                      </div>
                      <p className="text-[#4a6741] text-sm mt-3 leading-relaxed line-clamp-2">{col.description}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-[#e0dbd0]/30 border border-[#1a4a2e]/15 px-4 py-3 text-center">
                        <p className="text-[#7a9e7a] text-xs">Supply</p>
                        <p className="text-[#1a2e1a] font-black mt-0.5">{Number(col.maxSupply).toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl bg-[#e0dbd0]/30 border border-[#1a4a2e]/15 px-4 py-3 text-center">
                        <p className="text-[#7a9e7a] text-xs">Price</p>
                        <p className={`font-black mt-0.5 ${isFree ? "text-[#1a4a2e]" : "text-[#1a2e1a]"}`}>
                          {isFree ? "Free" : `${Number(col.mintPrice) / 1e18} RITUAL`}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#e0dbd0]/30 border border-[#1a4a2e]/15 px-4 py-3 text-center">
                        <p className="text-[#7a9e7a] text-xs">Deployed</p>
                        <p className="text-[#1a2e1a] font-black mt-0.5 text-xs">
                      {Number(col.createdAt) > 1000000000 &&
                      Number(col.createdAt) < 9999999999
                  ? new Date(Number(col.createdAt) * 1000).toLocaleDateString()
               : "Legacy"}
                   </p>
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <Link
                        href={`/collections/${col.slug}/mint`}
                        className="flex-1 flex items-center justify-center rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-4 py-3 text-sm font-bold text-[#f5f0e8]"
                      >
                        Mint Now
                      </Link>
                      <a
                        href={`${EXPLORER_URL}/address/${col.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center rounded-xl border border-[#1a4a2e]/15 hover:bg-[#1a4a2e]/10 transition px-4 py-3 text-sm font-bold text-[#4a6741] hover:text-[#1a2e1a] gap-1.5"
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

        <p className="text-center text-[#7a9e7a] text-xs mt-8">
          Showing all collections on Ritual Testnet · Chain ID 1979
        </p>
      </div>
    </main>
  );
}
