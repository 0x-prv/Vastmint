export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 border-b border-green-500/10 backdrop-blur-xl bg-black/40">
      
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-green-400 glow-green flex items-center justify-center">
            <span className="text-black font-black text-lg">
              R
            </span>
          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight">
              Ritual<span className="text-green-400">MP</span>
            </h1>

            <p className="text-xs text-zinc-500">
              Ritual Ecosystem
            </p>
          </div>

        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm">

         <a href="/marketplace" className="text-zinc-300 hover:text-green-400 transition">
  Marketplace
</a>
          <a href="/collections" className="text-zinc-300 hover:text-green-400 transition">
            Collections
          </a>

          <a href="/launchpad" className="text-zinc-300 hover:text-green-400 transition">
            Launchpad
          </a>

          <a href="/dashboard" className="text-zinc-300 hover:text-green-400 transition">
            Dashboard
          </a>

        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-4">

          <button className="hidden md:flex border border-green-500/20 hover:border-green-400 hover:bg-green-500/10 px-5 py-2 rounded-xl transition-all">
            Explore
          </button>

          <button className="bg-green-400 hover:bg-green-300 text-black font-bold px-5 py-2 rounded-xl glow-green transition-all">
            Connect Wallet
          </button>

        </div>

      </div>

    </header>
  );
}