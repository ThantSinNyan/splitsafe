# SplitSafe

<p align="center">
  <img src="./public/splitsafe-logo-full.png" alt="SplitSafe logo" width="360" />
</p>

SplitSafe is an AI-powered group expense and payment assistant for friends, families, roommates, and small teams.

Live app: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

## What Changed

SplitSafe is now a real multi-user app:

- Supabase Auth accounts with Google and email/password login
- Guest account for people who want to explore first
- Session restore on refresh
- Private groups scoped by membership
- Invite links for members and admins
- Supabase Row Level Security on all app tables
- Group expenses, equal splits, balances, settlement history, and AI messages
- Gemini server-side AI with resilient responses
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
- Record payments manually or settle with supported wallets

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Gemini API through a server-only Next.js route
- wagmi + viem + RainbowKit
- 0G Galileo by default, Base Sepolia as fallback/legacy
- Fake dUSDC ERC20 settlement on 0G Galileo Testnet
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
NEXT_PUBLIC_DEMO_USDC_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
GEMINI_API_KEY=
RESEND_API_KEY=
GENSYN_AXL_ENDPOINT=
NEXT_PUBLIC_GENSYN_AXL_ENABLED=false
OG_GALILEO_RPC_URL=https://evmrpc-testnet.0g.ai
DEPLOYER_PRIVATE_KEY=
```

`GEMINI_API_KEY` must stay server-only. Never rename it to `NEXT_PUBLIC_GEMINI_API_KEY`.
`RESEND_API_KEY` is optional for future invite email delivery and must stay server-only.
`GENSYN_AXL_ENDPOINT` is optional and should stay server-side unless you intentionally expose a public endpoint.

## Supabase Setup

1. Create or open your Supabase project.
2. Go to **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Go to **Authentication > Providers** and enable:
   - Email
   - Google
   - Anonymous sign-ins are not required for the built-in guest account
5. For Google OAuth, add your local and production redirect URLs in Supabase Auth settings.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally and in Vercel.

Important: `supabase/schema.sql` resets earlier tables and creates the account-based RLS schema. Run it only when you are ready to migrate to the multi-user model.

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
- If Smart Slip Scan has no Gemini key, the app asks users to review the extracted fields before saving.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Demo USDC Settlement On 0G Galileo

SplitSafe tracks expenses, budgets, and balances in USD. For the hackathon demo,
settlements use fake `dUSDC` on 0G Galileo Testnet.

Important:

- `dUSDC` is a testnet ERC20 token with no real value.
- It is not real USDC.
- 0G is used only as the gas token.
- SplitSafe verifies `dUSDC` Transfer events before marking a balance as settled.
- In production, `dUSDC` can be replaced by real USDC/USDT or a checkout provider.

Default network:

- 0G Galileo Testnet
- Chain ID: `16602`
- Explorer: `https://chainscan-galileo.0g.ai`
- Development RPC: `https://evmrpc-testnet.0g.ai`
- Settlement token: `dUSDC`
- Gas token: `0G`

Fallback/legacy network:

- Base Sepolia

Deploy `dUSDC`:

1. Get 0G testnet gas from [https://faucet.0g.ai](https://faucet.0g.ai).
2. Add `OG_GALILEO_RPC_URL` locally.
3. Add `DEPLOYER_PRIVATE_KEY` locally.
4. Run `npm run deploy:demo-usdc`.
5. Copy the deployed `dUSDC` contract address.
6. Add `NEXT_PUBLIC_DEMO_USDC_ADDRESS` to Vercel.
7. Redeploy.
8. Test add-token, faucet mint, send, and verify in the settlement modal.

Never commit private keys, seed phrases, or `.env.local`.

If `NEXT_PUBLIC_DEMO_USDC_ADDRESS` is missing, the app stays usable and the
guest account can record a clearly labeled mock dUSDC proof for demo only.

## Smart Settlement

SplitSafe presents settlement as three simple steps:

- Expense checked
- Split calculated
- Settlement ready

The AXL-ready service layer is available in `lib/axl.ts`, with a server-side
route at `POST /api/axl/settlement`. When `GENSYN_AXL_ENDPOINT` is configured,
SplitSafe forwards a sanitized settlement signal to that endpoint. Without the
endpoint, the app returns an AXL-ready status and continues normally.

Only workflow metadata is routed through this endpoint. Secret keys stay
server-side, and member emails or names are not included in the AXL signal.

## Deploy to Vercel

The GitHub repository is connected to Vercel. Pushes to `main` automatically trigger a production deployment.

Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_0G_GALILEO_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_DEFAULT_CHAIN=0g-galileo
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_DEMO_USDC_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
GEMINI_API_KEY=
RESEND_API_KEY=
GENSYN_AXL_ENDPOINT=
NEXT_PUBLIC_GENSYN_AXL_ENABLED=false
OG_GALILEO_RPC_URL=https://evmrpc-testnet.0g.ai
DEPLOYER_PRIVATE_KEY=
```

`NEXT_PUBLIC_DEMO_USDC_ADDRESS`, `RESEND_API_KEY`, and `GENSYN_AXL_ENDPOINT`
are optional placeholders. Real dUSDC mint/send/verify requires the deployed
token address.

Production URL: [https://splitsafe.vercel.app](https://splitsafe.vercel.app)

Do not add `.env.local`, wallet private keys, seed phrases, Supabase service role keys, or Gemini keys to GitHub.

## Optional Render Deployment

`render.yaml` is included as an optional Render blueprint. Vercel remains the primary production host for this project.

## Product Flow

1. Open the landing page.
2. Click **Launch App**.
3. Sign up or log in with Google/email, or continue as guest.
4. Open a group and review members, expenses, balances, messages, and payment records.
5. Use **Smart Slip Scan** inside Add Expense to upload a receipt/slip, review the extracted result, and fill the form.
6. Add or edit an expense and split it across active members.
7. Ask the assistant: `Who still needs to pay?`
8. Click **Settle up** next to an unpaid balance.
9. Mint fake dUSDC, send it to the recipient wallet, or paste an existing transaction hash.
10. SplitSafe verifies the dUSDC transfer and shows settled status.

## Notes

- RLS is enabled and should be treated as the security boundary.
- `contracts/DemoUSDC.sol` is a fake testnet token for settlement demos only.
- `contracts/SplitSafeRegistry.sol` is a simple registry/event layer and is not required for the app to run.
- The public GitHub repo is `https://github.com/ThantSinNyan/splitsafe`.
