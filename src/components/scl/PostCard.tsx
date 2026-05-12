import { useStore } from '@/hooks/useStore';
import { actions, SocialPost } from '@/lib/simulation-store';
import { computeRoiPct } from '@/lib/conviction';
import { MARKETS } from '@/lib/match-engine';
import { Link } from 'react-router-dom';

interface Props {
  post: SocialPost;
  showHubLink?: boolean;
}

export default function PostCard({ post, showHubLink = true }: Props) {
  const rt = useStore(s => s.runtimes[post.marketId]);
  const market = MARKETS.find(m => m.id === post.marketId);
  if (!rt || !market) return null;

  const isLive = rt.state.isRunning;
  const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
  const stateLabel = isFinal ? 'FINAL' : isLive ? 'LIVE' : (rt.state.minute === 0 ? 'PRE-MATCH' : 'HALTED');

  const conv = post.conviction;
  const roi = conv ? computeRoiPct(conv, rt.currentPrice) : null;
  const roiUp = (roi ?? 0) >= 0;

  // pre-match countdown is simulated (deterministic hash → days/hours)
  const preMatchCountdown = (() => {
    if (stateLabel !== 'PRE-MATCH') return null;
    const seed = post.marketId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const d = (seed % 14) + 1;
    const h = (seed * 7) % 24;
    return `${d}d ${h.toString().padStart(2, '0')}h`;
  })();

  return (
    <div className="border border-border/60 bg-card/40 rounded-md p-3 hover:border-border transition-colors">
      {/* header: author + state chip */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-sm shrink-0 grid place-items-center text-[9px] font-bold tracking-tighter ${
            post.isNpc ? 'bg-secondary text-muted-foreground' : 'bg-gold/20 text-gold'
          }`}>
            {post.authorName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-foreground truncate">
              {post.authorName}
              {post.isNpc && <span className="ml-1.5 text-[8px] text-muted-foreground/70 font-normal">SIM</span>}
            </div>
            <div className="text-[9px] text-muted-foreground font-mono truncate">{post.authorHandle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            isLive ? 'bg-accent/15 text-accent' : isFinal ? 'bg-gold/15 text-gold' : 'bg-secondary text-muted-foreground'
          }`}>{stateLabel}</span>
        </div>
      </div>

      {/* contract chip + market state line */}
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono">
        {showHubLink ? (
          <Link to={`/scl/${post.marketId}`} className="text-gold font-bold hover:underline">{post.contract}</Link>
        ) : (
          <span className="text-gold font-bold">{post.contract}</span>
        )}
        <span className="text-foreground tabular-nums">${rt.currentPrice.toFixed(4)}</span>
        {isLive && <span className="text-muted-foreground tabular-nums">{rt.state.minute}'</span>}
        {preMatchCountdown && <span className="text-muted-foreground">{preMatchCountdown}</span>}
        {isFinal && <span className="text-muted-foreground">{rt.state.homeScore}-{rt.state.awayScore}</span>}
      </div>

      {/* body */}
      <p className="text-[12px] leading-snug text-foreground/90 mb-2 whitespace-pre-wrap">{post.body}</p>

      {/* conviction badge — strict privacy view */}
      {conv && roi !== null && (
        <div className="flex items-center justify-between border border-border/60 rounded px-2 py-1.5 mb-2 bg-secondary/30">
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="text-gold font-bold">{conv.contract}</span>
            <span className={`font-bold uppercase ${conv.side === 'long' ? 'text-accent' : 'text-destructive'}`}>{conv.side}</span>
            <span className={`font-bold tabular-nums ${roiUp ? 'text-accent' : 'text-destructive'}`}>
              {roiUp ? '+' : ''}{roi.toFixed(2)}%
            </span>
            {isLive && <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />}
          </div>
          {post.isSelf && (
            <button
              onClick={() => actions.detachConviction(post.id)}
              className="text-[8px] text-muted-foreground hover:text-destructive uppercase tracking-wider"
              title="Removes public visibility only — does not close the position"
            >
              Detach
            </button>
          )}
        </div>
      )}

      {/* signal reactions — not engagement, signal-quality votes */}
      <div className="flex items-center gap-1 text-[9px] font-mono">
        {(['agree', 'disagree', 'fade'] as const).map(r => (
          <button
            key={r}
            onClick={() => actions.react(post.id, r)}
            className="px-1.5 py-0.5 rounded bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors"
          >
            {r} {post.reactions[r] > 0 && <span className="text-foreground">{post.reactions[r]}</span>}
          </button>
        ))}
        {post.verdict && (
          <span className={`ml-auto text-[8px] uppercase font-bold ${
            post.verdict === 'correct' ? 'text-accent' : post.verdict === 'incorrect' ? 'text-destructive' : 'text-muted-foreground'
          }`}>{post.verdict}</span>
        )}
      </div>
    </div>
  );
}
