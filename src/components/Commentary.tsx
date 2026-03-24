import { MatchEvent } from '@/lib/match-engine';
import { useEffect, useRef } from 'react';

interface CommentaryProps {
  events: MatchEvent[];
  homeTeam: string;
  awayTeam: string;
  homePlayers: string[];
  awayPlayers: string[];
}

function getPlayer(team: 'home' | 'away', homePlayers: string[], awayPlayers: string[]): string {
  const names = team === 'home' ? homePlayers : awayPlayers;
  return names[Math.floor(Math.random() * names.length)];
}

function generateCommentary(ev: MatchEvent, homeTeam: string, awayTeam: string, homePlayers: string[], awayPlayers: string[]): string {
  const player = getPlayer(ev.team, homePlayers, awayPlayers);
  const teamName = ev.team === 'home' ? homeTeam : awayTeam;

  switch (ev.type) {
    case 'Goal': return `⚽ GOOOAL! ${player} scores for ${teamName}! The crowd erupts!`;
    case 'Red Card': return `🟥 RED CARD! ${player} is sent off! ${teamName} down to ${Math.floor(Math.random() * 2) + 9} men!`;
    case 'Penalty': return `⚠️ PENALTY to ${teamName}! ${player} steps up to the spot...`;
    case 'Own Goal': return `⚽ OWN GOAL! Disaster for ${teamName} as ${player} puts it into his own net!`;
    case 'VAR Review': return `📺 VAR REVIEW! The referee has stopped play — checking ${player}'s involvement. Penda mode activated.`;
    case 'Shot on Target': return `🎯 ${player} fires a shot on target! The keeper is tested!`;
    case 'Corner': return `📐 Corner kick for ${teamName}. ${player} will deliver it.`;
    case 'Free Kick': return `🦶 Free kick in a dangerous position. ${player} stands over the ball.`;
    case 'Yellow Card': return `🟨 Yellow card shown to ${player}. He needs to be careful now.`;
    case 'Offside': return `🚩 Flag goes up — ${player} caught offside.`;
    case 'Pass': return `${player} distributes the ball neatly for ${teamName}.`;
    case 'Tackle': return `🦵 Crunching tackle by ${player}! Wins the ball back.`;
    case 'Dribble': return `💨 ${player} takes on his marker with a brilliant dribble!`;
    case 'Substitution': return `🔄 Tactical change for ${teamName}. Fresh legs coming on.`;
    case 'Clearance': return `🧹 ${player} clears the danger for ${teamName}.`;
    case 'Cross': return `↗️ ${player} whips in a cross from the ${ev.zone.includes('left') ? 'left' : 'right'} flank!`;
    case 'Long Ball': return `🏈 ${player} launches a long ball forward.`;
    case 'Foul': return `✋ Foul by ${player}. The ref blows the whistle.`;
    case 'Save': return `🧤 What a save! The keeper denies ${player}!`;
    case 'Header': return `🗣️ ${player} rises highest and connects with a header!`;
    case 'Throw-in': return `${player} takes a quick throw-in for ${teamName}.`;
    case 'Goal Kick': return `👟 Goal kick for ${teamName}.`;
    default: return `${player} is involved for ${teamName}.`;
  }
}

export default function Commentary({ events, homeTeam, awayTeam, homePlayers, awayPlayers }: CommentaryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reversed = [...events].reverse().slice(0, 15);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        📺 Live Commentary
      </h3>
      <div ref={scrollRef} className="max-h-[180px] overflow-y-auto custom-scrollbar space-y-1.5">
        {reversed.length === 0 && (
          <p className="text-muted-foreground/50 text-[11px] text-center py-4">Awaiting kick-off…</p>
        )}
        {reversed.map((ev, i) => (
          <div
            key={ev.id}
            className={`flex gap-2 text-[11px] leading-relaxed ${i === 0 ? 'animate-event-flash' : ''}`}
          >
            <span className="font-mono text-gold font-semibold shrink-0 w-7 text-right">
              {String(ev.minute).padStart(2, '0')}′
            </span>
            <span className={`${
              ev.type === 'VAR Review' ? 'text-impact-high font-bold' :
              ev.impact === 'high' ? 'text-foreground font-semibold' :
              ev.impact === 'medium' ? 'text-foreground/80' :
              'text-muted-foreground'
            }`}>
              {generateCommentary(ev, homeTeam, awayTeam, homePlayers, awayPlayers)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
