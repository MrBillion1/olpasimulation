import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType, MarketConfig,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META, getEventSentiment,
  MARKETS, pickTeam,
} from '@/lib/match-engine';
import MatchHeader from '@/components/MatchHeader';
import AnimatedPitch from '@/components/AnimatedPitch';
import ControlsPanel from '@/components/ControlsPanel';
import EventFeed from '@/components/EventFeed';
import TradePanel, { OpenTrade, ClosedTrade } from '@/components/TradePanel';
import StatsPanel from '@/components/StatsPanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';
import OrderBook from '@/components/OrderBook';
import MarketSelector from '@/components/MarketSelector';
import LiveScoreboard from '@/components/LiveScoreboard';

interface PricePoint {
  minute: number;
  price: number;
  event?: string;
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

export default function Index() {
  const [activeMarketId, setActiveMarketId] = useState(MARKETS[0].id);
  const [runtimes, setRuntimes] = useState<Record<string, MarketRuntime>>(() => {
    const r: Record<string, MarketRuntime> = {};
    MARKETS.forEach(m => { r[m.id] = createRuntime(m); });
    return r;
  });

  // Shared trading state
  const [balance, setBalance] = useState(10000);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);

  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeMarket = MARKETS.find(m => m.id === activeMarketId)!;
  const activeRuntime = runtimes[activeMarketId];

  // Clock tick — 2min30s match = 1.667s per minute (150s / 90)
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
      const newHistory = [...rt.priceHistory, { minute: rt.state.minute, price: newPrice, event: eventType }];

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

  // Auto-play for all running markets — 1.4x faster
  useEffect(() => {
    MARKETS.forEach(m => {
      const rt = runtimes[m.id];
      if (rt.state.isRunning && !rt.state.varActive) {
        const delay = 600 + Math.random() * 1000; // ~0.6-1.6s (2x speed)
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

  const toggleAutoPlay = (marketId: string) => {
    setRuntimes(prev => ({
      ...prev,
      [marketId]: {
        ...prev[marketId],
        state: { ...prev[marketId].state, isRunning: !prev[marketId].state.isRunning },
      },
    }));
  };

  // Start ALL contracts at once
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

  const resetMatch = (marketId: string) => {
    const market = MARKETS.find(m => m.id === marketId)!;
    setRuntimes(prev => ({ ...prev, [marketId]: createRuntime(market) }));
  };

  const selectZone = (zone: ZoneId) => {
    setRuntimes(prev => ({
      ...prev,
      [activeMarketId]: {
        ...prev[activeMarketId],
        state: { ...prev[activeMarketId].state, selectedZone: zone },
      },
    }));
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-[hsl(var(--gold-muted))] bg-card/80 px-4 py-2">
        <p className="text-[11px] text-gold text-center tracking-wide font-medium">
          {activeMarket.contract} — {activeMarket.homeTeam} vs {activeMarket.awayTeam} • Advanced Micro-Event DEX Demo • From OLPA DEX Concept
        </p>
      </div>

      <div className="flex-1 p-3 max-w-[1600px] mx-auto w-full">
        <div className="mb-3">
          <MarketSelector
            markets={MARKETS}
            activeMarketId={activeMarketId}
            onSelectMarket={setActiveMarketId}
            prices={prices}
            priceChanges={priceChanges}
            matchMinutes={matchMinutes}
            isRunning={isRunningMap}
            onStartAll={startAll}
          />
        </div>

        {activeRuntime.state.varActive && (
          <div className="bg-[hsl(var(--impact-high)/0.12)] border border-[hsl(var(--impact-high)/0.4)] rounded-lg p-3 mb-3 animate-impact-pulse">
            <div className="flex items-center justify-center gap-3">
              <span className="text-xl">📺</span>
              <div className="text-center">
                <p className="text-sm font-bold text-impact-high">VAR REVIEW — PENDA MODE ACTIVE</p>
                <p className="text-[10px] text-muted-foreground">
                  Match halted • Market frozen • Adaptive weight recalibration in progress •
                  <span className="text-gold font-mono font-bold ml-1">{activeRuntime.state.varMinutesLeft} min remaining</span>
                </p>
              </div>
              <span className="text-xl">📺</span>
            </div>
          </div>
        )}

        <MatchHeader
          minute={activeRuntime.state.minute}
          homeScore={activeRuntime.state.homeScore}
          awayScore={activeRuntime.state.awayScore}
          half={activeRuntime.state.half}
          isRunning={activeRuntime.state.isRunning}
          homeTeam={activeMarket.homeTeam}
          awayTeam={activeMarket.awayTeam}
          homeColor={activeMarket.homeColor}
          awayColor={activeMarket.awayColor}
          contract={activeMarket.contract}
          varActive={activeRuntime.state.varActive}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mt-3">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatedPitch
                selectedZone={activeRuntime.state.selectedZone}
                onZoneSelect={selectZone}
                lastEventZone={latestEvent?.zone}
                lastEventTeam={latestEvent?.team}
                isRunning={activeRuntime.state.isRunning}
                minute={activeRuntime.state.minute}
                ballZone={latestEvent?.zone ?? 'mid-center'}
                homeTeam={activeMarket.homeShort}
                awayTeam={activeMarket.awayShort}
                homeColor={activeMarket.homeColor}
                awayColor={activeMarket.awayColor}
                varActive={activeRuntime.state.varActive}
              />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Commentary
                allEvents={allEvents}
                markets={MARKETS}
                activeMarketId={activeMarketId}
              />
              <LiveScoreboard
                markets={MARKETS}
                runtimes={runtimes}
                activeMarketId={activeMarketId}
                onSelectMarket={setActiveMarketId}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ControlsPanel
                isRunning={activeRuntime.state.isRunning}
                onToggleAutoPlay={() => toggleAutoPlay(activeMarketId)}
                onTriggerEvent={() => fireEvent(activeMarketId)}
                onReset={() => resetMatch(activeMarketId)}
                onManualEvent={(t, z, s) => fireEvent(activeMarketId, t, z, s)}
                selectedZone={activeRuntime.state.selectedZone}
              />
              <StatsPanel
                events={activeRuntime.state.events}
                momentum={activeRuntime.state.momentum}
                half={activeRuntime.state.half}
                homeTeam={activeMarket.homeTeam}
                awayTeam={activeMarket.awayTeam}
              />
            </div>

            <div className="bg-card border border-[hsl(var(--gold-muted))] rounded-lg p-3">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">Price Logic</h4>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    <span className="text-accent">{activeMarket.homeTeam} positive → price ↑</span> •
                    <span className="text-destructive ml-1">{activeMarket.homeTeam} negative → price ↓</span><br />
                    <span className="text-destructive">{activeMarket.awayTeam} positive → price ↓</span> •
                    <span className="text-accent ml-1">{activeMarket.awayTeam} negative → price ↑</span>
                  </p>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">Dynamic Weight + Penda</h4>
                  <div className="font-mono text-[10px] text-foreground/80 bg-secondary/50 rounded-md p-2 border border-border">
                    <span className="text-gold">final_weight</span> = base + zone + sig + time<br />
                    <span className="text-impact-high">VAR halt</span> = Penda mode freezes market
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] items-center">
                  <span className="text-impact-high">● High</span>
                  <span className="text-impact-medium">● Medium</span>
                  <span className="text-impact-low">● Low</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
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
            />
            <OrderBook
              currentPrice={activeRuntime.currentPrice}
              lastEventImpact={latestEvent?.impact}
              lastEventDirection={activeRuntime.lastDirection}
              contract={activeMarket.contract.split('/')[0]}
            />
            <div className="bg-surface-elevated rounded-lg border border-border p-3 max-h-[400px] flex flex-col">
              <EventFeed events={activeRuntime.state.events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
