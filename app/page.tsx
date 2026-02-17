"use client";

import { KpiCards } from "@/components/dashboard/kpi-cards";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Solana Journal</h1>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700"
        >
          Connect Wallet
        </button>
      </header>
      <main>
        <KpiCards />
      </main>
    </div>
  );
}
