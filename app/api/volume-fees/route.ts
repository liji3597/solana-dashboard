import { NextResponse } from 'next/server';
import { getRecentTransactions } from '@/lib/api/helius';
import { getWalletParam } from '@/lib/api/get-wallet-param';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface VolumeFeeData {
    totalVolumeSol: number;
    totalFeesPaidSol: number;
    totalTransactions: number;
    feeComposition: FeeCompositionItem[];
    avgFeePerTxSol: number;
}

export interface FeeCompositionItem {
    name: string;
    value: number; // in SOL
    percentage: number;
}

export async function GET(request: Request) {
    try {
        const wallet = getWalletParam(request);
        // Fetch last 50 transactions (broader than SWAP only so we capture more fee data)
        const transactions = await getRecentTransactions(wallet, 50);

        let totalFeeLamports = 0;
        let totalVolumeLamports = 0;

        // Group fees by source/platform
        const feeBySource: Record<string, number> = {};

        for (const tx of transactions) {
            // Accumulate fees (Helius fee is in lamports)
            const txFee = tx.fee ?? 0;
            totalFeeLamports += txFee;

            // Group fee by source (platform)
            const source = tx.source || 'Unknown';
            feeBySource[source] = (feeBySource[source] ?? 0) + txFee;

            // Calculate volume from native transfers
            if (tx.nativeTransfers) {
                for (const nt of tx.nativeTransfers) {
                    totalVolumeLamports += Math.abs(nt.amount);
                }
            }

            // Calculate volume from token transfers (use raw token amounts)
            if (tx.tokenTransfers) {
                for (const tt of tx.tokenTransfers) {
                    const amount = Number(tt.tokenAmount) || 0;
                    // For volume purposes, we track raw amounts; native SOL volumes
                    // are already counted above via nativeTransfers, so we add a 
                    // small SOL-equivalent estimate for token swaps.
                    // We simply count native transfer volumes in SOL terms.
                }
            }

            // Also count swap event volumes if available
            if (tx.events?.swap) {
                const swap = tx.events.swap;
                if (swap.nativeInput) {
                    totalVolumeLamports += Math.abs(Number(swap.nativeInput.amount) || 0);
                }
                if (swap.nativeOutput) {
                    totalVolumeLamports += Math.abs(Number(swap.nativeOutput.amount) || 0);
                }
            }
        }

        const totalFeesSol = totalFeeLamports / LAMPORTS_PER_SOL;
        const totalVolumeSol = totalVolumeLamports / LAMPORTS_PER_SOL;
        const avgFeePerTxSol = transactions.length > 0
            ? totalFeesSol / transactions.length
            : 0;

        // Build fee composition with percentage
        const feeComposition: FeeCompositionItem[] = Object.entries(feeBySource)
            .sort(([, a], [, b]) => b - a)
            .map(([name, lamports]) => ({
                name,
                value: Number((lamports / LAMPORTS_PER_SOL).toFixed(6)),
                percentage: totalFeeLamports > 0
                    ? Number(((lamports / totalFeeLamports) * 100).toFixed(2))
                    : 0,
            }));

        // If too many categories, consolidate small ones into "Other"
        const MAX_SLICES = 6;
        let finalComposition = feeComposition;
        if (feeComposition.length > MAX_SLICES) {
            const top = feeComposition.slice(0, MAX_SLICES - 1);
            const rest = feeComposition.slice(MAX_SLICES - 1);
            const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
            const otherPercentage = rest.reduce((sum, item) => sum + item.percentage, 0);
            finalComposition = [
                ...top,
                {
                    name: 'Other',
                    value: Number(otherValue.toFixed(6)),
                    percentage: Number(otherPercentage.toFixed(2)),
                },
            ];
        }

        const responseData: VolumeFeeData = {
            totalVolumeSol: Number(totalVolumeSol.toFixed(4)),
            totalFeesPaidSol: Number(totalFeesSol.toFixed(6)),
            totalTransactions: transactions.length,
            feeComposition: finalComposition,
            avgFeePerTxSol: Number(avgFeePerTxSol.toFixed(6)),
        };

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Volume/Fees API route error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
