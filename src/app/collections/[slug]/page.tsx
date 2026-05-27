import Link from "next/link";

const collections = [
  {
    name: "Ritual Genesis",
    slug: "ritual-genesis",
    floor: "1.8 RITUAL",
    volume: "12.4K",
  },
  {
    name: "Shadow Nodes",
    slug: "shadow-nodes",
    floor: "2.1 RITUAL",
    volume: "8.7K",
  },
  {
    name: "AI Creator Vault",
    slug: "ai-creator-vault",
    floor: "0.9 RITUAL",
    volume: "5.3K",
  },
];

export default function CollectionsPage() {
  return (
    <main className="min-h-screen bg-[#05150f] text-white px-6 py-28">
      <div className="max-w-7xl mx-auto">
        <p className="text-[#077345] uppercase tracking-[0.25em] text-sm">
          Collections
        </p>

        <h1 className="text-5xl md:text-7xl font-black mt-4">
          Ritual NFT Collections
        </h1>

        <p className="text-zinc-400 mt-5 max-w-2xl">
          Discover curated NFT collections built inside the Ritual ecosystem.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group rounded-2xl overflow-hidden border border-[#077345]/10 bg-[#0b1f17] hover:border-[#077345]/40 transition"
            >
              <div className="h-64 bg-gradient-to-br from-[#077345]/30 to-black" />

              <div className="p-6">
                <h3 className="text-2xl font-bold group-hover:text-[#077345] transition">
                  {collection.name}
                </h3>

                <div className="mt-5 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-zinc-500">Floor</p>
                    <p className="font-bold">{collection.floor}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-zinc-500">Volume</p>
                    <p className="font-bold">{collection.volume}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}