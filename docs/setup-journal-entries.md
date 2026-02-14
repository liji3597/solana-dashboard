# Journal Entries Setup Guide

A step-by-step reference for wiring up the Supabase-powered Solana journal system.

## 1. Prerequisites
- **Node.js 20+** (matches Next.js 14 requirements)
- **Supabase project** (free tier works)
- **Solana wallet provider** already present in this repo via `@solana/wallet-adapter-*`

## 2. Install Runtime Dependencies
These packages are required for the new data and hook layers. They are not yet recorded in `package.json`, so install them manually:

```bash
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query
```

Optional but recommended when adding wallet auth helpers:

```bash
npm install @supabase/auth-helpers-nextjs
```

## 3. Configure Environment Variables
Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` from **Project Settings → API** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key from the same API page |
| `SUPABASE_SERVICE_ROLE_KEY` | (Optional) Service role key used only in secure server contexts |
| `NEXT_PUBLIC_WALLET_AUTH_REDIRECT` | URL you whitelist inside Supabase Auth → URL Configuration |

Restart `npm run dev` after editing these values so Next.js picks them up.

## 4. Run the Database Migration
1. Log in to the Supabase Dashboard and open **SQL Editor**.
2. Paste the contents of `supabase/migrations/20260214000000_create_journal_entries.sql`.
3. Execute the script. It creates the `journal_entries` table, indexes, trigger, and RLS policies.
4. Verify the schema with `select * from journal_entries limit 1;` and check indexes via `\di journal_entries*`.

> Using the Supabase CLI? Run `supabase db push` from the repo root instead of the SQL Editor.

## 5. Connect Supabase Clients
- **Browser client** (`lib/supabase/client.ts`): uses `@supabase/supabase-js` to persist sessions and exposes `getCurrentWallet()` + `signOut()` helpers.
- **Server client** (`lib/supabase/server.ts`): uses `@supabase/ssr` plus `next/headers` cookies to share auth state between RSCs and API routes.
- Make sure you wrap your app with a `<QueryClientProvider>` from React Query so the new hooks function correctly.

## 6. Wallet Authentication Flow
1. Users authenticate with their Solana wallet using the existing wallet adapter UI.
2. Send the signed message to a Next.js API route or Supabase Edge Function to verify the signature.
3. Upon success, issue a Supabase JWT containing the `wallet_address` claim. The included RLS policies rely on this claim.
4. Store the Supabase session in cookies so both browser and server clients share the same auth context.

Resources:
- Supabase Edge Functions guide: https://supabase.com/docs/guides/functions
- Solana signature verification (web3.js): `solanaWeb3.Message.from(Buffer.from(message, 'utf8'))`

## 7. Using the Service Layer
All CRUD utilities live in `lib/services/journal-entries.ts`. Example usage inside a React component:

```tsx
import { useCreateJournalEntry } from '@/hooks/use-journal-entries';

const createEntry = useCreateJournalEntry();

createEntry.mutate({
  user_wallet: walletAddress,
  tx_signature: signature,
  rating: 4,
  tags: ['defi', 'analysis'],
  notes: { type: 'doc', content: [] },
  screenshot_url: null,
});
```

The hook automatically handles optimistic updates and cache invalidation. Pair it with `useJournalEntries`, `useJournalEntry`, and `useJournalStats` where needed.

## 8. Checklist Before Shipping
- [ ] `.env.local` populated and ignored by git
- [ ] Migration executed and verified in Supabase
- [ ] React Query provider mounted at the app root
- [ ] Wallet verification endpoint produces a JWT with `wallet_address`
- [ ] Supabase Storage bucket created (optional) for screenshots referenced by `screenshot_url`
- [ ] Basic smoke test: create, read, update, delete, and query stats via the hooks

Following this playbook ensures the new journal entry stack is reproducible across dev, staging, and production environments.
