export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <div className="max-w-7xl mx-auto">
        <p className="text-green-400 uppercase tracking-[0.25em] text-sm">
          RitualMP Marketplace
        </p>

        <h1 className="text-5xl md:text-7xl font-black mt-4">
          Buy and sell Ritual NFTs.
        </h1>

        <p className="text-zinc-400 mt-5 max-w-2xl">
          Explore Ritual-native collections, live listings, floor prices, and ecosystem drops.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {["All", "Trending", "New", "AI Native", "Launchpad"].map((item) => (
            <button
              key={item}
              className="border border-green-500/20 hover:border-green-400 hover:bg-green-500/10 rounded-xl px-5 py-3 transition"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {["Neon Monk #204", "Ritual Reaper #88", "Shadow Node #12", "AI Vault #19", "Genesis Pass #7", "Dark Oracle #44"].map((name, index) => (
            <div
              key={name}
              className="group rounded-3xl overflow-hidden border border-green-500/10 bg-zinc-900 hover:border-green-400/30 transition"
            >
              <div className="h-72 bg-gradient-to-br from-green-500/20 to-black" />

              <div className="p-6">
                <h3 className="text-xl font-bold">{name}</h3>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-zinc-500 text-sm">Price</p>
                    <p className="text-green-400 font-bold">{(index + 2) * 0.41} ETH</p>
                  </div>

                  <button className="bg-green-400 text-black font-bold px-4 py-2 rounded-xl">
                    Buy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}