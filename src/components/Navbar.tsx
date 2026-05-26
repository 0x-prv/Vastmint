"use client";

import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";

export default function Navbar() {
  const { isConnected } = useAccount();

  const chainId = useChainId();

  const { switchChainAsync } = useSwitchChain();

  const isWrongNetwork =
    isConnected &&
    chainId !== undefined &&
    chainId !== RITUAL_CHAIN_ID;

  async function handleSwitch() {
    try {
      await switchChainAsync({
        chainId: RITUAL_CHAIN_ID,
      });
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 border-b border-[#077345]/10 backdrop-blur-xl bg-black/40">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

        <a href="/" className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl overflow-hidden glow-green bg-black border border-[#077345]/20">

            <Image
              src="/Vastmint.png"
              alt="VastMint logo"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              priority
            />

          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight">
              VastMint
            </h1>

            <p className="text-xs text-zinc-500">
              Ritual Ecosystem
            </p>
          </div>

        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm">

          <a
            href="/marketplace"
            className="text-zinc-300 hover:text-[#077345] transition"
          >
            Marketplace
          </a>

          <a
            href="/collections"
            className="text-zinc-300 hover:text-[#077345] transition"
          >
            Collections
          </a>

          <a
            href="/launchpad"
            className="text-zinc-300 hover:text-[#077345] transition"
          >
            Launchpad
          </a>

          <a
            href="/dashboard"
            className="text-zinc-300 hover:text-[#077345] transition"
          >
            Dashboard
          </a>

        </nav>

        <div className="flex items-center gap-4">

          <button className="hidden md:flex border border-[#077345]/20 hover:border-[#077345] hover:bg-[#077345]/10 px-5 py-2 rounded-xl transition-all">
            Explore
          </button>

          {isWrongNetwork && (
            <button
              onClick={handleSwitch}
              className="bg-[#077345] hover:bg-[#066039] text-white font-bold px-4 py-2 rounded-xl transition-all"
            >
              Switch Ritual
            </button>
          )}

          <ConnectButton />

        </div>

      </div>
    </header>
  );
}