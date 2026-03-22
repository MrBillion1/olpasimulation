import { useState } from 'react';
import { MatchEvent } from '@/lib/match-engine';

interface TradePanelProps {
  latestEvent?: MatchEvent;
}

export default function TradePanel({ latestEvent }: TradePanelProps) {
  const [balance, setBalance] = useState(1000);
  const [stake, setStake] = useState(50);
  const [trades, setTrades] = useState<{ type: string; amount: number; payout: number }[]>([]);

  if (!latestEvent) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Trade Panel</h3>
        <p className="text-muted-foreground/50 text-sm text-center py-4">Waiting for an event…</p>
      </div>
    );
  }

  const w = latestEvent.weight.final;
  const successPayout = Math.round(stake * (1 / w) * 100) / 100;
  const failPayout = Math.round(stake * (1 / (1 - w)) * 100) / 100;

  const handleTrade = (type: 'success' | 'failure') => {
    if (stake > balance || stake <= 0) return;
    const payout = type === 'success' ? successPayout : failPayout;
    const won = Math.random() < (type === 'success' ? w : 1 - w);
    setBalance(b => Math.round((b - stake + (won ? payout : 0)) * 100) / 100);
    setTrades(t => [{ type: type + (won ? ' ✓' : ' ✗'), amount: stake, payout: won ? payout : 0 }, ...t.slice(0, 4)]);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">Trade Panel</h3>
        <span className="font-mono text-sm font-bold text-gold tabular-nums">${balance.toFixed(2)}</span>
      </div>

      <div className="bg-secondary/50 rounded-md p-2.5 mb-3 border border-[hsl(var(--gold-muted))]">
        <p className="text-[11px] text-muted-foreground mb-1">
          {latestEvent.emoji} <span className="text-foreground font-medium">{latestEvent.type}</span> @ {latestEvent.minute}′
          <span className={`ml-1.5 text-[9px] uppercase font-semibold ${
            latestEvent.impact === 'high' ? 'text-impact-high' : latestEvent.impact === 'medium' ? 'text-impact-medium' : 'text-impact-low'
          }`}>{latestEvent.impact}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">Dynamic weight: <span className="font-mono font-bold text-foreground">{w.toFixed(2)}</span></p>
      </div>

      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Stake</label>
        <input
          type="range"
          min={10}
          max={Math.min(500, balance)}
          step={10}
          value={stake}
          onChange={e => setStake(Number(e.target.value))}
          className="w-full accent-[hsl(var(--gold))] h-1"
        />
        <div className="text-right font-mono text-xs text-muted-foreground">${stake}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => handleTrade('success')}
          className="bg-accent text-accent-foreground font-semibold text-xs py-2 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all"
        >
          Buy Success
          <div className="font-mono text-[10px] opacity-80">→ ${successPayout.toFixed(2)}</div>
        </button>
        <button
          onClick={() => handleTrade('failure')}
          className="bg-destructive text-destructive-foreground font-semibold text-xs py-2 rounded-md
                     hover:brightness-110 active:scale-[0.97] transition-all"
        >
          Buy Failure
          <div className="font-mono text-[10px] opacity-80">→ ${failPayout.toFixed(2)}</div>
        </button>
      </div>

      {trades.length > 0 && (
        <div className="space-y-1">
          {trades.map((t, i) => (
            <div key={i} className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>{t.type}</span>
              <span>-${t.amount} / +${t.payout.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
