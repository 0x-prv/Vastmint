"use client";

import React, { useState, useMemo } from "react";

interface Issue {
  id: string;
  title: string;
  category: string;
  cause: string;
  steps: string[];
  retry: string;
}

const ISSUES: Issue[] = [
  // ── WALLET ──────────────────────────────────────────────────────────────
  {
    id: "wallet-not-connecting",
    title: "Wallet not connecting",
    category: "Wallet",
    cause:
      "MetaMask or your wallet extension is locked, or the browser blocked the connection popup. WalletConnect may also fail if the project ID is misconfigured.",
    steps: [
      "Click the wallet icon in your browser toolbar and unlock it with your password.",
      "Click 'Connect Wallet' on VastMint again.",
      "When the popup appears inside your wallet, click 'Connect' or 'Approve'.",
      "If no popup appears, check if your browser is blocking popups for this site and allow them.",
      "If using WalletConnect (mobile), make sure you are scanning the QR code with a supported wallet app.",
      "Hard refresh the page (Ctrl+Shift+R / Cmd+Shift+R) and try again.",
    ],
    retry:
      "Retry after unlocking your wallet. If the popup never appears, restart your browser and reconnect.",
  },
  {
    id: "wrong-network",
    title: "Wrong network / Switch to Ritual prompt",
    category: "Wallet",
    cause:
      "Your wallet is on a different network (e.g. Ethereum Mainnet). The sidebar shows a red 'Switch to Ritual' warning. Note: the top navbar always shows 'Ritual Testnet' regardless of actual chain — trust the sidebar warning instead.",
    steps: [
      "Look for the red 'Switch to Ritual' button in the left sidebar.",
      "Click it — VastMint will send a switch request to your wallet.",
      "Approve the network switch inside the wallet popup.",
      "If Ritual Testnet is not in your wallet yet, add it manually using the chain details from the Ritual docs (RPC URL, Chain ID, currency symbol).",
      "After switching, the red warning disappears and the sidebar pulse turns green.",
    ],
    retry:
      "If the switch is rejected by your wallet, add Ritual Testnet manually and try again.",
  },
  {
    id: "not-enough-gas",
    title: "Not enough testnet gas (RITUAL)",
    category: "Wallet",
    cause:
      "Your wallet has 0 or insufficient testnet RITUAL tokens to pay for transaction gas. You need testnet RITUAL — not real ETH.",
    steps: [
      "Check your wallet balance on Ritual Testnet.",
      "Visit the Ritual Testnet faucet or the official Ritual Discord faucet channel.",
      "Paste your wallet address and request testnet tokens.",
      "Wait 1–2 minutes for the tokens to arrive.",
      "Once your balance appears, retry your transaction.",
    ],
    retry:
      "Faucets have cooldown periods. If rate-limited, wait 24 hours before requesting again.",
  },

  // ── TRANSACTIONS ─────────────────────────────────────────────────────────
  {
    id: "transaction-pending",
    title: "Transaction stuck as pending",
    category: "Transactions",
    cause:
      "Transaction was submitted but not yet mined. This can happen due to low gas or RPC congestion on the Ritual Testnet.",
    steps: [
      "Do not submit another transaction while one is pending — it causes nonce conflicts.",
      "Open your wallet and find the pending transaction.",
      "If your wallet shows a 'Speed Up' option, use it to resubmit with higher gas.",
      "Wait up to 10 minutes for the network to process it.",
      "If still pending after 15 minutes, cancel it in your wallet and resubmit.",
    ],
    retry:
      "Refresh the page after the transaction resolves (confirmed or cancelled) before retrying.",
  },
  {
    id: "transaction-failed",
    title: "Transaction failed",
    category: "Transactions",
    cause:
      "The transaction was submitted but reverted on-chain. Common causes: wrong phase, insufficient payment, contract condition not met, or insufficient gas.",
    steps: [
      "Check your wallet transaction history for the failure reason.",
      "Look for 'execution reverted' — this means a contract condition was not met.",
      "Make sure you have enough RITUAL for both the action cost and gas fees.",
      "Try increasing the gas limit in your wallet's advanced settings.",
      "If the error mentions approval, resolve that first (see 'Approve button not working').",
    ],
    retry:
      "Fix the underlying cause before retrying. Retrying the same transaction without fixing the cause will keep failing.",
  },
  {
    id: "confirmation-hanging",
    title: "Transaction stuck on 'Confirming…'",
    category: "Transactions",
    cause:
      "VastMint is waiting for the transaction receipt but the RPC endpoint is slow or dropped the connection. This affects mint, deploy, and buy flows.",
    steps: [
      "Wait up to 3 minutes — testnet confirmation can be slow.",
      "Check your wallet history to see if the transaction already confirmed.",
      "If confirmed in wallet but the UI is still loading, hard refresh the page.",
      "If the transaction was dropped, resubmit from the beginning.",
    ],
    retry:
      "Hard refresh after 3 minutes. If your wallet shows the transaction as confirmed, the action succeeded even if the UI did not update.",
  },

  // ── MINTING ──────────────────────────────────────────────────────────────
  {
    id: "mint-paused",
    title: "Mint button says 'Mint Paused'",
    category: "Minting",
    cause:
      "Every newly deployed collection starts in Paused phase by default. The creator must manually enable Public minting before anyone can mint.",
    steps: [
      "If you are the collection creator: go to Dashboard → My Collections → find your collection → set Phase to Public.",
      "If you are a collector: contact the collection creator and ask them to enable the Public mint phase.",
      "Once phase is set to Public, refresh the mint page and the button will activate.",
    ],
    retry:
      "Refresh the mint page after the creator enables the Public phase.",
  },
  {
    id: "mint-failed",
    title: "Mint failed",
    category: "Minting",
    cause:
      "Minting was unsuccessful. Common causes: collection is paused, wallet mint limit reached, collection sold out, insufficient RITUAL, or IPFS metadata not ready.",
    steps: [
      "Check the error message shown — it will say one of: 'Mint Paused', 'Wallet Limit Reached', 'Sold Out', or 'Insufficient funds'.",
      "If 'Mint Paused': wait for the creator to enable Public phase.",
      "If 'Wallet Limit Reached': your wallet has already minted the maximum allowed for this collection.",
      "If 'Sold Out': the collection has no remaining supply.",
      "If 'Insufficient funds': get more RITUAL from the testnet faucet.",
      "If none of the above: make sure you are on Ritual Testnet and retry.",
    ],
    retry:
      "Retry only after resolving the specific error shown. Do not spam retry — the same cause will keep failing.",
  },
  {
    id: "whitelist-mint-failing",
    title: "Whitelist mint failing",
    category: "Minting",
    cause:
      "Whitelist minting requires a valid Merkle proof. The current UI sends an empty proof, so whitelist minting will always fail even if your wallet is intended to be whitelisted.",
    steps: [
      "This is a known limitation of the current testnet version.",
      "Contact the collection creator to confirm whether whitelist is actually configured.",
      "If the collection supports Public mint, wait for the creator to switch to Public phase.",
      "Do not retry whitelist mint — it will fail until this is resolved in a future update.",
    ],
    retry:
      "Wait for a UI update that supports Merkle proof generation, or ask the creator to switch to Public phase.",
  },
  {
    id: "image-not-loading",
    title: "NFT image or metadata not loading",
    category: "Minting",
    cause:
      "IPFS gateway is slow or the content was not fully pinned. NFT images may show broken placeholders in the Marketplace, Dashboard, and collection pages — errors are hidden silently.",
    steps: [
      "Wait 3–5 minutes — IPFS propagation is slow on first access.",
      "Refresh the page.",
      "Try opening the IPFS link directly: ipfs.io/ipfs/[your-CID]",
      "If the direct link also fails, the file was not pinned correctly during deploy.",
      "If you are the creator: re-upload and deploy a new collection with confirmed IPFS uploads.",
    ],
    retry:
      "Refresh after 5 minutes. For persistent failures, the asset needs to be re-uploaded.",
  },

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  {
    id: "nft-not-in-dashboard",
    title: "NFT not showing in Dashboard",
    category: "Dashboard",
    cause:
      "The Dashboard scans blockchain Transfer logs to find your NFTs. RPC range limits, slow indexing, or many collections can cause some NFTs to appear missing even when you own them.",
    steps: [
      "Wait 2–3 minutes after a successful mint and hard refresh (Ctrl+Shift+R).",
      "Make sure your wallet is connected — Dashboard only shows NFTs for the connected address.",
      "Confirm you are on Ritual Testnet.",
      "If you see 'Some NFT collections could not be scanned', part of the data is incomplete due to RPC limits — wait and refresh.",
      "Check your wallet's transaction history to confirm the mint transaction succeeded.",
    ],
    retry:
      "Disconnect and reconnect your wallet, then refresh. If the mint confirmed on-chain, the NFT exists — the UI may just need more time.",
  },
  {
    id: "load-more-not-working",
    title: "Load More not showing more NFTs",
    category: "Dashboard",
    cause:
      "The RPC log scan may have hit range limits and skipped some chunks, returning partial results. Load More may also be hidden if the scan returned an incomplete first page.",
    steps: [
      "Scroll down to confirm the 'Load More' button is visible.",
      "Click it once and wait — do not click multiple times.",
      "If nothing loads, check your network connection.",
      "Refresh the page — previously loaded NFTs should still appear.",
      "Wait 1–2 minutes and try again if RPC is slow.",
    ],
    retry:
      "Refresh and scroll down again. Testnet RPC instability can cause partial scans — retrying after a minute usually helps.",
  },
  {
    id: "listing-price-not-working",
    title: "List NFT button does nothing",
    category: "Dashboard",
    cause:
      "The listing price input silently rejects empty, zero, negative, or comma-decimal values (e.g. '0,05'). No error is shown — the button just does nothing.",
    steps: [
      "Make sure the price field is filled with a valid positive number.",
      "Use a period as the decimal separator (e.g. '0.05', not '0,05').",
      "The value must be greater than 0.",
      "After entering a valid price, click 'List for Sale' again.",
    ],
    retry: "Enter a valid price using period decimals and retry.",
  },

  // ── MARKETPLACE ───────────────────────────────────────────────────────────
  {
    id: "nft-not-in-marketplace",
    title: "NFT not showing in Marketplace",
    category: "Marketplace",
    cause:
      "Minting does not automatically list your NFT. You must list it manually from the Dashboard. If already listed, the marketplace may take time to index it.",
    steps: [
      "Go to Dashboard, find your NFT, and click 'List NFT'.",
      "Complete the Approve step first — this is required before listing.",
      "Enter a valid listing price and confirm the listing transaction.",
      "Wait 1–2 minutes after the transaction confirms, then refresh the Marketplace.",
      "Make sure you are browsing the correct collection filter in the Marketplace.",
    ],
    retry:
      "Refresh the Marketplace 2 minutes after the listing transaction confirms.",
  },
  {
    id: "approve-button-not-working",
    title: "Approve button not working",
    category: "Marketplace",
    cause:
      "The Approve step grants the marketplace contract permission to transfer your NFT. It may appear unresponsive if a previous approval is still pending, or if you are on the wrong network.",
    steps: [
      "Check your wallet for a pending approval transaction — wait for it to resolve before clicking Approve again.",
      "If no pending transaction exists, refresh the page and click Approve again.",
      "Confirm you are on Ritual Testnet.",
      "Approve triggers a wallet popup — click Confirm inside the popup.",
      "Wait for the approval transaction to confirm before proceeding to list.",
    ],
    retry:
      "Approvals only need to be done once per collection. Retry only if no pending transaction exists.",
  },
  {
    id: "list-nft-failed",
    title: "List NFT failed",
    category: "Marketplace",
    cause:
      "Listing requires prior approval. It also fails if the NFT is already listed, the price is zero, or you are no longer the token owner.",
    steps: [
      "Complete the Approve step before listing.",
      "Enter a valid listing price greater than 0.",
      "Make sure the NFT is not already listed — check your active listings.",
      "Confirm you still own the NFT in your wallet.",
      "Make sure you have enough RITUAL for the listing transaction gas.",
    ],
    retry:
      "Approve first, confirm ownership, then retry listing.",
  },
  {
    id: "buy-nft-failed",
    title: "Buy NFT failed",
    category: "Marketplace",
    cause:
      "Purchase fails if the listing is no longer active (already sold or cancelled), you are the seller, or you have insufficient RITUAL. Errors on the collection page are hidden — only the buy button resets.",
    steps: [
      "Refresh the Marketplace to confirm the listing is still active.",
      "Check your RITUAL balance — it must cover the listing price plus gas.",
      "Make sure you are not trying to buy your own listing.",
      "If the listing disappeared after refresh, it was already sold or cancelled.",
      "Retry the purchase with sufficient balance on an active listing.",
    ],
    retry:
      "Always refresh the Marketplace before retrying a purchase to confirm the listing is still active.",
  },
  {
    id: "cancel-listing-failed",
    title: "Cancel listing failed / button resets silently",
    category: "Marketplace",
    cause:
      "Cancel errors are hidden in multiple places — the button resets with no message. This happens if the listing is already sold, you rejected the transaction, or you are on the wrong network.",
    steps: [
      "Refresh the page to check if the listing is still active.",
      "If the listing is gone, it was already sold or previously cancelled.",
      "Make sure you are connected with the same wallet that created the listing.",
      "Confirm you are on Ritual Testnet.",
      "Make sure you have RITUAL for the cancel transaction gas fee.",
      "Try cancelling again from the Dashboard instead of the Marketplace page.",
    ],
    retry:
      "Refresh first to verify the listing is still active, then retry from Dashboard.",
  },
  {
    id: "marketplace-listings-not-loading",
    title: "Marketplace listings not loading",
    category: "Marketplace",
    cause:
      "The marketplace reads all listings on-chain. As listings grow, this can become too expensive for the RPC to handle. A fallback reads only the last 250 listings — older active listings may not appear.",
    steps: [
      "Wait 30 seconds and refresh the Marketplace page.",
      "Check your internet connection.",
      "If the error message appears, the RPC endpoint may be overloaded — wait 1–2 minutes.",
      "Note: if there are many historical listings, some older ones may not appear due to the 250-listing fallback limit.",
    ],
    retry:
      "Wait 1–2 minutes and refresh. Testnet RPC nodes have intermittent downtime.",
  },

  // ── LAUNCHPAD ─────────────────────────────────────────────────────────────
  {
    id: "collection-not-showing",
    title: "Collection not showing after deploy",
    category: "Launchpad",
    cause:
      "The factory contract emits an event on deploy, but the UI scans logs to find it. RPC delays, wrong scan start block, or many existing collections can cause your new collection to appear missing.",
    steps: [
      "Confirm your deploy transaction succeeded in your wallet history.",
      "Wait 2–3 minutes and refresh the Collections page.",
      "Connect with the same wallet used to deploy.",
      "If still missing after 5 minutes, check the block explorer for your deploy transaction to confirm it was on-chain.",
    ],
    retry:
      "Wait 3 minutes and refresh. If the transaction confirmed on-chain, the collection exists — the UI just needs time to index it.",
  },
  {
    id: "deploy-upload-failed",
    title: "Deploy failed — image upload error",
    category: "Launchpad",
    cause:
      "Each NFT image is uploaded one-by-one to IPFS. The upload API rate-limits at 10 requests per minute. Larger collections (10+ images) can hit this limit. Files over 10MB or unsupported formats also fail.",
    steps: [
      "Make sure all images are under 10MB each.",
      "Use supported formats: PNG, JPG, GIF, or WebP.",
      "If your supply is large, wait 1 minute between retries to avoid rate limits.",
      "Collections over 100 NFTs will fail the metadata folder upload — this is a current testnet limitation.",
      "Restart the deploy process from the beginning if an upload fails partway through.",
    ],
    retry:
      "Wait 60 seconds before retrying to reset the rate limit window.",
  },
  {
    id: "deploy-slug-failed",
    title: "Deploy failed — slug conflict or invalid name",
    category: "Launchpad",
    cause:
      "Collection names are converted to a URL slug. If the slug is already taken by another collection, or if your name contains only special characters (producing an empty slug), the deploy transaction will revert.",
    steps: [
      "Choose a unique collection name that has not been used before.",
      "Make sure your collection name contains at least one letter or number.",
      "Avoid names with only symbols or emojis.",
      "If you get a generic 'Deploy failed' error, try a different collection name.",
    ],
    retry:
      "Try again with a different, unique collection name.",
  },
  {
    id: "deploy-csv-failed",
    title: "Deploy failed — CSV metadata mismatch",
    category: "Launchpad",
    cause:
      "The CSV parser does not support quoted fields or commas inside values. If your metadata descriptions contain commas, or you use Windows line endings, the row count may mismatch your max supply.",
    steps: [
      "Make sure your CSV has exactly as many data rows as your max supply.",
      "Remove commas from inside field values (e.g. descriptions).",
      "Save your CSV with Unix line endings (LF, not CRLF).",
      "Remove any blank lines from the CSV.",
      "Verify the row count before uploading.",
    ],
    retry:
      "Fix the CSV and restart the deploy process.",
  },

  // ── NETWORK / RPC ─────────────────────────────────────────────────────────
  {
    id: "rpc-error",
    title: "RPC error or page loading too long",
    category: "Network",
    cause:
      "VastMint uses a single Ritual Testnet RPC endpoint with no fallback. If this endpoint is down or rate-limiting, reads across the entire app will fail — listings, NFT scans, mint prices, and transaction confirmations.",
    steps: [
      "Wait 30–60 seconds and refresh the page.",
      "Check your internet connection.",
      "Check the Ritual network status or Discord for known outages.",
      "If your wallet shows RPC errors, try switching to a different Ritual RPC endpoint in wallet settings.",
      "Clear your browser cache and reload.",
    ],
    retry:
      "Wait 1–2 minutes before retrying. Testnet RPC nodes have intermittent downtime — this usually resolves on its own.",
  },
];

const CATEGORIES = ["All", ...Array.from(new Set(ISSUES.map((i) => i.category)))];

const categoryIcons: Record<string, React.ReactNode> = {
  All: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Wallet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 3H8L4 7h16l-4-4z" />
      <circle cx="17" cy="13" r="1" fill="currentColor" />
    </svg>
  ),
  Transactions: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  Minting: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Marketplace: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  Dashboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  Launchpad: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  Network: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
};

export default function SupportPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openIssue, setOpenIssue] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return ISSUES.filter((issue) => {
      const matchCategory = activeCategory === "All" || issue.category === activeCategory;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        issue.title.toLowerCase().includes(q) ||
        issue.cause.toLowerCase().includes(q) ||
        issue.steps.some((s) => s.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [search, activeCategory]);

  const selectedIssue = openIssue ? ISSUES.find((i) => i.id === openIssue) : null;

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 sm:px-6 pt-6 pb-24 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7a9e7a]">VastMint</span>
          <span className="text-[#1a4a2e]/20">›</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a4a2e]">Support</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-[#1a2e1a] leading-tight">Troubleshooting<br />Center.</h1>
<p className="text-[#4a6741] mt-4 max-w-xl text-sm leading-relaxed">Common errors and fixes during Ritual Testnet usage.</p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a9e7a]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search issues, e.g. mint paused, listing failed…"
          className="w-full bg-white border border-[#1a4a2e]/20 rounded-xl pl-10 pr-4 py-4 text-sm text-[#1a2e1a] placeholder:text-[#7a9e7a] outline-none focus:border-[#1a4a2e]/50 transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a9e7a] hover:text-[#1a2e1a] transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
              activeCategory === cat
                ? "bg-[#1a4a2e] text-[#f5f0e8] border-[#1a4a2e]"
                : "bg-white text-[#4a6741] border-[#1a4a2e]/20 hover:border-[#1a4a2e]/40 hover:text-[#1a2e1a]"
            }`}
          >
            {categoryIcons[cat]}
            {cat}
          </button>
        ))}
      </div>

      {/* Detail View */}
      {selectedIssue && (
        <div className="mb-6 rounded-2xl border border-[#1a4a2e]/20 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a4a2e]/10 bg-[#ede8df]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7a9e7a]">{selectedIssue.category}</span>
              <h2 className="text-base font-black text-[#1a2e1a] mt-0.5">{selectedIssue.title}</h2>
            </div>
            <button
              onClick={() => setOpenIssue(null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#1a4a2e]/20 text-[#4a6741] hover:text-[#1a2e1a] hover:bg-[#e0dbd0] transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-5 space-y-5">
            {/* Cause */}
            <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
              <svg className="flex-shrink-0 mt-0.5 text-amber-600" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">Possible Cause</p>
                <p className="text-sm text-amber-900">{selectedIssue.cause}</p>
              </div>
            </div>
            {/* Steps */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#7a9e7a] mb-3">Step-by-step Fix</p>
              <ol className="space-y-2.5">
                {selectedIssue.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1a4a2e]/10 text-[#1a4a2e] text-xs font-black flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-[#1a2e1a] leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
            {/* Retry */}
            <div className="flex gap-3 rounded-xl bg-[#1a4a2e]/5 border border-[#1a4a2e]/15 px-4 py-3">
              <svg className="flex-shrink-0 mt-0.5 text-[#1a4a2e]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#1a4a2e] mb-1">When to Retry / Refresh</p>
                <p className="text-sm text-[#1a2e1a]">{selectedIssue.retry}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#7a9e7a]">
          <svg className="mx-auto mb-3 opacity-40" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm font-medium">No issues found for &quot;{search}&quot;</p>
          <button
            onClick={() => { setSearch(""); setActiveCategory("All"); }}
            className="mt-3 text-xs text-[#1a4a2e] underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setOpenIssue(openIssue === issue.id ? null : issue.id)}
              className={`w-full text-left flex items-center gap-4 px-5 py-5 rounded-2x1 border transition-all duration-150 group ${
                openIssue === issue.id
                  ? "bg-[#1a4a2e]/5 border-[#1a4a2e]/30"
                  : "bg-white border-[#1a4a2e]/15 hover:border-[#1a4a2e]/30 hover:bg-[#ede8df]/40"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                openIssue === issue.id ? "bg-[#1a4a2e] text-[#f5f0e8]" : "bg-[#1a4a2e]/10 text-[#1a4a2e] group-hover:bg-[#1a4a2e]/20"
              }`}>
                {categoryIcons[issue.category]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-[#1a2e1a] truncate">{issue.title}</p>
                <p className="text-sm text-[#7a9e7a] mt-1 truncate">{issue.cause}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-[#7a9e7a] border border-[#1a4a2e]/15 rounded-md px-2 py-0.5">
                  {issue.category}
                </span>
                <svg
                  className={`text-[#4a6741] transition-transform duration-200 ${openIssue === issue.id ? "rotate-180" : ""}`}
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-[#1a4a2e]/10 text-center">
        <p className="text-xs text-[#7a9e7a]">
          VastMint is on Ritual Testnet — issues are expected. If your problem persists, reach out on{" "}
          <a
               href="https://x.com/vastmintxyz"
                     target="_blank"
                     rel="noopener noreferrer"
                    className="text-[#1a4a2e] underline underline-offset-2 hover:opacity-70 transition"
>
  @vastmintxyz
</a>{" "}
on X.
        </p>
      </div>
    </div>
  );
}