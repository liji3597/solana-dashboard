import { NextResponse } from 'next/server';

import { getRecentTransactions } from '@/lib/api/helius';
import { getWalletPositions } from '@/lib/api/mobula';
import { WHALE_WALLET } from '@/lib/constants/wallets';
import type { HeliusTransaction } from '@/lib/types/api';

const LAMPORTS_PER_SOL = 1_000_000_000;
const STABLES = new Set(['SOL', 'USDC', 'USDT', 'WSOL']);

/**
 * Lightweight swap representation extracted from a Helius transaction.
 */
interface ParsedSwap {
    signature: string;
    timestamp: number;
    direction: 'buy' | 'sell' | 'unknown';
}

/**
 * Per-position PnL from Mobula.
 */
interface PositionPnl {
    symbol: string;
    totalPnl: number;
}

export interface TradingMetricsPayload {
    largestGainUsd: number | null;
    largestGainSymbol: string | null;
    largestLossUsd: number | null;
    largestLossSymbol: string | null;
    averageWinUsd: number | null;
    averageLossUsd: number | null;
    profitFactor: number | null;
    avgTradeDurationMinutes: number | null;
    buyCount: number;
    sellCount: number;
    longShortRatio: string | null;
    totalPositions: number;
    winningPositions: number;
    losingPositions: number;
}

// ─── helpers ───

/**
 * Parse a Helius transaction into a swap direction using multiple strategies:
 *
 * 1. Structured swap events (tx.events.swap)
 * 2. Description parsing ("swapped X SOL for Y TOKEN")
 * 3. Token transfer analysis (wallet sends SOL & receives token = buy)
 */
function parseSwap(tx: HeliusTransaction): ParsedSwap | null {
    // Only process SWAP-type transactions
    if (tx.type !== 'SWAP' && tx.type !== 'swap') {
        // Also accept if the description mentions a swap
        const desc = (tx.description || '').toLowerCase();
        if (!desc.includes('swap') && !desc.includes('for')) {
            return null;
        }
    }

    const base: Omit<ParsedSwap, 'direction'> = {
        signature: tx.signature,
        timestamp: tx.timestamp,
    };

    // ── Strategy 1: Structured swap events ──
    const swap = tx.events?.swap;
    if (swap) {
        let tokenOut = '';
        let tokenIn = '';

        if (swap.nativeInput) {
            tokenOut = 'SOL';
        } else if (swap.tokenInputs && swap.tokenInputs.length > 0) {
            tokenOut = swap.tokenInputs[0].mint;
        }

        if (swap.nativeOutput) {
            tokenIn = 'SOL';
        } else if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
            tokenIn = swap.tokenOutputs[0].mint;
        }

        if (tokenOut && tokenIn) {
            const outIsStable = STABLES.has(tokenOut);
            const inIsStable = STABLES.has(tokenIn);

            let direction: 'buy' | 'sell' | 'unknown' = 'unknown';
            if (outIsStable && !inIsStable) direction = 'buy';
            else if (!outIsStable && inIsStable) direction = 'sell';

            return { ...base, direction };
        }
    }

    // ── Strategy 2: Description parsing ──
    // Common Helius description patterns:
    //   "WALLET_ADDR swapped 2.5 SOL for 150 USDC"
    //   "WALLET_ADDR swapped 100 BONK for 0.5 SOL"
    const desc = tx.description || '';
    const swapMatch = desc.match(
        /swapped\s+[\d,.]+\s+(\w+)\s+for\s+[\d,.]+\s+(\w+)/i,
    );

    if (swapMatch) {
        const from = swapMatch[1].toUpperCase();
        const to = swapMatch[2].toUpperCase();

        const fromIsStable = STABLES.has(from);
        const toIsStable = STABLES.has(to);

        let direction: 'buy' | 'sell' | 'unknown' = 'unknown';
        if (fromIsStable && !toIsStable) direction = 'buy';
        else if (!fromIsStable && toIsStable) direction = 'sell';

        return { ...base, direction };
    }

    // Also match "X for Y" without "swapped" prefix
    const forMatch = desc.match(/(\w+)\s+for\s+(\w+)/i);
    if (forMatch) {
        const from = forMatch[1].toUpperCase();
        const to = forMatch[2].toUpperCase();

        // Filter out noise — both sides should look like token symbols
        if (from.length <= 10 && to.length <= 10) {
            const fromIsStable = STABLES.has(from);
            const toIsStable = STABLES.has(to);

            let direction: 'buy' | 'sell' | 'unknown' = 'unknown';
            if (fromIsStable && !toIsStable) direction = 'buy';
            else if (!fromIsStable && toIsStable) direction = 'sell';

            return { ...base, direction };
        }
    }

    // ── Strategy 3: Token transfer heuristic ──
    // If the wallet sends SOL (nativeTransfers) and receives tokens → buy
    // If the wallet receives SOL and sends tokens → sell
    const walletLower = WHALE_WALLET.toLowerCase();

    let sentSol = false;
    let receivedSol = false;
    if (tx.nativeTransfers) {
        for (const nt of tx.nativeTransfers) {
            const amount = Math.abs(nt.amount);
            // Skip tiny amounts (< 0.001 SOL) — likely rent/fees, not swaps
            if (amount < 1_000_000) continue;

            if (nt.fromUserAccount.toLowerCase() === walletLower) sentSol = true;
            if (nt.toUserAccount.toLowerCase() === walletLower) receivedSol = true;
        }
    }

    let sentToken = false;
    let receivedToken = false;
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const tt of tx.tokenTransfers) {
            if (tt.fromUserAccount?.toLowerCase() === walletLower) sentToken = true;
            if (tt.toUserAccount?.toLowerCase() === walletLower) receivedToken = true;
        }
    }

    if (sentSol && receivedToken) {
        return { ...base, direction: 'buy' };
    }
    if (sentToken && receivedSol) {
        return { ...base, direction: 'sell' };
    }

    // If we identified both token movements but can't tell direction clearly
    if (sentToken || receivedToken || sentSol || receivedSol) {
        return { ...base, direction: 'unknown' };
    }

    return null;
}

// ─── route handler ───

export async function GET() {
    try {
        const [walletData, transactions] = await Promise.all([
            getWalletPositions(WHALE_WALLET),
            getRecentTransactions(WHALE_WALLET, 50),
        ]);

        const positions = walletData.positions ?? [];

        // ── Mobula position-based metrics ──

        const pnlList: PositionPnl[] = positions.map((p) => ({
            symbol: p.token.symbol,
            totalPnl: (p.realizedPnl ?? 0) + (p.unrealizedPnl ?? 0),
        }));

        const wins = pnlList.filter((p) => p.totalPnl > 0);
        const losses = pnlList.filter((p) => p.totalPnl < 0);

        const sortedByPnl = [...pnlList].sort((a, b) => b.totalPnl - a.totalPnl);

        const largestGain =
            sortedByPnl.length > 0 && sortedByPnl[0].totalPnl > 0
                ? sortedByPnl[0]
                : null;
        const largestLoss =
            sortedByPnl.length > 0 &&
                sortedByPnl[sortedByPnl.length - 1].totalPnl < 0
                ? sortedByPnl[sortedByPnl.length - 1]
                : null;

        const averageWinUsd =
            wins.length > 0
                ? wins.reduce((sum, w) => sum + w.totalPnl, 0) / wins.length
                : null;

        const averageLossUsd =
            losses.length > 0
                ? losses.reduce((sum, l) => sum + l.totalPnl, 0) / losses.length
                : null;

        const grossGains = wins.reduce((sum, w) => sum + w.totalPnl, 0);
        const grossLosses = Math.abs(
            losses.reduce((sum, l) => sum + l.totalPnl, 0),
        );
        const profitFactor =
            grossLosses > 0 ? Number((grossGains / grossLosses).toFixed(2)) : null;

        // ── Helius transaction-based metrics ──

        const parsedSwaps: ParsedSwap[] = [];
        for (const tx of transactions) {
            const parsed = parseSwap(tx);
            if (parsed) parsedSwaps.push(parsed);
        }

        // Classify direction
        let buyCount = 0;
        let sellCount = 0;

        for (const swap of parsedSwaps) {
            if (swap.direction === 'buy') buyCount++;
            else if (swap.direction === 'sell') sellCount++;
        }

        const longShortRatio =
            sellCount > 0
                ? (buyCount / sellCount).toFixed(2)
                : buyCount > 0
                    ? '∞'
                    : null;

        // Average trade interval between consecutive swap transactions
        let avgTradeDurationMinutes: number | null = null;

        if (parsedSwaps.length >= 2) {
            const sorted = [...parsedSwaps].sort(
                (a, b) => a.timestamp - b.timestamp,
            );
            const gaps: number[] = [];

            for (let i = 1; i < sorted.length; i++) {
                const gapSeconds = sorted[i].timestamp - sorted[i - 1].timestamp;
                if (gapSeconds > 0) {
                    gaps.push(gapSeconds);
                }
            }

            if (gaps.length > 0) {
                const avgGapSeconds =
                    gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
                avgTradeDurationMinutes = Number((avgGapSeconds / 60).toFixed(1));
            }
        }

        const payload: TradingMetricsPayload = {
            largestGainUsd: largestGain
                ? Number(largestGain.totalPnl.toFixed(2))
                : null,
            largestGainSymbol: largestGain?.symbol ?? null,
            largestLossUsd: largestLoss
                ? Number(largestLoss.totalPnl.toFixed(2))
                : null,
            largestLossSymbol: largestLoss?.symbol ?? null,
            averageWinUsd:
                averageWinUsd !== null ? Number(averageWinUsd.toFixed(2)) : null,
            averageLossUsd:
                averageLossUsd !== null ? Number(averageLossUsd.toFixed(2)) : null,
            profitFactor,
            avgTradeDurationMinutes,
            buyCount,
            sellCount,
            longShortRatio,
            totalPositions: pnlList.length,
            winningPositions: wins.length,
            losingPositions: losses.length,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Trading metrics API error:', error);
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
