import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META,
} from '@/lib/match-engine';
import MatchHeader from '@/components/MatchHeader';
import AnimatedPitch from '@/components/AnimatedPitch';
import ControlsPanel from '@/components/ControlsPanel';
import EventFeed from '@/components/EventFeed';
import TradePanel from '@/components/TradePanel';
import StatsPanel from '@/components/StatsPanel';
import PriceChart from '@/components/PriceChart';
import Commentary from '@/components/Commentary';

let eventCounter = 0;
const START_PRICE = 100;

interface PricePoint {
  minute: number;
  price: number;
  event?: string;
}

export default function Index() {
  const [state, setState] = useState<MatchState>(createInitialState);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([{ minute: 0, price: START_PRICE }]);
  const [currentPrice, setCurrentPrice] = useState(START_PRICE);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock tick - 2s per game minute (~3 min match)
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
        type: eventType,
        zone: eventZone,
        significance: eventSig,
        minute: prev.minute,
        weight,
        team,
        description: getSignificanceDescription(eventSig, weight.final),
        impact: meta.impact,
        emoji: meta.emoji,
      };

      const momentumDelta = team === 'home' ? weight.final * 0.05 : -weight.final * 0.05;
      const newMomentum = Math.max(-1, Math.min(1, prev.momentum + momentumDelta));

      let homeScore = prev.homeScore;
      let awayScore = prev.awayScore;

      if (eventType === 'Goal') {
        if (team === 'home') homeScore++;
        else awayScore++;
      }
      if (eventType === 'Own Goal') {
        if (team === 'home') awayScore++;
        else homeScore++;
      }
      if (eventType === 'Penalty' && Math.random() < weight.final * 0.7) {
        if (team === 'home') homeScore++;
        else awayScore++;
      }

      // Update price based on event
      const impactMultiplier = meta.impact === 'high' ? 3 : meta.impact === 'medium' ? 1.5 : 0.5;
      const priceMove = weight.final * impactMultiplier * (0.5 + Math.random() * 0.5);

      setCurrentPrice(p => {
        // For "home" selected team: home events push up, away events push down
        // For "away" selected team: reversed
        const direction = (team === 'home') ? 1 : -1;
        const teamFactor = 1; // always from home perspective, flip in chart
        const newPrice = Math.max(10, p + priceMove * direction * teamFactor);
        const rounded = Math.round(newPrice * 100) / 100;

        setPriceHistory(h => [...h, {
          minute: prev.minute,
          price: rounded,
          event: eventType,
        }]);

        return rounded;
      });

      return {
        ...prev,
        events: [...prev.events, ev],
        momentum: newMomentum,
        homeScore,
        awayScore,
        selectedZone: eventZone,
      };
    });
  }, []);

  // When selected team changes, recalculate price history perspective
  const adjustedPriceHistory = selectedTeam === 'home'
    ? priceHistory
    : priceHistory.map(p => ({
        ...p,
        price: Math.round((START_PRICE + (START_PRICE - p.price)) * 100) / 100,
      }));

  const adjustedCurrentPrice = selectedTeam === 'home'
    ? currentPrice
    : Math.round((START_PRICE + (START_PRICE - currentPrice)) * 100) / 100;

  // Auto-play: events every 1.5-4 seconds for faster pace
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
  };
  const selectZone = (zone: ZoneId) => setState(s => ({ ...s, selectedZone: zone }));

  const latestEvent = state.events[state.events.length - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header strip */}
      <div className="border-b border-[hsl(var(--gold-muted))] bg-card/80 px-4 py-2">
        <p className="text-[11px] text-gold text-center tracking-wide font-medium">
          Advanced Dynamic Micro-Event Demo – built on <span className="font-semibold">OlpaDEX</span> concept
        </p>
      </div>

      <div className="flex-1 p-3 max-w-[1600px] mx-auto w-full">
        <MatchHeader
          minute={state.minute}
          homeScore={state.homeScore}
          awayScore={state.awayScore}
          half={state.half}
          isRunning={state.isRunning}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3 mt-3">
          {/* Main area */}
          <div className="space-y-3">
            {/* Pitch + Price chart row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatedPitch
                selectedZone={state.selectedZone}
                onZoneSelect={selectZone}
                lastEventZone={latestEvent?.zone}
                lastEventTeam={latestEvent?.team}
                isRunning={state.isRunning}
                minute={state.minute}
                ballZone={latestEvent?.zone ?? 'mid-center'}
              />
              <PriceChart
                priceHistory={adjustedPriceHistory}
                selectedTeam={selectedTeam}
                onSelectTeam={setSelectedTeam}
                currentPrice={adjustedCurrentPrice}
                startPrice={START_PRICE}
              />
            </div>

            {/* Commentary */}
            <Commentary events={state.events} />

            {/* Controls + Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ControlsPanel
                isRunning={state.isRunning}
                onToggleAutoPlay={toggleAutoPlay}
                onTriggerEvent={() => fireEvent()}
                onReset={resetMatch}
                onManualEvent={(t, z, s) => fireEvent(t, z, s)}
                selectedZone={state.selectedZone}
              />
              <StatsPanel events={state.events} momentum={state.momentum} half={state.half} />
            </div>

            {/* Legend */}
            <div className="bg-card border border-[hsl(var(--gold-muted))] rounded-lg p-3">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">How It Works</h4>
                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Original OlpaDEX used fixed statistical weights at contract level. This advanced demo
                    makes weights <span className="text-foreground font-medium">fully dynamic</span> using
                    zone + significance + time modifiers.
                  </p>
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1">Dynamic Weight Formula</h4>
                  <div className="font-mono text-[10px] text-foreground/80 bg-secondary/50 rounded-md p-2 leading-relaxed border border-border">
                    <span className="text-gold">final_weight</span> = base + zone_mod + sig_mod + time_mod
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

          {/* Right sidebar: Event feed + Trade panel */}
          <div className="space-y-3">
            <TradePanel latestEvent={latestEvent} />
            <div className="bg-surface-elevated rounded-lg border border-border p-3 min-h-[400px] flex flex-col">
              <EventFeed events={state.events} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
