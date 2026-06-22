import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  initial: number;
  notional?: number; // size in USDT for max position calc preview
  onConfirm: (lev: number) => void;
  onCancel: () => void;
}

const STOPS = [1, 2, 3, 5, 10, 25, 50, 100];
const MAX = 100;

export default function AdjustLeverageModal({ initial, notional = 1000, onConfirm, onCancel }: Props) {
  const [lev, setLev] = useState<number>(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const tooHigh = lev >= 25;
  const maxPosition = notional * lev;

  return (
    <div
      className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-foreground">Adjust Leverage</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="text-[12px] font-semibold text-foreground">Leverage</div>

          {/* Large display */}
          <div className="bg-secondary/60 border border-border rounded-md py-4 flex items-center justify-center">
            <span className="font-mono text-[28px] font-bold text-foreground tabular-nums">{lev}</span>
          </div>

          {/* Slider */}
          <div className="pt-2">
            <input
              type="range"
              min={1}
              max={MAX}
              step={1}
              value={lev}
              onChange={(e) => setLev(Number(e.target.value))}
              className="w-full accent-[hsl(var(--gold))] h-1.5"
              style={{
                background: `linear-gradient(to right, hsl(var(--gold)) 0%, hsl(var(--gold)) ${
                  ((lev - 1) / (MAX - 1)) * 100
                }%, hsl(var(--secondary)) ${((lev - 1) / (MAX - 1)) * 100}%, hsl(var(--secondary)) 100%)`,
                appearance: 'none',
                borderRadius: 9999,
              }}
            />
            <div className="mt-2 grid grid-cols-8 text-[10px] font-mono text-muted-foreground">
              {STOPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setLev(s)}
                  className={`hover:text-gold transition-colors text-center ${
                    lev === s ? 'text-gold font-bold' : ''
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {tooHigh && (
            <div className="text-[11px] leading-snug text-gold">
              The current leverage is too high. There is a high risk of immediate liquidation. Please adjust your position.
            </div>
          )}

          {/* Max position at current leverage */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[12px] text-muted-foreground">Max Position at Current Leverage</span>
            <span className="text-[13px] font-mono font-bold text-foreground tabular-nums">
              {maxPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
            </span>
          </div>

          <button className="text-[11px] text-gold hover:underline">Learn More</button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => onConfirm(lev)}
            className="rounded-full bg-gold text-primary-foreground font-bold text-[13px] py-3 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="rounded-full bg-transparent border border-border text-foreground font-bold text-[13px] py-3 hover:bg-secondary transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
