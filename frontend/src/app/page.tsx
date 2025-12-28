export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Portfolio-Lab 🧪</h1>
      <p className="text-xl mb-8">Smart DCA & Portfolio Simulation</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-center">
        <div className="p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-bold mb-2">Asset Simulator</h2>
          <p>Test Smart DCA strategies on single assets.</p>
        </div>
        <div className="p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-bold mb-2">Portfolio Builder</h2>
          <p>Construct and rebalance diversified portfolios.</p>
        </div>
        <div className="p-6 border rounded-lg hover:shadow-lg transition">
          <h2 className="text-2xl font-bold mb-2">Optimizer</h2>
          <p>Find the perfect parameters for your strategy.</p>
        </div>
      </div>
    </main>
  );
}

