import { MatchEvent, MarketConfig, MARKETS } from '@/lib/match-engine';
import { useEffect, useRef, useState } from 'react';

interface CommentaryProps {
  allEvents: Record<string, MatchEvent[]>;
  markets: MarketConfig[];
  activeMarketId: string;
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
    case 'Interception': return `🫳 ${player} reads the play and intercepts brilliantly!`;
    case 'Block': return `🛡️ Crucial block by ${player}! Denies a clear chance!`;
    case 'Aerial Duel': return `⬆️ ${player} wins the aerial battle!`;
    case 'Key Pass': return `🔑 Brilliant key pass from ${player}! Opens up the defence!`;
    case 'Through Ball': return `⚡ ${player} threads a perfect through ball!`;
    case 'Handball': return `🤚 Handball! ${player} handles the ball — referee spotted it!`;
    case 'Injury': return `🏥 ${player} is down injured. Medical team rushing on.`;
    case 'Time Wasting': return `⏰ ${player} is taking his time... The crowd is getting restless.`;
    case 'Counter Attack': return `🚀 ${teamName} breaking on the counter! ${player} leads the charge!`;
    default: return `${player} is involved for ${teamName}.`;
  }
}

interface CommentaryItem {
  marketId: string;
  event: MatchEvent;
  text: string;
  marketLabel: string;
}

export default function Commentary({ allEvents, markets, activeMarketId }: CommentaryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'active'>('all');

  // Build unified commentary feed from all markets
  const allCommentary: CommentaryItem[] = [];
  markets.forEach(m => {
    const events = allEvents[m.id] ?? [];
    events.forEach(ev => {
      allCommentary.push({
        marketId: m.id,
        event: ev,
        text: generateCommentary(ev, m.homeTeam, m.awayTeam, m.homePlayers, m.awayPlayers),
        marketLabel: m.contract.split('/')[0],
      });
    });
  });

  const filtered = filter === 'active'
    ? allCommentary.filter(c => c.marketId === activeMarketId)
    : allCommentary;

  const sorted = [...filtered].sort((a, b) => {
    const aIdx = (allEvents[a.marketId] ?? []).indexOf(a.event);
    const bIdx = (allEvents[b.marketId] ?? []).indexOf(b.event);
    return bIdx - aIdx || b.event.minute - a.event.minute;
  }).slice(0, 25);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [allCommentary.length]);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">
          📺 Live Commentary
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`text-[9px] px-2 py-0.5 rounded font-semibold transition-all ${
              filter === 'all' ? 'bg-gold text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >All Matches</button>
          <button
            onClick={() => setFilter('active')}
            className={`text-[9px] px-2 py-0.5 rounded font-semibold transition-all ${
              filter === 'active' ? 'bg-gold text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >Active Only</button>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5">
        {sorted.length === 0 && (
          <p className="text-muted-foreground/50 text-[11px] text-center py-4">Awaiting kick-off…</p>
        )}
        {sorted.map((item, i) => (
          <div
            key={`${item.marketId}-${item.event.id}`}
            className={`flex gap-2 text-[11px] leading-relaxed ${i === 0 ? 'animate-event-flash' : ''}`}
          >
            <span className="font-mono text-[8px] text-gold/60 shrink-0 w-12 text-right">
              <span className="text-gold font-bold">{item.marketLabel}</span>
              <br />{String(item.event.minute).padStart(2, '0')}′
            </span>
            <span className={`${
              item.event.type === 'VAR Review' ? 'text-impact-high font-bold' :
              item.event.impact === 'high' ? 'text-foreground font-semibold' :
              item.event.impact === 'medium' ? 'text-foreground/80' :
              'text-muted-foreground'
            }`}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
