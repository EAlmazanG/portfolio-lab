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
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

