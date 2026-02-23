import { createOpenAI } from "@ai-sdk/openai";

const siliconflow = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://api.siliconflow.cn/v1",
  apiKey: process.env.OPENAI_API_KEY,
});
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getJournalStats } from "@/lib/actions/analytics";
import { getWalletPositions } from "@/lib/api/mobula";
import { WHALE_WALLET } from "@/lib/constants/wallets";

export const runtime = "nodejs";

type ChatRequestBody = {
  messages?: UIMessage[];
  wallet?: string;
};

export async function POST(req: Request) {
  const { messages = [], wallet: bodyWallet } = (await req.json()) as ChatRequestBody;
  const wallet = bodyWallet || WHALE_WALLET;
  const modelMessages = await convertToModelMessages(messages);

  let netWorth = 0;
  let winRate = "0.0";
  let sharpeRatio: number | null = null;
  let topTag = "N/A";

  try {
    const walletData = await getWalletPositions(wallet);
    const positions = walletData.positions ?? [];

    const profitablePositions = positions.filter((position) => {
      const pnl = (position.unrealizedPnl ?? 0) + (position.realizedPnl ?? 0);
      return pnl > 0;
    }).length;

    winRate =
      positions.length === 0
        ? "0.0"
        : ((profitablePositions / positions.length) * 100).toFixed(1);

    const computedNetWorth =
      walletData.totalValue ??
      positions.reduce((sum, position) => sum + (position.value ?? 0), 0);
    netWorth = Number.isFinite(computedNetWorth) ? computedNetWorth : 0;

    const journalStats = await getJournalStats(wallet, netWorth);
    if (!journalStats.success || !journalStats.data) {
      netWorth = 0;
      winRate = "0.0";
      sharpeRatio = null;
      topTag = "N/A";
    } else {
      sharpeRatio = journalStats.data.sharpeRatio ?? null;

      const tagFrequency = journalStats.data.tagFrequency ?? {};
      const topTagEntry = Object.entries(tagFrequency).reduce<
        [string, number] | null
      >((best, current) => {
        if (!best || current[1] > best[1]) {
          return current;
        }
        return best;
      }, null);

      topTag = topTagEntry?.[0] ?? "N/A";
    }
  } catch (error) {
    console.error("Chat API context fetch error:", error);
    netWorth = 0;
    winRate = "0.0";
    sharpeRatio = null;
    topTag = "N/A";
  }

  const systemPrompt = `You are a strict but professional crypto trading coach.
The user's net worth is ${netWorth.toFixed(2)} USD, win rate is ${winRate}%, and Sharpe ratio is ${sharpeRatio ?? "N/A"}.
Their most common mistake tag is ${topTag}.
Answer the user's questions based on this data. Provide specific, actionable advice.
If the Sharpe ratio is below 1.0 or N/A, harshly criticize their risk management skills in your response.
Keep your answers concise, under 200 words.`;

  const result = streamText({
    model: siliconflow.chat("Qwen/Qwen2.5-72B-Instruct"),
    system: systemPrompt,
    messages: modelMessages,
  });

  const compatResult = result as typeof result & {
    toDataStreamResponse?: () => Response;
  };

  if (typeof compatResult.toDataStreamResponse === "function") {
    return compatResult.toDataStreamResponse();
  }

  return result.toUIMessageStreamResponse();
}
