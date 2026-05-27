import type { Metadata } from "next";
import "./globals.css";
import Web3Provider from "@/providers/web3-provider";
import Navbar from "@/components/Navbar";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#05150f] text-white">
        <Web3Provider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
        </Web3Provider>
      </body>
    </html>
  );
}