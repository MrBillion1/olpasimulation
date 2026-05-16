
# Global Live Conviction Feed

Turn the SCL feed into a single market-wide stream. Every hub page shows the same feed; posts auto-map to contracts via text detection; NPCs post about every running contract continuously; composer loses its contract chip.

---

## 1. Composer simplification (`src/components/scl/PostComposer.tsx`)

- Remove the `MCIMUN/USDT` (active contract) chip/selector entirely.
- Keep only: textarea, **Attach Live Position** button, **Post** button.
- On submit, run the body through `detectContract()` from `src/lib/contract-router.ts`:
  - If a contract is matched → tag the post with that `contractId` so `PostCard` renders the live ticker/state/price/ROI badge.
  - If nothing matches → post as a plain market thought (no ticker badge, no price sync). `PostCard` already tolerates a missing contract; we'll confirm the empty-badge path.
- Attach-position flow unchanged: the attached position itself carries its contract, and the conviction badge still syncs price + ROI live.

## 2. Global feed everywhere (`src/pages/SCLHub.tsx` + `src/pages/SCL.tsx`)

- Today `SCLHub` filters posts by the hub's `contractId`. Remove that filter — both pages render the full `posts` array from the store.
- Hub pages keep their per-contract panels (chart, computed pricing, H2H, AI analysis, order book) on top; the feed below is identical across all hubs and the main `/scl` page.
- Single shared `<FeedPanel>` component extracted from the current hub layout so both routes render the same list and composer (DRY; ensures parity).

## 3. Multi-contract NPC stream (`src/lib/simulation-store.ts` + `src/lib/npc-voices.ts`)

Current behavior: NPC posts are generated only for whichever runtime is "focused." New behavior:

- The store's tick loop already advances **every** market's runtime. Extend the NPC emitter so on each tick, for every running contract, it probabilistically emits an AI post tagged with that contract's id.
- Each NPC post pulls live state for its own contract (minute, score, last event, current price, momentum) so the body reads correctly even though the user may be looking at a different hub.
- Throttle per-contract independently (e.g., min 8–15s gap per contract, jittered) so 6 contracts running simultaneously don't flood the feed. Combined with a global cap (e.g., max 1 NPC post per 2s across all contracts) to keep the feed readable.
- Session-end / session-start divider posts already work per contract — keep as is.

## 4. PostCard (`src/components/scl/PostCard.tsx`)

- No structural changes. It already resolves `contractId` → live runtime → price/state/ROI. Just verify it renders cleanly when `contractId` is null (plain post, no badge).

## 5. Routing/nav

- Hub selector at the top of `/scl/:id` remains as a quick way to switch the *info panels* above the feed. Feed is no longer affected by which hub is active.

---

## Technical notes

- `detectContract` is already alias-aware (team names, derby monikers, tickers) — no changes needed.
- Store actions touched: `addPost` (accept optional `contractId`), `tickNpcPosts` (iterate all runtimes instead of one).
- No schema/Supabase changes. Pure client/state work.
- No new dependencies.

## Out of scope

- Per-user feed filters (e.g., "show only ACMINT") — can be added later as a client-side filter pill row above the feed if you want.
- Notifications when a post you wrote references a contract whose state changes.

---

Confirm and I'll implement.
