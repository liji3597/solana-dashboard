import { NextResponse } from "next/server";

import { getRecentTransactions } from "@/lib/api/helius";
import { getWalletPositions } from "@/lib/api/mobula";
import { WHALE_WALLET } from "@/lib/constants/wallets";
import type { HeliusTransaction } from "@/lib/types/api";

const LAMPORTS_PER_SOL = 1_000_000_000;
const STABLES = new Set(["SOL", "USDC", "USDT", "WSOL"]);

// ─── Swap direction classification ───

interface ClassifiedSwap {
  direction: "buy" | "sell" | "unknown";
  solDelta: number; // positive = wallet gained SOL
}

/**
 * Classify a Helius transaction as buy/sell and compute SOL delta.
 * Buy = spending SOL/stable for a token.
 * Sell = converting a token back to SOL/stable.
 */
function classifySwap(
  tx: HeliusTransaction,
  walletAddress: string,
): ClassifiedSwap | null {
  // Only look at swap transactions
  if (tx.type !== "SWAP" && tx.type !== "swap") {
    const desc = (tx.description || "").toLowerCase();
    if (!desc.includes("swap") && !desc.includes("for")) return null;
  }

  const walletLower = walletAddress.toLowerCase();

  // ── Strategy 1: Structured swap events ──
  const swap = tx.events?.swap;
  if (swap) {
    const solIn = swap.nativeOutput
      ? (Number(swap.nativeOutput.amount) || 0) / LAMPORTS_PER_SOL
      : 0;
    const solOut = swap.nativeInput
      ? (Number(swap.nativeInput.amount) || 0) / LAMPORTS_PER_SOL
      : 0;
    const solDelta = solIn - solOut;

    let tokenOut = "";
    let tokenIn = "";
    if (swap.nativeInput) tokenOut = "SOL";
    else if (swap.tokenInputs?.[0]) tokenOut = swap.tokenInputs[0].mint;
    if (swap.nativeOutput) tokenIn = "SOL";
    else if (swap.tokenOutputs?.[0]) tokenIn = swap.tokenOutputs[0].mint;

    const outIsStable = STABLES.has(tokenOut);
    const inIsStable = STABLES.has(tokenIn);

    if (outIsStable && !inIsStable) return { direction: "buy", solDelta };
    if (!outIsStable && inIsStable) return { direction: "sell", solDelta };
    return { direction: "unknown", solDelta };
  }

  // ── Strategy 2: Description parsing ──
  const desc = tx.description || "";
  const swapMatch = desc.match(
    /swapped\s+[\d,.]+\s+(\w+)\s+for\s+[\d,.]+\s+(\w+)/i,
  );

  if (swapMatch) {
    const from = swapMatch[1].toUpperCase();
    const to = swapMatch[2].toUpperCase();
    const fromIsStable = STABLES.has(from);
    const toIsStable = STABLES.has(to);

    // Compute SOL delta from native transfers
    let solDelta = 0;
    if (tx.nativeTransfers) {
      for (const nt of tx.nativeTransfers) {
        const amount = nt.amount / LAMPORTS_PER_SOL;
        if (nt.toUserAccount.toLowerCase() === walletLower) solDelta += amount;
        if (nt.fromUserAccount.toLowerCase() === walletLower) solDelta -= amount;
      }
    }

    if (fromIsStable && !toIsStable) return { direction: "buy", solDelta };
    if (!fromIsStable && toIsStable) return { direction: "sell", solDelta };
    return { direction: "unknown", solDelta };
  }

  // ── Strategy 3: Transfer analysis ──
  let sentSol = false;
  let receivedSol = false;
  let solDelta = 0;

  if (tx.nativeTransfers) {
    for (const nt of tx.nativeTransfers) {
      if (Math.abs(nt.amount) < 1_000_000) continue; // skip dust
      const amount = nt.amount / LAMPORTS_PER_SOL;
      if (nt.toUserAccount.toLowerCase() === walletLower) {
        receivedSol = true;
        solDelta += amount;
      }
      if (nt.fromUserAccount.toLowerCase() === walletLower) {
        sentSol = true;
        solDelta -= amount;
      }
    }
  }

  let sentToken = false;
  let receivedToken = false;
  if (tx.tokenTransfers?.length) {
    for (const tt of tx.tokenTransfers) {
      if (tt.fromUserAccount?.toLowerCase() === walletLower) sentToken = true;
      if (tt.toUserAccount?.toLowerCase() === walletLower) receivedToken = true;
    }
  }

  if (sentSol && receivedToken) return { direction: "buy", solDelta };
  if (sentToken && receivedSol) return { direction: "sell", solDelta };
  if (sentToken || receivedToken || sentSol || receivedSol) {
    return { direction: "unknown", solDelta };
  }

  return null;
}

// ─── Route handler ───

export async function GET() {
  try {
    // Fetch Mobula positions and Helius swaps in parallel
    const [walletData, transactions] = await Promise.all([
      getWalletPositions(WHALE_WALLET),
      getRecentTransactions(WHALE_WALLET, 50),
    ]);

    const positions = walletData.positions ?? [];

    // ── Total PnL from Mobula ──
    const totalPnL = positions.reduce((sum, position) => {
      const unrealized = position.unrealizedPnl ?? 0;
      const realized = position.realizedPnl ?? 0;
      return sum + unrealized + realized;
    }, 0);

    // ── Overall ROI ──
    // Cost basis = position value minus unrealized PnL
    const totalCostBasis = positions.reduce((sum, position) => {
      const value = position.value ?? 0;
      const unrealized = position.unrealizedPnl ?? 0;
      return sum + Math.max(value - unrealized, 0);
    }, 0);

    const overallROI =
      totalCostBasis > 0
        ? Number(((totalPnL / totalCostBasis) * 100).toFixed(2))
        : 0;

    // ── Net worth ──
    const netWorth =
      walletData.totalValue ??
      positions.reduce((sum, position) => sum + (position.value ?? 0), 0);

    // ── Trade-based Win Rate from Helius swaps ──
    const classifiedSwaps: ClassifiedSwap[] = [];
    for (const tx of transactions) {
      const result = classifySwap(tx, WHALE_WALLET);
      if (result) classifiedSwaps.push(result);
    }

    // Total trades = all classified swap transactions
    const totalTrades = classifiedSwaps.length;

    // Sell transactions represent completed trades (position exits)
    const sells = classifiedSwaps.filter((s) => s.direction === "sell");
    const winningSells = sells.filter((s) => s.solDelta > 0).length;

    // Win rate = winning sells / total sells
    // If no sells, fall back to all swaps with positive SOL delta
    let winRate: string;
    if (sells.length > 0) {
      winRate = ((winningSells / sells.length) * 100).toFixed(1);
    } else if (classifiedSwaps.length > 0) {
      const positiveSwaps = classifiedSwaps.filter((s) => s.solDelta > 0).length;
      winRate = ((positiveSwaps / classifiedSwaps.length) * 100).toFixed(1);
    } else {
      winRate = "0.0";
    }

    return NextResponse.json({
      totalPnL,
      overallROI,
      winRate,
      totalTrades,
      netWorth,
    });
  } catch (error) {
    console.error("Wallet PnL API route error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
