import { useStore } from '@/hooks/useStore';
import { MARKETS } from '@/lib/match-engine';

export default function ComputedPricingPanel({ marketId }: { marketId: string }) {
  const rt = useStore(s => s.runtimes[marketId]);
  const market = MARKETS.find(m => m.id === marketId);
  if (!rt || !market) return null;

  const txs = [...rt.pricingTransitions].reverse().slice(0, 12);

  return (
    <div className="border border-border bg-card/40 rounded-md">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Computed Pricing</span>
        <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">Reality reprices the market</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto custom-scrollbar">
        {txs.length === 0 && (
          <div className="px-3 py-4 text-[10px] text-muted-foreground text-center">No material repricing yet — awaiting state transitions.</div>
        )}
        {txs.map(tx => {
          const delta = tx.toPrice - tx.fromPrice;
          const up = delta >= 0;
          const pct = (delta / tx.fromPrice) * 100;
          return (
            <div key={tx.id} className="px-3 py-1.5 border-b border-border/40 text-[10px] font-mono flex items-start gap-2">
              <div className="w-8 text-muted-foreground shrink-0">{tx.minute}'</div>
              <div className={`shrink-0 w-1 self-stretch rounded ${up ? 'bg-accent' : 'bg-destructive'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground font-semibold">{tx.trigger}</span>
                  <span className={`tabular-nums font-bold ${up ? 'text-accent' : 'text-destructive'}`}>
                    {up ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </div>
                <div className="text-muted-foreground/80 text-[9px] truncate">{tx.rationale}</div>
                <div className="text-muted-foreground text-[9px] tabular-nums">
                  ${tx.fromPrice.toFixed(4)} → ${tx.toPrice.toFixed(4)} · w {tx.weight.toFixed(2)} · {tx.team}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
