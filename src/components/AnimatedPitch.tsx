import { useEffect, useRef, useState, useCallback } from 'react';
import { ZoneId, ZONES } from '@/lib/match-engine';

interface Player {
  id: number;
  team: 'home' | 'away';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
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
  'def-left':    { x: 60,  y: 45 },
  'def-center':  { x: 60,  y: 100 },
  'def-right':   { x: 60,  y: 155 },
  'mid-left':    { x: 150, y: 45 },
  'mid-center':  { x: 150, y: 100 },
  'mid-right':   { x: 150, y: 155 },
  'att-left':    { x: 240, y: 45 },
  'att-center':  { x: 240, y: 100 },
  'att-right':   { x: 240, y: 155 },
};

function createPlayers(): Player[] {
  const players: Player[] = [];
  // Home team (left side) - positions spread across left half
  const homePositions = [
    { x: 15, y: 100, role: 'GK' },
    { x: 45, y: 40, role: 'LB' }, { x: 45, y: 75, role: 'CB' },
    { x: 45, y: 125, role: 'CB' }, { x: 45, y: 160, role: 'RB' },
    { x: 90, y: 50, role: 'LM' }, { x: 90, y: 100, role: 'CM' },
    { x: 90, y: 150, role: 'RM' },
    { x: 130, y: 45, role: 'LW' }, { x: 130, y: 100, role: 'ST' },
    { x: 130, y: 155, role: 'RW' },
  ];
  // Away team (right side)
  const awayPositions = [
    { x: 285, y: 100, role: 'GK' },
    { x: 255, y: 40, role: 'LB' }, { x: 255, y: 75, role: 'CB' },
    { x: 255, y: 125, role: 'CB' }, { x: 255, y: 160, role: 'RB' },
    { x: 210, y: 50, role: 'LM' }, { x: 210, y: 100, role: 'CM' },
    { x: 210, y: 150, role: 'RM' },
    { x: 170, y: 45, role: 'LW' }, { x: 170, y: 100, role: 'ST' },
    { x: 170, y: 155, role: 'RW' },
  ];

  homePositions.forEach((p, i) => {
    players.push({ id: i, team: 'home', x: p.x, y: p.y, targetX: p.x, targetY: p.y, role: p.role });
  });
  awayPositions.forEach((p, i) => {
    players.push({ id: 11 + i, team: 'away', x: p.x, y: p.y, targetX: p.x, targetY: p.y, role: p.role });
  });
  return players;
}

export default function AnimatedPitch({ selectedZone, onZoneSelect, lastEventZone, lastEventTeam, isRunning, minute, ballZone }: AnimatedPitchProps) {
  const [players, setPlayers] = useState<Player[]>(createPlayers);
  const [ballPos, setBallPos] = useState({ x: 150, y: 100 });
  const [eventFlash, setEventFlash] = useState(false);
  const animRef = useRef<number>();

  // Move ball to zone
  useEffect(() => {
    const center = ZONE_CENTERS[ballZone];
    const jitterX = (Math.random() - 0.5) * 30;
    const jitterY = (Math.random() - 0.5) * 20;
    setBallPos({ x: center.x + jitterX, y: center.y + jitterY });
  }, [ballZone]);

  // Flash on event
  useEffect(() => {
    if (lastEventZone) {
      setEventFlash(true);
      setTimeout(() => setEventFlash(false), 400);
    }
  }, [lastEventZone, minute]);

  // Animate players toward ball zone with natural movement
  useEffect(() => {
    if (!isRunning) return;

    const moveInterval = setInterval(() => {
      setPlayers(prev => prev.map(p => {
        const ballCenter = ZONE_CENTERS[ballZone];
        const isAttackingTeam = lastEventTeam === p.team;

        // Players gravitate toward ball zone with team-specific behavior
        let attractX = ballCenter.x;
        let attractY = ballCenter.y;

        if (p.role === 'GK') {
          // Goalkeepers stay near goal
          attractX = p.team === 'home' ? 15 : 285;
          attractY = 100 + (ballCenter.y - 100) * 0.3;
        } else if (p.role.includes('B')) {
          // Defenders: partial attraction
          const factor = isAttackingTeam ? 0.3 : 0.5;
          attractX = p.team === 'home'
            ? Math.min(ballCenter.x * factor + 30, 120)
            : Math.max(300 - (300 - ballCenter.x) * factor - 30, 180);
          attractY = ballCenter.y * 0.4 + p.y * 0.6;
        } else if (p.role.includes('M')) {
          // Midfielders: moderate attraction
          const factor = isAttackingTeam ? 0.6 : 0.4;
          attractX = ballCenter.x * factor + (p.team === 'home' ? 90 : 210) * (1 - factor);
          attractY = ballCenter.y * 0.5 + p.y * 0.5;
        } else {
          // Forwards: strong attraction when attacking
          const factor = isAttackingTeam ? 0.8 : 0.3;
          attractX = ballCenter.x * factor + (p.team === 'home' ? 200 : 100) * (1 - factor);
          attractY = ballCenter.y * 0.6 + p.y * 0.4;
        }

        // Add randomness for natural feel
        const jX = (Math.random() - 0.5) * 8;
        const jY = (Math.random() - 0.5) * 8;
        const speed = 0.08 + Math.random() * 0.04;

        const newX = Math.max(5, Math.min(295, p.x + (attractX + jX - p.x) * speed));
        const newY = Math.max(5, Math.min(195, p.y + (attractY + jY - p.y) * speed));

        return { ...p, x: newX, y: newY };
      }));
    }, 100);

    return () => clearInterval(moveInterval);
  }, [isRunning, ballZone, lastEventTeam]);

  const handleZoneClick = (zoneId: ZoneId) => {
    onZoneSelect(zoneId);
  };

  const flashCenter = lastEventZone ? ZONE_CENTERS[lastEventZone] : null;

  return (
    <div className="bg-pitch rounded-lg border border-border relative overflow-hidden">
      <svg viewBox="0 0 300 200" className="w-full" style={{ aspectRatio: '3/2' }}>
        {/* Pitch background */}
        <rect x="0" y="0" width="300" height="200" fill="hsl(142, 35%, 18%)" />

        {/* Pitch markings */}
        <rect x="2" y="2" width="296" height="196" fill="none" className="stroke-pitch-line" strokeWidth="1" opacity="0.5" />
        <line x1="150" y1="2" x2="150" y2="198" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <circle cx="150" cy="100" r="30" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <circle cx="150" cy="100" r="2" fill="hsl(142, 25%, 50%)" opacity="0.5" />
        {/* Left penalty area */}
        <rect x="2" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <rect x="2" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.6" opacity="0.3" />
        <circle cx="35" cy="100" r="1.5" fill="hsl(142, 25%, 50%)" opacity="0.4" />
        {/* Right penalty area */}
        <rect x="258" y="50" width="40" height="100" fill="none" className="stroke-pitch-line" strokeWidth="0.8" opacity="0.4" />
        <rect x="283" y="75" width="15" height="50" fill="none" className="stroke-pitch-line" strokeWidth="0.6" opacity="0.3" />
        <circle cx="265" cy="100" r="1.5" fill="hsl(142, 25%, 50%)" opacity="0.4" />
        {/* Goals */}
        <rect x="-2" y="85" width="4" height="30" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />
        <rect x="298" y="85" width="4" height="30" fill="none" stroke="white" strokeWidth="0.8" opacity="0.6" />

        {/* Clickable zones (invisible) */}
        {ZONES.map(zone => {
          const center = ZONE_CENTERS[zone.id];
          const isSelected = selectedZone === zone.id;
          return (
            <g key={zone.id} onClick={() => handleZoneClick(zone.id)} className="cursor-pointer">
              <rect
                x={center.x - 45}
                y={center.y - 30}
                width={90}
                height={65}
                fill={isSelected ? 'hsla(38, 78%, 52%, 0.08)' : 'transparent'}
                stroke={isSelected ? 'hsla(38, 78%, 52%, 0.3)' : 'transparent'}
                strokeWidth="0.5"
                rx="3"
              />
              <text
                x={center.x}
                y={zone.row === 0 ? center.y - 18 : zone.row === 2 ? center.y + 25 : center.y - 22}
                textAnchor="middle"
                fill="hsla(40, 20%, 94%, 0.2)"
                fontSize="6"
                fontWeight="500"
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        {/* Event flash effect */}
        {eventFlash && flashCenter && (
          <circle
            cx={flashCenter.x}
            cy={flashCenter.y}
            r="25"
            fill="none"
            stroke="hsl(38, 78%, 52%)"
            strokeWidth="1.5"
            opacity="0.6"
          >
            <animate attributeName="r" from="5" to="35" dur="0.4s" fill="freeze" />
            <animate attributeName="opacity" from="0.8" to="0" dur="0.4s" fill="freeze" />
          </circle>
        )}

        {/* Players */}
        {players.map(p => (
          <g key={p.id}>
            {/* Player shadow */}
            <ellipse
              cx={p.x}
              cy={p.y + 3}
              rx="3.5"
              ry="1.5"
              fill="rgba(0,0,0,0.3)"
            />
            {/* Player dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill={p.team === 'home' ? 'hsl(38, 78%, 52%)' : 'hsl(0, 0%, 95%)'}
              stroke={p.team === 'home' ? 'hsl(38, 78%, 65%)' : 'hsl(0, 0%, 80%)'}
              strokeWidth="0.8"
              style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
            />
            {/* Jersey number/role */}
            <text
              x={p.x}
              y={p.y + 1.5}
              textAnchor="middle"
              fill={p.team === 'home' ? 'hsl(24, 14%, 8%)' : 'hsl(24, 14%, 15%)'}
              fontSize="3.5"
              fontWeight="700"
            >
              {p.id < 11 ? p.id + 1 : p.id - 10}
            </text>
          </g>
        ))}

        {/* Ball */}
        <g style={{ transition: 'transform 0.3s ease-out' }}>
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r="3"
            fill="white"
            stroke="hsl(0, 0%, 70%)"
            strokeWidth="0.5"
          />
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r="1"
            fill="hsl(0, 0%, 40%)"
          />
          {/* Ball glow */}
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r="6"
            fill="none"
            stroke="hsl(38, 78%, 52%)"
            strokeWidth="0.3"
            opacity="0.4"
          />
        </g>
      </svg>

      <p className="text-[10px] text-center text-muted-foreground/60 py-1.5">
        Click a zone to set event location • Players move in real-time
      </p>
    </div>
  );
}
