import type { Metadata } from "next";
import "./globals.css";
import Web3Provider from "@/providers/web3-provider";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "VastMint",
  description: "Ritual-native NFT launchpad and marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full text-white">
        <Web3Provider>
          {/* Desktop Sidebar - fixed left */}
          <div className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64">
            <Sidebar />
          </div>

          {/* Main content area */}
          <div className="md:ml-64 flex flex-col min-h-screen">
            {/* Top bar */}
            <Navbar />

            {/* Page content - offset by top bar height */}
            <main className="flex-1 pt-16">
              {children}
            </main>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}