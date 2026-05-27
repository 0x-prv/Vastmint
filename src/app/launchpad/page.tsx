"use client";

import Link from "next/link";
import { useState } from "react";

const steps = ["Details", "Upload", "Deploy", "Success"];

export default function LaunchpadCreatePage() {
  const [step, setStep] = useState(0);

  return (
    <main className="min-h-screen bg-[#05150f] px-6 pt-36 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Creator Deploy Flow
          </h1>

          <p className="mt-2 text-sm text-white/60">
            Configure your Ritual-native collection launch with a clean deployment workflow.
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#0b1f17] p-5 shadow-2xl shadow-black/20">
          <div className="mb-5 grid grid-cols-4 gap-2">
            {steps.map((item, index) => (
              <button
                key={item}
                onClick={() => setStep(index)}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  step === index
                    ? "border-[#077345] bg-[#077345]/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
                }`}
              >
                <span className="block text-[10px] text-white/35">
                  Step {index + 1}
                </span>

                {item}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Collection Name
                </label>

                <input
                  className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-2.5 text-sm text-white outline-none focus:border-[#077345]"
                  placeholder="Vast Genesis"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Symbol
                </label>

                <input
                  className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-2.5 text-sm text-white outline-none focus:border-[#077345]"
                  placeholder="VAST"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Description
                </label>

                <textarea
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#05150f] px-4 py-2.5 text-sm text-white outline-none focus:border-[#077345]"
                  placeholder="Describe your collection and launch vision."
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-7 text-center">
              <p className="text-base font-medium">
                Upload Collection Assets
              </p>

              <p className="mt-2 text-sm text-white/50">
                Add artwork, metadata, and launch assets.
              </p>

              <button className="mt-5 rounded-xl bg-[#077345] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#08864f]">
                Choose Files
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium">
                  Deploy Collection Contract
                </p>

                <p className="mt-2 text-sm text-white/50">
                  Review configuration before Ritual deployment.
                </p>
              </div>

              <button className="w-full rounded-xl bg-[#077345] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#08864f]">
                Deploy on Ritual Testnet
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-[#077345]/40 bg-[#077345]/10 p-5 text-center">
              <p className="text-lg font-semibold">
                Collection Ready
              </p>

              <p className="mt-2 text-sm text-white/60">
                Your mint page is ready to share.
              </p>

              <Link
                href="/collections/test/mint"
                className="mt-5 inline-flex rounded-xl bg-[#077345] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#08864f]"
              >
                View Mint Page
              </Link>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <button
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white"
            >
              Previous
            </button>

            <button
              onClick={() =>
                setStep((current) =>
                  Math.min(current + 1, steps.length - 1)
                )
              }
              className="rounded-xl bg-[#077345] px-4 py-2 text-sm font-medium text-white hover:bg-[#08864f]"
            >
              Continue
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}