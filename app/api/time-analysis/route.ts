import { NextResponse } from 'next/server';

import { getRecentTransactions } from '@/lib/api/helius';
import { WHALE_WALLET } from '@/lib/constants/wallets';
import type { HeliusTransaction } from '@/lib/types/api';

const LAMPORTS_PER_SOL = 1_000_000_000;

// ─── Session definitions (UTC hours) ───
const SESSIONS = [
    { name: 'Asia', emoji: '🌏', startHour: 0, endHour: 8 },
    { name: 'Europe', emoji: '🌍', startHour: 8, endHour: 16 },
    { name: 'US', emoji: '🌎', startHour: 16, endHour: 24 },
] as const;

// ─── Response types ───

export interface DailyPnlPoint {
    date: string; // YYYY-MM-DD
    pnl: number;  // SOL
    txCount: number;
}

export interface HourlyActivityPoint {
    hour: number;  // 0–23 (UTC)
    count: number;
}

export interface SessionStat {
    session: string;
    emoji: string;
    txCount: number;
    totalPnlSol: number;
    avgPnlSol: number;
    winRate: string; // e.g. "66.7%"
}

export interface TimeAnalysisPayload {
    dailyPnl: DailyPnlPoint[];
    hourlyActivity: HourlyActivityPoint[];
    sessionStats: SessionStat[];
}

// ─── Helpers ───

/**
 * Estimate the SOL PnL for a single transaction from the perspective of the
 * wallet.  Positive = wallet gained SOL, negative = wallet spent SOL.
 *
 * Strategy:
 * 1. If swap events exist, use nativeOutput – nativeInput.
 * 2. Otherwise, sum native transfer deltas for the wallet.
 */
function estimateTxPnlSol(tx: HeliusTransaction, walletAddress: string): number {
    const walletLower = walletAddress.toLowerCase();

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
            if (nt.toUserAccount.toLowerCase() === walletLower) {
                delta += amount;
            }
            if (nt.fromUserAccount.toLowerCase() === walletLower) {
                delta -= amount;
            }
        }
    }

    return delta;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function toDateString(d: Date): string {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function getSessionForHour(hour: number): typeof SESSIONS[number] | undefined {
    return SESSIONS.find((s) => hour >= s.startHour && hour < s.endHour);
}

// ─── Route handler ───

export async function GET() {
    try {
        const transactions = await getRecentTransactions(WHALE_WALLET, 50);

        // ── Daily PnL aggregation ──
        const dailyMap = new Map<string, { pnl: number; txCount: number }>();

        // ── Hourly activity ──
        const hourlyCounts = new Array<number>(24).fill(0);

        // ── Session-level tracking ──
        const sessionMap = new Map<
            string,
            { txCount: number; pnls: number[] }
        >();
        for (const s of SESSIONS) {
            sessionMap.set(s.name, { txCount: 0, pnls: [] });
        }

        for (const tx of transactions) {
            const d = new Date(tx.timestamp * 1000);
            const dateStr = toDateString(d);
            const hourUtc = d.getUTCHours();
            const pnlSol = estimateTxPnlSol(tx, WHALE_WALLET);

            // Daily
            const existing = dailyMap.get(dateStr) ?? { pnl: 0, txCount: 0 };
            existing.pnl += pnlSol;
            existing.txCount += 1;
            dailyMap.set(dateStr, existing);

            // Hourly
            hourlyCounts[hourUtc] += 1;

            // Session
            const session = getSessionForHour(hourUtc);
            if (session) {
                const stats = sessionMap.get(session.name)!;
                stats.txCount += 1;
                stats.pnls.push(pnlSol);
            }
        }

        // Build sorted daily PnL array
        const dailyPnl: DailyPnlPoint[] = Array.from(dailyMap.entries())
            .map(([date, { pnl, txCount }]) => ({
                date,
                pnl: Number(pnl.toFixed(6)),
                txCount,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Build hourly activity
        const hourlyActivity: HourlyActivityPoint[] = hourlyCounts.map(
            (count, hour) => ({ hour, count }),
        );

        // Build session stats
        const sessionStats: SessionStat[] = SESSIONS.map((s) => {
            const data = sessionMap.get(s.name)!;
            const wins = data.pnls.filter((p) => p > 0).length;
            const totalPnl = data.pnls.reduce((sum, p) => sum + p, 0);
            const avgPnl = data.pnls.length > 0 ? totalPnl / data.pnls.length : 0;
            const winRate =
                data.pnls.length > 0
                    ? `${((wins / data.pnls.length) * 100).toFixed(1)}%`
                    : '0.0%';

            return {
                session: s.name,
                emoji: s.emoji,
                txCount: data.txCount,
                totalPnlSol: Number(totalPnl.toFixed(6)),
                avgPnlSol: Number(avgPnl.toFixed(6)),
                winRate,
            };
        });

        const payload: TimeAnalysisPayload = {
            dailyPnl,
            hourlyActivity,
            sessionStats,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Time analysis API error:', error);
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
