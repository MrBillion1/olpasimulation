import { MatchEvent, getSignificanceDescription } from '@/lib/match-engine';

interface EventFeedProps {
  events: MatchEvent[];
}

function weightColor(w: number): string {
  if (w >= 0.65) return 'text-weight-high';
  if (w >= 0.40) return 'text-weight-mid';
  return 'text-weight-low';
}

function weightBg(w: number): string {
  if (w >= 0.65) return 'bg-[hsl(var(--weight-high))]';
  if (w >= 0.40) return 'bg-[hsl(var(--weight-mid))]';
  return 'bg-[hsl(var(--weight-low))]';
}

function formatMod(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

export default function EventFeed({ events }: EventFeedProps) {
  const reversed = [...events].reverse();

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 px-1">
        Live Event Feed
      </h3>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
        {reversed.length === 0 && (
          <p className="text-muted-foreground/50 text-sm text-center py-8">No events yet. Start the match or trigger an event.</p>
        )}
        {reversed.map((ev, i) => (
          <div
            key={ev.id}
            className={`bg-card border border-border rounded-lg p-3 ${i === 0 ? 'animate-event-flash' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                  {String(ev.minute).padStart(2, '0')}′
                </span>
                <span className="text-sm font-semibold">{ev.type}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{ev.team}</span>
              </div>
              <span className={`font-mono font-bold text-lg tabular-nums ${weightColor(ev.weight.final)}`}>
                {ev.weight.final.toFixed(2)}
              </span>
            </div>

            {/* Weight breakdown */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              {[
                { label: 'Base', value: ev.weight.base },
                { label: 'Zone', value: ev.weight.zone },
                { label: 'Sig.', value: ev.weight.significance },
                { label: 'Time', value: ev.weight.time },
              ].map(item => (
                <div key={item.label} className="bg-secondary/50 rounded px-1.5 py-1 text-center">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</div>
                  <div className="font-mono text-xs font-medium tabular-nums">
                    {item.label === 'Base' ? item.value.toFixed(2) : formatMod(item.value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Weight bar */}
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full animate-weight-fill ${weightBg(ev.weight.final)}`}
                style={{ '--weight-pct': `${ev.weight.final * 100}%` } as React.CSSProperties}
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {getSignificanceDescription(ev.significance, ev.weight.final)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
