import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function TpSlEducationCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-secondary/30 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-gold font-semibold hover:bg-secondary/50 transition-colors"
      >
        <span>How TP/SL Works</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-[10px] leading-relaxed text-muted-foreground space-y-1.5 border-t border-border pt-2">
          <p>TP and SL are <span className="text-foreground font-semibold">not sportsbook odds</span>. They do not generate profit.</p>
          <p><span className="text-gold font-semibold">Reality generates profit</span> — match events reprice contracts and your portfolio absorbs the move.</p>
          <p>TP and SL shape your portfolio's:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><span className="text-accent">Reward profile</span> — how much each contract realizes on success</li>
            <li><span className="text-destructive">Risk profile</span> — your maximum drawdown per contract</li>
            <li><span className="text-foreground">Conviction profile</span> — wider TP = stronger conviction</li>
            <li>Target portfolio outcome under reality evolution</li>
          </ul>
        </div>
      )}
    </div>
  );
}
