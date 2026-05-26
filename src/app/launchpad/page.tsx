import Link from "next/link";

const launchSteps = [
  { step: "01", title: "Create collection", desc: "Set identity, supply, and royalties." },
  { step: "02", title: "Set mint model", desc: "Configure free, fixed, or tiered mint pricing." },
  { step: "03", title: "Configure phases", desc: "Define allowlist, public window, and reveal." },
  { step: "04", title: "Deploy to Ritual", desc: "Review settings and deploy with one guided flow." },
];

const upcomingLaunches = [
  { name: "Ritual Genesis Pass", supply: "1,000", price: "Free", status: "Live", progress: 42 },
  { name: "Shadow Nodes", supply: "777", price: "2.1 RITUAL", status: "Review", progress: 0 },
  { name: "AI Creator Vault", supply: "500", price: "0.9 RITUAL", status: "Soon", progress: 0 },
];

const phases = [
  { title: "Allowlist Mint", detail: "Private mint access for approved wallets.", status: "done" },
  { title: "Public Mint", detail: "Open minting for the Ritual ecosystem.", status: "live" },
  { title: "Reveal Phase", detail: "Reveal metadata, traits, and rarity.", status: "soon" },
];

export default function LaunchpadPage() {
  return (
    <main className="min-h-screen bg-[#05150f] px-4 pb-20 pt-28 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#10261d] via-[#0b1f17] to-[#091a14] px-6 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.45)] md:px-10 md:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(7,115,69,0.35),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(52,211,153,0.15),transparent_35%)]" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#077345]/40 bg-[#077345]/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                Ritual Launchpad
              </span>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight md:text-5xl">
                Premium NFT launches <span className="text-[#19b06d]">for Ritual creators</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
                Manage mint readiness, phase execution, and creator deployment from one cinematic control layer purpose-built for Ritual testnet.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/launchpad/mint" className="rounded-xl bg-[#077345] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#088753]">
                  Open Live Mint
                </Link>
                <Link href="/launchpad/create" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-[#077345]/50 hover:bg-[#077345]/15">
                  Start Creator Deploy
                </Link>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Launch Health</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-zinc-400">Active drops</p>
                  <p className="mt-1 text-lg font-bold text-white">03</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-zinc-400">Collections queued</p>
                  <p className="mt-1 text-lg font-bold text-white">08</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="relative flex flex-col overflow-hidden rounded-3xl border border-[#077345]/25 bg-[#0b1f17] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(7,115,69,0.28),transparent_48%)]" />
            <div className="relative z-10">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2ec27e]">Live Mint</p>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
              </div>
              <h2 className="text-xl font-black">Ritual Genesis Pass</h2>
              <p className="mt-2 text-sm text-zinc-400">Founding VastMint collection now minting on Ritual testnet.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-xs text-zinc-500">Supply</p>
                  <p className="mt-1 font-semibold">1,000</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-xs text-zinc-500">Mint Price</p>
                  <p className="mt-1 font-semibold text-emerald-300">Free</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Mint Progress</span>
                  <span className="font-semibold text-zinc-100">420 / 1,000</span>
                </div>
                <div className="h-2 rounded-full bg-black/50">
                  <div className="h-2 w-[42%] rounded-full bg-gradient-to-r from-[#077345] to-emerald-300" />
                </div>
              </div>
              <Link href="/launchpad/mint" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#077345] px-4 py-3 text-sm font-semibold transition hover:bg-[#088753]">
                Mint Now
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#0b1f17] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2ec27e]">Project Owner Tools</p>
                <h2 className="mt-2 text-2xl font-black">Creator Deploy Flow</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">A compact deployment wizard for configuring supply, pricing, mint phases, and Ritual-ready launch metadata.</p>
              </div>
              <Link href="/launchpad/create" className="rounded-xl border border-[#077345]/35 bg-[#077345]/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-[#077345]/60 hover:bg-[#077345]/25">
                Open Creator Wizard
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {launchSteps.map(({ step, title, desc }) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-[#2ec27e]">{step}</p>
                  <p className="mt-2 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#0b1f17] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2ec27e]">Mint Timeline</p>
            <h2 className="mt-2 text-2xl font-black">Phase Execution</h2>
            <div className="mt-5 space-y-3">
              {phases.map(({ title, detail, status }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${status === "live" ? "animate-pulse bg-emerald-300" : status === "done" ? "bg-zinc-500" : "bg-zinc-700"}`} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{title}</p>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-zinc-300">
                        {status === "live" ? "Live" : status === "done" ? "Done" : "Soon"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b1f17] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2ec27e]">Launch Queue</p>
            <h2 className="mt-2 text-2xl font-black">Upcoming Launches</h2>
            <div className="mt-5 space-y-3">
              {upcomingLaunches.map(({ name, supply, price, status, progress }) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{name}</p>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-zinc-300">{status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Supply</p>
                      <p className="font-semibold">{supply}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Mint Price</p>
                      <p className="font-semibold">{price}</p>
                    </div>
                  </div>
                  {progress > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-black/50">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#077345] to-emerald-300" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-right text-xs text-zinc-500">{progress}% minted</p>
                    </div>
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
