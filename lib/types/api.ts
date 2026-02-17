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
