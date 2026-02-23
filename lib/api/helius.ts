import type { HeliusAssetsResponse, HeliusTransaction } from '../types/api';
import { formatApiError, validateSolanaAddress } from '../utils';

// ─── Retry helper for Helius rate-limits (429) ───

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(input, init);

    if (response.status !== 429 || attempt === MAX_RETRIES) {
      return response;
    }

    lastResponse = response;
    // Exponential back-off: 500 → 1000 → 2000 ms
    const delay = BASE_DELAY_MS * 2 ** attempt;
    await new Promise((r) => setTimeout(r, delay));
  }

  return lastResponse!;
}
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

    const response = await fetchWithRetry(
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

    // Use the Enhanced Transactions API (api-mainnet.helius-rpc.com)
    const url = new URL(`https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions`);
    url.searchParams.set('api-key', apiKey);
    if (type) {
      url.searchParams.set('type', type);
    }
    url.searchParams.set('limit', limit.toString());

    const response = await fetchWithRetry(url.toString(), {
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

    // Validate returned data
    if (!Array.isArray(transactions)) {
      throw new Error('Helius API returned invalid data format');
    }

    return transactions;
  } catch (error) {
    throw formatApiError(error, 'Failed to fetch transactions from Helius');
  }
}
