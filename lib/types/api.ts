export interface HeliusAsset {
  id: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
    };
  };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: {
      price_per_token: number;
    };
  };
}

export interface HeliusAssetsResponse {
  items: HeliusAsset[];
  total: number;
  limit: number;
  page: number;
}

export interface BirdeyeTokenPnL {
  token_address: string;
  symbol: string;
  profit: number;
  roi: number;
}

export interface BirdeyeWalletPnL {
  total_profit: number;
  overall_roi: number;
  tokens: BirdeyeTokenPnL[];
}

export interface MobulaTokenPosition {
  token: {
    symbol: string;
    address: string;
    name: string;
  };
  balance: number;
  value: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

export interface MobulaWalletPositions {
  positions: MobulaTokenPosition[];
  totalValue?: number;
}

export interface PortfolioHistoryPoint {
  date: string; // ISO 8601 format (YYYY-MM-DD)
  value: number; // USD value
}

export interface MaxDrawdownResult {
  percentage: number; // Max drawdown percentage (negative)
  peak: number; // Peak value
  trough: number; // Trough value
  peakDate?: string; // Optional: peak date
  troughDate?: string; // Optional: trough date
}

// Helius Enhanced Transaction raw response
export interface HeliusTransaction {
  signature: string;
  timestamp: number;
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  slot: number;

  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: string;
    decimals: number;
  }>;

  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;

  events?: {
    swap?: {
      nativeInput?: { mint: string; amount: string };
      nativeOutput?: { mint: string; amount: string };
      tokenInputs?: Array<{ mint: string; amount: string }>;
      tokenOutputs?: Array<{ mint: string; amount: string }>;
      programInfo?: { name: string; source: string };
    };
  };

  transactionError?: {
    error: string;
  } | null;
}

// Simplified swap transaction data (for UI display)
export interface SwapTransaction {
  signature: string;
  timestamp: number;
  date: string; // Formatted date (YYYY-MM-DD HH:mm)
  platform: string; // Source platform (Jupiter, Raydium, etc.)
  action: string; // Short description (SOL -> USDC)
  status: 'success' | 'failed';
  tokenSymbols: string[]; // Involved token symbols, e.g. ['SOL', 'USDC']
  valueSol?: number; // Estimated SOL value
  valueUsd?: number; // Estimated USD value
}

export interface SaveJournalEntryInput {
  tx_signature: string;
  rating: number;
  tags: string[];
  notes: string;
}

export interface TagWinRate {
  tag: string;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
}

export interface JournalStats {
  ratingDistribution: Record<number, number>;
  tagFrequency: Record<string, number>;
  totalEntries: number;
  sharpeRatio?: number | null;
  tagWinRates?: TagWinRate[];
}

