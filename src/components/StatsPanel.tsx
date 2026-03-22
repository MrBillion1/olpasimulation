import { MatchEvent } from '@/lib/match-engine';

interface StatsPanelProps {
  events: MatchEvent[];
  momentum: number;
  half: 1 | 2;
}

export default function StatsPanel({ events, momentum, half }: StatsPanelProps) {
  const halfEvents = events.filter(e => half === 1 ? e.minute <= 45 : e.minute > 45);
  const avgWeight = halfEvents.length > 0
    ? halfEvents.reduce((s, e) => s + e.weight.final, 0) / halfEvents.length
    : 0;

  const homeEvents = events.filter(e => e.team === 'home').length;
  const awayEvents = events.filter(e => e.team === 'away').length;

  const momentumPct = Math.round((momentum + 1) / 2 * 100);

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Match Stats</h3>

      {/* Momentum bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>FC Dynamic</span>
          <span>Momentum</span>
          <span>Micro United</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${momentumPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-secondary/50 rounded-md py-2 px-1">
          <div className="font-mono text-lg font-bold tabular-nums">{events.length}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Events</div>
        </div>
        <div className="bg-secondary/50 rounded-md py-2 px-1">
          <div className="font-mono text-lg font-bold tabular-nums">{avgWeight.toFixed(2)}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Weight</div>
        </div>
        <div className="bg-secondary/50 rounded-md py-2 px-1">
          <div className="font-mono text-lg font-bold tabular-nums">{homeEvents}–{awayEvents}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">H / A</div>
        </div>
      </div>
    </div>
  );
}
