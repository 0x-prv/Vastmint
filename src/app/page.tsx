import Navbar from "@/components/Navbar";

const featuredNFTs = [
  {
    title: "Neon Monk #204",
    image:
      "https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Ritual Reaper #88",
    image:
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "Shadow Node #12",
    image:
      "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=1200&auto=format&fit=crop",
  },
  {
    title: "AI Vault #19",
    image:
      "https://images.unsplash.com/photo-1618005198919-d3d4b5a92eee?q=80&w=1200&auto=format&fit=crop",
  },
];

const topCollections = [
  {
    name: "FREAKS",
    floor: "0.0119 ETH",
    change: "+50.8%",
    offer: "0.0095 WETH",
    volume: "1.30 ETH",
    sales: "132",
  },
  {
    name: "Ritual Genesis",
    floor: "0.038 ETH",
    change: "+38%",
    offer: "0.030 WETH",
    volume: "3.28 ETH",
    sales: "91",
  },
  {
    name: "Shadow Nodes",
    floor: "0.018 ETH",
    change: "+60%",
    offer: "0.0048 WETH",
    volume: "0.53 ETH",
    sales: "51",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">

      <Navbar />

      {/* HERO */}
      <section className="relative px-6 pt-36 pb-20">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.12),transparent_40%)]" />

        <div className="max-w-7xl mx-auto relative z-10">

          <p className="text-green-400 uppercase tracking-[0.25em] text-sm">
            The native NFT marketplace of Ritual
          </p>

          <h1 className="text-6xl md:text-8xl font-black mt-6 leading-none">
            Discover Ritual NFTs.
          </h1>

          <p className="text-zinc-400 mt-6 text-lg max-w-2xl leading-relaxed">
            Buy, sell, and launch collections inside the Ritual ecosystem through a premium AI-native marketplace experience.
          </p>

        </div>

      </section>

      {/* FEATURED NFTS */}
      <section className="pb-24 overflow-hidden">

        <div className="px-6 mb-10">

          <div className="max-w-7xl mx-auto flex items-center justify-between">

            <div>
              <p className="text-green-400 uppercase tracking-[0.25em] text-sm">
                Featured NFTs
              </p>

              <h2 className="text-4xl font-black mt-3">
                Trending on VastMint
              </h2>
            </div>

          </div>

        </div>

        <div className="flex gap-6 overflow-x-auto px-6 scrollbar-hide">

          {featuredNFTs.map((nft) => (
            <div
              key={nft.title}
              className="min-w-[350px] rounded-2xl overflow-hidden border border-green-500/10 bg-zinc-900 group"
            >

              <div className="h-[420px] relative overflow-hidden">

                <img
                  src={nft.image}
                  alt={nft.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              </div>

              <div className="p-6">

                <div className="flex items-center justify-between">

                  <div>
                    <h3 className="text-2xl font-bold">
                      {nft.title}
                    </h3>

                    <p className="text-zinc-500 mt-1">
                      Ritual Collection
                    </p>
                  </div>

                  <button className="bg-green-400 text-black font-bold px-5 py-3 rounded-xl">
                    Buy
                  </button>

                </div>

              </div>

            </div>
          ))}

        </div>

      </section>

      {/* TOP COLLECTIONS */}
      <section className="px-6 pb-32">

        <div className="max-w-7xl mx-auto">

          <div className="flex flex-wrap items-center justify-between gap-6 mb-10">

            <div>
              <p className="text-green-400 uppercase tracking-[0.25em] text-sm">
                Rankings
              </p>

              <h2 className="text-4xl font-black mt-3">
                Top Collections
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">

              {["All", "30d", "7d", "1d", "1h", "15m", "5m", "1m"].map((filter) => (
                <button
                  key={filter}
                  className={`px-5 py-3 rounded-xl border transition ${
                    filter === "1d"
                      ? "bg-green-400 text-black border-green-400"
                      : "border-green-500/20 hover:border-green-400 hover:bg-green-500/10"
                  }`}
                >
                  {filter}
                </button>
              ))}

            </div>

          </div>

          <div className="overflow-x-auto rounded-2xl border border-green-500/10 bg-zinc-950">

            <table className="w-full min-w-[1000px]">

              <thead className="border-b border-green-500/10 text-zinc-500 text-sm uppercase">

                <tr>
                  <th className="text-left px-6 py-5">Collection</th>
                  <th className="text-left">Floor Price</th>
                  <th className="text-left">1d Change</th>
                  <th className="text-left">Top Offer</th>
                  <th className="text-left">1d Volume</th>
                  <th className="text-left">1d Sales</th>
                </tr>

              </thead>

              <tbody>

                {topCollections.map((collection) => (
                  <tr
                    key={collection.name}
                    className="border-b border-green-500/5 hover:bg-green-500/5 transition"
                  >

                    <td className="px-6 py-6 font-bold">
                      {collection.name}
                    </td>

                    <td>{collection.floor}</td>

                    <td className="text-green-400 font-bold">
                      {collection.change}
                    </td>

                    <td>{collection.offer}</td>

                    <td>{collection.volume}</td>

                    <td>{collection.sales}</td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        </div>

      </section>

    </main>
  );
}