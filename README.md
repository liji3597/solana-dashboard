# Solana Trading Journal 📊

A real-time **Solana wallet analytics dashboard** built with Next.js. Connect your wallet (Phantom, Solflare, etc.) to visualize your on-chain trading performance — or browse the default demo wallet.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Solana](https://img.shields.io/badge/Solana-Mainnet-blueviolet?logo=solana)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### Wallet Connection
- **Browser wallet integration** via Solana Wallet Adapter (Phantom, Solflare, Backpack, etc.)
- Seamless switch between connected wallet and the default demo wallet
- All dashboard data automatically reloads when wallet changes

### Portfolio Overview
- **KPI Cards** — Total PnL, ROI, Win Rate, Total Trades, Net Worth, Volume, Fees
- **Portfolio History Chart** — 30-day portfolio value trend (via Mobula API)
- **PnL Chart** — Visual profit & loss over time

### Trading Analytics
- **Trading Metrics** — Largest gain/loss, profit factor, buy/sell ratio, avg trade interval
- **Time Dimension Analysis** — Daily PnL bar chart, hourly activity heatmap, Asia/Europe/US session breakdown
- **Order Type Analysis** — Market vs Limit vs DCA classification, platform breakdown with pie chart
- **Volume & Fee Analysis** — Total volume, fees paid, per-platform fee composition

### Transaction Records
- **Recent Swap History** — Token symbols resolved via Jupiter + Helius DAS (covers memecoins)
- **Smart spam filter** — Hides low-value, failed, and wrap/unwrap transactions with hidden-count badge
- **CSV Export** — Download transaction history
- **Real-time SOL price** — USD values via CoinGecko

### AI Trading Coach
- Chat-based AI assistant powered by SiliconFlow (OpenAI-compatible)
- Analyzes your portfolio, win rate, Sharpe ratio, and provides personalized advice

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS 4** + shadcn/ui |
| Charts | **Recharts** |
| Wallet | **Solana Wallet Adapter** (@solana/wallet-adapter-react) |
| AI | **Vercel AI SDK** + SiliconFlow |
| Auth | **Supabase** (optional) |
| Data Sources | Helius API, Mobula API, Jupiter Token List, CoinGecko |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** (or yarn / pnpm)
- API keys (see below)

### 1. Clone & Install

```bash
git clone https://github.com/liji3597/solana-dashboard.git
cd solana-dashboard
npm install
```

### 2. Configure API Keys

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your API keys:

| Variable | Required | Description | Get it at |
|----------|----------|-------------|-----------|
| `HELIUS_API_KEY` | ✅ | Transaction history, token metadata (DAS) | [helius.dev](https://www.helius.dev) |
| `MOBULA_API_KEY` | ✅ | Wallet positions, portfolio valuation, PnL | [developer.mobula.fi](https://developer.mobula.fi) |
| `OPENAI_API_KEY` | Optional | AI Trading Coach (SiliconFlow) | [siliconflow.cn](https://siliconflow.cn) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Journal & auth features | [supabase.com](https://supabase.com) |

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard loads with a default demo wallet. Click **"Select Wallet"** in the header to connect your own Solana wallet.

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
solana-dashboard/
├── app/
│   ├── page.tsx                    # Main dashboard page
│   ├── layout.tsx                  # Root layout with wallet provider
│   └── api/
│       ├── wallet-pnl/             # Portfolio PnL & win rate
│       ├── portfolio-history/      # 30-day portfolio chart data
│       ├── transactions/           # Recent swap history
│       ├── trading-metrics/        # Advanced trading stats
│       ├── time-analysis/          # Daily PnL, hourly heatmap, sessions
│       ├── order-analysis/         # Market/Limit/DCA classification
│       ├── volume-fees/            # Volume & fee composition
│       └── chat/                   # AI trading coach
├── components/
│   ├── dashboard/                  # All dashboard UI components
│   └── solana-wallet-provider.tsx  # Wallet adapter context wrapper
├── lib/
│   ├── api/
│   │   ├── helius.ts               # Helius API client (with retry)
│   │   ├── jupiter-tokens.ts       # Token symbol resolver (Jupiter + DAS)
│   │   ├── mobula.ts               # Mobula API client
│   │   ├── valuation.ts            # Portfolio history
│   │   └── get-wallet-param.ts     # Shared wallet query param helper
│   ├── constants/wallets.ts        # Default demo wallet address
│   └── types/api.ts                # TypeScript interfaces
└── .env.local.example              # Environment variable template
```

---

## 🔑 API Data Flow

```
Browser Wallet (Phantom/Solflare)
       │
       ▼
  page.tsx (useWallet → publicKey)
       │
       ▼
  /api/* routes (?wallet=<address>)
       │
       ├── Helius API ─── Transaction history, token metadata
       ├── Mobula API ─── Wallet positions, portfolio valuation
       ├── Jupiter ────── Token symbol resolution (strict list)
       └── CoinGecko ──── Real-time SOL/USD price
```

All API routes accept an optional `?wallet=` query parameter. When omitted, they fall back to the default demo wallet.

---

## 📄 License

MIT
