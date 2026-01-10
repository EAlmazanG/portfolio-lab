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
    { name: "Asset Simulation", href: "/" },
    { name: "Portfolio Management", href: "/portfolios" },
    { name: "Portfolio Analysis", href: "/portfolio-analysis" },
    { name: "Settings", href: "#" },
  ];

  return (
    <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 flex-shrink-0 z-20 bg-background-dark">
      <div className="flex items-center gap-4 text-white">
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <div className="size-8 text-primary flex items-center justify-center rounded-lg bg-primary/10">
            <LineChartIcon size={20} />
          </div>
          <h2 className="text-white text-lg font-bold leading-tight tracking-tight hidden sm:block">Portfolio-Lab</h2>
        </Link>
      </div>

      <div className="flex flex-1 justify-end items-center gap-4">
        <div className="hidden md:flex items-center gap-6 border-l border-border-dark pl-6">
          <div className="flex items-center gap-6">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={cn(
                    "text-sm font-medium leading-normal transition-colors pb-0.5",
                    isActive 
                      ? "text-white border-b-2 border-primary" 
                      : "text-text-secondary hover:text-white"
                  )}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
          <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 border border-border-dark overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6FEfyCMU5tIgsG5lpl75XFWc16gRg42Yb9rxpGvHRi_s4_kosZicLAFzxAdGrmN9ENPAqBDRkAFt7OTV5peIv8MkTG7QYA9lyWuxQ5JbmPSsa6IxFPO8uwF-K8whM2vt_vcTxgZbfX4iWo9vBkhcg6t86lnbMRfiUZL4RSJot7ojvOWvoC3GRiToh3FhzylUnEgrczl5VhSaUSF-V_eqQ4cz8-uG4Et6rXDz4shvZRk1Mq12gjpw9S9U-IfGDY0bPZ6RyjRzSeO7d" 
              alt="Profile" 
              className="w-full h-full object-cover" 
            />
          </div>
        </div>
      </div>
    </header>
  );
}
