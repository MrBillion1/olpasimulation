import { useState } from 'react';
import { Portfolio, portfolioMetrics, portfolioActions } from '@/lib/portfolio-store';

interface Props {
  portfolio: Portfolio;
  prices: Record<string, number>;
  mode: 'partial' | 'full';
  onClose: () => void;
}

export default function PortfolioCloseModal({ portfolio, prices, mode, onClose }: Props) {
  const m = portfolioMetrics(portfolio, prices);
  const [pct, setPct] = useState(25);
  const withdraw = mode === 'full' ? m.equity : Math.round((m.equity * pct) / 100 * 100) / 100;
  const newEquity = mode === 'full' ? 0 : Math.round((m.equity - withdraw) * 100) / 100;

  const confirm = () => {
    if (mode === 'full') portfolioActions.closeAll(portfolio.id, prices);
    else portfolioActions.partialClose(portfolio.id, withdraw, prices);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-gold/40 rounded-lg w-full max-w-sm">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[9px] uppercase tracking-widest text-gold font-bold">
            {mode === 'full' ? 'Close Portfolio' : 'Partial Close'}
          </div>
          <div className="text-[12px] font-mono font-bold text-foreground mt-0.5">{portfolio.name}</div>
        </div>

        <div className="p-4 space-y-3 text-[11px]">
          {mode === 'partial' && (
            <div>
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                <span>Withdraw</span>
                <span className="text-foreground font-mono font-bold">{pct}% · ${withdraw.toFixed(2)}</span>
              </div>
              <input
                type="range" min={1} max={100} step={1}
                value={pct} onChange={e => setPct(Number(e.target.value))}
                className="w-full accent-[hsl(var(--gold))] h-1"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Row label="Current Equity" value={`$${m.equity.toFixed(2)}`} />
            <Row label={mode === 'full' ? 'Final Settlement' : 'Withdraw'} value={`$${withdraw.toFixed(2)}`} tone="accent" />
            {mode === 'partial' && <Row label="New Equity" value={`$${newEquity.toFixed(2)}`} />}
            <Row label="Aggregate PnL" value={`${m.aggPnl >= 0 ? '+' : ''}$${m.aggPnl.toFixed(2)}`} tone={m.aggPnl >= 0 ? 'accent' : 'destructive'} />
          </div>

          <p className="text-[9px] text-muted-foreground border-t border-border pt-2 leading-relaxed">
            {mode === 'full'
              ? 'All active contracts will settle at their current mark price and the equity will be returned to your account.'
              : 'Funds are withdrawn from portfolio equity without closing contracts. Exposure stays the same; health weakens.'}
          </p>
        </div>

        <div className="p-3 border-t border-border grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="text-[10px] py-2 rounded bg-secondary text-muted-foreground hover:text-foreground uppercase tracking-wider font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="text-[10px] py-2 rounded bg-gold text-primary-foreground uppercase tracking-wider font-bold hover:brightness-110"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'destructive' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="bg-secondary/40 border border-border rounded px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[11px] font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
