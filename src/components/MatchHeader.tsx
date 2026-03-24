import { useEffect, useState } from 'react';

interface MatchHeaderProps {
  minute: number;
  homeScore: number;
  awayScore: number;
  half: 1 | 2;
  isRunning: boolean;
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
  contract: string;
  varActive: boolean;
}

export default function MatchHeader({ minute, homeScore, awayScore, half, isRunning, homeTeam, awayTeam, homeColor, awayColor, contract, varActive }: MatchHeaderProps) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    if (!isRunning) return;
    const i = setInterval(() => setBlink(b => !b), 500);
    return () => clearInterval(i);
  }, [isRunning]);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="bg-secondary/60 border-b border-border px-4 py-1.5 flex items-center justify-center gap-2">
        <span className="font-mono text-xs font-bold text-gold tracking-wider">{contract}</span>
        <span className="text-[9px] text-muted-foreground">• Micro-Event Market</span>
        {varActive && (
          <span className="text-[9px] text-impact-high font-bold ml-2 animate-pulse">⏸ VAR</span>
        )}
      </div>

      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${varActive ? 'bg-impact-high animate-pulse' : isRunning ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {varActive ? 'VAR' : isRunning ? 'Live' : 'Paused'}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-lg font-bold tracking-tight" style={{ color: homeColor }}>{homeTeam}</span>
            <p className="text-[9px] text-muted-foreground">Home</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary rounded-md px-4 py-1.5 border border-[hsl(var(--gold-muted))]">
            <span className="text-2xl font-black tabular-nums">{homeScore}</span>
            <span className="text-muted-foreground font-medium">–</span>
            <span className="text-2xl font-black tabular-nums">{awayScore}</span>
          </div>
          <div className="text-left">
            <span className="text-lg font-bold tracking-tight" style={{ color: awayColor }}>{awayTeam}</span>
            <p className="text-[9px] text-muted-foreground">Away</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-xl font-bold tabular-nums text-gold">
              {String(minute).padStart(2, '0')}
              <span className={isRunning && !blink ? 'opacity-0' : ''}>′</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {half === 1 ? '1st Half' : '2nd Half'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
