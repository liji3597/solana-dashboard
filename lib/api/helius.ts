import type { HeliusAssetsResponse, HeliusTransaction } from '../types/api';
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

export async function getRecentTransactions(
  walletAddress: string,
  limit: number = 20,
  type?: string
): Promise<HeliusTransaction[]> {
  try {
    validateSolanaAddress(walletAddress);

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is not set');
    }

    // 使用 Enhanced Transactions API (api-mainnet.helius-rpc.com)
    const url = new URL(`https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions`);
    url.searchParams.set('api-key', apiKey);
    if (type) {
      url.searchParams.set('type', type);
    }
    url.searchParams.set('limit', limit.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    // Helius returns 404 when no matching transactions are found in the
    // search window. This is expected behaviour, not an actual error.
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Helius request failed with status ${response.status}`);
    }

    const transactions = (await response.json()) as HeliusTransaction[];

    // 验证返回数据
    if (!Array.isArray(transactions)) {
      throw new Error('Helius API returned invalid data format');
    }

    return transactions;
  } catch (error) {
    throw formatApiError(error, 'Failed to fetch transactions from Helius');
  }
}
