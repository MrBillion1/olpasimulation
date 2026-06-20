import { DraftContract, computeDraft } from '@/lib/portfolio-math';

interface Props {
  name: string;
  margin: number;
  contracts: DraftContract[];
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PortfolioConfirmModal({ name, margin, contracts, onCancel, onConfirm }: Props) {
  const calc = computeDraft(contracts, margin);

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-gold/50 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[9px] uppercase tracking-widest text-gold font-bold">Confirm Portfolio</div>
          <div className="text-[14px] font-mono font-bold text-foreground mt-0.5">{name}</div>
        </div>

        <div className="p-4 space-y-3 text-[11px]">
          {/* Top stats */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Margin" value={`$${margin.toFixed(2)}`} />
            <Stat label="Exposure" value={`$${calc.totalExposure.toFixed(2)}`} />
            <Stat label="Eff. Leverage" value={`${calc.effectiveLeverage.toFixed(2)}x`} />
            <Stat label="Reward / Risk" value={calc.rewardRisk.toFixed(2)} />
            <Stat label="Target Payout" value={`+$${calc.targetPayout.toFixed(2)}`} tone="accent" />
            <Stat label="Max Drawdown" value={`-$${calc.maxDrawdown.toFixed(2)}`} tone="destructive" />
            <Stat label="Conviction" value={`${calc.convictionScore}/100`} />
            <Stat label="Risk Score" value={`${calc.riskScore}/100`} />
          </div>

          {/* Contract list */}
          <div className="space-y-1.5">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Contracts ({contracts.length})</div>
            {contracts.map((c, i) => (
              <div key={i} className="bg-secondary/40 border border-border rounded p-2 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{c.contract}</span>
                  <span className={c.direction === 'long' ? 'text-accent' : 'text-destructive'}>
                    {c.direction.toUpperCase()} · {c.leverage}x
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-muted-foreground">
                  <span>TP +{c.tpPct}% · SL -{c.slPct}%</span>
                  <span>${calc.margins[i].toFixed(2)} → ${calc.exposures[i].toFixed(2)}</span>
                </div>
                {/* Allocation bar */}
                <div className="mt-1 h-1 bg-secondary rounded overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${calc.weights[i] * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground leading-relaxed border-t border-border pt-2">
            By confirming, ${margin.toFixed(2)} of your available margin is committed to this portfolio.
            Reality will reprice contracts in real time; TP/SL define your reward and risk envelope.
          </p>
        </div>

        <div className="p-3 border-t border-border grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="text-[10px] py-2 rounded bg-secondary text-muted-foreground hover:text-foreground uppercase tracking-wider font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-[10px] py-2 rounded bg-gold text-primary-foreground uppercase tracking-wider font-bold hover:brightness-110"
          >
            Confirm Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'destructive' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="bg-secondary/40 border border-border rounded px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[12px] font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
