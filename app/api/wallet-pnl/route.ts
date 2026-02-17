import { NextResponse } from "next/server";

import { getWalletPositions } from "@/lib/api/mobula";
import { WHALE_WALLET } from "@/lib/constants/wallets";

export async function GET() {
  try {
    const walletData = await getWalletPositions(WHALE_WALLET);
    const positions = walletData.positions ?? [];

    const totalPnL = positions.reduce((sum, position) => {
      const unrealized = position.unrealizedPnl ?? 0;
      const realized = position.realizedPnl ?? 0;
      return sum + unrealized + realized;
    }, 0);

    const profitablePositions = positions.filter((position) => {
      const pnl = (position.unrealizedPnl ?? 0) + (position.realizedPnl ?? 0);
      return pnl > 0;
    }).length;

    const winRate =
      positions.length === 0
        ? "0.0"
        : ((profitablePositions / positions.length) * 100).toFixed(1);

    const totalTrades = positions.length;

    const netWorth =
      walletData.totalValue ??
      positions.reduce((sum, position) => sum + (position.value ?? 0), 0);

    return NextResponse.json({
      totalPnL,
      overallROI: 0,
      winRate,
      totalTrades,
      netWorth,
    });
  } catch (error) {
    console.error("Wallet PnL API route error:", error);
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
