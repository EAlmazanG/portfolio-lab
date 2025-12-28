import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio-Lab",
  description: "Advanced DCA Simulation and Backtesting Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}

