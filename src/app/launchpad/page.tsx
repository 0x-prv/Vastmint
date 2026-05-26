import Link from "next/link";

const launchSteps = [
  { step: "01", title: "Create collection", desc: "Name, symbol, supply, royalties" },
  { step: "02", title: "Set mint price", desc: "Free, fixed, or tiered pricing" },
  { step: "03", title: "Configure phases", desc: "Whitelist, public, reveal" },
  { step: "04", title: "Deploy contract", desc: "One-click deploy to Ritual" },
];

const upcomingLaunches = [
  { name: "Ritual Genesis Pass", supply: "1,000", price: "Free", status: "Live", progress: 42 },
  { name: "Shadow Nodes", supply: "777", price: "2.1 RITUAL", status: "Review", progress: 0 },
  { name: "AI Creator Vault", supply: "500", price: "0.9 RITUAL", status: "Soon", progress: 0 },
];

const phases = [
  { title: "Whitelist Mint", detail: "Private mint access for approved wallets.", status: "done" },
  { title: "Public Mint", detail: "Open minting for the Ritual ecosystem.", status: "live" },
  { title: "Reveal Phase", detail: "Reveal metadata, traits, and rarity.", status: "soon" },
];

const card = { backgroundColor: "#0b1f17", border: "1px solid rgba(7,115,69,0.2)", borderRadius: "16px" };
const innerCard = { backgroundColor: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px" };
const liveCard = { backgroundColor: "rgba(6,78,59,0.15)", border: "1px solid rgba(6,78,59,0.3)", borderRadius: "12px" };

export default function LaunchpadPage() {
  return (
    <main className="min-h-screen text-white px-4 sm:px-6 pt-28 pb-24" style={{ backgroundColor: "#05150f" }}>
      <div className="relative max-w-6xl mx-auto space-y-5">

        {/* HERO */}
        <section className="relative overflow-hidden px-8 py-14" style={card}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top right, rgba(7,115,69,0.18), transparent 60%)", borderRadius: "16px" }} />
          <div className="absolute top-6 right-8 opacity-5">
            <svg viewBox="0 0 200 200" fill="none" width="180" height="180">
              <path d="M100 10L180 55V145L100 190L20 145V55L100 10Z" stroke="#077345" strokeWidth="1" />
              <path d="M100 40L155 70V130L100 160L45 130V70L100 40Z" stroke="#077345" strokeWidth="1" />
              <path d="M100 70L130 87V120L100 137L70 120V87L100 70Z" stroke="#077345" strokeWidth="1" />
            </svg>
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ borderRadius: "999px", border: "1px solid rgba(7,115,69,0.3)", backgroundColor: "rgba(7,115,69,0.1)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Ritual Native Launchpad</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight">
              Launch NFT collections<br />
              <span style={{ color: "#077345" }}>on Ritual.</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed max-w-xl" style={{ color: "#a1a1aa" }}>
              The native launchpad for the Ritual ecosystem. Deploy collections, configure mint phases, and run public launches — all on Ritual testnet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/launchpad/mint" className="px-6 py-3 text-sm font-bold text-white transition" style={{ backgroundColor: "#077345", borderRadius: "12px" }}>
                Open Mint Page
              </Link>
              <Link
  href="/launchpad/create"
  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#077345] hover:bg-[#066039] rounded-xl transition"
>
  Start Creator Deploy
</Link>
            </div>
          </div>
        </section>

        {/* LIVE MINT + DEPLOY */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="relative overflow-hidden flex flex-col p-6" style={card}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at bottom left, rgba(7,115,69,0.10), transparent 65%)", borderRadius: "16px" }} />
            <div className="relative z-10 flex flex-col flex-1">
              <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#077345" }}>Live Mint</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-400" style={{ borderRadius: "999px", border: "1px solid rgba(6,78,59,0.4)", backgroundColor: "rgba(6,78,59,0.25)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <h2 className="text-xl font-black">Ritual Genesis Pass</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#71717a" }}>
                The founding collection of VastMint. Mint on Ritual testnet and secure your Genesis Pass.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3" style={innerCard}>
                  <p className="text-xs mb-1" style={{ color: "#71717a" }}>Supply</p>
                  <p className="text-white font-black text-lg">1,000</p>
                </div>
                <div className="p-3" style={innerCard}>
                  <p className="text-xs mb-1" style={{ color: "#71717a" }}>Price</p>
                  <p className="font-black text-lg text-emerald-400">Free</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                  <span style={{ color: "#71717a" }}>Minted</span>
                  <span className="text-white font-bold">420 / 1,000</span>
                </div>
                <div className="h-2 overflow-hidden" style={{ borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.5)" }}>
                  <div className="h-full w-[42%]" style={{ background: "linear-gradient(to right, #077345, #34d399)", borderRadius: "999px" }} />
                </div>
                <p className="text-right text-xs mt-1" style={{ color: "#52525b" }}>42% minted</p>
              </div>
              <Link href="/launchpad/mint" className="mt-auto pt-5 flex items-center justify-center gap-2 text-sm font-bold text-white py-3 transition" style={{ backgroundColor: "#077345", borderRadius: "12px" }}>
                Mint Now
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                  <path d="M3.5 3.5a.5.5 0 000 1h3.8L1.15 10.65a.5.5 0 00.7.7L8 5.2V9a.5.5 0 001 0V4A.5.5 0 008.5 3.5H3.5z" />
                </svg>
              </Link>
            </div>
          </div>

          <div id="deploy" className="lg:col-span-2 flex flex-col p-6" style={card}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#077345" }}>Project Owner Tools</p>
            <h2 className="text-xl font-black mt-2">Creator Deploy Flow</h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#71717a" }}>
              Launch your own NFT collection on VastMint. Set supply, price, configure mint phases, and deploy your contract to Ritual.
            </p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              {launchSteps.map(({ step, title, desc }) => (
                <div key={step} className="flex flex-col gap-2 p-4" style={innerCard}>
                  <span className="text-xs font-black tracking-widest" style={{ color: "#077345" }}>{step}</span>
                  <p className="text-white text-sm font-bold leading-snug">{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#71717a" }}>{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button disabled className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold cursor-not-allowed" style={{ border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.2)", color: "#52525b" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ opacity: 0.4 }}>
                  <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 1a5 5 0 110 10A5 5 0 017 2zm0 2.5a.5.5 0 01.5.5v3.5H9a.5.5 0 010 1H6.5a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5z" />
                </svg>
                Creator Deploy — Coming Soon
              </button>
            </div>
          </div>
        </section>

        {/* PHASES + UPCOMING */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="p-6" style={card}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#077345" }}>Minting System</p>
            <h2 className="text-xl font-black mt-2 mb-5">Mint Phases</h2>
            <div className="flex flex-col gap-3">
              {phases.map(({ title, detail, status }) => (
                <div key={title} className="flex items-center justify-between gap-4 p-4" style={status === "live" ? liveCard : innerCard}>
                  <div className="flex items-center gap-3">
                    <div className={status === "live" ? "animate-pulse" : ""} style={{ width: 8, height: 8, borderRadius: "999px", flexShrink: 0, backgroundColor: status === "live" ? "#34d399" : status === "done" ? "#52525b" : "#3f3f46" }} />
                    <div>
                      <p className="text-sm font-bold" style={{ color: status === "live" ? "#fff" : "#a1a1aa" }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{detail}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 flex-shrink-0" style={{
                    borderRadius: "999px",
                    backgroundColor: status === "live" ? "rgba(6,78,59,0.4)" : "rgba(0,0,0,0.3)",
                    border: status === "live" ? "1px solid rgba(6,78,59,0.4)" : "1px solid rgba(255,255,255,0.05)",
                    color: status === "live" ? "#34d399" : status === "done" ? "#52525b" : "#3f3f46",
                  }}>
                    {status === "live" ? "Live" : status === "done" ? "Done" : "Soon"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6" style={card}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#077345" }}>Launch Queue</p>
            <h2 className="text-xl font-black mt-2 mb-5">Upcoming Launches</h2>
            <div className="flex flex-col gap-3">
              {upcomingLaunches.map(({ name, supply, price, status, progress }) => (
                <div key={name} className="p-4" style={innerCard}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-white">{name}</p>
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1" style={{
                      borderRadius: "999px",
                      backgroundColor: status === "Live" ? "rgba(6,78,59,0.4)" : status === "Review" ? "rgba(113,63,18,0.3)" : "rgba(0,0,0,0.3)",
                      border: status === "Live" ? "1px solid rgba(6,78,59,0.4)" : status === "Review" ? "1px solid rgba(113,63,18,0.3)" : "1px solid rgba(255,255,255,0.05)",
                      color: status === "Live" ? "#34d399" : status === "Review" ? "#eab308" : "#52525b",
                    }}>
                      {status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs" style={{ color: "#52525b" }}>Supply</p>
                      <p className="text-white text-sm font-bold mt-0.5">{supply}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "#52525b" }}>Mint Price</p>
                      <p className="text-white text-sm font-bold mt-0.5">{price}</p>
                    </div>
                  </div>
                  {progress > 0 && (
                    <>
                      <div className="h-1.5 overflow-hidden" style={{ borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.5)" }}>
                        <div className="h-full" style={{ width: `${progress}%`, background: "linear-gradient(to right, #077345, #34d399)", borderRadius: "999px" }} />
                      </div>
                      <p className="text-xs mt-1 text-right" style={{ color: "#52525b" }}>{progress}% minted</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
} 