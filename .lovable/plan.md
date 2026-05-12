# Social Conviction Layer (SCL) — Implementation Plan

A protocol-grade, Bloomberg-terminal-style social intelligence layer integrated directly into the existing OLPA simulation. Not a feed — a live, contract-aware, position-attached conviction network synchronized with the match engine, pricing engine, and trading layer.

## Scope summary

- New top-level navigation entry **SCL** alongside the existing terminal, plus contract-hub deep links from the trading view.
- Social state lives in the same shared simulation store as match/pricing/trade state — no parallel mock data.
- All posts auto-route to a contract hub via keyword/team-name detection.
- Posts are stateful: pre-match (countdown) ↔ live (clock) ↔ final, driven by the existing match engine.
- Optional Proof-of-Conviction position attachment with strict 2-stage consent and strict privacy mask.
- Reputation derives from realized signal quality (accuracy, ROI efficiency, upset hits), not followers.

## Architecture

```text
match-engine ──┬─► pricing-engine ──┬─► TradePanel / OrderBook / Chart
               │                    │
               └─► event-bus ───────┴─► social-store ──► SCL UI
                                            ▲
                                            │
                                  Proof-of-Conviction
                                  (reads live trades + ROI)
```

- New `src/lib/social-store.ts` (Zustand-style or React context + reducer): posts, hubs, reputation, conviction attachments. Pure derivation from existing engines — no duplicated price/clock state.
- New `src/lib/contract-router.ts`: regex/alias map (e.g. `el clasico|real madrid|barca|barcelona|madrid` → `RMABAR`) → auto-tag + hub routing.
- New `src/lib/reputation.ts`: derives scores from closed trades + post outcomes.
- Extend the existing match engine with a small `subscribe(event)` hook so social posts and ROI can react deterministically.

## New components (under `src/components/scl/`)

1. `SCLLayout.tsx` — terminal-style 3-pane shell (hub list / feed / hub detail).
2. `HubList.tsx` — all contracts with live state chip, last price, Δ%, post count.
3. `HubDetail.tsx` — composes the per-contract terminal:
   - `HubPriceChart` (reuses `PriceChart`, adds event annotations)
   - `HubOrderBook` (reuses `OrderBook`, adds CLOB⇄ELP⇄AMM routing badge)
   - `ComputedPricingPanel` ("Reality repriced the market" log of pricing transitions)
   - `LiveMatchStatePanel` (score, clock, possession, momentum from existing engine)
   - `H2HIntelligence` (static-but-deterministic fixture/form data per contract)
   - `AIAnalysisPanel` (templated institutional summaries derived from live state — no LLM call needed for v1; structured rule-based outputs labeled "Model")
4. `PostComposer.tsx` — textarea + auto-detected contract chip + "Attach Live Position" toggle.
5. `ConvictionAttachDialog.tsx` — two-stage modal (disclosure → final confirm). Lists exactly what becomes public vs private.
6. `PostCard.tsx` — renders contract chip, state (PRE-MATCH countdown / LIVE clock / FINAL), body, optional conviction badge (`CONTRACT • LONG/SHORT • +ROI%` only).
7. `ConvictionBadge.tsx` — live ROI tick, detach button (owner only).
8. `ReputationPanel.tsx` — signal-quality metrics (accuracy, ROI efficiency, upset hits, consistency) — no follower count anywhere.

## Privacy enforcement

A single `toPublicConviction(trade)` helper returns ONLY `{ contract, side, roiPct }`. No component may read `size`, `leverage`, `liqPrice`, `margin`, `equity` from a public-conviction object — enforced by TypeScript types (`PublicConviction` is a distinct exported type with no other fields).

## Post state machine

`PostState = derived(post.contract, matchEngine.state(post.contract))`:
- `PRE_MATCH` → show countdown to kickoff
- `LIVE` → show match clock, live price, live ROI on attachments
- `FINAL` → show final score, settled ROI, accuracy verdict (✓/✗) for reputation

## Visual system

- Stays inside existing dark institutional palette (browns/gold/white/green semantic tokens). No new ad-hoc colors.
- Mono font for prices/ROI/clocks (already set up). Dense rows, subtle dividers, no shadows-as-glow, no emojis in UI.
- Status chips: PRE-MATCH (muted), LIVE (accent green pulse — single subtle dot, not flashy), FINAL (muted gold).

## Routing

- New routes: `/scl` (overview), `/scl/:contract` (hub detail). Existing `/` terminal unchanged; add an "Open in SCL" link from the contract header.

## Out of scope (v1)

- No real-time multi-user backend. Posts are local + optionally persisted to the existing `trading_sessions` IP-keyed row (new `social_posts` JSON column via migration). All "other users" posts are deterministic seeded NPC voices generated from the match engine — labeled clearly as simulated participants in a tooltip on the hub.
- No DMs, no follows, no likes-as-engagement. Reactions limited to `Agree / Disagree / Fade` which feed reputation only.

## Database change

One migration: add `social_posts jsonb default '[]'` to `trading_sessions`. NPC posts stay client-side (deterministic from seed) so they don't bloat storage.

## Build order

1. Add `social_posts` column (migration).
2. Build `social-store`, `contract-router`, post types, privacy helper.
3. Build `SCLLayout` + `HubList` + routes.
4. Build `HubDetail` composing existing chart/orderbook + new panels.
5. Build `PostComposer` + `PostCard` + state machine.
6. Build `ConvictionAttachDialog` (2-stage) + `ConvictionBadge` (live ROI).
7. Build `ReputationPanel` + NPC seed voices reacting to engine events.
8. Wire nav link from existing terminal → SCL hub for the active contract.

After approval I'll run the migration first, then implement in the order above.