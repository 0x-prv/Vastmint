import Link from "next/link";

const nftItems = [
  {
    id: 1,
    name: "Genesis #12",
    price: "1.8 RITUAL",
    image:
      "https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: 2,
    name: "Genesis #88",
    price: "2.4 RITUAL",
    image:
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: 3,
    name: "Genesis #201",
    price: "1.1 RITUAL",
    image:
      "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=1200&auto=format&fit=crop",
  },
];

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-[#05150f] text-white pb-24">

      {/* BANNER */}
      <div className="h-[320px] bg-gradient-to-br from-[#077345] to-black relative">
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* COLLECTION INFO */}
      <section className="max-w-7xl mx-auto px-6 relative -mt-24 z-10">

        <div className="w-40 h-40 rounded-3xl overflow-hidden border-4 border-[#05150f] shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?q=80&w=1200&auto=format&fit=crop"
            alt="Collection"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="mt-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">

          <div>

            <p className="text-[#077345] uppercase tracking-[0.25em] text-sm">
              Ritual Collection
            </p>

            <h1 className="text-5xl md:text-7xl font-black mt-4">
              {slug.replace("-", " ")}
            </h1>

            <p className="text-zinc-400 mt-6 max-w-2xl leading-relaxed">
              Native Ritual ecosystem NFT collection powered by VastMint.
            </p>

          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {[
              ["Items", "1,240"],
              ["Owners", "428"],
              ["Floor", "1.8 RITUAL"],
              ["Volume", "12.4K"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-5 min-w-[140px]"
              >
                <p className="text-zinc-500 text-sm">
                  {label}
                </p>

                <h3 className="text-2xl font-bold mt-2">
                  {value}
                </h3>
              </div>
            ))}

          </div>

        </div>

      </section>

      {/* NFT GRID */}
      <section className="max-w-7xl mx-auto px-6 mt-20">

        <div className="flex flex-wrap items-center justify-between gap-6 mb-10">

          <h2 className="text-4xl font-black">
            Collection Items
          </h2>

          <div className="flex gap-3">

            {["All", "Rare", "Legendary", "AI Native"].map((filter) => (
              <button
                key={filter}
                className="border border-[#077345]/20 hover:border-[#077345] hover:bg-[#077345]/10 rounded-xl px-5 py-3 transition"
              >
                {filter}
              </button>
            ))}

          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {nftItems.map((nft) => (
            <Link
              href={`/nft/${nft.id}`}
              key={nft.id}
              className="rounded-3xl overflow-hidden border border-[#077345]/10 bg-[#0b1f17] hover:border-[#077345]/30 transition-all duration-300 block"
            >

              <div className="h-[380px] overflow-hidden">
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover hover:scale-110 transition duration-700"
                />
              </div>

              <div className="p-6">

                <div className="flex items-center justify-between">

                  <div>
                    <h3 className="text-2xl font-bold">
                      {nft.name}
                    </h3>

                    <p className="text-zinc-500 mt-1">
                      VastMint
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[#077345] font-bold">
                      {nft.price}
                    </p>

                    <p className="text-zinc-500 text-sm">
                      Current Price
                    </p>
                  </div>

                </div>

                <button className="mt-6 w-full bg-[#077345] hover:bg-[#066039] text-white font-bold py-3 rounded-xl transition-all">
                  Buy NFT
                </button>

              </div>

            </Link>
          ))}

        </div>

      </section>

    </main>
  );
}