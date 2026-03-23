import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META, getEventSentiment,
} from '@/lib/match-engine';
import MatchHeader from '@/components/MatchHeader';
import AnimatedPitch from '@/components/AnimatedPitch';
import ControlsPanel from '@/components/ControlsPanel';
import EventFeed from '@/components/EventFeed';
import TradePanel from '@/components/TradePanel';
import StatsPanel from '@/components/StatsPanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';
import OrderBook from '@/components/OrderBook';

let eventCounter = 0;
const START_PRICE = 100;

interface PricePoint {
  minute: number;
  price: number;
  event?: string;
}

export default function Index() {
  const [state, setState] = useState<MatchState>(createInitialState);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([{ minute: 0, price: START_PRICE }]);
  const [currentPrice, setCurrentPrice] = useState(START_PRICE);
  const [lastDirection, setLastDirection] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock tick
  useEffect(() => {
    if (state.isRunning) {
      clockRef.current = setInterval(() => {
        setState(s => {
          const next = s.minute + 1;
          if (next > 90) return { ...s, isRunning: false };
          return { ...s, minute: next, half: next > 45 ? 2 : 1 };
        });
      }, 2000);
    }
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, [state.isRunning]);

  const fireEvent = useCallback((type?: EventType, zone?: ZoneId, sig?: SignificanceType) => {
    setState(prev => {
      const eventType = type ?? pickRandomEvent();
      const eventZone = zone ?? (prev.isRunning ? pickRandomZone() : prev.selectedZone);
      const eventSig = sig ?? pickRandomSignificance(eventType);
      const weight = calculateWeight(eventType, eventZone, eventSig, prev.minute);
      const team = Math.random() > 0.5 ? 'home' as const : 'away' as const;
      const meta = EVENT_META[eventType];

      const ev: MatchEvent = {
        id: `evt-${++eventCounter}`,
        type: eventType, zone: eventZone, significance: eventSig,
        minute: prev.minute, weight, team,
        description: getSignificanceDescription(eventSig, weight.final),
        impact: meta.impact, emoji: meta.emoji,
      };

      const momentumDelta = team === 'home' ? weight.final * 0.05 : -weight.final * 0.05;
      const newMomentum = Math.max(-1, Math.min(1, prev.momentum + momentumDelta));

      let homeScore = prev.homeScore;
      let awayScore = prev.awayScore;
      if (eventType === 'Goal') { if (team === 'home') homeScore++; else awayScore++; }
      if (eventType === 'Own Goal') { if (team === 'home') awayScore++; else homeScore++; }
      if (eventType === 'Penalty' && Math.random() < weight.final * 0.7) {
        if (team === 'home') homeScore++; else awayScore++;
      }

      // Price logic:
      // Positive home event → price UP, Negative home event → price DOWN
      // Positive away event → price DOWN, Negative away event → price UP
      const sentiment = getEventSentiment(eventType);
      const impactMultiplier = meta.impact === 'high' ? 3 : meta.impact === 'medium' ? 1.5 : 0.5;
      const priceMove = weight.final * impactMultiplier * (0.5 + Math.random() * 0.5);

      let direction = 0;
      if (sentiment === 'positive') {
        direction = team === 'home' ? 1 : -1;
      } else if (sentiment === 'negative') {
        direction = team === 'home' ? -1 : 1;
      } else {
        direction = Math.random() > 0.5 ? 0.3 : -0.3;
      }

      setLastDirection(direction);
      setCurrentPrice(p => {
        const newPrice = Math.max(10, p + priceMove * direction);
        const rounded = Math.round(newPrice * 100) / 100;
        setPriceHistory(h => [...h, { minute: prev.minute, price: rounded, event: eventType }]);
        return rounded;
      });

      return {
        ...prev, events: [...prev.events, ev], momentum: newMomentum,
        homeScore, awayScore, selectedZone: eventZone,
      };
    });
  }, []);

  // Auto-play
  useEffect(() => {
    if (state.isRunning) {
      const delay = 1500 + Math.random() * 2500;
      intervalRef.current = setTimeout(() => fireEvent(), delay);
    }
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [state.isRunning, state.events.length, fireEvent]);

  const toggleAutoPlay = () => setState(s => ({ ...s, isRunning: !s.isRunning }));
  const resetMatch = () => {
    eventCounter = 0;
    setState(createInitialState());
    setPriceHistory([{ minute: 0, price: START_PRICE }]);
    setCurrentPrice(START_PRICE);
    setLastDirection(0);
  };
  const selectZone = (zone: ZoneId) => setState(s => ({ ...s, selectedZone: zone }));

  const latestEvent = state.events[state.events.length - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-[hsl(var(--gold-muted))] bg-card/80 px-4 py-2">
        <p className="text-[11px] text-gold text-center tracking-wide font-medium">
          MCIMUN/USDT — Man City vs Man United • Advanced Micro-Event DEX Demo
        </p>
      </div>

      <div className="flex-1 p-3 max-w-[1600px] mx-auto w-full">
        <MatchHeader
          minute={state.minute} homeScore={state.homeScore} awayScore={state.awayScore}
          half={state.half} isRunning={state.isRunning}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mt-3">
          {/* Main area */}
          <div className="space-y-3">
            {/* Pitch + Price chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatedPitch
                selectedZone={state.selectedZone} onZoneSelect={selectZone}
                lastEventZone={latestEvent?.zone} lastEventTeam={latestEvent?.team}
                isRunning={state.isRunning} minute={state.minute}
                ballZone={latestEvent?.zone ?? 'mid-center'}
              />
              <PriceChart
                priceHistory={priceHistory}
                currentPrice={currentPrice}
                startPrice={START_PRICE}
              />
            </div>

            {/* Commentary */}
            <Commentary events={state.events} />

            {/* Controls + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ControlsPanel
                isRunning={state.isRunning} onToggleAutoPlay={toggleAutoPlay}
                onTriggerEvent={() => fireEvent()} onReset={resetMatch}
                onManualEvent={(t, z, s) => fireEvent(t, z, s)}
                selectedZone={state.selectedZone}
              />
              <StatsPanel events={state.events} momentum={state.momentum} half={state.half} />
            </div>

            {/* Legend */}
            <div className="bg-card border border-[hsl(var(--gold-muted))] rounded-lg p-3">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">Price Logic</h4>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    <span className="text-accent">City positive events → price ↑</span> •
                    <span className="text-destructive ml-1">City negative events → price ↓</span><br />
                    <span className="text-destructive">United positive events → price ↓</span> •
                    <span className="text-accent ml-1">United negative events → price ↑</span>
                  </p>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">Dynamic Weight</h4>
                  <div className="font-mono text-[10px] text-foreground/80 bg-secondary/50 rounded-md p-2 border border-border">
                    <span className="text-gold">final_weight</span> = base + zone + sig + time
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

          {/* Right sidebar */}
          <div className="space-y-3">
            <TradePanel currentPrice={currentPrice} latestEvent={latestEvent} />
            <OrderBook
              currentPrice={currentPrice}
              lastEventImpact={latestEvent?.impact}
              lastEventDirection={lastDirection}
            />
            <div className="bg-surface-elevated rounded-lg border border-border p-3 max-h-[400px] flex flex-col">
              <EventFeed events={state.events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
