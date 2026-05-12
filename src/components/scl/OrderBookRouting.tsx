import { useStore } from '@/hooks/useStore';

// Visualizes deterministic CLOB ⇄ ELP ⇄ AMM routing badge
// based on current liquidity heuristics (event impact + momentum).

export default function OrderBookRouting({ marketId }: { marketId: string }) {
  const rt = useStore(s => s.runtimes[marketId]);
  if (!rt) return null;
  const lastEv = rt.state.events[rt.state.events.length - 1];
  const impact = lastEv?.impact ?? 'low';

  // routing logic: high impact -> AMM (depth fallback), medium -> ELP (price-improved), low -> CLOB
  let active: 'CLOB' | 'ELP' | 'AMM' = 'CLOB';
  if (impact === 'high' || rt.state.varActive) active = 'AMM';
  else if (impact === 'medium') active = 'ELP';

  const venues: { key: 'CLOB' | 'ELP' | 'AMM'; label: string; sub: string }[] = [
    { key: 'CLOB', label: 'CLOB', sub: 'central book' },
    { key: 'ELP',  label: 'ELP',  sub: 'price-improved' },
    { key: 'AMM',  label: 'AMM',  sub: 'depth backstop' },
  ];

  return (
    <div className="border border-border bg-card/40 rounded-md p-2">
      <div className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1.5">Liquidity Routing</div>
      <div className="flex items-center gap-1">
        {venues.map((v, i) => (
          <div key={v.key} className="flex items-center gap-1 flex-1">
            <div className={`flex-1 rounded px-1.5 py-1 text-center transition-colors ${
              active === v.key ? 'bg-gold/20 border border-gold/50' : 'bg-secondary/40 border border-border'
            }`}>
              <div className={`text-[9px] font-bold font-mono ${active === v.key ? 'text-gold' : 'text-muted-foreground'}`}>{v.label}</div>
              <div className="text-[7px] text-muted-foreground/70 uppercase tracking-wider">{v.sub}</div>
            </div>
            {i < venues.length - 1 && (
              <span className={`text-[10px] ${active === v.key || active === venues[i + 1].key ? 'text-gold' : 'text-muted-foreground/30'}`}>⇄</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
