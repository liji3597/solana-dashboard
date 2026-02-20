import { WHALE_WALLET } from '@/lib/constants/wallets';

/**
 * Extract the wallet address from the request's `?wallet=` query parameter.
 * Falls back to WHALE_WALLET when no parameter is provided.
 */
export function getWalletParam(request: Request): string {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (wallet && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        return wallet;
    }

    return WHALE_WALLET;
}
