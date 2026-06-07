"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain, useReadContract, useReadContracts } from "wagmi";
import {
  VASTMINT_NFT_ADDRESS,
  VASTMINT_MARKETPLACE_ADDRESS,
  VASTMINT_FACTORY_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import { VASTMINT_NFT_ABI, VASTMINT_MARKETPLACE_ABI, VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Marketplace",
    href: "/marketplace",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    label: "Collections",
    href: "/collections",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "Launchpad",
    href: "/launchpad",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
];
export default function Sidebar({
  onClose,
  collapsed = false,
  }: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}) {

  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== RITUAL_CHAIN_ID;

  // Fetch all collections from factory
  const { data: allCollections } = useReadContract({
    address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
    abi: VASTMINT_FACTORY_ABI,
    functionName: "getAllCollections",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Build multicall — balanceOf per collection + the legacy NFT address
  const collections = (allCollections as { contractAddress: `0x${string}` }[] | undefined) ?? [];
  const allAddresses = [
    VASTMINT_NFT_ADDRESS as `0x${string}`,
    ...collections.map((c) => c.contractAddress),
  ];
  // Deduplicate in case VASTMINT_NFT_ADDRESS is already in factory collections
  const uniqueAddresses = [...new Set(allAddresses)];

  const balanceContracts = uniqueAddresses.map((addr) => ({
    address: addr,
    abi: VASTMINT_NFT_ABI,
    functionName: "balanceOf" as const,
    args: [address!] as [`0x${string}`],
    chainId: RITUAL_CHAIN_ID,
  }));

  const { data: balanceResults } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: !!address && balanceContracts.length > 0 },
  });

  // Sum all balances across every collection
  const nftBalance =
    balanceResults?.reduce((sum, result) => {
      const val = result.status === "success" ? Number(result.result) : 0;
      return sum + val;
    }, 0) ?? 0;

  const { data: myListings } = useReadContract({
    address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
    abi: VASTMINT_MARKETPLACE_ABI,
    functionName: "getListingsBySeller",
    args: [address!],
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!address },
  });

  async function handleSwitch() {
    try {
      await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
    } catch (err) {
      console.error(err);
    }
  }

  return (
<aside className={`flex flex-col h-full bg-[#e0dbd0] border-r border-[#1a4a2e]/10 transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}>      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1a4a2e]/10">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#e0dbd0] border border-[#1a4a2e]/30 flex-shrink-0">
            <Image
              src="/Vastmint.png"
              alt="VastMint"
              width={36}
              height={36}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          {!collapsed && (
  <div>
    <p className="text-sm font-black tracking-tight">VastMint</p>
    <p className="text-[10px] text-[#7a9e7a]">Live on Ritual Testnet</p>
  </div>
)}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
  <p className="text-[10px] font-bold text-[#7a9e7a] uppercase tracking-widest px-3 mb-3">
    Navigation
  </p>
)}
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[#1a4a2e]/20 text-[#1a2e1a] border border-[#1a4a2e]/30"
                  : "text-[#4a6741] hover:text-[#1a2e1a] hover:bg-[#1a4a2e]/10"
              }`}
            >
              <span className={isActive ? "text-[#1a4a2e]" : ""}>{item.icon}</span>
              {!collapsed && item.label}
            {isActive && !collapsed && (
  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1a4a2e]" />
)}
            </Link>
          );
        })}

        {/* Wrong network warning */}
        {isWrongNetwork && (
          <button
            onClick={handleSwitch}
            className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-400 border border-red-800/30 bg-red-900/10 hover:bg-red-900/20 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Switch to Ritual
          </button>
        )}
      </nav>

      {/* Wallet Section */}
      <div className="px-3 pb-4 pt-3 border-t border-[#1a4a2e]/10 space-y-3">
         {collapsed ? (
     <div className="flex justify-center">
      <ConnectButton
        showBalance={false}
        chainStatus="none"
        accountStatus="avatar"
      />
    </div>
  ) : isConnected && address ? (
          
          <>
            {/* Portfolio summary */}
            <div className="rounded-xl bg-[#ede8df] border border-[#1a4a2e]/15 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1a4a2e]/30 border border-[#1a4a2e]/40 flex items-center justify-center flex-shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-[#1a4a2e]">
                    <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2a8 8 0 00-8 8h16a8 8 0 00-8-8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[#1a2e1a] text-xs font-bold truncate font-mono">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                    <p className="text-[10px] text-[#1a4a2e]">Ritual Testnet</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg bg-[#e0dbd0]/30 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[#7a9e7a]">NFTs</p>
                  <p className="text-[#1a2e1a] font-black text-sm mt-0.5">
                    {nftBalance.toString()}
                  </p>
                </div>
                <div className="rounded-lg bg-[#e0dbd0]/30 px-2.5 py-2 text-center">
                  <p className="text-[10px] text-[#7a9e7a]">Listings</p>
                  <p className="text-[#1a2e1a] font-black text-sm mt-0.5">
                    {myListings ? myListings.length.toString() : "0"}
                  </p>
                </div>
              </div>
            </div>

            {/* Rainbow connect button for disconnect */}
            <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-center [&>div>button]:rounded-xl [&>div>button]:text-xs [&>div>button]:py-2.5">
              <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
            </div>
          </>
        ) : (
          <div className="[&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-center [&>div>button]:rounded-xl [&>div>button]:font-bold [&>div>button]:py-3 [&>div>button]:bg-[#1a4a2e] [&>div>button]:text-[#f5f0e8] [&>div>button]:text-sm">
            <ConnectButton showBalance={false} chainStatus="none" />
          </div>
        )}
      </div>
    </aside>
  );
}
