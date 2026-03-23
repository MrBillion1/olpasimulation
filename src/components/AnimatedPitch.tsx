import { useEffect, useState } from 'react';
import { ZoneId, ZONES } from '@/lib/match-engine';

interface Player {
  id: number;
  team: 'home' | 'away';
  x: number;
  y: number;
  role: string;
}

interface AnimatedPitchProps {
  selectedZone: ZoneId;
  onZoneSelect: (zone: ZoneId) => void;
  lastEventZone?: ZoneId;
  lastEventTeam?: 'home' | 'away';
  isRunning: boolean;
  minute: number;
  ballZone: ZoneId;
}

const ZONE_CENTERS: Record<ZoneId, { x: number; y: number }> = {
  'def-left': { x: 60, y: 45 }, 'def-center': { x: 60, y: 100 }, 'def-right': { x: 60, y: 155 },
  'mid-left': { x: 150, y: 45 }, 'mid-center': { x: 150, y: 100 }, 'mid-right': { x: 150, y: 155 },
  'att-left': { x: 240, y: 45 }, 'att-center': { x: 240, y: 100 }, 'att-right': { x: 240, y: 155 },
};

function createPlayers(): Player[] {
  const homePositions = [
    { x: 15, y: 100, role: 'GK' },
    { x: 45, y: 40, role: 'LB' }, { x: 45, y: 75, role: 'CB' },
    { x: 45, y: 125, role: 'CB' }, { x: 45, y: 160, role: 'RB' },
    { x: 90, y: 50, role: 'LM' }, { x: 90, y: 100, role: 'CM' }, { x: 90, y: 150, role: 'RM' },
    { x: 130, y: 45, role: 'LW' }, { x: 130, y: 100, role: 'ST' }, { x: 130, y: 155, role: 'RW' },
  ];
  const awayPositions = [
    { x: 285, y: 100, role: 'GK' },
    { x: 255, y: 40, role: 'LB' }, { x: 255, y: 75, role: 'CB' },
    { x: 255, y: 125, role: 'CB' }, { x: 255, y: 160, role: 'RB' },
    { x: 210, y: 50, role: 'LM' }, { x: 210, y: 100, role: 'CM' }, { x: 210, y: 150, role: 'RM' },
    { x: 170, y: 45, role: 'LW' }, { x: 170, y: 100, role: 'ST' }, { x: 170, y: 155, role: 'RW' },
  ];
  return [
    ...homePositions.map((p, i) => ({ id: i, team: 'home' as const, ...p })),
    ...awayPositions.map((p, i) => ({ id: 11 + i, team: 'away' as const, ...p })),
  ];
}

export default function AnimatedPitch({ selectedZone, onZoneSelect, lastEventZone, lastEventTeam, isRunning, minute, ballZone }: AnimatedPitchProps) {
  const [players, setPlayers] = useState<Player[]>(createPlayers);
  const [ballPos, setBallPos] = useState({ x: 150, y: 100 });
  const [eventFlash, setEventFlash] = useState(false);

  useEffect(() => {
    const center = ZONE_CENTERS[ballZone];
    setBallPos({ x: center.x + (Math.random() - 0.5) * 30, y: center.y + (Math.random() - 0.5) * 20 });
  }, [ballZone]);

  useEffect(() => {
    if (lastEventZone) { setEventFlash(true); setTimeout(() => setEventFlash(false), 400); }
  }, [lastEventZone, minute]);

  useEffect(() => {
    if (!isRunning) return;
    const moveInterval = setInterval(() => {
      setPlayers(prev => prev.map(p => {
        const bc = ZONE_CENTERS[ballZone];
        const isAtt = lastEventTeam === p.team;
        let ax = bc.x, ay = bc.y;

        if (p.role === 'GK') {
          ax = p.team === 'home' ? 15 : 285;
          ay = 100 + (bc.y - 100) * 0.3;
        } else if (p.role.includes('B')) {
          const f = isAtt ? 0.3 : 0.5;
          ax = p.team === 'home' ? Math.min(bc.x * f + 30, 120) : Math.max(300 - (300 - bc.x) * f - 30, 180);
          ay = bc.y * 0.4 + p.y * 0.6;
        } else if (p.role.includes('M')) {
          const f = isAtt ? 0.6 : 0.4;
          ax = bc.x * f + (p.team === 'home' ? 90 : 210) * (1 - f);
          ay = bc.y * 0.5 + p.y * 0.5;
        } else {
          const f = isAtt ? 0.8 : 0.3;
          ax = bc.x * f + (p.team === 'home' ? 200 : 100) * (1 - f);
          ay = bc.y * 0.6 + p.y * 0.4;
        }

        const jX = (Math.random() - 0.5) * 8, jY = (Math.random() - 0.5) * 8;
        const speed = 0.08 + Math.random() * 0.04;
        return {
          ...p,
          x: Math.max(5, Math.min(295, p.x + (ax + jX - p.x) * speed)),
          y: Math.max(5, Math.min(195, p.y + (ay + jY - p.y) * speed)),
        };
      }));
    }, 100);
    return () => clearInterval(moveInterval);
  }, [isRunning, ballZone, lastEventTeam]);

  const flashCenter = lastEventZone ? ZONE_CENTERS[lastEventZone] : null;

  return (
    <div className="bg-pitch rounded-lg border border-border relative overflow-hidden">
      {/* Team legend */}
      <div className="absolute top-1 left-2 z-10 flex gap-3 text-[8px] font-semibold">
        <span className="text-[hsl(var(--sky-blue))]">● Man City</span>
        <span className="text-foreground/80">● Man United</span>
      </div>
      <svg viewBox="0 0 300 200" className="w-full" style={{ aspectRatio: '3/2' }}>
        <rect x="0" y="0" width="300" height="200" fill="hsl(142, 35%, 18%)" />
        <rect x="2" y="2" width="296" height="196" fill="none" className="stroke-pitch-line" strokeWidth="1" opacity="0.5" />
        <line x1="150" y1="2" x2="150" y2="198" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <circle cx="150" cy="100" r="30" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <circle cx="150" cy="100" r="2" fill="hsl(142, 25%, 50%)" opacity="0.5" />
        <rect x="2" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <rect x="2" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.6" opacity="0.3" />
        <rect x="258" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <rect x="283" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.6" opacity="0.3" />
        <rect x="-2" y="85" width="4" height="30" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />
        <rect x="298" y="85" width="4" height="30" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />

        {ZONES.map(zone => {
          const center = ZONE_CENTERS[zone.id];
          const isSelected = selectedZone === zone.id;
          return (
            <g key={zone.id} onClick={() => onZoneSelect(zone.id)} className="cursor-pointer">
              <rect x={center.x - 45} y={center.y - 30} width={90} height={65}
                fill={isSelected ? 'hsla(38, 78%, 52%, 0.08)' : 'transparent'}
                stroke={isSelected ? 'hsla(38, 78%, 52%, 0.3)' : 'transparent'}
                strokeWidth="0.5" rx="3" />
              <text x={center.x}
                y={zone.row === 0 ? center.y - 18 : zone.row === 2 ? center.y + 25 : center.y - 22}
                textAnchor="middle" fill="hsla(40, 20%, 94%, 0.2)" fontSize="6" fontWeight="500">
                {zone.label}
              </text>
            </g>
          );
        })}

        {eventFlash && flashCenter && (
          <circle cx={flashCenter.x} cy={flashCenter.y} r="25" fill="none"
            stroke="hsl(38, 78%, 52%)" strokeWidth="1.5" opacity="0.6">
            <animate attributeName="r" from="5" to="35" dur="0.4s" fill="freeze" />
            <animate attributeName="opacity" from="0.8" to="0" dur="0.4s" fill="freeze" />
          </circle>
        )}

        {players.map(p => (
          <g key={p.id}>
            <ellipse cx={p.x} cy={p.y + 3} rx="3.5" ry="1.5" fill="rgba(0,0,0,0.3)" />
            <circle cx={p.x} cy={p.y} r="4"
              fill={p.team === 'home' ? 'hsl(200, 70%, 55%)' : 'hsl(0, 68%, 50%)'}
              stroke={p.team === 'home' ? 'hsl(200, 70%, 70%)' : 'hsl(0, 50%, 70%)'}
              strokeWidth="0.8"
              style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }} />
            <text x={p.x} y={p.y + 1.5} textAnchor="middle" fill="white" fontSize="3.5" fontWeight="700">
              {p.id < 11 ? p.id + 1 : p.id - 10}
            </text>
          </g>
        ))}

        <g style={{ transition: 'transform 0.3s ease-out' }}>
          <circle cx={ballPos.x} cy={ballPos.y} r="3" fill="white" stroke="hsl(0, 0%, 70%)" strokeWidth="0.5" />
          <circle cx={ballPos.x} cy={ballPos.y} r="1" fill="hsl(0, 0%, 40%)" />
          <circle cx={ballPos.x} cy={ballPos.y} r="6" fill="none" stroke="hsl(38, 78%, 52%)" strokeWidth="0.3" opacity="0.4" />
        </g>
      </svg>
      <p className="text-[10px] text-center text-muted-foreground/60 py-1.5">
        Click a zone to set event location • Players move in real-time
      </p>
    </div>
  );
}
