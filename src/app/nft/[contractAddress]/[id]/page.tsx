"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useReadContract, useAccount } from "wagmi";
import {
  VASTMINT_NFT_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import { VASTMINT_NFT_ABI } from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";

const GENESIS_PASS_ADDRESS = VASTMINT_NFT_ADDRESS.toLowerCase();

const GENESIS_PASS_META = {
  name: "Ritual Genesis Pass",
  description:
    "The founding collection of VastMint — minted on Ritual testnet. Each pass represents early access to the native NFT ecosystem of Ritual. Holders are recognized as founding supporters of VastMint.",
  image:
    "https://ipfs.io/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4",
  collection: "Ritual Genesis Pass",
  symbol: "RGP",
  price: "Free",
  supply: 1000,
  royalty: "0%",
  category: "Access Pass",
};

const MOCK_ACTIVITY = [
  { event: "Mint", to: "0x7A3F...91F2", price: "Free", time: "2 hours ago" },
  { event: "Mint", to: "0xB2C1...44D9", price: "Free", time: "5 hours ago" },
  { event: "Mint", to: "0xF9A0...C31E", price: "Free", time: "1 day ago" },
  { event: "Mint", to: "0x3344...88AB", price: "Free", time: "1 day ago" },
  { event: "Mint", to: "0xDE11...09FA", price: "Free", time: "2 days ago" },
];

export default function NFTDetailPage() {
  const { contractAddress, id } = useParams<{
    contractAddress: string;
    id: string;
  }>();

  const { address: connectedAddress } = useAccount();
  const [copied, setCopied] = useState(false);

  const isGenesisPass =
    contractAddress?.toLowerCase() === GENESIS_PASS_ADDRESS;

  const meta = isGenesisPass ? GENESIS_PASS_META : null;

  const { data: totalSupply } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "totalSupply",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) },
  });

  const { data: ownerOf, isLoading: ownerLoading } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: VASTMINT_NFT_ABI,
    functionName: "ownerOf",
    args: [BigInt(id ?? "0")],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: Boolean(contractAddress) && Boolean(id) },
  });

  const minted = totalSupply ? Number(totalSupply) : 0;
  const owner = ownerOf as string | undefined;
  const shortOwner = owner
    ? `${owner.slice(0, 6)}...${owner.slice(-4)}`
    : null;
  const isOwner =
    connectedAddress && owner
      ? owner.toLowerCase() === connectedAddress.toLowerCase()
      : false;

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!meta) {
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
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 mb-8">
          <a href="/collections" className="hover:text-zinc-400 transition">
            Collections
          </a>
          <span>/</span>
          <a
            href={`/collections/ritual-genesis-pass`}
            className="hover:text-zinc-400 transition"
          >
            {meta.collection}
          </a>
          <span>/</span>
          <span className="text-zinc-400">#{id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden border border-[#077345]/20 bg-[#0b1f17] aspect-square relative group">
              <img
                src={meta.image}
                alt={`${meta.name} #${id}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={meta.image}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center hover:bg-black/80 transition"
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                  </svg>
                </a>
              </div>
              <div className="absolute bottom-4 left-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/40 bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Early Supporter
                </span>
              </div>
            </div>

            {/* Details card */}
            <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] p-5">
              <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">
                Details
              </p>
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
                      {contractAddress?.slice(0, 6)}...{contractAddress?.slice(-4)}
                    </a>
                    <button
                      onClick={copyAddress}
                      className="text-zinc-600 hover:text-zinc-300 transition"
                      title="Copy address"
                    >
                      {copied ? (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {[
                  ["Token ID", `#${id}`],
                  ["Token Standard", "ERC-721"],
                  ["Network", "Ritual Testnet"],
                  ["Chain ID", "1979"],
                  ["Total Minted", `${minted.toLocaleString()} / ${meta.supply.toLocaleString()}`],
                  ["Royalty", meta.royalty],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-mono text-xs text-zinc-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <p className="text-[#077345] uppercase tracking-[0.2em] text-xs font-bold mb-2">
                {meta.collection}
              </p>
              <h1 className="text-5xl sm:text-6xl font-black leading-none">
                Genesis #{id}
              </h1>
              <p className="text-zinc-500 mt-4 leading-relaxed text-sm">
                {meta.description}
              </p>
            </div>

            {/* Owner */}
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

            {/* Price + Actions */}
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-6 space-y-5">
              <div>
                <p className="text-zinc-600 text-xs uppercase tracking-widest mb-1">
                  Mint Price
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-emerald-400">Free</span>
                  <span className="text-zinc-600 text-sm">on Ritual Testnet</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <a
                  href="/collections/ritual-genesis-pass/mint"
                  className="w-full flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-4 text-sm font-bold text-white"
                >
                  Mint Another
                </a>
                <a
                  href={`${EXPLORER_URL}/token/${contractAddress}?a=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 transition px-4 py-4 text-sm font-bold text-zinc-400 hover:text-zinc-200"
                >
                  View on Explorer
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Supply", "1,000"],
                ["Minted", minted.toLocaleString()],
                ["Royalty", "0%"],
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

            {/* Activity */}
            <div className="rounded-2xl border border-[#077345]/15 bg-[#0b1f17] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#077345]/10">
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                  Activity
                </p>
              </div>
              <div className="divide-y divide-[#077345]/10">
                {MOCK_ACTIVITY.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full border border-emerald-700/30 bg-emerald-900/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                        {item.event}
                      </span>
                      <span className="text-zinc-500 text-xs">
                        To{" "}
                        <span className="font-mono text-zinc-300">{item.to}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-xs font-bold">{item.price}</p>
                      <p className="text-zinc-600 text-xs">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer explorer link */}
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