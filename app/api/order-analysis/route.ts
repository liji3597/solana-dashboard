import { NextResponse } from 'next/server';

import { getRecentTransactions } from '@/lib/api/helius';
import { WHALE_WALLET } from '@/lib/constants/wallets';
import type { HeliusTransaction } from '@/lib/types/api';

const LAMPORTS_PER_SOL = 1_000_000_000;

// ─── Order type classification ───

type OrderType = 'Market' | 'Limit' | 'DCA' | 'Unknown';

/**
 * Map Helius `source` field + programInfo to an order type.
 *
 * Solana DEX order types:
 * - Market: Regular AMM / aggregator swaps (Jupiter, Raydium, Orca, Meteora, etc.)
 * - Limit:  Jupiter Limit Orders, OpenBook/Serum order book fills
 * - DCA:    Jupiter DCA (Dollar Cost Averaging) program
 */
const LIMIT_SOURCES = new Set([
    'OPENBOOK',
    'OPENBOOK_V2',
    'SERUM',
    'SERUM_V3',
    'PHOENIX',
]);

const DCA_KEYWORDS = ['dca', 'dollar cost', 'dollar-cost'];

function classifyOrderType(tx: HeliusTransaction): OrderType {
    const source = (tx.source || '').toUpperCase();
    const desc = (tx.description || '').toLowerCase();
    const programName = (tx.events?.swap?.programInfo?.name || '').toLowerCase();
    const programSource = (tx.events?.swap?.programInfo?.source || '').toUpperCase();

    // DCA detection
    if (
        DCA_KEYWORDS.some((k) => desc.includes(k)) ||
        DCA_KEYWORDS.some((k) => programName.includes(k)) ||
        source.includes('DCA')
    ) {
        return 'DCA';
    }

    // Limit order detection
    if (
        LIMIT_SOURCES.has(source) ||
        LIMIT_SOURCES.has(programSource) ||
        desc.includes('limit') ||
        programName.includes('limit')
    ) {
        return 'Limit';
    }

    // Market orders: standard AMM/aggregator swaps
    const MARKET_SOURCES = new Set([
        'JUPITER',
        'RAYDIUM',
        'ORCA',
        'METEORA',
        'LIFINITY',
        'ALDRIN',
        'SABER',
        'MARINADE',
        'WHIRLPOOL',
        'FLUXBEAM',
        'PUMP_FUN',
        'PUMP',
    ]);

    if (MARKET_SOURCES.has(source) || MARKET_SOURCES.has(programSource)) {
        return 'Market';
    }

    // If it's a SWAP type, default to Market
    if (tx.type === 'SWAP' || tx.type === 'swap') {
        return 'Market';
    }

    return 'Unknown';
}

// ─── SOL delta estimation ───

function estimateSolDelta(tx: HeliusTransaction, wallet: string): number {
    const walletLower = wallet.toLowerCase();

    // Strategy 1: structured swap events
    const swap = tx.events?.swap;
    if (swap) {
        const solIn = swap.nativeOutput
            ? (Number(swap.nativeOutput.amount) || 0) / LAMPORTS_PER_SOL
            : 0;
        const solOut = swap.nativeInput
            ? (Number(swap.nativeInput.amount) || 0) / LAMPORTS_PER_SOL
            : 0;
        return solIn - solOut;
    }

    // Strategy 2: native transfer delta
    let delta = 0;
    if (tx.nativeTransfers) {
        for (const nt of tx.nativeTransfers) {
            const amount = nt.amount / LAMPORTS_PER_SOL;
            if (nt.toUserAccount.toLowerCase() === walletLower) delta += amount;
            if (nt.fromUserAccount.toLowerCase() === walletLower) delta -= amount;
        }
    }
    return delta;
}

// ─── Response types ───

export interface OrderTypeStat {
    type: OrderType;
    count: number;
    percentage: string;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
}

export interface PlatformStat {
    platform: string;
    count: number;
    percentage: string;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string;
    orderType: OrderType;
}

export interface OrderAnalysisPayload {
    orderTypes: OrderTypeStat[];
    platforms: PlatformStat[];
    totalSwaps: number;
}

// ─── Route handler ───

export async function GET() {
    try {
        const transactions = await getRecentTransactions(WHALE_WALLET, 50);

        // Filter to swap-like transactions
        const swapTxs = transactions.filter((tx) => {
            if (tx.type === 'SWAP' || tx.type === 'swap') return true;
            const desc = (tx.description || '').toLowerCase();
            return desc.includes('swap') || desc.includes('for');
        });

        // ── Per-type aggregation ──
        const typeMap = new Map<
            OrderType,
            { count: number; pnls: number[] }
        >();
        for (const t of ['Market', 'Limit', 'DCA', 'Unknown'] as OrderType[]) {
            typeMap.set(t, { count: 0, pnls: [] });
        }

        // ── Per-platform aggregation ──
        const platformMap = new Map<
            string,
            { count: number; pnls: number[]; orderType: OrderType }
        >();

        for (const tx of swapTxs) {
            const orderType = classifyOrderType(tx);
            const solDelta = estimateSolDelta(tx, WHALE_WALLET);
            const platform = tx.source || 'Unknown';

            // Type
            const typeData = typeMap.get(orderType)!;
            typeData.count += 1;
            typeData.pnls.push(solDelta);

            // Platform
            if (!platformMap.has(platform)) {
                platformMap.set(platform, { count: 0, pnls: [], orderType });
            }
            const platData = platformMap.get(platform)!;
            platData.count += 1;
            platData.pnls.push(solDelta);
        }

        const totalSwaps = swapTxs.length;

        // Build order type stats
        const orderTypes: OrderTypeStat[] = (['Market', 'Limit', 'DCA', 'Unknown'] as OrderType[])
            .map((type) => {
                const data = typeMap.get(type)!;
                const wins = data.pnls.filter((p) => p > 0).length;
                const totalPnl = data.pnls.reduce((s, p) => s + p, 0);
                return {
                    type,
                    count: data.count,
                    percentage:
                        totalSwaps > 0
                            ? ((data.count / totalSwaps) * 100).toFixed(1)
                            : '0.0',
                    totalPnlSol: Number(totalPnl.toFixed(6)),
                    avgPnlSol:
                        data.count > 0
                            ? Number((totalPnl / data.count).toFixed(6))
                            : 0,
                    winRate:
                        data.count > 0
                            ? `${((wins / data.count) * 100).toFixed(1)}%`
                            : '0.0%',
                };
            })
            .filter((t) => t.count > 0); // Only include types with data

        // Build platform stats (sorted by count desc)
        const platforms: PlatformStat[] = Array.from(platformMap.entries())
            .map(([platform, data]) => {
                const wins = data.pnls.filter((p) => p > 0).length;
                const totalPnl = data.pnls.reduce((s, p) => s + p, 0);
                return {
                    platform,
                    count: data.count,
                    percentage:
                        totalSwaps > 0
                            ? ((data.count / totalSwaps) * 100).toFixed(1)
                            : '0.0',
                    totalPnlSol: Number(totalPnl.toFixed(6)),
                    avgPnlSol:
                        data.count > 0
                            ? Number((totalPnl / data.count).toFixed(6))
                            : 0,
                    winRate:
                        data.count > 0
                            ? `${((wins / data.count) * 100).toFixed(1)}%`
                            : '0.0%',
                    orderType: data.orderType,
                };
            })
            .sort((a, b) => b.count - a.count);

        const payload: OrderAnalysisPayload = {
            orderTypes,
            platforms,
            totalSwaps,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Order analysis API error:', error);
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
