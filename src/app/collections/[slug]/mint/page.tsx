"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import { parseGwei } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";

import {
  VASTMINT_FACTORY_ADDRESS,
  RITUAL_CHAIN_ID,
} from "@/lib/blockchain/contracts";
import { VASTMINT_NFT_ABI, VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const EXPLORER_URL = "https://explorer.ritualfoundation.org";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

type MintState =
  | "idle"
  | "switching"
  | "pending"
  | "confirming"
  | "success"
  | "error";

type Collection = {
  contractAddress: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: bigint;
  mintPrice: bigint;
  slug: string;
};

function formatMintPrice(price?: bigint) {
  if (price === undefined) return "Loading...";
  if (price === 0n) return "Free";
  return `${formatEther(price)} RITUAL`;
}

function resolveImage(image?: string) {
  if (!image) return null;
  if (image.startsWith("ipfs://"))
    return `https://gateway.pinata.cloud/ipfs/${image.replace("ipfs://", "")}`;
  return image;
}

export default function MintPage() {
  const { slug } = useParams<{ slug: string }>();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [mintState, setMintState] = useState<MintState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);

  // Fetch collection from Factory
  const { data: collectionData, isLoading: collectionLoading } =
    useReadContract({
      address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
      abi: VASTMINT_FACTORY_ABI,
      functionName: "getCollectionBySlug",
      args: [slug],
      chainId: RITUAL_CHAIN_ID,
    });

  const collection = collectionData as Collection | undefined;
  const contractAddress = collection?.contractAddress;
  const imageUrl = resolveImage(collection?.image);
  const maxSupply = collection ? Number(collection.maxSupply) : 0;

  // Fetch live data from the collection contract
  const { data: totalSupply } = useReadContract({
    address: contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "totalSupply",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!contractAddress },
  });

  const { data: mintPrice } = useReadContract({
    address: contractAddress,
    abi: VASTMINT_NFT_ABI,
    functionName: "mintPrice",
    chainId: RITUAL_CHAIN_ID,
    query: { enabled: !!contractAddress },
  });
  const { data: phase } = useReadContract({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "phase",
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: !!contractAddress },
});

const { data: whitelistPrice } = useReadContract({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "whitelistPrice",
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: !!contractAddress },
});

const { data: whitelistRoot } = useReadContract({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "whitelistRoot",
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: !!contractAddress },
});

const { data: maxPerWallet } = useReadContract({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "maxPerWallet",
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: !!contractAddress },
});

const { data: userMintCount } = useReadContract({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "mintCount",
  args: [address ?? "0x0000000000000000000000000000000000000000"],
  chainId: RITUAL_CHAIN_ID,
  query: { enabled: !!contractAddress && !!address },
});
  const minted = totalSupply ? Number(totalSupply) : 0;
  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;
  const progress = maxSupply > 0 ? Math.round((minted / maxSupply) * 100) : 0;
  const mintPriceLabel = formatMintPrice(mintPrice as bigint | undefined);
  const isMintPriceLoaded = mintPrice !== undefined;
  const isFree = (mintPrice as bigint | undefined) === 0n;
const phaseNumber = Number(phase ?? 0);
const phaseLabel =
  phaseNumber === 1 ? "Whitelist" : phaseNumber === 2 ? "Public" : "Paused";

const whitelistPriceLabel = formatMintPrice(whitelistPrice as bigint | undefined);
const userMinted = userMintCount ? Number(userMintCount) : 0;
const walletLimit = maxPerWallet ? Number(maxPerWallet) : 0;
  const isSoldOut = maxSupply > 0 && minted >= maxSupply;

  const { isSuccess: txConfirmed, data: txReceipt } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && mintState === "confirming" },
  });

  // I-parse ang actual minted token ID mula sa Transfer event
  useEffect(() => {
    if (!txConfirmed || !txReceipt) return;
    const transferLog = txReceipt.logs.find(
      (log) => log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    );
    if (transferLog?.topics[3]) {
      const tokenId = Number(BigInt(transferLog.topics[3]));
      queueMicrotask(() => setMintedTokenId(tokenId));
    }
  }, [txConfirmed, txReceipt]);

  const displayMintState =
    txConfirmed && mintState === "confirming" ? "success" : mintState;

  const isPending =
    displayMintState === "pending" ||
    displayMintState === "switching" ||
    displayMintState === "confirming";

  
     async function handleMint() {
    if (!address || !contractAddress || !collection) return;
    if (isSoldOut) return;

    setErrorMsg(null);

    try {
      if (isWrongNetwork) {
        setMintState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      if (!isMintPriceLoaded) {
        setErrorMsg("Mint price is still loading. Please try again.");
        setMintState("error");
        return;
      }
      if (phaseNumber === 1) {
        if (whitelistPrice === undefined || whitelistRoot === undefined) {
          setErrorMsg("Whitelist mint data is still loading. Please try again.");
          setMintState("error");
          return;
        }

        if (whitelistRoot === ZERO_BYTES32) {
          setErrorMsg("Whitelist is not configured for this collection.");
          setMintState("error");
          return;
        }

        setErrorMsg(
          "Whitelist proof data is not available in the current VastMint frontend flow. Ask the creator to switch to public mint or publish a supported proof source."
        );
        setMintState("error");
        return;
      }

const tx = await writeContractAsync({
  address: contractAddress,
  abi: VASTMINT_NFT_ABI,
  functionName: "mintNFT",
  args: [address],
  value: mintPrice as bigint,
  type: "legacy",
  gasPrice: parseGwei("1"),
});
      setTxHash(tx);
      setMintState("confirming");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Transaction failed";
     const short =
  message.includes("rejected") || message.includes("denied")
    ? "Transaction rejected by wallet."
    : message.includes("Metadata upload") || message.includes("Metadata CID")
    ? "Metadata upload failed. Please try again."
    : message.includes("insufficient funds")
    ? "Insufficient funds. Please add more RITUAL to your wallet."
    : message.includes("Wallet mint limit") || message.includes("mintCount")
    ? "You have reached the maximum mint limit for this collection."
    : message.includes("Max supply reached") || message.includes("sold out")
    ? "This collection is sold out."
    : message.includes("Public mint not active") || message.includes("Whitelist mint not active")
    ? "Minting is not active for this phase."
    : message.includes("Not whitelisted")
    ? "Your wallet is not on the whitelist."
    : message.includes("network") || message.includes("chain")
    ? "Network error. Please switch to Ritual Testnet."
    : "Mint failed. Please try again.";
      setErrorMsg(short);
      setMintState("error");
    }
  }

    function reset() {
    setMintState("idle");
    setTxHash(undefined);
    setErrorMsg(null);
    setMintedTokenId(null);
  }


  if (collectionLoading) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1a4a2e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#4a6741] text-sm">Loading collection...</p>
        </div>
      </main>
    );
  }

  if (!collection || !contractAddress) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#4a6741] text-sm">Collection not found.</p>
          <Link
            href="/collections"
            className="mt-4 inline-flex rounded-xl bg-[#1a4a2e] px-5 py-3 text-sm font-bold text-[#f5f0e8]"
          >
            Back to Collections
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#1a2e1a] px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#1a4a2e]/5 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#7a9e7a] mb-8">
          <Link
            href="/collections"
            className="hover:text-[#1a4a2e] transition"
          >
            Collections
          </Link>
          <span>/</span>
          <Link
            href={`/collections/${slug}`}
            className="hover:text-[#1a4a2e] transition"
          >
            {collection.name}
          </Link>
          <span>/</span>
          <span className="text-[#4a6741]">Mint</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* LEFT — Image + Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] overflow-hidden">
              <div className="aspect-square w-full bg-gradient-to-br from-[#e8e3d8] via-[#e0dbd0] to-[#e0dbd0] flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-48 h-48 rounded-full border border-[#1a4a2e]/10 animate-ping"
                    style={{ animationDuration: "4s" }}
                  />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="w-40 h-40 rounded-2xl overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={collection.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1a4a2e]/20" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[#1a2e1a] text-sm font-bold">
                      {collection.name}
                    </p>
                    <p className="text-[#7a9e7a] text-xs mt-0.5 tracking-widest uppercase">
                      {collection.symbol}
                    </p>
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-3 py-1 text-xs font-bold text-[#1a4a2e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                    {isSoldOut ? "Sold Out" : "Live Mint"}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-3 border-t border-[#1a4a2e]/15">
                <div className="flex items-center justify-between">
                  <span className="text-[#7a9e7a] text-xs">Contract</span>
                  <a
                    href={`${EXPLORER_URL}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a4a2e] font-mono text-xs hover:text-[#143d24] transition flex items-center gap-1"
                  >
                    {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M3.5 3a.5.5 0 000 1H7.3L2.15 9.15a.5.5 0 00.7.7L8 4.7V8.5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5h-5z" />
                    </svg>
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a9e7a] text-xs">Creator</span>
                  <span className="text-[#4a6741] text-xs font-mono">
                    {collection.creator.slice(0, 6)}...
                    {collection.creator.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a9e7a] text-xs">Network</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                    <span className="text-[#1a4a2e] text-xs">
                      Ritual Testnet
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a9e7a] text-xs">Standard</span>
                  <span className="text-[#4a6741] text-xs font-mono">
                    ERC-721
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7a9e7a] text-xs">Chain ID</span>
                  <span className="text-[#4a6741] text-xs font-mono">1979</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Mint UI */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1a4a2e]/30 bg-[#1a4a2e]/10 px-3 py-1 text-xs font-bold text-[#1a4a2e]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e] animate-pulse" />
                {collection.symbol}
              </span>
              <h1 className="text-3xl font-black mt-4 leading-tight">
                {collection.name}
              </h1>
              <p className="text-[#4a6741] text-sm mt-3 leading-relaxed">
                {collection.description}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
              { label: "Total Supply", value: maxSupply.toLocaleString() },
               { label: "Minted", value: minted.toLocaleString() },
               { label: "Phase", value: phaseLabel },
               { label: "Mint Price", value: mintPriceLabel },
               { label: "WL Price", value: whitelistPriceLabel },
               { label: "Your Mints", value: `${userMinted}/${walletLimit || "∞"}` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[#e0dbd0]/30 border border-[#1a4a2e]/15 p-4 text-center"
                  >
                    <p className="text-[#7a9e7a] text-xs">{label}</p>
                    <p
                      className={`font-black text-lg mt-1 ${
                        value === "Free" ? "text-[#1a4a2e]" : "text-[#1a2e1a]"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#7a9e7a]">Minting Progress</span>
                  <span className="text-[#4a6741] font-bold">
                    {minted} / {maxSupply} · {progress}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#e0dbd0]/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1a4a2e] to-[#4a6741] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#ede8df] p-7">
              {displayMintState === "success" && txHash ? (
                <div className="flex flex-col items-center text-center py-2">
                  <div className="w-16 h-16 rounded-full bg-[#1a4a2e]/10 border border-[#1a4a2e]/30 flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path
                        d="M6 14L11 19L22 8"
                        stroke="#1a4a2e"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black">Mint Successful!</h2>
                 <p className="text-[#4a6741] text-sm mt-2 max-w-xs leading-relaxed">
                   Your NFT has been minted and will appear in your dashboard shortly.
                   {mintedTokenId !== null && (
                   <span className="block mt-1 font-bold text-[#1a4a2e]">
                  Token #{mintedTokenId}
                    </span>
                          )}
                  </p>
                  <div className="mt-6 w-full rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/30 p-4 text-left">
                    <p className="text-[#7a9e7a] text-xs mb-2">
                      Transaction Hash
                    </p>
                    <p className="font-mono text-[#1a4a2e] text-xs break-all leading-relaxed">
                      {txHash}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-3 w-full">
                    <a
                      href={`${EXPLORER_URL}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#1a4a2e]/30 px-4 py-3 text-sm font-bold text-[#1a4a2e] hover:bg-[#1a4a2e]/10 transition"
                    >
                      View on Explorer
                    </a>
                    <Link
                      href="/dashboard"
                      className="flex-1 flex items-center justify-center rounded-xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-4 py-3 text-sm font-bold text-[#f5f0e8]"
                    >
                      View My NFTs
                    </Link>
                  </div>
                  <button
                    onClick={reset}
                    className="mt-4 text-[#7a9e7a] text-sm hover:text-[#4a6741] transition"
                  >
                    Mint Another
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-[0.18em] mb-5">
                    Mint Your NFT
                  </p>

                  {isConnected ? (
                    <div className="rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/25 px-4 py-3 mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[#7a9e7a] text-xs">
                          Connected Wallet
                        </p>
                        <p className="font-mono text-sm text-[#1a2e1a] mt-0.5">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                      </div>
                      {isWrongNetwork ? (
                        <span className="flex items-center gap-1.5 text-xs text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Wrong Network
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-[#1a4a2e]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1a4a2e]" />
                          Ritual Testnet
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/70 px-4 py-3 mb-5">
                      <p className="text-[#7a9e7a] text-sm">
                        Connect your wallet to mint
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/70 p-4 mb-5">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-[#4a6741]">Mint Price</span>
                      <span
                        className={`font-bold ${
                          isFree ? "text-[#1a4a2e]" : "text-[#1a2e1a]"
                        }`}
                      >
                        {mintPriceLabel}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-[#4a6741]">Platform Fee</span>
                      <span className="text-[#4a6741]">None</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-[#4a6741]">Gas Fee</span>
                      <span className="text-[#4a6741]">Paid by wallet</span>
                    </div>
                    <div className="border-t border-[#1a4a2e]/15 mt-3 pt-3 flex justify-between text-sm">
                      <span className="text-[#4a6741] font-bold">Total</span>
                      <span
                        className={`font-black ${
                          isFree ? "text-[#1a4a2e]" : "text-[#1a2e1a]"
                        }`}
                      >
                        {isFree ? "Gas Only" : mintPriceLabel}
                      </span>
                    </div>
                  </div>
{walletLimit > 0 && userMinted >= walletLimit && (
  <div className="mb-4 rounded-xl border border-yellow-700/40 bg-yellow-900/15 px-4 py-3">
    <p className="text-yellow-500 text-sm">
      You have reached the maximum mint limit of {walletLimit} per wallet.
    </p>
  </div>
)}
                  {displayMintState === "error" && errorMsg && (
                    <div className="mb-4 rounded-xl border border-red-800/40 bg-red-900/15 px-4 py-3">
                      <p className="text-red-400 text-sm">{errorMsg}</p>
                    </div>
                  )}

                  <button
                   onClick={handleMint}
                    disabled={
                    !isConnected ||
                     isPending ||
                     isSoldOut ||
                     phaseNumber === 0 ||
                    (!isWrongNetwork && !isMintPriceLoaded) ||
                      (walletLimit > 0 && userMinted >= walletLimit)
}
                    
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      !isConnected || isSoldOut
                        ? "bg-[#e0dbd0] text-[#7a9e7a] cursor-not-allowed border border-[#1a4a2e]/15"
                        : isPending || mintPrice === undefined
                        ? "bg-[#1a4a2e]/50 text-[#f5f0e8]/70 cursor-not-allowed"
                        : isWrongNetwork
                        ? "bg-red-900/60 hover:bg-red-800/60 text-[#f5f0e8] border border-red-700/30"
                        : "bg-[#1a4a2e] hover:bg-[#143d24] text-[#f5f0e8] shadow-lg shadow-[#1a4a2e]/10"
                    }`}
                  >
                    {isPending && (
                      <svg
                        className="animate-spin w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                    )}
                    {!isConnected
  ? "Connect Wallet to Mint"
  : displayMintState === "switching"
  ? "Switching Network..."
  : displayMintState === "pending"
  ? "Confirm in Wallet..."
  : displayMintState === "confirming"
  ? "Confirming Transaction..."
  : isWrongNetwork
  ? "Switch to Ritual Testnet"
  : !isMintPriceLoaded
  ? "Loading Mint Price..."
  : phaseNumber === 0
? "Mint Paused"
: walletLimit > 0 && userMinted >= walletLimit
? "Wallet Limit Reached"
: phaseNumber === 1
? "Whitelist Mint"
: "Public Mint"}
                
                </button>

                  <p className="text-center text-[#7a9e7a] text-xs mt-4">
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
