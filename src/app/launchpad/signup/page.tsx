"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function LaunchpadSignupPage() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen text-[#1a2e1a] flex items-center justify-center px-4" style={{ backgroundColor: "#f5f0e8" }}>
      <div className="w-full max-w-md p-8 flex flex-col items-center text-center" style={{ backgroundColor: "#ede8df", border: "1px solid rgba(7,115,69,0.2)", borderRadius: "20px" }}>

        <div className="w-16 h-16 flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(7,115,69,0.15)", border: "1px solid rgba(7,115,69,0.25)", borderRadius: "16px" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L28 10V22L16 29L4 22V10L16 3Z" stroke="#1a4a2e" strokeWidth="1.5" fill="none" />
            <path d="M16 10L22 14V20L16 24L10 20V14L16 10Z" fill="#1a4a2e" fillOpacity="0.6" />
          </svg>
        </div>

        <h1 className="text-2xl font-black mb-2">Sign in to launch collection</h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "#71717a" }}>
          Connect your wallet to create and deploy a Ritual NFT collection.
        </p>

        <div className="w-full mb-4">
          <ConnectButton />
        </div>

        {isConnected && (
          <Link href="/launchpad/create" className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#1a2e1a] transition mt-2" style={{ backgroundColor: "#1a4a2e", borderRadius: "12px" }}>
            Continue to Collection Details
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M3.5 3.5a.5.5 0 000 1h3.8L1.15 10.65a.5.5 0 00.7.7L8 5.2V9a.5.5 0 001 0V4A.5.5 0 008.5 3.5H3.5z" />
            </svg>
          </Link>
        )}

        <Link href="/launchpad" className="mt-4 text-xs transition" style={{ color: "#52525b" }}>
          ← Back to Launchpad
        </Link>
      </div>
    </main>
  );
}