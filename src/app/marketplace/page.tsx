import Link from "next/link";

const marketplaceItems = [
  "Neon Monk #204",
  "VastMint Reaper #88",
  "Shadow Node #12",
  "AI Vault #19",
  "Genesis Pass #7",
  "Dark Oracle #44",
];

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-[#05150f] text-white px-6 py-28">
      <div className="max-w-7xl mx-auto">
        <p className="text-[#077345] uppercase tracking-[0.25em] text-sm">
          VastMint Marketplace
        </p>

        <h1 className="text-5xl md:text-7xl font-black mt-4">
          Buy and sell VastMint NFTs.
        </h1>

        <p className="text-zinc-400 mt-5 max-w-2xl">
          Explore VastMint-native collections, live listings, floor prices, and ecosystem drops.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {["All", "Trending", "New", "AI Native", "Launchpad"].map((item) => (
            <button
              key={item}
              className="border border-[#077345]/20 hover:border-[#077345] hover:bg-[#077345]/10 rounded-xl px-5 py-3 transition"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {marketplaceItems.map((name, index) => (
            <Link
              href={`/nft/${index + 1}`}
              key={name}
              className="group rounded-2xl overflow-hidden border border-[#077345]/10 bg-[#0b1f17] hover:border-[#077345]/30 transition block"
            >
              <div className="h-72 bg-gradient-to-br from-[#077345]/25 to-black" />

              <div className="p-6">
                <h3 className="text-xl font-bold">{name}</h3>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-sm">Price</p>
                    <p className="text-[#077345] font-bold">
                      {((index + 2) * 0.41).toFixed(2)} RITUAL
                    </p>
                  </div>

                  <span className="bg-[#077345] text-white font-bold px-4 py-2 rounded-xl">
                    Buy
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}