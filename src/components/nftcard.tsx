type NFTCardProps = {
  title: string;
  collection: string;
  price: string;
  image: string;
  badge?: string;
};

export default function NFTCard({
  title,
  collection,
  price,
  image,
  badge,
}: NFTCardProps) {
  return (
    <div className="group rounded-2xl overflow-hidden border border-green-500/10 bg-zinc-900 hover:border-green-400/30 transition-all duration-300">

      <div className="h-72 relative overflow-hidden">

        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {badge && (
          <div className="absolute top-4 right-4 bg-green-400 text-black text-xs font-black px-3 py-1 rounded-full">
            {badge}
          </div>
        )}

      </div>

      <div className="p-6">

        <div className="flex items-center justify-between">

          <div>
            <h3 className="text-2xl font-bold">
              {title}
            </h3>

            <p className="text-zinc-500 mt-1">
              {collection}
            </p>
          </div>

          <div className="text-right">
            <p className="text-green-400 font-bold">
              {price}
            </p>

            <p className="text-zinc-500 text-sm">
              Floor
            </p>
          </div>

        </div>

        <button className="mt-6 w-full bg-green-400 hover:bg-green-300 text-black font-bold py-3 rounded-xl transition-all">
          Buy NFT
        </button>

      </div>

    </div>
  );
}