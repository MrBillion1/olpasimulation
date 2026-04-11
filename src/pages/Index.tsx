import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType, MarketConfig,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META, getEventSentiment,
  MARKETS, pickTeam,
} from '@/lib/match-engine';
import EventFeed from '@/components/EventFeed';
import TradePanel, { OpenTrade, ClosedTrade } from '@/components/TradePanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';
import OrderBook from '@/components/OrderBook';
import MarketSelector from '@/components/MarketSelector';

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
type EventTab = 'events' | 'commentary' | 'scores';

export default function Index() {
  const [activeMarketId, setActiveMarketId] = useState(MARKETS[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [eventTab, setEventTab] = useState<EventTab>('events');
  const [runtimes, setRuntimes] = useState<Record<string, MarketRuntime>>(() => {
    const r: Record<string, MarketRuntime> = {};
    MARKETS.forEach(m => { r[m.id] = createRuntime(m); });
    return r;
  });

  const [balance, setBalance] = useState(10000);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeMarket = MARKETS.find(m => m.id === activeMarketId)!;
  const activeRuntime = runtimes[activeMarketId];

  // Clock tick — 2min30s match
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
        const delay = 600 + Math.random() * 1000;
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

  const matchStates = Object.fromEntries(MARKETS.map(m => [m.id, { isRunning: runtimes[m.id].state.isRunning, minute: runtimes[m.id].state.minute }]));

  // Scores summary for live scores tab
  const scoresData = MARKETS.map(m => {
    const rt = runtimes[m.id];
    const goals = rt.state.events.filter(e => e.type === 'Goal' || e.type === 'Penalty' || e.type === 'Own Goal');
    const cards = rt.state.events.filter(e => e.type === 'Yellow Card' || e.type === 'Red Card');
    const shots = rt.state.events.filter(e => e.type === 'Shot on Target');
    const lastEv = rt.state.events[rt.state.events.length - 1];
    return { market: m, rt, goals: goals.length, cards: cards.length, shots: shots.length, lastEv };
  });

  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/90 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-gold tracking-wider">OLPA DEX</span>
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

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Vertical Contract Selector — only on trade view */}
        {viewMode === 'trade' && (
          <div className="w-[140px] shrink-0 border-r border-border bg-card/60 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex-1 px-1.5 py-2 space-y-1">
              {MARKETS.map(m => {
                const active = m.id === activeMarketId;
                const price = prices[m.id] ?? m.startPrice;
                const change = priceChanges[m.id] ?? 0;
                const changePct = m.startPrice > 0 ? (change / m.startPrice * 100) : 0;
                const isUp = change >= 0;
                const minute = matchMinutes[m.id] ?? 0;
                const running = isRunningMap[m.id] ?? false;

                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMarketId(m.id)}
                    className={`w-full text-left rounded-md px-2 py-2 transition-all active:scale-[0.98] ${
                      active
                        ? 'bg-secondary border border-[hsl(var(--gold-muted))]'
                        : 'bg-transparent hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-gold truncate">
                        {m.contract}
                      </span>
                      {running && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="font-mono text-[11px] font-black tabular-nums text-foreground mt-0.5">
                      ${price.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={`font-mono text-[8px] font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
                        {isUp ? '▲' : '▼'}{Math.abs(changePct).toFixed(1)}%
                      </span>
                      <span className="text-[8px] text-muted-foreground font-mono">
                        {minute > 0 ? `${minute}'` : '—'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MAIN CONTENT — instant flip between views */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'events' ? (
            <EventView
              activeMarket={activeMarket}
              activeRuntime={activeRuntime}
              eventTab={eventTab}
              setEventTab={setEventTab}
              allEvents={allEvents}
              matchStates={matchStates}
              scoresData={scoresData}
              activeMarketId={activeMarketId}
              setActiveMarketId={setActiveMarketId}
              prices={prices}
              priceChanges={priceChanges}
              matchMinutes={matchMinutes}
              isRunningMap={isRunningMap}
              contractDropdownOpen={contractDropdownOpen}
              setContractDropdownOpen={setContractDropdownOpen}
              runtimes={runtimes}
            />
          ) : (
            <TradeView
              activeMarket={activeMarket}
              activeRuntime={activeRuntime}
              latestEvent={latestEvent}
              prices={prices}
              latestEvents={latestEvents}
              balance={balance}
              setBalance={setBalance}
              openTrades={openTrades}
              setOpenTrades={setOpenTrades}
              closedTrades={closedTrades}
              setClosedTrades={setClosedTrades}
              matchStates={matchStates}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── PAGE 1: EVENT VIEW ─── */
interface EventViewProps {
  activeMarket: MarketConfig;
  activeRuntime: MarketRuntime;
  eventTab: EventTab;
  setEventTab: (t: EventTab) => void;
  allEvents: Record<string, MatchEvent[]>;
  matchStates: Record<string, { isRunning: boolean; minute: number }>;
  scoresData: {
    market: MarketConfig;
    rt: MarketRuntime;
    goals: number;
    cards: number;
    shots: number;
    lastEv?: MatchEvent;
  }[];
  activeMarketId: string;
  setActiveMarketId: (id: string) => void;
  prices: Record<string, number>;
  priceChanges: Record<string, number>;
  matchMinutes: Record<string, number>;
  isRunningMap: Record<string, boolean>;
  contractDropdownOpen: boolean;
  setContractDropdownOpen: (v: boolean) => void;
  runtimes: Record<string, MarketRuntime>;
}

function EventView({
  activeMarket, activeRuntime, eventTab, setEventTab, allEvents, matchStates,
  scoresData, activeMarketId, setActiveMarketId, prices, priceChanges, matchMinutes,
  isRunningMap, contractDropdownOpen, setContractDropdownOpen, runtimes,
}: EventViewProps) {
  const ms = matchStates[activeMarketId];
  const isLive = ms?.isRunning;
  const minute = ms?.minute ?? 0;
  const currentPrice = activeRuntime.currentPrice;
  const change = priceChanges[activeMarketId] ?? 0;
  const changePct = activeMarket.startPrice > 0 ? (change / activeMarket.startPrice * 100) : 0;
  const isUp = change >= 0;
  const totalEvents = activeRuntime.state.events.length;
  const highImpact = activeRuntime.state.events.filter(e => e.impact === 'high').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Hyperliquid-style contract header */}
      <div className="border-b border-border bg-card/90">
        {/* Row 1: Contract dropdown + stats */}
        <div className="px-4 py-2 flex items-center gap-6">
          {/* Contract dropdown */}
          <div className="relative">
            <button
              onClick={() => setContractDropdownOpen(!contractDropdownOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-base font-bold text-foreground tracking-wide">
                {activeMarket.contract}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${contractDropdownOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown panel */}
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
                        onClick={() => {
                          setActiveMarketId(m.id);
                          setContractDropdownOpen(false);
                        }}
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
                          <div className="font-mono text-xs font-black tabular-nums text-foreground">
                            ${mPrice.toFixed(4)}
                          </div>
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

          {/* Stats bar — Hyperliquid style */}
          <div className="flex items-center gap-6 ml-4">
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Price</div>
              <div className="font-mono text-sm font-black tabular-nums text-foreground">${currentPrice.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Change</div>
              <div className={`font-mono text-sm font-bold tabular-nums ${isUp ? 'text-accent' : 'text-destructive'}`}>
                {isUp ? '+' : ''}{change.toFixed(4)} / {isUp ? '+' : ''}{changePct.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Score</div>
              <div className="font-mono text-sm font-black tabular-nums text-foreground">
                {activeRuntime.state.homeScore} - {activeRuntime.state.awayScore}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Minute</div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">{minute}'</span>
                {isLive && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Events</div>
              <div className="font-mono text-sm font-bold tabular-nums text-foreground">{totalEvents}</div>
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">High Impact</div>
              <div className="font-mono text-sm font-bold tabular-nums text-impact-high">{highImpact}</div>
            </div>
          </div>
        </div>

        {/* Row 2: Tabs */}
        <div className="px-4 pb-1 flex items-center gap-1">
          {(['events', 'commentary', 'scores'] as EventTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setEventTab(tab)}
              className={`text-[10px] font-semibold px-3 py-1 rounded transition-all capitalize ${
                eventTab === tab
                  ? 'bg-secondary text-gold border-b-2 border-gold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'events' ? '⚡ Event Feed' : tab === 'commentary' ? '📺 Commentary' : '📊 Live Scores'}
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

      {/* Full-width content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {eventTab === 'events' && (
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
                      <span>🎯{shots}</span>
                      <span>🟨{cards}</span>
                      <span>⚽{goals}</span>
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
      </div>
    </div>
  );
}

/* ─── PAGE 2: TRADE VIEW ─── */
interface TradeViewProps {
  activeMarket: MarketConfig;
  activeRuntime: MarketRuntime;
  latestEvent?: MatchEvent;
  prices: Record<string, number>;
  latestEvents: Record<string, MatchEvent | undefined>;
  balance: number;
  setBalance: (fn: (b: number) => number) => void;
  openTrades: OpenTrade[];
  setOpenTrades: React.Dispatch<React.SetStateAction<OpenTrade[]>>;
  closedTrades: ClosedTrade[];
  setClosedTrades: React.Dispatch<React.SetStateAction<ClosedTrade[]>>;
  matchStates: Record<string, { isRunning: boolean; minute: number }>;
}

function TradeView({
  activeMarket, activeRuntime, latestEvent, prices, latestEvents,
  balance, setBalance, openTrades, setOpenTrades, closedTrades, setClosedTrades, matchStates,
}: TradeViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Chart + Trade/OrderBook side by side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
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

          {/* Open positions below chart */}
          <div className="border-t border-border p-3 max-h-[200px] overflow-y-auto custom-scrollbar bg-card/40">
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
          </div>
        </div>

        {/* Right panel: Trade + OrderBook */}
        <div className="w-[300px] shrink-0 border-l border-border overflow-y-auto custom-scrollbar p-2 space-y-2">
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
  );
}

/* ─── Positions Table ─── */
function PositionsTable({
  openTrades,
  prices,
  closeTrade,
}: {
  openTrades: OpenTrade[];
  prices: Record<string, number>;
  closeTrade: (t: OpenTrade) => void;
}) {
  const totalUnrealizedPnl = openTrades.reduce((sum, t) => {
    const mPrice = prices[t.marketId] ?? t.entryPrice;
    const diff = mPrice - t.entryPrice;
    const dir = t.direction === 'long' ? 1 : -1;
    return sum + ((diff / t.entryPrice) * t.size * t.leverage * dir);
  }, 0);

  if (openTrades.length === 0) {
    return (
      <div className="text-center py-3">
        <span className="text-[10px] text-muted-foreground">No open positions</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gold font-semibold">Positions ({openTrades.length})</span>
        <span className={`font-mono text-[10px] font-bold ${totalUnrealizedPnl >= 0 ? 'text-accent' : 'text-destructive'}`}>
          uPnL: {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono">
          <thead>
            <tr className="text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-1 px-1">Contract</th>
              <th className="text-left py-1 px-1">Side</th>
              <th className="text-right py-1 px-1">Size</th>
              <th className="text-right py-1 px-1">Lev</th>
              <th className="text-right py-1 px-1">Entry</th>
              <th className="text-right py-1 px-1">Mark</th>
              <th className="text-right py-1 px-1">PnL</th>
              <th className="text-right py-1 px-1">Liq</th>
              <th className="text-right py-1 px-1"></th>
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
                <tr key={t.id} className="border-t border-border/50 hover:bg-secondary/30">
                  <td className="py-1 px-1 text-gold">{t.contract.split('/')[0]}</td>
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
                  <td className="py-1 px-1 text-right">
                    <button
                      onClick={() => closeTrade(t)}
                      className="text-[8px] bg-muted px-1.5 py-0.5 rounded hover:bg-foreground/20 transition-colors"
                    >
                      Close
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
