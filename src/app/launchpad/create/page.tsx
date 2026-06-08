"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useAccount, useWriteContract, useChainId, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { parseGwei } from "viem";
import { VASTMINT_FACTORY_ADDRESS, RITUAL_CHAIN_ID } from "@/lib/blockchain/contracts";
import { VASTMINT_FACTORY_ABI } from "@/lib/blockchain/abi";

const steps = ["Details", "Upload", "Deploy", "Success"];
const BROWSER_UPLOAD_LIMIT = 200;
const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

type DeployState = "idle" | "uploading" | "switching" | "pending" | "confirming" | "success" | "error";
type UploadMode = "browser" | "ipfs";

type TokenMetadata = {
  name: string;
  description: string;
  attributes: { trait_type: string; value: string }[];
};

type PinataCredentials = {
  apiKey: string;
  apiSecret: string;
};

async function getPinataCredentials(): Promise<PinataCredentials> {
  const res = await fetch("/api/pinata/key");
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = data?.error ?? `HTTP ${res.status}`;
    throw new Error(`Pinata credentials request failed: ${detail}`);
  }

  if (typeof data.apiKey !== "string" || typeof data.apiSecret !== "string") {
    throw new Error("Pinata credentials response was invalid.");
  }

  return { apiKey: data.apiKey, apiSecret: data.apiSecret };
}

function getPinataCredentialHeaders(credentials: PinataCredentials) {
  return {
    pinata_api_key: credentials.apiKey,
    pinata_secret_api_key: credentials.apiSecret,
  };
}

function formatPinataErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "Unknown error";
}

async function uploadFormDataToPinata(
  formData: FormData,
  credentials: PinataCredentials,
  errorPrefix: string
): Promise<string> {
  const res = await fetch(PINATA_FILE_URL, {
    method: "POST",
    headers: getPinataCredentialHeaders(credentials),
    body: formData,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = data?.error ?? data?.details ?? `HTTP ${res.status}`;
    throw new Error(`${errorPrefix}: ${formatPinataErrorDetail(detail)}`);
  }

  if (typeof data.IpfsHash !== "string") {
    throw new Error(`${errorPrefix}: Pinata response did not include an IPFS hash.`);
  }

  return data.IpfsHash;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 50);
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext || "png";
}

function getCollectionFolderName(collectionName: string) {
  return slugify(collectionName) || "collection";
}

function parseCSV(csvText: string, collectionName: string): TokenMetadata[] {
  const lines = csvText.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const descIdx = headers.indexOf("description");
  const traitCols = headers.map((h, i) => ({ h, i })).filter(({ h }) => h !== "name" && h !== "description");
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");

  // Step 0 - Details
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("");
  const [price, setPrice] = useState("0");
  const [whitelistPrice, setWhitelistPrice] = useState("0");
  const [maxPerWallet, setMaxPerWallet] = useState("1");

  // Step 1 - Upload mode (auto-set based on supply)
  const [uploadMode, setUploadMode] = useState<UploadMode>("browser");

  // Mode A — Browser Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCid, setImageCid] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata[]>([]);

  // Mode B — IPFS Paste
  const [pastedBaseURI, setPastedBaseURI] = useState("");
  const [pastedCoverCID, setPastedCoverCID] = useState("");

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

  // Auto-switch upload mode based on supply
  useEffect(() => {
    const n = Number(supply);
    if (n > BROWSER_UPLOAD_LIMIT) setUploadMode("ipfs");
    else setUploadMode("browser");
  }, [supply]);

  useEffect(() => {
    return () => { imagePreviews.forEach((url) => URL.revokeObjectURL(url)); };
  }, [imagePreviews]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImageFile(files[0]);
    setImagePreview(URL.createObjectURL(files[0]));
    setImageCid(null);
    setImageFiles(files);
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
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
        if (parsed.length === 0) { setCsvError("CSV is empty or invalid."); return; }
        setTokenMetadata(parsed);
      } catch { setCsvError("Failed to parse CSV. Check the template format."); }
    };
    reader.readAsText(file);
  }

  // Upload single file to Pinata (cover image)
  async function uploadCoverToPinata(file: File): Promise<string | null> {
    try {
      const credentials = await getPinataCredentials();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pinataMetadata", JSON.stringify({ name: `${slugify(name)}-cover` }));
      return await uploadFormDataToPinata(formData, credentials, "Cover upload failed");
    } catch { return null; }
  }
  // Upload image folder directly to Pinata from the browser
  async function uploadImageFolderToPinata(files: File[]): Promise<string | null> {
    try {
      const credentials = await getPinataCredentials();
      const formData = new FormData();
      const folderName = getCollectionFolderName(name);
      files.forEach((file, i) => {
        const ext = getFileExtension(file.name);
        formData.append("file", file, `${folderName}/${i + 1}.${ext}`);
      });
      formData.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));
      formData.append("pinataMetadata", JSON.stringify({ name: `${folderName}-images` }));
      return await uploadFormDataToPinata(formData, credentials, "Folder upload failed");
    } catch (err) {
      console.error("uploadImageFolderToPinata:", err);
      setErrorMsg(err instanceof Error ? err.message : "Image folder upload failed.");
      return null;
    }
  }
  // Upload metadata JSON folder as one direct Pinata call
  async function uploadMetadataFolder(
    imageFolderCid: string,
    totalTokens: number,
    coverCid: string
  ): Promise<string | null> {
    try {
      const credentials = await getPinataCredentials();
      const formData = new FormData();
      for (let i = 0; i < totalTokens; i++) {
        const csvToken = tokenMetadata[i] ?? null;
        const ext = imageFiles[0]?.name.split(".").pop() ?? "png";
        const metadata = {
          name: csvToken?.name ?? `${name} #${i + 1}`,
          description: csvToken?.description ?? description,
          image: `ipfs://${imageFolderCid}/${i + 1}.${ext}`,
          attributes: [
            { trait_type: "Collection", value: name },
            ...(csvToken?.attributes ?? []),
          ],
        };
        const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
        formData.append("file", new File([blob], `${i}.json`, { type: "application/json" }), `${i}.json`);
      }
      formData.append("pinataMetadata", JSON.stringify({ name: `${slugify(name)}-metadata` }));
      formData.append("pinataOptions", JSON.stringify({ wrapWithDirectory: true }));
      return await uploadFormDataToPinata(formData, credentials, "Metadata folder upload failed");
    } catch { return null; }
  }

  async function handleDeploy() {
    if (!address || !isConnected) return;
    setErrorMsg(null);
    setDeployState("uploading");
    setUploadProgress(0);

    const totalTokens = Number(supply);
    if (!Number.isInteger(totalTokens) || totalTokens <= 0) {
      setErrorMsg("Invalid max supply.");
      setDeployState("error");
      return;
    }

    let baseURIValue = "";
    let imageUri = "";

    try {
      // ── MODE B: IPFS Paste (high supply > 200) ──────────────────────────
      if (uploadMode === "ipfs") {
        if (!pastedBaseURI.trim() || !pastedCoverCID.trim()) {
          setErrorMsg("Please provide both baseURI and cover image CID.");
          setDeployState("error");
          return;
        }
        baseURIValue = pastedBaseURI.trim().endsWith("/")
          ? pastedBaseURI.trim()
          : `${pastedBaseURI.trim()}/`;
        imageUri = pastedCoverCID.trim().startsWith("ipfs://")
          ? pastedCoverCID.trim()
          : `ipfs://${pastedCoverCID.trim()}`;
        setUploadProgress(100);

      // ── MODE A: Browser Upload (≤ 200 supply) ──────────────────────────
      } else {
        if (!imageFile) { setErrorMsg("Please select a cover image."); setDeployState("error"); return; }
        if (imageFiles.length !== totalTokens) {
          setErrorMsg(`Upload exactly ${totalTokens} NFT images. You selected ${imageFiles.length}.`);
          setDeployState("error");
          return;
        }
        if (tokenMetadata.length > 0 && tokenMetadata.length !== totalTokens) {
          setErrorMsg(`CSV must have ${totalTokens} rows, got ${tokenMetadata.length}.`);
          setDeployState("error");
          return;
        }

        // Step 1: Cover image
        setUploadStep("Uploading cover image...");
        let coverCid = imageCid;
        if (!coverCid) {
          coverCid = await uploadCoverToPinata(imageFile);
          if (!coverCid) { setErrorMsg("Cover image upload failed."); setDeployState("error"); return; }
          setImageCid(coverCid);
        }
        setUploadProgress(20);

        // Step 2: Upload ALL images as one folder (single Pinata call)
        setUploadStep(`Uploading ${totalTokens} images to IPFS...`);
        const imageFolderCid = await uploadImageFolderToPinata(imageFiles);
        if (!imageFolderCid) { setDeployState("error"); return; }
        setUploadProgress(60);

        // Step 3: Generate + upload metadata folder
        setUploadStep("Generating metadata...");
        const metadataFolderCid = await uploadMetadataFolder(imageFolderCid, totalTokens, coverCid);
        if (!metadataFolderCid) { setErrorMsg("Metadata upload failed. Please try again."); setDeployState("error"); return; }
        setUploadProgress(90);

        baseURIValue = `ipfs://${metadataFolderCid}/`;
        imageUri = `ipfs://${coverCid}`;
      }

      // ── Switch network if needed ─────────────────────────────────────────
      if (isWrongNetwork) {
        setDeployState("switching");
        await switchChainAsync({ chainId: RITUAL_CHAIN_ID });
      }

      // ── Deploy via Factory ───────────────────────────────────────────────
      setDeployState("pending");
      setUploadStep("");
      const slug = slugify(name);
      const mintPriceWei = price && Number(price) > 0 ? parseEther(price) : 0n;
      const whitelistPriceWei = whitelistPrice && Number(whitelistPrice) > 0 ? parseEther(whitelistPrice) : 0n;

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
  gasPrice: parseGwei("1"),
});

      setTxHash(tx);
      setDeployedSlug(slug);
      setDeployState("confirming");
      setUploadProgress(100);

      // Store baseURI fallback
      localStorage.setItem(`vastmint_baseuri_${slug}`, baseURIValue);
      if (tokenMetadata.length > 0) {
        localStorage.setItem(`vastmint_metadata_${slug}`, JSON.stringify(tokenMetadata));
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

  const canProceedStep1 =
    uploadMode === "ipfs"
      ? pastedBaseURI.trim().length > 0 && pastedCoverCID.trim().length > 0
      : !!imageFile && imageFiles.length === Number(supply);

  const traitHeaders = tokenMetadata.length > 0
    ? Object.keys(tokenMetadata[0].attributes.reduce((acc, a) => ({ ...acc, [a.trait_type]: true }), {} as Record<string, boolean>))
    : [];

  const isHighSupply = Number(supply) > BROWSER_UPLOAD_LIMIT;

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 pt-6 pb-24 text-[#1a2e1a]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#1a4a2e]/5 rounded-full blur-[120px]" />
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-[0.18em] mb-2">VastMint</p>
          <h1 className="text-4xl font-black tracking-tight">Deploy Your Collection</h1>
          <p className="mt-3 text-sm text-[#1a2e1a]/50">Launch your Ritual-native NFT collection in minutes.</p>
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

          {/* ── Step 0: Details ─────────────────────────────────────────────── */}
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
                  {isHighSupply && (
                    <p className="text-xs text-amber-600 mt-1">⚡ High supply — IPFS paste mode will be used</p>
                  )}
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

          {/* ── Step 1: Upload ──────────────────────────────────────────────── */}
          {displayStep === 1 && (
            <div className="space-y-5">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCSVChange} className="hidden" />

              {/* Mode toggle */}
              <div className="flex rounded-2xl border border-[#1a4a2e]/20 overflow-hidden">
                <button
                  onClick={() => setUploadMode("browser")}
                  disabled={isHighSupply}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                    uploadMode === "browser"
                      ? "bg-[#1a4a2e] text-[#f5f0e8]"
                      : "bg-transparent text-[#1a2e1a]/40 hover:text-[#1a2e1a]/70 disabled:cursor-not-allowed"
                  }`}
                >
                  Browser Upload {!isHighSupply && `(≤${BROWSER_UPLOAD_LIMIT})`}
                </button>
                <button
                  onClick={() => setUploadMode("ipfs")}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                    uploadMode === "ipfs"
                      ? "bg-[#1a4a2e] text-[#f5f0e8]"
                      : "bg-transparent text-[#1a2e1a]/40 hover:text-[#1a2e1a]/70"
                  }`}
                >
                  Paste IPFS CID {isHighSupply && "(Required)"}
                </button>
              </div>

              {/* IPFS Guide — Step by step */}
              {uploadMode === "ipfs" && (
  <div className="space-y-5">
<div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#e0dbd0]/50 overflow-hidden">
  <div className="px-4 py-3 border-b border-[#1a4a2e]/10">
    <p className="text-xs font-bold text-[#1a4a2e] uppercase tracking-widest">How to prepare your IPFS folder</p>
    <p className="text-xs text-[#1a2e1a]/40 mt-0.5">Follow these steps before deploying</p>
  </div>

  {[
    {
      n: 1,
      title: "Prepare your image files",
      desc: "Name them sequentially: 1.png, 2.png ... up to your max supply.",
      code: null,
    },
    {
      n: 2,
      title: "Upload image folder to Pinata",
      desc: "Go to Pinata → Upload → Folder. Select your images folder. Copy the CID after upload.",
      code: "npx pinata upload ./images",
    },
    {
      n: 3,
      title: "Generate metadata JSON files",
      desc: "Name them 0.json, 1.json, 2.json... (zero-indexed). Each file points to its image.",
      code: `{\n  "name": "My NFT #1",\n  "image": "ipfs://<IMAGE_CID>/1.png",\n  "attributes": []\n}`,
    },
    {
      n: 4,
      title: "Upload metadata folder to Pinata",
      desc: "Same process — upload the metadata folder. Copy the folder CID. This becomes your baseURI.",
      code: "npx pinata upload ./metadata",
    },
    {
      n: 5,
      title: "Paste below and deploy",
      desc: "Metadata folder CID → baseURI field. Any single image CID → cover image field.",
      code: null,
    },
  ].map((s, i, arr) => (
    <div key={s.n} className={`px-4 py-3 ${i < arr.length - 1 ? "border-b border-[#1a4a2e]/10" : ""}`}>
      <div className="flex gap-3">
        <div className="w-6 h-6 rounded-full bg-[#1a4a2e] text-[#f5f0e8] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {s.n}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a2e1a]">{s.title}</p>
          <p className="text-xs text-[#1a2e1a]/50 mt-0.5 leading-relaxed">{s.desc}</p>
          {s.code && (
            <div className="mt-2 bg-[#1a2e1a]/5 border border-[#1a4a2e]/15 rounded-xl px-3 py-2 font-mono text-xs text-[#1a2e1a]/70 whitespace-pre-wrap break-all">
              {s.code}
            </div>
          )}
        </div>
      </div>
    </div>
  ))}

  <div className="px-4 py-3 border-t border-[#1a4a2e]/10 flex gap-3">
    <a
      href="https://app.pinata.cloud/pinmanager"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-[#1a4a2e] border border-[#1a4a2e]/30 rounded-xl px-3 py-1.5 hover:bg-[#1a4a2e]/10 transition"
    >
      Pinata Dashboard ↗
    </a>
    <a
      href="https://docs.pinata.cloud/pinning/pinning-files"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-[#1a4a2e] border border-[#1a4a2e]/30 rounded-xl px-3 py-1.5 hover:bg-[#1a4a2e]/10 transition"
    >
      Pinata Docs ↗
    </a>
  </div>
</div>

                  <div>
                    <label className="mb-2 block text-sm text-[#1a2e1a]/70">
                      Metadata Folder CID <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={pastedBaseURI}
                      onChange={(e) => setPastedBaseURI(e.target.value)}
                      className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition font-mono text-sm"
                      placeholder="ipfs://QmYourMetadataFolderCID"
                    />
                    <p className="text-xs text-[#1a2e1a]/30 mt-1">
                      e.g. <span className="font-mono">ipfs://QmXxx...</span> — contract appends tokenId + .json
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-[#1a2e1a]/70">
                      Cover Image CID <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={pastedCoverCID}
                      onChange={(e) => setPastedCoverCID(e.target.value)}
                      className="w-full rounded-2xl border border-[#1a4a2e]/20 bg-[#f5f0e8] px-4 py-3 text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e] transition font-mono text-sm"
                      placeholder="ipfs://QmYourCoverImageCID or QmYourCoverImageCID"
                    />
                    <p className="text-xs text-[#1a2e1a]/30 mt-1">Used as the collection thumbnail</p>
                  </div>

                  {pastedBaseURI && pastedCoverCID && (
                    <div className="rounded-xl bg-[#1a4a2e]/10 border border-[#1a4a2e]/20 px-4 py-3">
                      <p className="text-xs text-[#1a4a2e] font-bold mb-1">✓ Ready to deploy</p>
                      <p className="text-xs text-[#1a2e1a]/50 font-mono break-all">
                        baseURI: {pastedBaseURI.endsWith("/") ? pastedBaseURI : `${pastedBaseURI}/`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── MODE A: Browser Upload ──────────────────────────────────── */}
              {uploadMode === "browser" && (
                <div className="space-y-5">
                  {/* NFT Images */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1a4a2e] mb-2">NFT Images</p>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-2xl border border-dashed border-[#1a4a2e]/20 bg-[#1a4a2e]/5 p-8 text-center cursor-pointer hover:border-[#1a4a2e]/50 transition"
                    >
                      {imageFiles.length > 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-[#1a4a2e]/20 flex items-center justify-center mx-auto">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1.5">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </div>
                          <p className="text-sm font-bold text-[#1a4a2e]">{imageFiles.length} file{imageFiles.length > 1 ? "s" : ""} selected</p>
                          <p className="text-xs text-[#1a2e1a]/40">Click to change selection</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-[#1a4a2e]/20 flex items-center justify-center mx-auto mb-3">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a4a2e" strokeWidth="1.5">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </div>
                          <p className="text-sm text-[#1a2e1a]/70">Click to upload NFT images</p>
                          <p className="mt-1 text-xs text-[#1a2e1a]/30">PNG, JPG, GIF, WEBP — Max 10MB each · Select multiple</p>
                        </>
                      )}
                    </div>

                    {imagePreviews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {imagePreviews.slice(0, 8).map((src, i) => (
                          <div key={i} className="relative aspect-square">
                            <img src={src} alt={`NFT ${i + 1}`} className="w-full h-full rounded-xl object-cover border border-[#1a4a2e]/10" />
                            <span className="absolute bottom-1 right-1 bg-[#1a4a2e]/70 text-[#f5f0e8] text-[10px] rounded px-1 leading-5">#{i + 1}</span>
                          </div>
                        ))}
                        {imagePreviews.length > 8 && (
                          <div className="relative aspect-square rounded-xl border border-[#1a4a2e]/10 bg-[#1a4a2e]/5 flex items-center justify-center">
                            <span className="text-xs text-[#1a4a2e] font-bold">+{imagePreviews.length - 8} more</span>
                          </div>
                        )}
                      </div>
                    )}

                    {imageFiles.length > 0 && Number(supply) > 0 && imageFiles.length !== Number(supply) && (
                      <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 px-4 py-3 mt-3">
                        <p className="text-yellow-500 text-xs">
                          ⚠️ {imageFiles.length} images selected but supply is {supply}.
                          {imageFiles.length < Number(supply)
                            ? ` Need ${Number(supply) - imageFiles.length} more.`
                            : ` ${imageFiles.length - Number(supply)} extra.`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#1a4a2e]/10" />

                  {/* CSV Metadata */}
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
                          <p className="text-xs text-[#1a2e1a]/40">{tokenMetadata.length > 0 ? `${tokenMetadata.length} tokens parsed ✓` : "Parsing..."}</p>
                          <p className="text-xs text-[#1a2e1a]/30 mt-1">Click to change</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-[#1a2e1a]/70">Click to upload metadata CSV</p>
                          <p className="mt-1 text-xs text-[#1a2e1a]/30">Download the template above, fill it in, then upload here</p>
                        </>
                      )}
                    </div>
                    {csvError && (
                      <div className="rounded-xl border border-red-800/30 bg-red-900/10 px-4 py-3 mt-3">
                        <p className="text-red-400 text-xs">⚠️ {csvError}</p>
                      </div>
                    )}
                    {tokenMetadata.length > 0 && imageFiles.length > 0 && tokenMetadata.length !== imageFiles.length && (
                      <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 px-4 py-3 mt-3">
                        <p className="text-yellow-500 text-xs">⚠️ CSV has {tokenMetadata.length} rows but {imageFiles.length} images selected.</p>
                      </div>
                    )}
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
                                    return <td key={h} className="px-3 py-2 text-[#1a2e1a]/70">{attr?.value ?? "—"}</td>;
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
            </div>
          )}

          {/* ── Step 2: Deploy ──────────────────────────────────────────────── */}
          {displayStep === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#1a4a2e]/20 bg-[#e0dbd0]/70 p-5 space-y-3">
                <p className="text-[#1a4a2e] text-xs font-bold uppercase tracking-widest mb-3">Collection Summary</p>
                {[
                  { label: "Name", value: name },
                  { label: "Symbol", value: symbol },
                  { label: "Supply", value: Number(supply).toLocaleString() },
                  { label: "Mint Price", value: price === "0" || !price ? "Free" : `${price} RITUAL` },
                  { label: "Whitelist Price", value: whitelistPrice === "0" || !whitelistPrice ? "Free" : `${whitelistPrice} RITUAL` },
                  { label: "Max Per Wallet", value: maxPerWallet || "1" },
                  { label: "Slug", value: slugify(name) },
                  { label: "Network", value: "Ritual Testnet" },
                  { label: "Upload Mode", value: uploadMode === "ipfs" ? "IPFS Paste (Pre-uploaded)" : `Browser Upload (${imageFiles.length} images)` },
                  ...(uploadMode === "ipfs" ? [{ label: "baseURI", value: pastedBaseURI.slice(0, 40) + "..." }] : []),
                  ...(tokenMetadata.length > 0 ? [{ label: "Metadata", value: `${tokenMetadata.length} tokens from CSV ✓` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#1a2e1a]/40">{label}</span>
                    <span className="text-[#1a2e1a] font-medium text-right max-w-[60%] break-all">{value}</span>
                  </div>
                ))}
                {imagePreview && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-[#1a2e1a]/40">Cover Image</span>
                    <img src={imagePreview} alt="NFT" className="w-10 h-10 rounded-lg object-cover" />
                  </div>
                )}
              </div>

              {/* Upload progress bar */}
              {deployState === "uploading" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[#1a2e1a]/50">
                    <span>{uploadStep || "Uploading..."}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1a4a2e]/10 overflow-hidden">
                    <div
                      className="h-full bg-[#1a4a2e] rounded-full transition-all duration-500"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

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
                disabled={!isConnected || isPending || deployState === "uploading"}
                className={`w-full rounded-2xl px-5 py-4 font-bold text-sm transition flex items-center justify-center gap-2 ${
                  !isConnected
                    ? "bg-[#e0dbd0] text-[#7a9e7a] cursor-not-allowed border border-[#1a4a2e]/15"
                    : isPending || deployState === "uploading"
                    ? "bg-[#1a4a2e]/50 text-[#f5f0e8]/70 cursor-not-allowed"
                    : "bg-[#1a4a2e] hover:bg-[#143d24] text-[#f5f0e8]"
                }`}
              >
                {(isPending || deployState === "uploading") && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {!isConnected ? "Connect Wallet to Deploy"
                  : deployState === "uploading" ? uploadStep || "Uploading to IPFS..."
                  : deployState === "switching" ? "Switching Network..."
                  : deployState === "pending" ? "Confirm in Wallet..."
                  : deployState === "confirming" ? "Confirming Transaction..."
                  : isWrongNetwork ? "Switch to Ritual Testnet"
                  : "Deploy Collection"}
              </button>
              <p className="text-center text-[#7a9e7a] text-xs">Deploying on Ritual Testnet · Chain ID 1979</p>
            </div>
          )}

          {/* ── Step 3: Success ─────────────────────────────────────────────── */}
          {displayStep === 3 && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#1a4a2e]/10 border border-[#1a4a2e]/30 flex items-center justify-center mb-5">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 14L11 19L22 8" stroke="#1a4a2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-2xl font-black">Collection Deployed! 🎉</h2>
              <p className="text-[#4a6741] text-sm mt-2 max-w-xs leading-relaxed">
                Your NFT collection is live on Ritual Testnet. Share the mint page!
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