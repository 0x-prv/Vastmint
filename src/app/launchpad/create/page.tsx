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

  // Step 0 - Details
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("");
  const [price, setPrice] = useState("0");

  // Step 1 - Upload
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

  async function uploadToPinata(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pinataMetadata", JSON.stringify({ name: `${name}-image` }));

      const res = await fetch("/api/pinata/file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Pinata upload failed");
      const data = await res.json();
      return data.IpfsHash as string;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async function handleDeploy() {
    if (!address || !isConnected || !imageFile) return;
    setErrorMsg(null);
    setDeployState("uploading");

    try {
      // Step 1: Upload image
      let cid = imageCid;
      if (!cid) {
        cid = await uploadToPinata(imageFile);
        if (!cid) {
          setErrorMsg("Image upload failed. Please try again.");
          setDeployState("error");
          return;
        }
        setImageCid(cid);
      }

      // Step 2: Upload metadata JSON
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
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name: `${name}-metadata` },
  }),
});

if (!metaRes.ok) throw new Error("Metadata upload failed");
const metaData = await metaRes.json();
const metadataCid = metaData.IpfsHash as string;
if (!metadataCid) throw new Error("Metadata CID missing");

      // Step 3: Switch network if needed
      if (isWrongNetwork) {
        setDeployState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      // Step 4: Deploy via Factory
      setDeployState("pending");
      const slug = slugify(name);
      const mintPriceWei = price && Number(price) > 0 ? parseEther(price) : 0n;

      const tx = await writeContractAsync({
        address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
        abi: VASTMINT_FACTORY_ABI,
        functionName: "createCollection",
        args: [
          name.trim(),
          symbol.trim().toUpperCase(),
          description.trim(),
          `ipfs://${metadataCid}`,
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
      const short =
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected by wallet."
          : "Deploy failed. Please try again.";
      setErrorMsg(short);
      setDeployState("error");
    }
  }

  const canProceedStep0 =
    name.trim().length > 0 &&
    symbol.trim().length > 0 &&
    description.trim().length > 0 &&
    Number(supply) > 0;
  const canProceedStep1 = !!imageFile;

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 pt-6 pb-24 text-[#1a2e1a]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#1a4a2e]/5 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black tracking-tight">Deploy Your Collection</h1>
          <p className="mt-3 text-sm text-[#1a2e1a]/50">
            Launch your Ritual-native NFT collection in minutes.
          </p>
        </div>

        <section className="rounded-3xl border border-[#1a4a2e]/20 bg-[#ede8df] p-6 shadow-2xl shadow-[#1a4a2e]/10">
          {/* Step Tabs */}
          <div className="mb-6 grid grid-cols-4 gap-2">
            {steps.map((item, index) => (
              <button
                key={item}
                onClick={() => { if (index < displayStep) setStep(index); }}
                className={`rounded-2xl border px-3 py-3 text-sm transition ${
                  displayStep === index
                    ? "border-[#1a4a2e] bg-[#1a4a2e]/20 text-[#1a2e1a]"
                    : index < displayStep
                    ? "border-[#1a4a2e]/30 bg-[#1a4a2e]/10 text-[#1a4a2e]"
                    : "border-[#1a4a2e]/20 bg-[#1a4a2e]/5 text-[#1a2e1a]/40"
                }`}
              >
                <span className="block text-xs text-[#1a2e1a]/40 mb-0.5">
                  {index < displayStep ? "✓" : `Step ${index + 1}`}
                </span>
                {item}
              </button>
            ))}
          </div>

          {/* Step 0 — Details */}
          {displayStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-[#1a2e1a]/70">Collection Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                  placeholder="Vast Genesis"
                />
                {name && (
                  <p className="text-[#7a9e7a] text-xs mt-1 font-mono">
                    Slug: /collections/<span className="text-[#1a4a2e]">{slugify(name)}</span>/mint
                  </p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm text-[#1a2e1a]/70">Symbol *</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                  placeholder="VAST"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-[#1a2e1a]/70">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                  placeholder="Describe your collection and launch vision."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm text-[#1a2e1a]/70">Max Supply *</label>
                  <input
                    value={supply}
                    onChange={(e) => setSupply(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                    placeholder="1000"
                    type="number"
                    min="1"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-[#1a2e1a]/70">Mint Price (RITUAL)</label>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
                    placeholder="0"
                    type="number"
                    min="0"
                    step="0.001"
                  />
                  <p className="text-xs text-[#1a2e1a]/30 mt-1">Set 0 for free mint</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Upload */}
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
                className="rounded-2xl border border-dashed border-[#1a4a2e]/20 bg-[#1a4a2e]/5 p-10 text-center cursor-pointer hover:border-[#1a4a2e]/50 hover:bg-[#1a4a2e]/5 transition"
              >
                {imagePreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={imagePreview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover" />
                    <p className="text-sm text-[#1a4a2e]">{imageFile?.name}</p>
                    <p className="text-xs text-[#1a2e1a]/40">Click to change</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#1a4a2e]/20 flex items-center justify-center mx-auto mb-4">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="text-sm text-[#1a2e1a]/70">Click to upload collection image</p>
                    <p className="mt-1 text-xs text-[#1a2e1a]/30">PNG, JPG, GIF, WEBP — Max 10MB</p>
                  </>
                )}
              </div>
              {imageCid && (
                <div className="rounded-xl bg-[#e0dbd0]/70 border border-[#1a4a2e]/30 px-4 py-3">
                  <p className="text-xs text-[#1a2e1a]/40">Already uploaded to IPFS ✓</p>
                  <p className="text-xs text-[#1a4a2e] font-mono mt-0.5 break-all">ipfs://{imageCid}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Deploy */}
          {displayStep === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#e0dbd0]/70 p-5 space-y-3">
                <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-widest mb-3">
                  Collection Summary
                </p>
                {[
                  { label: "Name", value: name },
                  { label: "Symbol", value: symbol },
                  { label: "Supply", value: Number(supply).toLocaleString() },
                  { label: "Mint Price", value: price === "0" || !price ? "Free" : `${price} RITUAL` },
                  { label: "Slug", value: slugify(name) },
                  { label: "Network", value: "Ritual Testnet" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#1a2e1a]/40">{label}</span>
                    <span className="text-[#1a2e1a] font-medium">{value}</span>
                  </div>
                ))}
                {imagePreview && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-[#1a2e1a]/40">Image</span>
                    <img src={imagePreview} alt="NFT" className="w-10 h-10 rounded-lg object-cover" />
                  </div>
                )}
              </div>

              {!isConnected && (
                <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
                  <p className="text-red-400 text-sm">Connect your wallet to deploy.</p>
                </div>
              )}

              {deployState === "error" && errorMsg && (
                <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3">
                  <p className="text-red-400 text-sm">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleDeploy}
                disabled={!isConnected || isPending}
                className={`w-full rounded-2xl px-5 py-4 font-bold text-sm transition flex items-center justify-center gap-2 ${
                  !isConnected
                    ? "bg-[#e0dbd0] text-[#7a9e7a] cursor-not-allowed border border-[#1a4a2e]/15"
                    : isPending
                    ? "bg-[#1a4a2e]/50 text-[#f5f0e8]/70 cursor-not-allowed"
                    : "bg-[#1a4a2e] hover:bg-[#143d24] text-[#f5f0e8]"
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
                  : deployState === "uploading"
                  ? "Uploading to IPFS..."
                  : deployState === "switching"
                  ? "Switching Network..."
                  : deployState === "pending"
                  ? "Confirm in Wallet..."
                  : deployState === "confirming"
                  ? "Confirming Transaction..."
                  : isWrongNetwork
                  ? "Switch to Ritual Testnet"
                  : "Deploy Collection"}
              </button>

              <p className="text-center text-[#7a9e7a] text-xs">
                Deploying on Ritual Testnet · Chain ID 1979
              </p>
            </div>
          )}

          {/* Step 3 — Success */}
          {displayStep === 3 && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#1a4a2e]/10 border border-[#1a4a2e]/30 flex items-center justify-center mb-5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14L11 19L22 8" stroke="#1a4a2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-2xl font-black">Collection Deployed! 🎉</h2>
              <p className="text-[#4a6741] text-sm mt-2 max-w-xs leading-relaxed">
                Your NFT collection is live on Ritual Testnet. Share the mint page with your collectors!
              </p>
              {txHash && (
                <div className="mt-5 w-full rounded-xl border border-[#1a4a2e]/15 bg-[#e0dbd0]/30 p-4 text-left">
                  <p className="text-[#7a9e7a] text-xs mb-1">Transaction Hash</p>
                  <a
                    href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#1a4a2e] text-xs break-all hover:underline"
                  >
                    {txHash}
                  </a>
                </div>
              )}
              <div className="mt-5 flex gap-3 w-full">
                {deployedSlug && (
                  <Link
                    href={`/collections/${deployedSlug}/mint`}
                    className="flex-1 flex items-center justify-center rounded-2xl bg-[#1a4a2e] hover:bg-[#143d24] transition px-4 py-3 text-sm font-bold text-[#f5f0e8]"
                  >
                    View Mint Page
                  </Link>
                )}
                <Link
                  href="/collections"
                  className="flex-1 flex items-center justify-center rounded-2xl border border-[#1a4a2e]/30 hover:bg-[#1a4a2e]/10 transition px-4 py-3 text-sm font-bold text-[#1a4a2e]"
                >
                  All Collections
                </Link>
              </div>
            </div>
          )}

          {/* Navigation */}
          {displayStep < 3 && (
            <div className="mt-6 flex items-center justify-between border-t border-[#1a4a2e]/20 pt-5">
              <button
                onClick={() => setStep((c) => Math.max(c - 1, 0))}
                disabled={displayStep === 0}
                className="rounded-2xl border border-[#1a4a2e]/20 px-5 py-3 text-sm text-[#1a2e1a]/70 hover:text-[#1a2e1a] disabled:opacity-30 transition"
              >
                Previous
              </button>
              {displayStep < 2 && (
                <button
                  onClick={() => setStep((c) => Math.min(c + 1, 2))}
                  disabled={
                    displayStep === 0 ? !canProceedStep0 : !canProceedStep1
                  }
                  className="rounded-2xl bg-[#1a4a2e] px-5 py-3 text-sm font-medium text-[#f5f0e8] hover:bg-[#143d24] disabled:opacity-40 disabled:cursor-not-allowed transition"
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
