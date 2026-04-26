# SplitSafe

<p align="center">
  <img src="./public/splitsafe-logo-full.png" alt="SplitSafe logo" width="360" />
</p>

SplitSafe is an AI-powered onchain group budgeting and payment assistant for friends, students, families, and small teams.

Live demo: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

## What Changed

SplitSafe is now a real multi-user app:

- Supabase Auth accounts with Google and email/password login
- Optional anonymous demo login for testers
- Session restore on refresh
- Private workspaces scoped by membership
- Email invite links for members and admins
- Supabase Row Level Security on all app tables
- Workspace expenses, equal splits, balances, settlement history, and AI messages
- Gemini server-side AI with local fallback

## Problem

Group spending is messy. People track expenses in chats, spreadsheets, and notes, then settle later with little context. Existing apps usually stop at "who owes who" and do not connect budget, wallet settlement, and spending explanation.

## Solution

SplitSafe gives each group a private workspace:

- Create a budget such as "Thailand Trip" with 100 USD
- Invite members by email
- Add expenses and calculate equal splits
- See unpaid balances clearly
- Ask SplitSafe AI for summaries and suggestions
- Mock-settle or settle with Base Sepolia testnet wallets

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Gemini API through a server-only Next.js route
- wagmi + viem + RainbowKit
- Base Sepolia testnet
- Vercel production deploy

## Brand Assets

- Full wordmark logo: `public/splitsafe-logo-full.png`
- Icon-only logo: `public/splitsafe-logo.png`
- Favicon/app icons use the icon-only mark.

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
GEMINI_API_KEY=
```

`GEMINI_API_KEY` must stay server-only. Never rename it to `NEXT_PUBLIC_GEMINI_API_KEY`.

## Supabase Setup

1. Create or open your Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Go to **Authentication > Providers** and enable:
   - Email
   - Google
   - Anonymous sign-ins
5. For Google OAuth, add your local and production redirect URLs in Supabase Auth settings.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally and in Vercel.

Important: `supabase/schema.sql` resets the earlier demo tables and creates the account-based RLS schema. Run it only when you are ready to migrate to the multi-user model.

## Gemini AI Setup

SplitSafe AI uses Gemini only from `app/api/ai-summary/route.ts`.

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a Gemini API key.
3. Add it to `.env.local` and Vercel as:

```bash
GEMINI_API_KEY=your_key_here
```

Security rules:

- Never expose Gemini keys to browser code.
- Never commit `.env.local`.
- If Gemini fails or the key is missing, SplitSafe uses a rule-based fallback.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Base Sepolia

SplitSafe only uses testnet/demo settlement.

1. Add Base Sepolia to your wallet.
2. Fund the wallet with testnet ETH from a faucet.
3. Connect wallet in the app.
4. If the payment receiver has a wallet saved on their profile, SplitSafe can send a tiny Base Sepolia ETH test transaction.
5. If no receiver wallet is available, SplitSafe records a mock settlement.

No mainnet funds are required or requested.

## Deploy to Vercel

The GitHub repository is connected to Vercel. Pushes to `main` automatically trigger a production deployment.

Required Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

Production URL: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

Do not add `.env.local`, wallet private keys, seed phrases, Supabase service role keys, or Gemini keys to GitHub.

## Optional Render Deployment

`render.yaml` is included as an optional Render blueprint. Vercel remains the primary production host for this project.

## Demo Flow

1. Open the landing page.
2. Click **Launch App**.
3. Sign up or log in with Google/email, or click **Try demo mode** for a temporary isolated tester account.
4. Create **Thailand Trip** with a 100 USD budget.
5. Invite another email as member/admin.
6. Accept the invite from that account.
7. Add an expense and split it across active members.
8. Ask the assistant: `Who still needs to pay?`
9. Click **Settle** next to an unpaid balance.
10. Show paid status and transaction/mock hash.

## Notes

- This is still a hackathon MVP, not a production finance app.
- RLS is enabled and should be treated as the security boundary.
- The Solidity contract is included as a simple registry/event layer and is not required for the app to run.
- The public GitHub repo is `https://github.com/ThantSinNyan/splitsafe`.
