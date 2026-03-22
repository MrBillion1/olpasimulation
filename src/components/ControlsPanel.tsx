import { EventType, SignificanceType, EVENT_TYPES, SIGNIFICANCE_TYPES, ZoneId, EVENT_META, HIGH_IMPACT_EVENTS, MEDIUM_IMPACT_EVENTS, LOW_IMPACT_EVENTS } from '@/lib/match-engine';

interface ControlsPanelProps {
  isRunning: boolean;
  onToggleAutoPlay: () => void;
  onTriggerEvent: () => void;
  onReset: () => void;
  onManualEvent: (type: EventType, zone: ZoneId, sig: SignificanceType) => void;
  selectedZone: ZoneId;
}

export default function ControlsPanel({ isRunning, onToggleAutoPlay, onTriggerEvent, onReset, onManualEvent, selectedZone }: ControlsPanelProps) {
  return (
    <div className="space-y-3">
      {/* Main controls */}
      <div className="flex gap-2">
        <button
          onClick={onTriggerEvent}
          className={`flex-1 bg-gold text-primary-foreground font-semibold text-sm py-2.5 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all ${isRunning ? '' : 'animate-pulse-glow'}`}
        >
          ⚡ Trigger Event
        </button>
        <button
          onClick={onToggleAutoPlay}
          className={`px-4 text-sm font-medium rounded-md transition-all active:scale-[0.97]
            ${isRunning 
              ? 'bg-destructive text-destructive-foreground hover:brightness-110' 
              : 'bg-accent text-accent-foreground hover:brightness-110'}`}
        >
          {isRunning ? '⏸ Stop' : '▶ Auto'}
        </button>
        <button
          onClick={onReset}
          className="px-3 text-sm text-muted-foreground hover:text-foreground bg-secondary rounded-md
                     transition-all active:scale-[0.97]"
        >
          ↺
        </button>
      </div>

      {/* Manual event creator */}
      <details className="bg-card border border-border rounded-lg">
        <summary className="text-xs uppercase tracking-widest text-gold font-semibold px-3 py-2 cursor-pointer hover:text-foreground transition-colors">
          Manual Event Creator
        </summary>
        <div className="px-3 pb-3 space-y-3">
          {/* High Impact */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-impact-high font-semibold">⚡ High Impact</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {HIGH_IMPACT_EVENTS.map(type => (
                <button
                  key={type}
                  onClick={() => onManualEvent(type, selectedZone, 'Game-changing moment')}
                  className="text-[10px] px-2 py-1 bg-[hsl(var(--impact-high)/0.1)] border border-[hsl(var(--impact-high)/0.2)] rounded
                           hover:bg-[hsl(var(--impact-high)/0.25)] transition-all active:scale-[0.95] text-foreground"
                >
                  {EVENT_META[type].emoji} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Medium Impact */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-impact-medium font-semibold">🔶 Medium Impact</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {MEDIUM_IMPACT_EVENTS.map(type => (
                <button
                  key={type}
                  onClick={() => onManualEvent(type, selectedZone, 'Build-up play')}
                  className="text-[10px] px-2 py-1 bg-[hsl(var(--impact-medium)/0.1)] border border-[hsl(var(--impact-medium)/0.2)] rounded
                           hover:bg-[hsl(var(--impact-medium)/0.25)] transition-all active:scale-[0.95] text-foreground"
                >
                  {EVENT_META[type].emoji} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Low Impact */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-impact-low font-semibold">🟢 Low Impact</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {LOW_IMPACT_EVENTS.map(type => (
                <button
                  key={type}
                  onClick={() => onManualEvent(type, selectedZone, 'No shift')}
                  className="text-[10px] px-2 py-1 bg-[hsl(var(--impact-low)/0.1)] border border-[hsl(var(--impact-low)/0.2)] rounded
                           hover:bg-[hsl(var(--impact-low)/0.25)] transition-all active:scale-[0.95] text-foreground"
                >
                  {EVENT_META[type].emoji} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Significance */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Significance Override</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {SIGNIFICANCE_TYPES.slice(0, 5).map(sig => (
                <button
                  key={sig}
                  onClick={() => onManualEvent('Pass', selectedZone, sig)}
                  className="text-[10px] px-2 py-1 bg-secondary rounded hover:bg-gold hover:text-primary-foreground
                           transition-all active:scale-[0.95]"
                >
                  {sig}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
