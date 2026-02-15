import type { BirdeyeWalletPnL } from '../types/api';
import { formatApiError, validateSolanaAddress } from '../utils';

interface BirdeyeResponse {
  success: boolean;
  data?: BirdeyeWalletPnL;
  message?: string;
}

export async function getWalletPnL(walletAddress: string): Promise<BirdeyeWalletPnL> {
  try {
    validateSolanaAddress(walletAddress);

    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      throw new Error('BIRDEYE_API_KEY environment variable is not set');
    }

    const params = new URLSearchParams({ wallet: walletAddress });
    const response = await fetch(`https://public-api.birdeye.so/v1/wallet/pnl?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    });

    if (!response.ok) {
      throw new Error(`Birdeye request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as BirdeyeResponse;

    if (!payload.success) {
      const message = payload.message ?? 'Birdeye API returned an error response';
      throw new Error(message);
    }

    if (!payload.data) {
      throw new Error('Birdeye response payload is missing data');
    }

    return payload.data;
  } catch (error) {
    throw formatApiError(error, 'Failed to fetch PnL from Birdeye');
  }
}
