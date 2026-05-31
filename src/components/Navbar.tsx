"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  }

  return (
    <>
      {/* Top Bar */}
      <header className="fixed top-0 left-0 md:left-64 right-0 z-40 h-16 border-b border-[#077345]/10 bg-[#05150f]/80 backdrop-blur-xl flex items-center px-4 sm:px-6 gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-[#077345]/20 text-zinc-400 hover:text-white transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0b1f17] border border-[#077345]/15 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#077345]/40 transition"
              placeholder="Search collections, NFTs..."
            />
          </div>
        </form>

        <div className="flex items-center gap-2 ml-auto">
          {/* Network status */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#077345]/15 bg-[#0b1f17] px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Ritual Testnet</span>
          </div>

          {/* Create button */}
          <Link
            href="/launchpad/create"
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[#077345] hover:bg-[#066039] transition px-3 py-2 text-xs font-bold text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create
          </Link>

          {/* Notifications */}
          <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#077345]/15 bg-[#0b1f17] text-zinc-500 hover:text-white transition relative">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}