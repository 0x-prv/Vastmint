"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

const steps = ["Details", "Upload", "Deploy", "Success"];

export default function CreateLaunchPage() {
  const { isConnected, address } = useAccount();
  const [step, setStep] = useState(1);

  return (
    <main className="min-h-screen bg-[#05150f] px-4 pb-20 pt-28 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#10261d] via-[#0b1f17] to-[#091a14] p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(7,115,69,0.28),transparent_45%)]" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#2ec27e]">Creator Launch</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Deploy your NFT collection</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">Complete each stage to prepare a polished Ritual-native launch with predictable mint behavior and creator controls.</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((label, index) => {
                const current = index + 1;
                const active = step >= current;
                return (
                  <div key={label} className={`rounded-2xl border p-3 ${active ? "border-[#077345]/55 bg-[#077345]/15" : "border-white/10 bg-black/20"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-[#077345] text-white" : "bg-black/50 text-zinc-400"}`}>
                        {current}
                      </div>
                      <p className="text-sm font-semibold">{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0b1f17] p-6 md:p-8">
          {!isConnected ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 py-20 text-center">
              <h2 className="text-3xl font-black">Connect wallet first</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">Connect your wallet from the top bar to begin creator deployment and finalize your launch configuration.</p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-black md:text-3xl">Collection Details</h2>
                  <p className="mt-2 text-sm text-zinc-400">Set metadata, economics, and mint guardrails for your Ritual collection.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {["Collection Name", "Symbol", "Total Supply", "Mint Price", "Max Mint Per Wallet", "Royalty %"].map((label) => (
                      <div key={label} className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</label>
                        <input placeholder={label} className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-[#077345]/70 focus:ring-2 focus:ring-[#077345]/30" />
                      </div>
                    ))}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Description</label>
                      <textarea rows={5} placeholder="Describe your collection" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-[#077345]/70 focus:ring-2 focus:ring-[#077345]/30" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-black md:text-3xl">Upload Assets</h2>
                  <p className="mt-2 text-sm text-zinc-400">Attach collection media and metadata payloads for deploy readiness.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {["Collection Logo", "Banner Image", "Metadata JSON"].map((item) => (
                      <div key={item} className="rounded-2xl border border-dashed border-[#077345]/35 bg-black/25 p-6 text-center">
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#077345]/20 text-[#2ec27e]">+</div>
                        <p className="text-sm font-semibold">{item}</p>
                        <p className="mt-1 text-xs text-zinc-500">Drag or click to upload</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-black md:text-3xl">Deploy Review</h2>
                  <p className="mt-2 text-sm text-zinc-400">Review your connected account and deploy this launch contract to Ritual testnet.</p>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Connected wallet</p>
                    <p className="mt-2 break-all text-sm font-semibold text-zinc-100">{address}</p>
                  </div>
                  <button className="mt-6 w-full rounded-xl bg-[#077345] px-6 py-3.5 text-sm font-semibold transition hover:bg-[#088753]">Deploy Launch Contract</button>
                </div>
              )}

              {step === 4 && (
                <div className="rounded-2xl border border-[#077345]/30 bg-[#077345]/10 px-6 py-16 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2ec27e]">Deployment Complete</p>
                  <h2 className="mt-3 text-3xl font-black">Launch Ready</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-300">Your Ritual launch configuration is complete and ready for creator publishing workflow.</p>
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                <button onClick={() => setStep((prev) => Math.max(prev - 1, 1))} className="rounded-xl border border-white/15 bg-black/20 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-[#077345]/50 hover:bg-[#077345]/10">
                  Back
                </button>
                <button onClick={() => setStep((prev) => Math.min(prev + 1, 4))} className="rounded-xl bg-[#077345] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#088753]">
                  {step === 4 ? "Done" : "Continue"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
