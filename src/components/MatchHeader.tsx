import { useEffect, useState } from 'react';

interface MatchHeaderProps {
  minute: number;
  homeScore: number;
  awayScore: number;
  half: 1 | 2;
  isRunning: boolean;
}

export default function MatchHeader({ minute, homeScore, awayScore, half, isRunning }: MatchHeaderProps) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    if (!isRunning) return;
    const i = setInterval(() => setBlink(b => !b), 500);
    return () => clearInterval(i);
  }, [isRunning]);

  return (
    <div className="flex items-center justify-between bg-card rounded-lg px-6 py-3 border border-border">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {isRunning ? 'Live' : 'Paused'}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-lg font-bold tracking-tight">FC Dynamic</span>
        <div className="flex items-center gap-3 bg-secondary rounded-md px-4 py-1.5">
          <span className="text-2xl font-black tabular-nums">{homeScore}</span>
          <span className="text-muted-foreground font-medium">–</span>
          <span className="text-2xl font-black tabular-nums">{awayScore}</span>
        </div>
        <span className="text-lg font-bold tracking-tight">Micro United</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-mono text-xl font-bold tabular-nums">
            {String(minute).padStart(2, '0')}
            <span className={isRunning && !blink ? 'opacity-0' : ''}>′</span>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {half === 1 ? '1st Half' : '2nd Half'}
          </div>
        </div>
      </div>
    </div>
  );
}
