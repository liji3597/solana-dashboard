import type { HeliusAssetsResponse } from '../types/api';
import { formatApiError, validateSolanaAddress } from '../utils';

interface HeliusRpcSuccess {
  result: HeliusAssetsResponse;
}

interface HeliusRpcError {
  error: {
    message: string;
  };
}

export async function getAssetsByOwner(
  walletAddress: string,
): Promise<HeliusAssetsResponse> {
  try {
    validateSolanaAddress(walletAddress);

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is not set');
    }

    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: 1000,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Helius request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as HeliusRpcSuccess | HeliusRpcError;

    if ('error' in payload && payload.error) {
      throw new Error(`Helius RPC error: ${payload.error.message}`);
    }

    if (!('result' in payload)) {
      throw new Error('Helius RPC payload is missing a result field');
    }

    return payload.result;
  } catch (error) {
    throw formatApiError(error, 'Failed to fetch assets from Helius');
  }
}
