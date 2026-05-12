import { useStore } from '@/hooks/useStore';
import { MARKETS } from '@/lib/match-engine';

export default function LiveMatchStatePanel({ marketId }: { marketId: string }) {
  const rt = useStore(s => s.runtimes[marketId]);
  const market = MARKETS.find(m => m.id === marketId);
  if (!rt || !market) return null;

  const isLive = rt.state.isRunning;
  const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
  const events = rt.state.events;
  const homeEvents = events.filter(e => e.team === 'home').length;
  const awayEvents = events.filter(e => e.team === 'away').length;
  const total = homeEvents + awayEvents || 1;
  const homePoss = Math.round((homeEvents / total) * 100);
  const lastEv = events[events.length - 1];

  // momentum bar: -1 (away) → +1 (home), centered at 0
  const momPct = ((rt.state.momentum + 1) / 2) * 100;

  return (
    <div className="border border-border bg-card/40 rounded-md">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Live Match State</span>
        <div className="flex items-center gap-1.5">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            isLive ? 'bg-accent/15 text-accent' : isFinal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground'
          }`}>{isFinal ? 'FINAL' : isLive ? 'LIVE' : 'PRE-MATCH'}</span>
        </div>
      </div>
      <div className="p-3 space-y-3 font-mono">
        {/* score */}
        <div className="flex items-center justify-between text-[14px]">
          <div className="flex items-center gap-2">
            <span style={{ color: market.homeColor }} className="font-bold text-[11px]">{market.homeShort}</span>
            <span className="text-foreground font-black tabular-nums">{rt.state.homeScore}</span>
          </div>
          <span className="text-muted-foreground text-[10px] tabular-nums">{rt.state.minute}'</span>
          <div className="flex items-center gap-2">
            <span className="text-foreground font-black tabular-nums">{rt.state.awayScore}</span>
            <span style={{ color: market.awayColor }} className="font-bold text-[11px]">{market.awayShort}</span>
          </div>
        </div>

        {/* momentum */}
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground mb-1">Momentum</div>
          <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="absolute top-0 bottom-0 w-px bg-border left-1/2" />
            <div
              className="absolute top-0 bottom-0 transition-all"
              style={{
                left: rt.state.momentum >= 0 ? '50%' : `${momPct}%`,
                width: `${Math.abs(rt.state.momentum) * 50}%`,
                background: rt.state.momentum >= 0 ? market.homeColor : market.awayColor,
              }}
            />
          </div>
        </div>

        {/* possession proxy */}
        <div>
          <div className="flex justify-between text-[9px] mb-1">
            <span style={{ color: market.homeColor }}>{homePoss}%</span>
            <span className="text-muted-foreground uppercase tracking-wider text-[8px]">Possession</span>
            <span style={{ color: market.awayColor }}>{100 - homePoss}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
            <div className="transition-all" style={{ width: `${homePoss}%`, backgroundColor: market.homeColor }} />
            <div className="transition-all" style={{ width: `${100 - homePoss}%`, backgroundColor: market.awayColor }} />
          </div>
        </div>

        {/* commentary line */}
        {lastEv && (
          <div className="text-[10px] text-foreground/80 leading-snug border-t border-border/40 pt-2">
            <span className="text-muted-foreground tabular-nums">{lastEv.minute}' · </span>
            <span className="text-gold">{lastEv.type}</span>
            <span className="text-muted-foreground/70"> — {lastEv.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}
