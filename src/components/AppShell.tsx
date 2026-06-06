"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const collapsed = !hovered;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex fixed inset-y-0 left-0 z-50 transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <Sidebar collapsed={collapsed} />
      </div>

<div
  className={`flex flex-col min-h-screen transition-all duration-300 ${
    collapsed ? "md:ml-20" : "md:ml-64"
  }`}
>        <Navbar collapsed={collapsed} />
        <main className="flex-1 pt-16">{children}</main>
      </div>
    </>
  );
}