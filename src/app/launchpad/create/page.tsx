"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

const steps = ["Details", "Upload", "Deploy", "Success"];

export default function CreateLaunchPage() {
  const { isConnected, address } = useAccount();
  const [step, setStep] = useState(1);

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-6 pt-28 pb-20">
      <div className="max-w-6xl mx-auto">
        <section className="rounded-3xl border border-[#077345]/20 bg-[#0b1f17] p-8">
          <p className="text-[#077345] uppercase tracking-[0.25em] text-xs">
            Creator Launch
          </p>

          <h1 className="text-4xl md:text-5xl font-black mt-4">
            Deploy your NFT collection
          </h1>

          <p className="text-zinc-400 mt-4 max-w-2xl">
            Complete each step to prepare a Ritual testnet NFT launch.
          </p>

          <div className="mt-8 grid grid-cols-4 gap-4">
            {steps.map((label, index) => {
              const active = step >= index + 1;

              return (
                <div key={label}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        active ? "bg-[#077345] text-white" : "bg-black text-zinc-500"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div
                      className={`hidden md:block h-px flex-1 ${
                        active ? "bg-[#077345]" : "bg-zinc-800"
                      }`}
                    />
                  </div>

                  <p className="mt-3 text-sm font-bold">{label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[#077345]/20 bg-[#0b1f17] p-8">
          {!isConnected ? (
            <div className="py-20 text-center">
              <h2 className="text-3xl font-black">Connect wallet first</h2>
              <p className="text-zinc-400 mt-3">
                Connect your wallet from the top bar to start a launch.
              </p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div>
                  <h2 className="text-3xl font-black">Collection details</h2>
                  <p className="text-zinc-400 mt-3">
                    Basic information for your Ritual NFT collection.
                  </p>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {["Collection Name", "Symbol", "Total Supply", "Mint Price", "Max Mint Per Wallet", "Royalty %"].map(
                      (label) => (
                        <div key={label}>
                          <label className="text-sm text-zinc-400">{label}</label>
                          <input
                            placeholder={label}
                            className="mt-2 w-full rounded-2xl border border-[#077345]/20 bg-black/40 px-5 py-4 outline-none focus:border-[#077345]"
                          />
                        </div>
                      )
                    )}

                    <div className="md:col-span-2">
                      <label className="text-sm text-zinc-400">Description</label>
                      <textarea
                        rows={5}
                        placeholder="Describe your collection"
                        className="mt-2 w-full rounded-2xl border border-[#077345]/20 bg-black/40 px-5 py-4 outline-none focus:border-[#077345]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-3xl font-black">Upload assets</h2>
                  <p className="text-zinc-400 mt-3">
                    Add collection visuals and metadata.
                  </p>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {["Collection Logo", "Banner Image", "Metadata JSON"].map((item) => (
                      <div
                        key={item}
                        className="rounded-3xl border border-dashed border-[#077345]/30 bg-black/30 p-10 text-center"
                      >
                        <p className="font-bold">{item}</p>
                        <p className="text-zinc-500 text-sm mt-2">Upload file</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-3xl font-black">Deploy contract</h2>
                  <p className="text-zinc-400 mt-3">
                    Review and deploy your launch contract to Ritual testnet.
                  </p>

                  <div className="mt-8 rounded-2xl border border-[#077345]/10 bg-black/30 p-5">
                    <p className="text-zinc-500 text-sm">Connected wallet</p>
                    <p className="font-bold mt-2 break-all">{address}</p>
                  </div>

                  <button className="mt-8 w-full rounded-2xl bg-[#077345] px-6 py-4 font-bold text-white hover:bg-[#066039] transition">
                    Deploy Launch Contract
                  </button>
                </div>
              )}

              {step === 4 && (
                <div className="py-20 text-center">
                  <h2 className="text-4xl font-black">Launch ready</h2>
                  <p className="text-zinc-400 mt-4">
                    Your Ritual testnet launch page is ready.
                  </p>
                </div>
              )}

              <div className="mt-10 flex items-center justify-between border-t border-[#077345]/10 pt-6">
                <button
                  onClick={() => setStep((prev) => Math.max(prev - 1, 1))}
                  className="rounded-xl border border-[#077345]/20 px-6 py-3 font-bold text-zinc-300 hover:bg-[#077345]/10 transition"
                >
                  Back
                </button>

                <button
                  onClick={() => setStep((prev) => Math.min(prev + 1, 4))}
                  className="rounded-xl bg-[#077345] px-6 py-3 font-bold text-white hover:bg-[#066039] transition"
                >
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