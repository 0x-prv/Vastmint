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

const FALLBACK_IMAGE =
  "https://gateway.pinata.cloud/ipfs/bafybeighztad3kvdoylfubv2rn6vjpp5piwnjzxrtv7mx7ur67pnvx4yd4";

function resolveImage(image: string) {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("ipfs://"))
    return `https://gateway.pinata.cloud/ipfs/${image.replace("ipfs://", "")}`;
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

const featuredListings = [...((activeListings as Listing[] | undefined) ?? [])].slice(0, 4);
  // Helper: get collection info for a listing
  function getCollectionForListing(listing: Listing): Collection | undefined {
    return allCollections.find(
      (c) => c.contractAddress.toLowerCase() === listing.nftContract.toLowerCase()
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] overflow-hidden">
      {/* BG glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#1a4a2e]/5 rounded-full blur-[160px]" />
      </div>

      {/* HERO */}
      <section className="relative px-6 pt-10 pb-20">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
            <p className="text-[#1a4a2e] uppercase tracking-[0.2em] text-xs font-bold">
              Live on Ritual Testnet
            </p>
          </div>

          <h1 className="text-6xl md:text-8xl font-black mt-2 leading-none">
            Discover Ritual NFTs.
          </h1>

          <p className="text-[#4a6741] mt-6 text-lg max-w-2xl leading-relaxed">
            VastMint is currently live on Ritual Testnet. Mint, list, and explore
            NFTs inside the Ritual ecosystem.
          </p>

          <div className="flex flex-wrap gap-4 mt-8">
            <Link
              href="/collections"
              className="rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-6 py-3 text-sm font-bold text-[#f5f0e8]"
            >
              Explore Collections
            </Link>
            <Link
              href="/launchpad"
              className="rounded-xl border border-[#1a4a2e]/20 hover:bg-[#1a4a2e]/10 transition px-6 py-3 text-sm font-bold text-[#1a2e1a]"
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
              <p className="text-[#1a4a2e] uppercase tracking-[0.2em] text-xs font-bold">
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
              className="text-sm text-[#4a6741] hover:text-[#1a2e1a] transition font-bold"
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
                className="min-w-[320px] h-[480px] rounded-2xl border border-[#1a4a2e]/10 bg-[#ede8df] animate-pulse flex-shrink-0"
              />
            ))
          ) : featuredListings.length > 0 ? (
            // ── Real listings — show actual collection image and name ──
            featuredListings.map((listing) => {
              const col = getCollectionForListing(listing);
              const image = col ? resolveImage(col.image) : FALLBACK_IMAGE;
              const nftName = col
                ? `${col.name} #${Number(listing.tokenId)}`
                : `Token #${Number(listing.tokenId)}`;

              return (
                <Link
                  key={listing.listingId}
                  href={`/nft/${listing.nftContract}/${listing.tokenId}`}
                  className="min-w-[320px] rounded-2xl overflow-hidden border border-[#1a4a2e]/15 bg-[#ede8df] group flex-shrink-0 hover:border-[#1a4a2e]/40 transition"
                >
                  <div className="h-[380px] relative overflow-hidden bg-[#e8e3d8]">
                    <img
                      src={image}
                      alt={nftName}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#f5f0e8] via-transparent to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-2.5 py-1 text-xs font-bold text-[#1a4a2e]">
                        Listed
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black">{nftName}</h3>
                        <p className="text-[#7a9e7a] text-xs mt-0.5">
                          {shortAddress(listing.seller)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#7a9e7a] text-xs">Price</p>
                        <p className="text-[#1a4a2e] font-black">
                          {Number(listing.price) / 1e18} RITUAL
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            // ── Fallback — show first real collection, or empty state ──
            allCollections.length > 0 ? (
              <Link
                href={`/collections/${allCollections[0].slug}/mint`}
                className="min-w-[320px] rounded-2xl overflow-hidden border border-[#1a4a2e]/15 bg-[#ede8df] group flex-shrink-0 hover:border-[#1a4a2e]/40 transition"
              >
                <div className="h-[380px] relative overflow-hidden bg-[#e8e3d8]">
                  <img
                    src={resolveImage(allCollections[0].image)}
                    alt={allCollections[0].name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#f5f0e8] via-transparent to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-2.5 py-1 text-xs font-bold text-[#1a4a2e]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                      Live Mint
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black">{allCollections[0].name}</h3>
                      <p className="text-[#7a9e7a] text-xs mt-0.5">by VastMint</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#7a9e7a] text-xs">Price</p>
                      <p className="text-[#1a4a2e] font-black">
                        {allCollections[0].mintPrice === 0n
                          ? "Free"
                          : `${Number(allCollections[0].mintPrice) / 1e18} RITUAL`}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="min-w-[320px] rounded-2xl border border-[#1a4a2e]/10 bg-[#ede8df] flex items-center justify-center h-[480px] flex-shrink-0">
                <p className="text-[#7a9e7a] text-sm">No collections yet</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* TOP COLLECTIONS */}
      <section className="px-6 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[#1a4a2e] uppercase tracking-[0.2em] text-xs font-bold">
                Collections
              </p>
              <h2 className="text-4xl font-black mt-2">All Collections</h2>
            </div>
            <Link
              href="/collections"
              className="text-sm text-[#4a6741] hover:text-[#1a2e1a] transition font-bold"
            >
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#1a4a2e]/15 bg-[#ede8df]">
            <table className="w-full min-w-[700px]">
              <thead className="border-b border-[#1a4a2e]/10 text-[#7a9e7a] text-xs uppercase tracking-widest">
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
                    <tr key={i} className="border-b border-[#1a4a2e]/5">
                      <td colSpan={6} className="px-6 py-5">
                        <div className="h-4 bg-[#e0dbd0] rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : allCollections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[#7a9e7a] text-sm">
                      No collections yet. Be the first to launch!
                    </td>
                  </tr>
                ) : (
                  allCollections.map((col, i) => {
                    const isFree = col.mintPrice === BigInt(0);
                    const imageUrl = resolveImage(col.image);
                    return (
                      <tr
                        key={col.contractAddress}
                        className="border-b border-[#1a4a2e]/5 hover:bg-[#1a4a2e]/5 transition"
                      >
                        <td className="px-6 py-5 text-[#7a9e7a] text-sm font-bold">
                          {i + 1}
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#e8e3d8]">
                              <img
                                src={imageUrl}
                                alt={col.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-black text-sm">{col.name}</p>
                              <p className="text-[#7a9e7a] text-xs font-mono">{col.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm text-[#1a2e1a] font-bold">
                          {Number(col.maxSupply).toLocaleString()}
                        </td>
                        <td className="px-4 py-5">
                          <span className={`text-sm font-black ${isFree ? "text-[#1a4a2e]" : "text-[#1a2e1a]"}`}>
                            {isFree ? "Free" : `${Number(col.mintPrice) / 1e18} RITUAL`}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#1a4a2e]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                            Ritual Testnet
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <Link
                            href={`/collections/${col.slug}/mint`}
                            className="rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-4 py-2 text-xs font-bold text-[#f5f0e8]"
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

          <p className="text-center text-[#7a9e7a] text-xs mt-6">
            All collections on Ritual Testnet · Chain ID 1979
          </p>
        </div>
      </section>
    </main>
  );
}
