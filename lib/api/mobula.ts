import type { MobulaWalletPositions } from '../types/api';
import { formatApiError, validateSolanaAddress } from '../utils';

const MOBULA_BASE_URL = 'https://api.mobula.io/api/2';

interface MobulaToken {
  symbol: string;
  address: string;
  name: string;
}

interface MobulaPositionResponse {
  token: MobulaToken;
  balance: number;
  amountUSD?: number;
  realizedPnlUSD?: number;
  unrealizedPnlUSD?: number;
  totalPnlUSD?: number;
}

interface MobulaResponse {
  data?: MobulaPositionResponse[];
  error?: string;
  message?: string;
}

export async function getWalletPositions(walletAddress: string): Promise<MobulaWalletPositions> {
  try {
    validateSolanaAddress(walletAddress);

    const apiKey = process.env.MOBULA_API_KEY;
    if (!apiKey) {
      throw new Error('MOBULA_API_KEY environment variable is not set');
    }

    const params = new URLSearchParams({
      wallet: walletAddress,
      blockchain: 'solana',
    });

    const response = await fetch(`${MOBULA_BASE_URL}/wallet/positions?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      // Parse error payload to expose Mobula's details
      let errorDetails = '';
      try {
        const errorBody = await response.json();
        errorDetails = errorBody.error || errorBody.message || JSON.stringify(errorBody);
      } catch {
        errorDetails = await response.text();
      }
      throw new Error(`Mobula request failed with status ${response.status}: ${errorDetails}`);
    }

    const payload = (await response.json()) as MobulaResponse;

    if (!payload.data || !Array.isArray(payload.data)) {
      const message = payload.error ?? payload.message ?? 'Mobula API response missing data';
      throw new Error(message);
    }

    const positions = payload.data.map((position) => ({
      token: {
        symbol: position.token.symbol,
        address: position.token.address,
        name: position.token.name,
      },
      balance: position.balance,
      value: position.amountUSD ?? 0,
      realizedPnl: position.realizedPnlUSD,
      unrealizedPnl: position.unrealizedPnlUSD,
    }));

    const totalValue = positions.reduce((sum, position) => sum + (position.value ?? 0), 0);

    return {
      positions,
      totalValue,
    };
  } catch (error) {
    throw formatApiError(error, 'Failed to fetch wallet positions from Mobula');
  }
}


