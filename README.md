# SplitSafe

SplitSafe is an AI-powered onchain group budgeting and payment assistant for friends, students, families, and small teams.

Traditional split apps track who owes money. SplitSafe helps a group create a budget, add members, record expenses, calculate equal splits, settle unpaid balances on Base Sepolia, and ask an assistant to explain group spending in plain language.

## Problem

Group spending is messy. People track expenses in chats, spreadsheets, and notes, then settle later with little context. Existing tools usually stop at "who owes who" and do not connect the budget, wallet settlement, and spending explanation.

## Solution

SplitSafe gives each group a lightweight workspace:

- Create a budget in demo USDC
- Add members and wallet addresses
- Add expenses and calculate equal splits
- See outstanding balances clearly
- Settle on Base Sepolia testnet or mock-settle without a wallet
- Ask an AI-style assistant for summaries and budget answers

## Features

- Landing page with a clean hackathon pitch
- Dashboard with wallet connection, group creation, and group list
- Supabase-backed groups, members, expenses, splits, settlements, and AI messages
- Local demo mode when Supabase keys are missing
- ABAC Dinner Group demo data button
- Base Sepolia support through wagmi, viem, and RainbowKit
- Testnet settlement flow with Basescan transaction links
- `/api/ai-summary` route with server-side Gemini support and rule-based fallback
- Simple Solidity registry contract in `contracts/SplitSafeRegistry.sol`

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase
- wagmi + viem + RainbowKit
- Base Sepolia testnet
- Vercel-ready deployment

## Setup

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
GEMINI_API_KEY=
```

The app still works without Supabase or Gemini keys. Without Supabase, it uses localStorage. Without `GEMINI_API_KEY`, `/api/ai-summary` returns a rule-based assistant response.

## Gemini AI Setup

SplitSafe AI uses Gemini only from the server route at `app/api/ai-summary/route.ts`.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a Gemini API key.
3. Add it to `.env.local` only:

```bash
GEMINI_API_KEY=your_key_here
```

Security rules:

- Never rename this to `NEXT_PUBLIC_GEMINI_API_KEY`.
- Never expose Gemini keys to browser code.
- Never commit `.env.local`.
- Keep `.env.example` as placeholders only.
- If Gemini fails or the key is missing, SplitSafe automatically uses the local rule-based fallback.

SplitSafe AI is instructed to stay inside group budgeting, expense splitting, spending insights, and Base Sepolia testnet settlement status. It must not suggest mainnet payments, real-money transfers, trading, or investment advice.

## Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/schema.sql`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.

For a hackathon demo, the schema is intentionally simple. Add row-level security policies before production use.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Base Sepolia

1. Add Base Sepolia to your wallet.
2. Fund the wallet with testnet ETH from a faucet.
3. Add a WalletConnect project ID in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
4. Optionally set `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`.

SplitSafe only uses testnet/demo transactions. It never asks for mainnet funds.

Demo currency is displayed as USDC for budgeting, but this MVP does not move real USDC by default. Settlement sends a tiny Base Sepolia ETH transaction only when a wallet is connected, or records a mock settlement in demo mode.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Deploy.

The app uses standard Next.js routes and is Vercel-ready without custom server configuration.

Do not add `.env.local`, wallet private keys, seed phrases, Supabase service role keys, or Gemini keys to GitHub. Wallet addresses stored by the app are public identifiers only.

## Hackathon Demo Flow

1. Open the landing page.
2. Click **Launch App**.
3. Connect a wallet, or continue in demo mode.
4. Click **Load Demo Data**.
5. Open **ABAC Dinner Group**.
6. Review the 100 USDC budget and 30 USDC dinner expense.
7. Ask the assistant: `Who still needs to pay?`
8. Click **Settle** next to an unpaid balance.
9. Confirm the Base Sepolia transaction, or use mock settlement without a wallet.
10. See the transaction hash and settled status.

## Notes

- Demo currency is USDC for budgeting, but settlement sends a tiny amount of Base Sepolia ETH for testnet proof.
- The Solidity contract is included as a simple registry/event layer and is not required for the app to run.
- This is an MVP, not a production finance app.
- The public GitHub repo is `https://github.com/ThantSinNyan/splitsafe`.
