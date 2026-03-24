import { MarketConfig } from '@/lib/match-engine';

interface MarketSelectorProps {
  markets: MarketConfig[];
  activeMarketId: string;
  onSelectMarket: (id: string) => void;
  prices: Record<string, number>;
  priceChanges: Record<string, number>;
  matchMinutes: Record<string, number>;
  isRunning: Record<string, boolean>;
}

export default function MarketSelector({
  markets, activeMarketId, onSelectMarket, prices, priceChanges, matchMinutes, isRunning,
}: MarketSelectorProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {markets.map(m => {
        const active = m.id === activeMarketId;
        const price = prices[m.id] ?? m.startPrice;
        const change = priceChanges[m.id] ?? 0;
        const changePct = m.startPrice > 0 ? ((change) / m.startPrice * 100) : 0;
        const isUp = change >= 0;
        const minute = matchMinutes[m.id] ?? 0;
        const running = isRunning[m.id] ?? false;

        return (
          <button
            key={m.id}
            onClick={() => onSelectMarket(m.id)}
            className={`relative rounded-lg border p-3 text-left transition-all active:scale-[0.98] ${
              active
                ? 'border-[hsl(var(--gold))] bg-card shadow-[0_0_12px_hsl(var(--gold)/0.15)]'
                : 'border-border bg-card/60 hover:border-[hsl(var(--gold-muted))] hover:bg-card'
            }`}
          >
            {/* Live indicator */}
            {running && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[8px] text-accent font-semibold">LIVE</span>
              </div>
            )}

            {/* Contract name */}
            <div className="font-mono text-xs font-bold text-gold tracking-wider mb-1">
              {m.contract}
            </div>

            {/* Team names */}
            <div className="text-[10px] text-muted-foreground mb-2">
              <span style={{ color: m.homeColor }}>{m.homeTeam}</span>
              <span className="mx-1 text-muted-foreground/40">vs</span>
              <span style={{ color: m.awayColor }}>{m.awayTeam}</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-black tabular-nums text-foreground">
                ${price.toFixed(2)}
              </span>
              <span className={`font-mono text-[10px] font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
              </span>
            </div>

            {/* Minute */}
            <div className="text-[9px] text-muted-foreground font-mono mt-1">
              {minute > 0 ? `${minute}'` : 'Not started'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
