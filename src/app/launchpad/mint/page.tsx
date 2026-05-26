"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  useAccount,
  useWriteContract,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";

import {
  VASTMINT_NFT_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import { VASTMINT_NFT_ABI } from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const TOKEN_URI = "https://ipfs.io/ipfs/bafkreifakeexamplemetadata";

const COLLECTION = {
  name: "Ritual Genesis Pass",
  description:
    "The founding collection of VastMint — minted on Ritual testnet. Each pass represents early access to the native NFT ecosystem of Ritual.",
  supply: 1000,
  minted: 420,
  price: "Free",
  phases: [
    { label: "Whitelist Mint", status: "done" },
    { label: "Public Mint", status: "live" },
    { label: "Reveal", status: "soon" },
  ],
};

type MintState = "idle" | "switching" | "pending" | "confirming" | "success" | "error";

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [mintState, setMintState] = useState<MintState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;
  const progress = Math.round((COLLECTION.minted / COLLECTION.supply) * 100);
  const isPending =
    mintState === "pending" ||
    mintState === "switching" ||
    mintState === "confirming";

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && mintState === "confirming" },
  });

  useEffect(() => {
    if (txConfirmed && mintState === "confirming") {
      setMintState("success");
    }
  }, [txConfirmed, mintState]);

  async function handleMint() {
    if (!address) return;
    setErrorMsg(null);

    try {
      if (isWrongNetwork) {
        setMintState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
        setMintState("idle");
        return;
      }

      setMintState("pending");
      const tx = await writeContractAsync({
        address: VASTMINT_NFT_ADDRESS as `0x${string}`,
        abi: VASTMINT_NFT_ABI,
        functionName: "mintNFT",
        args: [address, TOKEN_URI],
      });

      setTxHash(tx);
      setMintState("confirming");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Transaction failed";
      const short =
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected by wallet."
          : "Mint failed. Please try again.";
      setErrorMsg(short);
      setMintState("error");
    }
  }

  function reset() {
    setMintState("idle");
    setTxHash(undefined);
    setErrorMsg(null);
  }

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-28 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#077345]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-zinc-600 mb-8">
          <Link href="/launchpad" className="hover:text-emerald-400 transition">
            Launchpad
          </Link>
          <span>/</span>
          <span className="text-zinc-400">Ritual Genesis Pass</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden">
              <div className="aspect-square w-full bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full border border-[#077345]/10 animate-ping" style={{ animationDuration: "4s" }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-[#077345]/15 animate-ping" style={{ animationDuration: "3s", animationDelay: "0.5s" }} />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-[#077345]/15 border border-[#077345]/25 flex items-center justify-center">
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                      <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" stroke="#077345" strokeWidth="1.5" fill="none" />
                      <path d="M22 13L31 18V28L22 33L13 28V18L22 13Z" fill="#077345" fillOpacity="0.5" />
                      <path d="M22 18L27 21V27L22 30L17 27V21L22 18Z" fill="#077345" fillOpacity="0.9" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-bold">Ritual Genesis Pass</p>
                    <p className="text-zinc-600 text-xs mt-0.5 tracking-widest uppercase">VastMint</p>
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/40 px-2.5 py-1 text-xs font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Contract</span>
                  
                   <a href={`${EXPLORER_URL}/address/${VASTMINT_NFT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-mono text-xs hover:text-emerald-300 transition flex items-center gap-1">
                    {VASTMINT_NFT_ADDRESS.slice(0, 6)}...{VASTMINT_NFT_ADDRESS.slice(-4)}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                    </svg>
                
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Network</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 text-xs">Ritual Testnet</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Standard</span>
                  <span className="text-zinc-400 text-xs font-mono">ERC-721</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Chain ID</span>
                  <span className="text-zinc-400 text-xs font-mono">1979</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-5">
              <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-4">Mint Phases</p>
              <div className="space-y-2">
                {COLLECTION.phases.map((phase) => (
                  <div key={phase.label} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${phase.status === "live" ? "border-emerald-700/25 bg-emerald-900/10" : "border-white/5 bg-black/20"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${phase.status === "live" ? "bg-emerald-400 animate-pulse" : phase.status === "done" ? "bg-zinc-600" : "bg-zinc-800"}`} />
                      <span className={`text-sm font-medium ${phase.status === "live" ? "text-white" : "text-zinc-500"}`}>
                        {phase.label}
                      </span>
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${phase.status === "live" ? "text-emerald-400" : phase.status === "done" ? "text-zinc-600" : "text-zinc-700"}`}>
                      {phase.status === "live" ? "Live" : phase.status === "done" ? "Done" : "Soon"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/30 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Mint
              </span>
              <h1 className="text-3xl font-black mt-4 leading-tight">{COLLECTION.name}</h1>
              <p className="text-zinc-500 text-sm mt-3 leading-relaxed">{COLLECTION.description}</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Total Supply", value: COLLECTION.supply.toLocaleString() },
                  { label: "Minted", value: COLLECTION.minted.toLocaleString() },
                  { label: "Mint Price", value: COLLECTION.price },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-black/30 border border-white/5 p-4 text-center">
                    <p className="text-zinc-600 text-xs">{label}</p>
                    <p className={`font-black text-lg mt-1 ${value === "Free" ? "text-emerald-400" : "text-white"}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-zinc-600">Minting Progress</span>
                  <span className="text-zinc-400 font-bold">{COLLECTION.minted} / {COLLECTION.supply} · {progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#077345] to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-7">
              {mintState === "success" && txHash ? (
                <div className="flex flex-col items-center text-center py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path d="M6 14L11 19L22 8" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black">Mint Successful!</h2>
                  <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
                    Your NFT has been minted on Ritual testnet and will appear in your dashboard shortly.
                  </p>
                  <div className="mt-6 w-full rounded-xl border border-white/5 bg-black/30 p-4 text-left">
                    <p className="text-zinc-600 text-xs mb-2">Transaction Hash</p>
                    <p className="font-mono text-emerald-400 text-xs break-all leading-relaxed">{txHash}</p>
                  </div>
                  <div className="mt-4 flex gap-3 w-full">
                    <a
                      href={`${EXPLORER_URL}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#077345]/30 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-[#077345]/10 transition"
                    >
                      View on Explorer
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                        <path d="M3.5 3.5a.5.5 0 000 1h3.8L1.15 10.65a.5.5 0 00.7.7L8 5.2V9a.5.5 0 001 0V4A.5.5 0 008.5 3.5H3.5z" />
                      </svg>
                    </a>
                    <Link href="/dashboard" className="flex-1 flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-3 text-sm font-bold text-white">
                      View My NFTs
                    </Link>
                  </div>
                  <button onClick={reset} className="mt-4 text-zinc-600 text-sm hover:text-zinc-400 transition">
                    Mint Another
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-5">Mint Your NFT</p>
                  {isConnected ? (
                    <div className="rounded-xl border border-white/5 bg-black/25 px-4 py-3 mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-zinc-600 text-xs">Connected Wallet</p>
                        <p className="font-mono text-sm text-zinc-200 mt-0.5">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                      </div>
                      {isWrongNetwork ? (
                        <span className="flex items-center gap-1.5 text-xs text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Wrong Network
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Ritual Testnet
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 mb-5">
                      <p className="text-zinc-600 text-sm">Connect your wallet to mint</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4 mb-5">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-zinc-500">Mint Price</span>
                      <span className="font-bold text-emerald-400">Free</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-zinc-500">Platform Fee</span>
                      <span className="text-zinc-400">None</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-zinc-500">Gas Fee</span>
                      <span className="text-zinc-400">Paid by wallet</span>
                    </div>
                    <div className="border-t border-white/5 mt-3 pt-3 flex justify-between text-sm">
                      <span className="text-zinc-400 font-bold">Total</span>
                      <span className="font-black text-emerald-400">Gas Only</span>
                    </div>
                  </div>
                  {mintState === "error" && errorMsg && (
                    <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/15 px-4 py-3">
                      <p className="text-red-400 text-sm">{errorMsg}</p>
                    </div>
                  )}
                  <button
                    onClick={handleMint}
                    disabled={!isConnected || isPending}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      !isConnected
                        ? "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5"
                        : isPending
                        ? "bg-[#077345]/60 text-white/70 cursor-not-allowed"
                        : isWrongNetwork
                        ? "bg-red-900/60 hover:bg-red-800/60 text-white border border-red-700/30"
                        : "bg-[#077345] hover:bg-[#066039] text-white shadow-lg shadow-black/30"
                    }`}
                  >
                    {isPending && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    {!isConnected
                      ? "Connect Wallet to Mint"
                      : mintState === "switching"
                      ? "Switching Network..."
                      : mintState === "pending"
                      ? "Confirm in Wallet..."
                      : mintState === "confirming"
                      ? "Confirming Transaction..."
                      : isWrongNetwork
                      ? "Switch to Ritual Testnet"
                      : "Mint NFT"}
                  </button>
                  <p className="text-center text-zinc-700 text-xs mt-4">
                    Minting on Ritual Testnet · Chain ID 1979
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}