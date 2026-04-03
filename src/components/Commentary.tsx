import { MatchEvent, MarketConfig } from '@/lib/match-engine';
import { useEffect, useRef } from 'react';

interface CommentaryProps {
  allEvents: Record<string, MatchEvent[]>;
  markets: MarketConfig[];
  activeMarketId: string;
  matchStates: Record<string, { isRunning: boolean; minute: number }>;
}

function getPlayer(team: 'home' | 'away', homePlayers: string[], awayPlayers: string[]): string {
  const names = team === 'home' ? homePlayers : awayPlayers;
  return names[Math.floor(Math.random() * names.length)];
}

const commentaryCache = new Map<string, string>();

function generateCommentary(ev: MatchEvent, homeTeam: string, awayTeam: string, homePlayers: string[], awayPlayers: string[]): string {
  if (commentaryCache.has(ev.id)) return commentaryCache.get(ev.id)!;

  const player = getPlayer(ev.team, homePlayers, awayPlayers);
  const teamName = ev.team === 'home' ? homeTeam : awayTeam;
  let text: string;

  switch (ev.type) {
    case 'Goal': text = `⚽ GOOOAL! ${player} scores for ${teamName}! The crowd erupts!`; break;
    case 'Red Card': text = `🟥 RED CARD! ${player} is sent off! ${teamName} down to ${Math.floor(Math.random() * 2) + 9} men!`; break;
    case 'Penalty': text = `⚠️ PENALTY to ${teamName}! ${player} steps up to the spot...`; break;
    case 'Own Goal': text = `⚽ OWN GOAL! Disaster for ${teamName} as ${player} puts it into his own net!`; break;
    case 'VAR Review': text = `📺 VAR REVIEW! The referee has stopped play — checking ${player}'s involvement. Penda mode activated.`; break;
    case 'Shot on Target': text = `🎯 ${player} fires a shot on target! The keeper is tested!`; break;
    case 'Corner': text = `📐 Corner kick for ${teamName}. ${player} will deliver it.`; break;
    case 'Free Kick': text = `🦶 Free kick in a dangerous position. ${player} stands over the ball.`; break;
    case 'Yellow Card': text = `🟨 Yellow card shown to ${player}. He needs to be careful now.`; break;
    case 'Offside': text = `🚩 Flag goes up — ${player} caught offside.`; break;
    case 'Pass': text = `${player} distributes the ball neatly for ${teamName}.`; break;
    case 'Tackle': text = `🦵 Crunching tackle by ${player}! Wins the ball back.`; break;
    case 'Dribble': text = `💨 ${player} takes on his marker with a brilliant dribble!`; break;
    case 'Substitution': text = `🔄 Tactical change for ${teamName}. Fresh legs coming on.`; break;
    case 'Clearance': text = `🧹 ${player} clears the danger for ${teamName}.`; break;
    case 'Cross': text = `↗️ ${player} whips in a cross from the ${ev.zone.includes('left') ? 'left' : 'right'} flank!`; break;
    case 'Long Ball': text = `🏈 ${player} launches a long ball forward.`; break;
    case 'Foul': text = `✋ Foul by ${player}. The ref blows the whistle.`; break;
    case 'Save': text = `🧤 What a save! The keeper denies ${player}!`; break;
    case 'Header': text = `🗣️ ${player} rises highest and connects with a header!`; break;
    case 'Throw-in': text = `${player} takes a quick throw-in for ${teamName}.`; break;
    case 'Goal Kick': text = `👟 Goal kick for ${teamName}.`; break;
    case 'Interception': text = `🫳 ${player} reads the play and intercepts brilliantly!`; break;
    case 'Block': text = `🛡️ Crucial block by ${player}! Denies a clear chance!`; break;
    case 'Aerial Duel': text = `⬆️ ${player} wins the aerial battle!`; break;
    case 'Key Pass': text = `🔑 Brilliant key pass from ${player}! Opens up the defence!`; break;
    case 'Through Ball': text = `⚡ ${player} threads a perfect through ball!`; break;
    case 'Handball': text = `🤚 Handball! ${player} handles the ball — referee spotted it!`; break;
    case 'Injury': text = `🏥 ${player} is down injured. Medical team rushing on.`; break;
    case 'Time Wasting': text = `⏰ ${player} is taking his time... The crowd is getting restless.`; break;
    case 'Counter Attack': text = `🚀 ${teamName} breaking on the counter! ${player} leads the charge!`; break;
    default: text = `${player} is involved for ${teamName}.`; break;
  }

  commentaryCache.set(ev.id, text);
  return text;
}

interface CommentaryItem {
  event: MatchEvent;
  text: string;
}

export default function Commentary({ allEvents, markets, activeMarketId, matchStates }: CommentaryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Always bound to active contract — no independent selectedMarketId
  const selectedMarket = markets.find(m => m.id === activeMarketId);
  const matchState = matchStates[activeMarketId];

  const hasStarted = matchState && matchState.minute > 0;
  const isFinished = matchState && matchState.minute >= 90 && !matchState.isRunning;
  const isLive = matchState && matchState.isRunning;

  // Build commentary only from active contract events
  const commentary: CommentaryItem[] = [];
  if (selectedMarket && hasStarted) {
    const events = allEvents[activeMarketId] ?? [];
    events.forEach(ev => {
      commentary.push({
        event: ev,
        text: generateCommentary(ev, selectedMarket.homeTeam, selectedMarket.awayTeam, selectedMarket.homePlayers, selectedMarket.awayPlayers),
      });
    });
  }

  const sorted = [...commentary].reverse().slice(0, 40);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [commentary.length]);

  // Contract ticker tabs — clicking switches the global active market
  const contractLabel = selectedMarket?.contract.split('/')[0] ?? '';

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-gold font-semibold">
          📺 Live Commentary
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-gold bg-secondary px-1.5 py-0.5 rounded">{contractLabel}</span>
          {isLive && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold animate-pulse">
              ● LIVE
            </span>
          )}
          {isFinished && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
              FULL TIME
            </span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5">
        {!hasStarted && (
          <p className="text-muted-foreground/50 text-[11px] text-center py-4">
            Awaiting kick-off… Commentary begins when the match starts.
          </p>
        )}
        {isFinished && sorted.length > 0 && (
          <div className="text-center py-1 mb-1 border-b border-border">
            <span className="text-[10px] text-muted-foreground font-semibold">
              🏁 Full Time — Commentary ended
            </span>
          </div>
        )}
        {sorted.map((item, i) => (
          <div
            key={item.event.id}
            className={`flex gap-2 text-[11px] leading-relaxed ${i === 0 && isLive ? 'animate-event-flash' : ''}`}
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
