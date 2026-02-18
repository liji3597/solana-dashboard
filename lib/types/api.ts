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
  date: string; // ISO 8601 格式 (YYYY-MM-DD)
  value: number; // 美元价值
}

export interface MaxDrawdownResult {
  percentage: number; // 最大回撤百分比（负数）
  peak: number; // 峰值价格
  trough: number; // 谷底价格
  peakDate?: string; // 可选：峰值日期
  troughDate?: string; // 可选：谷底日期
}

// Helius Enhanced Transaction 原始响应
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

// 简化的 SWAP 交易数据（用于 UI 展示）
export interface SwapTransaction {
  signature: string;
  timestamp: number;
  date: string; // 格式化后的日期 (YYYY-MM-DD HH:mm)
  platform: string; // 来源平台 (Jupiter, Raydium 等)
  action: string; // 简短描述 (SOL -> USDC)
  status: 'success' | 'failed';
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

