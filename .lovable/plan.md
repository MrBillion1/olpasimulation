# Multi-Market Portfolio Trading — Implementation Plan

This is a large addition. To keep the existing OLPA terminal stable, I'll layer a new **Multi-Market** mode on top of the current trade panel without rewriting the Single-Market flow. Below is the full scope grouped into phases so we can ship incrementally and you can sanity-check between phases.

---

## Phase 1 — Mode Switch + Multi-Market Panel (foundation)

**Files added**
- `src/components/multi/MultiMarketPanel.tsx` — portfolio builder UI
- `src/components/multi/ContractRow.tsx` — per-contract editor row
- `src/components/multi/PortfolioCalculator.tsx` — live calc & leverage→margin allocation bars
- `src/lib/portfolio-store.ts` — Zustand store + types for portfolios
- `src/lib/portfolio-math.ts` — pure functions: allocation, exposure, effective leverage, health, target payout, reward/risk

**Files edited**
- `src/components/TradePanel.tsx` — add top-level **SINGLE MARKET / MULTI MARKET** toggle; current ticket renders for Single; new panel renders for Multi
- `src/lib/persistence.ts` — persist portfolios + per-session expiry like existing trades

**Multi-Market panel contents**
- Portfolio Name input
- Portfolio Margin input (capped by shared $10k account)
- Add Contract button (max 5)
- Each row: Contract picker (6 OLPA contracts), Long/Short, Leverage (1–20x), TP%, SL%
- Live calculator: Total Margin, Total Exposure, Effective Leverage, Conviction Score, Health, Target Payout, Reward/Risk
- Leverage-driven allocation bars (no manual % allocation)

**Allocation formula (leverage-weighted)**
```
weight_i = leverage_i / Σ leverage_j
margin_i = portfolio_margin × weight_i
exposure_i = margin_i × leverage_i
```

---

## Phase 2 — Confirmation Screens

**Added**
- `src/components/multi/PortfolioConfirmModal.tsx` — mandatory pre-open confirmation (name, contracts, directions, leverage, TP/SL, allocations, exposure, target payout, risk score, health, max drawdown, reward/risk) → **Confirm Portfolio** button
- `src/components/SingleMarketConfirmModal.tsx` — same pattern for existing Single-Market opens (direction, margin, leverage, TP, SL, exposure, est. liquidation)

**Edited**
- `src/components/TradePanel.tsx` — route Long/Short clicks through confirm modal

---

## Phase 3 — Live Portfolio Tracker

**Added**
- `src/pages/PortfolioTracker.tsx` (route `/portfolio/:id`) showing:
  - Portfolio Equity, Live Value, Aggregate PnL, Health, Liquidation Buffer, Target Payout, Progress-to-Target
  - Contract monitoring list: current state, PnL, exposure, reality status, TP progress, SL distance
  - Reality Injection visualization chain (Event → State → Price → Repricing → PnL → Portfolio)
  - Portfolio Attrition widget (equity timeline points)
- `src/components/multi/ContractClosedToast.tsx` — SL hit overlay showing old vs new equity/exposure/health

**Edited**
- `src/lib/simulation-store.ts` — global subscribe: per-tick contract PnL → portfolio recalculation; SL/TP per-contract closure; portfolio liquidation when equity ≤ 0; record equity history points

---

## Phase 4 — Partial / Full Close + Liquidation

**Added**
- `src/components/multi/PartialCloseModal.tsx` — withdraw amount slider (1–100% of equity), shows Current Equity, Amount Withdrawn, New Equity/Exposure/Health/Liq Buffer; requires confirm
- `src/components/multi/FullCloseModal.tsx` — Portfolio Value, Realized P/L, Funds Returned, Final Settlement; requires confirm
- `src/components/multi/LiquidationScreen.tsx` — Portfolio Insolvency: contracts closed, remaining equity, realized loss, reason (Repeated SL / Insufficient Equity / Insufficient Support)

---

## Phase 5 — TP/SL Education + Polish

**Added**
- `src/components/multi/TpSlEducationCard.tsx` — collapsible "How TP/SL Works" explainer (TP/SL shape reward/risk/conviction/target — reality generates profit)

**Polish**
- Match existing dark theme + gold accents
- Reuse shadcn primitives (Card, Button, Dialog, Slider, Progress)
- Multi-Market panel uses the same panel chrome as Single-Market

---

## Data model additions (TypeScript)

```ts
type PortfolioContract = {
  contractId: ContractId;
  direction: "long" | "short";
  leverage: number;
  tpPct: number;
  slPct: number;
  entryPrice: number;
  marginAlloc: number;   // derived
  exposure: number;       // derived
  status: "active" | "tp" | "sl" | "closed";
  realizedPnl: number;
};

type Portfolio = {
  id: string;
  name: string;
  margin: number;            // initial
  equity: number;            // live
  contracts: PortfolioContract[];
  equityHistory: { t: number; equity: number }[];
  sessionEndsAt: number;
  status: "active" | "closed" | "liquidated";
  createdAt: number;
};
```

---

## What stays untouched
- Single-Market ticket layout (Cross/Isolated, Market/Limit, Size, Leverage, TP, SL, Long, Short)
- SCL pages, pitch sim, event feed, market selector, price chart
- Shared $10k IP-based daily margin reset

---

## Suggested rollout

Ship Phase 1+2 first so you can build/confirm portfolios end-to-end against the live sim. Phase 3 wires the tracker. Phase 4+5 close the loop with partial/full close, liquidation, and the TP/SL explainer.

**Reply "go" to start Phase 1, or tell me which phase to prioritize / drop.**
