"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useAccount, useWriteContract, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const steps = ["Details", "Upload", "Deploy", "Success"];

type DeployState = "idle" | "uploading" | "switching" | "pending" | "confirming" | "success" | "error";

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 50);
}

export default function LaunchpadCreatePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState(0);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deployedSlug, setDeployedSlug] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Step 1 - Details
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("");
  const [price, setPrice] = useState("0");

  // Step 2 - Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCid, setImageCid] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWrongNetwork = isConnected && chainId !== RITUAL_CHAIN_ID;

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && deployState === "confirming" },
  });
  const displayDeployState = txConfirmed && deployState === "confirming" ? "success" : deployState;
  const displayStep = displayDeployState === "success" ? 3 : step;
  const isPending =
    displayDeployState === "uploading" ||
    displayDeployState === "switching" ||
    displayDeployState === "pending" ||
    displayDeployState === "confirming";

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageCid(null);
  }

  async function uploadToPinata() {
    if (!imageFile) return null;
    setDeployState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("pinataMetadata", JSON.stringify({ name: `${name}-image` }));

      const res = await fetch("/api/pinata/file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Pinata upload failed");
      const data = await res.json();
      const cid = data.IpfsHash;
      setImageCid(cid);
      return cid;
    } catch (err) {
      console.error(err);
      setErrorMsg("Image upload failed. Please try again.");
      setDeployState("error");
      return null;
    }
  }

  async function handleDeploy() {
    if (!address || !isConnected) return;
    setErrorMsg(null);

    try {
      // Upload image first if not yet uploaded
      let cid = imageCid;
      if (!cid) {
        cid = await uploadToPinata();
        if (!cid) return;
      }

      // Upload metadata JSON to Pinata
      setDeployState("uploading");
      const metadata = {
        name,
        description,
        image: `ipfs://${cid}`,
        attributes: [
          { trait_type: "Collection", value: name },
          { trait_type: "Network", value: "Ritual Testnet" },
        ],
      };

      const metaRes = await fetch("/api/pinata/json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: { name: `${name}-metadata` },
        }),
      });

      if (!metaRes.ok) throw new Error("Metadata upload failed");
      await metaRes.json();

      // Switch network if needed
      if (isWrongNetwork) {
        setDeployState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      // Deploy via Factory
      setDeployState("pending");
      const slug = slugify(name);
      const mintPriceWei = price && Number(price) > 0 ? parseEther(price) : 0n;

      const tx = await writeContractAsync({
        address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
        abi: VASTMINT_FACTORY_ABI,
        functionName: "createCollection",
        args: [
          name,
          symbol,
          description,
          `ipfs://${cid}`,
          BigInt(supply),
          mintPriceWei,
          slug,
        ],
      });

      setTxHash(tx);
      setDeployedSlug(slug);
      setDeployState("confirming");

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Deploy failed";
      const short = message.includes("rejected") || message.includes("denied")
        ? "Transaction rejected by wallet."
        : "Deploy failed. Please try again.";
      setErrorMsg(short);
      setDeployState("error");
    }
  }

  const canProceedStep0 = name.trim().length > 0 && symbol.trim().length > 0 && description.trim().length > 0 && supply.trim().length > 0 && Number(supply) > 0;
  const canProceedStep1 = !!imageFile;

  return (
    <main className="min-h-screen bg-[#05150f] px-5 pt-6 pb-24 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#077345]/8 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <p className="text-[#077345] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black tracking-tight">Creator Deploy Flow</h1>
          <p className="mt-3 text-sm text-white/50">
            Configure your Ritual-native collection and deploy in minutes.
          </p>
        </div>

        <section className="rounded-3xl border border-[#077345]/20 bg-[#0b1f17] p-6 shadow-2xl shadow-black/30">
          {/* Step Tabs */}
          <div className="mb-6 grid grid-cols-4 gap-2">
            {steps.map((item, index) => (
              <button
                key={item}
                onClick={() => {
                  if (index < displayStep) setStep(index);
                }}
                className={`rounded-2xl border px-3 py-3 text-sm transition ${
                  displayStep === index
                    ? "border-[#077345] bg-[#077345]/20 text-white"
                    : index < displayStep
                    ? "border-[#077345]/30 bg-[#077345]/10 text-emerald-400"
                    : "border-white/10 bg-white/[0.03] text-white/40"
                }`}
              >
                <span className="block text-xs text-white/40 mb-0.5">Step {index + 1}</span>
                {item}
              </button>
            ))}
          </div>

          {/* Step 0 - Details */}
          {displayStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">Collection Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                  placeholder="Vast Genesis"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">Symbol</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                  placeholder="VAST"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                  placeholder="Describe your collection and launch vision."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">Max Supply</label>
                  <input
                    value={supply}
                    onChange={(e) => setSupply(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-2xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-white/70">Mint Price (RITUAL)</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#05150f] px-4 py-3 text-white outline-none focus:border-[#077345] transition"
                    placeholder="0"
                  />
                  <p className="text-xs text-white/30 mt-1">Set 0 for free mint</p>
                </div>
              </div>
              {name && (
                <div className="rounded-xl bg-black/20 border border-white/5 px-4 py-2">
                  <p className="text-xs text-white/40">Mint page URL preview</p>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">/collections/{slugify(name)}/mint</p>
                </div>
              )}
            </div>
          )}

          {/* Step 1 - Upload */}
          {displayStep === 1 && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center cursor-pointer hover:border-[#077345]/50 hover:bg-[#077345]/5 transition"
              >
                {imagePreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={imagePreview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover" />
                    <p className="text-sm text-emerald-400">{imageFile?.name}</p>
                    <p className="text-xs text-white/40">Click to change</p>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium">Upload NFT Image</p>
                    <p className="mt-2 text-sm text-white/50">PNG, JPG, GIF, SVG — Max 10MB</p>
                    <button className="mt-6 rounded-2xl bg-[#077345] px-5 py-3 text-sm font-medium text-white hover:bg-[#066039] transition">
                      Choose File
                    </button>
                  </>
                )}
              </div>
              {imageCid && (
                <div className="rounded-xl bg-black/20 border border-emerald-700/20 px-4 py-3">
                  <p className="text-xs text-white/40">Uploaded to IPFS</p>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5 break-all">{imageCid}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2 - Deploy */}
          {displayStep === 2 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-3">
                <p className="text-[#077345] text-xs font-bold uppercase tracking-widest mb-3">Collection Summary</p>
                {[
                  { label: "Name", value: name },
                  { label: "Symbol", value: symbol },
                  { label: "Supply", value: supply },
                  { label: "Mint Price", value: price === "0" ? "Free" : `${price} RITUAL` },
                  { label: "Slug", value: slugify(name) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-white/40">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
                {imagePreview && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-white/40">Image</span>
                    <img src={imagePreview} alt="NFT" className="w-10 h-10 rounded-lg object-cover" />
                  </div>
                )}
              </div>

              {!isConnected && (
                <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
                  <p className="text-red-400 text-sm">Connect your wallet to deploy.</p>
                </div>
              )}

              {displayDeployState === "error" && errorMsg && (
                <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
                  <p className="text-red-400 text-sm">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={!isConnected || isPending}
                className={`w-full rounded-2xl px-5 py-4 font-bold text-sm transition flex items-center justify-center gap-2 ${
                  !isConnected
                    ? "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-white/5"
                    : isPending
                    ? "bg-[#077345]/60 text-white/70 cursor-not-allowed"
                    : "bg-[#077345] hover:bg-[#066039] text-white"
                }`}
              >
                {isPending && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {!isConnected
                  ? "Connect Wallet to Deploy"
                  : displayDeployState === "uploading"
                  ? "Uploading to IPFS..."
                  : displayDeployState === "switching"
                  ? "Switching Network..."
                  : displayDeployState === "pending"
                  ? "Confirm in Wallet..."
                  : displayDeployState === "confirming"
                  ? "Confirming Transaction..."
                  : isWrongNetwork
                  ? "Switch to Ritual Testnet"
                  : "Deploy Collection"}
              </button>

              <p className="text-center text-zinc-700 text-xs">
                Deploying on Ritual Testnet · Chain ID 1979
              </p>
            </div>
          )}

          {/* Step 3 - Success */}
          {displayStep === 3 && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center mb-5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14L11 19L22 8" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-2xl font-black">Collection Deployed!</h2>
              <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
                Your NFT collection is live on Ritual Testnet. Share the mint page with your collectors!
              </p>
              {txHash && (
                <div className="mt-5 w-full rounded-xl border border-white/5 bg-black/30 p-4 text-left">
                  <p className="text-zinc-600 text-xs mb-1">Transaction Hash</p>
                  <p className="font-mono text-emerald-400 text-xs break-all">{txHash}</p>
                </div>
              )}
              <div className="mt-5 flex gap-3 w-full">
                {deployedSlug && (
                  <Link
                    href={`/collections/${deployedSlug}/mint`}
                    className="flex-1 flex items-center justify-center rounded-2xl bg-[#077345] hover:bg-[#066039] transition px-4 py-3 text-sm font-bold text-white"
                  >
                    View Mint Page
                  </Link>
                )}
                <Link
                  href="/collections"
                  className="flex-1 flex items-center justify-center rounded-2xl border border-[#077345]/30 hover:bg-[#077345]/10 transition px-4 py-3 text-sm font-bold text-emerald-400"
                >
                  All Collections
                </Link>
              </div>
            </div>
          )}

          {/* Navigation */}
          {displayStep < 3 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <button
                onClick={() => setStep((c) => Math.max(c - 1, 0))}
                disabled={displayStep === 0}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/70 hover:text-white disabled:opacity-30 transition"
              >
                Previous
              </button>
              {displayStep < 2 && (
                <button
                  onClick={() => setStep((c) => Math.min(c + 1, 2))}
                  disabled={displayStep === 0 ? !canProceedStep0 : displayStep === 1 ? !canProceedStep1 : false}
                  className="rounded-2xl bg-[#077345] px-5 py-3 text-sm font-medium text-white hover:bg-[#066039] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Continue
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}