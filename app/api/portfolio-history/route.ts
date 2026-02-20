import { NextResponse } from 'next/server';

import { fetchPortfolioHistory, getPortfolioHistoryFallback } from '@/lib/api/valuation';
import { getWalletParam } from '@/lib/api/get-wallet-param';

/**
 * GET /api/portfolio-history
 *
 * Returns real portfolio history from Mobula's wallet history API.
 * If the API call fails, falls back to simulated data so the chart
 * still renders rather than showing an empty state.
 */
export async function GET(request: Request) {
    const wallet = getWalletParam(request);

    try {
        const history = await fetchPortfolioHistory(wallet, 30);

        return NextResponse.json({
            success: true,
            data: history,
            source: 'mobula',
        });
    } catch (error) {
        console.error(
            'Portfolio history API error (falling back to simulated data):',
            error,
        );

        // Fallback: try to get the current net worth to seed the simulation
        let fallbackNetWorth = 10_000;
        try {
            // Quick inline fetch of wallet-pnl to get the real netWorth for simulation
            const { getWalletPositions } = await import('@/lib/api/mobula');
            const walletData = await getWalletPositions(wallet);
            const totalValue =
                walletData.totalValue ??
                walletData.positions.reduce((sum, p) => sum + (p.value ?? 0), 0);
            if (totalValue > 0) {
                fallbackNetWorth = totalValue;
            }
        } catch {
            // Keep default fallback net worth
        }

        const history = getPortfolioHistoryFallback(fallbackNetWorth);

        return NextResponse.json({
            success: true,
            data: history,
            source: 'simulated',
        });
    }
}
