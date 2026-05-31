"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT!;
const PINATA_GATEWAY = "https://gateway.pinata.cloud";

const steps = ["Details", "Image", "Deploy", "Success"];

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function LaunchpadCreatePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState(0);

  // Step 1 fields
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [maxSupply, setMaxSupply] = useState("");
  const [mintPrice, setMintPrice] = useState("");

  // Step 2
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ipfsImageUrl, setIpfsImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedSlug, setDeployedSlug] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const isWrongNetwork = isConnected && chainId !== RITUAL_CHAIN_ID;

  // Validation per step
  const step0Valid = name.trim().length > 0 && symbol.trim().length > 0 && description.trim().length > 0 && Number(maxSupply) > 0;
  const step1Valid = !!ipfsImageUrl;
  const step2Valid = step0Valid && step1Valid;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIpfsImageUrl(null);
    setUploadError(null);
  }

  async function handleUpload() {
    if (!imageFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("pinataMetadata", JSON.stringify({ name: `${name}-image` }));

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const ipfsUrl = `ipfs://${data.IpfsHash}`;
      setIpfsImageUrl(ipfsUrl);
    } catch (err) {
      console.error(err);
      setUploadError("Upload failed. Check your Pinata JWT.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeploy() {
    if (!address || !step2Valid) return;
    setDeploying(true);
    setDeployError(null);

    try {
      if (isWrongNetwork) {
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      const slug = slugify(name);
      const priceWei = mintPrice && parseFloat(mintPrice) > 0
        ? BigInt(Math.floor(parseFloat(mintPrice) * 1e18))
        : BigInt(0);

      const tx = await writeContractAsync({
        address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
        abi: VASTMINT_FACTORY_ABI,
        functionName: "createCollection",
        args: [
          name.trim(),
          symbol.trim().toUpperCase(),
          description.trim(),
          ipfsImageUrl!,
          BigInt(maxSupply),
          priceWei,
          slug,
        ],
      });

      setTxHash(tx);
      setDeployedSlug(slug);
      setStep(3);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Deploy failed";
      const short = message.includes("rejected") || message.includes("denied")
        ? "Transaction rejected."
        : "Deploy failed. Try again.";
      setDeployError(short);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05150f] px-4 sm:px-6 pt-10 pb-24 text-white">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">Launchpad</p>
          <h1 className="text-3xl font-black">Deploy Collection</h1>
          <p className="text-zinc-500 text-sm mt-1">Launch your Ritual-native NFT collection.</p>
        </div>

        {/* Steps indicator */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {steps.map((item, index) => (
            <div
              key={item}
              className={`rounded-xl border px-3 py-2 text-xs text-center transition ${
                step === index
                  ? "border-[#077345] bg-[#077345]/20 text-white"
                  : index < step
                  ? "border-[#077345]/30 bg-[#077345]/10 text-emerald-400"
                  : "border-white/10 bg-white/[0.03] text-zinc-600"
              }`}
            >
              <span className="block text-[10px] text-zinc-600 mb-0.5">
                {index < step ? "✓" : `Step ${index + 1}`}
              </span>
              {item}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#077345]/20 bg-[#0b1f17] p-6 shadow-2xl shadow-black/20">

          {/* STEP 0 — Details */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Collection Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-sm text-white outline-none focus:border-[#077345] transition"
                  placeholder="Ritual Genesis Pass"
                />
                {name && (
                  <p className="text-zinc-600 text-xs mt-1">Slug: <span className="text-zinc-400 font-mono">{slugify(name)}</span></p>
                )}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Symbol *</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-sm text-white outline-none focus:border-[#077345] transition"
                  placeholder="RGP"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-sm text-white outline-none focus:border-[#077345] transition"
                  placeholder="Describe your collection..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Max Supply *</label>
                  <input
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-sm text-white outline-none focus:border-[#077345] transition"
                    placeholder="1000"
                    type="number"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Mint Price (RITUAL)</label>
                  <input
                    value={mintPrice}
                    onChange={(e) => setMintPrice(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#05150f] px-4 py-3 text-sm text-white outline-none focus:border-[#077345] transition"
                    placeholder="0 = Free"
                    type="number"
                    min="0"
                    step="0.001"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Image Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Upload your collection image. This will be stored on IPFS via Pinata.</p>

              {/* Upload area */}
              <label className="block cursor-pointer">
                <div className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  imagePreview ? "border-[#077345]/40" : "border-white/10 hover:border-[#077345]/30"
                }`}>
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 rounded-xl object-cover"
                      />
                      <p className="text-zinc-500 text-xs">{imageFile?.name}</p>
                      <p className="text-zinc-600 text-xs">Click to change</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#077345]/20 flex items-center justify-center">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#077345" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <p className="text-sm text-zinc-400">Click to upload image</p>
                      <p className="text-xs text-zinc-600">PNG, JPG, GIF, WEBP</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>

              {/* Upload to IPFS button */}
              {imageFile && !ipfsImageUrl && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-50 transition px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
                >
                  {uploading && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {uploading ? "Uploading to IPFS..." : "Upload to IPFS"}
                </button>
              )}

              {/* IPFS success */}
              {ipfsImageUrl && (
                <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/15 px-4 py-3 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <div>
                    <p className="text-emerald-400 text-xs font-bold">Uploaded to IPFS ✓</p>
                    <p className="text-zinc-600 text-xs font-mono mt-0.5 truncate">{ipfsImageUrl}</p>
                  </div>
                </div>
              )}

              {uploadError && (
                <p className="text-red-400 text-sm">{uploadError}</p>
              )}
            </div>
          )}

          {/* STEP 2 — Deploy */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Review your collection before deploying to Ritual Testnet.</p>

              {/* Summary */}
              <div className="rounded-xl bg-black/30 border border-white/5 p-4 space-y-3">
                {ipfsImageUrl && (
                  <div className="flex justify-center mb-2">
                    <img
                      src={`${PINATA_GATEWAY}/ipfs/${ipfsImageUrl.replace("ipfs://", "")}`}
                      alt="Collection"
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  </div>
                )}
                {[
                  ["Name", name],
                  ["Symbol", symbol],
                  ["Slug", slugify(name)],
                  ["Max Supply", Number(maxSupply).toLocaleString()],
                  ["Mint Price", mintPrice && parseFloat(mintPrice) > 0 ? `${mintPrice} RITUAL` : "Free"],
                  ["Network", "Ritual Testnet"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-white font-bold">{value}</span>
                  </div>
                ))}
              </div>

              {deployError && (
                <div className="rounded-xl border border-red-800/40 bg-red-900/15 px-4 py-3">
                  <p className="text-red-400 text-sm">{deployError}</p>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={deploying || !isConnected}
                className="w-full rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-50 transition px-4 py-4 text-sm font-bold text-white flex items-center justify-center gap-2"
              >
                {deploying && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {!isConnected
                  ? "Connect Wallet First"
                  : isWrongNetwork
                  ? "Switch to Ritual Testnet"
                  : deploying
                  ? "Deploying..."
                  : "Deploy on Ritual Testnet"}
              </button>
            </div>
          )}

          {/* STEP 3 — Success */}
          {step === 3 && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mx-auto">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14L11 19L22 8" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-black">Collection Deployed! 🎉</h2>
                <p className="text-zinc-500 text-sm mt-2">Your collection is live on Ritual Testnet.</p>
              </div>

              {txHash && (
                <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-left">
                  <p className="text-zinc-600 text-xs mb-1">Transaction Hash</p>
                  <a
                    href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-emerald-400 text-xs break-all hover:underline"
                  >
                    {txHash}
                  </a>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {deployedSlug && (
                  <Link
                    href={`/collections/${deployedSlug}/mint`}
                    className="w-full flex items-center justify-center rounded-xl bg-[#077345] hover:bg-[#066039] transition px-4 py-3 text-sm font-bold text-white"
                  >
                    View Mint Page
                  </Link>
                )}
                <Link
                  href="/collections"
                  className="w-full flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 transition px-4 py-3 text-sm font-bold text-zinc-400"
                >
                  Browse Collections
                </Link>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 3 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-500 hover:text-white disabled:opacity-30 transition"
              >
                Previous
              </button>

              {step < 2 && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 0 && !step0Valid) ||
                    (step === 1 && !step1Valid)
                  }
                  className="rounded-xl bg-[#077345] hover:bg-[#066039] disabled:opacity-40 disabled:cursor-not-allowed transition px-5 py-2 text-sm font-bold text-white"
                >
                  Continue
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-6">
          Deploying on Ritual Testnet · Chain ID 1979
        </p>
      </div>
    </main>
  );
}