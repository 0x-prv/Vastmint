"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import {
  VASTMINT_FACTORY_ADDRESS,
  VASTMINT_MARKETPLACE_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI, VASTMINT_MARKETPLACE_ABI } from "@/lib/blockchain/abi";

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

const GENESIS_PASS_IMAGE =
  "https://ipfs.io/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4";

function resolveImage(image: string) {
  if (!image) return GENESIS_PASS_IMAGE;
  if (image.startsWith("ipfs://"))
    return `https://ipfs.io/ipfs/${image.replace("ipfs://", "")}`;
  return image;
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function HomePage() {
  const { data: collections, isLoading: collectionsLoading } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
  });

  const { data: activeListings, isLoading: listingsLoading } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getActiveListings",
    chainId: RITUAL_CHAIN_ID,
  });

  const allCollections = [...((collections as Collection[] | undefined) ?? [])];

  const featuredListings = ((activeListings as Listing[] | undefined) ?? []).slice(0, 4);

  return (
    <main className="min-h-screen bg-[#05150f] text-white overflow-hidden">
      {/* BG glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#077345]/7 rounded-full blur-[160px]" />
      </div>

      {/* HERO */}
      <section className="relative px-6 pt-36 pb-20">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-emerald-900/20 px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-emerald-400 uppercase tracking-[0.2em] text-xs font-bold">
             Live on Ritual Testnet
            </p>
          </div>

          <h1 className="text-6xl md:text-8xl font-black mt-2 leading-none">
            Discover Ritual NFTs.
          </h1>

          <p className="text-zinc-400 mt-6 text-lg max-w-2xl leading-relaxed">
            VastMint is currently live on Ritual Testnet. Mint, list, and explore
            NFTs inside the Ritual ecosystem — for free.
          </p>

          <div className="flex flex-wrap gap-4 mt-8">
            <Link
              href="/collections"
              className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-6 py-3 text-sm font-bold text-white"
            >
              Explore Collections
            </Link>
            <Link
              href="/launchpad"
              className="rounded-xl border border-white/10 hover:bg-white/5 transition px-6 py-3 text-sm font-bold text-zinc-300"
            >
              Launch Your NFT
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED — Active Listings */}
      <section className="pb-24 overflow-hidden">
        <div className="px-6 mb-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[#077345] uppercase tracking-[0.2em] text-xs font-bold">
                Featured NFTs
              </p>
              <h2 className="text-4xl font-black mt-2">
                {listingsLoading
                  ? "Loading..."
                  : featuredListings.length > 0
                  ? "Listed on VastMint"
                  : "Trending on VastMint"}
              </h2>
            </div>
            <Link
              href="/marketplace"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition font-bold"
            >
              View all →
            </Link>
          </div>
        </div>

        <div className="flex gap-6 overflow-x-auto px-6 pb-2 scrollbar-hide">
          {listingsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[320px] h-[480px] rounded-2xl border border-[#077345]/10 bg-[#0b1f17] animate-pulse flex-shrink-0"
              />
            ))
          ) : featuredListings.length > 0 ? (
            featuredListings.map((listing) => (
              <Link
                key={listing.listingId}
                href={`/nft/${listing.nftContract}/${listing.tokenId}`}
                className="min-w-[320px] rounded-2xl overflow-hidden border border-[#077345]/15 bg-[#0b1f17] group flex-shrink-0 hover:border-[#077345]/40 transition"
              >
                <div className="h-[380px] relative overflow-hidden bg-[#0d2518]">
                  <img
                    src={GENESIS_PASS_IMAGE}
                    alt={`Token #${listing.tokenId}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05150f] via-transparent to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/50 px-2.5 py-1 text-xs font-bold text-emerald-400">
                      Listed
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black">
                        Genesis #{Number(listing.tokenId)}
                      </h3>
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {shortAddress(listing.seller)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-600 text-xs">Price</p>
                      <p className="text-emerald-400 font-black">
                        {Number(listing.price) / 1e18} RITUAL
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            /* Fallback — Genesis Pass card pag walang listings */
            <Link
              href={`/nft/0x8EBa1c8A529F71e08CB23C0Cda9606eaA1Ac7067/0`}
              className="min-w-[320px] rounded-2xl overflow-hidden border border-[#077345]/15 bg-[#0b1f17] group flex-shrink-0 hover:border-[#077345]/40 transition"
            >
              <div className="h-[380px] relative overflow-hidden bg-[#0d2518]">
                <img
                  src={GENESIS_PASS_IMAGE}
                  alt="Ritual Genesis Pass"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05150f] via-transparent to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/50 px-2.5 py-1 text-xs font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Mint
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black">Ritual Genesis Pass</h3>
                    <p className="text-zinc-600 text-xs mt-0.5">by VastMint</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-600 text-xs">Price</p>
                    <p className="text-emerald-400 font-black">Free</p>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* TOP COLLECTIONS */}
      <section className="px-6 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#077345] uppercase tracking-[0.2em] text-xs font-bold">
                Collections
              </p>
              <h2 className="text-4xl font-black mt-2">All Collections</h2>
            </div>
            <Link
              href="/collections"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition font-bold"
            >
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#077345]/15 bg-[#0b1f17]">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-[#077345]/10 text-zinc-600 text-xs uppercase tracking-widest">
                <tr>
                  <th className="text-left px-6 py-4">#</th>
                  <th className="text-left px-4 py-4">Collection</th>
                  <th className="text-left px-4 py-4">Supply</th>
                  <th className="text-left px-4 py-4">Price</th>
                  <th className="text-left px-4 py-4">Network</th>
                  <th className="text-left px-4 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {collectionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#077345]/5">
                      <td colSpan={6} className="px-6 py-5">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  allCollections.map((col, i) => {
                    const isFree = col.mintPrice === BigInt(0);
                    const imageUrl = resolveImage(col.image);
                    return (
                      <tr
                        key={col.contractAddress}
                        className="border-b border-[#077345]/5 hover:bg-[#077345]/5 transition"
                      >
                        <td className="px-6 py-5 text-zinc-600 text-sm font-bold">
                          {i + 1}
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#0d2518]">
                              <img
                                src={imageUrl}
                                alt={col.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-black text-sm">{col.name}</p>
                              <p className="text-zinc-600 text-xs font-mono">
                                {col.symbol}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm text-zinc-300 font-bold">
                          {Number(col.maxSupply).toLocaleString()}
                        </td>
                        <td className="px-4 py-5">
                          <span
                            className={`text-sm font-black ${
                              isFree ? "text-emerald-400" : "text-white"
                            }`}
                          >
                            {isFree
                              ? "Free"
                              : `${Number(col.mintPrice) / 1e18} RITUAL`}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Ritual Testnet
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <Link
                            href={`/collections/${col.slug}/mint`}
                            className="rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-2 text-xs font-bold text-white"
                          >
                            Mint
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-center text-zinc-700 text-xs mt-6">
            All collections on Ritual Testnet · Chain ID 1979
          </p>
        </div>
      </section>
    </main>
  );
}