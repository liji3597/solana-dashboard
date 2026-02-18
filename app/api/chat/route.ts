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
};

export async function POST(req: Request) {
  const { messages = [] } = (await req.json()) as ChatRequestBody;
  const modelMessages = await convertToModelMessages(messages);

  let netWorth = 0;
  let winRate = "0.0";
  let sharpeRatio: number | null = null;
  let topTag = "N/A";

  try {
    const walletData = await getWalletPositions(WHALE_WALLET);
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

    const journalStats = await getJournalStats(WHALE_WALLET, netWorth);
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

  const systemPrompt = `你是一个严厉但专业的加密货币交易教练。
用户的总资产是 ${netWorth.toFixed(2)} USD，胜率是 ${winRate}%，夏普比率是 ${sharpeRatio ?? "N/A"}。
他们最常犯的错误标签是 ${topTag}。
请根据这些数据回答用户问题。给出具体、可操作的建议。
如果夏普比率低于 1.0 或为 N/A，请在回答中严厉批评他们的风控能力。
回答要简洁，控制在 200 字以内。`;

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
