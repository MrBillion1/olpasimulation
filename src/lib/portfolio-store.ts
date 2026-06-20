// Portfolio store — singleton, separate from simulation-store but listens to it.
// Owns active portfolios, equity history, and per-contract settlement.

import {
  getState as getSimState,
  subscribe as subSim,
  actions as simActions,
} from '@/lib/simulation-store';
import {
  PortfolioContract, DraftContract, contractPnl, checkTrigger, computeDraft,
} from '@/lib/portfolio-math';

export interface Portfolio {
  id: string;
  name: string;
  margin: number;                  // initial margin committed
  withdrawn: number;               // cumulative partial-close withdrawals
  contracts: PortfolioContract[];
  equityHistory: { t: number; equity: number }[];
  events: PortfolioEvent[];        // reality-injection log
  createdAt: number;
  sessionEndsAt: number;           // soonest contract session end
  status: 'active' | 'closed' | 'liquidated';
  closedAt?: number;
  finalEquity?: number;
  liquidationReason?: string;
}

export interface PortfolioEvent {
  t: number;
  kind: 'open' | 'reprice' | 'contract-tp' | 'contract-sl' | 'partial-close' | 'close' | 'liquidate';
  message: string;
  delta?: number;
}

interface PState {
  portfolios: Portfolio[];
}

let pstate: PState = { portfolios: [] };
const listeners = new Set<() => void>();

export function getPState(): PState { return pstate; }
export function subscribePortfolio(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify() { listeners.forEach(l => l()); }
function set(updater: (s: PState) => PState) {
  const next = updater(pstate);
  if (Object.is(next, pstate)) return;
  pstate = next;
  notify();
}

// ─── helpers ───────────────────────────────────────────────────────────

export function portfolioEquity(p: Portfolio, prices: Record<string, number>): number {
  const realized = p.contracts.reduce(
    (s, c) => c.status !== 'active' ? s + c.realizedPnl : s, 0);
  const unrealized = p.contracts.reduce((s, c) => {
    if (c.status !== 'active') return s;
    const mp = prices[c.contractId] ?? c.entryPrice;
    return s + contractPnl(c, mp);
  }, 0);
  return Math.round((p.margin + realized + unrealized - p.withdrawn) * 100) / 100;
}

export function portfolioMetrics(p: Portfolio, prices: Record<string, number>) {
  const equity = portfolioEquity(p, prices);
  const liveValue = equity; // alias
  const activeExposure = p.contracts.reduce(
    (s, c) => c.status === 'active' ? s + c.exposure : s, 0);
  const aggPnl = equity - (p.margin - p.withdrawn);
  const health = p.margin > 0 ? Math.max(0, Math.min(1, equity / p.margin)) : 0;
  const targetPayout = p.contracts.reduce(
    (s, c) => c.status === 'active' ? s + c.exposure * (c.tpPct / 100) : s, 0);
  const liqBuffer = Math.max(0, equity);
  const effLeverage = equity > 0 ? activeExposure / equity : 0;
  return {
    equity, liveValue, activeExposure, aggPnl, health,
    targetPayout, liqBuffer, effLeverage,
  };
}

// ─── public API ────────────────────────────────────────────────────────

export const portfolioActions = {
  open(name: string, margin: number, drafts: DraftContract[]): Portfolio | null {
    const sim = getSimState();
    if (sim.balance < margin || margin <= 0 || drafts.length === 0) return null;
    const calc = computeDraft(drafts, margin);

    const contracts: PortfolioContract[] = drafts.map((d, i) => {
      const rt = sim.runtimes[d.contractId];
      const entry = rt?.currentPrice ?? 0;
      return {
        ...d,
        entryPrice: entry,
        marginAlloc: Math.round(calc.margins[i] * 100) / 100,
        exposure: Math.round(calc.exposures[i] * 100) / 100,
        status: 'active',
        realizedPnl: 0,
      };
    });

    // soonest session end across all contracts
    const sessionEndsAt = Math.min(...drafts.map(d => {
      const rt = sim.runtimes[d.contractId];
      const minutesLeft = Math.max(0, 90 - (rt?.state.minute ?? 0));
      return Date.now() + minutesLeft * 1667;
    }));

    const p: Portfolio = {
      id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || 'Portfolio',
      margin,
      withdrawn: 0,
      contracts,
      equityHistory: [{ t: Date.now(), equity: margin }],
      events: [{
        t: Date.now(), kind: 'open',
        message: `Opened "${name}" · $${margin} margin · ${contracts.length} contracts`,
      }],
      createdAt: Date.now(),
      sessionEndsAt,
      status: 'active',
    };

    // Lock margin from shared account
    simActions.setBalance(b => Math.round((b - margin) * 100) / 100);
    set(s => ({ portfolios: [p, ...s.portfolios] }));
    return p;
  },

  partialClose(portfolioId: string, withdrawAmt: number, prices: Record<string, number>) {
    const p = pstate.portfolios.find(x => x.id === portfolioId);
    if (!p || p.status !== 'active') return;
    const m = portfolioMetrics(p, prices);
    const amt = Math.max(0, Math.min(withdrawAmt, m.equity));
    if (amt <= 0) return;

    simActions.setBalance(b => Math.round((b + amt) * 100) / 100);
    set(s => ({
      portfolios: s.portfolios.map(x => x.id !== portfolioId ? x : {
        ...x,
        withdrawn: Math.round((x.withdrawn + amt) * 100) / 100,
        events: [{
          t: Date.now(), kind: 'partial-close',
          message: `Withdrew $${amt.toFixed(2)} from portfolio`,
          delta: -amt,
        }, ...x.events].slice(0, 50),
      }),
    }));
  },

  closeAll(portfolioId: string, prices: Record<string, number>) {
    const p = pstate.portfolios.find(x => x.id === portfolioId);
    if (!p || p.status !== 'active') return;
    const equity = portfolioEquity(p, prices);
    simActions.setBalance(b => Math.round((b + Math.max(0, equity)) * 100) / 100);
    set(s => ({
      portfolios: s.portfolios.map(x => x.id !== portfolioId ? x : {
        ...x,
        status: 'closed', closedAt: Date.now(), finalEquity: equity,
        contracts: x.contracts.map(c => c.status === 'active'
          ? { ...c, status: 'closed', realizedPnl: contractPnl(c, prices[c.contractId] ?? c.entryPrice), exitPrice: prices[c.contractId] ?? c.entryPrice, closedAt: Date.now() }
          : c),
        events: [{
          t: Date.now(), kind: 'close',
          message: `Closed portfolio · final equity $${equity.toFixed(2)}`,
        }, ...x.events].slice(0, 50),
      }),
    }));
  },

  dismiss(portfolioId: string) {
    set(s => ({ portfolios: s.portfolios.filter(p => p.id !== portfolioId) }));
  },
};

// ─── settlement loop: triggered by sim store updates ──────────────────

let prevSig = '';
subSim(() => {
  const sim = getSimState();
  if (pstate.portfolios.length === 0) return;
  const sig = pstate.portfolios.map(p => p.id).join(',') + '|' +
    Object.values(sim.runtimes).map(r => `${r.currentPrice}:${r.state.minute}:${r.state.isRunning ? 1 : 0}`).join('|');
  if (sig === prevSig) return;
  prevSig = sig;

  const prices: Record<string, number> = {};
  Object.entries(sim.runtimes).forEach(([id, r]) => { prices[id] = r.currentPrice; });

  let mutated = false;
  let refund = 0;

  const nextPortfolios = pstate.portfolios.map(p => {
    if (p.status !== 'active') return p;

    let newEvents: PortfolioEvent[] = [];
    let contracts = p.contracts.map(c => {
      if (c.status !== 'active') return c;
      const rt = sim.runtimes[c.contractId];
      if (!rt) return c;
      const mp = rt.currentPrice;

      // Session expiry — settle at mark
      const sessionEnded = rt.state.minute >= 90 && !rt.state.isRunning;
      if (sessionEnded) {
        const pnl = contractPnl(c, mp);
        newEvents.push({
          t: Date.now(), kind: 'contract-tp',
          message: `${c.contract} session ended · settled ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
          delta: pnl,
        });
        mutated = true;
        return { ...c, status: 'expired' as const, realizedPnl: pnl, exitPrice: mp, closedAt: Date.now() };
      }

      const trig = checkTrigger(c, mp);
      if (trig.hit === 'tp') {
        newEvents.push({
          t: Date.now(), kind: 'contract-tp',
          message: `${c.contract} hit TP +${c.tpPct}% · +$${trig.pnl.toFixed(2)}`,
          delta: trig.pnl,
        });
        mutated = true;
        return { ...c, status: 'tp' as const, realizedPnl: trig.pnl, exitPrice: trig.exitPrice, closedAt: Date.now() };
      }
      if (trig.hit === 'sl') {
        newEvents.push({
          t: Date.now(), kind: 'contract-sl',
          message: `${c.contract} hit SL -${c.slPct}% · -$${Math.abs(trig.pnl).toFixed(2)}`,
          delta: trig.pnl,
        });
        mutated = true;
        return { ...c, status: 'sl' as const, realizedPnl: trig.pnl, exitPrice: trig.exitPrice, closedAt: Date.now() };
      }
      return c;
    });

    // Liquidation check
    const eqProbe: Portfolio = { ...p, contracts };
    let equity = portfolioEquity(eqProbe, prices);

    // Append equity history every ~3% drift OR every contract close
    const last = p.equityHistory[p.equityHistory.length - 1];
    if (newEvents.length > 0 || !last || Math.abs(equity - last.equity) / Math.max(1, last.equity) > 0.03) {
      mutated = true;
    }

    let status: Portfolio['status'] = p.status;
    let liquidationReason: string | undefined;
    let finalEquity: number | undefined;
    let closedAt: number | undefined;

    if (equity <= 0) {
      status = 'liquidated';
      liquidationReason = 'Insufficient remaining equity after repeated contract losses';
      finalEquity = 0;
      closedAt = Date.now();
      contracts = contracts.map(c => c.status === 'active'
        ? { ...c, status: 'closed' as const, realizedPnl: contractPnl(c, prices[c.contractId] ?? c.entryPrice), exitPrice: prices[c.contractId] ?? c.entryPrice, closedAt: Date.now() }
        : c);
      newEvents.push({
        t: Date.now(), kind: 'liquidate',
        message: 'Portfolio liquidated — equity reached zero',
      });
      mutated = true;
    } else {
      // All contracts closed and not yet finalized → close out and return equity
      const allDone = contracts.every(c => c.status !== 'active');
      if (allDone) {
        status = 'closed';
        finalEquity = equity;
        closedAt = Date.now();
        refund += Math.max(0, equity);
        newEvents.push({
          t: Date.now(), kind: 'close',
          message: `All contracts settled · final equity $${equity.toFixed(2)}`,
        });
        mutated = true;
      }
    }

    return {
      ...p,
      contracts,
      status,
      finalEquity,
      closedAt,
      liquidationReason,
      equityHistory: mutated
        ? [...p.equityHistory, { t: Date.now(), equity }].slice(-30)
        : p.equityHistory,
      events: newEvents.length > 0
        ? [...newEvents.reverse(), ...p.events].slice(0, 50)
        : p.events,
    };
  });

  if (mutated) {
    if (refund > 0) simActions.setBalance(b => Math.round((b + refund) * 100) / 100);
    set(() => ({ portfolios: nextPortfolios }));
  }
});
