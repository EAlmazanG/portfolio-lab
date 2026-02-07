"use client";

import React from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Header() {
  const pathname = usePathname();

  const tabs = [
    { name: "Asset Management", href: "/assets-manager" },
    { name: "Asset Simulation", href: "/" },
    { name: "Portfolio Management", href: "/portfolios" },
    { name: "Portfolio Simulation", href: "/portfolio-analysis" },
  ];

  return (
    <header className="flex items-center justify-between border-b border-border-dark px-8 py-4 flex-shrink-0 z-20 bg-background-dark/80 backdrop-blur-md sticky top-0">
      <div className="flex items-center gap-4 text-white">
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <div className="size-10 text-primary flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(19,236,91,0.15)]">
            <LineChartIcon size={24} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-white text-xl font-black leading-tight tracking-tighter hidden sm:block uppercase">Portfolio-Lab</h2>
            <span className="text-[10px] text-primary font-bold tracking-[0.3em] uppercase opacity-50 hidden sm:block">Research Engine</span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2 bg-surface-dark/50 p-1.5 rounded-2xl border border-border-dark/50">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "px-5 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all duration-300 rounded-xl flex items-center gap-2",
                isActive 
                  ? "bg-primary text-background-dark shadow-[0_4px_20px_rgba(19,236,91,0.3)] scale-105" 
                  : "text-text-secondary hover:text-white hover:bg-surface-dark"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
