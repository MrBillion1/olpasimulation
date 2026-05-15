// ============= Shared Simulation Store =============
// Singleton store powering both the Trading Terminal and the Social Conviction Layer.
// Owns: market runtimes, clock, auto-event loop, trades, social posts, reputation.
// Both pages subscribe via React's useSyncExternalStore for synchronous updates.

import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType, MarketConfig,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META, getEventSentiment,
  MARKETS, pickTeam,
} from '@/lib/match-engine';

export interface PricePoint {
  minute: number;
  price: number;
  event?: string;
  team?: 'home' | 'away';
}

export interface MarketRuntime {
  state: MatchState;
  priceHistory: PricePoint[];
  currentPrice: number;
  lastDirection: number;
  eventCounter: number;
  // Pricing transition log: deterministic re-pricing decisions ("Reality repriced the market")
  pricingTransitions: PricingTransition[];
}

export interface PricingTransition {
  id: string;
  minute: number;
  fromPrice: number;
  toPrice: number;
  trigger: string; // event type
  rationale: string;
  weight: number;
  team: 'home' | 'away';
  ts: number;
}

export interface OpenTrade {
  id: number;
  marketId: string;
  contract: string;
  direction: 'long' | 'short';
  entryPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  minute: number;
  liquidationPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  marginMode: 'cross' | 'isolated';
}

export interface ClosedTrade {
  id: number;
  contract: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  pnl: number;
  reason: 'manual' | 'liquidated' | 'expired' | 'counter-closed' | 'stop-loss' | 'take-profit' | 'limit-filled';
}

export interface LimitOrder {
  id: number;
  marketId: string;
  contract: string;
  direction: 'long' | 'short';
  limitPrice: number;
  size: number;
  leverage: number;
  timestamp: number;
  stopLoss: number | null;
  takeProfit: number | null;
  marginMode: 'cross' | 'isolated';
}

// ────────── Social Conviction Layer types ──────────

export type Reaction = 'agree' | 'disagree' | 'fade';

export interface PublicConviction {
  // STRICT: only these fields ever leave the privacy boundary.
  contract: string;
  marketId: string;
  side: 'long' | 'short';
  entryPrice: number;
  // ROI is recomputed live from current price, never stored stale
}

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  isNpc: boolean;
  isSelf: boolean;
  marketId: string;       // contract hub the post belongs to (auto-routed)
  contract: string;
  body: string;
  createdAt: number;
  matchMinuteAtPost: number; // for FINAL-state verdicts
  priceAtPost: number;
  // optional attached conviction — references a trade id owned by the author
  conviction?: PublicConviction & { tradeId: number };
  reactions: Record<Reaction, number>;
  // settled accuracy verdict (set when match ends if conviction attached)
  verdict?: 'correct' | 'incorrect' | 'flat';
  // structural session marker (rendered as a divider, not a normal post)
  kind?: 'normal' | 'session-end' | 'session-start';
}

export interface ReputationEntry {
  authorId: string;
  authorName: string;
  posts: number;
  withConviction: number;
  correct: number;
  incorrect: number;
  totalRoiPct: number; // sum of settled roi
  avgRoiPct: number;
  accuracy: number;    // correct / withConviction
  upsetHits: number;   // correct calls against prevailing direction
  consistency: number; // 0–1 derived from variance of settled roi
}

interface State {
  runtimes: Record<string, MarketRuntime>;
  balance: number;
  openTrades: OpenTrade[];
  closedTrades: ClosedTrade[];
  limitOrders: LimitOrder[];
  posts: SocialPost[];
  // tracks last event index processed per market for npc voice generation
  npcCursors: Record<string, number>;
  // when true, completed contracts auto-restart for continuous live feed
  autoMode: boolean;
}

// ────────── Helpers ──────────

function createRuntime(config: MarketConfig): MarketRuntime {
  return {
    state: createInitialState(),
    priceHistory: [{ minute: 0, price: config.startPrice }],
    currentPrice: config.startPrice,
    lastDirection: 0,
    eventCounter: 0,
    pricingTransitions: [],
  };
}

const initial: State = {
  runtimes: Object.fromEntries(MARKETS.map(m => [m.id, createRuntime(m)])),
  balance: 10000,
  openTrades: [],
  closedTrades: [],
  limitOrders: [],
  posts: [],
  npcCursors: Object.fromEntries(MARKETS.map(m => [m.id, 0])),
  autoMode: false,
};

let state: State = initial;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }

export function getState(): State { return state; }

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function setState(updater: (s: State) => State) {
  state = updater(state);
  notify();
}

// ────────── Public mutators (mirror Index.tsx behavior) ──────────

export const actions = {
  setBalance(v: number | ((b: number) => number)) {
    setState(s => ({ ...s, balance: typeof v === 'function' ? (v as (b: number) => number)(s.balance) : v }));
  },
  setOpenTrades(v: OpenTrade[] | ((t: OpenTrade[]) => OpenTrade[])) {
    setState(s => {
      const next = typeof v === 'function' ? (v as (t: OpenTrade[]) => OpenTrade[])(s.openTrades) : v;
      if (next === s.openTrades) return s;
      return { ...s, openTrades: next };
    });
  },
  setClosedTrades(v: ClosedTrade[] | ((t: ClosedTrade[]) => ClosedTrade[])) {
    setState(s => ({ ...s, closedTrades: typeof v === 'function' ? (v as (t: ClosedTrade[]) => ClosedTrade[])(s.closedTrades) : v }));
  },
  setLimitOrders(v: LimitOrder[] | ((t: LimitOrder[]) => LimitOrder[])) {
    setState(s => ({ ...s, limitOrders: typeof v === 'function' ? (v as (t: LimitOrder[]) => LimitOrder[])(s.limitOrders) : v }));
  },
  hydrate(payload: { balance?: number; openTrades?: OpenTrade[]; closedTrades?: ClosedTrade[]; limitOrders?: LimitOrder[]; posts?: SocialPost[] }) {
    setState(s => ({
      ...s,
      balance: payload.balance ?? s.balance,
      openTrades: payload.openTrades ?? s.openTrades,
      closedTrades: payload.closedTrades ?? s.closedTrades,
      limitOrders: payload.limitOrders ?? s.limitOrders,
      posts: payload.posts ?? s.posts,
    }));
  },
  startAll() {
    setState(s => {
      const next = { ...s.runtimes };
      MARKETS.forEach(m => {
        if (next[m.id].state.minute >= 90) next[m.id] = createRuntime(m);
        next[m.id] = { ...next[m.id], state: { ...next[m.id].state, isRunning: true } };
      });
      return { ...s, runtimes: next };
    });
  },
  startMarket(marketId: string) {
    setState(s => {
      const m = MARKETS.find(x => x.id === marketId);
      if (!m) return s;
      const next = { ...s.runtimes };
      if (next[marketId].state.minute >= 90) next[marketId] = createRuntime(m);
      next[marketId] = { ...next[marketId], state: { ...next[marketId].state, isRunning: true } };
      return { ...s, runtimes: next };
    });
  },
  // Add a user-authored or NPC post; auto-routes to the market hub.
  addPost(post: Omit<SocialPost, 'id' | 'createdAt' | 'reactions'> & { id?: string; createdAt?: number }) {
    setState(s => {
      const id = post.id ?? `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPost: SocialPost = {
        id,
        createdAt: post.createdAt ?? Date.now(),
        reactions: { agree: 0, disagree: 0, fade: 0 },
        ...post,
      };
      return { ...s, posts: [newPost, ...s.posts].slice(0, 500) };
    });
  },
  detachConviction(postId: string) {
    setState(s => ({
      ...s,
      posts: s.posts.map(p => p.id === postId ? { ...p, conviction: undefined } : p),
    }));
  },
  editPost(postId: string, body: string) {
    setState(s => ({
      ...s,
      posts: s.posts.map(p => p.id === postId && p.isSelf ? { ...p, body } : p),
    }));
  },
  deletePost(postId: string) {
    setState(s => ({
      ...s,
      posts: s.posts.filter(p => !(p.id === postId && p.isSelf)),
    }));
  },
  react(postId: string, r: Reaction) {
    setState(s => ({
      ...s,
      posts: s.posts.map(p => p.id === postId
        ? { ...p, reactions: { ...p.reactions, [r]: p.reactions[r] + 1 } }
        : p),
    }));
  },
};

// ────────── Clock & event-engine (singleton) ──────────

let clockInterval: ReturnType<typeof setInterval> | null = null;
let eventTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function fireEventInternal(marketId: string) {
  setState(s => {
    const rt = s.runtimes[marketId];
    const market = MARKETS.find(m => m.id === marketId);
    if (!rt || !market || rt.state.varActive) return s;

    const eventType = pickRandomEvent(market.scenario, rt.state.minute);
    const eventZone = rt.state.isRunning ? pickRandomZone() : rt.state.selectedZone;
    const eventSig = pickRandomSignificance(eventType);
    const weight = calculateWeight(eventType, eventZone, eventSig, rt.state.minute);
    const team = pickTeam(market.scenario);
    const meta = EVENT_META[eventType];

    const newCounter = rt.eventCounter + 1;
    const ev: MatchEvent = {
      id: `${marketId}-evt-${newCounter}`,
      type: eventType, zone: eventZone, significance: eventSig,
      minute: rt.state.minute, weight, team,
      description: getSignificanceDescription(eventSig, weight.final),
      impact: meta.impact, emoji: meta.emoji,
    };

    const momentumDelta = team === 'home' ? weight.final * 0.05 : -weight.final * 0.05;
    const newMomentum = Math.max(-1, Math.min(1, rt.state.momentum + momentumDelta));

    let homeScore = rt.state.homeScore;
    let awayScore = rt.state.awayScore;
    if (eventType === 'Goal') { if (team === 'home') homeScore++; else awayScore++; }
    if (eventType === 'Own Goal') { if (team === 'home') awayScore++; else homeScore++; }
    if (eventType === 'Penalty' && Math.random() < weight.final * 0.7) {
      if (team === 'home') homeScore++; else awayScore++;
    }

    let varActive = false;
    let varMinutesLeft = 0;
    if (meta.impact === 'high' && Math.random() < 0.12) {
      varActive = true;
      varMinutesLeft = 2 + Math.floor(Math.random() * 3);
    }

    const sentiment = getEventSentiment(eventType);
    const impactMultiplier = meta.impact === 'high' ? 0.08 : meta.impact === 'medium' ? 0.03 : 0.008;
    const priceMove = weight.final * impactMultiplier * (0.5 + Math.random() * 0.5);

    let direction = 0;
    if (sentiment === 'positive') direction = team === 'home' ? 1 : -1;
    else if (sentiment === 'negative') direction = team === 'home' ? -1 : 1;
    else direction = Math.random() > 0.5 ? 0.3 : -0.3;

    const newPrice = Math.max(0.10, Math.round((rt.currentPrice + priceMove * direction) * 10000) / 10000);
    const newHistory = [...rt.priceHistory, { minute: rt.state.minute, price: newPrice, event: eventType, team }];

    const events = [...rt.state.events, ev];
    if (varActive) {
      const varEv: MatchEvent = {
        id: `${marketId}-var-${newCounter}`,
        type: 'VAR Review', zone: eventZone, significance: 'VAR halt — Penda mode active',
        minute: rt.state.minute,
        weight: calculateWeight('VAR Review', eventZone, 'VAR halt — Penda mode active', rt.state.minute),
        team, description: '⏸ Match halted for VAR review — Penda adaptive mode active. All markets frozen.',
        impact: 'high', emoji: '📺',
      };
      events.push(varEv);
    }

    // Pricing transition log (only material moves: medium/high impact OR significant price delta)
    const pricingTransitions = [...rt.pricingTransitions];
    if (meta.impact !== 'low' || Math.abs(newPrice - rt.currentPrice) > 0.01) {
      pricingTransitions.push({
        id: `tx-${marketId}-${newCounter}`,
        minute: rt.state.minute,
        fromPrice: rt.currentPrice,
        toPrice: newPrice,
        trigger: eventType,
        rationale: ev.description,
        weight: weight.final,
        team,
        ts: Date.now(),
      });
      if (pricingTransitions.length > 40) pricingTransitions.shift();
    }

    return {
      ...s,
      runtimes: {
        ...s.runtimes,
        [marketId]: {
          state: {
            ...rt.state, events, momentum: newMomentum,
            homeScore, awayScore, selectedZone: eventZone,
            varActive, varMinutesLeft,
          },
          priceHistory: newHistory,
          currentPrice: newPrice,
          lastDirection: direction,
          eventCounter: newCounter,
          pricingTransitions,
        },
      },
    };
  });
}

function tick() {
  setState(s => {
    const next = { ...s.runtimes };
    let changed = false;
    MARKETS.forEach(m => {
      const rt = next[m.id];
      if (!rt.state.isRunning) return;
      if (rt.state.varActive) {
        if (rt.state.varMinutesLeft <= 1) {
          next[m.id] = { ...rt, state: { ...rt.state, varActive: false, varMinutesLeft: 0 } };
        } else {
          next[m.id] = { ...rt, state: { ...rt.state, varMinutesLeft: rt.state.varMinutesLeft - 1 } };
        }
        changed = true;
        return;
      }
      const nextMin = rt.state.minute + 1;
      if (nextMin > 90) {
        next[m.id] = { ...rt, state: { ...rt.state, isRunning: false } };
      } else {
        next[m.id] = { ...rt, state: { ...rt.state, minute: nextMin, half: nextMin > 45 ? 2 : 1 } };
      }
      changed = true;
    });
    return changed ? { ...s, runtimes: next } : s;
  });
}

// auto-event scheduler: re-runs whenever state updates
function reschedule() {
  Object.values(eventTimers).forEach(t => clearTimeout(t));
  eventTimers = {};
  const s = getState();
  MARKETS.forEach(m => {
    const rt = s.runtimes[m.id];
    if (rt.state.isRunning && !rt.state.varActive) {
      const delay = 400 + Math.random() * 667;
      eventTimers[m.id] = setTimeout(() => fireEventInternal(m.id), delay);
    }
  });
}

let started = false;
export function startEngine() {
  if (started) return;
  started = true;
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(tick, 1667);
  // event scheduler reacts to state changes (event count & isRunning)
  let prevSig = '';
  subscribe(() => {
    const s = getState();
    const sig = MARKETS.map(m => `${s.runtimes[m.id].state.events.length}:${s.runtimes[m.id].state.isRunning ? 1 : 0}:${s.runtimes[m.id].state.varActive ? 1 : 0}`).join('|');
    if (sig !== prevSig) {
      prevSig = sig;
      reschedule();
    }
  });
  reschedule();
}

// auto-execute limit orders + liquidations: piggybacks on subscribe
let prevPriceSig = '';
subscribe(() => {
  const s = getState();
  const priceSig = MARKETS.map(m => s.runtimes[m.id].currentPrice).join('|');
  if (priceSig === prevPriceSig) return;
  prevPriceSig = priceSig;

  // Limit order fills
  if (s.limitOrders.length > 0) {
    const remaining: LimitOrder[] = [];
    const toFill: LimitOrder[] = [];
    s.limitOrders.forEach(o => {
      const p = s.runtimes[o.marketId]?.currentPrice;
      if (p == null) { remaining.push(o); return; }
      const ok = o.direction === 'long' ? p <= o.limitPrice : p >= o.limitPrice;
      if (ok) toFill.push(o); else remaining.push(o);
    });
    if (toFill.length > 0) {
      const newTrades: OpenTrade[] = toFill.map(o => {
        const liq = o.direction === 'long'
          ? Math.round(o.limitPrice * (1 - 1 / o.leverage) * 10000) / 10000
          : Math.round(o.limitPrice * (1 + 1 / o.leverage) * 10000) / 10000;
        return {
          id: o.id, marketId: o.marketId, contract: o.contract, direction: o.direction,
          entryPrice: o.limitPrice, size: o.size, leverage: o.leverage,
          timestamp: Date.now(), minute: s.runtimes[o.marketId]?.state.minute ?? 0,
          liquidationPrice: liq, stopLoss: o.stopLoss, takeProfit: o.takeProfit, marginMode: o.marginMode,
        };
      });
      setState(cur => ({
        ...cur,
        limitOrders: remaining,
        openTrades: [...newTrades, ...cur.openTrades],
      }));
    }
  }
});
