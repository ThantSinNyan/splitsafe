# SplitSafe

<p align="center">
  <img src="./public/splitsafe-logo-full.png" alt="SplitSafe logo" width="360" />
</p>

SplitSafe is an AI-powered onchain group budgeting and payment assistant for friends, students, families, and small teams.

Live demo: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

## What Changed

SplitSafe is now a real multi-user app:

- Supabase Auth accounts with Google and email/password login
- Rich local demo account for testers who do not want to sign up
- Session restore on refresh
- Private groups scoped by membership
- Invite links for members and admins
- Supabase Row Level Security on all app tables
- Group expenses, equal splits, balances, settlement history, and AI messages
- Gemini server-side AI with local fallback
- Smart Slip Scan receipt/slip extraction through a server-only Gemini Vision route

## Problem

Group spending is messy. People track expenses in chats, spreadsheets, and notes, then settle later with little context. Existing apps usually stop at "who owes who" and do not connect budget, wallet settlement, and spending explanation.

## Solution

SplitSafe gives each group a private budget room:

- Create a budget such as "Thailand Trip" with 100 USD
- Invite members by email
- Add expenses and calculate equal splits
- See unpaid balances clearly
- Ask SplitSafe AI for summaries and suggestions
- Upload a receipt or bank slip to pre-fill an expense for review
- Mock-settle or settle with 0G Galileo Testnet wallets, with Base Sepolia kept as a fallback

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Gemini API through a server-only Next.js route
- wagmi + viem + RainbowKit
- 0G Galileo Testnet by default, Base Sepolia as fallback/legacy
- Vercel production deploy

## Brand Assets

- Full wordmark logo: `public/splitsafe-logo-full.png`
- Icon-only logo: `public/splitsafe-logo.png`
- Large brand areas use the full wordmark logo.
- Favicon, app icons, mobile navigation, and square upload fields use the icon-only mark.

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
NEXT_PUBLIC_0G_GALILEO_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_DEFAULT_CHAIN=0g-galileo
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
GEMINI_API_KEY=
RESEND_API_KEY=
GENSYN_AXL_ENDPOINT=
NEXT_PUBLIC_GENSYN_AXL_ENABLED=false
```

`GEMINI_API_KEY` must stay server-only. Never rename it to `NEXT_PUBLIC_GEMINI_API_KEY`.
`RESEND_API_KEY` is optional for future invite email delivery and must stay server-only.
`GENSYN_AXL_ENDPOINT` is optional and should stay server-side unless you intentionally expose a public local endpoint.

## Supabase Setup

1. Create or open your Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Go to **Authentication > Providers** and enable:
   - Email
   - Google
   - Anonymous sign-ins are not required for the built-in local demo account
5. For Google OAuth, add your local and production redirect URLs in Supabase Auth settings.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally and in Vercel.

Important: `supabase/schema.sql` resets the earlier demo tables and creates the account-based RLS schema. Run it only when you are ready to migrate to the multi-user model.

## Gemini AI Setup

SplitSafe AI uses Gemini only from server routes:

- `app/api/ai-summary/route.ts`
- `app/api/scan-receipt/route.ts`

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a Gemini API key.
3. Add it to `.env.local` and Vercel as:

```bash
GEMINI_API_KEY=
```

Security rules:

- Never expose Gemini keys to browser code.
- Never commit `.env.local`.
- If Gemini summary fails or the key is missing, SplitSafe uses a rule-based fallback.
- If Smart Slip Scan has no Gemini key, the app offers a clearly labeled demo extraction result for testing.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Testnet Settlement

SplitSafe only uses testnet/demo settlement.

Default network:

- 0G Galileo Testnet
- Chain ID: `16602`
- Explorer: `https://chainscan-galileo.0g.ai`
- Development RPC: `https://evmrpc-testnet.0g.ai`

Fallback/legacy network:

- Base Sepolia

Steps:

1. Add 0G Galileo Testnet to your wallet, or keep Base Sepolia for fallback testing.
2. Fund the wallet with testnet tokens from the relevant faucet.
3. Connect wallet in the app.
4. If the payment receiver has a wallet saved on their profile, SplitSafe can send a tiny testnet transaction on the active supported network.
5. If no receiver wallet is available, SplitSafe records a mock settlement.

No mainnet funds are required or requested.

## Gensyn AXL-ready agent workflow

SplitSafe models expense management as a set of cooperating agents:

- Receipt Agent reads receipts and payment slips.
- Budget Agent analyzes spending and budget impact.
- Settlement Agent prepares who-owes-who repayment actions.
- Safety Agent checks confidence and asks for confirmation before saving or payment.

The current version runs this workflow locally for demo reliability. If `GENSYN_AXL_ENDPOINT` is configured, the server route can forward the workflow message to an AXL-compatible endpoint. Future versions can route agent messages through Gensyn AXL for peer-to-peer agent coordination.

## Deploy to Vercel

The GitHub repository is connected to Vercel. Pushes to `main` automatically trigger a production deployment.

Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_0G_GALILEO_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_DEFAULT_CHAIN=0g-galileo
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
GEMINI_API_KEY=
RESEND_API_KEY=
GENSYN_AXL_ENDPOINT=
NEXT_PUBLIC_GENSYN_AXL_ENABLED=false
```

`RESEND_API_KEY` and `GENSYN_AXL_ENDPOINT` are optional placeholders. The app works without them.

Production URL: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

Do not add `.env.local`, wallet private keys, seed phrases, Supabase service role keys, or Gemini keys to GitHub.

## Optional Render Deployment

`render.yaml` is included as an optional Render blueprint. Vercel remains the primary production host for this project.

## Demo Flow

1. Open the landing page.
2. Click **Launch App**.
3. Sign up or log in with Google/email, or click **Try demo mode**.
4. Demo mode opens as **Alex Demo** with three sample groups: Thailand Trip, ABAC Dinner Group, and Hackathon Team.
5. Open a group and review members, expenses, balances, messages, and fake 0G Galileo payment references.
6. Use **Smart Slip Scan** inside Add Expense to upload a receipt/slip, review the extracted result, and fill the form.
7. Add or edit an expense and split it across active members.
8. Ask the assistant: `Who still needs to pay?`
9. Click **Settle** next to an unpaid balance.
10. Show paid status and transaction/mock hash.

Demo data is isolated in local browser storage and can be rebuilt with **Reset demo data**. It uses fake names, fake emails, fake wallet labels, fake contract references, and fake transaction hashes.

## Notes

- This is still a hackathon MVP, not a production finance app.
- RLS is enabled and should be treated as the security boundary.
- The Solidity contract is included as a simple registry/event layer and is not required for the app to run.
- The public GitHub repo is `https://github.com/ThantSinNyan/splitsafe`.
