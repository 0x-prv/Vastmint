"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useAccount, useWriteContract, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const steps = ["Details", "Upload", "Deploy", "Success"];

type DeployState = "idle" | "uploading" | "switching" | "pending" | "confirming" | "success" | "error";

type TokenMetadata = {
  name: string;
  description: string;
  attributes: { trait_type: string; value: string }[];
};

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 50);
}

function parseCSV(csvText: string, collectionName: string): TokenMetadata[] {
  const lines = csvText.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const descIdx = headers.indexOf("description");

  // All other columns = traits
  const traitCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h !== "name" && h !== "description");

  return lines.slice(1).map((line, rowIdx) => {
    const cols = line.split(",").map((c) => c.trim());
    const tokenName = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : `${collectionName} #${rowIdx + 1}`;
    const tokenDesc = descIdx >= 0 && cols[descIdx] ? cols[descIdx] : "";
    const attributes = traitCols
      .map(({ h, i }) => ({ trait_type: h, value: cols[i] ?? "" }))
      .filter(({ value }) => value !== "");
    return { name: tokenName, description: tokenDesc, attributes };
  });
}

function downloadCSVTemplate(collectionName: string, supply: string) {
  const count = Math.min(Number(supply) || 3, 5);
  const header = "name,description,background,eyes,mouth";
  const rows = Array.from({ length: count }, (_, i) =>
    `${collectionName || "NFT"} #${i + 1},My NFT description,Blue,Normal,Smile`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vastmint-metadata-template.csv";
  a.click();
  URL.revokeObjectURL(url);
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
  const [whitelistPrice, setWhitelistPrice] = useState("0");
  const [maxPerWallet, setMaxPerWallet] = useState("1");

  // Step 1 - Upload (single cover image — used by deploy logic)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCid, setImageCid] = useState<string | null>(null);

  // Step 1 - Bulk NFT images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Step 1 - CSV metadata
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const isWrongNetwork = isConnected && chainId !== RITUAL_CHAIN_ID;

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash && deployState === "confirming" },
  });

  const displayDeployState = txConfirmed && deployState === "confirming" ? "success" : deployState;
  const displayStep = displayDeployState === "success" ? 3 : step;
  const isPending =
    displayDeployState === "switching" ||
    displayDeployState === "pending" ||
    displayDeployState === "confirming";

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setImageFile(files[0]);
    setImagePreview(URL.createObjectURL(files[0]));
    setImageCid(null);

    setImageFiles(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
  }

  function handleCSVChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvError(null);
    setTokenMetadata([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = parseCSV(text, name);
        if (parsed.length === 0) {
          setCsvError("CSV is empty or invalid. Check the format.");
          return;
        }
        setTokenMetadata(parsed);
      } catch {
        setCsvError("Failed to parse CSV. Make sure it follows the template format.");
      }
    };
    reader.readAsText(file);
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
      // ── Step 1: Upload cover image (para sa collection thumbnail) ──────────
      let coverCid = imageCid;
      if (!coverCid) {
        coverCid = await uploadToPinata(imageFile);
        if (!coverCid) {
          setErrorMsg("Cover image upload failed. Please try again.");
          setDeployState("error");
          return;
        }
        setImageCid(coverCid);
      }

      // ── Step 2: Upload all NFT images ──────────────────────────────────────
      // Upload images as individual files, get their CIDs
      const imageCids: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const cid = await uploadToPinata(imageFiles[i]);
        if (!cid) {
          setErrorMsg(`Image #${i + 1} upload failed. Please try again.`);
          setDeployState("error");
          return;
        }
        imageCids.push(cid);
      }

      // ── Step 3: Generate and upload metadata folder ────────────────────────
      // Each token gets a JSON file: 0.json, 1.json, 2.json, etc.
      const metadataFormData = new FormData();
      const totalTokens = Number(supply);

      for (let i = 0; i < totalTokens; i++) {
        const imgCid = imageCids[i] ?? imageCids[0]; // fallback to first image
        const csvToken = tokenMetadata[i] ?? null;

        const metadata = {
          name: csvToken?.name ?? `${name} #${i}`,
          description: csvToken?.description ?? description,
          image: `ipfs://${imgCid}`,
          attributes: [
            { trait_type: "Collection", value: name },
            { trait_type: "Token ID", value: i.toString() },
            ...(csvToken?.attributes ?? []),
          ],
        };

        const blob = new Blob([JSON.stringify(metadata)], {
          type: "application/json",
        });
        const file = new File([blob], `${i}.json`, { type: "application/json" });
        metadataFormData.append("file", file, `${i}.json`);
      }

      metadataFormData.append(
        "pinataMetadata",
        JSON.stringify({ name: `${slugify(name)}-metadata` })
      );

      const folderRes = await fetch("/api/pinata/folder", {
        method: "POST",
        body: metadataFormData,
      });

      if (!folderRes.ok) {
        throw new Error("Metadata folder upload failed");
      }

      const folderData = await folderRes.json();
      const folderCid = folderData.IpfsHash;
      if (!folderCid) throw new Error("Folder CID missing");

      // baseURI = ipfs://folderCID/ — contract will append tokenId + ".json"
      const baseURIValue = `ipfs://${folderCid}/`;
      const imageUri = `ipfs://${coverCid}`;

      // ── Step 4: Switch network if needed ───────────────────────────────────
      if (isWrongNetwork) {
        setDeployState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      // ── Step 5: Deploy via Factory ─────────────────────────────────────────
      setDeployState("pending");
      const slug = slugify(name);
      const mintPriceWei = price && Number(price) > 0 ? parseEther(price) : 0n;
      const whitelistPriceWei =
        whitelistPrice && Number(whitelistPrice) > 0
          ? parseEther(whitelistPrice)
          : 0n;

      const tx = await writeContractAsync({
        address: VASTMINT_FACTORY_ADDRESS as `0x${string}`,
        abi: VASTMINT_FACTORY_ABI,
        functionName: "createCollection",
        args: [
          name.trim(),
          symbol.trim().toUpperCase(),
          description.trim(),
          imageUri,
          baseURIValue,
          BigInt(supply),
          mintPriceWei,
          whitelistPriceWei,
          BigInt(maxPerWallet || "1"),
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          slug,
        ],
      });

      setTxHash(tx);
      setDeployedSlug(slug);
      setDeployState("confirming");

      // ── Step 6: Store manifest CID sa localStorage (fallback) ─────────────
      if (tokenMetadata.length > 0) {
        localStorage.setItem(`vastmint_metadata_${slug}`, JSON.stringify(tokenMetadata));
        localStorage.setItem(`vastmint_baseuri_${slug}`, baseURIValue);
      }

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Deploy failed";
      const short =
        message.includes("rejected") || message.includes("denied")
          ? "Transaction rejected by wallet."
          : message.includes("upload failed") || message.includes("CID missing")
          ? "Upload failed. Please try again."
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

  // Trait column headers from CSV (excluding name/description)
  const traitHeaders = tokenMetadata.length > 0
    ? Object.keys(tokenMetadata[0].attributes.reduce((acc, a) => ({ ...acc, [a.trait_type]: true }), {} as Record<string, boolean>))
    : [];

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
                <div>
  <label className="mb-2 block text-sm text-[#1a2e1a]/70">Whitelist Price</label>
  <input
    value={whitelistPrice}
    onChange={(e) => setWhitelistPrice(e.target.value)}
    className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
    placeholder="0"
    type="number"
    min="0"
    step="0.001"
  />
  <p className="text-xs text-[#1a2e1a]/30 mt-1">Set 0 for free WL mint</p>
</div>

<div>
  <label className="mb-2 block text-sm text-[#1a2e1a]/70">Max Per Wallet</label>
  <input
    value={maxPerWallet}
    onChange={(e) => setMaxPerWallet(e.target.value.replace(/\D/g, ""))}
    className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition"
    placeholder="1"
    type="number"
    min="1"
  />
</div>
              </div>
            </div>
          )}

          {/* Step 1 — Upload */}
          {displayStep === 1 && (
            <div className="space-y-5">

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVChange}
                className="hidden"
              />

              {/* Section: NFT Images */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#1a4a2e] mb-2">
                  NFT Images
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border border-dashed border-[#1a4a2e]/20 bg-[#1a4a2e]/5 p-8 text-center cursor-pointer hover:border-[#1a4a2e]/50 transition"
                >
                  {imageFiles.length > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-[#1a4a2e]/20 flex items-center justify-center mx-auto">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[#1a4a2e]">
                        {imageFiles.length} file{imageFiles.length > 1 ? "s" : ""} selected
                      </p>
                      <p className="text-xs text-[#1a2e1a]/40">Click to change selection</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-[#1a4a2e]/20 flex items-center justify-center mx-auto mb-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <p className="text-sm text-[#1a2e1a]/70">Click to upload NFT images</p>
                      <p className="mt-1 text-xs text-[#1a2e1a]/30">PNG, JPG, GIF, WEBP — Max 10MB each · Select multiple</p>
                    </>
                  )}
                </div>

                {/* Image preview grid */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square">
                        <img
                          src={src}
                          alt={`NFT ${i + 1}`}
                          className="w-full h-full rounded-xl object-cover border border-[#1a4a2e]/10"
                        />
                        <span className="absolute bottom-1 right-1 bg-[#1a4a2e]/70 text-[#f5f0e8] text-[10px] rounded px-1 leading-5">
                          #{i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

               {/* Supply mismatch warning */}
{imageFiles.length > 0 && Number(supply) > 0 && imageFiles.length !== Number(supply) && (
  <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 px-4 py-3 mt-3">
    <p className="text-yellow-500 text-xs">
      ⚠️ {imageFiles.length} image{imageFiles.length > 1 ? "s" : ""} selected but maximum supply is {supply}.
      {imageFiles.length < Number(supply)
        ? ` Need ${Number(supply) - imageFiles.length} more images.`
        : ` ${imageFiles.length - Number(supply)} extra images selected.`}
    </p>
  </div>
)}

                {/* IPFS confirmation */}
                {imageCid && (
                  <div className="rounded-xl bg-[#e0dbd0]/70 border border-[#1a4a2e]/30 px-4 py-3 mt-3">
                    <p className="text-xs text-[#1a2e1a]/40">Cover image uploaded to IPFS ✓</p>
                    <p className="text-xs text-[#1a4a2e] font-mono mt-0.5 break-all">ipfs://{imageCid}</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-[#1a4a2e]/10" />

              {/* Section: CSV Metadata */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#1a4a2e]">
                    Metadata / Traits <span className="text-[#1a2e1a]/30 normal-case font-normal">(optional)</span>
                  </p>
                  <button
                    onClick={() => downloadCSVTemplate(name, supply)}
                    className="text-xs text-[#1a4a2e] border border-[#1a4a2e]/30 rounded-xl px-3 py-1.5 hover:bg-[#1a4a2e]/10 transition"
                  >
                    ↓ Download Template
                  </button>
                </div>

                <div
                  onClick={() => csvInputRef.current?.click()}
                  className="rounded-2xl border border-dashed border-[#1a4a2e]/20 bg-[#1a4a2e]/5 p-6 text-center cursor-pointer hover:border-[#1a4a2e]/50 transition"
                >
                  {csvFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-bold text-[#1a4a2e]">{csvFile.name}</p>
                      <p className="text-xs text-[#1a2e1a]/40">
                        {tokenMetadata.length > 0 ? `${tokenMetadata.length} tokens parsed ✓` : "Parsing..."}
                      </p>
                      <p className="text-xs text-[#1a2e1a]/30 mt-1">Click to change</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[#1a2e1a]/70">Click to upload metadata CSV</p>
                      <p className="mt-1 text-xs text-[#1a2e1a]/30">
                        Download the template above, fill it in, then upload here
                      </p>
                    </>
                  )}
                </div>

                {/* CSV parse error */}
                {csvError && (
                  <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3 mt-3">
                    <p className="text-red-400 text-xs">⚠️ {csvError}</p>
                  </div>
                )}

                {/* CSV mismatch warning */}
                {tokenMetadata.length > 0 && imageFiles.length > 0 && tokenMetadata.length !== imageFiles.length && (
                  <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 px-4 py-3 mt-3">
                    <p className="text-yellow-500 text-xs">
                      ⚠️ Metadata count does not match image count. CSV contains {tokenMetadata.length} rows while {imageFiles.length} images were uploaded.
                    </p>
                  </div>
                )}

                {/* Metadata preview table */}
                {tokenMetadata.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-[#1a4a2e]/15 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#1a4a2e]/10">
                            <th className="text-left px-3 py-2 text-[#1a2e1a]/50 font-medium">#</th>
                            <th className="text-left px-3 py-2 text-[#1a2e1a]/50 font-medium">Name</th>
                            {traitHeaders.map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-[#1a2e1a]/50 font-medium capitalize">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tokenMetadata.slice(0, 5).map((token, i) => (
                            <tr key={i} className="border-t border-[#1a4a2e]/10">
                              <td className="px-3 py-2 text-[#1a2e1a]/40">{i + 1}</td>
                              <td className="px-3 py-2 text-[#1a2e1a]">{token.name}</td>
                              {traitHeaders.map((h) => {
                                const attr = token.attributes.find((a) => a.trait_type === h);
                                return (
                                  <td key={h} className="px-3 py-2 text-[#1a2e1a]/70">{attr?.value ?? "—"}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {tokenMetadata.length > 5 && (
                      <p className="text-center text-xs text-[#1a2e1a]/30 py-2 border-t border-[#1a4a2e]/10">
                        + {tokenMetadata.length - 5} more tokens
                      </p>
                    )}
                  </div>
                )}
              </div>
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
                  { label: "Whitelist Price", value: whitelistPrice === "0" || !whitelistPrice ? "Free" : `${whitelistPrice} RITUAL` },
                  { label: "Max Per Wallet", value: maxPerWallet || "1" },
                  { label: "Slug", value: slugify(name) },
                  { label: "Network", value: "Ritual Testnet" },
                  { label: "NFT Images", value: `${imageFiles.length} file${imageFiles.length > 1 ? "s" : ""} selected` },
                  ...(tokenMetadata.length > 0
                    ? [{ label: "Metadata", value: `${tokenMetadata.length} tokens from CSV ✓` }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#1a2e1a]/40">{label}</span>
                    <span className="text-[#1a2e1a] font-medium">{value}</span>
                  </div>
                ))}
                {imagePreview && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-[#1a2e1a]/40">Cover Image</span>
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
                  disabled={displayStep === 0 ? !canProceedStep0 : !canProceedStep1}
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