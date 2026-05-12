import { useState } from 'react';
import type { OpenTrade } from '@/lib/simulation-store';

interface Props {
  openTrades: OpenTrade[];
  onCancel: () => void;
  onConfirm: (tradeId: number) => void;
}

// Two-stage modal:
//   Stage 1 — disclosure (what becomes public vs private), pick a position.
//   Stage 2 — final irreversible-feeling confirmation.

export default function ConvictionAttachDialog({ openTrades, onCancel, onConfirm }: Props) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<number | null>(openTrades[0]?.id ?? null);
  const selected = openTrades.find(t => t.id === selectedId);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-4" onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-md w-full max-w-md shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gold uppercase tracking-widest">Proof-of-Conviction</span>
            <span className="text-[9px] text-muted-foreground font-mono">Step {stage}/2</span>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-sm leading-none">×</button>
        </div>

        {stage === 1 && (
          <div className="p-4 space-y-4">
            <div className="text-[12px] text-foreground/90 leading-snug">
              Attaching a live position turns this post into a verifiable conviction.
              ROI updates publicly in real time as the match unfolds.
            </div>

            <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
              <div className="border border-accent/30 bg-accent/5 rounded p-2">
                <div className="text-accent uppercase tracking-wider text-[8px] font-bold mb-1">Visible</div>
                <ul className="space-y-0.5 text-foreground/80">
                  <li>· Contract</li>
                  <li>· Direction (long/short)</li>
                  <li>· Live ROI %</li>
                </ul>
              </div>
              <div className="border border-destructive/30 bg-destructive/5 rounded p-2">
                <div className="text-destructive uppercase tracking-wider text-[8px] font-bold mb-1">Hidden</div>
                <ul className="space-y-0.5 text-foreground/80">
                  <li>· Position size</li>
                  <li>· Leverage</li>
                  <li>· Liquidation price</li>
                  <li>· Wallet balance</li>
                </ul>
              </div>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Select position</div>
              <div className="space-y-1 max-h-44 overflow-y-auto custom-scrollbar">
                {openTrades.map(t => {
                  const sel = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full flex items-center justify-between text-left p-2 rounded border text-[10px] font-mono transition-colors ${
                        sel ? 'border-gold bg-gold/10' : 'border-border bg-secondary/30 hover:bg-secondary/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gold font-bold">{t.contract}</span>
                        <span className={`uppercase font-bold ${t.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                          {t.direction}
                        </span>
                      </div>
                      <span className="text-muted-foreground">entry ${t.entryPrice.toFixed(4)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onCancel} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={() => setStage(2)}
                disabled={!selected}
                className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {stage === 2 && selected && (
          <div className="p-4 space-y-4">
            <div className="text-[12px] text-foreground leading-snug">
              Confirm public attachment of:
            </div>
            <div className="border border-gold/40 bg-gold/5 rounded p-3 font-mono text-[11px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gold font-bold">{selected.contract}</span>
                <span className={`uppercase font-bold ${selected.direction === 'long' ? 'text-accent' : 'text-destructive'}`}>
                  {selected.direction}
                </span>
              </div>
              <span className="text-foreground tabular-nums">entry ${selected.entryPrice.toFixed(4)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-snug">
              You can detach visibility at any time. Detaching does not close the position
              and does not affect market state — it only removes the public conviction badge from this post.
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setStage(1)} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-3 py-1.5">
                Back
              </button>
              <button
                onClick={() => onConfirm(selected.id)}
                className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded bg-gold text-primary-foreground hover:brightness-110"
              >
                Confirm Public Attachment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
