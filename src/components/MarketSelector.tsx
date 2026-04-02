import { MarketConfig } from '@/lib/match-engine';

interface MarketSelectorProps {
  markets: MarketConfig[];
  activeMarketId: string;
  onSelectMarket: (id: string) => void;
  prices: Record<string, number>;
  priceChanges: Record<string, number>;
  matchMinutes: Record<string, number>;
  isRunning: Record<string, boolean>;
  onStartAll: () => void;
}

export default function MarketSelector({
  markets, activeMarketId, onSelectMarket, prices, priceChanges, matchMinutes, isRunning, onStartAll,
}: MarketSelectorProps) {
  return (
    <div className="w-full">
      {/* Contracts in a single horizontal line */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
        {markets.map(m => {
          const active = m.id === activeMarketId;
          const price = prices[m.id] ?? m.startPrice;
          const change = priceChanges[m.id] ?? 0;
          const changePct = m.startPrice > 0 ? (change / m.startPrice * 100) : 0;
          const isUp = change >= 0;
          const minute = matchMinutes[m.id] ?? 0;
          const running = isRunning[m.id] ?? false;

          return (
            <button
              key={m.id}
              onClick={() => onSelectMarket(m.id)}
              className={`relative shrink-0 rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.98] ${
                active
                  ? 'border-[hsl(var(--gold))] bg-card shadow-[0_0_12px_hsl(var(--gold)/0.15)]'
                  : 'border-border bg-card/60 hover:border-[hsl(var(--gold-muted))] hover:bg-card'
              }`}
            >
              {running && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[7px] text-accent font-semibold">LIVE</span>
                </div>
              )}

              <div className="font-mono text-[10px] font-bold text-gold tracking-wider">
                {m.contract}
              </div>

              <div className="text-[8px] text-muted-foreground mt-0.5">
                <span style={{ color: m.homeColor }}>{m.homeShort}</span>
                <span className="mx-0.5 text-muted-foreground/40">vs</span>
                <span style={{ color: m.awayColor }}>{m.awayShort}</span>
              </div>

              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-mono text-xs font-black tabular-nums text-foreground">
                  ${price.toFixed(2)}
                </span>
                <span className={`font-mono text-[8px] font-bold ${isUp ? 'text-accent' : 'text-destructive'}`}>
                  {isUp ? '▲' : '▼'}{Math.abs(changePct).toFixed(1)}%
                </span>
              </div>

              <div className="text-[7px] text-muted-foreground font-mono mt-0.5">
                {minute > 0 ? `${minute}'` : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {/* AUTO button below */}
      <button
        onClick={onStartAll}
        className="mt-2 w-full bg-gold text-primary-foreground font-semibold text-[11px] px-4 py-2 rounded-md
                   hover:brightness-110 active:scale-[0.98] transition-all uppercase tracking-wider"
      >
        ▶ AUTO — Start All Contracts
      </button>
    </div>
  );
}
