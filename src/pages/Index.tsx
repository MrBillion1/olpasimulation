import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchEvent, EventType, ZoneId, SignificanceType,
  createInitialState, calculateWeight, pickRandomEvent, pickRandomZone,
  pickRandomSignificance, getSignificanceDescription, EVENT_META,
} from '@/lib/match-engine';
import MatchHeader from '@/components/MatchHeader';
import PitchView from '@/components/PitchView';
import ControlsPanel from '@/components/ControlsPanel';
import EventFeed from '@/components/EventFeed';
import TradePanel from '@/components/TradePanel';
import StatsPanel from '@/components/StatsPanel';

let eventCounter = 0;

export default function Index() {
  const [state, setState] = useState<MatchState>(createInitialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      const eventZone = zone ?? prev.selectedZone;
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
      
      // Goals
      if (eventType === 'Goal') {
        if (team === 'home') homeScore++;
        else awayScore++;
      }
      if (eventType === 'Own Goal') {
        if (team === 'home') awayScore++;
        else homeScore++;
      }
      // Penalty conversion
      if (eventType === 'Penalty' && Math.random() < weight.final * 0.7) {
        if (team === 'home') homeScore++;
        else awayScore++;
      }

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

  // Auto-play
  useEffect(() => {
    if (state.isRunning) {
      const delay = 3000 + Math.random() * 5000;
      intervalRef.current = setTimeout(() => fireEvent(), delay) as unknown as ReturnType<typeof setInterval>;
    }
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current as unknown as number); };
  }, [state.isRunning, state.events.length, fireEvent]);

  const toggleAutoPlay = () => setState(s => ({ ...s, isRunning: !s.isRunning }));
  const resetMatch = () => { eventCounter = 0; setState(createInitialState()); };
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

      <div className="flex-1 p-4 max-w-[1400px] mx-auto w-full">
        <MatchHeader
          minute={state.minute}
          homeScore={state.homeScore}
          awayScore={state.awayScore}
          half={state.half}
          isRunning={state.isRunning}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 mt-4">
          {/* Left column */}
          <div className="space-y-4">
            <PitchView
              selectedZone={state.selectedZone}
              onZoneSelect={selectZone}
              lastEventZone={latestEvent?.zone}
            />
            <ControlsPanel
              isRunning={state.isRunning}
              onToggleAutoPlay={toggleAutoPlay}
              onTriggerEvent={() => fireEvent()}
              onReset={resetMatch}
              onManualEvent={(t, z, s) => fireEvent(t, z, s)}
              selectedZone={state.selectedZone}
            />
            <StatsPanel events={state.events} momentum={state.momentum} half={state.half} />

            {/* Legend */}
            <div className="bg-card border border-[hsl(var(--gold-muted))] rounded-lg p-3">
              <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-1.5">How It Works</h4>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Original OlpaDEX used fixed statistical weights at contract level. This advanced demo
                makes weights <span className="text-foreground font-medium">fully dynamic</span> using
                zone + significance + time modifiers calculated in real time.
              </p>
              <div className="mt-2 flex gap-3 text-[10px]">
                <span className="text-impact-high">● High Impact</span>
                <span className="text-impact-medium">● Medium</span>
                <span className="text-impact-low">● Low</span>
              </div>
            </div>
          </div>

          {/* Center: event feed */}
          <div className="bg-surface-elevated rounded-lg border border-border p-4 min-h-[500px] flex flex-col">
            <EventFeed events={state.events} />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <TradePanel latestEvent={latestEvent} />

            {/* Weight formula */}
            <div className="bg-card border border-[hsl(var(--gold-muted))] rounded-lg p-4">
              <h4 className="text-[10px] uppercase tracking-widest text-gold font-semibold mb-2">Dynamic Weight Formula</h4>
              <div className="font-mono text-xs text-foreground/80 bg-secondary/50 rounded-md p-2.5 leading-relaxed border border-border">
                <span className="text-gold">final_weight</span> = base_weight<br />
                &nbsp;&nbsp;+ zone_modifier<br />
                &nbsp;&nbsp;+ significance_modifier<br />
                &nbsp;&nbsp;+ time_modifier
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--weight-high))]" />
                  <span className="text-muted-foreground">High probability (≥0.65)</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--weight-mid))]" />
                  <span className="text-muted-foreground">Medium (0.40–0.64)</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-[hsl(var(--weight-low))]" />
                  <span className="text-muted-foreground">Low probability (&lt;0.40)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
