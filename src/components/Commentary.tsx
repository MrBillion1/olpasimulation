import { MatchEvent, MarketConfig } from '@/lib/match-engine';
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
  const [selectedMarketId, setSelectedMarketId] = useState<string>(activeMarketId);

  // Build commentary for the selected market only
  const selectedMarket = markets.find(m => m.id === selectedMarketId);
  const commentary: CommentaryItem[] = [];
  if (selectedMarket) {
    const events = allEvents[selectedMarketId] ?? [];
    events.forEach(ev => {
      commentary.push({
        marketId: selectedMarketId,
        event: ev,
        text: generateCommentary(ev, selectedMarket.homeTeam, selectedMarket.awayTeam, selectedMarket.homePlayers, selectedMarket.awayPlayers),
        marketLabel: selectedMarket.contract.split('/')[0],
      });
    });
  }

  const sorted = [...commentary].reverse().slice(0, 30);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [commentary.length]);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">
          📺 Live Commentary
        </h3>
      </div>

      {/* Contract tabs */}
      <div className="flex gap-1 flex-wrap mb-2">
        {markets.map(m => {
          const isActive = m.id === selectedMarketId;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMarketId(m.id)}
              className={`text-[8px] px-2 py-1 rounded font-mono font-bold transition-all ${
                isActive
                  ? 'bg-gold text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {m.contract.split('/')[0]}
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5">
        {sorted.length === 0 && (
          <p className="text-muted-foreground/50 text-[11px] text-center py-4">Awaiting kick-off…</p>
        )}
        {sorted.map((item, i) => (
          <div
            key={item.event.id}
            className={`flex gap-2 text-[11px] leading-relaxed ${i === 0 ? 'animate-event-flash' : ''}`}
          >
            <span className="font-mono text-[9px] text-gold/70 shrink-0 w-6 text-right">
              {String(item.event.minute).padStart(2, '0')}′
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
