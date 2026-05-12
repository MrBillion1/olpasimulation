import { MARKETS } from '@/lib/match-engine';

// Deterministic, contract-specific intelligence (not external data, not random — stable per contract).
const H2H: Record<string, { last5: string; homeForm: string; awayForm: string; tactical: string; analog: string }> = {
  mcimun:  { last5: 'D-W-L-W-D', homeForm: 'W-W-W-D-W', awayForm: 'W-D-L-W-W', tactical: 'High-press symmetry; midfield density decides phase transitions.', analog: 'Closest analog: 2023-04 fixture (vol regime: medium).' },
  rmabar:  { last5: 'W-L-D-W-W', homeForm: 'W-W-D-W-W', awayForm: 'W-W-W-L-D', tactical: 'Madrid high line vs Barca rotational midfield — exploitable diagonals.', analog: 'Closest analog: Clásico 2024-10 (vol regime: high).' },
  acmint:  { last5: 'L-L-D-L-W', homeForm: 'D-W-L-D-W', awayForm: 'W-W-W-W-D', tactical: 'Inter wing-back overloads vs Milan narrow 4-2-3-1.', analog: 'Closest analog: Madonnina 2024-04 (vol regime: medium-high).' },
  psgmar:  { last5: 'W-D-W-W-L', homeForm: 'W-W-W-D-W', awayForm: 'L-W-D-L-W', tactical: 'Le Classique typically chaotic — high foul/card incidence.', analog: 'Closest analog: Le Classique 2023-09 (vol regime: chaotic).' },
  arstot:  { last5: 'W-W-D-L-W', homeForm: 'W-D-W-W-W', awayForm: 'W-L-W-D-W', tactical: 'Arsenal pressing triggers vs Spurs counter-geometry.', analog: 'Closest analog: NLD 2024-04 (vol regime: high).' },
  fcbbvb:  { last5: 'W-W-D-W-L', homeForm: 'W-W-D-W-W', awayForm: 'D-W-L-W-W', tactical: 'Klassiker — Bayern positional dominance vs BVB transition speed.', analog: 'Closest analog: Klassiker 2024-11 (vol regime: medium).' },
};

export default function H2HIntelligence({ marketId }: { marketId: string }) {
  const market = MARKETS.find(m => m.id === marketId);
  const data = H2H[marketId];
  if (!market || !data) return null;

  return (
    <div className="border border-border bg-card/40 rounded-md">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Market Intelligence</span>
      </div>
      <div className="p-3 space-y-2 text-[10px] font-mono">
        <Row label="H2H last 5" value={data.last5} />
        <Row label={`${market.homeShort} form`} value={data.homeForm} valueColor={market.homeColor} />
        <Row label={`${market.awayShort} form`} value={data.awayForm} valueColor={market.awayColor} />
        <div className="border-t border-border/40 pt-2 space-y-1.5">
          <div>
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Tactical Read</div>
            <div className="text-foreground/85 leading-snug text-[10px]">{data.tactical}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Historical Analog</div>
            <div className="text-foreground/85 leading-snug text-[10px]">{data.analog}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground uppercase tracking-wider text-[8px]">{label}</span>
      <span className="text-foreground tabular-nums" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  );
}
