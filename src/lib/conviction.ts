// Strict privacy boundary for Proof-of-Conviction.
// Only the fields exported in PublicConviction may ever leave this module
// when rendering a position attached to a public post.

import type { OpenTrade } from '@/lib/simulation-store';

export interface PublicConvictionView {
  contract: string;
  marketId: string;
  side: 'long' | 'short';
  entryPrice: number;
  // tradeId kept ONLY to recompute live ROI from current price; never displayed as size/leverage info
  tradeId: number;
}

// Convert an OpenTrade into the strict public view. Strips: size, leverage,
// liquidationPrice, stopLoss, takeProfit, marginMode, timestamp, minute.
export function toPublicConviction(trade: OpenTrade): PublicConvictionView {
  return {
    contract: trade.contract,
    marketId: trade.marketId,
    side: trade.direction,
    entryPrice: trade.entryPrice,
    tradeId: trade.id,
  };
}

// Compute ROI percentage from public conviction + current mark price.
// IMPORTANT: this is the *unleveraged price-move ROI* — leverage is intentionally
// hidden, so amplified PnL never leaks. Spectators see honest directional accuracy.
export function computeRoiPct(view: { entryPrice: number; side: 'long' | 'short' }, currentPrice: number): number {
  if (!view.entryPrice) return 0;
  const dir = view.side === 'long' ? 1 : -1;
  return ((currentPrice - view.entryPrice) / view.entryPrice) * 100 * dir;
}
