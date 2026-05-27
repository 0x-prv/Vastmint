export default async function NFTDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-6 py-28">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="rounded-[2rem] overflow-hidden border border-[#077345]/20 bg-[#0b1f17]">
          <img
            src="https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?q=80&w=1200&auto=format&fit=crop"
            alt="NFT"
            className="w-full h-[620px] object-cover"
          />
        </div>

        <div>
          <p className="text-[#077345] uppercase tracking-[0.25em] text-sm">
            Ritual Genesis
          </p>

          <h1 className="text-5xl md:text-7xl font-black mt-4">
            Genesis #{id}
          </h1>

          <p className="text-zinc-400 mt-5">
            Native Ritual ecosystem NFT listed on VastMint.
          </p>

          <div className="mt-10 rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-6">
            <p className="text-zinc-500 text-sm">Current Price</p>
            <h2 className="text-4xl font-black mt-2">1.8 RITUAL</h2>

            <button className="mt-6 w-full bg-[#077345] hover:bg-[#066039] text-white font-bold py-4 rounded-xl transition">
              Buy Now
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            {[
              ["Owner", "0x7A...91F"],
              ["Token ID", id],
              ["Standard", "ERC-721"],
              ["Network", "Ritual"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[#077345]/10 bg-[#0b1f17] p-5"
              >
                <p className="text-zinc-500 text-sm">{label}</p>
                <p className="font-bold mt-2">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-2xl font-bold">Traits</h3>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {[
                ["Background", "Emerald Void"],
                ["Type", "Genesis"],
                ["Rarity", "Rare"],
                ["AI Layer", "Enabled"],
              ].map(([trait, value]) => (
                <div
                  key={trait}
                  className="rounded-2xl border border-[#077345]/10 bg-[#0b1f17] p-5"
                >
                  <p className="text-[#077345] text-sm">{trait}</p>
                  <p className="font-bold mt-2">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}