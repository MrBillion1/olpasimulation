import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType, MarketConfig,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META, getEventSentiment,
  MARKETS, pickTeam,
} from '@/lib/match-engine';
import EventFeed from '@/components/EventFeed';
import AnimatedPitch from '@/components/AnimatedPitch';
import TradePanel, { OpenTrade, ClosedTrade, LimitOrder } from '@/components/TradePanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';
import OrderBook from '@/components/OrderBook';
import { supabase } from '@/integrations/supabase/client';

interface PricePoint {
  minute: number;
  price: number;
  event?: string;
  team?: 'home' | 'away';
}

interface MarketRuntime {
  state: MatchState;
  priceHistory: PricePoint[];
  currentPrice: number;
  lastDirection: number;
  eventCounter: number;
}

function createRuntime(config: MarketConfig): MarketRuntime {
  return {
    state: createInitialState(),
    priceHistory: [{ minute: 0, price: config.startPrice }],
    currentPrice: config.startPrice,
    lastDirection: 0,
    eventCounter: 0,
  };
}

type ViewMode = 'events' | 'trade';
type EventTab = 'live' | 'simulation' | 'commentary' | 'scores' | 'possession';
type PositionTab = 'positions' | 'open-orders' | 'trade-history' | 'order-history';

export default function Index() {
  const [activeMarketId, setActiveMarketId] = useState(MARKETS[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [eventTab, setEventTab] = useState<EventTab>('live');
  const [positionTab, setPositionTab] = useState<PositionTab>('positions');
  const [runtimes, setRuntimes] = useState<Record<string, MarketRuntime>>(() => {
    const r: Record<string, MarketRuntime> = {};
    MARKETS.forEach(m => { r[m.id] = createRuntime(m); });
    return r;
  });

  const [balance, setBalance] = useState(10000);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);

  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trading state from backend on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('trading-session', {
          method: 'GET',
        });
        if (!error && data && !data.isNew) {
          setBalance(data.balance);
          setOpenTrades(data.openTrades || []);
          setClosedTrades(data.closedTrades || []);
          setLimitOrders(data.limitOrders || []);
        }
      } catch (e) {
        console.warn('Failed to load trading session:', e);
      }
      setStateLoaded(true);
    };
    loadState();
  }, []);

  // Save trading state to backend (debounced)
  const saveState = useCallback((bal: number, open: OpenTrade[], closed: ClosedTrade[], limits: LimitOrder[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.functions.invoke('trading-session', {
          method: 'POST',
          body: {
            balance: bal,
            openTrades: open,
            closedTrades: closed,
            limitOrders: limits,
          },
        });
      } catch (e) {
        console.warn('Failed to save trading session:', e);
      }
    }, 1000);
  }, []);

  // Trigger save whenever trading state changes
  useEffect(() => {
    if (!stateLoaded) return;
    saveState(balance, openTrades, closedTrades, limitOrders);
  }, [balance, openTrades, closedTrades, limitOrders, stateLoaded, saveState]);

  const activeMarket = MARKETS.find(m => m.id === activeMarketId)!;
  const activeRuntime = runtimes[activeMarketId];

  // Clock tick
  useEffect(() => {
    clockRef.current = setInterval(() => {
      setRuntimes(prev => {
        const next = { ...prev };
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
        return changed ? next : prev;
      });
    }, 1667);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  const fireEvent = useCallback((marketId: string, type?: EventType, zone?: ZoneId, sig?: SignificanceType) => {
    setRuntimes(prev => {
      const rt = prev[marketId];
      const market = MARKETS.find(m => m.id === marketId)!;
      if (!rt || rt.state.varActive) return prev;

      const eventType = type ?? pickRandomEvent(market.scenario, rt.state.minute);
      const eventZone = zone ?? (rt.state.isRunning ? pickRandomZone() : rt.state.selectedZone);
      const eventSig = sig ?? pickRandomSignificance(eventType);
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
      if (sentiment === 'positive') {
        direction = team === 'home' ? 1 : -1;
      } else if (sentiment === 'negative') {
        direction = team === 'home' ? -1 : 1;
      } else {
        direction = Math.random() > 0.5 ? 0.3 : -0.3;
      }

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

      return {
        ...prev,
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
        },
      };
    });
  }, []);

  // Auto-play
  useEffect(() => {
    MARKETS.forEach(m => {
      const rt = runtimes[m.id];
      if (rt.state.isRunning && !rt.state.varActive) {
        const delay = 400 + Math.random() * 667;
        eventTimers.current[m.id] = setTimeout(() => fireEvent(m.id), delay);
      }
    });
    return () => {
      Object.values(eventTimers.current).forEach(t => clearTimeout(t));
      eventTimers.current = {};
    };
  }, [
    ...MARKETS.map(m => runtimes[m.id]?.state.events.length),
    ...MARKETS.map(m => runtimes[m.id]?.state.isRunning),
    ...MARKETS.map(m => runtimes[m.id]?.state.varActive),
    fireEvent,
  ]);

  const latestEvent = activeRuntime.state.events[activeRuntime.state.events.length - 1];

  const prices: Record<string, number> = {};
  const priceChanges: Record<string, number> = {};
  const matchMinutes: Record<string, number> = {};
  const isRunningMap: Record<string, boolean> = {};
  const latestEvents: Record<string, MatchEvent | undefined> = {};
  const allEvents: Record<string, MatchEvent[]> = {};
  MARKETS.forEach(m => {
    const rt = runtimes[m.id];
    prices[m.id] = rt.currentPrice;
    priceChanges[m.id] = rt.currentPrice - m.startPrice;
    matchMinutes[m.id] = rt.state.minute;
    isRunningMap[m.id] = rt.state.isRunning;
    latestEvents[m.id] = rt.state.events[rt.state.events.length - 1];
    allEvents[m.id] = rt.state.events;
  });

  // Limit order execution
  useEffect(() => {
    if (limitOrders.length === 0) return;
    setLimitOrders(prev => {
      const remaining: LimitOrder[] = [];
      const toExecute: LimitOrder[] = [];
      prev.forEach(order => {
        const mPrice = prices[order.marketId];
        if (!mPrice) { remaining.push(order); return; }
        const shouldFill = order.direction === 'long'
          ? mPrice <= order.limitPrice
          : mPrice >= order.limitPrice;
        if (shouldFill) {
          toExecute.push(order);
        } else {
          remaining.push(order);
        }
      });
      if (toExecute.length > 0) {
        toExecute.forEach(order => {
          const liqPrice = order.direction === 'long'
            ? Math.round(order.limitPrice * (1 - 1 / order.leverage) * 10000) / 10000
            : Math.round(order.limitPrice * (1 + 1 / order.leverage) * 10000) / 10000;
          const trade: OpenTrade = {
            id: order.id,
            marketId: order.marketId,
            contract: order.contract,
            direction: order.direction,
            entryPrice: order.limitPrice,
            size: order.size,
            leverage: order.leverage,
            timestamp: Date.now(),
            minute: runtimes[order.marketId]?.state.minute ?? 0,
            liquidationPrice: liqPrice,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
            marginMode: order.marginMode,
          };
          setOpenTrades(t => [trade, ...t]);
        });
      }
      return remaining;
    });
  }, [prices]);

  const startAll = () => {
    setRuntimes(prev => {
      const next = { ...prev };
      MARKETS.forEach(m => {
        if (next[m.id].state.minute >= 90) {
          next[m.id] = createRuntime(m);
        }
        next[m.id] = { ...next[m.id], state: { ...next[m.id].state, isRunning: true } };
      });
      return next;
    });
  };

  const cancelLimitOrder = (orderId: number) => {
    const order = limitOrders.find(o => o.id === orderId);
    if (order) {
      setBalance(b => Math.round((b + order.size) * 100) / 100);
    }
    setLimitOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const matchStates = Object.fromEntries(MARKETS.map(m => [m.id, { isRunning: runtimes[m.id].state.isRunning, minute: runtimes[m.id].state.minute }]));

  const scoresData = MARKETS.map(m => {
    const rt = runtimes[m.id];
    const goals = rt.state.events.filter(e => e.type === 'Goal' || e.type === 'Penalty' || e.type === 'Own Goal');
    const cards = rt.state.events.filter(e => e.type === 'Yellow Card' || e.type === 'Red Card');
    const shots = rt.state.events.filter(e => e.type === 'Shot on Target');
    const lastEv = rt.state.events[rt.state.events.length - 1];
    return { market: m, rt, goals: goals.length, cards: cards.length, shots: shots.length, lastEv };
  });

  // Contract dropdown component (shared between views)
  const ContractDropdown = () => (
    <div className="relative">
      <button
        onClick={() => setContractDropdownOpen(!contractDropdownOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <span className="text-sm font-bold text-foreground tracking-wide">
          {activeMarket.contract}
        </span>
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform ${contractDropdownOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {contractDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContractDropdownOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl min-w-[280px] py-1 max-h-[400px] overflow-y-auto">
            {MARKETS.map(m => {
              const active = m.id === activeMarketId;
              const mPrice = prices[m.id] ?? m.startPrice;
              const mChange = priceChanges[m.id] ?? 0;
              const mChangePct = m.startPrice > 0 ? (mChange / m.startPrice * 100) : 0;
              const mIsUp = mChange >= 0;
              const mMinute = matchMinutes[m.id] ?? 0;
              const mRunning = isRunningMap[m.id] ?? false;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveMarketId(m.id); setContractDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                    active ? 'bg-secondary' : 'hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {mRunning && <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground">{m.contract}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        <span style={{ color: m.homeColor }}>{m.homeShort}</span>
                        <span className="mx-1 text-muted-foreground/40">vs</span>
                        <span style={{ color: m.awayColor }}>{m.awayShort}</span>
                        {mMinute > 0 && <span className="ml-2">{mMinute}'</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-black tabular-nums text-foreground">${mPrice.toFixed(4)}</div>
                    <div className={`font-mono text-[10px] font-bold ${mIsUp ? 'text-accent' : 'text-destructive'}`}>
                      {mIsUp ? '+' : ''}{mChangePct.toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // Stats bar (shared)
  const StatsBar = () => {
    const ms = matchStates[activeMarketId];
    const isLive = ms?.isRunning;
    const minute = ms?.minute ?? 0;
    const currentPrice = activeRuntime.currentPrice;
    const change = priceChanges[activeMarketId] ?? 0;
    const changePct = activeMarket.startPrice > 0 ? (change / activeMarket.startPrice * 100) : 0;
    const isUp = change >= 0;
    return (
      <div className="flex items-center gap-6 ml-6 text-[10px]">
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Price</div>
          <div className="font-mono text-sm font-black tabular-nums text-foreground">${currentPrice.toFixed(4)}</div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Change</div>
          <div className={`font-mono text-sm font-bold tabular-nums ${isUp ? 'text-accent' : 'text-destructive'}`}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Score</div>
          <div className="font-mono text-sm font-black tabular-nums text-foreground">
            {activeRuntime.state.homeScore} - {activeRuntime.state.awayScore}
          </div>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <div className="text-muted-foreground uppercase tracking-widest text-[8px]">Minutes</div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minute}'</span>
            {isLive && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-gold tracking-wider">ADVANCED MICRO-EVENT SIMULATION <span className="text-muted-foreground">·</span> OLPA DEX</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={startAll}
            className="text-[9px] font-semibold px-3 py-1.5 rounded bg-gold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-wider mr-2"
          >
            ▶ AUTO
          </button>
          <button
            onClick={() => setViewMode('events')}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded transition-all ${
              viewMode === 'events'
                ? 'bg-gold text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            ⚡ Live Simulation
          </button>
          <button
            onClick={() => setViewMode('trade')}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded transition-all ${
              viewMode === 'trade'
                ? 'bg-gold text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            📊 Trade
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'events' ? (
          /* ─── PAGE 1: EVENT VIEW ─── */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-border bg-card/90">
              <div className="px-4 py-2 flex items-center">
                <ContractDropdown />
                <StatsBar />
              </div>
              <div className="px-4 pb-1 flex items-center gap-1 overflow-x-auto">
                {([
                  { key: 'live', label: '🟢 Live Simulation' },
                  { key: 'simulation', label: '⚡ Event-Simulation' },
                  { key: 'commentary', label: '📺 Commentary' },
                  { key: 'scores', label: '📊 LiveScore' },
                  { key: 'possession', label: '⚽ Possession' },
                ] as { key: EventTab; label: string }[]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setEventTab(tab.key)}
                    className={`text-[10px] font-semibold px-3 py-1 rounded transition-all whitespace-nowrap ${
                      eventTab === tab.key
                        ? 'bg-secondary text-gold border-b-2 border-gold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* VAR banner */}
            {activeRuntime.state.varActive && (
              <div className="bg-[hsl(var(--impact-high)/0.12)] border-b border-[hsl(var(--impact-high)/0.4)] px-4 py-2 flex items-center justify-center gap-2">
                <span className="text-sm">📺</span>
                <span className="text-[11px] font-bold text-impact-high">VAR REVIEW — PENDA MODE</span>
                <span className="font-mono text-[10px] text-gold font-bold">{activeRuntime.state.varMinutesLeft}m</span>
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              {/* Left: Event content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {eventTab === 'live' && (
                <div className="h-full flex flex-col">
                  <AnimatedPitch
                    selectedZone={activeRuntime.state.selectedZone}
                    onZoneSelect={() => {}}
                    lastEventZone={activeRuntime.state.events.length > 0 ? activeRuntime.state.events[activeRuntime.state.events.length - 1].zone : undefined}
                    lastEventTeam={activeRuntime.state.events.length > 0 ? activeRuntime.state.events[activeRuntime.state.events.length - 1].team : undefined}
                    isRunning={activeRuntime.state.isRunning}
                    minute={activeRuntime.state.minute}
                    ballZone={activeRuntime.state.selectedZone}
                    homeTeam={activeMarket.homeTeam}
                    awayTeam={activeMarket.awayTeam}
                    homeColor={activeMarket.homeColor}
                    awayColor={activeMarket.awayColor}
                    varActive={activeRuntime.state.varActive}
                  />
                  {/* Live event ticker below pitch */}
                  <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {[...activeRuntime.state.events].reverse().slice(0, 8).map(ev => (
                      <div key={ev.id} className="flex items-center gap-2 text-[10px] font-mono py-0.5 border-b border-border/30">
                        <span className="text-muted-foreground w-6 text-right">{ev.minute}'</span>
                        <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold text-white ${
                          ev.team === 'home' ? 'bg-accent' : 'bg-destructive'
                        }`}>
                          {ev.team === 'home' ? 'H' : 'A'}
                        </span>
                        <span className="text-foreground">{ev.emoji} {ev.type}</span>
                        <span className={`text-[8px] uppercase font-semibold ${
                          ev.impact === 'high' ? 'text-impact-high' : ev.impact === 'medium' ? 'text-impact-medium' : 'text-impact-low'
                        }`}>{ev.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {eventTab === 'simulation' && (
                <EventFeed events={activeRuntime.state.events} />
              )}
              {eventTab === 'commentary' && (
                <Commentary
                  allEvents={allEvents}
                  markets={MARKETS}
                  activeMarketId={activeMarketId}
                  matchStates={matchStates}
                />
              )}
              {eventTab === 'scores' && (
                <div className="space-y-1.5">
                  <h3 className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">📊 Live Scores</h3>
                  {scoresData.map(({ market: m, rt, goals, cards, shots, lastEv }) => {
                    const active = m.id === activeMarketId;
                    const pChange = rt.currentPrice - m.startPrice;
                    const pChangePct = m.startPrice > 0 ? (pChange / m.startPrice * 100) : 0;
                    const isUp2 = pChange >= 0;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveMarketId(m.id)}
                        className={`w-full text-left rounded-md p-2 transition-all ${
                          active ? 'bg-secondary border border-[hsl(var(--gold-muted))]' : 'bg-secondary/30 hover:bg-secondary/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {rt.state.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                            <span className="font-mono text-[10px] text-gold font-bold">{m.contract}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{rt.state.minute}'</span>
                          </div>
                          <span className={`font-mono text-[10px] font-bold ${isUp2 ? 'text-accent' : 'text-destructive'}`}>
                            ${rt.currentPrice.toFixed(4)} {isUp2 ? '▲' : '▼'}{Math.abs(pChangePct).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px]">
                            <span style={{ color: m.homeColor }} className="font-semibold">{m.homeShort}</span>
                            <span className="font-mono font-black text-foreground">{rt.state.homeScore} - {rt.state.awayScore}</span>
                            <span style={{ color: m.awayColor }} className="font-semibold">{m.awayShort}</span>
                          </div>
                          <div className="flex gap-2 text-[8px] text-muted-foreground">
                            <span>🎯{shots}</span><span>🟨{cards}</span><span>⚽{goals}</span>
                          </div>
                        </div>
                        {lastEv && (
                          <div className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">
                            {lastEv.minute}' — {lastEv.emoji} {lastEv.type} ({lastEv.team === 'home' ? m.homeShort : m.awayShort})
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {eventTab === 'possession' && (
                <PossessionView runtimes={runtimes} activeMarketId={activeMarketId} />
              )}
              </div>
              {/* Right: Live Price Chart */}
              <div className="w-[45%] shrink-0 border-l border-border overflow-hidden p-2">
                <div className="h-full">
                  <PriceChart
                    priceHistory={activeRuntime.priceHistory}
                    currentPrice={activeRuntime.currentPrice}
                    startPrice={activeMarket.startPrice}
                    contract={activeMarket.contract}
                    homeTeam={activeMarket.homeTeam}
                    awayTeam={activeMarket.awayTeam}
                    homeColor={activeMarket.homeColor}
                    awayColor={activeMarket.awayColor}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── PAGE 2: TRADE VIEW ─── */
          <div className="h-full flex flex-col overflow-hidden">
            {/* Header — same style as event view */}
            <div className="border-b border-border bg-card/90">
              <div className="px-4 py-2 flex items-center">
                <ContractDropdown />
                <StatsBar />
              </div>
            </div>

            {/* Main trade layout — left (chart + bottom tabs) + right (Trade/OrderBook full height) */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left column: Chart on top, Tabs at bottom */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Chart — fills remaining space */}
                <div className="flex-[3] overflow-hidden p-2 min-h-0">
                  <div className="h-full">
                    <PriceChart
                      priceHistory={activeRuntime.priceHistory}
                      currentPrice={activeRuntime.currentPrice}
                      startPrice={activeMarket.startPrice}
                      contract={activeMarket.contract}
                      homeTeam={activeMarket.homeTeam}
                      awayTeam={activeMarket.awayTeam}
                      homeColor={activeMarket.homeColor}
                      awayColor={activeMarket.awayColor}
                    />
                  </div>
                </div>

                {/* Bottom tabs — top edge aligned with OrderBook start in right panel */}
                <div className="border-t border-border bg-card/40 flex-[2] min-h-[320px] flex flex-col">
                  <div className="flex items-center gap-0 border-b border-border px-2 shrink-0">
                    {([
                      { key: 'positions', label: 'Positions', count: openTrades.length },
                      { key: 'open-orders', label: 'Open Orders', count: limitOrders.length },
                      { key: 'trade-history', label: 'Trade History', count: closedTrades.length },
                      { key: 'order-history', label: 'Order History', count: 0 },
                    ] as { key: PositionTab; label: string; count: number }[]).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setPositionTab(tab.key)}
                        className={`text-[10px] font-semibold px-3 py-2 transition-all border-b-2 ${
                          positionTab === tab.key
                            ? 'text-foreground border-gold'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span className="ml-1 text-[8px] bg-secondary rounded-full px-1.5 py-0.5">{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {positionTab === 'positions' && (
                      <PositionsTable
                        openTrades={openTrades}
                        prices={prices}
                        closeTrade={(trade) => {
                          const mPrice = prices[trade.marketId] ?? trade.entryPrice;
                          const priceDiff = mPrice - trade.entryPrice;
                          const dir = trade.direction === 'long' ? 1 : -1;
                          const pnl = Math.round(((priceDiff / trade.entryPrice) * trade.size * trade.leverage * dir) * 100) / 100;
                          const returnAmount = trade.size + pnl;
                          setBalance(b => Math.round((b + Math.max(0, returnAmount)) * 100) / 100);
                          setOpenTrades(t => t.filter(tr => tr.id !== trade.id));
                          setClosedTrades(c => [{
                            id: trade.id, contract: trade.contract, direction: trade.direction,
                            entryPrice: trade.entryPrice, exitPrice: mPrice,
                            size: trade.size, leverage: trade.leverage, pnl, reason: 'manual' as const,
                          }, ...c].slice(0, 50));
                        }}
                      />
                    )}
                    {positionTab === 'open-orders' && (
                      <OpenOrdersTable limitOrders={limitOrders} cancelOrder={cancelLimitOrder} />
                    )}
                    {positionTab === 'trade-history' && (
                      <TradeHistoryTable closedTrades={closedTrades} />
                    )}
                    {positionTab === 'order-history' && (
                      <div className="text-center py-4 text-[10px] text-muted-foreground">No cancelled orders</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel: Trade + OrderBook — full height */}
              <div className="w-[390px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-2 space-y-2">
                <TradePanel
                  activeMarket={activeMarket}
                  prices={prices}
                  latestEvents={latestEvents}
                  balance={balance}
                  setBalance={setBalance}
                  openTrades={openTrades}
                  setOpenTrades={setOpenTrades}
                  closedTrades={closedTrades}
                  setClosedTrades={setClosedTrades}
                  matchStates={matchStates}
                  onPlaceLimitOrder={(order) => setLimitOrders(prev => [order, ...prev])}
                />
                <OrderBook
                  currentPrice={activeRuntime.currentPrice}
                  lastEventImpact={latestEvent?.impact}
                  lastEventDirection={activeRuntime.lastDirection}
                  contract={activeMarket.contract.split('/')[0]}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Positions Table ─── */
function PositionsTable({
  openTrades, prices, closeTrade,
}: {
  openTrades: OpenTrade[];
  prices: Record<string, number>;
  closeTrade: (t: OpenTrade) => void;
}) {
  const totalPnl = openTrades.reduce((sum, t) => {
    const mPrice = prices[t.marketId] ?? t.entryPrice;
    const diff = mPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + ((diff / t.entryPrice) * t.size * t.leverage * dir);
  }, 0);

  if (openTrades.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No open positions</div>;
  }

  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Lev</th>
            <th className="text-right py-1.5 px-1">Entry</th>
            <th className="text-right py-1.5 px-1">Mark</th>
            <th className="text-right py-1.5 px-1">uPnL</th>
            <th className="text-right py-1.5 px-1">Liq</th>
            <th className="text-center py-1.5 px-1">Mode</th>
            <th className="text-right py-1.5 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {openTrades.map(t => {
            const mPrice = prices[t.marketId] ?? t.entryPrice;
            const diff = mPrice - t.entryPrice;
            const dir = t.direction === 'long' ? 1 : -1;
            const pnl = (diff / t.entryPrice) * t.size * t.leverage * dir;
            const pnlPct = (pnl / t.size) * 100;
            return (
              <tr key={t.id} className="border-t border-border/30 hover:bg-secondary/30">
                <td className="py-1 px-1 text-gold">{t.contract}</td>
                <td className={`py-1 px-1 font-bold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                  {t.direction.toUpperCase()}
                </td>
                <td className="py-1 px-1 text-right text-foreground">${t.size}</td>
                <td className="py-1 px-1 text-right text-muted-foreground">{t.leverage}x</td>
                <td className="py-1 px-1 text-right text-foreground">{t.entryPrice.toFixed(4)}</td>
                <td className="py-1 px-1 text-right text-foreground">{mPrice.toFixed(4)}</td>
                <td className={`py-1 px-1 text-right font-bold ${pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(0)}%)
                </td>
                <td className="py-1 px-1 text-right text-muted-foreground">{t.liquidationPrice.toFixed(4)}</td>
                <td className="py-1 px-1 text-center">
                  <span className={`text-[7px] uppercase font-bold px-1 py-0.5 rounded ${
                    t.marginMode === 'cross' ? 'bg-gold/20 text-gold' : 'bg-secondary text-muted-foreground'
                  }`}>{t.marginMode}</span>
                </td>
                <td className="py-1 px-1 text-right">
                  <button onClick={() => closeTrade(t)}
                    className="text-[8px] bg-muted px-1.5 py-0.5 rounded hover:bg-foreground/20 transition-colors">
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Open Orders Table ─── */
function OpenOrdersTable({
  limitOrders, cancelOrder,
}: {
  limitOrders: LimitOrder[];
  cancelOrder: (id: number) => void;
}) {
  if (limitOrders.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No open orders</div>;
  }
  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Lev</th>
            <th className="text-right py-1.5 px-1">Limit Price</th>
            <th className="text-center py-1.5 px-1">Mode</th>
            <th className="text-right py-1.5 px-1"></th>
          </tr>
        </thead>
        <tbody>
          {limitOrders.map(o => (
            <tr key={o.id} className="border-t border-border/30 hover:bg-secondary/30">
              <td className="py-1 px-1 text-gold">{o.contract}</td>
              <td className={`py-1 px-1 font-bold ${o.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                {o.direction.toUpperCase()}
              </td>
              <td className="py-1 px-1 text-right text-foreground">${o.size}</td>
              <td className="py-1 px-1 text-right text-muted-foreground">{o.leverage}x</td>
              <td className="py-1 px-1 text-right text-foreground">${o.limitPrice.toFixed(4)}</td>
              <td className="py-1 px-1 text-center">
                <span className={`text-[7px] uppercase font-bold px-1 py-0.5 rounded ${
                  o.marginMode === 'cross' ? 'bg-gold/20 text-gold' : 'bg-secondary text-muted-foreground'
                }`}>{o.marginMode}</span>
              </td>
              <td className="py-1 px-1 text-right">
                <button onClick={() => cancelOrder(o.id)}
                  className="text-[8px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/30 transition-colors">
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Trade History Table ─── */
function TradeHistoryTable({ closedTrades }: { closedTrades: ClosedTrade[] }) {
  if (closedTrades.length === 0) {
    return <div className="text-center py-4 text-[10px] text-muted-foreground">No trade history</div>;
  }
  return (
    <div className="px-2">
      <table className="w-full text-[9px] font-mono">
        <thead>
          <tr className="text-muted-foreground uppercase tracking-wider">
            <th className="text-left py-1.5 px-1">Contract</th>
            <th className="text-left py-1.5 px-1">Side</th>
            <th className="text-right py-1.5 px-1">Size</th>
            <th className="text-right py-1.5 px-1">Entry</th>
            <th className="text-right py-1.5 px-1">Exit</th>
            <th className="text-right py-1.5 px-1">PnL</th>
            <th className="text-center py-1.5 px-1">Reason</th>
          </tr>
        </thead>
        <tbody>
          {closedTrades.map(t => (
            <tr key={`${t.id}-${t.reason}`} className="border-t border-border/30 hover:bg-secondary/30">
              <td className="py-1 px-1 text-gold">{t.contract}</td>
              <td className={`py-1 px-1 font-bold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                {t.direction.toUpperCase()}
              </td>
              <td className="py-1 px-1 text-right text-foreground">${t.size}</td>
              <td className="py-1 px-1 text-right text-foreground">{t.entryPrice.toFixed(4)}</td>
              <td className="py-1 px-1 text-right text-foreground">{t.exitPrice.toFixed(4)}</td>
              <td className={`py-1 px-1 text-right font-bold ${t.pnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
              </td>
              <td className="py-1 px-1 text-center">
                <span className={`text-[7px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  t.reason === 'liquidated' ? 'bg-destructive/20 text-destructive' :
                  t.reason === 'stop-loss' ? 'bg-destructive/15 text-destructive' :
                  t.reason === 'take-profit' ? 'bg-accent/15 text-accent' :
                  t.reason === 'expired' ? 'bg-gold/15 text-gold' :
                  'bg-secondary text-muted-foreground'
                }`}>{t.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Possession View ─── */
function PossessionView({ runtimes, activeMarketId }: { runtimes: Record<string, MarketRuntime>; activeMarketId: string }) {
  const rt = runtimes[activeMarketId];
  const market = MARKETS.find(m => m.id === activeMarketId)!;
  const events = rt.state.events;
  const homeEvents = events.filter(e => e.team === 'home').length;
  const awayEvents = events.filter(e => e.team === 'away').length;
  const total = homeEvents + awayEvents || 1;
  const homePoss = Math.round((homeEvents / total) * 100);
  const awayPoss = 100 - homePoss;

  // By event type
  const eventTypes = ['Pass', 'Shot on Target', 'Cross', 'Tackle', 'Foul', 'Corner Kick', 'Free Kick'];
  const breakdown = eventTypes.map(type => {
    const h = events.filter(e => e.team === 'home' && e.type === type).length;
    const a = events.filter(e => e.team === 'away' && e.type === type).length;
    return { type, home: h, away: a };
  }).filter(b => b.home > 0 || b.away > 0);

  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">⚽ Possession & Stats</h3>

      {/* Possession bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold" style={{ color: market.homeColor }}>{market.homeShort} {homePoss}%</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Possession</span>
          <span className="text-[10px] font-semibold" style={{ color: market.awayColor }}>{awayPoss}% {market.awayShort}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
          <div className="transition-all duration-500" style={{ width: `${homePoss}%`, backgroundColor: market.homeColor }} />
          <div className="transition-all duration-500" style={{ width: `${awayPoss}%`, backgroundColor: market.awayColor }} />
        </div>
      </div>

      {/* Stats breakdown */}
      <div className="space-y-1.5">
        {breakdown.map(b => {
          const bTotal = b.home + b.away || 1;
          const hPct = Math.round((b.home / bTotal) * 100);
          return (
            <div key={b.type}>
              <div className="flex items-center justify-between text-[9px] font-mono mb-0.5">
                <span style={{ color: market.homeColor }} className="font-bold">{b.home}</span>
                <span className="text-muted-foreground uppercase tracking-wider text-[8px]">{b.type}</span>
                <span style={{ color: market.awayColor }} className="font-bold">{b.away}</span>
              </div>
              <div className="flex h-1 rounded-full overflow-hidden bg-secondary">
                <div className="transition-all duration-500" style={{ width: `${hPct}%`, backgroundColor: market.homeColor }} />
                <div className="transition-all duration-500" style={{ width: `${100 - hPct}%`, backgroundColor: market.awayColor }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Event totals */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-secondary/40 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Home Events</div>
          <div className="font-mono text-lg font-black" style={{ color: market.homeColor }}>{homeEvents}</div>
        </div>
        <div className="bg-secondary/40 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Away Events</div>
          <div className="font-mono text-lg font-black" style={{ color: market.awayColor }}>{awayEvents}</div>
        </div>
      </div>
    </div>
  );
}
