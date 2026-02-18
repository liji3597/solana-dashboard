import type { PortfolioHistoryPoint } from '../types/api';

/**
 * 生成模拟的投资组合历史数据
 *
 * 从当前净值倒推 30 天，每天随机波动 -5% 到 +5%
 *
 * @param currentNetWorth - 当前净值（美元）
 * @returns 30 天历史数据数组，按日期升序排列
 */
export function getPortfolioHistory(
  currentNetWorth: number
): PortfolioHistoryPoint[] {
  const days = 30;
  const history: PortfolioHistoryPoint[] = [];

  // 边界处理
  if (currentNetWorth <= 0) {
    return [];
  }

  // 从 30 天前开始生成
  let value = currentNetWorth;
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    history.push({
      date: date.toISOString().split('T')[0], // YYYY-MM-DD 格式
      value: Math.round(value * 100) / 100 // 保留两位小数
    });

    // 为下一天生成随机波动（-5% 到 +5%）
    if (i > 0) {
      const volatility = (Math.random() - 0.5) * 0.1; // -0.05 到 0.05
      value = value * (1 + volatility);

      // 防止负值
      value = Math.max(value, currentNetWorth * 0.3); // 最低不低于当前净值的 30%
    } else {
      // 最后一天强制回到当前净值
      value = currentNetWorth;
    }
  }

  return history;
}
