// Pure portfolio math — leverage-weighted allocation, exposure, payout, health.

export type Direction = 'long' | 'short';

export interface DraftContract {
  contractId: string;        // market id
  contract: string;          // ticker
  direction: Direction;
  leverage: number;
  tpPct: number;             // e.g. 50 → +50% on exposure
  slPct: number;             // e.g. 10 → -10% on exposure
}

export interface PortfolioContract extends DraftContract {
  entryPrice: number;
  marginAlloc: number;       // dollar margin
  exposure: number;          // dollar notional
  status: 'active' | 'tp' | 'sl' | 'expired' | 'closed';
  realizedPnl: number;       // dollars
  closedAt?: number;
  exitPrice?: number;
}

export interface PortfolioComputed {
  totalLeverageSum: number;
  weights: number[];
  margins: number[];
  exposures: number[];
  totalExposure: number;
  effectiveLeverage: number;
  targetPayout: number;        // sum of exposure_i * tp_i
  maxDrawdown: number;         // sum of exposure_i * sl_i
  rewardRisk: number;          // target / max
  convictionScore: number;     // synthetic 0-100
  riskScore: number;           // synthetic 0-100
}

export function computeDraft(
  contracts: DraftContract[],
  portfolioMargin: number,
): PortfolioComputed {
  const n = contracts.length;
  if (n === 0 || portfolioMargin <= 0) {
    return {
      totalLeverageSum: 0, weights: [], margins: [], exposures: [],
      totalExposure: 0, effectiveLeverage: 0,
      targetPayout: 0, maxDrawdown: 0, rewardRisk: 0,
      convictionScore: 0, riskScore: 0,
    };
  }

  const totalLev = contracts.reduce((s, c) => s + c.leverage, 0);
  const weights = contracts.map(c => c.leverage / totalLev);
  const margins = weights.map(w => portfolioMargin * w);
  const exposures = contracts.map((c, i) => margins[i] * c.leverage);
  const totalExposure = exposures.reduce((s, x) => s + x, 0);
  const effectiveLeverage = totalExposure / portfolioMargin;

  const targetPayout = contracts.reduce(
    (s, c, i) => s + exposures[i] * (c.tpPct / 100), 0);
  const maxDrawdown = contracts.reduce(
    (s, c, i) => s + exposures[i] * (c.slPct / 100), 0);
  const rewardRisk = maxDrawdown > 0 ? targetPayout / maxDrawdown : 0;

  const avgLev = totalLev / n;
  const convictionScore = Math.min(100, Math.round((avgLev * n) / 5 * 25));
  const riskScore = Math.min(100, Math.round((effectiveLeverage / 20) * 100));

  return {
    totalLeverageSum: totalLev, weights, margins, exposures,
    totalExposure, effectiveLeverage,
    targetPayout, maxDrawdown, rewardRisk,
    convictionScore, riskScore,
  };
}

// Per-contract live PnL from a mark price.
export function contractPnl(
  c: PortfolioContract,
  markPrice: number,
): number {
  if (c.status !== 'active') return c.realizedPnl;
  const dir = c.direction === 'long' ? 1 : -1;
  const pctMove = ((markPrice - c.entryPrice) / c.entryPrice) * dir;
  return Math.round(pctMove * c.exposure * 100) / 100;
}

// Tests whether a TP/SL trigger fires given a mark price.
export function checkTrigger(
  c: PortfolioContract,
  markPrice: number,
): { hit: 'tp' | 'sl' | null; exitPrice: number; pnl: number } {
  const dir = c.direction === 'long' ? 1 : -1;
  const pctMove = ((markPrice - c.entryPrice) / c.entryPrice) * dir; // signed pct
  if (pctMove >= c.tpPct / 100) {
    const pnl = Math.round((c.tpPct / 100) * c.exposure * 100) / 100;
    return { hit: 'tp', exitPrice: markPrice, pnl };
  }
  if (pctMove <= -c.slPct / 100) {
    const pnl = -Math.round((c.slPct / 100) * c.exposure * 100) / 100;
    return { hit: 'sl', exitPrice: markPrice, pnl };
  }
  return { hit: null, exitPrice: markPrice, pnl: contractPnl(c, markPrice) };
}
