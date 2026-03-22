import { ZoneId, ZONES } from '@/lib/match-engine';
import { useState } from 'react';

interface PitchViewProps {
  selectedZone: ZoneId;
  onZoneSelect: (zone: ZoneId) => void;
  lastEventZone?: ZoneId;
}

export default function PitchView({ selectedZone, onZoneSelect, lastEventZone }: PitchViewProps) {
  const [clickedZone, setClickedZone] = useState<ZoneId | null>(null);

  const handleClick = (zoneId: ZoneId) => {
    setClickedZone(zoneId);
    onZoneSelect(zoneId);
    setTimeout(() => setClickedZone(null), 150);
  };

  return (
    <div className="bg-pitch rounded-lg p-3 border border-border relative overflow-hidden">
      {/* Pitch markings overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 200" preserveAspectRatio="none">
        <line x1="150" y1="0" x2="150" y2="200" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.4" />
        <circle cx="150" cy="100" r="30" fill="none" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.4" />
        <rect x="0" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.4" />
        <rect x="260" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.4" />
        <rect x="0" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.3" />
        <rect x="285" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.5" opacity="0.3" />
      </svg>

      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 relative z-10" style={{ aspectRatio: '3/2' }}>
        {ZONES.map(zone => {
          const isSelected = selectedZone === zone.id;
          const isLast = lastEventZone === zone.id;
          const isClicked = clickedZone === zone.id;
          
          return (
            <button
              key={zone.id}
              onClick={() => handleClick(zone.id)}
              className={`
                rounded-md flex items-center justify-center text-xs font-medium
                transition-all duration-200 cursor-pointer border
                ${isClicked ? 'animate-zone-click' : ''}
                ${isSelected 
                  ? 'bg-[hsl(var(--gold)/0.2)] border-[hsl(var(--gold)/0.5)] text-gold shadow-[0_0_12px_hsl(var(--gold)/0.2)]' 
                  : isLast 
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-background/10 border-border/30 text-foreground/60 hover:bg-background/20 hover:border-[hsl(var(--gold)/0.3)]'
                }
              `}
              style={{ order: zone.row * 3 + zone.col }}
            >
              <span className="text-[11px] tracking-wide">{zone.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-center text-muted-foreground/60 mt-2">Click a zone to set event location</p>
    </div>
  );
}
