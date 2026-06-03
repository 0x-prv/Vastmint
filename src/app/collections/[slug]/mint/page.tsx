"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
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

type MintState =
  | "idle"
  | "uploading"
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
    return `https://ipfs.io/ipfs/${image.replace("ipfs://", "")}`;
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

  const minted = totalSupply ? Number(totalSupply) : 0;
  const isWrongNetwork = chainId !== RITUAL_CHAIN_ID;
  const progress = maxSupply > 0 ? Math.round((minted / maxSupply) * 100) : 0;
  const mintPriceLabel = formatMintPrice(mintPrice as bigint | undefined);
  const isMintPriceLoaded = mintPrice !== undefined;
  const isFree = (mintPrice as bigint | undefined) === 0n;

  const isSoldOut = maxSupply > 0 && minted >= maxSupply;

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && mintState === "confirming" },
  });

  const displayMintState =
    txConfirmed && mintState === "confirming" ? "success" : mintState;

  const isPending =
    displayMintState === "pending" ||
    displayMintState === "switching" ||
    displayMintState === "confirming";

  async function handleMint() {
  if (!address || !contractAddress || !collection) return;
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

    setMintState("uploading");

    const nextTokenId = minted;

    const metadata = {
      name: `${collection.name} #${nextTokenId}`,
      description: collection.description,
      image: collection.image,
      attributes: [
        { trait_type: "Collection", value: collection.name },
        { trait_type: "Symbol", value: collection.symbol },
        { trait_type: "Token ID", value: String(nextTokenId) },
      ],
    };

    const metadataRes = await fetch("/api/pinata/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });

    if (!metadataRes.ok) {
      throw new Error("Metadata upload failed");
    }

    const metadataJson = await metadataRes.json();

    const metadataCid =
      metadataJson.IpfsHash || metadataJson.cid || metadataJson.ipfsHash;

    if (!metadataCid) {
      throw new Error("Metadata CID missing");
    }

    const tokenURI = `ipfs://${metadataCid}`;

    setMintState("pending");

    const tx = await writeContractAsync({
      address: contractAddress,
      abi: VASTMINT_NFT_ABI,
      functionName: "mintNFT",
      args: [address, tokenURI],
      value: mintPrice as bigint,
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

  if (collectionLoading) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#077345] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading collection...</p>
        </div>
      </main>
    );
  }

  if (!collection || !contractAddress) {
    return (
      <main className="min-h-screen bg-[#05150f] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">Collection not found.</p>
          <Link
            href="/collections"
            className="mt-4 inline-flex rounded-xl bg-[#077345] px-5 py-3 text-sm font-bold text-white"
          >
            Back to Collections
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05150f] text-white px-4 sm:px-6 pt-6 pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#077345]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-600 mb-8">
          <Link
            href="/collections"
            className="hover:text-emerald-400 transition"
          >
            Collections
          </Link>
          <span>/</span>
          <Link
            href={`/collections/${slug}`}
            className="hover:text-emerald-400 transition"
          >
            {collection.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-400">Mint</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* LEFT — Image + Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] overflow-hidden">
              <div className="aspect-square w-full bg-gradient-to-br from-[#0d2518] via-[#071a0f] to-[#040f09] flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-48 h-48 rounded-full border border-[#077345]/10 animate-ping"
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
                      <div className="w-full h-full bg-[#077345]/20" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-bold">
                      {collection.name}
                    </p>
                    <p className="text-zinc-600 text-xs mt-0.5 tracking-widest uppercase">
                      {collection.symbol}
                    </p>
                  </div>
                </div>
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/40 px-3 py-1 text-xs font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isSoldOut ? "Sold Out" : "Live Mint"}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Contract</span>
                  <a
                    href={`${EXPLORER_URL}/address/${contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 font-mono text-xs hover:text-emerald-300 transition flex items-center gap-1"
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
                  <span className="text-zinc-600 text-xs">Creator</span>
                  <span className="text-zinc-400 text-xs font-mono">
                    {collection.creator.slice(0, 6)}...
                    {collection.creator.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Network</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 text-xs">
                      Ritual Testnet
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Standard</span>
                  <span className="text-zinc-400 text-xs font-mono">
                    ERC-721
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 text-xs">Chain ID</span>
                  <span className="text-zinc-400 text-xs font-mono">1979</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Mint UI */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-900/30 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {collection.symbol}
              </span>
              <h1 className="text-3xl font-black mt-4 leading-tight">
                {collection.name}
              </h1>
              <p className="text-zinc-500 text-sm mt-3 leading-relaxed">
                {collection.description}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Total Supply", value: maxSupply.toLocaleString() },
                  { label: "Minted", value: minted.toLocaleString() },
                  { label: "Mint Price", value: mintPriceLabel },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-black/30 border border-white/5 p-4 text-center"
                  >
                    <p className="text-zinc-600 text-xs">{label}</p>
                    <p
                      className={`font-black text-lg mt-1 ${
                        value === "Free" ? "text-emerald-400" : "text-white"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-zinc-600">Minting Progress</span>
                  <span className="text-zinc-400 font-bold">
                    {minted} / {maxSupply} · {progress}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#077345] to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-7">
              {displayMintState === "success" && txHash ? (
                <div className="flex flex-col items-center text-center py-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path
                        d="M6 14L11 19L22 8"
                        stroke="#4ade80"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black">Mint Successful!</h2>
                  <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
                    Your NFT has been minted and will appear in your dashboard
                    shortly.
                  </p>
                  <div className="mt-6 w-full rounded-xl border border-white/5 bg-black/30 p-4 text-left">
                    <p className="text-zinc-600 text-xs mb-2">
                      Transaction Hash
                    </p>
                    <p className="font-mono text-emerald-400 text-xs break-all leading-relaxed">
                      {txHash}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-3 w-full">
                    <a
                      href={`${EXPLORER_URL}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#077345]/30 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-[#077345]/10 transition"
                    >
                      View on Explorer
                    </a>
                    <Link
                      href="/dashboard"
                      className="flex-1 flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-3 text-sm font-bold text-white"
                    >
                      View My NFTs
                    </Link>
                  </div>
                  <button
                    onClick={reset}
                    className="mt-4 text-zinc-600 text-sm hover:text-zinc-400 transition"
                  >
                    Mint Another
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-5">
                    Mint Your NFT
                  </p>

                  {isConnected ? (
                    <div className="rounded-xl border border-white/5 bg-black/25 px-4 py-3 mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-zinc-600 text-xs">
                          Connected Wallet
                        </p>
                        <p className="font-mono text-sm text-zinc-200 mt-0.5">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
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
                      <p className="text-zinc-600 text-sm">
                        Connect your wallet to mint
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/5 bg-black/20 p-4 mb-5">
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-zinc-500">Mint Price</span>
                      <span
                        className={`font-bold ${
                          isFree ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {mintPriceLabel}
                      </span>
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
                      <span
                        className={`font-black ${
                          isFree ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {isFree ? "Gas Only" : mintPriceLabel}
                      </span>
                    </div>
                  </div>

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
                      (!isWrongNetwork && !isMintPriceLoaded)
                    }
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      !isConnected || isSoldOut
                        ? "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5"
                        : isPending || mintPrice === undefined
                        ? "bg-[#077345]/60 text-white/70 cursor-not-allowed"
                        : isWrongNetwork
                        ? "bg-red-900/60 hover:bg-red-800/60 text-white border border-red-700/30"
                        : "bg-[#077345] hover:bg-[#066039] text-white shadow-lg shadow-black/30"
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
