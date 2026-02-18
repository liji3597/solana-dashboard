import { NextResponse } from 'next/server';
import { getRecentTransactions } from '@/lib/api/helius';
import { transformSwapTransaction } from '@/lib/utils';

// 测试用活跃交易地址（Jupiter 聚合器）
const TEST_WALLET = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

export async function GET() {
  try {
    const transactions = await getRecentTransactions(TEST_WALLET, 20, 'SWAP');
    const transformed = transactions.map(transformSwapTransaction);

    return NextResponse.json({
      success: true,
      data: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error('API route error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
