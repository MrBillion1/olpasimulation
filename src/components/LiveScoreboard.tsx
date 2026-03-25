import { MarketConfig, MatchEvent } from '@/lib/match-engine';

interface MarketRuntime {
  state: {
    minute: number;
    homeScore: number;
    awayScore: number;
    half: 1 | 2;
    isRunning: boolean;
    varActive: boolean;
    events: MatchEvent[];
  };
  currentPrice: number;
}

interface LiveScoreboardProps {
  markets: MarketConfig[];
  runtimes: Record<string, MarketRuntime>;
  activeMarketId: string;
  onSelectMarket: (id: string) => void;
}

export default function LiveScoreboard({ markets, runtimes, activeMarketId, onSelectMarket }: LiveScoreboardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        📊 Live Scores & Summary
      </h3>
      <div className="space-y-1.5">
        {markets.map(m => {
          const rt = runtimes[m.id];
          if (!rt) return null;
          const active = m.id === activeMarketId;
          const lastEvent = rt.state.events[rt.state.events.length - 1];
          const goals = rt.state.events.filter(e => e.type === 'Goal' || e.type === 'Penalty' || e.type === 'Own Goal');
          const cards = rt.state.events.filter(e => e.type === 'Yellow Card' || e.type === 'Red Card');
          const shots = rt.state.events.filter(e => e.type === 'Shot on Target');
          const pChange = rt.currentPrice - m.startPrice;
          const pChangePct = m.startPrice > 0 ? (pChange / m.startPrice * 100) : 0;
          const isUp = pChange >= 0;

          return (
            <button
              key={m.id}
              onClick={() => onSelectMarket(m.id)}
              className={`w-full text-left rounded-md p-2 transition-all ${
                active ? 'bg-secondary border border-[hsl(var(--gold-muted))]' : 'bg-secondary/30 hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {rt.state.isRunning && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  )}
                  <span className="font-mono text-[10px] text-gold font-bold">{m.contract.split('/')[0]}</span>
                  <span className="text-[9px] text-muted-foreground font-mono">{rt.state.minute}'</span>
                  {rt.state.varActive && <span className="text-[8px] text-impact-high font-bold">VAR</span>}
                </div>
                <span className={`font-mono text-[10px] font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
                  ${rt.currentPrice.toFixed(4)} {isUp ? '▲' : '▼'}{Math.abs(pChangePct).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px]">
                  <span style={{ color: m.homeColor }} className="font-semibold">{m.homeShort}</span>
                  <span className="font-mono font-black text-foreground">{rt.state.homeScore} - {rt.state.awayScore}</span>
                  <span style={{ color: m.awayColor }} className="font-semibold">{m.awayShort}</span>
                </div>
                <div className="flex gap-2 text-[8px] text-muted-foreground">
                  <span>🎯{shots.length}</span>
                  <span>🟨{cards.length}</span>
                  <span>⚽{goals.length}</span>
                </div>
              </div>

              {lastEvent && (
                <div className="text-[8px] text-muted-foreground/70 mt-0.5 truncate">
                  {lastEvent.minute}' — {lastEvent.emoji} {lastEvent.type} ({lastEvent.team === 'home' ? m.homeShort : m.awayShort})
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
