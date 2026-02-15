"use client";

import { useState } from "react";

const TEST_WALLET = "CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq";

export default function TestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetTotal, setAssetTotal] = useState<number | null>(null);

  const handleCheckStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/test-helius");

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || "Helius API returned an error";
        throw new Error(message);
      }

      const data: { total: number } = await response.json();
      console.log("Helius assets found:", data.total);
      setAssetTotal(data.total);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error checking API";
      setError(message);
      console.error("Helius API error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Helius API Test</h1>
        <p className="mt-2 text-sm text-slate-600">
          Send a request against a fixed wallet to confirm the Helius integration
          is functioning in this environment.
        </p>
        <button
          type="button"
          onClick={handleCheckStatus}
          disabled={isLoading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Checking..." : "Check API Status"}
        </button>

        <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Status</p>
          <div className="mt-2 text-sm">
            {isLoading && (
              <p className="text-amber-600">Contacting Helius...</p>
            )}
            {!isLoading && assetTotal !== null && !error && (
              <p className="text-emerald-600">Assets found: {assetTotal}</p>
            )}
            {!isLoading && error && (
              <p className="text-rose-600">Error: {error}</p>
            )}
            {!isLoading && !error && assetTotal === null && (
              <p className="text-slate-500">Press the button to run the test.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
