import { Link } from 'react-router-dom';

/**
 * OlpaDEX brand mark — sourced from olpaprototype.lovable.app.
 * Soft amber-glowing circular badge + "Olpa" (serif italic-feel) + "DEX" in gold serif.
 */
export default function OlpaBrand({ to = '/' }: { to?: string }) {
  const inner = (
    <div className="flex items-center gap-2 group select-none">
      <div className="relative w-7 h-7 shrink-0">
        <div className="absolute inset-0 rounded-full bg-gold/15 blur-md group-hover:bg-gold/25 transition-colors" />
        <div className="relative w-7 h-7 rounded-full border border-gold/50 bg-gradient-to-br from-gold/30 to-gold/5 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gold" fill="currentColor" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
          </svg>
        </div>
      </div>
      <div className="flex items-baseline">
        <span className="font-serif text-[18px] leading-none tracking-tight text-foreground font-semibold">Olpa</span>
        <span className="font-serif text-[18px] leading-none tracking-tight text-gold font-bold">DEX</span>
      </div>
    </div>
  );
  return to ? <Link to={to} className="shrink-0">{inner}</Link> : inner;
}
